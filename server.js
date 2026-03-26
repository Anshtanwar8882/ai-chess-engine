const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

// ── Database Setup ──────────────────────────────────────
const adapter = new FileSync('db.json');
const db = low(adapter);

db.defaults({
  games: [],
  algoStats: [],
  leaderboard: []
}).write();

app.use(cors());
app.use(express.json());

// ── ROUTES ───────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Chess Engine Backend Running 🚀', version: '1.0.0' });
});

// ── 1. Save a completed game ──────────────────────────────
// POST /api/games
// Body: { winner, loser, mode, algorithm, depth, moves, duration, nodesSearched, evaluation }
app.post('/api/games', (req, res) => {
  const {
    winner,       // 'white' | 'black' | 'draw'
    loser,
    mode,         // 'pvp' | 'pva' | 'ava'
    algorithm,    // 'alphabeta' | 'minimax' | etc.
    depth,
    moves,        // total move count
    duration,     // seconds
    nodesSearched,
    evaluation,
    result        // 'checkmate' | 'stalemate' | 'resign' | 'timeout'
  } = req.body;

  if (!winner || !mode) {
    return res.status(400).json({ error: 'winner and mode are required' });
  }

  const game = {
    id: uuidv4(),
    winner,
    loser: loser || null,
    mode,
    algorithm: algorithm || 'none',
    depth: depth || 0,
    moves: moves || 0,
    duration: duration || 0,
    nodesSearched: nodesSearched || 0,
    evaluation: evaluation || 0,
    result: result || 'unknown',
    timestamp: new Date().toISOString()
  };

  db.get('games').push(game).write();

  // Update algo stats
  updateAlgoStats(algorithm, nodesSearched, duration, depth, winner);

  // Update leaderboard
  updateLeaderboard(winner, mode, algorithm);

  res.status(201).json({ message: 'Game saved', game });
});

// ── 2. Get all games ──────────────────────────────────────
// GET /api/games?limit=20&mode=pva&algorithm=alphabeta
app.get('/api/games', (req, res) => {
  const { limit = 20, mode, algorithm } = req.query;
  let games = db.get('games').value();

  if (mode) games = games.filter(g => g.mode === mode);
  if (algorithm) games = games.filter(g => g.algorithm === algorithm);

  games = games.slice(-parseInt(limit)).reverse();
  res.json({ total: games.length, games });
});

// ── 3. Get a single game ──────────────────────────────────
// GET /api/games/:id
app.get('/api/games/:id', (req, res) => {
  const game = db.get('games').find({ id: req.params.id }).value();
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

// ── 4. Save algorithm performance stat ───────────────────
// POST /api/stats
app.post('/api/stats', (req, res) => {
  const { algorithm, nodesSearched, timeTaken, depth, moveQuality } = req.body;

  if (!algorithm) return res.status(400).json({ error: 'algorithm is required' });

  const stat = {
    id: uuidv4(),
    algorithm,
    nodesSearched: nodesSearched || 0,
    timeTaken: timeTaken || 0,
    depth: depth || 0,
    moveQuality: moveQuality || 0,
    timestamp: new Date().toISOString()
  };

  db.get('algoStats').push(stat).write();
  res.status(201).json({ message: 'Stat saved', stat });
});

// ── 5. Get algorithm performance summary ─────────────────
// GET /api/stats
app.get('/api/stats', (req, res) => {
  const stats = db.get('algoStats').value();
  const summary = {};

  stats.forEach(s => {
    if (!summary[s.algorithm]) {
      summary[s.algorithm] = {
        algorithm: s.algorithm,
        totalRuns: 0,
        avgNodes: 0,
        avgTime: 0,
        avgDepth: 0,
        totalNodes: 0,
        totalTime: 0
      };
    }
    const a = summary[s.algorithm];
    a.totalRuns++;
    a.totalNodes += s.nodesSearched;
    a.totalTime += s.timeTaken;
    a.avgNodes = Math.round(a.totalNodes / a.totalRuns);
    a.avgTime = parseFloat((a.totalTime / a.totalRuns).toFixed(2));
    a.avgDepth = s.depth;
  });

  res.json({ algorithms: Object.values(summary) });
});

// ── 6. Get leaderboard ────────────────────────────────────
// GET /api/leaderboard
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = db.get('leaderboard').value();
  res.json({ leaderboard: leaderboard.sort((a, b) => b.wins - a.wins) });
});

// ── 7. Get dashboard summary ──────────────────────────────
// GET /api/dashboard
app.get('/api/dashboard', (req, res) => {
  const games = db.get('games').value();
  const total = games.length;
  const whitewins = games.filter(g => g.winner === 'white').length;
  const blackwins = games.filter(g => g.winner === 'black').length;
  const draws = games.filter(g => g.winner === 'draw').length;

  const algoWins = {};
  games.forEach(g => {
    if (!algoWins[g.algorithm]) algoWins[g.algorithm] = { wins: 0, games: 0 };
    algoWins[g.algorithm].games++;
    if (g.winner !== 'draw') algoWins[g.algorithm].wins++;
  });

  const avgMoves = total ? Math.round(games.reduce((s, g) => s + g.moves, 0) / total) : 0;
  const avgNodes = total ? Math.round(games.reduce((s, g) => s + g.nodesSearched, 0) / total) : 0;
  const recentGames = games.slice(-5).reverse();

  res.json({
    totalGames: total,
    whiteWins: whitewins,
    blackWins: blackwins,
    draws,
    avgMoves,
    avgNodesSearched: avgNodes,
    algoWinRates: algoWins,
    recentGames
  });
});

// ── 8. Clear all data ─────────────────────────────────────
// DELETE /api/reset
app.delete('/api/reset', (req, res) => {
  db.set('games', []).set('algoStats', []).set('leaderboard', []).write();
  res.json({ message: 'All data cleared' });
});

// ── Helper Functions ──────────────────────────────────────
function updateAlgoStats(algorithm, nodes, duration, depth, winner) {
  if (!algorithm || algorithm === 'none') return;
  const stat = {
    id: uuidv4(),
    algorithm,
    nodesSearched: nodes || 0,
    timeTaken: duration || 0,
    depth: depth || 0,
    timestamp: new Date().toISOString()
  };
  db.get('algoStats').push(stat).write();
}

function updateLeaderboard(winner, mode, algorithm) {
  const key = algorithm || mode;
  let entry = db.get('leaderboard').find({ name: key }).value();
  if (!entry) {
    entry = { name: key, wins: 0, games: 0 };
    db.get('leaderboard').push(entry).write();
  }
  db.get('leaderboard').find({ name: key }).assign({
    games: entry.games + 1,
    wins: winner !== 'draw' ? entry.wins + 1 : entry.wins
  }).write();
}

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n♟  Chess Engine Backend`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   DB: db.json (local file)\n`);
  console.log(`   Endpoints:`);
  console.log(`   GET    /api/dashboard`);
  console.log(`   GET    /api/games`);
  console.log(`   POST   /api/games`);
  console.log(`   GET    /api/stats`);
  console.log(`   GET    /api/leaderboard`);
  console.log(`   DELETE /api/reset\n`);
});
