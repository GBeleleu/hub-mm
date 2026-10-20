/* ==========================================================================
   CONFIGURAÇÕES E ESTADO GLOBAL
   ========================================================================== */
export const CONFIG = {
  DEBOUNCE_DELAY_MS: 300,
  LOCALSTORAGE_KEY: 'app_video_list_official_state',
  DATA_URL: 'database.json'
};

// Cache do progresso do usuário acessível globalmente
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
  displayMode: 'compacto', // 'lista' | 'compacto' | 'grade'
  organizeMode: 'consolidado', // 'consolidado' | 'sequenciado' | 'sequenciado-canais'
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
