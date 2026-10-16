import { videoDatabase, hiddenTaxonomyTags } from './state.js';

export function parseTaxonomy(taxonomyStr) {
  const result = { categoria: '', grupo: '', tags: [] };
  if (!taxonomyStr) return result;

  const parts = taxonomyStr.split('|').map(s => s.trim());
  parts.forEach(part => {
    if (part.startsWith('cat:')) {
      result.categoria = part.replace('cat:', '').trim();
    } else if (part.startsWith('grupo:')) {
      result.grupo = part.replace('grupo:', '').trim();
    } else if (part.includes(':')) {
      result.tags.push(part);
    } else {
      if (!result.categoria) result.categoria = part;
    }
  });

  return result;
}

export function extractAllTaxonomyTags() {
  const taxonomyTree = {};

  videoDatabase.forEach(item => {
    const rawTax = item.taxonomia || item.categoria;
    if (!rawTax) return;

    const parts = rawTax.split('|').map(s => s.trim());
    parts.forEach(part => {
      if (part.includes(':')) {
        const [prefix, value] = part.split(':').map(s => s.trim());
        if (prefix && value) {
          if (!taxonomyTree[prefix]) taxonomyTree[prefix] = new Set();
          taxonomyTree[prefix].add(value);
        }
      } else {
        if (!taxonomyTree['cat']) taxonomyTree['cat'] = new Set();
        taxonomyTree['cat'].add(part);
      }
    });
  });

  return taxonomyTree;
}

export function populateTaxonomyModal() {
  const container = document.getElementById('taxonomyListContainer');
  if (!container) return;
  container.innerHTML = '';

  const taxonomyTree = extractAllTaxonomyTags();
  const prefixes = Object.keys(taxonomyTree).sort();

  if (prefixes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Nenhuma taxonomia cadastrada na base de dados.</p>';
    return;
  }

  prefixes.forEach(prefix => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'taxonomy-group';

    const title = document.createElement('div');
    title.className = 'taxonomy-group-title';
    title.textContent = prefix;
    groupDiv.appendChild(title);

    const values = Array.from(taxonomyTree[prefix]).sort();
    values.forEach(val => {
      const tagKey = `${prefix}:${val}`;
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
  const rawTax = item.taxonomia || item.categoria;
  if (!rawTax) return true;

  const parts = rawTax.split('|').map(s => s.trim());
  for (let part of parts) {
    let tagKey = part.includes(':') ? part : `cat:${part}`;
    if (hiddenTaxonomyTags.includes(tagKey)) {
      return false;
    }
  }
  return true;
}