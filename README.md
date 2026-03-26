# ♟️ AI Chess Engine

An intelligent chess game using multiple AI search algorithms like Minimax and Alpha-Beta Pruning.
# Chess Engine — Backend API

Node.js + Express backend for the Chess Engine AI project.  
Stores game results, algorithm performance stats, and leaderboard data.

## Team
- Ansh Tanwar (RA2411003010626)
- Abhinav Singh (RA2411003010638)
- Akshat Sandhu (RA2411003010640)

---

## Setup

```bash
npm install
node server.js
```

Server runs on **http://localhost:3001**

---

## API Endpoints

### Dashboard
```
GET /api/dashboard
```
Returns total games, win rates, algo comparison, recent games.

---

### Games

**Save a game**
```
POST /api/games
Content-Type: application/json

{
  "winner": "white",
  "loser": "black",
  "mode": "pva",
  "algorithm": "alphabeta",
  "depth": 3,
  "moves": 42,
  "duration": 180,
  "nodesSearched": 27000,
  "evaluation": 1.5,
  "result": "checkmate"
}
```

**Get all games**
```
GET /api/games
GET /api/games?mode=pva
GET /api/games?algorithm=alphabeta
GET /api/games?limit=10
```

**Get single game**
```
GET /api/games/:id
```

---

### Algorithm Stats

**Get performance summary**
```
GET /api/stats
```
Returns average nodes searched, time taken per algorithm.

---

### Leaderboard
```
GET /api/leaderboard
```

---

### Reset Data
```
DELETE /api/reset
```

---

## Database
Uses `lowdb` — stores everything in `db.json` locally. No external DB needed.

## How to connect to the chess frontend
Add this JS snippet to `chess_game.html` after a game ends:

```javascript
async function saveGameToBackend(data) {
  await fetch('http://localhost:3001/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}
```

Call `saveGameToBackend()` inside the `endGame()` function.
