import type { Database }   from "better-sqlite3";
import type GeocodeController from "./geocode-controller.js";

/**
 * Container de dependências resolvidas. Mantém o único handle de banco do
 * processo e os controllers já conectados aos seus handlers.
 */
export default interface Container {
  db:                Database | null;
  geocodeController: GeocodeController;
}
