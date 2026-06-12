import { Hono }             from "hono";
import type GeocodeController from "../modules/geocode-controller.js";

/**
 * Define as rotas do geocode, ligando cada caminho ao seu controller.
 * Sem regra de negócio nem validação aqui — apenas o mapeamento HTTP.
 */
export function createGeocodeRoutes(controller: GeocodeController): Hono {
  const router = new Hono();
  router.get("/geocode", (c) => controller.search(c));
  return router;
}
