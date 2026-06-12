import maplibregl from "maplibre-gl";

const SEARCH_LIMIT = 6;
const DEBOUNCE_MS  = 500;
const RESULT_ZOOM  = 16;

/** Adia a execução de `fn` até `ms` sem novas chamadas. */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Consulta o serviço de geocode e devolve a lista de resultados. */
async function geocode(baseUrl, query, signal) {
  const url = `${baseUrl}/geocode?q=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`geocode HTTP ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

/** Texto secundário do item (bairro/cidade), quando existir. */
function describe(result) {
  return [ result.bairro, result.cidade ].filter(Boolean).join(", ");
}

/**
 * Monta a caixa de pesquisa, a listagem e liga os comportamentos ao mapa.
 * As buscas vão direto para `baseUrl`/geocode (mesmo host em produção).
 */
export function createSearchBox(map, baseUrl) {
  const container = document.createElement("div");
  container.id = "search";

  const input = document.createElement("input");
  input.id           = "search-input";
  input.type         = "search";
  input.placeholder  = "Buscar endereço…";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Buscar endereço");

  const list = document.createElement("ul");
  list.id = "search-results";

  container.append(input, list);
  document.body.append(container);

  let marker     = null;
  let controller = null;

  /** Esvazia e esconde a listagem. */
  const clearList = () => {
    list.replaceChildren();
    list.classList.remove("open");
  };

  /** Centraliza o mapa no resultado escolhido e marca o ponto. */
  const select = (result) => {
    input.value = result.label;
    clearList();

    map.flyTo({ center: [ result.lon, result.lat ], zoom: RESULT_ZOOM });

    marker?.remove();
    marker = new maplibregl.Marker()
      .setLngLat([ result.lon, result.lat ])
      .addTo(map);
  };

  /** Renderiza os resultados como itens clicáveis. */
  const render = (results) => {
    if (results.length === 0) {
      clearList();
      return;
    }

    const items = results.map((result) => {
      const item = document.createElement("li");
      item.className = "search-item";

      const label = document.createElement("span");
      label.className   = "search-item__label";
      label.textContent = result.label;
      item.append(label);

      const detail = describe(result);
      if (detail) {
        const sub = document.createElement("span");
        sub.className   = "search-item__detail";
        sub.textContent = detail;
        item.append(sub);
      }

      item.addEventListener("click", () => select(result));
      return item;
    });

    list.replaceChildren(...items);
    list.classList.add("open");
  };

  /** Dispara a busca para o termo atual (com cancelamento da anterior). */
  const run = async (query) => {
    const term = query.trim();
    if (term === "") {
      clearList();
      return;
    }

    controller?.abort();
    controller = new AbortController();

    try {
      render(await geocode(baseUrl, term, controller.signal));
    } catch (err) {
      if (err.name !== "AbortError") console.error("geocode error:", err);
    }
  };

  input.addEventListener("input", debounce((e) => run(e.target.value), DEBOUNCE_MS));
}
