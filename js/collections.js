/**
 * js/collections.js - Extrator e Gerenciador de Coleções e Filtros
 */
import { videoDatabase, state } from './state.js';
import { renderList } from './render.js';

export function parseCollections(item) {
  return {
    category: item.category ? item.category.trim() : '',
    collection: item.collection || '',
    playlist: item.playlist || ''
  };
}

// Extrai coleções completas organizadas por bloco
export function extractAllCollectionsTree() {
  const tree = {
    collections: new Set(),
    playlistsByChannel: {},
    categories: new Set(),
    hasUncategorized: false,
    channels: new Set()
  };

  videoDatabase.forEach(item => {
    // 1. Coleções
    if (Array.isArray(item.collection)) {
      item.collection.forEach(c => c && c.trim() && tree.collections.add(c.trim()));
    } else if (item.collection && item.collection.trim()) {
      tree.collections.add(item.collection.trim());
    }

    // 2. Playlists por Canal
    const ch = item.channelTitle ? item.channelTitle.trim() : 'Sem Canal';
    if (ch) tree.channels.add(ch);

    if (!tree.playlistsByChannel[ch]) {
      tree.playlistsByChannel[ch] = new Set();
    }

    if (Array.isArray(item.playlist)) {
      item.playlist.forEach(p => p && p.trim() && tree.playlistsByChannel[ch].add(p.trim()));
    } else if (item.playlist && item.playlist.trim()) {
      tree.playlistsByChannel[ch].add(item.playlist.trim());
    }

    // 3. Categorias
    if (item.category && item.category.trim()) {
      tree.categories.add(item.category.trim());
    } else {
      tree.hasUncategorized = true;
    }
  });

  return tree;
}

// Inicializa os padrões do Filtro caso estejam vazios
export function initFilterStateDefaults() {
  const tree = extractAllCollectionsTree();
  const allCats = Array.from(tree.categories);
  if (tree.hasUncategorized) allCats.push('Sem categoria');

  if (!state.filterState.categories || state.filterState.categories.length === 0) {
    state.filterState.categories = [...allCats];
  }

  if (!state.filterState.channels || state.filterState.channels.length === 0) {
    state.filterState.channels = Array.from(tree.channels);
  }
}

// Renderiza a faixa de aviso central na barra superior
export function renderCustomDisplayNotice() {
  let noticeBar = document.getElementById('customDisplayNoticeBar');
  
  if (!noticeBar) {
    noticeBar = document.createElement('div');
    noticeBar.id = 'customDisplayNoticeBar';
    noticeBar.className = 'nav-time-fixed-bar custom-notice-bar';
    document.body.appendChild(noticeBar);
  }

  if (state.activeSingleCollection) {
    noticeBar.style.display = 'flex';
    noticeBar.innerHTML = `
      <span>Exibição personalizada - Coleção: <strong>${state.activeSingleCollection.label}</strong>. 
      (<a href="#" id="resetNoticeBtn" style="color:var(--accent-color); text-decoration:underline;">clique aqui para voltar a exibir tudo</a>)</span>
    `;
    document.getElementById('resetNoticeBtn').addEventListener('click', (e) => {
      e.preventDefault();
      resetToDisplayAll();
    });
  } else if (isFilterCustomized()) {
    noticeBar.style.display = 'flex';
    noticeBar.innerHTML = `
      <span>Exibição personalizada - <strong>Filtro</strong> 
      (<a href="#" id="resetNoticeBtn" style="color:var(--accent-color); text-decoration:underline;">clique aqui para voltar a exibir tudo</a>)</span>
    `;
    document.getElementById('resetNoticeBtn').addEventListener('click', (e) => {
      e.preventDefault();
      resetToDisplayAll();
    });
  } else {
    noticeBar.style.display = 'none';
  }
}

function isFilterCustomized() {
  const tree = extractAllCollectionsTree();
  const allCats = Array.from(tree.categories);
  if (tree.hasUncategorized) allCats.push('Sem categoria');
  const allMarkers = ['0', '5', '1', '2', '3', 'null'];

  const markersChanged = state.filterState.markers.length !== allMarkers.length;
  const catsChanged = state.filterState.categories.length !== allCats.length;
  const removedChanged = state.filterState.showRemoved === true;

  return markersChanged || catsChanged || removedChanged;
}

export function resetToDisplayAll() {
  state.activeSingleCollection = null;

  const tree = extractAllCollectionsTree();
  const allCats = Array.from(tree.categories);
  if (tree.hasUncategorized) allCats.push('Sem categoria');

  state.filterState.markers = ['0', '5', '1', '2', '3', 'null'];
  state.filterState.categories = [...allCats];
  state.filterState.showRemoved = false;

  renderCustomDisplayNotice();
  renderList();
}

// Popula o Modal de "Coleções" (exibição em botões)
export function populateCollectionsModal(container) {
  if (!container) return;
  container.innerHTML = '';

  const tree = extractAllCollectionsTree();

  // Rótulo: Coleções
  if (tree.collections.size > 0) {
    const group = createGroupSection('Coleções');
    Array.from(tree.collections).sort().forEach(col => {
      const btn = createOptionButton(col, () => {
        state.activeSingleCollection = { type: 'collection', value: col, label: col };
        renderCustomDisplayNotice();
        renderList();
      });
      group.appendChild(btn);
    });
    container.appendChild(group);
  }

  // Rótulo: Playlists
  const channelsWithPlaylists = Object.keys(tree.playlistsByChannel).filter(ch => tree.playlistsByChannel[ch].size > 0);
  if (channelsWithPlaylists.length > 0) {
    const group = createGroupSection('Playlists');
    channelsWithPlaylists.sort().forEach(ch => {
      const chHeader = document.createElement('div');
      chHeader.className = 'control-label';
      chHeader.style.margin = '6px 0 2px 4px';
      chHeader.textContent = ch;
      group.appendChild(chHeader);

      Array.from(tree.playlistsByChannel[ch]).sort().forEach(pl => {
        const btn = createOptionButton(pl, () => {
          state.activeSingleCollection = { type: 'playlist', value: pl, label: `${ch} > ${pl}` };
          renderCustomDisplayNotice();
          renderList();
        });
        group.appendChild(btn);
      });
    });
    container.appendChild(group);
  }

  // Rótulo: Categorias
  const groupCat = createGroupSection('Categorias');
  const catList = Array.from(tree.categories).sort();
  if (tree.hasUncategorized) catList.push('Sem categoria');

  catList.forEach(cat => {
    const btn = createOptionButton(cat, () => {
      state.activeSingleCollection = { type: 'category', value: cat, label: cat };
      renderCustomDisplayNotice();
      renderList();
    });
    groupCat.appendChild(btn);
  });
  container.appendChild(groupCat);

  // Rótulo: Marcadores
  const groupMark = createGroupSection('Marcadores');
  const markers = [
    { label: 'Visto', val: '0' },
    { label: 'Rever', val: '5' },
    { isHeader: true, label: 'Prioridade:' },
    { label: 'Alta', val: '1' },
    { label: 'Média', val: '2' },
    { label: 'Baixa', val: '3' },
    { label: 'Indefinidos (vídeos sem marcadores)', val: 'null' }
  ];

  markers.forEach(m => {
    if (m.isHeader) {
      const subHeader = document.createElement('div');
      subHeader.className = 'control-label';
      subHeader.style.margin = '4px 0 2px 8px';
      subHeader.textContent = m.label;
      groupMark.appendChild(subHeader);
      return;
    }

    const btn = createOptionButton(m.label, () => {
      state.activeSingleCollection = { type: 'marker', value: m.val, label: m.label };
      renderCustomDisplayNotice();
      renderList();
    });
    groupMark.appendChild(btn);
  });
  container.appendChild(groupMark);
}

// Popula o Modal de "Filtro" (Toggle Buttons / Show/Hide)
export function populateFilterModal(container) {
  if (!container) return;
  container.innerHTML = '';
  initFilterStateDefaults();

  const tree = extractAllCollectionsTree();

  // Botão Topo "Exibir tudo"
  const topBar = document.createElement('div');
  topBar.style.marginBottom = '10px';
  const displayAllBtn = document.createElement('button');
  displayAllBtn.className = 'btn-group-item highlighted';
  displayAllBtn.textContent = 'Exibir tudo';
  displayAllBtn.onclick = () => {
    resetToDisplayAll();
    populateFilterModal(container);
  };
  topBar.appendChild(displayAllBtn);
  container.appendChild(topBar);

  // Rótulo: Marcadores
  const markSection = createGroupSection('Marcadores', true, (selectAll) => {
    state.filterState.markers = selectAll ? ['0', '5', '1', '2', '3', 'null'] : [];
    syncAndRenderFilter();
    populateFilterModal(container);
  });

  const markers = [
    { label: 'Visto', val: '0' },
    { label: 'Rever', val: '5' },
    { isHeader: true, label: 'Prioridade:' },
    { label: 'Alta', val: '1' },
    { label: 'Média', val: '2' },
    { label: 'Baixa', val: '3' },
    { label: 'Indefinidos (vídeos sem marcadores)', val: 'null' }
  ];

  markers.forEach(m => {
    if (m.isHeader) {
      const sub = document.createElement('div');
      sub.className = 'control-label';
      sub.style.margin = '4px 0 2px 8px';
      sub.textContent = m.label;
      markSection.appendChild(sub);
      return;
    }

    const isChecked = state.filterState.markers.includes(m.val);
    const btn = createToggleButton(m.label, isChecked, (active) => {
      if (active) state.filterState.markers.push(m.val);
      else state.filterState.markers = state.filterState.markers.filter(v => v !== m.val);
      syncAndRenderFilter();
    });
    markSection.appendChild(btn);
  });
  container.appendChild(markSection);

  // Rótulo: Categorias
  const catList = Array.from(tree.categories).sort();
  if (tree.hasUncategorized) catList.push('Sem categoria');

  const catSection = createGroupSection('Categorias', true, (selectAll) => {
    state.filterState.categories = selectAll ? [...catList] : [];
    syncAndRenderFilter();
    populateFilterModal(container);
  });

  catList.forEach(cat => {
    const isChecked = state.filterState.categories.includes(cat);
    const btn = createToggleButton(cat, isChecked, (active) => {
      if (active) state.filterState.categories.push(cat);
      else state.filterState.categories = state.filterState.categories.filter(c => c !== cat);
      syncAndRenderFilter();
    });
    catSection.appendChild(btn);
  });
  container.appendChild(catSection);

  // Rótulo: Canais
  const chanSection = createGroupSection('Canais', false);
  Array.from(tree.channels).sort().forEach(ch => {
    const isChecked = state.filterState.channels.includes(ch);
    const btn = createToggleButton(ch, isChecked, (active) => {
      if (active) state.filterState.channels.push(ch);
      else state.filterState.channels = state.filterState.channels.filter(c => c !== ch);
      syncAndRenderFilter();
    });
    chanSection.appendChild(btn);
  });
  container.appendChild(chanSection);

  // Removidos
  const remSection = createGroupSection('Removidos', false);
  const remBtn = createToggleButton('Exibir vídeos removidos', state.filterState.showRemoved, (active) => {
    state.filterState.showRemoved = active;
    syncAndRenderFilter();
  });
  remSection.appendChild(remBtn);
  container.appendChild(remSection);
}

function syncAndRenderFilter() {
  state.activeSingleCollection = null;
  renderCustomDisplayNotice();
  renderList();
}

function createGroupSection(title, showGlobalToggle = false, onToggle = null) {
  const group = document.createElement('div');
  group.className = 'control-group-wrapper';
  group.style.marginBottom = '12px';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';

  const label = document.createElement('span');
  label.className = 'control-label';
  label.textContent = title;
  header.appendChild(label);

  if (showGlobalToggle && onToggle) {
    const toggleActions = document.createElement('div');
    toggleActions.style.fontSize = '10px';
    toggleActions.innerHTML = `
      <a href="#" class="select-all-btn" style="color:var(--text-muted); margin-right:6px;">Todos</a>
      <a href="#" class="deselect-all-btn" style="color:var(--text-muted);">Nenhum</a>
    `;
    toggleActions.querySelector('.select-all-btn').onclick = (e) => { e.preventDefault(); onToggle(true); };
    toggleActions.querySelector('.deselect-all-btn').onclick = (e) => { e.preventDefault(); onToggle(false); };
    header.appendChild(toggleActions);
  }

  group.appendChild(header);
  return group;
}

function createOptionButton(text, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-group-item';
  btn.style.width = '100%';
  btn.style.justifyContent = 'flex-start';
  btn.style.marginTop = '4px';
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function createToggleButton(text, isActive, onToggle) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn-group-item ${isActive ? 'active highlighted' : ''}`;
  btn.style.width = '100%';
  btn.style.justifyContent = 'flex-start';
  btn.style.marginTop = '4px';
  btn.textContent = text;
  btn.onclick = () => {
    const newState = !btn.classList.contains('active');
    if (newState) {
      btn.classList.add('active', 'highlighted');
    } else {
      btn.classList.remove('active', 'highlighted');
    }
    onToggle(newState);
  };
  return btn;
}

// Avalia a visibilidade do vídeo baseando-se em Coleção Ativa ou Filtros
export function isVideoCollectionsVisible(item) {
  // 1. Filtragem por Privacidade (Removidos)
  if (item.privacyStatus === 'removed' && !state.filterState.showRemoved) {
    return false;
  }

  // 2. Modo Seleção de Coleção Única
  if (state.activeSingleCollection) {
    const { type, value } = state.activeSingleCollection;

    if (type === 'collection') {
      const cols = Array.isArray(item.collection) ? item.collection : [item.collection];
      return cols.some(c => c && c.trim() === value);
    }
    if (type === 'playlist') {
      const pls = Array.isArray(item.playlist) ? item.playlist : [item.playlist];
      return pls.some(p => p && p.trim() === value);
    }
    if (type === 'category') {
      if (value === 'Sem categoria') return !item.category || !item.category.trim();
      return item.category && item.category.trim() === value;
    }
    if (type === 'marker') {
      const mVal = (window.userMarkerCache && window.userMarkerCache[item.videoId] !== undefined)
        ? String(window.userMarkerCache[item.videoId]) : 'null';
      return mVal === value;
    }
    return true;
  }

  // 3. Modo Filtro (Show/Hide independente)
  const isChannelMatch = state.filterState.channels.includes(item.channelTitle);
  if (!isChannelMatch) return false;

  const catName = (item.category && item.category.trim()) ? item.category.trim() : 'Sem categoria';
  const isCategoryMatch = state.filterState.categories.includes(catName);
  if (!isCategoryMatch) return false;

  const mVal = (window.userMarkerCache && window.userMarkerCache[item.videoId] !== undefined)
    ? String(window.userMarkerCache[item.videoId]) : 'null';
  const isMarkerMatch = state.filterState.markers.includes(mVal);
  if (!isMarkerMatch) return false;

  return true;
}