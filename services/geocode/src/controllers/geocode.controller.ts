import type { Context }     from "hono";
import { geocodeQuerySchema } from "./geocode.schema.js";
import { DbUnavailableError } from "../shared/errors.js";
import type GeocodeController from "../modules/geocode-controller.js";
import type GeocodeSearch     from "../modules/geocode-search.js";

/**
 * Cria o controller da busca. Recebe o handler por injeção (DIP) e cuida
 * apenas da borda HTTP: lê os parâmetros, valida e serializa a resposta.
 */
export function createGeocodeController(search: GeocodeSearch): GeocodeController {
  return {
    /**
     * `GET /geocode`: valida `q`/`limit`, delega ao handler e responde em JSON.
     * Parâmetros inválidos → 400; índice indisponível → 503.
     */
    search(c: Context): Response {
      const parsed = geocodeQuerySchema.safeParse(c.req.query());
      if (!parsed.success) {
        return c.json(
          { error: "parâmetros inválidos", issues: parsed.error.issues },
          400,
        );
      }

      const { q, limit } = parsed.data;
      try {
        const results = search(q, limit);
        return c.json({ query: q, count: results.length, results });
      } catch (err) {
        if (err instanceof DbUnavailableError) {
          return c.json({ error: err.message }, 503);
        }
        throw err;
      }
    },
  };
}
