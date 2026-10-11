const http = require('http');
const { Readable } = require('stream');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_UA = process.env.DEFAULT_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const PROXY_SECRET = (process.env.PROXY_SECRET || '').trim();
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const OUT_ROOT = path.join(__dirname, 'hls');
const jobs = new Map();

fs.mkdirSync(OUT_ROOT, { recursive: true });

function cors(res, req) {
  const origin = req.headers.origin;
  const allowOrigin = origin && ALLOWED_ORIGINS.length ? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]) : '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, X-Proxy-Secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

function requireProxyAccess(req) {
  if (!PROXY_SECRET) return true;
  const secret = req.headers['x-proxy-secret'];
  return secret === PROXY_SECRET;
}

function proxyUrl(base, target, referer, ua) {
  const abs = new URL(target, base).href;
  const q = new URLSearchParams({ url: abs });
  if (referer) q.set('referer', referer);
  if (ua) q.set('ua', ua);
  return '/proxy?' + q.toString();
}

function rewritePlaylist(text, base, referer, ua) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const l = line.trim();
      if (!l) return line;
      if (l.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (match, value) => `URI="${proxyUrl(base, value, referer, ua)}"`);
      }
      return proxyUrl(base, l, referer, ua);
    })
    .join('\n');
}

async function fetchUpstream(target, headers) {
  const response = await fetch(target, { headers, redirect: 'follow' });
  if (!response.ok && response.status >= 400) {
    const text = await response.text().catch(() => '');
    const error = new Error(text || `Upstream request failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return response;
}

async function proxyRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const target = url.searchParams.get('url');
  const referer = url.searchParams.get('referer') || '';
  const ua = url.searchParams.get('ua') || DEFAULT_UA;

  if (!target) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Missing url');
    return;
  }

  const headers = { 'User-Agent': ua };
  if (referer) headers.Referer = referer;
  if (req.headers.range) headers.Range = req.headers.range;

  try {
    const upstream = await fetchUpstream(target, headers);
    const type = upstream.headers.get('content-type') || '';
    const isPlaylist = /mpegurl/i.test(type) || /\.m3u8(\?|$)/i.test(target);

    if (isPlaylist) {
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      res.end(rewritePlaylist(text, upstream.url, referer, ua));
      return;
    }

    const out = {
      'Content-Type': type || 'application/octet-stream',
    };
    for (const key of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(key);
      if (value) out[key] = value;
    }
    res.writeHead(upstream.status, out);
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    const statusCode = Number(error.statusCode) || 502;
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Upstream error: ' + (error.message || 'Unknown upstream error'));
  }
}

function getTranscodeScriptUrl(target, mode, referer, ua) {
  const url = new URL('http://example.invalid');
  url.searchParams.set('url', target);
  url.searchParams.set('mode', mode);
  if (referer) url.searchParams.set('referer', referer);
  if (ua) url.searchParams.set('ua', ua);
  return url.search;
}

function serveTranscode(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const target = url.searchParams.get('url');
  const mode = url.searchParams.get('mode') === 'video' ? 'video' : 'audio';
  const referer = url.searchParams.get('referer') || '';
  const ua = url.searchParams.get('ua') || DEFAULT_UA;

  if (!target) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Missing url');
    return;
  }

  const id = crypto.createHash('md5').update(target).digest('hex').slice(0, 12);
  const dir = path.join(OUT_ROOT, id);

  if (!jobs.has(id)) {
    fs.mkdirSync(dir, { recursive: true });
    const args = [
      '-user_agent', ua,
      '-headers', referer ? `Referer: ${referer}\r\n` : '',
      '-i', target,
      '-c:v', mode === 'video' ? 'libx264' : 'copy',
      ...(mode === 'video' ? ['-preset', 'veryfast', '-crf', '23'] : []),
      '-c:a', 'aac', '-b:a', '128k',
      '-f', 'hls', '-hls_time', '4', '-hls_list_size', '6', '-hls_flags', 'delete_segments',
      path.join(dir, 'index.m3u8')
    ];
    const proc = spawn('ffmpeg', args.filter(Boolean), { stdio: 'ignore' });
    jobs.set(id, { proc, lastSeen: Date.now() });
    proc.on('exit', () => jobs.delete(id));
  }

  jobs.get(id).lastSeen = Date.now();
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ playlist: `/hls/${id}/index.m3u8`, id }));
}

function serveHls(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rel = url.pathname.replace(/^\/hls\//, '');
  const file = path.join(OUT_ROOT, rel);

  if (!file.startsWith(OUT_ROOT) || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const id = url.pathname.split('/')[2];
  if (jobs.has(id)) jobs.get(id).lastSeen = Date.now();
  const type = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
}

function handleStaticJson(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/working.json') return false;
  const file = path.join(__dirname, 'working.json');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'working.json not generated yet' }));
    return true;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  cors(res, req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (!requireProxyAccess(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, port: PORT }));
    return;
  }

  if (url.pathname === '/proxy') {
    await proxyRequest(req, res);
    return;
  }

  if (url.pathname === '/transcode') {
    serveTranscode(req, res);
    return;
  }

  if (url.pathname.startsWith('/hls/')) {
    serveHls(req, res);
    return;
  }

  if (handleStaticJson(req, res)) {
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.lastSeen > 60000) {
      job.proc.kill('SIGKILL');
      jobs.delete(id);
    }
  }
}, 15000);

server.listen(PORT, () => {
  console.log('Proxy running on port ' + PORT);
});
