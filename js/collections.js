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

export function populateFilterModal() {
  const container = document.getElementById('filterListContainer');
  if (!container) return;
  container.innerHTML = '';

  // --- BOTÃO MESTRE: EXIBIR TUDO ---
  const masterDiv = document.createElement('div');
  masterDiv.style.cssText = 'padding:8px 0; border-bottom:1px solid var(--border-color); margin-bottom:12px;';
  const masterBtn = document.createElement('button');
  masterBtn.className = 'btn-group-item highlighted';
  masterBtn.style.width = '100%';
  masterBtn.textContent = 'Exibir tudo';
  masterBtn.title = 'Marca para exibir todos (exceto Canais e Removidos)';
  masterBtn.onclick = () => {
    state.customFilterState.markers = {};
    state.customFilterState.categories = {};
    state.customFilterState.channels = {};
    state.hiddenChannels = [];
    state.customFilterState.removed = false;
    state.customFilterNoticeActive = false;
    populateFilterModal();
  };
  masterDiv.appendChild(masterBtn);
  container.appendChild(masterDiv);

  // --- BLOCO 1: MARCADORES ---
  const markGroup = document.createElement('div');
  markGroup.className = 'collections-group';
  markGroup.style.marginBottom = '12px';
  markGroup.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <div class="collections-group-title" style="margin:0;">MARCADORES</div>
      <div style="font-size:11px;">
        <a href="#" id="markAllMarkers" style="color:var(--text-secondary); margin-right:8px; text-decoration:none;">Marcar todos</a>
        <a href="#" id="unmarkAllMarkers" style="color:var(--text-secondary); text-decoration:none;">Desmarcar todos</a>
      </div>
    </div>
  `;
  container.appendChild(markGroup);

  const markersDef = [
    { label: 'Visto', key: '0' },
    { label: 'Rever', key: '5' },
    { label: 'Prioridade: Alta', key: '1', indent: true },
    { label: 'Prioridade: Média', key: '2', indent: true },
    { label: 'Prioridade: Baixa', key: '3', indent: true },
    { label: 'Indefinidos (vídeos sem marcadores)', key: 'NULL' }
  ];

  markersDef.forEach(m => {
    const label = document.createElement('label');
    label.className = 'dropdown-item-checkbox';
    if (m.indent) label.style.paddingLeft = '24px';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = state.customFilterState.markers[m.key] !== false;
    chk.onchange = (e) => {
      state.customFilterState.markers[m.key] = e.target.checked;
      state.customFilterNoticeActive = true;
    };

    label.appendChild(chk);
    label.appendChild(document.createTextNode(` ${m.label}`));
    markGroup.appendChild(label);
  });

  markGroup.querySelector('#markAllMarkers').onclick = (e) => {
    e.preventDefault();
    markersDef.forEach(m => state.customFilterState.markers[m.key] = true);
    state.customFilterNoticeActive = true;
    populateFilterModal();
  };
  markGroup.querySelector('#unmarkAllMarkers').onclick = (e) => {
    e.preventDefault();
    markersDef.forEach(m => state.customFilterState.markers[m.key] = false);
    state.customFilterNoticeActive = true;
    populateFilterModal();
  };

  // --- BLOCO 2: CATEGORIAS ---
  const catGroup = document.createElement('div');
  catGroup.className = 'collections-group';
  catGroup.style.marginBottom = '12px';
  catGroup.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <div class="collections-group-title" style="margin:0;">CATEGORIAS</div>
      <div style="font-size:11px;">
        <a href="#" id="markAllCats" style="color:var(--text-secondary); margin-right:8px; text-decoration:none;">Marcar todos</a>
        <a href="#" id="unmarkAllCats" style="color:var(--text-secondary); text-decoration:none;">Desmarcar todos</a>
      </div>
    </div>
  `;
  container.appendChild(catGroup);

  const catSet = new Set();
  let hasNullCat = false;
  videoDatabase.forEach(item => {
    if (item.category && item.category.trim()) catSet.add(item.category.trim());
    else hasNullCat = true;
  });

  const allCats = Array.from(catSet).sort();
  if (hasNullCat) allCats.push('NULL');

  allCats.forEach(cat => {
    const label = document.createElement('label');
    label.className = 'dropdown-item-checkbox';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = state.customFilterState.categories[cat] !== false;
    chk.onchange = (e) => {
      state.customFilterState.categories[cat] = e.target.checked;
      state.customFilterNoticeActive = true;
    };

    const displayText = cat === 'NULL' ? 'Sem categoria' : cat;
    label.appendChild(chk);
    label.appendChild(document.createTextNode(` ${displayText}`));
    catGroup.appendChild(label);
  });

  catGroup.querySelector('#markAllCats').onclick = (e) => {
    e.preventDefault();
    allCats.forEach(c => state.customFilterState.categories[c] = true);
    state.customFilterNoticeActive = true;
    populateFilterModal();
  };
  catGroup.querySelector('#unmarkAllCats').onclick = (e) => {
    e.preventDefault();
    allCats.forEach(c => state.customFilterState.categories[c] = false);
    state.customFilterNoticeActive = true;
    populateFilterModal();
  };

  // --- BLOCO 3: CANAIS ---
  const chanGroup = document.createElement('div');
  chanGroup.className = 'collections-group';
  chanGroup.style.marginBottom = '12px';
  chanGroup.innerHTML = '<div class="collections-group-title">CANAIS</div>';
  container.appendChild(chanGroup);

  const chanSet = new Set();
  videoDatabase.forEach(item => {
    if (item.channelTitle) chanSet.add(item.channelTitle);
  });

  Array.from(chanSet).sort().forEach(chan => {
    const label = document.createElement('label');
    label.className = 'dropdown-item-checkbox';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    const isHidden = state.hiddenChannels.includes(chan) || state.customFilterState.channels[chan] === false;
    chk.checked = !isHidden;

    chk.onchange = (e) => {
      state.customFilterState.channels[chan] = e.target.checked;
      if (!e.target.checked) {
        if (!state.hiddenChannels.includes(chan)) state.hiddenChannels.push(chan);
      } else {
        state.hiddenChannels = state.hiddenChannels.filter(c => c !== chan);
      }
      state.customFilterNoticeActive = true;
    };

    label.appendChild(chk);
    label.appendChild(document.createTextNode(` ${chan}`));
    chanGroup.appendChild(label);
  });

  // --- BLOCO 4: STATUS (REMOVIDOS) ---
  const remGroup = document.createElement('div');
  remGroup.className = 'collections-group';
  remGroup.innerHTML = '<div class="collections-group-title">STATUS</div>';
  
  const remLabel = document.createElement('label');
  remLabel.className = 'dropdown-item-checkbox';
  
  const remChk = document.createElement('input');
  remChk.type = 'checkbox';
  remChk.checked = !!state.customFilterState.removed;
  remChk.onchange = (e) => {
    state.customFilterState.removed = e.target.checked;
    state.customFilterNoticeActive = true;
  };

  remLabel.appendChild(remChk);
  remLabel.appendChild(document.createTextNode(' Exibir Vídeos Removidos'));
  remGroup.appendChild(remLabel);
  container.appendChild(remGroup);
}