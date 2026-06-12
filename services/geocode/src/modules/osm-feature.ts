import type { Tipo } from "./endereco.js";

/**
 * Feature endereçável crua extraída do PBF, antes da estimativa de número.
 * `street` vem de `addr:street` (pontos) ou `name` (ruas); `numeroRaw` é o
 * `addr:housenumber` textual original, quando houver.
 */
export default interface OsmFeature {
  tipo:      Tipo;
  lat:       number;
  lon:       number;
  street:    string;
  numeroRaw: string | null;
  cidade:    string | null;
  bairro:    string | null;
}
