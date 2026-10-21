import { videoDatabase, state } from './state.js';
import { parseTaxonomy, isVideoTaxonomyVisible } from './taxonomy.js';

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
    title.textContent = item.titulo;
    watchBtn.href = `https://www.youtube.com/watch?v=${item.videoId}`;
    modal.classList.add('open');
  }
}

// Modal de Ocorrências para o modo Ícones
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

// Função de criação do seletor de status reutilizável
function createStatusSelect(videoId) {
  const currentStatus = (window.userProgressCache && window.userProgressCache[videoId] !== undefined)
    ? window.userProgressCache[videoId] : '';
  const statusClass = currentStatus !== '' ? `status-${currentStatus}` : 'status-null';

  const select = document.createElement('select');
  select.className = `card-status-select ${statusClass}`;
  select.dataset.videoid = videoId;
  select.innerHTML = `
    <option value="" ${currentStatus === '' ? 'selected' : ''}>Status...</option>
    <option value="0" ${currentStatus === 0 ? 'selected' : ''}>Visto</option>
    <option value="1" ${currentStatus === 1 ? 'selected' : ''}>Alta</option>
    <option value="2" ${currentStatus === 2 ? 'selected' : ''}>Média</option>
    <option value="3" ${currentStatus === 3 ? 'selected' : ''}>Baixa</option>
  `;

  select.addEventListener('change', (e) => {
    const value = e.target.value;
    e.target.className = `card-status-select ${value !== "" ? `status-${value}` : 'status-null'}`;
    if (typeof window.updateVideoProgress === 'function') {
      window.updateVideoProgress(videoId, value);
    }
  });

  return select;
}

export function createCardElement(item, duplicates = [], forceDisplayMode = null) {
  const displayMode = forceDisplayMode || state.displayMode;
  const taxInfo = parseTaxonomy(item);
  const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
  const thumbUrl = `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
  const liveBadge = item.eLive ? `<span class="live-badge" title="Live"></span>` : '';
  const privacyNotice = item.privacyStatus === 'removed' ? `<span class="status-removed">(Removido)</span>` : '';

  // ------------------------------------------------------------------------
  // MODO 1: LISTA (UMA LINHA POR VÍDEO COM CAMPOS ALINHADOS)
  // ------------------------------------------------------------------------
  if (displayMode === 'lista') {
    const row = document.createElement('div');
    row.className = 'card-display-lista';

    // 1. Faixa fina lateral com a cor referente à categoria
    const stripe = document.createElement('div');
    stripe.className = 'category-stripe-thin';
    stripe.dataset.cat = taxInfo.categoria;
    stripe.title = `Categoria: ${taxInfo.categoria}`;
    row.appendChild(stripe);

    // 2. Thumbnail com duração no canto inferior direito
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'list-thumb-wrapper';
    thumbWrap.title = 'Clique para ampliar thumbnail';
    thumbWrap.innerHTML = `
      <img class="list-thumb-img" src="${thumbUrl}" alt="Thumb" loading="lazy">
      <span class="list-duration-tag">${formatDuration(item.duracaoSegundos)}</span>
    `;
    thumbWrap.addEventListener('click', () => openThumbModal(item));
    row.appendChild(thumbWrap);

    // 3. Título (com scroll horizontal arrastável se grande)
    const titleWrap = document.createElement('div');
    titleWrap.className = 'list-title-wrapper';
    titleWrap.innerHTML = `<a href="${videoUrl}" target="_blank" class="list-title">${item.titulo}</a>`;
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

    // 5. Seletor de Status
    const statusCell = document.createElement('div');
    statusCell.className = 'list-item-cell';
    statusCell.appendChild(createStatusSelect(item.videoId));
    row.appendChild(statusCell);

    // 6. Data
    const dateCell = document.createElement('div');
    dateCell.className = 'list-item-cell';
    dateCell.style.color = 'var(--text-secondary)';
    dateCell.textContent = formatLocalDateTime(item.dataPublicacao);
    row.appendChild(dateCell);

    // 7. Canal
    const channelCell = document.createElement('div');
    channelCell.className = 'list-item-cell';
    channelCell.style.fontWeight = 'bold';
    channelCell.style.color = 'var(--text-secondary)';
    channelCell.textContent = item.canal;
    row.appendChild(channelCell);

    // 8. live-Removido-TAGs
    const tagsCell = document.createElement('div');
    tagsCell.className = 'list-item-cell';
    let tagsContent = `${liveBadge}${privacyNotice}`;
    if (taxInfo.grupo) tagsContent += ` <span style="font-size:10px; color:var(--accent-color);">[${taxInfo.grupo}]</span>`;
    tagsCell.innerHTML = tagsContent;
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
  // MODO 2: ÍCONES (GRADE NO ESTILO YOUTUBE COM MODAL DE OCORRÊNCIAS)
  // ------------------------------------------------------------------------
  if (displayMode === 'icones') {
    const card = document.createElement('div');
    card.className = 'card-display-icones';

    card.innerHTML = `
      <div class="icones-cat-bar" data-cat="${taxInfo.categoria}" title="Categoria: ${taxInfo.categoria}"></div>
      <div class="icones-media-block">
        <a href="${videoUrl}" target="_blank">
          <img class="icones-thumb" src="${thumbUrl}" alt="Thumbnail" loading="lazy">
        </a>
        <span class="duration-tag" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.8); padding:2px 4px; border-radius:3px; font-size:11px;">
          ${formatDuration(item.duracaoSegundos)}
        </span>
      </div>
      <div class="icones-body">
        <a href="${videoUrl}" target="_blank" class="icones-title">${item.titulo}</a>
        <div class="icones-details">
          <span><strong>${item.canal}</strong> ${liveBadge} ${privacyNotice}</span>
          <span>${formatLocalDateTime(item.dataPublicacao)}</span>
        </div>
        <div class="icones-footer">
          <div class="status-container"></div>
          ${duplicates.length > 0 ? `<button class="drawer-toggle occ-modal-btn" title="Ver ocorrências em Modal">+${duplicates.length}</button>` : ''}
        </div>
      </div>
    `;

    card.querySelector('.status-container').appendChild(createStatusSelect(item.videoId));

    if (duplicates.length > 0) {
      card.querySelector('.occ-modal-btn').addEventListener('click', () => {
        openOccurrencesModal(duplicates);
      });
    }

    return card;
  }

  // ------------------------------------------------------------------------
  // MODO 3: COMPACTO (MODELO DE CARDS PADRÃO)
  // ------------------------------------------------------------------------
  const card = document.createElement('div');
  card.className = 'card-display-compacto';

  let badgesHtml = '';
  if (taxInfo.grupo) badgesHtml += `<span class="badge-grupo">📁 ${taxInfo.grupo}</span>`;
  if (taxInfo.playlist) badgesHtml += `<span class="badge-tag">🎵 ${taxInfo.playlist}</span>`;

  card.innerHTML = `
    <div class="category-stripe" data-cat="${taxInfo.categoria}">
      <span class="category-stripe-text">${taxInfo.categoria}</span>
    </div>
    <div class="card-media-block" title="Clique para ampliar thumbnail">
      <img class="card-thumb" src="${thumbUrl}" alt="Thumbnail" loading="lazy">
      <div class="thumb-footer-bar">
        <span class="videoid-tag">${item.videoId}</span>
        <span class="duration-tag">${formatDuration(item.duracaoSegundos)}</span>
      </div>
    </div>
    <div class="card-content">
      <div>
        <a href="${videoUrl}" target="_blank" class="card-title">${item.titulo}</a>
        ${privacyNotice}
      </div>
      <span class="card-channel">${item.canal}</span>
      <span class="card-date">${formatLocalDateTime(item.dataPublicacao)}${liveBadge}</span>
      ${badgesHtml ? `<div style="margin-top:4px;">${badgesHtml}</div>` : ''}

      <div class="status-container" style="margin-top:6px;"></div>

      ${duplicates.length > 0 ? `
        <button class="drawer-toggle" title="Ver ocorrências" style="position:absolute; bottom:10px; right:10px;">+${duplicates.length}</button>
        <div class="drawer-content"></div>
      ` : ''}
    </div>
  `;

  card.querySelector('.card-media-block').addEventListener('click', () => openThumbModal(item));
  card.querySelector('.status-container').appendChild(createStatusSelect(item.videoId));

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

export function renderList() {
  const container = document.getElementById('videoListContainer');
  if (!container) return;
  container.innerHTML = '';

  if (videoDatabase.length === 0) {
    container.innerHTML = '<div class="status-message">Nenhum vídeo cadastrado.</div>';
    return;
  }

  let items = videoDatabase.filter(item => {
    const isChannelVisible = !state.hiddenChannels.includes(item.canal);
    const isTaxonomyVisible = isVideoTaxonomyVisible(item);
    return isChannelVisible && isTaxonomyVisible;
  });

  if (state.searchQuery.trim() !== '') {
    items = items.filter(item => fuzzyMatch(item.titulo, state.searchQuery));
  }

  if (items.length === 0) {
    container.innerHTML = '<div class="status-message">Nenhum resultado corresponde aos filtros aplicados.</div>';
    return;
  }

  const sortItems = (list) => {
    list.sort((a, b) => {
      let valA, valB;
      if (state.sortBy === 'categoria') {
        valA = (a.categoria || 'zzz').toLowerCase();
        valB = (b.categoria || 'zzz').toLowerCase();
        return state.sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (state.sortBy === 'progresso') {
        valA = (window.userProgressCache && window.userProgressCache[a.videoId] !== undefined) ? Number(window.userProgressCache[a.videoId]) : 99;
        valB = (window.userProgressCache && window.userProgressCache[b.videoId] !== undefined) ? Number(window.userProgressCache[b.videoId]) : 99;
      } else if (state.sortBy === 'titulo') {
        valA = a.titulo.toLowerCase();
        valB = b.titulo.toLowerCase();
        return state.sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (state.sortBy === 'duracao') {
        valA = a.duracaoSegundos || 0;
        valB = b.duracaoSegundos || 0;
      } else {
        valA = new Date(a.dataPublicacao);
        valB = new Date(b.dataPublicacao);
      }
      return state.sortAscending ? valA - valB : valB - valA;
    });
  };

  sortItems(items);

  // Wrapper para o Modo Ícones (Grade)
  let targetContainer = container;
  if (state.displayMode === 'icones') {
    const grid = document.createElement('div');
    grid.className = 'grid-container-icones';
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
      if (!channelGroups.has(item.canal)) channelGroups.set(item.canal, []);
      channelGroups.get(item.canal).push(item);
    });

    channelGroups.forEach((groupItems, channelName) => {
      const groupTitle = document.createElement('div');
      groupTitle.className = 'channel-group-title';
      groupTitle.textContent = channelName;
      container.appendChild(groupTitle);

      let groupTarget = container;
      if (state.displayMode === 'icones') {
        groupTarget = document.createElement('div');
        groupTarget.className = 'grid-container-icones';
        container.appendChild(groupTarget);
      }

      groupItems.forEach(item => groupTarget.appendChild(createCardElement(item, [])));
    });
  } else {
    items.forEach(item => targetContainer.appendChild(createCardElement(item, [])));
  }

  const isLogged = !!window.currentUser;
  container.querySelectorAll('.card-status-select').forEach(el => el.disabled = !isLogged);
}