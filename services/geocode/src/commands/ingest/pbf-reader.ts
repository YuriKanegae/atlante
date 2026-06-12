import { createReadStream } from "node:fs";
import { PassThrough }      from "node:stream";
import parseOSM             from "osm-pbf-parser";
import type { OsmItem }     from "osm-pbf-parser";
import type OsmFeature      from "../../modules/osm-feature.js";
import type { Tipo }        from "../../modules/endereco.js";

/**
 * Decide se um objeto OSM é endereçável dentro do escopo (endereços + ruas).
 * Retorna o tipo, ou `null` quando deve ser ignorado (ex.: POIs soltos).
 */
function classify(tags: Record<string, string>): Tipo | null {
  if (tags["addr:housenumber"]) return "endereco";
  if (tags["highway"] && tags["name"]) return "rua";
  return null;
}

/**
 * Monta a feature endereçável a partir das tags + coordenada.
 * Retorna `null` quando está fora de escopo ou sem nome de via.
 */
function toFeature(
  tags: Record<string, string>,
  lon: number,
  lat: number,
): OsmFeature | null {
  const tipo = classify(tags);
  if (!tipo) return null;

  const street = tags["addr:street"] ?? tags["name"];
  if (!street) return null;

  return {
    tipo,
    lat,
    lon,
    street,
    numeroRaw: tags["addr:housenumber"] ?? null,
    cidade:    tags["addr:city"] ?? null,
    bairro:    tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? null,
  };
}

/** Centroide simples (média dos vértices conhecidos) de uma way. */
function centroid(
  refs: number[],
  coords: Map<number, [number, number]>,
): [number, number] | null {
  let sumLon = 0;
  let sumLat = 0;
  let n = 0;

  for (const ref of refs) {
    const coord = coords.get(ref);
    if (!coord) continue;
    sumLon += coord[0];
    sumLat += coord[1];
    n++;
  }

  return n === 0 ? null : [sumLon / n, sumLat / n];
}

/**
 * Lê um `.osm.pbf` e emite as features endereçáveis (streaming).
 *
 * O PBF vem em ordem canônica (nodes → ways → relations), então um único
 * passe basta: as coordenadas dos nodes são memorizadas antes das ways que
 * as referenciam. Relations ficam fora do escopo v1.
 */
export async function* readAddresses(pbfPath: string): AsyncGenerator<OsmFeature> {
  const coords = new Map<number, [number, number]>();

  // O parser usa um stream legado (sem Symbol.asyncIterator); canalizamos por
  // um PassThrough object-mode, que é async-iterável e propaga erros.
  const source = createReadStream(pbfPath);
  const parser = parseOSM();
  const out    = new PassThrough({ objectMode: true });
  source.on("error", (err) => out.destroy(err));
  parser.on("error", (err) => out.destroy(err));
  source.pipe(parser).pipe(out);

  for await (const batch of out as AsyncIterable<OsmItem[]>) {
    for (const item of batch) {
      if (item.type === "node") {
        if (typeof item.lon !== "number" || typeof item.lat !== "number") continue;
        coords.set(item.id, [item.lon, item.lat]);

        const feature = toFeature(item.tags, item.lon, item.lat);
        if (feature) yield feature;
      } else if (item.type === "way" && item.refs) {
        const point = centroid(item.refs, coords);
        if (!point) continue;

        const feature = toFeature(item.tags, point[0], point[1]);
        if (feature) yield feature;
      }
    }
  }
}
