/* ==========================================================================
   CONFIGURAÇÕES E ESTADO GLOBAL
   ========================================================================== */
export const CONFIG = {
  DEBOUNCE_DELAY_MS: 300,
  LOCALSTORAGE_KEY: 'app_video_list_official_state',
  DATA_URL: 'database.json'
};

// Garantir que o cache do progresso do usuário esteja acessível globalmente
window.userProgressCache = window.userProgressCache || {};

export let videoDatabase = [];
export function setVideoDatabase(data) {
  videoDatabase = data;
}

export let hiddenTaxonomyTags = [];
export function setHiddenTaxonomyTags(tags) {
  hiddenTaxonomyTags = tags;
}

export let state = {
  searchQuery: '',
  viewMode: 'consolidado',
  sortBy: 'data',
  sortAscending: true,
  hiddenChannels: [],
  scrollY: 0
};

export function saveState() {
  state.scrollY = window.scrollY;
  localStorage.setItem(CONFIG.LOCALSTORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  const saved = localStorage.getItem(CONFIG.LOCALSTORAGE_KEY);
  if (saved) {
    try {
      state = { ...state, ...JSON.parse(saved) };
      const searchInput = document.getElementById('searchInput');
      const viewModeSelect = document.getElementById('viewModeSelect');
      const sortBySelect = document.getElementById('sortBySelect');

      if (searchInput) searchInput.value = state.searchQuery || '';
      if (viewModeSelect) viewModeSelect.value = state.viewMode || 'consolidado';
      if (sortBySelect) sortBySelect.value = state.sortBy || 'data';
    } catch (e) {
      console.error("Erro ao carregar o estado:", e);
    }
  }
}
