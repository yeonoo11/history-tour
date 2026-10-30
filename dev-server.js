// 내 컴퓨터에서 Vercel 없이 사이트를 미리 보는 작은 서버입니다.
//   npm run dev  →  http://localhost:3000
// 키는 환경변수 DATA_GO_KR_KEY 로 읽어요. (같은 폴더에 .env 가 있으면 거기서도 읽어요. 단, .env 는 GitHub·zip 에 넣지 마세요!)
// 배포하면 Vercel 이 정적 파일과 api/places.js 를 똑같이 처리하고, 키는 Vercel 환경변수에서 읽어요.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// .env 를 아주 단순하게 읽어요 (이미 설정된 환경변수는 덮어쓰지 않아요).
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env 가 없으면 건너뛰어요 */ }

const handler = require('./api/places.js');

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/places') {
    const fake = {
      status(code) { res.statusCode = code; return fake; },
      setHeader(k, v) { res.setHeader(k, v); return fake; },
      json(obj) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return fake; }
    };
    try {
      await handler({ method: req.method, query: Object.fromEntries(url.searchParams) }, fake);
    } catch (e) {
      fake.status(500).json({ error: '서버 오류가 났어요.' });
    }
    return;
  }

  // 정적 파일 (폴더 밖으로 나가는 경로, 그리고 .env·서버 코드는 내려주지 않아요)
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  const blocked = /(^|[\\/])(\.env|\.git|node_modules|api|dev-server\.js|package\.json)([\\/]|$)/.test(path.relative(ROOT, file));
  if (!file.startsWith(ROOT + path.sep) || blocked) { res.statusCode = 403; return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
