/* ==========================================================================
   CONFIGURAÇÕES E ESTADO GLOBAL 
   ========================================================================== */
export const CONFIG = {
  DEBOUNCE_DELAY_MS: 300,
  LOCALSTORAGE_KEY: 'app_video_list_official_state',
  DATA_URL: 'dataset.json'
};

// Cache do Marker do usuário acessível globalmente
window.userMarkerCache = window.userMarkerCache || {};

export let videoDatabase = [];
export function setVideoDatabase(data) {
  videoDatabase = data;
}

export let hiddenCollectionsTags = [];
export function setHiddenCollectionsTags(tags) {
  hiddenCollectionsTags = tags;
}

export let state = {
  searchQuery: '',
  displayModeGroup: 'compacto', // 'lista' | 'compacto' | 'grade'
  organizeMode: 'consolidado', // 'consolidado' | 'sequenciado' | 'sequenciado-canais'
  sortBy: 'data',
  sortAscending: true,
  hiddenChannels: [],
  scrollY: 0,
  // Estado para Coleções e Filtros
  activeSingleCollection: null, // { type: 'collection'|'playlist'|'category'|'marker', value: string|number, label: string }
  filterState: {
    markers: ['0', '5', '1', '2', '3', 'null'], // '0', '5', '1', '2', '3', 'null'
    categories: [], // Populado dinamicamente
    channels: [],   // Lista de canais ativos
    showRemoved: false
  }
};

export function saveState() {
  state.scrollY = window.scrollY;
  localStorage.setItem(CONFIG.LOCALSTORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  const saved = localStorage.getItem(CONFIG.LOCALSTORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migração retrocompatível se o estado antigo possuía viewMode
      if (parsed.viewMode && !parsed.organizeMode) {
        parsed.organizeMode = parsed.viewMode;
      }
      state = { ...state, ...parsed };

      const searchInput = document.getElementById('searchInput');
      const sortBySelect = document.getElementById('sortBySelect');

      if (searchInput) searchInput.value = state.searchQuery || '';
      if (sortBySelect) sortBySelect.value = state.sortBy || 'data';
    } catch (e) {
      console.error("Erro ao carregar o estado:", e);
    }
  }
}