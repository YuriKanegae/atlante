#!/usr/bin/env bash
#
# Conversão OSM → extrato endereçável de São Paulo.
#
# Recebe o recorte de SP (`sp.osm.pbf`, já cortado com osmium extract) e aplica
# apenas o filtro de objetos endereçáveis (com addr:housenumber ou name).
# A ingestão no SQLite é um passo separado em Node:
#   npm run ingest -- --pbf <saída> --db <banco>
#
# Uso:
#   ./scripts/convert.sh [SP_PBF]
#   OUT=./data ./scripts/convert.sh sp.osm.pbf
#
set -euo pipefail

SP="${1:-sp.osm.pbf}"
OUT="${OUT:-./data}"

if ! command -v osmium >/dev/null 2>&1; then
  echo "erro: osmium-tool não encontrado no PATH (instale: brew install osmium-tool / apt install osmium-tool)" >&2
  exit 1
fi
if [[ ! -f "$SP" ]]; then
  echo "erro: recorte de SP não encontrado: $SP" >&2
  exit 1
fi

mkdir -p "$OUT"

echo "Filtrando objetos endereçáveis (addr:housenumber + name) de ${SP}..."
osmium tags-filter "$SP" nwr/addr:housenumber nwr/name \
  -o "$OUT/sp-enderecos.osm.pbf" --overwrite

echo ""
echo "Pronto: $OUT/sp-enderecos.osm.pbf"
echo "Próximo passo: npm run ingest -- --pbf $OUT/sp-enderecos.osm.pbf --db $OUT/geocode.db"
