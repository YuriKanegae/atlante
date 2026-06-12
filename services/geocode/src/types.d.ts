declare module "osm-pbf-parser" {
  import type { Duplex } from "node:stream";

  /** Um elemento OSM emitido pelo parser (node, way ou relation). */
  export interface OsmItem {
    type: "node" | "way" | "relation";
    id: number;
    lat?: number;
    lon?: number;
    tags: Record<string, string>;
    refs?: number[];
  }

  /**
   * Stream em object-mode: cada chunk é um array de OsmItem,
   * em ordem canônica (nodes → ways → relations).
   */
  export default function parseOSM(): Duplex;
}
