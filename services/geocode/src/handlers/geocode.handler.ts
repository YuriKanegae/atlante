import type { Database }      from "better-sqlite3";
import { normalize, toMatchQuery } from "../shared/normalize.js";
import type GeocodeSearch     from "../modules/geocode-search.js";
import type GeocodeResult     from "../modules/geocode-result.js";
import type { Tipo }          from "../modules/endereco.js";

/** Linha crua retornada pelo SQLite para uma busca. */
type Row = {
  label:           string;
  lat:             number;
  lon:             number;
  tipo:            Tipo;
  cidade:          string | null;
  bairro:          string | null;
  numero:          number | null;
  numero_estimado: number;
  score:           number;
};

const SQL = `
  SELECT label, lat, lon, tipo, cidade, bairro, numero, numero_estimado,
         bm25(enderecos) AS score
  FROM enderecos
  WHERE enderecos MATCH ?
  ORDER BY score
  LIMIT ?
`;

/**
 * Converte uma linha do banco no resultado público da API,
 * coagindo os tipos numéricos e o flag de estimativa.
 */
function toResult(row: Row): GeocodeResult {
  return {
    label:          row.label,
    lat:            Number(row.lat),
    lon:            Number(row.lon),
    tipo:           row.tipo,
    cidade:         row.cidade,
    bairro:         row.bairro,
    numero:         row.numero === null ? null : Number(row.numero),
    numeroEstimado: row.numero_estimado === 1,
    score:          row.score,
  };
}

/**
 * Cria o handler de busca (regra de negócio) sobre o banco injetado.
 * O statement é preparado uma única vez; a busca em si é pura leitura.
 */
export function createGeocodeHandler(db: Database): GeocodeSearch {
  const statement = db.prepare(SQL);

  /**
   * Normaliza a consulta, casa no índice FTS5 e mapeia as linhas.
   * Retorna lista vazia quando a consulta não gera tokens válidos.
   */
  return (query, limit) => {
    const match = toMatchQuery(normalize(query));
    if (match === "") return [];

    const rows = statement.all(match, limit) as Row[];
    return rows.map(toResult);
  };
}
