import type GeocodeResult from "./geocode-result.js";

/**
 * Contrato do read side: dado um texto e um limite, devolve as coordenadas
 * candidatas ordenadas por relevância. Abstrai a implementação sobre SQLite (DIP).
 */
export default interface GeocodeSearch {
  (query: string, limit: number): GeocodeResult[];
}
