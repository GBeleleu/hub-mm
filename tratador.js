/**
 * tratador.js - Módulo ETL de Tratamento, Deduplicação e Estruturação de Tags
 */

const fs = require('fs');
const path = require('path');

const CONFIG_TRAT = {
  ARQUIVO_BRUTO: path.join(__dirname, 'videos_bruto.json'),
  ARQUIVO_OVERRIDES: path.join(__dirname, 'overrides.json'),
  ARQUIVO_TAXONOMIA: path.join(__dirname, 'taxonomia.json'),
  ARQUIVO_FINAL: path.join(__dirname, 'database.json'),
  
  CRITERIO_A_MAX_DURACAO_DIFF: 120,
  CRITERIO_B_MAX_DURACAO_DIFF: 300,
  CRITERIO_C_MAX_DURACAO_DIFF: 120,
  JACCARD_THRESHOLD: 0.75
};

// Normalizações para uso interno do algoritmo de deduplicação (sem alterar o título original)
function normalizarBasico(texto) {
  if (!texto) return '';
  return texto.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizarFuzzy(texto) {
  if (!texto) return '';
  return texto.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extrairNumeroEpisodioOuParte(titulo) {
  if (!titulo) return null;
  const texto = normalizarFuzzy(titulo);

  const matchChave = texto.match(/\b(parte|pt|ep|episodio|cap|capitulo|video|aula|vol|volume|bloco)\s*#?\s*(\d+)\b/);
  if (matchChave && matchChave[2]) return parseInt(matchChave[2], 10);

  const matchHashtag = texto.match(/#\s*(\d+)\b/);
  if (matchHashtag && matchHashtag[1]) return parseInt(matchHashtag[1], 10);

  const matchFinal = texto.match(/(?:\s|-|_|\()\s*(\d+)\s*\)?$/);
  if (matchFinal && matchFinal[1]) return parseInt(matchFinal[1], 10);

  return null;
}

function possuemEpisodiosDiferentes(titulo1, titulo2) {
  const ep1 = extrairNumeroEpisodioOuParte(titulo1);
  const ep2 = extrairNumeroEpisodioOuParte(titulo2);
  return (ep1 !== null && ep2 !== null && ep1 !== ep2);
}

function calcularSimilaridadeJaccard(strFuzzy1, strFuzzy2) {
  const palavras1 = new Set(strFuzzy1.split(' ').filter(p => p.length > 1 || !isNaN(p)));
  const palavras2 = new Set(strFuzzy2.split(' ').filter(p => p.length > 1 || !isNaN(p)));

  if (palavras1.size === 0 || palavras2.size === 0) return 0;

  let interseccao = 0;
  palavras1.forEach(palavra => {
    if (palavras2.has(palavra)) interseccao++;
  });

  const uniao = new Set([...palavras1, ...palavras2]).size;
  return interseccao / uniao;
}

function avaliarCorrespondencia(master, candidato) {
  if (possuemEpisodiosDiferentes(master.titulo, candidato.titulo)) return null;

  const diffDuracao = Math.abs((master.duracaoSegundos || 0) - (candidato.duracaoSegundos || 0));
  const tMasterExact = normalizarBasico(master.titulo);
  const tCandidatoExact = normalizarBasico(candidato.titulo);

  const tMasterFuzzy = normalizarFuzzy(master.titulo);
  const tCandidatoFuzzy = normalizarFuzzy(candidato.titulo);

  if (tMasterExact === tCandidatoExact) {
    if (diffDuracao <= CONFIG_TRAT.CRITERIO_A_MAX_DURACAO_DIFF) {
      return "Cópia Exata (Critério A)";
    } else {
      const sim = calcularSimilaridadeJaccard(tMasterFuzzy, tCandidatoFuzzy);
      if (sim >= CONFIG_TRAT.JACCARD_THRESHOLD) {
        return `Cópia Exata - Duração Diferente (${Math.round(sim * 100)}%)`;
      }
    }
  }

  const eSubString = tMasterFuzzy.includes(tCandidatoFuzzy) || tCandidatoFuzzy.includes(tMasterFuzzy);
  const scoreJaccard = calcularSimilaridadeJaccard(tMasterFuzzy, tCandidatoFuzzy);

  if (eSubString && diffDuracao <= CONFIG_TRAT.CRITERIO_B_MAX_DURACAO_DIFF) {
    return `Reenvio/Subtítulo (${Math.round(scoreJaccard * 100)}%) (Critério B)`;
  }

  if (diffDuracao <= CONFIG_TRAT.CRITERIO_C_MAX_DURACAO_DIFF && scoreJaccard >= CONFIG_TRAT.JACCARD_THRESHOLD) {
    return `Similar Fuzzy (${Math.round(scoreJaccard * 100)}%) (Critério C)`;
  }

  return null;
}

/**
 * Função utilitária para extrair os prefixos das TAGs do taxonomia.json
 */
function parseTagsString(tagString) {
  if (!tagString || typeof tagString !== 'string') return {};

  const resultado = {};
  const segmentos = tagString.split('|').map(s => s.trim()).filter(Boolean);

  segmentos.forEach(seg => {
    if (seg.startsWith('cat:')) {
      resultado.categoria = seg.replace('cat:', '').trim();
    } else if (seg.startsWith('grupo:')) {
      resultado.grupo = seg.replace('grupo:', '').trim();
    } else if (seg.startsWith('playlist:')) {
      resultado.playlist = seg.replace('playlist:', '').trim();
    } else if (seg.includes(':')) {
      // Suporte a prefixos personalizados futuros
      const [chave, valor] = seg.split(':');
      if (chave && valor) resultado[chave.trim().toLowerCase()] = valor.trim();
    } else {
      // Caso não tenha prefixo, trata por padrão como categoria
      resultado.categoria = seg;
    }
  });

  return resultado;
}

function processarDados() {
  console.log("🚀 Iniciando Módulo de Tratamento, Deduplicação e Estruturação de Tags...");

  if (!fs.existsSync(CONFIG_TRAT.ARQUIVO_BRUTO)) {
    console.error(`❌ Arquivo bruto não encontrado em: ${CONFIG_TRAT.ARQUIVO_BRUTO}`);
    process.exit(1);
  }
  const videosBrutos = JSON.parse(fs.readFileSync(CONFIG_TRAT.ARQUIVO_BRUTO, 'utf-8'));

  const videosOrdenados = [...videosBrutos].sort(
    (a, b) => new Date(a.dataPublicacao).getTime() - new Date(b.dataPublicacao).getTime()
  );

  const mastersConfirmados = [];
  const resultadoProcessado = [];

  // 1. AUTOMASTER (Atribuição Automática)
  for (const video of videosOrdenados) {
    let item = {
      ...video,
      masterId: null,
      isMaster: false,
      tipoMaster: null
    };

    if (!video.titulo || !video.videoId) {
      item.masterId = video.videoId;
      item.isMaster = true;
      item.tipoMaster = 'Sem Título/URL Vazia';
      resultadoProcessado.push(item);
      continue;
    }

    let melhorMaster = null;
    let motivoMatch = '';

    for (const master of mastersConfirmados) {
      const motivo = avaliarCorrespondencia(master, video);
      if (motivo) {
        melhorMaster = master;
        motivoMatch = motivo;
        break;
      }
    }

    if (melhorMaster) {
      item.isMaster = false;
      item.masterId = melhorMaster.masterId;
      item.tipoMaster = `Duplicado - ${motivoMatch}`;
    } else {
      item.isMaster = true;
      item.masterId = video.videoId;
      item.tipoMaster = 'Master Original';
      mastersConfirmados.push(item);
    }

    resultadoProcessado.push(item);
  }

  // 2. OVERRIDES MANUAIS
  if (fs.existsSync(CONFIG_TRAT.ARQUIVO_OVERRIDES)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(CONFIG_TRAT.ARQUIVO_OVERRIDES, 'utf-8'));
      let overridesCount = 0;
      
      resultadoProcessado.forEach(item => {
        if (overrides[item.videoId]) {
          const masterIdForcado = overrides[item.videoId];
          item.masterId = masterIdForcado;
          item.isMaster = (item.videoId === masterIdForcado);
          item.tipoMaster = item.isMaster 
            ? "Master Original (Forçado Manualmente)" 
            : "Duplicado (Forçado Manualmente)";
          overridesCount++;
        }
      });

      if (overridesCount > 0) {
        console.log(`📋 ${overridesCount} atribuição(ões) manual(ais) aplicada(s) via overrides.json.`);
      }
    } catch (e) {
      console.warn("⚠️ Aviso: Não foi possível ler overrides.json. Mantendo deduplicação automática.");
    }
  }

  // 3. ESTRUTURAÇÃO DE TAGS/TAXONOMIA (Merge Direto)
  let taxonomiaMap = {};
  let tagsCount = 0;

  if (fs.existsSync(CONFIG_TRAT.ARQUIVO_TAXONOMIA)) {
    try {
      taxonomiaMap = JSON.parse(fs.readFileSync(CONFIG_TRAT.ARQUIVO_TAXONOMIA, 'utf-8'));
    } catch (e) {
      console.warn("⚠️ Aviso: Não foi possível ler taxonomia.json. Prosseguindo sem tags.");
    }
  }

  resultadoProcessado.forEach(item => {
    // Limpa propriedades antigas de taxonomia para garantir estado limpo
    delete item.categoria;
    delete item.grupo;
    delete item.playlist;

    // Se houver registro no taxonomia.json para este ID, injeta as propriedades diretamente
    if (taxonomiaMap[item.videoId]) {
      const dadosTags = taxonomiaMap[item.videoId];
      
      if (dadosTags.categoria) item.categoria = dadosTags.categoria;
      if (dadosTags.grupo) item.grupo = dadosTags.grupo;
      if (dadosTags.playlist) item.playlist = dadosTags.playlist;

      tagsCount++;
    }
  });

  if (tagsCount > 0) {
    console.log(`🏷️  ${tagsCount} vídeo(s) com tags estruturadas aplicadas.`);
  }

  // 4. PERSISTÊNCIA DO BANCO FINAL
  fs.writeFileSync(CONFIG_TRAT.ARQUIVO_FINAL, JSON.stringify(resultadoProcessado, null, 2), 'utf-8');

  const totalMasters = resultadoProcessado.filter(v => v.isMaster).length;
  console.log("--------------------------------------------------");
  console.log(`✅ Tratamento concluído com sucesso!`);
  console.log(`📊 Total de Vídeos: ${resultadoProcessado.length}`);
  console.log(`🌟 Masters Originais: ${totalMasters}`);
  console.log(`📁 Vídeos Duplicados/Agrupados: ${resultadoProcessado.length - totalMasters}`);
  console.log(`💾 Banco final salvo em: ${CONFIG_TRAT.ARQUIVO_FINAL}`);
  console.log("--------------------------------------------------");
}

processarDados();
