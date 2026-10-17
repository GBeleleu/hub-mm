import { CONFIG, state, loadState, saveState, setVideoDatabase, setHiddenTaxonomyTags, videoDatabase } from './state.js';
import { populateTaxonomyModal } from './taxonomy.js';
import { renderList } from './render.js';

let debounceTimer = null;

// Expor renderList globalmente para o firebase-config.js atualizar a interface após o login
window.renderList = renderList;

function adjustBodyPadding() {
  const topBar = document.getElementById('topBar');
  if (topBar) document.body.style.paddingTop = `${topBar.offsetHeight + 15}px`;
}

function updateSortBtnText() {
  const btn = document.getElementById('sortOrderBtn');
  if (btn) btn.textContent = state.sortAscending ? 'Asc ▲' : 'Desc ▼';
}

async function loadDatabase() {
  const container = document.getElementById('videoListContainer');
  try {
    const response = await fetch(CONFIG.DATA_URL);
    if (!response.ok) throw new Error(`Erro HTTP ${response.status}: Não foi possível acessar ${CONFIG.DATA_URL}`);
    
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Estrutura inválida no JSON.');

    setVideoDatabase(data);
    populateYearSelector();
    populateChannelsModal();
    renderList();

    if (state.scrollY) window.scrollTo(0, state.scrollY);
  } catch (error) {
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h3>Erro de Carregamento</h3>
          <p style="margin-top:8px;">${error.message}</p>
        </div>`;
    }
  }
}

function populateYearSelector() {
  const yearSelect = document.getElementById('yearSelect');
  if (!yearSelect) return;
  yearSelect.innerHTML = '<option value="">Ano</option>';

  const years = [...new Set(videoDatabase.map(v => new Date(v.dataPublicacao).getFullYear()))]
    .filter(y => !isNaN(y))
    .sort((a, b) => a - b);

  years.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });
}

function populateChannelsModal() {
  const container = document.getElementById('channelsListContainer');
  if (!container) return;
  container.innerHTML = '';

  const channels = [...new Set(videoDatabase.map(v => v.canal))].filter(Boolean).sort();
  channels.forEach(channel => {
    const label = document.createElement('label');
    label.className = 'channel-checkbox-item';
    const isChecked = !state.hiddenChannels.includes(channel);
    label.innerHTML = `<input type="checkbox" value="${channel}" ${isChecked ? 'checked' : ''}><span>${channel}</span>`;
    container.appendChild(label);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  adjustBodyPadding();
  window.addEventListener('resize', adjustBodyPadding);

  loadDatabase();

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchInput && clearSearchBtn) {
    const updateClearBtn = () => clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    updateClearBtn();

    searchInput.addEventListener('input', (e) => {
      updateClearBtn();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.searchQuery = e.target.value;
        saveState();
        renderList();
      }, CONFIG.DEBOUNCE_DELAY_MS);
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      updateClearBtn();
      saveState();
      renderList();
    });
  }

  document.getElementById('viewModeSelect')?.addEventListener('change', (e) => {
    state.viewMode = e.target.value;
    saveState();
    renderList();
  });

  document.getElementById('sortBySelect')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    saveState();
    renderList();
  });

  document.getElementById('sortOrderBtn')?.addEventListener('click', () => {
    state.sortAscending = !state.sortAscending;
    updateSortBtnText();
    saveState();
    renderList();
  });

  document.getElementById('channelsModalBtn')?.addEventListener('click', () => {
    populateChannelsModal();
    document.getElementById('channelsModal')?.classList.add('open');
  });

  document.getElementById('closeModalBtn')?.addEventListener('click', () => {
    document.getElementById('channelsModal')?.classList.remove('open');
  });

  document.getElementById('applyChannelsBtn')?.addEventListener('click', () => {
    const hidden = [];
    document.querySelectorAll('#channelsListContainer input[type="checkbox"]').forEach(cb => {
      if (!cb.checked) hidden.push(cb.value);
    });
    state.hiddenChannels = hidden;
    saveState();
    renderList();
    document.getElementById('channelsModal')?.classList.remove('open');
  });

  document.getElementById('taxonomyModalBtn')?.addEventListener('click', () => {
    populateTaxonomyModal();
    document.getElementById('taxonomyModal')?.classList.add('open');
  });

  document.getElementById('closeTaxonomyModalBtn')?.addEventListener('click', () => {
    document.getElementById('taxonomyModal')?.classList.remove('open');
  });

  document.getElementById('applyTaxonomyBtn')?.addEventListener('click', () => {
    const hidden = [];
    document.querySelectorAll('#taxonomyListContainer input[type="checkbox"]').forEach(cb => {
      if (!cb.checked) hidden.push(cb.value);
    });
    setHiddenTaxonomyTags(hidden);
    saveState();
    renderList();
    document.getElementById('taxonomyModal')?.classList.remove('open');
  });

  window.addEventListener('scroll', saveState);
});
