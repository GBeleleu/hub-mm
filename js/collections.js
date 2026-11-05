/**
 * js/collections.js - Extrator e Gerenciador de Coleções (Consumidor Nativo)
 */
import { videoDatabase, hiddenCollectionsTags } from './state.js';

export function parseCollections(item) {
  return {
    category: item.category ? item.category.trim() : '',
    collection: item.collection || '',
    playlist: item.playlist || ''
  };
}

export function extractAllCollectionsTags() {
  const collectionsTree = {
    category: new Set(),
    collection: new Set(),
    playlist: new Set()
  };

  videoDatabase.forEach(item => {
    if (item.category && item.category.trim()) {
      collectionsTree.category.add(item.category.trim());
    }
    
    if (Array.isArray(item.collection)) {
      item.collection.forEach(c => {
        if (c && c.trim()) collectionsTree.collection.add(c.trim());
      });
    } else if (item.collection && item.collection.trim()) {
      collectionsTree.collection.add(item.collection.trim());
    }

    if (Array.isArray(item.playlist)) {
      item.playlist.forEach(p => {
        if (p && p.trim()) collectionsTree.playlist.add(p.trim());
      });
    } else if (item.playlist && item.playlist.trim()) {
      collectionsTree.playlist.add(item.playlist.trim());
    }
  });

  return collectionsTree;
}

export function populateCollectionsModal() {
  const container = document.getElementById('collectionsListContainer');
  if (!container) return;
  container.innerHTML = '';

  // Bloco 1: Coleções
  const colGroup = document.createElement('div');
  colGroup.className = 'collections-group';
  colGroup.innerHTML = '<div class="collections-group-title">COLEÇÕES</div>';
  
  const collectionsSet = new Set();
  videoDatabase.forEach(item => {
    const cols = Array.isArray(item.collection) ? item.collection : [item.collection];
    cols.forEach(c => { if (c && c.trim()) collectionsSet.add(c.trim()); });
  });

  if (collectionsSet.size === 0) {
    colGroup.innerHTML += '<p style="color:var(--text-muted); font-size:12px;">Nenhuma coleção cadastrada.</p>';
  } else {
    Array.from(collectionsSet).sort().forEach(val => {
      const btn = document.createElement('button');
      btn.className = 'btn-group-item';
      btn.style.width = '100%';
      btn.style.marginBottom = '4px';
      btn.textContent = val;
      btn.onclick = () => {
        window.applyCollectionShortcut('collection', val);
      };
      colGroup.appendChild(btn);
    });
  }
  container.appendChild(colGroup);

  // Bloco 2: Playlists (separadas por canais)
  const playlistGroup = document.createElement('div');
  playlistGroup.className = 'collections-group';
  playlistGroup.innerHTML = '<div class="collections-group-title">PLAYLISTS POR CANAL</div>';
  
  const channelPlaylists = new Map();
  videoDatabase.forEach(item => {
    const channel = item.channelTitle || 'Canal Desconhecido';
    const pls = Array.isArray(item.playlist) ? item.playlist : [item.playlist];
    pls.forEach(p => {
      if (p && p.trim()) {
        if (!channelPlaylists.has(channel)) channelPlaylists.set(channel, new Set());
        channelPlaylists.get(channel).add(p.trim());
      }
    });
  });

  if (channelPlaylists.size === 0) {
    playlistGroup.innerHTML += '<p style="color:var(--text-muted); font-size:12px;">Nenhuma playlist cadastrada.</p>';
  } else {
    channelPlaylists.forEach((plsSet, channelName) => {
      const chanDiv = document.createElement('div');
      chanDiv.style.marginLeft = '8px';
      chanDiv.style.marginBottom = '6px';
      chanDiv.innerHTML = `<strong style="font-size:12px; color:var(--text-secondary);">${channelName}</strong>`;
      
      Array.from(plsSet).sort().forEach(pl => {
        const btn = document.createElement('button');
        btn.className = 'btn-group-item';
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.marginTop = '2px';
        btn.textContent = pl;
        btn.onclick = () => window.applyCollectionShortcut('playlist', pl);
        chanDiv.appendChild(btn);
      });
      playlistGroup.appendChild(chanDiv);
    });
  }
  container.appendChild(playlistGroup);

  // Bloco 3: Categorias
  const catGroup = document.createElement('div');
  catGroup.className = 'collections-group';
  catGroup.innerHTML = '<div class="collections-group-title">CATEGORIAS</div>';
  
  const catSet = new Set();
  let hasNullCategory = false;
  videoDatabase.forEach(item => {
    if (item.category && item.category.trim()) {
      catSet.add(item.category.trim());
    } else {
      hasNullCategory = true;
    }
  });

  Array.from(catSet).sort().forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'btn-group-item';
    btn.style.width = '100%';
    btn.style.marginBottom = '4px';
    btn.textContent = cat;
    btn.onclick = () => window.applyCollectionShortcut('category', cat);
    catGroup.appendChild(btn);
  });

  if (hasNullCategory) {
    const btnNull = document.createElement('button');
    btnNull.className = 'btn-group-item';
    btnNull.style.width = '100%';
    btnNull.style.marginBottom = '4px';
    btnNull.textContent = 'Sem categoria';
    btnNull.onclick = () => window.applyCollectionShortcut('category', 'NULL');
    catGroup.appendChild(btnNull);
  }
  container.appendChild(catGroup);

  // Bloco 4: Marcadores
  const markGroup = document.createElement('div');
  markGroup.className = 'collections-group';
  markGroup.innerHTML = '<div class="collections-group-title">MARCADORES</div>';
  
  const markersList = [
    { label: 'Visto', val: '0' },
    { label: 'Rever', val: '5', children: [
      { label: 'Alta', val: '1' },
      { label: 'Média', val: '2' },
      { label: 'Baixa', val: '3' }
    ]},
    { label: 'Indefinidos', val: 'NULL' }
  ];

  markersList.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'btn-group-item';
    btn.style.width = '100%';
    btn.style.marginBottom = '4px';
    btn.textContent = m.label;
    btn.onclick = () => window.applyCollectionShortcut('marker', m.val);
    markGroup.appendChild(btn);

    if (m.children) {
      m.children.forEach(sub => {
        const subBtn = document.createElement('button');
        subBtn.className = 'btn-group-item';
        subBtn.style.width = 'calc(100% - 16px)';
        subBtn.style.marginLeft = '16px';
        subBtn.style.marginBottom = '4px';
        subBtn.textContent = `Prioridade: ${sub.label}`;
        subBtn.onclick = () => window.applyCollectionShortcut('marker', sub.val);
        markGroup.appendChild(subBtn);
      });
    }
  });
  container.appendChild(markGroup);
}

export function isVideoCollectionsVisible(item) {
  const hiddenNormalized = hiddenCollectionsTags.map(t => t.toLowerCase());
  
  if (item.category && hiddenNormalized.includes(`category:${item.category.trim().toLowerCase()}`)) {
    return false;
  }
  
  const collections = Array.isArray(item.collection) ? item.collection : [item.collection];
  if (collections.some(c => c && hiddenNormalized.includes(`collection:${c.trim().toLowerCase()}`))) {
    return false;
  }

  const playlists = Array.isArray(item.playlist) ? item.playlist : [item.playlist];
  if (playlists.some(p => p && hiddenNormalized.includes(`playlist:${p.trim().toLowerCase()}`))) {
    return false;
  }
  
  return true;
}