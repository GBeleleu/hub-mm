/**
 * js/collections.js - Extrator e Gerenciador de Coleções (Consumidor Nativo)
 */
import { videoDatabase, hiddencollectionsTags } from './state.js';

export function parsecollections(item) {
  return {
    categoria: item.categoria || '',
    grupo: item.grupo || '',
    playlist: item.playlist || ''
  };
}

export function extractAllcollectionsTags() {
  const collectionsTree = {
    categoria: new Set(),
    grupo: new Set(),
    playlist: new Set()
  };

  videoDatabase.forEach(item => {
    if (item.categoria) collectionsTree.categoria.add(item.categoria.trim());
    if (item.grupo) collectionsTree.grupo.add(item.grupo.trim());
    if (item.playlist) collectionsTree.playlist.add(item.playlist.trim());
  });

  return collectionsTree;
}

export function populatecollectionsModal() {
  const container = document.getElementById('collectionsListContainer');
  if (!container) return;
  container.innerHTML = '';

  const collectionsTree = extractAllcollectionsTags();
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
      checkbox.checked = !hiddencollectionsTags.includes(tagKey);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(val));
      groupDiv.appendChild(label);
    });

    container.appendChild(groupDiv);
  });
}

export function isVideocollectionsVisible(item) {
  if (item.categoria && hiddencollectionsTags.includes(`categoria:${item.categoria}`)) return false;
  if (item.grupo && hiddencollectionsTags.includes(`grupo:${item.grupo}`)) return false;
  if (item.playlist && hiddencollectionsTags.includes(`playlist:${item.playlist}`)) return false;
  return true;
}
