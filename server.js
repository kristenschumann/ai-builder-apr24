const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DATABASE_ID;
const DIR = __dirname;
const PORT = 3000;

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  // GET /api/roadmap
  if (url === '/api/roadmap' && req.method === 'GET') {
    try {
      const result = await notion.databases.query({ database_id: DB_ID });
      const rows = result.results.map(p => ({
        id: p.id,
        name: p.properties.Name?.title?.[0]?.plain_text || '',
        status: p.properties.Status?.select?.name || 'To Build',
        priority: p.properties.Priority?.select?.name || 'Low',
        description: p.properties.Description?.rich_text?.[0]?.plain_text || '',
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(rows));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // PATCH /api/roadmap
  if (url === '/api/roadmap' && req.method === 'PATCH') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { id, status } = JSON.parse(body);
        await notion.pages.update({
          page_id: id,
          properties: { Status: { select: { name: status } } }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Static files — root → dashboard, everything else by filename
  const file = (url === '/' || url === '')
    ? path.join(DIR, 'ai-builder-dashboard.html')
    : path.join(DIR, url.replace(/^\//, ''));

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log('Server running at http://localhost:' + PORT));
