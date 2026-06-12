import { openDb }                  from "./shared/db.js";
import { createGeocodeHandler }    from "./handlers/geocode.handler.js";
import { createGeocodeController } from "./controllers/geocode.controller.js";
import { DbUnavailableError }      from "./shared/errors.js";
import type Config                 from "./modules/config.js";
import type Container              from "./modules/container.js";
import type GeocodeSearch          from "./modules/geocode-search.js";

/** Instância única do container (memoizada) — garante um só handle de banco. */
let instance: Container | null = null;

/** Handler de fallback usado quando o índice não pôde ser aberto. */
function unavailableSearch(): never {
  throw new DbUnavailableError();
}

/**
 * Cria (uma única vez) o container de dependências: abre o banco em modo
 * leitura e conecta handler e controller. Chamadas seguintes reaproveitam a
 * mesma instância, então o banco é aberto exatamente uma vez no processo.
 */
export function createContainer(config: Config): Container {
  if (instance) return instance;

  let db: Container["db"] = null;
  let search: GeocodeSearch;

  try {
    db = openDb(config.dbPath, { readonly: true });
    search = createGeocodeHandler(db);
    console.log(`Índice carregado: ${config.dbPath}`);
  } catch (err) {
    // Degrada com elegância: a API sobe e responde 503 até o índice existir.
    console.error(
      `Índice indisponível (${config.dbPath}): ${(err as Error).message}`,
    );
    search = unavailableSearch;
  }

  instance = { db, geocodeController: createGeocodeController(search) };
  return instance;
}
