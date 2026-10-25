/**
 * js/collections.js - Extrator e Gerenciador de Coleções (Consumidor Nativo)
 */
import { videoDatabase, hiddenCollectionsTags } from './state.js';

export function parseCollections(item) {
  // Trata collection (pode ser string ou array)
  let colFormatted = '';
  if (Array.isArray(item.collection)) {
    colFormatted = item.collection.join(', ');
  } else if (item.collection) {
    colFormatted = item.collection.trim();
  }

  // Trata playlist (pode ser string ou array)
  let playFormatted = '';
  if (Array.isArray(item.playlist)) {
    playFormatted = item.playlist.join(', ');
  } else if (item.playlist) {
    playFormatted = item.playlist.trim();
  }

  return {
    category: item.category ? item.category.trim() : '',
    collection: colFormatted,
    playlist: playFormatted
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

  const collectionsTree = extractAllCollectionsTags();
  const keys = Object.keys(collectionsTree).filter(k => collectionsTree[k].size > 0);

  if (keys.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Nenhuma coleção cadastrada na base de dados.</p>';
    return;
  }

  keys.forEach(key => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'collections-group';

    const title = document.createElement('div');
    title.className = 'collections-group-title';
    title.textContent = key.toUpperCase();
    groupDiv.appendChild(title);

    Array.from(collectionsTree[key]).sort().forEach(val => {
      const tagKey = `${key}:${val}`.toLowerCase();
      const label = document.createElement('label');
      label.className = 'collections-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tagKey;
      checkbox.checked = !hiddenCollectionsTags.map(t => t.toLowerCase()).includes(tagKey);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(val));
      groupDiv.appendChild(label);
    });

    container.appendChild(groupDiv);
  });
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