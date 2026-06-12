import type { Tipo } from "./endereco.js";

/**
 * Resultado de uma busca de geocodificação retornado pela API (read side).
 * `score` é o BM25 — quanto menor, mais relevante.
 */
export default interface GeocodeResult {
  label:          string;
  lat:            number;
  lon:            number;
  tipo:           Tipo;
  cidade:         string | null;
  bairro:         string | null;
  numero:         number | null;
  numeroEstimado: boolean;
  score:          number;
}
