import { CONFIG, state, loadState, saveState, setVideoDatabase, setHiddenCollectionsTags, videoDatabase } from './state.js';
import { populateCollectionsModal, populateFilterModal } from './collections.js';
import { renderList, updateTopBannerNotice } from './render.js';

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
    'category': 'Categoria',
    'marcador': 'Marcadores'
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
  syncNavTimeState();
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
    populateFilterModal();
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

// ==========================================================================
// SISTEMA DE NAVEGAÇÃO
// ==========================================================================
let isNavTimeScrolling = false;

function getAvailableTemporalData() {
  const dataMap = new Map();
  videoDatabase.forEach(v => {
    if (!v.publishedAt) return;
    const date = new Date(v.publishedAt);
    const year = date.getFullYear();
    const month = date.getMonth();
    if (isNaN(year)) return;

    if (!dataMap.has(year)) {
      dataMap.set(year, new Set());
    }
    dataMap.get(year).add(month);
  });
  return dataMap;
}

function populateYearSelector() {
  const yearSelect = document.getElementById('yearSelect');
  if (!yearSelect) return;

  const dataMap = getAvailableTemporalData();
  const years = Array.from(dataMap.keys()).sort((a, b) => state.sortAscending ? a - b : b - a);

  yearSelect.innerHTML = '';
  years.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  if (years.length > 0 && (!state.selectedYear || !dataMap.has(Number(state.selectedYear)))) {
    state.selectedYear = years[0];
  }
  
  if (state.selectedYear) {
    yearSelect.value = state.selectedYear;
  }

  updateAvailableMonths();
  syncNavTimeState();
}

function updateAvailableMonths() {
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  if (!yearSelect || !monthSelect) return;

  const currentYear = Number(yearSelect.value);
  state.selectedYear = currentYear; // Sincroniza o estado global
  const dataMap = getAvailableTemporalData();
  const availableMonths = dataMap.get(currentYear) || new Set();

  Array.from(monthSelect.options).forEach(opt => {
    const monthVal = Number(opt.value);
    const hasData = availableMonths.has(monthVal);
    opt.disabled = !hasData;
  });

  // Se o mês selecionado não existir no novo ano, seleciona o primeiro mês disponível
  if (!availableMonths.has(Number(monthSelect.value))) {
    const firstAvailable = Array.from(availableMonths).sort((a, b) => a - b)[0];
    if (firstAvailable !== undefined) {
      monthSelect.value = firstAvailable;
    }
  }
}

function syncNavTimeState() {
  const container = document.getElementById('navTimeContainer');
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const yearUpBtn = document.getElementById('yearUpBtn');
  const yearDownBtn = document.getElementById('yearDownBtn');
  const monthUpBtn = document.getElementById('monthUpBtn');
  const monthDownBtn = document.getElementById('monthDownBtn');

  const isDisabled = state.sortBy !== 'data' || 
                     (state.searchQuery && state.searchQuery.trim() !== '') || 
                     state.organizeMode === 'sequenciado-canais';

  if (container) container.classList.toggle('disabled', isDisabled);
  [yearSelect, monthSelect, yearUpBtn, yearDownBtn, monthUpBtn, monthDownBtn].forEach(el => {
    if (el) el.disabled = isDisabled;
  });
}

// ==========================================================================
// SISTEMA DE NAVEGAÇÃO TEMPORAL BASEADO EM MAPA EM MEMÓRIA
// ==========================================================================

let isProgrammaticScroll = false;
let scrollDebounceTimer = null;

/**
 * Constrói o mapa de índices temporais em memória com base nos itens atualmente renderizados/filtrados.
 * Estrutura: { [year]: { [month]: firstVideoId } }
 */
function buildTemporalIndexMap(items) {
  const map = {};
  // Percorre na ordem cronológica correta (do mais antigo para o mais recente ou vice-versa)
  items.forEach(item => {
    if (!item.publishedAt) return;
    const date = new Date(item.publishedAt);
    if (isNaN(date.getTime())) return;

    const year = date.getFullYear();
    const month = date.getMonth();

    if (!map[year]) map[year] = {};
    // Armazena apenas o primeiro ID encontrado para aquele mês/ano
    if (!map[year][month]) {
      map[year][month] = item.videoId;
    }
  });
  return map;
}

/**
 * Extrai e retorna a lista atual de vídeos aplicando os mesmos filtros e ordenação por data da renderList.
 */
function getCurrentFilteredItems() {
  if (!window.videoDatabase && typeof videoDatabase === 'undefined') return [];
  const db = window.videoDatabase || videoDatabase;

  let items = db.filter(item => {
    // 1. Filtro de removidos
    if (item.privacyStatus === 'removed' && !state.customFilterState.removed) {
      return false;
    }

    // 2. Filtro de canais ocultos
    const isChannelHidden = state.hiddenChannels.includes(item.channelTitle) || 
                            state.customFilterState.channels[item.channelTitle] === false;
    if (isChannelHidden) return false;

    // 3. Filtro de coleções ativas
    if (state.activeCollectionFilter) {
      const { type, value } = state.activeCollectionFilter;
      if (type === 'collection') {
        const cols = Array.isArray(item.collection) ? item.collection : [item.collection];
        if (!cols.some(c => c && c.trim().toLowerCase() === value.toLowerCase())) return false;
      } else if (type === 'playlist') {
        const pls = Array.isArray(item.playlist) ? item.playlist : [item.playlist];
        if (!pls.some(p => p && p.trim().toLowerCase() === value.toLowerCase())) return false;
      } else if (type === 'category') {
        const catKey = (item.category && item.category.trim()) ? item.category.trim() : 'NULL';
        if (value === 'NULL') {
          if (item.category && item.category.trim()) return false;
        } else {
          if (!item.category || item.category.trim().toLowerCase() !== value.toLowerCase()) return false;
        }
      } else if (type === 'marker') {
        const markerVal = (window.userMarkerCache && window.userMarkerCache[item.videoId] !== undefined)
          ? String(window.userMarkerCache[item.videoId]) : 'NULL';
        if (markerVal !== value) return false;
      }
      return true;
    }

    // 4. Filtros customizados de categorias e marcadores
    const catKey = (item.category && item.category.trim()) ? item.category.trim() : 'NULL';
    if (state.customFilterState.categories[catKey] === false) return false;

    const markerVal = (window.userMarkerCache && window.userMarkerCache[item.videoId] !== undefined)
      ? String(window.userMarkerCache[item.videoId]) : 'NULL';
    if (state.customFilterState.markers[markerVal] === false) return false;

    return true;
  });

  // 5. Aplicação da busca textual (se houver)
  if (state.searchQuery && state.searchQuery.trim() !== '') {
    // Caso utilize fuzzyMatch ou includes, mantemos compatibilidade com o escopo
    items = items.filter(item => item.title && item.title.toLowerCase().includes(state.searchQuery.toLowerCase()));
  }

  // 6. Garante a ordenação estrita por data para o mapeamento temporal
  items.sort((a, b) => {
    const valA = new Date(a.publishedAt);
    const valB = new Date(b.publishedAt);
    return state.sortAscending ? valA - valB : valB - valA;
  });

  return items;
}

/**
 * Salto temporal determinístico consultando o mapa em memória.
 */
function scrollToTemporalTarget(year, month) {
  if (state.sortBy !== 'data' || (state.searchQuery && state.searchQuery.trim() !== '')) return;

  const targetYear = Number(year);
  const targetMonth = Number(month);
  state.selectedYear = targetYear;

  // Obtém a lista atual filtrada de itens
  const activeItems = getCurrentFilteredItems();
  const temporalMap = buildTemporalIndexMap(activeItems);

  let targetVideoId = null;

  // 1. Tenta buscar o ID exato no mês e ano especificados
  if (temporalMap[targetYear] && temporalMap[targetYear][targetMonth]) {
    targetVideoId = temporalMap[targetYear][targetMonth];
  } else {
    // 2. Fallback: Se o mês exato não existir, pega o primeiro mês disponível daquele ano
    const availableMonths = temporalMap[targetYear] ? Object.keys(temporalMap[targetYear]) : [];
    if (availableMonths.length > 0) {
      targetVideoId = temporalMap[targetYear][availableMonths[0]];
    } else {
      // 3. Fallback absoluto: pega o ano mais próximo disponível no mapa
      const availableYears = Object.keys(temporalMap).map(Number).sort((a, b) => a - b);
      const closestYear = availableYears.find(y => y >= targetYear) || availableYears[availableYears.length - 1];
      if (closestYear && temporalMap[closestYear]) {
        const monthsInClosest = Object.keys(temporalMap[closestYear]).map(Number).sort((a, b) => a - b);
        targetVideoId = temporalMap[closestYear][monthsInClosest[0]];
      }
    }
  }

  if (!targetVideoId) return;

  // Localiza o elemento exato no DOM através do ID unívoco do vídeo
  const targetElement = document.querySelector(`[data-videoid="${targetVideoId}"]`) || 
                        document.querySelector(`[href*="v=${targetVideoId}"]`)?.closest('.card-display-lista, .card-display-compacto, .card-display-grade');

  if (targetElement) {
    isNavTimeScrolling = true;
    isProgrammaticScroll = true;
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);

    const topBarHeight = document.getElementById('topBar')?.offsetHeight || 60;
    const navTimeHeight = document.getElementById('navTimeContainer')?.offsetHeight || 35;
    
    // Cálculo de posição absoluto e seguro
    const elementRect = targetElement.getBoundingClientRect();
    const absoluteTop = elementRect.top + window.pageYOffset;
    const targetY = absoluteTop - (topBarHeight + navTimeHeight + 15);

    window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });

    scrollDebounceTimer = setTimeout(() => {
      isNavTimeScrolling = false;
      isProgrammaticScroll = false;
    }, 600);
  }
}

/**
 * Atualização dos selects durante o scroll manual, utilizando o mesmo princípio determinístico.
 */
function updateNavTimeOnScroll() {
  if (isProgrammaticScroll || isNavTimeScrolling || state.sortBy !== 'data' || 
      (state.searchQuery && state.searchQuery.trim() !== '') || 
      state.organizeMode === 'sequenciado-canais') return;

  const cards = Array.from(document.querySelectorAll('#videoListContainer [data-date]'));
  if (cards.length === 0) return;

  const topBarHeight = document.getElementById('topBar')?.offsetHeight || 60;
  const navTimeHeight = document.getElementById('navTimeContainer')?.offsetHeight || 35;
  const triggerY = topBarHeight + navTimeHeight + 40;

  let activeCard = null;

  // Abordagem vertical pura e determinística para todos os modos
  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.top <= triggerY && rect.bottom >= triggerY) {
      activeCard = card;
      break;
    }
  }

  // Fallback de segurança caso nenhum card cruze exatamente a linha de gatilho
  if (!activeCard) {
    activeCard = cards.find(card => card.getBoundingClientRect().top >= triggerY) || cards[0];
  }

  if (activeCard) {
    const rawDate = activeCard.getAttribute('data-date');
    if (!rawDate) return;
    const cardDate = new Date(rawDate);
    if (isNaN(cardDate.getTime())) return;

    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    
    const currentYear = cardDate.getFullYear();
    const currentMonth = cardDate.getMonth();

    if (yearSelect && yearSelect.value !== String(currentYear)) {
      yearSelect.value = String(currentYear);
      state.selectedYear = currentYear;
      updateAvailableMonths();
    }
    
    if (monthSelect) {
      const targetOption = monthSelect.querySelector(`option[value="${currentMonth}"]`);
      if (targetOption && !targetOption.disabled) {
        monthSelect.value = String(currentMonth);
      } else {
        const firstValidOpt = Array.from(monthSelect.options).find(opt => !opt.disabled);
        if (firstValidOpt) monthSelect.value = firstValidOpt.value;
      }
    }
  }
}

// ==========================================================================
// INICIALIZAÇÃO DE EVENTOS DA APLICAÇÃO (DOM - Event Listeners)
// ==========================================================================
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

  // EVENTOS PARA O MODAL DE FILTRO
  document.getElementById('filterModalBtn')?.addEventListener('click', () => {
    populateFilterModal();
    document.getElementById('filterModal')?.classList.add('open');
  });

  document.getElementById('closeFilterModalBtn')?.addEventListener('click', () => {
    document.getElementById('filterModal')?.classList.remove('open');
  });

  document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
    saveState();
    updateTopBannerNotice();
    renderList();
    document.getElementById('filterModal')?.classList.remove('open');
  });

  document.getElementById('collectionsModalBtn')?.addEventListener('click', () => {
    populateCollectionsModal();
    document.getElementById('collectionsModal')?.classList.add('open');
  });

  document.getElementById('closeCollectionsModalBtn')?.addEventListener('click', () => {
    document.getElementById('collectionsModal')?.classList.remove('open');
  });

  document.getElementById('applyCollectionsBtn')?.addEventListener('click', () => {
    const hidden = [];
    document.querySelectorAll('#collectionsListContainer input[type="checkbox"]').forEach(cb => {
      if (!cb.checked) hidden.push(cb.value);
    });
    setHiddenCollectionsTags(hidden);
    saveState();
    renderList();
    document.getElementById('collectionsModal')?.classList.remove('open');
  });

  // ==========================================
  // INÍCIO DOS EVENTOS DO NAVTIME
  // ==========================================
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');

  yearSelect?.addEventListener('change', (e) => {
    updateAvailableMonths();
    scrollToTemporalTarget(e.target.value, monthSelect.value);
  });

  monthSelect?.addEventListener('change', (e) => {
    scrollToTemporalTarget(yearSelect.value, e.target.value);
  });

  document.getElementById('yearUpBtn')?.addEventListener('click', () => {
    if (!yearSelect || yearSelect.options.length === 0) return;
    const idx = yearSelect.selectedIndex;
    if (idx > 0) {
      yearSelect.selectedIndex = idx - 1;
      updateAvailableMonths();
      scrollToTemporalTarget(yearSelect.value, monthSelect.value);
    }
  });

  document.getElementById('yearDownBtn')?.addEventListener('click', () => {
    if (!yearSelect || yearSelect.options.length === 0) return;
    const idx = yearSelect.selectedIndex;
    if (idx < yearSelect.options.length - 1) {
      yearSelect.selectedIndex = idx + 1;
      updateAvailableMonths();
      scrollToTemporalTarget(yearSelect.value, monthSelect.value);
    }
  });

  document.getElementById('monthUpBtn')?.addEventListener('click', () => {
    if (!monthSelect || !yearSelect) return;
    const enabledOpts = Array.from(monthSelect.options).filter(o => !o.disabled);
    if (enabledOpts.length === 0) return;

    const currentVal = monthSelect.value;
    const currentIndex = enabledOpts.findIndex(o => o.value === currentVal);

    if (currentIndex > 0) {
      monthSelect.value = enabledOpts[currentIndex - 1].value;
      scrollToTemporalTarget(yearSelect.value, monthSelect.value);
    } else {
      const yearOpts = Array.from(yearSelect.options);
      const currentYearIdx = yearOpts.findIndex(o => o.value === yearSelect.value);
      if (currentYearIdx > 0) {
        yearSelect.selectedIndex = currentYearIdx - 1;
        updateAvailableMonths();
        const newEnabledOpts = Array.from(monthSelect.options).filter(o => !o.disabled);
        if (newEnabledOpts.length > 0) {
          monthSelect.value = newEnabledOpts[newEnabledOpts.length - 1].value;
          scrollToTemporalTarget(yearSelect.value, monthSelect.value);
        }
      }
    }
  });

  document.getElementById('monthDownBtn')?.addEventListener('click', () => {
    if (!monthSelect || !yearSelect) return;
    const enabledOpts = Array.from(monthSelect.options).filter(o => !o.disabled);
    if (enabledOpts.length === 0) return;

    const currentVal = monthSelect.value;
    const currentIndex = enabledOpts.findIndex(o => o.value === currentVal);

    if (currentIndex !== -1 && currentIndex < enabledOpts.length - 1) {
      monthSelect.value = enabledOpts[currentIndex + 1].value;
      scrollToTemporalTarget(yearSelect.value, monthSelect.value);
    } else {
      const yearOpts = Array.from(yearSelect.options);
      const currentYearIdx = yearOpts.findIndex(o => o.value === yearSelect.value);
      if (currentYearIdx !== -1 && currentYearIdx < yearOpts.length - 1) {
        yearSelect.selectedIndex = currentYearIdx + 1;
        updateAvailableMonths();
        const newEnabledOpts = Array.from(monthSelect.options).filter(o => !o.disabled);
        if (newEnabledOpts.length > 0) {
          monthSelect.value = newEnabledOpts[0].value;
          scrollToTemporalTarget(yearSelect.value, monthSelect.value);
        }
      }
    }
  });

  window.addEventListener('scroll', () => {
    saveState();
    updateNavTimeOnScroll();
  });
}); // <-- FIM DO DOMContentLoaded

window.applyCollectionShortcut = function(type, value) {
  state.activeCollectionFilter = { type, value, name: value };
  state.customFilterNoticeActive = true;

  state.customFilterState.categories = {};
  state.customFilterState.markers = {};

  if (type === 'category') {
    const catSet = new Set();
    videoDatabase.forEach(item => {
      const catKey = (item.category && item.category.trim()) ? item.category.trim() : 'NULL';
      catSet.add(catKey);
    });
    catSet.forEach(cat => {
      state.customFilterState.categories[cat] = (cat.toLowerCase() === String(value).toLowerCase() || (value === 'NULL' && cat === 'NULL'));
    });
  } else if (type === 'marker') {
    const markerKeys = ['0', '5', '1', '2', '3', 'NULL'];
    markerKeys.forEach(mKey => {
      state.customFilterState.markers[mKey] = (mKey === String(value));
    });
  }
  
  const modal = document.getElementById('collectionsModal');
  if (modal) modal.classList.remove('open');

  updateTopBannerNotice();
  renderList();
};