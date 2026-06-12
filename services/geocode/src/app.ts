import { Hono }         from "hono";
import { createRouter } from "./routes/index.js";
import type Container   from "./modules/container.js";

/**
 * Monta a aplicação Hono a partir do container já resolvido:
 * health-check + rotas de negócio. Não cria dependências, só as conecta.
 */
export function createApp(container: Container): Hono {
  const app = new Hono();

  // Liveness probe (usada pelo HEALTHCHECK do container).
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/", createRouter(container));

  return app;
}
