const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 8000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const reqUrl = req.url.split('?')[0];

  // API Endpoint: Direct Local Disk Auto-Saver
  if (req.method === 'POST' && reqUrl === '/api/save-to-disk') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(bodyData);
        const { targetPath, pdfBase64 } = payload;

        if (!targetPath || !pdfBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing targetPath or pdfBase64 data' }));
          return;
        }

        // Clean target directory path
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        const buffer = Buffer.from(pdfBase64, 'base64');
        fs.writeFileSync(targetPath, buffer);

        console.log(`[Auto-Save] Successfully saved PDF file to: ${targetPath}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, savedPath: targetPath }));
      } catch (err) {
        console.error('[Auto-Save Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  let reqPath = reqUrl;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Support /static/ prefix or direct file path
  let filePath = path.join(FRONTEND_DIR, reqPath.replace(/^\/static\//, '/'));

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(FRONTEND_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error: ' + err.code);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log('='.repeat(60));
  console.log(' ⚡ PDF CleanSpace - Node.js Local Web Server');
  console.log('='.repeat(60));
  console.log(` Server running at: ${url}`);
  console.log(' Direct Local Disk Saver Active: /api/save-to-disk');
  console.log(' Press Ctrl+C to stop the server.');
  console.log('='.repeat(60));

  const startCmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(startCmd, (err) => {
    if (err) {
      console.log(`Open your web browser manually at: ${url}`);
    }
  });
});
