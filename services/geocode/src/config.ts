import type Config from "./modules/config.js";

const DEFAULT_PORT    = 3333;
const DEFAULT_DB_PATH = "./data/geocode.db";

/** Lê e valida a configuração a partir do ambiente (injetável para testes). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT inválido: ${env.PORT}`);
  }

  return {
    port,
    dbPath: env.GEOCODE_DB_PATH ?? DEFAULT_DB_PATH,
  };
}
