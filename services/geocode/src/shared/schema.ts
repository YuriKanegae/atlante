/**
 * DDL do índice de geocodificação (SQLite FTS5).
 *
 * - `texto` é a única coluna indexada (texto normalizado da busca).
 * - As demais são UNINDEXED: armazenadas, mas fora do índice invertido.
 * - `numero` guarda o número real (endereço) ou estimado (rua);
 *   `numero_estimado` (0/1) sinaliza qual dos dois.
 * - `remove_diacritics 2` deixa a busca tolerante a acentuação no tokenizador.
 */
export const SCHEMA_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS enderecos USING fts5(
  texto,
  label           UNINDEXED,
  lat             UNINDEXED,
  lon             UNINDEXED,
  tipo            UNINDEXED,
  cidade          UNINDEXED,
  bairro          UNINDEXED,
  numero          UNINDEXED,
  numero_estimado UNINDEXED,
  tokenize = "unicode61 remove_diacritics 2"
);
`;
