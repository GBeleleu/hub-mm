const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION & PARAMETERS
// ============================================================================

// API key securely loaded from GitHub Actions Secrets
const API_KEY = process.env.YOUTUBE_API_KEY || 'LOCAL_TEST_KEY';

// Monitored YouTube Channel IDs
const CHANNEL_IDS = [
  'UCE2PTK90andLevljdh4NvNQ', // CHAMADOS A DESPERTAR ! @MENSAGENSCOSMICAS
  'UCrHIKsqELr0kBV1qqLIog5Q', // MARCELO MARINS DESPERTAR DA CONSCIÊNCIA CÓSMICA ! @odespertarcosmico7
  'UCZ0p3oBqQGz3zjRyNYyIzBw'  // MARCELO MARINS E OS FILHOS DAS ESTRELAS ! @OSFILHOSDASESTRELASMDM
];

const CONFIG = {
  RAW_DATA_PATH: path.join(__dirname, 'raw-data.json')
};

// ============================================================================
// 1. UTILITY FUNCTIONS (Core)
// ============================================================================

/**
 * Converts ISO 8601 duration string (e.g., PT1H2M30S) into total seconds.
 */
function isoToSeconds(isoDuration) {
  const match = isoDuration ? isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) : null;
  if (!match) return 0;
  return (parseInt(match[1] || 0, 10) * 3600) + (parseInt(match[2] || 0, 10) * 60) + parseInt(match[3] || 0, 10);
}

/**
 * Utility: Fetches all public playlists for a channel (excluding the 'Uploads' auto-playlist)
 * and maps videoIds to their playlist titles.
 */
async function getVideoPlaylistMap(channelId) {
  const map = {};
  let pageToken = '';

  try {
    do {
      const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&maxResults=50&channelId=${channelId}&key=${API_KEY}` + (pageToken ? `&pageToken=${pageToken}` : '');
      const response = await fetch(url).then(res => res.json());

      if (!response || !response.items) break;

      for (const playlist of response.items) {
        const pId = playlist.id;
        const pTitle = playlist.snippet.title;
        
        // Skip common auto-generated or "Uploads" playlists if they appear
        if (pTitle === 'Uploads' || pTitle === 'Vídeos marcados como "Gostei"') continue;

        let itemToken = '';
        do {
          const itemUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${pId}&key=${API_KEY}` + (itemToken ? `&pageToken=${itemToken}` : '');
          const itemRes = await fetch(itemUrl).then(res => res.json());

          if (!itemRes || !itemRes.items) break;

          for (const item of itemRes.items) {
            const vId = item.snippet.resourceId.videoId;
            if (!vId) continue;
            if (!map[vId]) map[vId] = new Set();
            map[vId].add(pTitle);
          }
          itemToken = itemRes.nextPageToken || '';
        } while (itemToken);
      }
      pageToken = response.nextPageToken || '';
    } while (pageToken);
  } catch (error) {
    console.warn(`⚠️  Could not fetch playlist mapping for ${channelId}:`, error.message);
  }

  return map;
}

/**
 * Utility: Fetches detailed metadata for a batch of up to 50 video IDs.
 * API Quota Cost: 1 unit per call.
 */
async function fetchBatchDetails(videoIds, playlistMap = {}) {
  if (!videoIds || videoIds.length === 0) return [];

  const idsParam = videoIds.join(',');
  const urlDetails = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails,status&id=${idsParam}&key=${API_KEY}`;
  const response = await fetch(urlDetails).then(res => res.json());

  if (!response || !response.items) return [];

  return response.items.map(v => ({
    videoId: v.id,
    title: v.snippet.title,
    channelTitle: v.snippet.channelTitle,
    durationSeconds: isoToSeconds(v.contentDetails.duration),
    publishedAt: v.snippet.publishedAt,
    isLive: !!v.liveStreamingDetails,
    privacyStatus: v.status ? v.status.privacyStatus : 'public',
    playlist: Array.from(playlistMap[v.id] || [])
  }));
}

// ============================================================================
// 2. EXTRACTION ROUTINES
// ============================================================================

/**
 * ROUTINE 1: Full Channel Scan (Initial Load / Audit)
 * Downloads ALL videos for the configured channels.
 */
async function extractAllVideos(channelIds) {
  const allVideos = [];

  for (const channelId of channelIds) {
    console.log(`🔍 Mapping playlists for channel: ${channelId}`);
    const playlistMap = await getVideoPlaylistMap(channelId);

    const uploadsPlaylistId = channelId.startsWith('UC') ? channelId.replace('UC', 'UU') : channelId;
    let pageToken = '';

    do {
      const urlList = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsPlaylistId}&key=${API_KEY}` + (pageToken ? `&pageToken=${pageToken}` : '');
      const response = await fetch(urlList).then(res => res.json());

      if (response.error || !response.items || response.items.length === 0) break;

      const batchIds = response.items.map(item => item.snippet.resourceId.videoId).filter(Boolean);
      const batchDetails = await fetchBatchDetails(batchIds, playlistMap);
      
      allVideos.push(...batchDetails);
      pageToken = response.nextPageToken || '';
    } while (pageToken);
  }

  return allVideos;
}

/**
 * ROUTINE 2: Quick Check for New Videos (Early Exit)
 * Stops execution as soon as an already processed video ID is encountered.
 */
async function extractNewVideosOnly(channelIds, existingIdsSet) {
  const newVideosFound = [];

  for (const channelId of channelIds) {
    console.log(`🔍 Mapping playlists for channel: ${channelId}`);
    const playlistMap = await getVideoPlaylistMap(channelId);

    const uploadsPlaylistId = channelId.startsWith('UC') ? channelId.replace('UC', 'UU') : channelId;
    let pageToken = '';
    let foundExisting = false;

    do {
      const urlList = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsPlaylistId}&key=${API_KEY}` + (pageToken ? `&pageToken=${pageToken}` : '');
      const response = await fetch(urlList).then(res => res.json());

      if (response.error || !response.items || response.items.length === 0) break;

      const idsToFetch = [];
      for (const item of response.items) {
        const vId = item.snippet.resourceId.videoId;
        if (vId) {
          if (existingIdsSet.has(vId)) {
            foundExisting = true; // Early exit trigger
            break;
          } else {
            idsToFetch.push(vId);
          }
        }
      }

      if (idsToFetch.length > 0) {
        const batchDetails = await fetchBatchDetails(idsToFetch, playlistMap);
        newVideosFound.push(...batchDetails);
      }

      pageToken = response.nextPageToken || '';
      if (foundExisting) break;

    } while (pageToken);
  }

  return newVideosFound;
}

// ============================================================================
// 3. PERSISTENCE & DATA RECONCILIATION
// ============================================================================

async function saveData(data) {
  console.log(`💾 Saving ${data.length} records to local database: ${CONFIG.RAW_DATA_PATH}`);
  fs.writeFileSync(CONFIG.RAW_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function loadLocalData() {
  if (fs.existsSync(CONFIG.RAW_DATA_PATH)) {
    const content = fs.readFileSync(CONFIG.RAW_DATA_PATH, 'utf-8');
    try {
      return JSON.parse(content) || [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

/**
 * TASK 1: Full Scan & Status Reconciliation
 * Syncs current playlist state and marks deleted/unlisted videos as 'removed'.
 */
async function runFullScanTask(channelIds = CHANNEL_IDS) {
  console.log("⏰ Running: Full Scan & Data Reconciliation...");

  // Pre-map playlists for all monitored channels
  const globalPlaylistMap = {};
  for (const channelId of channelIds) {
    const channelMap = await getVideoPlaylistMap(channelId);
    Object.assign(globalPlaylistMap, channelMap);
  }

  const playlistVideos = await extractAllVideos(channelIds);
  const currentData = loadLocalData();
  const existingMap = new Map(currentData.map(v => [v.videoId, v]));

  for (const video of playlistVideos) {
    existingMap.set(video.videoId, video);
  }

  const allIds = Array.from(existingMap.keys());
  const reconciledData = [];

  for (let i = 0; i < allIds.length; i += 50) {
    const batchIds = allIds.slice(i, i + 50);
    const apiDetailsBatch = await fetchBatchDetails(batchIds, globalPlaylistMap);
    const apiMap = new Map(apiDetailsBatch.map(v => [v.videoId, v]));

    for (const id of batchIds) {
      const localVideo = existingMap.get(id);

      if (apiMap.has(id)) {
        reconciledData.push(apiMap.get(id));
      } else {
        reconciledData.push({
          ...localVideo,
          privacyStatus: 'removed'
        });
      }
    }
  }

  await saveData(reconciledData);
  console.log(`✅ Full scan completed: ${reconciledData.length} videos verified.`);
}

/**
 * TASK 2: Quick Sync for Recent Uploads
 */
async function runQuickSyncTask(channelIds = CHANNEL_IDS) {
  console.log("⏰ Running: Quick Sync Task...");
  
  const currentData = loadLocalData();
  const existingIdsSet = new Set(currentData.map(v => v.videoId));

  const newVideos = await extractNewVideosOnly(channelIds, existingIdsSet);

  if (newVideos.length > 0) {
    const updatedList = [...newVideos, ...currentData];
    await saveData(updatedList);
    console.log(`✅ Quick sync completed: ${newVideos.length} new video(s) added.`);
  } else {
    console.log("✅ Quick sync completed: No new videos found.");
  }
}

// ============================================================================
// 4. CLI EXECUTOR (ENTRY POINT)
// ============================================================================

async function main() {
  const currentData = loadLocalData();
  const isFullScanRequested = process.argv.includes('--completa') || process.argv.includes('--full');
  const isDataEmpty = currentData.length === 0;

  if (isDataEmpty) {
    console.log("⚠️  Local database empty or missing! Forcing initial full scan...");
    await runFullScanTask();
  } else if (isFullScanRequested) {
    console.log("⏰ Scheduled/Manual full scan requested...");
    await runFullScanTask();
  } else {
    await runQuickSyncTask();
  }
}

main().catch(error => {
  console.error("❌ Fatal error during pipeline execution:", error);
  process.exit(1);
});