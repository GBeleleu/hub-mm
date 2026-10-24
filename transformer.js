/**
 * transformer.js - ETL Data Treatment, Deduplication, and Collections Structuring Module
 */

const fs = require('fs');
const path = require('path');

const CONFIG_TRANSFORMER = {
  RAW_DATA_PATH: path.join(__dirname, 'raw-data.json'),
  OVERRIDES_PATH: path.join(__dirname, 'overrides.json'),
  COLLECTIONS_PATH: path.join(__dirname, 'collections.json'),
  FINAL_DB_PATH: path.join(__dirname, 'dataset.json'),
  
  CRITERION_A_MAX_DURATION_DIFF: 120,
  CRITERION_B_MAX_DURATION_DIFF: 300,
  CRITERION_C_MAX_DURATION_DIFF: 120,
  JACCARD_THRESHOLD: 0.75
};

function normalizeBasic(text) {
  if (!text) return '';
  return text.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeFuzzy(text) {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extractEpisodeOrPartNumber(title) {
  if (!title) return null;
  const text = normalizeFuzzy(title);

  const keyMatch = text.match(/\b(parte|pt|ep|episodio|cap|capitulo|video|aula|vol|volume|bloco)\s*#?\s*(\d+)\b/);
  if (keyMatch && keyMatch[2]) return parseInt(keyMatch[2], 10);

  const hashtagMatch = text.match(/#\s*(\d+)\b/);
  if (hashtagMatch && hashtagMatch[1]) return parseInt(hashtagMatch[1], 10);

  const endMatch = text.match(/(?:\s|-|_|\()\s*(\d+)\s*\)?$/);
  if (endMatch && endMatch[1]) return parseInt(endMatch[1], 10);

  return null;
}

function haveDifferentEpisodes(title1, title2) {
  const ep1 = extractEpisodeOrPartNumber(title1);
  const ep2 = extractEpisodeOrPartNumber(title2);
  return (ep1 !== null && ep2 !== null && ep1 !== ep2);
}

function calculateJaccardSimilarity(fuzzyStr1, fuzzyStr2) {
  const words1 = new Set(fuzzyStr1.split(' ').filter(word => word.length > 1 || !isNaN(word)));
  const words2 = new Set(fuzzyStr2.split(' ').filter(word => word.length > 1 || !isNaN(word)));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  words1.forEach(word => {
    if (words2.has(word)) intersection++;
  });

  const union = new Set([...words1, ...words2]).size;
  return intersection / union;
}

function evaluateCorrespondence(master, candidate) {
  if (haveDifferentEpisodes(master.title, candidate.title)) return null;

  const durationDiff = Math.abs((master.durationSeconds || 0) - (candidate.durationSeconds || 0));
  const masterExact = normalizeBasic(master.title);
  const candidateExact = normalizeBasic(candidate.title);

  const masterFuzzy = normalizeFuzzy(master.title);
  const candidateFuzzy = normalizeFuzzy(candidate.title);

  if (masterExact === candidateExact) {
    if (durationDiff <= CONFIG_TRANSFORMER.CRITERION_A_MAX_DURATION_DIFF) {
      return "Exact Copy (Criterion A)";
    } else {
      const similarity = calculateJaccardSimilarity(masterFuzzy, candidateFuzzy);
      if (similarity >= CONFIG_TRANSFORMER.JACCARD_THRESHOLD) {
        return `Exact Copy - Different Duration (${Math.round(similarity * 100)}%)`;
      }
    }
  }

  const isSubstring = masterFuzzy.includes(candidateFuzzy) || candidateFuzzy.includes(masterFuzzy);
  const jaccardScore = calculateJaccardSimilarity(masterFuzzy, candidateFuzzy);

  if (isSubstring && durationDiff <= CONFIG_TRANSFORMER.CRITERION_B_MAX_DURATION_DIFF) {
    return `Reupload/Subtitled (${Math.round(jaccardScore * 100)}%) (Criterion B)`;
  }

  if (durationDiff <= CONFIG_TRANSFORMER.CRITERION_C_MAX_DURATION_DIFF && jaccardScore >= CONFIG_TRANSFORMER.JACCARD_THRESHOLD) {
    return `Fuzzy Similar (${Math.round(jaccardScore * 100)}%) (Criterion C)`;
  }

  return null;
}

function processData() {
  console.log("🚀 Starting Data Treatment, Deduplication, and Collections Structuring Module...");

  if (!fs.existsSync(CONFIG_TRANSFORMER.RAW_DATA_PATH)) {
    console.error(`❌ Raw data file not found at: ${CONFIG_TRANSFORMER.RAW_DATA_PATH}`);
    process.exit(1);
  }
  const rawVideos = JSON.parse(fs.readFileSync(CONFIG_TRANSFORMER.RAW_DATA_PATH, 'utf-8'));

  const sortedVideos = [...rawVideos].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  const confirmedMasters = [];
  const processedResult = [];

  for (const video of sortedVideos) {
    let item = {
      ...video,
      masterId: null,
      isMaster: false,
      masterType: null
    };

    if (!video.title || !video.videoId) {
      item.masterId = video.videoId;
      item.isMaster = true;
      item.masterType = 'Empty Title/URL';
      processedResult.push(item);
      continue;
    }

    let bestMaster = null;
    let matchReason = '';

    for (const master of confirmedMasters) {
      const reason = evaluateCorrespondence(master, video);
      if (reason) {
        bestMaster = master;
        matchReason = reason;
        break;
      }
    }

    if (bestMaster) {
      item.isMaster = false;
      item.masterId = bestMaster.masterId;
      item.masterType = `Duplicate - ${matchReason}`;
    } else {
      item.isMaster = true;
      item.masterId = video.videoId;
      item.masterType = 'Original Master';
      confirmedMasters.push(item);
    }

    processedResult.push(item);
  }

  if (fs.existsSync(CONFIG_TRANSFORMER.OVERRIDES_PATH)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(CONFIG_TRANSFORMER.OVERRIDES_PATH, 'utf-8'));
      let overridesCount = 0;
      
      processedResult.forEach(item => {
        if (overrides[item.videoId]) {
          const forcedMasterId = overrides[item.videoId];
          item.masterId = forcedMasterId;
          item.isMaster = (item.videoId === forcedMasterId);
          item.masterType = item.isMaster 
            ? "Original Master (Manually Forced)" 
            : "Duplicate (Manually Forced)";
          overridesCount++;
        }
      });

      if (overridesCount > 0) {
        console.log(`📋 ${overridesCount} manual assignment(s) applied via overrides.json.`);
      }
    } catch (error) {
      console.warn("⚠️ Warning: Could not read overrides.json. Keeping automatic deduplication.");
    }
  }

  let collectionsMap = {};
  let tagsCount = 0;

  if (fs.existsSync(CONFIG_TRANSFORMER.COLLECTIONS_PATH)) {
    try {
      collectionsMap = JSON.parse(fs.readFileSync(CONFIG_TRANSFORMER.COLLECTIONS_PATH, 'utf-8'));
    } catch (error) {
      console.warn("⚠️ Warning: Could not read collections.json. Proceeding without tags.");
    }
  }

  processedResult.forEach(item => {
    delete item.category;
    delete item.collection;
    delete item.playlist;

    if (collectionsMap[item.videoId]) {
      const tagData = collectionsMap[item.videoId];
      
      if (tagData.category && tagData.category.trim()) item.category = tagData.category.trim();
      if (tagData.collection && tagData.collection.trim()) item.collection = tagData.collection.trim();
      if (tagData.playlist && tagData.playlist.trim()) item.playlist = tagData.playlist.trim();

      tagsCount++;
    }
  });

  if (tagsCount > 0) {
    console.log(`🏷️  ${tagsCount} video(s) with Collections applied.`);
  }

  fs.writeFileSync(CONFIG_TRANSFORMER.FINAL_DB_PATH, JSON.stringify(processedResult, null, 2), 'utf-8');

  const totalMasters = processedResult.filter(v => v.isMaster).length;
  console.log("--------------------------------------------------");
  console.log(`✅ Treatment completed successfully!`);
  console.log(`📊 Total Videos: ${processedResult.length}`);
  console.log(`🌟 Original Masters: ${totalMasters}`);
  console.log(`📁 Deduplicated Videos: ${processedResult.length - totalMasters}`);
  console.log(`💾 Saved to: ${CONFIG_TRANSFORMER.FINAL_DB_PATH}`);
  console.log("--------------------------------------------------");
}

processData();