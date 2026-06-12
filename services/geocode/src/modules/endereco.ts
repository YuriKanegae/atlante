/** Categoria do objeto endereçável indexado. */
export type Tipo = "endereco" | "rua";

/**
 * Registro de endereço pronto para indexar no FTS5 (write side).
 * `numero` é o valor real (endereço) ou estimado (rua); veja `numeroEstimado`.
 */
export default interface Endereco {
  label:          string;
  lat:            number;
  lon:            number;
  tipo:           Tipo;
  cidade:         string | null;
  bairro:         string | null;
  numero:         number | null;
  numeroEstimado: boolean;
}
