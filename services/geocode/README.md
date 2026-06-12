# geocode

Serviço de geocodificação (texto → coordenada) da Fase 3. Indexa endereços e
ruas do estado de São Paulo num SQLite **FTS5** e expõe `GET /geocode`.

## Arquitetura

Camadas (read side) com responsabilidade única, conectadas por injeção de dependência:

- **routes** (`src/routes`) — mapeiam caminho → controller, sem lógica.
- **controllers** (`src/controllers`) — borda HTTP: leem a requisição, validam parâmetros (zod) e serializam a resposta.
- **handlers** (`src/handlers`) — regra de negócio: normalizam, consultam o FTS5 (BM25) e montam o resultado.
- **container** (`src/container.ts`) — sistema de DI: abre o banco **uma única vez** (memoizado) e conecta handler ↔ controller.
- **modules** (`src/modules`) — interfaces (uma por arquivo, export default).
- **commands/ingest** (`src/commands/ingest`) — write side: lê o `.osm.pbf` e popula o índice.
- **shared** (`src/shared`) — `normalize` (acentos + abreviações, usada na ingestão **e** na busca), `db`, `schema`, erros.
- `src/index.ts` é o *composition root*: `loadConfig → createContainer → createApp → serve`.

## Dados (uma vez, na máquina de ingestão)

Precisa do `osmium-tool`. Partindo do extrato do Sudeste (Geofabrik):

```bash
# 1) conversão OSM: recorta SP e filtra objetos endereçáveis
npm run convert -- sudeste-latest.osm.pbf ../../infra/tileserver/sp.poly
# → data/sp-enderecos.osm.pbf

# 2) ingestão: popula o índice SQLite FTS5
#    (o cache de coordenadas pode pedir heap extra em extratos grandes)
node --max-old-space-size=4096 --import tsx \
  src/commands/ingest/ingest.ts --pbf data/sp-enderecos.osm.pbf --db data/geocode.db
```

Em produção, coloque o `geocode.db` em `/opt/maps/geocode/` (volume read-only do container).

## API

```bash
GEOCODE_DB_PATH=data/geocode.db npm run dev

curl 'http://localhost:3000/geocode?q=avenida%20paulista&limit=5'
curl 'http://localhost:3000/health'
```

`GET /geocode` — query params (validados com zod):
- `q` (obrigatório): texto do endereço, 1–200 chars.
- `limit` (opcional): 1–20, default 5.

Resposta: `{ query, count, results: [{ label, lat, lon, tipo, cidade, bairro, numero, numeroEstimado, score }] }`
- `cidade`/`bairro`: do OSM original (`addr:city`, `addr:suburb`/`neighbourhood`), `null` se ausentes.
- `numero`: real (`numeroEstimado: false`) para endereços; estimado (`numeroEstimado: true`) para ruas, pelo ponto médio da faixa de numeração conhecida da via.
- `score`: BM25, menor é mais relevante.

Sem `q` → `400`; índice ausente → `503`.
