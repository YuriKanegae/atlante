import { serve }           from "@hono/node-server";
import { loadConfig }      from "./config.js";
import { createContainer } from "./container.js";
import { createApp }       from "./app.js";

/**
 * Composition root: lê a configuração, resolve o container de dependências
 * (abre o banco uma única vez) e sobe o servidor HTTP.
 */
function main(): void {
  const config    = loadConfig();
  const container = createContainer(config);
  const app       = createApp(container);

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Geocode rodando em http://localhost:${info.port}`);
  });
}

main();
