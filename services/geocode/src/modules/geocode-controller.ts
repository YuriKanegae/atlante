import type { Context } from "hono";

/**
 * Controller da busca: extrai os dados da requisição, valida os parâmetros e
 * delega ao handler. Não contém regra de negócio — só borda HTTP.
 */
export default interface GeocodeController {
  search(c: Context): Response | Promise<Response>;
}
