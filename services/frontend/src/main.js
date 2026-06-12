import "./style.css";
import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl   from "maplibre-gl";
import { Protocol } from "pmtiles";

const BASE_URL        = "https://atlante.yurikanegae.com";
const SP_BOUNDS       = [ [ -53.33, -25.71 ], [ -43.94, -19.56 ] ];
const SP_CENTER       = [ -46.6333, -23.5505 ];
const DEFAULT_ZOOM    = 12;
const ZOOM_DEVIATION  = 6;

const protocol        = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  style:      BASE_URL + "/style.json",
  container:  "map",
  
  center:     SP_CENTER, 
  maxBounds:  SP_BOUNDS,

  zoom:       DEFAULT_ZOOM,
  minZoom:    DEFAULT_ZOOM - ZOOM_DEVIATION,
  maxZoom:    DEFAULT_ZOOM + ZOOM_DEVIATION,
});

map.addControl( new maplibregl.NavigationControl(), "top-right" );

map.on("load",  () => { document.getElementById("loader")?.classList.add("hidden"); });
map.on("error", (e) => console.error("map error:", e.error ?? e));