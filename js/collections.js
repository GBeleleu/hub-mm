/**
 * js/collections.js - Extrator e Gerenciador de Coleções (Consumidor Nativo)
 */
import { videoDatabase, hiddenCollectionsTags } from './state.js';

export function parseCollections(item) {
  return {
    category: item.category || '',
    grupo: item.grupo || '',
    playlist: item.playlist || ''
  };
}

export function extractAllCollectionsTags() {
  const collectionsTree = {
    category: new Set(),
    grupo: new Set(),
    playlist: new Set()
  };

  videoDatabase.forEach(item => {
    if (item.category) collectionsTree.category.add(item.category.trim());
    if (item.grupo) collectionsTree.grupo.add(item.grupo.trim());
    if (item.playlist) collectionsTree.playlist.add(item.playlist.trim());
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
      const tagKey = `${key}:${val}`;
      const label = document.createElement('label');
      label.className = 'collections-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tagKey;
      checkbox.checked = !hiddenCollectionsTags.includes(tagKey);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(val));
      groupDiv.appendChild(label);
    });

    container.appendChild(groupDiv);
  });
}

export function isVideoCollectionsVisible(item) {
  if (item.category && hiddenCollectionsTags.includes(`category:${item.category}`)) return false;
  if (item.grupo && hiddenCollectionsTags.includes(`grupo:${item.grupo}`)) return false;
  if (item.playlist && hiddenCollectionsTags.includes(`playlist:${item.playlist}`)) return false;
  return true;
}
