// Use global fetch (Node v18+). If it doesn't exist, show a clear error so users without network access don't get a forced install.
const fetch = global.fetch;
if (!fetch) {
  throw new Error('Global fetch is not available in this Node runtime. Please upgrade Node to v18+ or install "node-fetch" manually (npm install node-fetch).');
}

function sanitizeText(s) {
  return (s || '').toString().replace(/\s+/g, ' ').trim();
}

/**
 * Simple local "Gemini" fallback that returns text based on prompt heuristics.
 * Keeps the same response shape as the real Gemini proxy so callers don't change.
 */
function localGeminiFallback(prompt, enableSearch = false) {
  // Heuristic-based responses for a few common prompts used in the app
  try {
    const lower = prompt.toLowerCase();

    if (lower.includes('infer the primary content niche')) {
      // Try to find video titles in the prompt and pick keywords
      const titlesMatch = prompt.match(/Recent Video Titles:\n([\s\S]*)Infer the/i);
      const titlesBlob = titlesMatch ? titlesMatch[1] : '';
      const words = titlesBlob.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 3);
      const freq = {};
      words.forEach(w => { w = w.toLowerCase(); freq[w] = (freq[w] || 0) + 1; });
      const candidates = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,3);
      const niche = candidates.length ? `${candidates.join(' ')} videos` : 'General entertainment';
      return {
        candidates: [{ content: { parts: [{ text: niche }] } }]
      };
    }

    if (lower.includes('generate a single, actionable "next video idea"')) {
      // Pick a short template based on trending lines
      const sample = 'Post a short tutorial about audience-friendly hacks similar to the top video. Focus on quick, repeatable steps.';
      return { candidates: [{ content: { parts: [{ text: sample }] } } ] };
    }

    if (lower.includes('analyze why this youtube video succeeded')) {
      const bullets = '• Strong hook in first 5 seconds\n• Emotionally engaging thumbnail/title\n• Short, fast-paced edits';
      return { candidates: [{ content: { parts: [{ text: bullets }] } } ] };
    }

    // Generic fallback: echo prompt summary
    const summary = sanitizeText(prompt).slice(0, 800);
    return { candidates: [{ content: { parts: [{ text: `LocalFallback: ${summary}` }] } } ] };
  } catch (err) {
    return { candidates: [{ content: { parts: [{ text: 'Local fallback error' }] } }] };
  }
}

/**
 * Extract JSON-like object embedded in HTML by finding a variable name and balancing braces.
 */
function extractJsonFromHtml(html, varNameCandidates) {
  for (const name of varNameCandidates) {
    const idx = html.indexOf(name);
    if (idx === -1) continue;
    const start = html.indexOf('{', idx);
    if (start === -1) continue;
    let i = start;
    let depth = 0;
    while (i < html.length) {
      const ch = html[i];
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      i++;
      if (depth === 0) {
        const jsonStr = html.slice(start, i);
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          // continue to next candidate
        }
      }
    }
  }
  return null;
}

/**
 * Basic fallback for YouTube search that scrapes the public search page for video items.
 * Returns a structure similar to YouTube Data API's search response (limited fields).
 */
async function youtubeSearchFallback(query, params = {}) {
  const q = encodeURIComponent(query);
  const url = `https://www.youtube.com/results?search_query=${q}`;
  const res = await fetch(url, { timeout: 10000 });
  const html = await res.text();

  // Attempt to extract ytInitialData
  let json = extractJsonFromHtml(html, ['ytInitialData\s*=\s*', 'window\"ytInitialData\"\s*=\s*']);

  // Fallback using regex to find any JSON blob that looks right
  if (!json) {
    const match = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});/);
    if (match) {
      try { json = JSON.parse(match[1]); } catch (e) { /* ignore */ }
    }
  }

  const items = [];
  if (json) {
    try {
      const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      for (const section of contents) {
        const videos = section.itemSectionRenderer?.contents || [];
        for (const v of videos) {
          const vr = v.videoRenderer;
          if (!vr || !vr.videoId) continue;
          items.push({
            id: { videoId: vr.videoId },
            snippet: {
              title: vr.title?.runs?.map(r=>r.text).join('') || '',
              description: vr.detailedMetadataSnippets?.[0]?.snippetText || '',
              channelTitle: vr.ownerText?.runs?.[0]?.text || '',
              thumbnails: { default: { url: vr.thumbnail?.thumbnails?.[0]?.url || '' } },
              publishedAt: vr.publishedTimeText?.simpleText || ''
            }
          });
        }
      }
    } catch (e) {
      // ignore parsing errors
    }
  }

  return { items };
}

/**
 * Very small channel fallback: fetch channel page and attempt to extract name and subs
 */
async function youtubeChannelFallback(idOrHandle) {
  // Try to hit /@handle first, then /channel/<id>
  let url = idOrHandle.startsWith('UC') ? `https://www.youtube.com/channel/${idOrHandle}` : `https://www.youtube.com/${idOrHandle}`;
  try {
    const res = await fetch(url, { timeout: 10000 });
    const html = await res.text();

    const nameMatch = html.match(/<meta\s+property=\"og:title\"\s+content=\"([^\"]+)\"/i) || html.match(/<title>([^<]+)<\/title>/i);
    const subsMatch = html.match(/([0-9.,]+)\s*subscribers/i);

    const title = nameMatch ? sanitizeText(nameMatch[1]) : '';
    const subs = subsMatch ? parseInt(subsMatch[1].replace(/[,\.]/g,'')) : 0;

    return { items: [{ id: idOrHandle, snippet: { title }, statistics: { subscriberCount: String(subs) } }] };
  } catch (e) {
    return { items: [] };
  }
}

module.exports = {
  localGeminiFallback,
  youtubeSearchFallback,
  youtubeChannelFallback,
  extractJsonFromHtml
};
