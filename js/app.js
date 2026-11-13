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
// SISTEMA DE NAVEGAÇÃO TEMPORAL
// ==========================================================================

let isNavTimeScrolling = false;
let isProgrammaticScroll = false;
let scrollDebounceTimer = null;

/**
 * Extrai e retorna a lista atual de vídeos aplicando os filtros ativos e a ordenação.
 */
function getCurrentFilteredItems() {
  if (typeof videoDatabase === 'undefined' || !Array.isArray(videoDatabase)) return [];

  let items = videoDatabase.filter(item => {
    // 1. Filtro de removidos
    if (item.privacyStatus === 'removed' && !state.customFilterState.removed) {
      return false;
    }

    // 2. Filtro de canais ocultos
    const isChannelHidden = (state.hiddenChannels && state.hiddenChannels.includes(item.channelTitle)) || 
                            (state.customFilterState.channels && state.customFilterState.channels[item.channelTitle] === false);
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
    if (state.customFilterState.categories && state.customFilterState.categories[catKey] === false) return false;

    const markerVal = (window.userMarkerCache && window.userMarkerCache[item.videoId] !== undefined)
      ? String(window.userMarkerCache[item.videoId]) : 'NULL';
    if (state.customFilterState.markers && state.customFilterState.markers[markerVal] === false) return false;

    return true;
  });

  // 5. Aplicação da busca textual
  if (state.searchQuery && state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase();
    items = items.filter(item => item.title && item.title.toLowerCase().includes(q));
  }

  // 6. Ordenação estrita por data respeitando state.sortAscending
  items.sort((a, b) => {
    const valA = new Date(a.publishedAt);
    const valB = new Date(b.publishedAt);
    return state.sortAscending ? valA - valB : valB - valA;
  });

  return items;
}

/**
 * Constrói a estrutura de âncoras temporais em memória.
 * Retorna anos ordenados visualmente e um mapa de meses disponíveis por ano com o primeiro videoId correspondente.
 */
function getTemporalAnchors() {
  const items = getCurrentFilteredItems();
  const anchorMap = new Map(); // "year-month" -> videoId
  const yearsSet = new Set();
  const monthsByYear = new Map(); // year -> Set(months)

  items.forEach(item => {
    if (!item.publishedAt) return;
    const date = new Date(item.publishedAt);
    if (isNaN(date.getTime())) return;

    const year = date.getFullYear();
    const month = date.getMonth();

    yearsSet.add(year);
    if (!monthsByYear.has(year)) {
      monthsByYear.set(year, new Set());
    }
    monthsByYear.get(year).add(month);

    const key = `${year}-${month}`;
    if (!anchorMap.has(key)) {
      anchorMap.set(key, item.videoId);
    }
  });

  // Anos ordenados estritamente pela direção visual (sortAscending: true = cresc, false = decresc)
  const sortedYears = Array.from(yearsSet).sort((a, b) => state.sortAscending ? a - b : b - a);

  return { years: sortedYears, monthsByYear, anchorMap };
}

/**
 * Popula e sincroniza os seletores de Ano e Mês respeitando a direção visual.
 */
function populateYearSelector() {
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  if (!yearSelect || !monthSelect) return;

  const { years, monthsByYear } = getTemporalAnchors();

  const currentYearNum = Number(yearSelect.value) || state.selectedYear;
  const currentMonthNum = Number(monthSelect.value);

  // 1. Preenche Anos
  yearSelect.innerHTML = '';
  years.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  if (years.length > 0) {
    if (!years.includes(currentYearNum)) {
      state.selectedYear = years[0];
    } else {
      state.selectedYear = currentYearNum;
    }
    yearSelect.value = state.selectedYear;
  } else {
    state.selectedYear = null;
  }

  // 2. Preenche Meses para o Ano Ativo
  const activeYear = Number(yearSelect.value);
  const availableMonths = monthsByYear.get(activeYear) || new Set();

  const allMonths = [
    { val: 0, label: '01 Janeiro' },
    { val: 1, label: '02 Fevereiro' },
    { val: 2, label: '03 Março' },
    { val: 3, label: '04 Abril' },
    { val: 4, label: '05 Maio' },
    { val: 5, label: '06 Junho' },
    { val: 6, label: '07 Julho' },
    { val: 7, label: '08 Agosto' },
    { val: 8, label: '09 Setembro' },
    { val: 9, label: '10 Outubro' },
    { val: 10, label: '11 Novembro' },
    { val: 11, label: '12 Dezembro' }
  ];

  // Espelhamento da Ordem Visual dos Meses
  allMonths.sort((a, b) => state.sortAscending ? a.val - b.val : b.val - a.val);

  monthSelect.innerHTML = '';
  allMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.val;
    opt.textContent = m.label;
    if (!availableMonths.has(m.val)) {
      opt.disabled = true;
    }
    monthSelect.appendChild(opt);
  });

  // Seleciona mês válido correspondente
  const validOptions = Array.from(monthSelect.options).filter(o => !o.disabled);
  if (validOptions.length > 0) {
    const isValidCurrent = validOptions.some(o => Number(o.value) === currentMonthNum);
    if (isValidCurrent) {
      monthSelect.value = currentMonthNum;
    } else {
      monthSelect.value = validOptions[0].value;
    }
  }

  syncNavTimeState();
}

/**
 * Sincroniza o estado de habilitação/desabilitação da barra navTime.
 */
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

/**
 * Executa o salto de scroll determinístico para o vídeo correspondente ao ano/mês.
 */
function scrollToTemporalTarget(year, month) {
  if (state.sortBy !== 'data' || (state.searchQuery && state.searchQuery.trim() !== '')) return;

  const targetYear = Number(year);
  const targetMonth = Number(month);
  state.selectedYear = targetYear;

  const { anchorMap, years, monthsByYear } = getTemporalAnchors();
  let targetVideoId = null;

  const exactKey = `${targetYear}-${targetMonth}`;
  if (anchorMap.has(exactKey)) {
    targetVideoId = anchorMap.get(exactKey);
  } else {
    // Fallback para o primeiro mês disponível no ano selecionado
    const monthsInYear = monthsByYear.get(targetYear);
    if (monthsInYear && monthsInYear.size > 0) {
      const sortedMonths = Array.from(monthsInYear).sort((a, b) => state.sortAscending ? a - b : b - a);
      targetVideoId = anchorMap.get(`${targetYear}-${sortedMonths[0]}`);
    } else if (years.length > 0) {
      // Fallback absoluto para o ano mais próximo
      const closestYear = years.find(y => state.sortAscending ? y >= targetYear : y <= targetYear) || years[0];
      const monthsInClosest = monthsByYear.get(closestYear);
      if (monthsInClosest && monthsInClosest.size > 0) {
        const sortedMonths = Array.from(monthsInClosest).sort((a, b) => state.sortAscending ? a - b : b - a);
        targetVideoId = anchorMap.get(`${closestYear}-${sortedMonths[0]}`);
      }
    }
  }

  if (!targetVideoId) return;

  const targetElement = document.querySelector(`[data-videoid="${targetVideoId}"]`) || 
                        document.querySelector(`[href*="v=${targetVideoId}"]`)?.closest('.card-display-lista, .card-display-compacto, .card-display-grade');

  if (targetElement) {
    isNavTimeScrolling = true;
    isProgrammaticScroll = true;
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);

    const topBarHeight = document.getElementById('topBar')?.offsetHeight || 60;
    const navTimeHeight = document.getElementById('navTimeContainer')?.offsetHeight || 35;
    
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
 * Atualização passiva dos selects durante o scroll manual da página.
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

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.top <= triggerY && rect.bottom >= triggerY) {
      const rawDate = card.getAttribute('data-date');
      if (!rawDate) continue;
      const cardDate = new Date(rawDate);
      if (isNaN(cardDate.getTime())) continue;

      const yearSelect = document.getElementById('yearSelect');
      const monthSelect = document.getElementById('monthSelect');
      
      const currentYear = cardDate.getFullYear();
      const currentMonth = cardDate.getMonth();

      if (yearSelect && yearSelect.value !== String(currentYear)) {
        yearSelect.value = String(currentYear);
        state.selectedYear = currentYear;
        populateYearSelector(); // Atualiza meses do ano correspondente
      }
      
      if (monthSelect) {
        const targetOption = monthSelect.querySelector(`option[value="${currentMonth}"]`);
        if (targetOption && !targetOption.disabled) {
          monthSelect.value = String(currentMonth);
        }
      }
      break;
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
      populateYearSelector();
      saveState();
      renderList();
      if (sortMenu) sortMenu.style.display = 'none';
    });
  });

  sortOrderCheckbox?.addEventListener('change', (e) => {
    state.sortAscending = !e.target.checked;
    syncButtonGroupsUI();
    populateYearSelector();
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
  // EVENTOS DO NAVTIME (MOTOR UNIFICADO)
  // ==========================================
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');

  yearSelect?.addEventListener('change', (e) => {
    state.selectedYear = Number(e.target.value);
    populateYearSelector();
    scrollToTemporalTarget(e.target.value, monthSelect.value);
  });

  monthSelect?.addEventListener('change', (e) => {
    scrollToTemporalTarget(yearSelect.value, e.target.value);
  });

  // Motor Simétrico de Navegação por Setas
  function navigateSelectIndex(selectElement, direction) {
    if (!selectElement || selectElement.options.length === 0) return;
    const newIdx = selectElement.selectedIndex + direction;
    if (newIdx >= 0 && newIdx < selectElement.options.length) {
      selectElement.selectedIndex = newIdx;
      selectElement.dispatchEvent(new Event('change'));
    }
  }

  // Setas de Ano
  document.getElementById('yearUpBtn')?.addEventListener('click', () => {
    navigateSelectIndex(yearSelect, -1);
  });

  document.getElementById('yearDownBtn')?.addEventListener('click', () => {
    navigateSelectIndex(yearSelect, 1);
  });

  // Setas de Mês com Transição Contínua Automática entre Anos
  function navigateMonthWithTransition(direction) {
    if (!monthSelect || !yearSelect) return;
    const enabledOpts = Array.from(monthSelect.options).filter(o => !o.disabled);
    if (enabledOpts.length === 0) return;

    const currentVal = monthSelect.value;
    const currentIdx = enabledOpts.findIndex(o => o.value === currentVal);
    const targetIdx = currentIdx + direction;

    if (targetIdx >= 0 && targetIdx < enabledOpts.length) {
      monthSelect.value = enabledOpts[targetIdx].value;
      scrollToTemporalTarget(yearSelect.value, monthSelect.value);
    } else {
      // Esgotou os meses do ano atual: transiciona para o ano adjacente na ordem visual
      const yearDirection = direction > 0 ? 1 : -1;
      const newYearIdx = yearSelect.selectedIndex + yearDirection;

      if (newYearIdx >= 0 && newYearIdx < yearSelect.options.length) {
        yearSelect.selectedIndex = newYearIdx;
        state.selectedYear = Number(yearSelect.value);
        populateYearSelector(); // Atualiza meses do novo ano

        const newEnabledOpts = Array.from(monthSelect.options).filter(o => !o.disabled);
        if (newEnabledOpts.length > 0) {
          // Se avançou (▼), pega o primeiro mês do novo ano; se retrocedeu (▲), pega o último mês
          const targetMonthOpt = direction > 0 ? newEnabledOpts[0] : newEnabledOpts[newEnabledOpts.length - 1];
          monthSelect.value = targetMonthOpt.value;
          scrollToTemporalTarget(yearSelect.value, monthSelect.value);
        }
      }
    }
  }

  document.getElementById('monthUpBtn')?.addEventListener('click', () => {
    navigateMonthWithTransition(-1);
  });

  document.getElementById('monthDownBtn')?.addEventListener('click', () => {
    navigateMonthWithTransition(1);
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