import { CONFIG, state, loadState, saveState, setVideoDatabase, setHiddenTaxonomyTags, videoDatabase } from './state.js';
import { populateTaxonomyModal } from './taxonomy.js';
import { renderList } from './render.js';

let debounceTimer = null;

window.renderList = renderList;

function adjustBodyPadding() {
  const topBar = document.getElementById('topBar');
  const navTime = document.getElementById('navTimeContainer');
  const totalHeight = (topBar ? topBar.offsetHeight : 60) + (navTime ? navTime.offsetHeight : 35);
  document.body.style.paddingTop = `${totalHeight + 15}px`;
}

function updateSortBtnText() {
  const label = document.getElementById('sortOrderLabel');
  if (label) label.textContent = state.sortAscending ? 'Asc ▲' : 'Desc ▼';
}

function syncButtonGroupsUI() {
  // Sincronizar Grupo EXIBIR
  document.querySelectorAll('#displayModeGroup .btn-group-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.display === state.displayMode);
  });

  // Sincronizar Grupo ORGANIZAR
  const isConsolidado = state.organizeMode === 'consolidado';
  const seqToggleBtn = document.getElementById('sequencedToggleBtn');
  const labelSpan = document.getElementById('sequencedActiveLabel');

  // 1. Botão Consolidado
  document.querySelectorAll('#organizeGroup [data-organize="consolidado"]').forEach(btn => {
    btn.classList.toggle('active', isConsolidado);
  });

  // 2. Botão/Rótulo do Menu Sequenciado
  if (labelSpan && seqToggleBtn) {
    if (state.organizeMode === 'sequenciado') {
      labelSpan.textContent = 'Misturado';
      seqToggleBtn.classList.add('active');
    } else if (state.organizeMode === 'sequenciado-canais') {
      labelSpan.textContent = 'Blocos';
      seqToggleBtn.classList.add('active');
    } else {
      // Quando "Consolidado" está selecionado
      labelSpan.textContent = 'Sequenciado';
      seqToggleBtn.classList.remove('active');
    }
  }

  // 3. Marcação do item ativo dentro do dropdown
  document.querySelectorAll('#sequencedMenu .dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.organize === state.organizeMode);
  });

  // Sincronizar Grupo ORDENAR
  const sortActiveLabel = document.getElementById('sortActiveLabel');
  const sortDirectionArrow = document.getElementById('sortDirectionArrow');
  const sortOrderCheckbox = document.getElementById('sortOrderCheckbox');

  // Mapeamento das opções de ordenação para exibição no botão
  const sortLabels = {
    'data': 'Data',
    'duracao': 'Duração',
    'ocorrencias': 'Ocorrências',
    'categoria': 'Categoria',
    'progresso': 'Status'
  };

  if (sortActiveLabel) {
    sortActiveLabel.textContent = sortLabels[state.sortBy] || 'Data';
  }

  // Seta de ordenação: ▲ para Ascendente, ▼ para Descendente (Inversa)
  if (sortDirectionArrow) {
    sortDirectionArrow.textContent = state.sortAscending ? '▲' : '▼';
  }

  if (sortOrderCheckbox) {
    sortOrderCheckbox.checked = !state.sortAscending;
  }

  // Marca a opção de ordenação ativa no menu
  document.querySelectorAll('#sortMenu .dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.sort === state.sortBy);
  });
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

//DOM LISTENERS
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  syncButtonGroupsUI();
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

  // EVENTOS PARA O GRUPO "EXIBIR"
  document.querySelectorAll('#displayModeGroup .btn-group-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      state.displayMode = target.dataset.display;
      syncButtonGroupsUI();
      saveState();
      renderList();
    });
  });

  // EVENTOS PARA O GRUPO "ORGANIZAR"
  // Lógica para abrir/fechar o menu dropdown do Sequenciado
  const seqToggleBtn = document.getElementById('sequencedToggleBtn');
  const seqMenu = document.getElementById('sequencedMenu');

  seqToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    seqMenu.style.display = seqMenu.style.display === 'none' ? 'flex' : 'none';
  });

  // Fecha o dropdown ao clicar fora
  window.addEventListener('click', () => {
    if (seqMenu) seqMenu.style.display = 'none';
  });

  // Eventos para as opções/dropdown
  document.querySelectorAll('#organizeGroup [data-organize]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      state.organizeMode = target.dataset.organize;
      syncButtonGroupsUI();
      saveState();
      renderList();
      if (seqMenu) seqMenu.style.display = 'none';
    });
  });

  // EVENTOS PARA O GRUPO "ORDENAR"
  // Lógica para abrir/fechar o menu dropdown de Ordenar
  const sortToggleBtn = document.getElementById('sortToggleBtn');
  const sortMenu = document.getElementById('sortMenu');
  const sortOrderCheckbox = document.getElementById('sortOrderCheckbox');

  sortToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    sortMenu.style.display = sortMenu.style.display === 'none' ? 'flex' : 'none';
  });

  // Evento ao clicar em um critério de ordenação (ex: Data, Título)
  document.querySelectorAll('#sortMenu .dropdown-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      state.sortBy = target.dataset.sort;
      syncButtonGroupsUI();
      saveState();
      renderList();
      if (sortMenu) sortMenu.style.display = 'none';
    });
  });

  // Evento do Checkbox de Ordem Inversa
  sortOrderCheckbox?.addEventListener('change', (e) => {
    // Se o checkbox "Ordem inversa" está marcado, a ordem ascendente torna-se false
    state.sortAscending = !e.target.checked;
    syncButtonGroupsUI();
    saveState();
    renderList();
  });

  // Fecha o dropdown de ordenação ao clicar fora da área
  window.addEventListener('click', (e) => {
    if (sortMenu && !sortMenu.contains(e.target) && e.target !== sortToggleBtn) {
      sortMenu.style.display = 'none';
    }
  });

  // Lógica para abrir/fechar o menu dropdown do perfil do usuário (Avatar do Google)
  const avatarBtn = document.getElementById('userAvatarBtn');
  const userMenu = document.getElementById('userMenu');

  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (userMenu) {
      userMenu.style.display = userMenu.style.display === 'none' ? 'flex' : 'none';
    }
  });

  // Fecha o menu do usuário ao clicar fora dele
  window.addEventListener('click', (e) => {
    if (userMenu && !userMenu.contains(e.target) && e.target !== avatarBtn) {
      userMenu.style.display = 'none';
    }
  });

  // FECHAMENTO DOS MODAIS
  document.getElementById('closeThumbModalBtn')?.addEventListener('click', () => {
    document.getElementById('thumbPreviewModal')?.classList.remove('open');
  });

  document.getElementById('closeOccurrencesModalBtn')?.addEventListener('click', () => {
    document.getElementById('occurrencesModal')?.classList.remove('open');
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
