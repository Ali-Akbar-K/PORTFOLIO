const fs = require('fs');

const PLAYLIST = process.env.PLAYLIST_URL || 'https://iptv-org.github.io/iptv/countries/in.m3u';
const TIMEOUT = Number(process.env.TIMEOUT || 8000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 20);

async function test(entry) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const headers = { 'User-Agent': entry.ua || 'Mozilla/5.0' };
    if (entry.referer) headers.Referer = entry.referer;
    const response = await fetch(entry.url, { headers, signal: controller.signal });
    const body = await response.text();
    return response.ok && body.trimStart().startsWith('#EXTM3U');
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const response = await fetch(PLAYLIST);
  if (!response.ok) {
    throw new Error('Could not fetch the IPTV playlist: ' + response.status);
  }

  const text = await response.text();
  const entries = [];
  let meta = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      meta = { name: line.split(',').pop().trim() };
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:http-referrer=') && meta) {
      meta.referer = line.split('=')[1];
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:http-user-agent=') && meta) {
      meta.ua = line.split('=')[1];
      continue;
    }
    if (line && !line.startsWith('#') && meta) {
      meta.url = line;
      entries.push(meta);
      meta = null;
    }
  }

  const working = [];
  for (let index = 0; index < entries.length; index += CONCURRENCY) {
    const batch = entries.slice(index, index + CONCURRENCY);
    const results = await Promise.all(batch.map(test));
    batch.forEach((entry, offset) => {
      if (results[offset]) working.push(entry);
    });
    console.log(`Checked ${Math.min(index + CONCURRENCY, entries.length)} / ${entries.length}`);
  }

  fs.writeFileSync('working.json', JSON.stringify(working, null, 2));
  console.log(`Working: ${working.length} / ${entries.length}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
