import { parseArgs }    from "node:util";
import { openDb }        from "../../shared/db.js";
import { SCHEMA_SQL }    from "../../shared/schema.js";
import { normalize }     from "../../shared/normalize.js";
import { readAddresses } from "./pbf-reader.js";
import type AddressSource from "../../modules/address-source.js";
import type OsmFeature    from "../../modules/osm-feature.js";
import type Endereco      from "../../modules/endereco.js";

const COMMIT_EVERY = 100_000;

/**
 * Informação agregada por via (no 1º passe), usada para enriquecer cada
 * registro: faixa de numeração (estimativa de número) e a cidade/bairro mais
 * frequentes entre os pontos da via (para preencher quando o objeto não traz).
 */
type StreetInfo = {
  min:        number;
  max:        number;
  hasNumbers: boolean;
  cidades:    Map<string, number>;
  bairros:    Map<string, number>;
};

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

/** Incrementa a contagem de um valor num mapa de frequências. */
function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** Retorna a chave mais frequente do mapa, ou `null` se vazio. */
function mode(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }
  return best;
}

/**
 * Acumula, por via normalizada, a faixa de numeração e as cidades/bairros
 * vistos nos seus pontos (1º passe).
 */
function collectStreet(
  streets: Map<string, StreetInfo>,
  feature: OsmFeature,
): void {
  const key = normalize(feature.street);
  let info = streets.get(key);
  if (!info) {
    info = {
      min:        Infinity,
      max:        -Infinity,
      hasNumbers: false,
      cidades:    new Map(),
      bairros:    new Map(),
    };
    streets.set(key, info);
  }

  const numero = parseHouseNumber(feature.numeroRaw);
  if (numero !== null) {
    info.hasNumbers = true;
    if (numero < info.min) info.min = numero;
    if (numero > info.max) info.max = numero;
  }
  if (feature.cidade) bump(info.cidades, feature.cidade);
  if (feature.bairro) bump(info.bairros, feature.bairro);
}

/**
 * Monta a string legível do endereço a partir da feature.
 * Usada tanto para o `label` exibido (com cidade/bairro enriquecidos) quanto,
 * com as tags próprias, para o `texto` indexado.
 */
function buildLabel(feature: OsmFeature): string {
  const parts: string[] = [];
  parts.push(feature.numeroRaw ? `${feature.street}, ${feature.numeroRaw}` : feature.street);
  if (feature.bairro) parts.push(feature.bairro);
  if (feature.cidade) parts.push(feature.cidade);
  return parts.join(" - ");
}

/**
 * Finaliza uma feature em Endereco, enriquecendo com a informação da via:
 * - cidade/bairro: usa o do próprio objeto; quando ausente, o mais frequente
 *   da via (ruas raramente trazem essas tags, então herdam dos seus pontos);
 * - número: usa o real quando existe; senão estima pelo ponto médio da faixa
 *   conhecida da via (min–max agregado no 1º passe).
 */
function finalize(
  feature: OsmFeature,
  streets: Map<string, StreetInfo>,
): Endereco {
  const info = streets.get(normalize(feature.street));

  const cidade = feature.cidade ?? (info ? mode(info.cidades) : null);
  const bairro = feature.bairro ?? (info ? mode(info.bairros) : null);

  const real = parseHouseNumber(feature.numeroRaw);
  let numero = real;
  let numeroEstimado = false;
  if (real === null && info?.hasNumbers) {
    numero = Math.round((info.min + info.max) / 2);
    numeroEstimado = true;
  }

  return {
    label: buildLabel({ ...feature, cidade, bairro }),
    lat:   feature.lat,
    lon:   feature.lon,
    tipo:  feature.tipo,
    cidade,
    bairro,
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
    // 1º passe: agrega numeração e cidade/bairro por via.
    const streets = new Map<string, StreetInfo>();
    for await (const feature of source(options.pbfPath)) {
      collectStreet(streets, feature);
    }
    console.log(`  ${streets.size.toLocaleString("pt-BR")} vias agregadas`);

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
      const e = finalize(feature, streets);
      // texto indexado: só tags próprias da feature (não o enriquecido), para
      // não inflar documentos curtos e preservar o ranking BM25.
      const texto = normalize(buildLabel(feature));
      insert.run(
        texto,
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
