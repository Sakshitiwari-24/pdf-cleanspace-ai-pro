const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join('/tmp', 'operator_stats.json');

function loadStats() {
  let stats = {
    totalFilesProcessed: 0,
    totalPagesProcessed: 0,
    totalBlanksRemoved: 0,
    operators: {},
    dailyStats: {},
    logs: []
  };
  if (fs.existsSync(STATS_FILE)) {
    try {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    } catch (e) {}
  }
  return stats;
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const reqUrl = (req.url || '').split('?')[0];

  if (req.method === 'GET') {
    const stats = loadStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, stats }));
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const stats = loadStats();
        const todayStr = new Date().toISOString().split('T')[0];
        const opName = payload.operatorName || 'Default Operator';

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
        op.filesProcessedToday += 1;
        op.totalFilesProcessed += 1;
        stats.totalFilesProcessed += 1;

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
        stats.dailyStats[todayStr].totalFiles += 1;

        try {
          fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
        } catch (e) {}

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, stats }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
};
