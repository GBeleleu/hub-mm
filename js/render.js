import { videoDatabase, state, saveState } from './state.js';
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

export function createCardElement(item, duplicates = []) {
  const card = document.createElement('div');
  card.className = 'card';
  
  const pubDate = new Date(item.dataPublicacao);
  card.dataset.year = pubDate.getFullYear();
  card.dataset.month = pubDate.getMonth();

  const thumbUrl = `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
  const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
  const taxInfo = parseTaxonomy(item.taxonomia || item.categoria);

  let badgesHtml = '';
  if (taxInfo.grupo) badgesHtml += `<span class="badge-grupo">📁 ${taxInfo.grupo}</span>`;
  taxInfo.tags.forEach(t => badgesHtml += `<span class="badge-tag">🏷️ ${t}</span>`);

  let privacyNotice = item.privacyStatus === 'removed' ? `<span class="status-removed">(Vídeo removido)</span>` : '';
  const liveBadge = item.eLive ? `<span class="live-badge" title="Live"></span>` : '';

  const currentStatus = (window.userProgressCache && window.userProgressCache[item.videoId] !== undefined)
    ? window.userProgressCache[item.videoId] : '';
  const statusClass = currentStatus !== '' ? `status-${currentStatus}` : 'status-null';

  card.innerHTML = `
    <div class="category-stripe" data-cat="${taxInfo.categoria}">
      <span class="category-stripe-text">${taxInfo.categoria}</span>
    </div>
    <div class="card-media-block">
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

      <select class="card-status-select ${statusClass}" data-videoid="${item.videoId}">
        <option value="" ${currentStatus === '' ? 'selected' : ''}>Status...</option>
        <option value="0" ${currentStatus === 0 ? 'selected' : ''}>Visto</option>
        <option value="1" ${currentStatus === 1 ? 'selected' : ''}>Alta</option>
        <option value="2" ${currentStatus === 2 ? 'selected' : ''}>Média</option>
        <option value="3" ${currentStatus === 3 ? 'selected' : ''}>Baixa</option>
      </select>

      ${duplicates.length > 0 ? `
        <button class="drawer-toggle" title="Ver ocorrências">+${duplicates.length}</button>
        <div class="drawer-content"></div>
      ` : ''}
    </div>
  `;

  const statusSelect = card.querySelector('.card-status-select');
  statusSelect.addEventListener('change', (e) => {
    const value = e.target.value;
    e.target.className = `card-status-select ${value !== "" ? `status-${value}` : 'status-null'}`;
    if (typeof window.updateVideoProgress === 'function') {
      window.updateVideoProgress(item.videoId, value);
    }
  });

  if (duplicates.length > 0) {
    const toggleBtn = card.querySelector('.drawer-toggle');
    const drawerContent = card.querySelector('.drawer-content');
    toggleBtn.addEventListener('click', () => drawerContent.classList.toggle('open'));

    duplicates.forEach(dupItem => {
      const childCard = createCardElement(dupItem, []);
      childCard.classList.add('child-card');
      drawerContent.appendChild(childCard);
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
        valA = (parseTaxonomy(a.taxonomia || a.categoria).categoria || 'zzz').toLowerCase();
        valB = (parseTaxonomy(b.taxonomia || b.categoria).categoria || 'zzz').toLowerCase();
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

  if (state.viewMode === 'consolidado') {
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
      container.appendChild(createCardElement(masterItem, duplicates));
    });
  } else if (state.viewMode === 'sequenciado-canais') {
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
      groupItems.forEach(item => container.appendChild(createCardElement(item, [])));
    });
  } else {
    items.forEach(item => container.appendChild(createCardElement(item, [])));
  }

  const isLogged = !!window.currentUser;
  container.querySelectorAll('.card-status-select').forEach(el => el.disabled = !isLogged);
}