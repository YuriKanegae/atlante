import { Hono }              from "hono";
import { createGeocodeRoutes } from "./geocode.routes.js";
import type Container          from "../modules/container.js";

/**
 * Monta o roteador raiz agregando os grupos de rotas a partir dos
 * controllers já resolvidos no container.
 */
export function createRouter(container: Container): Hono {
  const router = new Hono();
  router.route("/", createGeocodeRoutes(container.geocodeController));
  return router;
}
