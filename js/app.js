import { CONFIG, state, loadState, saveState, setVideoDatabase, setHiddencollectionsTags, videoDatabase } from './state.js';
import { populatecollectionsModal } from './collections.js';
import { renderList } from './render.js';

let debounceTimer = null;

window.renderList = renderList;

function adjustBodyPadding() {
  const topBar = document.getElementById('topBar');
  const navTime = document.getElementById('navTimeContainer');
  const topBarHeight = topBar ? topBar.offsetHeight : 60;
  const navTimeHeight = navTime ? navTime.offsetHeight : 35;
  
  // Adiciona um respiro extra de segurança (ex: +20px) para evitar qualquer sobreposição
  const totalHeight = topBarHeight + navTimeHeight;
  document.body.style.paddingTop = `${totalHeight + 20}px`;
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
  // Normaliza o modo de exibição na carga inicial para garantir sincronia com os botões
  if (!['lista', 'compacto', 'grade'].includes(state.displayMode)) {
    state.displayMode = 'compacto';
  }
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

  // Elementos e menus dropdown
  const seqToggleBtn = document.getElementById('sequencedToggleBtn');
  const seqMenu = document.getElementById('sequencedMenu');
  
  const sortToggleBtn = document.getElementById('sortToggleBtn');
  const sortMenu = document.getElementById('sortMenu');
  const sortOrderCheckbox = document.getElementById('sortOrderCheckbox');
  
  const avatarBtn = document.getElementById('userAvatarBtn');
  const userMenu = document.getElementById('userMenu');

  // Função centralizadora: fecha todos os menus, exceto o opcionalmente informado
  function closeAllDropdowns(exceptMenu = null) {
    if (seqMenu && seqMenu !== exceptMenu) seqMenu.style.display = 'none';
    if (sortMenu && sortMenu !== exceptMenu) sortMenu.style.display = 'none';
    if (userMenu && userMenu !== exceptMenu) userMenu.style.display = 'none';
  }

  // 1. EVENTOS PARA O GRUPO "ORGANIZAR"
  seqToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = seqMenu.style.display === 'none';
    closeAllDropdowns(willOpen ? seqMenu : null);
    seqMenu.style.display = willOpen ? 'flex' : 'none';
  });

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

  // 2. EVENTOS PARA O GRUPO "ORDENAR"
  sortToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = sortMenu.style.display === 'none';
    closeAllDropdowns(willOpen ? sortMenu : null);
    sortMenu.style.display = willOpen ? 'flex' : 'none';
  });

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

  sortOrderCheckbox?.addEventListener('change', (e) => {
    state.sortAscending = !e.target.checked;
    syncButtonGroupsUI();
    saveState();
    renderList();
  });

  // 3. EVENTOS PARA O PERFIL DO USUÁRIO (AVATAR)
  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = userMenu.style.display === 'none';
    closeAllDropdowns(willOpen ? userMenu : null);
    userMenu.style.display = willOpen ? 'flex' : 'none';
  });

  // 4. Fechamento global ao clicar em qualquer lugar fora dos menus
  window.addEventListener('click', () => {
    closeAllDropdowns();
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

  document.getElementById('collectionsModalBtn')?.addEventListener('click', () => {
    populatecollectionsModal();
    document.getElementById('collectionsModal')?.classList.add('open');
  });

  document.getElementById('closecollectionsModalBtn')?.addEventListener('click', () => {
    document.getElementById('collectionsModal')?.classList.remove('open');
  });

  document.getElementById('applycollectionsBtn')?.addEventListener('click', () => {
    const hidden = [];
    document.querySelectorAll('#collectionsListContainer input[type="checkbox"]').forEach(cb => {
      if (!cb.checked) hidden.push(cb.value);
    });
    setHiddencollectionsTags(hidden);
    saveState();
    renderList();
    document.getElementById('collectionsModal')?.classList.remove('open');
  });

  window.addEventListener('scroll', saveState);
});
