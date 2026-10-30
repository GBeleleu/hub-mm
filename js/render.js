import { videoDatabase, state } from './state.js';
import { parseCollections, isVideoCollectionsVisible } from './collections.js';

function renderBadgesHtml(item) {
  let html = '';

  // 1. Badge de Coleção (Ícone SVG)
  if (item.collection) {
    const cols = Array.isArray(item.collection) ? item.collection : [item.collection];
    const validCols = cols.filter(c => c && c.trim());
    
    if (validCols.length > 0) {
      const namesList = validCols.map(c => c.trim()).join(', ');
      html += `
        <span class="card-meta-badge collection-badge" title="Ver Coleções" onclick="window.openBadgePopup(event, '${namesList}')">
          <svg class="btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        </span>
      `;
    }
  }

  // 2. Badge de Playlist (Ícone SVG)
  if (item.playlist) {
    const pls = Array.isArray(item.playlist) ? item.playlist : [item.playlist];
    const validPls = pls.filter(p => p && p.trim());
    
    if (validPls.length > 0) {
      const namesList = validPls.map(p => p.trim()).join(', ');
      html += `
        <span class="card-meta-badge playlist-badge" title="Ver Playlists" onclick="window.openBadgePopup(event, '${namesList}')">
          <svg class="btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15l7-3-7-3v6z"/></svg>
        </span>
      `;
    }
  }

  return html ? `<div class="card-badges-wrapper">${html}</div>` : '';
}

export function normalizeText(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
}

export function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

export function fuzzyMatch(title, query) {
  const cleanTitle = normalizeText(title);
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return true;
  if (cleanTitle.includes(cleanQuery)) return true;

  const titleWords = cleanTitle.split(/\s+/);
  const queryWords = cleanQuery.split(/\s+/);

  return queryWords.every(qWord => {
    let maxDistance = qWord.length > 7 ? 2 : 1;
    return titleWords.some(tWord => {
      if (tWord.includes(qWord)) return true;
      if (Math.abs(tWord.length - qWord.length) > maxDistance) return false;
      return levenshteinDistance(tWord, qWord) <= maxDistance;
    });
  });
}

export function formatLocalDateTime(isoDateStr) {
  if (!isoDateStr) return '';
  return new Date(isoDateStr).toLocaleString();
}

export function formatDuration(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds)) return '0:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (num) => String(num).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// Modal de visualização da Thumbnail Ampliada
export function openThumbModal(item) {
  const modal = document.getElementById('thumbPreviewModal');
  const img = document.getElementById('thumbModalImg');
  const title = document.getElementById('thumbModalTitle');
  const watchBtn = document.getElementById('thumbModalWatchBtn');

  if (modal && img && title && watchBtn) {
    img.src = `https://img.youtube.com/vi/${item.videoId}/maxresdefault.jpg`;
    img.onerror = () => { img.src = `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`; };
    title.textContent = item.title;
    watchBtn.href = `https://www.youtube.com/watch?v=${item.videoId}`;
    modal.classList.add('open');
  }
}

// Modal de Ocorrências para o modo Grade
export function openOccurrencesModal(duplicates) {
  const modal = document.getElementById('occurrencesModal');
  const container = document.getElementById('occurrencesListContainer');

  if (modal && container) {
    container.innerHTML = '';
    duplicates.forEach(dupItem => {
      container.appendChild(createCardElement(dupItem, [], 'compacto'));
    });
    modal.classList.add('open');
  }
}

// Criação dos Marcadores
// Definição dos SVGs inline para cada tipo de marcador
const MARKER_CONFIG = {
  '': {
    label: '...',
    color: '#888888',
    class: 'marker-null',
    svg: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`
  },
  '0': {
    label: 'Visto',
    color: '#4caf50',
    class: 'marker-0',
    svg: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`
  },
  '1': {
    label: 'Alta',
    color: '#e53935',
    class: 'marker-1',
    svg: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`
  },
  '2': {
    label: 'Média',
    color: '#fb8c00',
    class: 'marker-2',
    svg: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`
  },
  '3': {
    label: 'Baixa',
    color: '#fdd835',
    class: 'marker-3',
    svg: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`
  },
  '5': {
    label: 'Rever',
    color: '#2e4dff',
    class: 'marker-5',
    svg: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`
  }
};

function createMarkerSelect(videoId) {
  const currentKey = (window.userMarkerCache && window.userMarkerCache[videoId] !== undefined)
    ? String(window.userMarkerCache[videoId]) : '';
  const currentConfig = MARKER_CONFIG[currentKey] || MARKER_CONFIG[''];

  const container = document.createElement('div');
  container.className = `card-marker-dropdown ${currentConfig.class}`;
  container.dataset.videoid = videoId;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'marker-dropdown-trigger';
  trigger.title = currentConfig.label;
  trigger.innerHTML = `${currentConfig.svg} <span class="marker-label">${currentConfig.label}</span>`;
  
  const isLogged = !!window.currentUser;
  if (!isLogged) trigger.disabled = true;

  trigger.addEventListener('click', (event) => {
    if (!isLogged) return;

    window.openFloatingMenu(event, trigger, (popup, closePopup) => {
      popup.classList.add('marker-popup-container'); // Opcional para estilização específica se necessário

      Object.entries(MARKER_CONFIG).forEach(([val, cfg]) => {
        const option = document.createElement('div');
        option.className = `marker-dropdown-option ${cfg.class}`;
        option.innerHTML = `${cfg.svg} <span>${cfg.label}</span>`;
        
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          container.className = `card-marker-dropdown ${cfg.class}`;
          trigger.innerHTML = `${cfg.svg} <span class="marker-label">${cfg.label}</span>`;
          trigger.title = cfg.label;
          closePopup();

          if (typeof window.updateVideoMarker === 'function') {
            window.updateVideoMarker(videoId, val === '' ? '' : Number(val));
          }
        });

        popup.appendChild(option);
      });
    });
  });

  container.appendChild(trigger);
  container.appendChild(window.openBadgePopup ? '' : ''); // Mantém referência se necessário
  return container;
}

export function createCardElement(item, duplicates = [], forceDisplayMode = null) {
  let displayMode = forceDisplayMode || state.displayMode;
  if (!['lista', 'compacto', 'grade'].includes(displayMode)) {
    displayMode = 'compacto'; // Garante o modo compacto como padrão seguro
  }
  const colInfo = parseCollections(item);
  const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
  const thumbUrl = `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
  const liveBadge = item.isLive ? `<span class="live-badge" title="Live"></span>` : '';
  const privacyNotice = item.privacyStatus === 'removed' ? `<span class="status-removed">❌</span>` : '';

  // ------------------------------------------------------------------------
  // MODO 1: LISTA
  // ------------------------------------------------------------------------
  if (displayMode === 'lista') {
    const row = document.createElement('div');
    row.className = 'card-display-lista';

    // 1. Faixa fina lateral com a cor referente à category
    const stripe = document.createElement('div');
    stripe.className = 'category-stripe-thin';
    stripe.dataset.cat = colInfo.category;
    stripe.title = colInfo.category;
    row.appendChild(stripe);

    // 2. Thumbnail com duração no canto inferior direito
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'list-thumb-wrapper';
    thumbWrap.title = 'Clique para ampliar thumbnail';
    thumbWrap.innerHTML = `
      <img class="list-thumb-img" src="${thumbUrl}" alt="Thumb" loading="lazy">
      <span class="list-duration-tag">${formatDuration(item.durationSeconds)}</span>
    `;
    thumbWrap.addEventListener('click', () => openThumbModal(item));
    row.appendChild(thumbWrap);

    // 3. Título (com scroll horizontal arrastável se grande)
    const titleWrap = document.createElement('div');
    titleWrap.className = 'list-title-wrapper';
    titleWrap.innerHTML = `<a href="${videoUrl}" target="_blank" class="list-title">${item.title}</a>`;
    row.appendChild(titleWrap);

    // 4. Numeral que abre Gaveta de Ocorrências (se houver duplicatas)
    const occCell = document.createElement('div');
    occCell.className = 'list-item-cell';
    if (duplicates.length > 0) {
      const btn = document.createElement('button');
      btn.className = 'drawer-toggle';
      btn.textContent = `+${duplicates.length}`;
      btn.title = 'Abrir gaveta de ocorrências';
      btn.addEventListener('click', () => {
        const drawer = row.nextElementSibling;
        if (drawer && drawer.classList.contains('drawer-content')) {
          drawer.classList.toggle('open');
        }
      });
      occCell.appendChild(btn);
    }
    row.appendChild(occCell);

    // 5. Marcadores
    const markerCell = document.createElement('div');
    markerCell.className = 'list-item-cell';
    markerCell.appendChild(createMarkerSelect(item.videoId));
    row.appendChild(markerCell);

    // 6. Data
    const dateCell = document.createElement('div');
    dateCell.className = 'list-item-cell';
    dateCell.style.color = 'var(--text-secondary)';
    dateCell.textContent = formatLocalDateTime(item.publishedAt);
    row.appendChild(dateCell);

    // 7. Canal
    const channelCell = document.createElement('div');
    channelCell.className = 'list-item-cell';
    channelCell.style.fontWeight = 'bold';
    channelCell.style.color = 'var(--text-secondary)';
    channelCell.textContent = item.channelTitle;
    row.appendChild(channelCell);

    // 8. Coleção/Playlists Badges
    const tagsCell = document.createElement('div');
    tagsCell.className = 'list-item-cell';
    tagsCell.innerHTML = `${liveBadge}${privacyNotice} ${renderBadgesHtml(item)}`;
    row.appendChild(tagsCell);

    // 9. videoID
    const idCell = document.createElement('div');
    idCell.className = 'list-item-cell';
    idCell.style.fontFamily = 'monospace';
    idCell.style.color = 'var(--text-muted)';
    idCell.style.fontSize = '10px';
    idCell.textContent = item.videoId;
    row.appendChild(idCell);

    // Suporte à Gaveta no Modo Lista
    if (duplicates.length > 0) {
      const wrapper = document.createElement('div');
      wrapper.appendChild(row);

      const drawerContent = document.createElement('div');
      drawerContent.className = 'drawer-content';
      duplicates.forEach(dupItem => {
        drawerContent.appendChild(createCardElement(dupItem, [], 'lista'));
      });
      wrapper.appendChild(drawerContent);
      return wrapper;
    }

    return row;
  }

  // ------------------------------------------------------------------------
  // MODO 2: COMPACTO (Padrão)
  // ------------------------------------------------------------------------
  if (displayMode === 'compacto') {
    const card = document.createElement('div');
    card.className = 'card-display-compacto';

    let badgesHtml = renderBadgesHtml(item);

    card.innerHTML = `
      <div class="category-stripe" data-cat="${colInfo.category}">
        <span class="category-stripe-text">${colInfo.category}</span>
      </div>
      <div class="card-media-block" title="Clique para ampliar thumbnail">
        <img class="card-thumb" src="${thumbUrl}" alt="Thumbnail" loading="lazy">
        <div class="thumb-footer-bar">
          <span class="videoid-tag">${item.videoId}</span>
          <span class="duration-tag">${formatDuration(item.durationSeconds)}</span>
        </div>
      </div>
      <div class="card-content">
        <div>
          <a href="${videoUrl}" target="_blank" class="card-title">${item.title}</a>
          ${privacyNotice}
        </div>
        <span class="card-channel">${item.channelTitle}</span>
        <span class="card-date">${formatLocalDateTime(item.publishedAt)}${liveBadge}</span>
        ${badgesHtml ? `<div style="margin-top:4px;">${badgesHtml}</div>` : ''}

        <div class="marker-container" style="margin-top:6px;"></div>

        ${duplicates.length > 0 ? `
          <button class="drawer-toggle" title="Ver ocorrências" style="position:absolute; bottom:10px; right:10px;">+${duplicates.length}</button>
          <div class="drawer-content"></div>
        ` : ''}
      </div>
    `;

    card.querySelector('.card-media-block').addEventListener('click', () => openThumbModal(item));
    card.querySelector('.marker-container').appendChild(createMarkerSelect(item.videoId));

    if (duplicates.length > 0) {
      const toggleBtn = card.querySelector('.drawer-toggle');
      const drawerContent = card.querySelector('.drawer-content');
      toggleBtn.addEventListener('click', () => drawerContent.classList.toggle('open'));

      duplicates.forEach(dupItem => {
        drawerContent.appendChild(createCardElement(dupItem, [], 'compacto'));
      });
    }

    return card;
  }

  // ------------------------------------------------------------------------
  // MODO 3: GRADE
  // ------------------------------------------------------------------------
  if (displayMode === 'grade') {
    const card = document.createElement('div');
    card.className = 'card-display-grade'; // Mantendo a classe CSS existente para não quebrar estilos

    card.innerHTML = `
      <div class="grade-cat-bar" data-cat="${colInfo.category}" title="${colInfo.category}"></div>
      <div class="grade-media-block">
        <a href="${videoUrl}" target="_blank">
          <img class="grade-thumb" src="${thumbUrl}" alt="Thumbnail" loading="lazy">
        </a>
        <span class="duration-tag" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.8); padding:2px 4px; border-radius:3px; font-size:11px;">
          ${formatDuration(item.durationSeconds)}
        </span>
      </div>
      <div class="grade-body">
        <a href="${videoUrl}" target="_blank" class="grade-title">${item.title}</a>
        <div class="grade-details">
          <span><strong>${item.channelTitle}</strong> ${liveBadge} ${privacyNotice}</span>
          <span>${formatLocalDateTime(item.publishedAt)}</span>
        </div>
        <div class="grade-badges-container" style="margin-top:4px;">
          ${renderBadgesHtml(item)}
        </div>
        <div class="grade-footer">
          <div class="marker-container"></div>
          ${duplicates.length > 0 ? `<button class="drawer-toggle occ-modal-btn" title="Ver ocorrências em Modal">+${duplicates.length}</button>` : ''}
        </div>
      </div>
    `;

    card.querySelector('.marker-container').appendChild(createMarkerSelect(item.videoId));

    if (duplicates.length > 0) {
      card.querySelector('.occ-modal-btn').addEventListener('click', () => {
        openOccurrencesModal(duplicates);
      });
    }

    return card;
  }
  const fallbackCard = document.createElement('div');
  fallbackCard.className = 'card-display-compacto';
  fallbackCard.textContent = item?.title || 'Item inválido';
  return fallbackCard;
}

export function renderList() {
  const container = document.getElementById('videoListContainer');
  if (!container) return;
  container.innerHTML = '';

  if (videoDatabase.length === 0) {
    container.innerHTML = '<div class="status-message">Nenhum vídeo cadastrado.</div>';
    return;
  }

  let items = videoDatabase.filter(item => {
    const isChannelVisible = !state.hiddenChannels.includes(item.channelTitle);
    const isCollectionsVisible = isVideoCollectionsVisible(item);
    return isChannelVisible && isCollectionsVisible;
  });

  if (state.searchQuery.trim() !== '') {
    items = items.filter(item => fuzzyMatch(item.title, state.searchQuery));
  }

  if (items.length === 0) {
    container.innerHTML = '<div class="status-message">Nenhum resultado corresponde aos filtros aplicados.</div>';
    return;
  }

  const sortItems = (list) => {
    list.sort((a, b) => {
      let valA, valB;
      if (state.sortBy === 'category') {
        valA = (a.category || 'zzz').toLowerCase();
        valB = (b.category || 'zzz').toLowerCase();
        return state.sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (state.sortBy === 'marcador') {
        valA = (window.userMarkerCache && window.userMarkerCache[a.videoId] !== undefined) ? Number(window.userMarkerCache[a.videoId]) : 99;
        valB = (window.userMarkerCache && window.userMarkerCache[b.videoId] !== undefined) ? Number(window.userMarkerCache[b.videoId]) : 99;
      } else if (state.sortBy === 'duracao') {
        valA = a.durationSeconds || 0;
        valB = b.durationSeconds || 0;
      } else if (state.sortBy === 'ocorrencias') {
        const getCount = (item) => {
          const targetId = item.isMaster ? item.videoId : item.masterId;
          if (!targetId) return 1;
          let count = 0;
          videoDatabase.forEach(v => {
            if (v.videoId === targetId || v.masterId === targetId) count++;
          });
          return count > 0 ? count : 1;
        };
        valA = getCount(a);
        valB = getCount(b);
      } else {
        valA = new Date(a.publishedAt);
        valB = new Date(b.publishedAt);
      }
      return state.sortAscending ? valA - valB : valB - valA;
    });
  };

  sortItems(items);

  // Wrapper para o Modo Grade
  let targetContainer = container;
  if (state.displayMode === 'grade') {
    const grid = document.createElement('div');
    grid.className = 'grid-container-grade';
    container.appendChild(grid);
    targetContainer = grid;
  }

  // Lógica de Organização
  if (state.organizeMode === 'consolidado') {
    const masterMap = new Map();
    const duplicatesMap = new Map();

    items.forEach(item => {
      if (item.isMaster) {
        masterMap.set(item.videoId, item);
      } else {
        if (!duplicatesMap.has(item.masterId)) duplicatesMap.set(item.masterId, []);
        duplicatesMap.get(item.masterId).push(item);
      }
    });

    let masterList = Array.from(masterMap.values());
    sortItems(masterList);

    masterList.forEach(masterItem => {
      const duplicates = duplicatesMap.get(masterItem.videoId) || [];
      targetContainer.appendChild(createCardElement(masterItem, duplicates));
    });
  } else if (state.organizeMode === 'sequenciado-canais') {
    const channelGroups = new Map();
    items.forEach(item => {
      if (!channelGroups.has(item.channelTitle)) channelGroups.set(item.channelTitle, []);
      channelGroups.get(item.channelTitle).push(item);
    });

    channelGroups.forEach((groupItems, channelName) => {
      const groupTitle = document.createElement('div');
      groupTitle.className = 'channel-group-title';
      groupTitle.textContent = channelName;
      container.appendChild(groupTitle);

      let groupTarget = container;
      if (state.displayMode === 'grade') {
        groupTarget = document.createElement('div');
        groupTarget.className = 'grid-container-grade';
        container.appendChild(groupTarget);
      }

      groupItems.forEach(item => {
        const el = createCardElement(item, []);
        if (el instanceof Node) groupTarget.appendChild(el);
      });
    });
  } else {
    items.forEach(item => {
      const el = createCardElement(item, []);
      if (el instanceof Node) targetContainer.appendChild(el);
    });
  }

  const isLogged = !!window.currentUser;
  container.querySelectorAll('.card-marker-select').forEach(el => el.disabled = !isLogged);
}

// Gerenciador global genérico para pop-ups flutuantes (Badges, Marcadores, etc.)
window.openFloatingMenu = function(event, triggerElement, renderContentCallback) {
  event.stopPropagation();
  
  // Remove pop-ups anteriores abertos para evitar sobreposição
  document.querySelectorAll('.floating-popup-tooltip').forEach(el => el.remove());

  const popup = document.createElement('div');
  popup.className = 'floating-popup-tooltip';
  
  // Insere o conteúdo gerado pelo callback
  renderContentCallback(popup, () => closePopup());

  document.body.appendChild(popup);

  const rect = triggerElement.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 6}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;

  // Fecha ao clicar em qualquer lugar da tela ou ao rolar
  const closePopup = () => {
    popup.remove();
    window.removeEventListener('click', closePopup);
    window.removeEventListener('scroll', closePopup);
  };

  setTimeout(() => {
    window.addEventListener('click', closePopup);
    window.addEventListener('scroll', closePopup);
  }, 10);
};