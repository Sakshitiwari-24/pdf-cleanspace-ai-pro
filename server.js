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

const STATS_FILE = path.join(__dirname, 'operator_stats.json');

function rebuildDailyStatsFromLogs(stats) {
  stats.dailyStats = {};
  if (!stats.logs) return;

  stats.logs.forEach(log => {
    const dStr = log.dateStr || (log.timestamp ? log.timestamp.split('T')[0] : new Date().toISOString().split('T')[0]);
    if (!stats.dailyStats[dStr]) {
      stats.dailyStats[dStr] = {
        dateStr: dStr,
        totalFiles: 0,
        totalPages: 0,
        totalBlanks: 0,
        operators: {}
      };
    }
    const ds = stats.dailyStats[dStr];
    ds.totalFiles += 1;
    ds.totalPages += (log.pageCount || 1);
    ds.totalBlanks += (log.blanksRemoved || 0);

    const opName = log.operatorName || 'Operator';
    if (!ds.operators[opName]) {
      ds.operators[opName] = { files: 0, pages: 0, blanks: 0 };
    }
    ds.operators[opName].files += 1;
    ds.operators[opName].pages += (log.pageCount || 1);
    ds.operators[opName].blanks += (log.blanksRemoved || 0);
  });
}

function getStatsFilePath() {
  if (process.env.VERCEL) {
    return path.join('/tmp', 'operator_stats.json');
  }
  return STATS_FILE;
}

function loadOperatorStats() {
  const todayStr = new Date().toISOString().split('T')[0];
  let stats = {
    totalFilesProcessed: 0,
    totalPagesProcessed: 0,
    totalBlanksRemoved: 0,
    operators: {},
    dailyStats: {},
    logs: []
  };

  const targetPath = getStatsFilePath();
  const sourcePath = fs.existsSync(targetPath) ? targetPath : STATS_FILE;

  if (fs.existsSync(sourcePath)) {
    try {
      const data = fs.readFileSync(sourcePath, 'utf8');
      stats = JSON.parse(data);
      if (!stats.operators) stats.operators = {};
      if (!stats.logs) stats.logs = [];
      if (!stats.dailyStats) stats.dailyStats = {};
    } catch (e) {
      console.error('[Stats Error] Failed to read operator_stats.json:', e);
    }
  }

  // Rebuild dailyStats if missing or out of sync
  rebuildDailyStatsFromLogs(stats);

  // Check daily reset for operators
  let updated = false;
  for (const opKey in stats.operators) {
    const op = stats.operators[opKey];
    if (op.lastResetDate !== todayStr) {
      op.filesProcessedToday = 0;
      op.lastResetDate = todayStr;
      updated = true;
    }
  }

  if (updated) {
    try { fs.writeFileSync(targetPath, JSON.stringify(stats, null, 2)); } catch(e){}
  }

  return stats;
}

function recordProcessedFile(logData) {
  const stats = loadOperatorStats();
  const todayStr = new Date().toISOString().split('T')[0];
  const opName = (logData.operatorName || 'Default Operator').trim();
  const pageCount = parseInt(logData.pageCount || 1, 10);
  const blanksRemoved = parseInt(logData.blanksRemoved || 0, 10);

  if (!stats.operators[opName]) {
    stats.operators[opName] = {
      name: opName,
      filesProcessedToday: 0,
      totalFilesProcessed: 0,
      totalPagesProcessed: 0,
      totalBlanksRemoved: 0,
      lastActive: new Date().toISOString(),
      lastResetDate: todayStr
    };
  }

  const op = stats.operators[opName];
  if (op.lastResetDate !== todayStr) {
    op.filesProcessedToday = 0;
    op.lastResetDate = todayStr;
  }

  op.filesProcessedToday += 1;
  op.totalFilesProcessed += 1;
  op.totalPagesProcessed += pageCount;
  op.totalBlanksRemoved += blanksRemoved;
  op.lastActive = new Date().toISOString();

  stats.totalFilesProcessed += 1;
  stats.totalPagesProcessed += pageCount;
  stats.totalBlanksRemoved += blanksRemoved;

  // Maintain Date-Wise Daily Stats
  if (!stats.dailyStats) stats.dailyStats = {};
  if (!stats.dailyStats[todayStr]) {
    stats.dailyStats[todayStr] = {
      dateStr: todayStr,
      totalFiles: 0,
      totalPages: 0,
      totalBlanks: 0,
      operators: {}
    };
  }
  const ds = stats.dailyStats[todayStr];
  ds.totalFiles += 1;
  ds.totalPages += pageCount;
  ds.totalBlanks += blanksRemoved;

  if (!ds.operators[opName]) {
    ds.operators[opName] = { files: 0, pages: 0, blanks: 0 };
  }
  ds.operators[opName].files += 1;
  ds.operators[opName].pages += pageCount;
  ds.operators[opName].blanks += blanksRemoved;

  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    dateStr: todayStr,
    operatorName: opName,
    fileName: path.basename(logData.targetPath || logData.fileName || 'document.pdf'),
    targetPath: logData.targetPath || '',
    pageCount: pageCount,
    blanksRemoved: blanksRemoved,
    saveMode: logData.saveMode || 'auto'
  };

  stats.logs.unshift(logEntry);
  if (stats.logs.length > 2000) stats.logs = stats.logs.slice(0, 2000);

  try {
    fs.writeFileSync(getStatsFilePath(), JSON.stringify(stats, null, 2));
    console.log(`[Operator Stats] Recorded file save for '${opName}'. Today: ${op.filesProcessedToday}, Total: ${op.totalFilesProcessed}`);
  } catch (err) {
    console.error('[Operator Stats Error] Failed to write stats:', err.message);
  }

  return { stats, logEntry };
}

const server = http.createServer((req, res) => {
  // CORS Headers to allow requests from Vercel web app or local client
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = req.url.split('?')[0];

  // API Endpoint: GET /api/operator-stats
  if (req.method === 'GET' && reqUrl === '/api/operator-stats') {
    const stats = loadOperatorStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stats }));
    return;
  }

  // API Endpoint: POST /api/log-processed-file
  if (req.method === 'POST' && reqUrl === '/api/log-processed-file') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(bodyData);
        const { stats, logEntry } = recordProcessedFile(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, stats, logEntry }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API Endpoint: POST /api/reset-operator-stats
  if (req.method === 'POST' && reqUrl === '/api/reset-operator-stats') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(bodyData || '{}');
        const stats = loadOperatorStats();
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (payload.resetMode === 'all') {
          stats.totalFilesProcessed = 0;
          stats.totalPagesProcessed = 0;
          stats.totalBlanksRemoved = 0;
          stats.operators = {};
          stats.logs = [];
        } else if (payload.operatorName && stats.operators[payload.operatorName]) {
          stats.operators[payload.operatorName].filesProcessedToday = 0;
        } else {
          for (const opKey in stats.operators) {
            stats.operators[opKey].filesProcessedToday = 0;
            stats.operators[opKey].lastResetDate = todayStr;
          }
        }

        try { fs.writeFileSync(getStatsFilePath(), JSON.stringify(stats, null, 2)); } catch(e){}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, stats }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API Endpoint: Direct Local Disk Auto-Saver
  if (req.method === 'POST' && reqUrl === '/api/save-to-disk') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(bodyData);
        const { targetPath, pdfBase64, operatorName, pageCount, blanksRemoved } = payload;

        if (!targetPath || !pdfBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing targetPath or pdfBase64 data' }));
          return;
        }

        // Clean and normalize target directory path
        let targetPathClean = (targetPath || "").trim().replace(/^["']+|["']+$|\.lnk$/gi, '');
        targetPathClean = path.normalize(targetPathClean);
        const parentDir = path.dirname(targetPathClean);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        const buffer = Buffer.from(pdfBase64, 'base64');
        fs.writeFileSync(targetPathClean, buffer);

        console.log(`[Auto-Save] Successfully saved PDF file directly to disk: ${targetPathClean}`);
        
        let statsResult = null;
        if (operatorName) {
          statsResult = recordProcessedFile({
            operatorName,
            targetPath: targetPathClean,
            pageCount,
            blanksRemoved,
            saveMode: 'auto'
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          savedPath: targetPathClean,
          stats: statsResult ? statsResult.stats : null
        }));
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
    filePath = path.join(__dirname, reqPath.replace(/^\/static\//, '/'));
  }

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

if (require.main === module) {
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
}

module.exports = server;
