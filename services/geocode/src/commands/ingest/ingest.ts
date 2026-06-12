import { parseArgs }    from "node:util";
import { openDb }        from "../../shared/db.js";
import { SCHEMA_SQL }    from "../../shared/schema.js";
import { normalize }     from "../../shared/normalize.js";
import { readAddresses } from "./pbf-reader.js";
import type AddressSource from "../../modules/address-source.js";
import type OsmFeature    from "../../modules/osm-feature.js";
import type Endereco      from "../../modules/endereco.js";

const COMMIT_EVERY = 100_000;

/** Faixa de numeração observada numa via (para estimar o número). */
type NumberRange = { min: number; max: number };

/** Opções de ingestão; `source` é injetável para testes. */
interface IngestOptions {
  pbfPath: string;
  dbPath:  string;
  source?: AddressSource;
}

/**
 * Extrai o primeiro inteiro de um `addr:housenumber` textual
 * (ex.: "123", "123A", "123-125" → 123). Retorna `null` se não houver dígito.
 */
function parseHouseNumber(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : null;
}

/** Acumula a faixa min–max de numeração por via normalizada (1º passe). */
function collectRange(
  ranges: Map<string, NumberRange>,
  feature: OsmFeature,
): void {
  const numero = parseHouseNumber(feature.numeroRaw);
  if (numero === null) return;

  const key = normalize(feature.street);
  const range = ranges.get(key);
  if (!range) {
    ranges.set(key, { min: numero, max: numero });
    return;
  }
  if (numero < range.min) range.min = numero;
  if (numero > range.max) range.max = numero;
}

/** Monta a string legível do endereço a partir da feature. */
function buildLabel(feature: OsmFeature): string {
  const parts: string[] = [];
  parts.push(feature.numeroRaw ? `${feature.street}, ${feature.numeroRaw}` : feature.street);
  if (feature.bairro) parts.push(feature.bairro);
  if (feature.cidade) parts.push(feature.cidade);
  return parts.join(" - ");
}

/**
 * Finaliza uma feature em Endereco, resolvendo o número:
 * usa o número real quando existe; senão estima pelo ponto médio da faixa
 * conhecida da via (min–max agregado no 1º passe).
 */
function finalize(
  feature: OsmFeature,
  ranges: Map<string, NumberRange>,
): Endereco {
  const real = parseHouseNumber(feature.numeroRaw);

  let numero = real;
  let numeroEstimado = false;
  if (real === null) {
    const range = ranges.get(normalize(feature.street));
    if (range) {
      numero = Math.round((range.min + range.max) / 2);
      numeroEstimado = true;
    }
  }

  return {
    label:  buildLabel(feature),
    lat:    feature.lat,
    lon:    feature.lon,
    tipo:   feature.tipo,
    cidade: feature.cidade,
    bairro: feature.bairro,
    numero,
    numeroEstimado,
  };
}

/**
 * Popula o índice FTS5 a partir de uma fonte de features.
 * Faz dois passes: (1) agrega a faixa de numeração por via para estimar
 * números; (2) finaliza e insere cada endereço numa transação.
 * Retorna a quantidade de endereços indexados.
 */
export async function ingest(options: IngestOptions): Promise<number> {
  const source = options.source ?? readAddresses;
  const db = openDb(options.dbPath, { readonly: false });

  try {
    // 1º passe: faixas de numeração por via.
    const ranges = new Map<string, NumberRange>();
    for await (const feature of source(options.pbfPath)) {
      collectRange(ranges, feature);
    }
    console.log(`  ${ranges.size.toLocaleString("pt-BR")} vias com numeração conhecida`);

    db.exec("DROP TABLE IF EXISTS enderecos;");
    db.exec(SCHEMA_SQL);
    const insert = db.prepare(
      `INSERT INTO enderecos
         (texto, label, lat, lon, tipo, cidade, bairro, numero, numero_estimado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    // 2º passe: finaliza (com estimativa) e insere.
    let count = 0;
    db.exec("BEGIN");
    for await (const feature of source(options.pbfPath)) {
      const e = finalize(feature, ranges);
      insert.run(
        normalize(e.label),
        e.label,
        e.lat,
        e.lon,
        e.tipo,
        e.cidade,
        e.bairro,
        e.numero,
        e.numeroEstimado ? 1 : 0,
      );
      count++;
      if (count % COMMIT_EVERY === 0) {
        db.exec("COMMIT");
        console.log(`  ${count.toLocaleString("pt-BR")} endereços…`);
        db.exec("BEGIN");
      }
    }
    db.exec("COMMIT");

    return count;
  } finally {
    db.close();
  }
}

/** Faz o parse de `--pbf <path> --db <path>`. */
function parseCliArgs(): { pbfPath: string; dbPath: string } {
  const { values } = parseArgs({
    options: {
      pbf: { type: "string" },
      db:  { type: "string" },
    },
  });

  if (!values.pbf || !values.db) {
    throw new Error("Uso: ingest --pbf <arquivo.osm.pbf> --db <arquivo.db>");
  }

  return { pbfPath: values.pbf, dbPath: values.db };
}

/** Ponto de entrada da CLI de ingestão. */
async function main(): Promise<void> {
  const { pbfPath, dbPath } = parseCliArgs();
  console.log(`Ingerindo ${pbfPath} → ${dbPath}`);

  const start = process.hrtime.bigint();
  const total = await ingest({ pbfPath, dbPath });
  const seconds = Number(process.hrtime.bigint() - start) / 1e9;

  console.log(
    `Concluído: ${total.toLocaleString("pt-BR")} endereços em ${seconds.toFixed(1)}s`,
  );
}

// Executa só quando rodado como CLI (não quando importado em teste).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Falha na ingestão:", err);
    process.exit(1);
  });
}
