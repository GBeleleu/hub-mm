/**
 * js/taxonomy.js - Extrator e Gerenciador de Taxonomia (Consumidor Nativo)
 */
import { videoDatabase, hiddenTaxonomyTags } from './state.js';

export function parseTaxonomy(item) {
  return {
    categoria: item.categoria || '',
    grupo: item.grupo || '',
    playlist: item.playlist || ''
  };
}

export function extractAllTaxonomyTags() {
  const taxonomyTree = {
    categoria: new Set(),
    grupo: new Set(),
    playlist: new Set()
  };

  videoDatabase.forEach(item => {
    if (item.categoria) taxonomyTree.categoria.add(item.categoria.trim());
    if (item.grupo) taxonomyTree.grupo.add(item.grupo.trim());
    if (item.playlist) taxonomyTree.playlist.add(item.playlist.trim());
  });

  return taxonomyTree;
}

export function populateTaxonomyModal() {
  const container = document.getElementById('taxonomyListContainer');
  if (!container) return;
  container.innerHTML = '';

  const taxonomyTree = extractAllTaxonomyTags();
  const keys = Object.keys(taxonomyTree).filter(k => taxonomyTree[k].size > 0);

  if (keys.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Nenhuma taxonomia cadastrada na base de dados.</p>';
    return;
  }

  keys.forEach(key => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'taxonomy-group';

    const title = document.createElement('div');
    title.className = 'taxonomy-group-title';
    title.textContent = key.toUpperCase();
    groupDiv.appendChild(title);

    Array.from(taxonomyTree[key]).sort().forEach(val => {
      const tagKey = `${key}:${val}`;
      const label = document.createElement('label');
      label.className = 'taxonomy-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tagKey;
      checkbox.checked = !hiddenTaxonomyTags.includes(tagKey);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(val));
      groupDiv.appendChild(label);
    });

    container.appendChild(groupDiv);
  });
}

export function isVideoTaxonomyVisible(item) {
  if (item.categoria && hiddenTaxonomyTags.includes(`categoria:${item.categoria}`)) return false;
  if (item.grupo && hiddenTaxonomyTags.includes(`grupo:${item.grupo}`)) return false;
  if (item.playlist && hiddenTaxonomyTags.includes(`playlist:${item.playlist}`)) return false;
  return true;
}