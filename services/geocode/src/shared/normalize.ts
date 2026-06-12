/**
 * Normalização de texto compartilhada pela ingestão e pela busca.
 *
 * Armadilha do guia: se a normalização (acentos + abreviações) não for a
 * MESMA nos dois lados, "Av. Paulista" indexado não casa com "Avenida Paulista"
 * consultado. Por isso esta função é a única fonte de verdade.
 */

/** Abreviações PT-BR de logradouros → forma por extenso. */
const ABBREVIATIONS: Record<string, string> = {
  av: "avenida",
  ave: "avenida",
  r: "rua",
  pc: "praca",
  pca: "praca",
  al: "alameda",
  rod: "rodovia",
  tv: "travessa",
  trav: "travessa",
  estr: "estrada",
  lgo: "largo",
  pq: "parque",
  jd: "jardim",
  vl: "vila",
};

/** Faixa Unicode dos diacríticos combinantes (U+0300–U+036F). */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Remove acentos via decomposição Unicode (NFD) + descarte dos diacríticos. */
function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "");
}

/**
 * Normaliza um texto para indexação/consulta:
 * minúsculas, sem acentos, pontuação virando espaço, abreviações expandidas.
 */
export function normalize(text: string): string {
  const base = stripDiacritics(text.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (base === "") return "";

  return base
    .split(" ")
    .map((token) => ABBREVIATIONS[token] ?? token)
    .join(" ");
}

/**
 * Converte um texto normalizado numa expressão MATCH do FTS5.
 * Cada token é entre aspas (neutraliza sintaxe), unidos por AND implícito;
 * o último ganha `*` de prefixo para tolerância a digitação parcial.
 * Retorna `""` quando não há tokens (o chamador deve tratar como "sem resultados").
 */
export function toMatchQuery(normalizedText: string): string {
  const tokens = normalizedText.split(" ").filter(Boolean);
  if (tokens.length === 0) return "";

  return tokens
    .map((token, i) => (i === tokens.length - 1 ? `"${token}"*` : `"${token}"`))
    .join(" ");
}
