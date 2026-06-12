import type OsmFeature from "./osm-feature.js";

/**
 * Fonte de features endereçáveis (write side). Recebe um caminho/identificador
 * e emite as features em streaming — trocável por um mock em testes (OCP/DIP).
 */
export default interface AddressSource {
  (input: string): AsyncIterable<OsmFeature>;
}
