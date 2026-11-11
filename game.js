const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const levelLabel = document.getElementById('levelLabel');
const savedLabel = document.getElementById('savedLabel');
const targetLabel = document.getElementById('targetLabel');
const buildLabel = document.getElementById('buildLabel');
const messageBox = document.getElementById('message');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const nextBtn = document.getElementById('nextBtn');
const buildBtn = document.getElementById('buildBtn');
const removeBtn = document.getElementById('removeBtn');

const state = {
  levelIndex: 0,
  started: false,
  completed: false,
  activeTool: 'build',
  saveCount: 0,
  builds: 0,
  target: 4,
  terrain: [],
  gaps: [],
  bridges: [],
  lemmings: [],
  hatch: { x: 48, y: 404 },
  castle: { x: 820, y: 344, width: 84, height: 156 },
  lastTime: 0,
};

const LEVELS = [
  {
    name: 'Crag Crossing',
    hatch: { x: 48, y: 404 },
    castle: { x: 820, y: 330, width: 84, height: 170 },
    target: 4,
    platforms: [
      { x: 0, y: 500, width: 180, height: 44 },
      { x: 280, y: 500, width: 150, height: 44 },
      { x: 520, y: 500, width: 120, height: 44 },
      { x: 750, y: 500, width: 210, height: 44 },
    ],
    gaps: [
      { x: 180, width: 100 },
      { x: 430, width: 90 },
      { x: 640, width: 110 },
    ],
  },
  {
    name: 'Velvet Rift',
    hatch: { x: 52, y: 398 },
    castle: { x: 835, y: 320, width: 88, height: 180 },
    target: 6,
    platforms: [
      { x: 0, y: 500, width: 160, height: 44 },
      { x: 280, y: 500, width: 110, height: 44 },
      { x: 470, y: 500, width: 100, height: 44 },
      { x: 700, y: 500, width: 200, height: 44 },
    ],
    gaps: [
      { x: 160, width: 120 },
      { x: 390, width: 80 },
      { x: 570, width: 130 },
    ],
  },
  {
    name: 'Sunspire',
    hatch: { x: 52, y: 400 },
    castle: { x: 850, y: 300, width: 96, height: 200 },
    target: 8,
    platforms: [
      { x: 0, y: 500, width: 140, height: 44 },
      { x: 220, y: 500, width: 120, height: 44 },
      { x: 430, y: 500, width: 110, height: 44 },
      { x: 640, y: 500, width: 120, height: 44 },
      { x: 840, y: 500, width: 120, height: 44 },
    ],
    gaps: [
      { x: 140, width: 80 },
      { x: 340, width: 90 },
      { x: 540, width: 100 },
      { x: 760, width: 80 },
    ],
  },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setMessage(text) {
  messageBox.textContent = text;
}

function makeLemming(x, y) {
  return {
    x,
    y,
    width: 14,
    height: 16,
    vx: 0,
    vy: 0,
    direction: 1,
    color: `hsl(${180 + Math.random() * 40}, 70%, 66%)`,
    grounded: false,
    alive: true,
    saved: false,
  };
}

function getSurfaceAt(x, y) {
  const probes = [...state.terrain, ...state.bridges];
  let best = null;

  for (const platform of probes) {
    const withinX = x >= platform.x && x <= platform.x + platform.width;
    const nearTop = platform.y >= y - 3 && platform.y <= y + 12;
    if (withinX && nearTop && (!best || platform.y < best.y)) {
      best = { ...platform, y: platform.y };
    }
  }

  return best;
}

function spawnLemmings() {
  const count = state.target + 2;
  state.lemmings = [];
  for (let i = 0; i < count; i += 1) {
    state.lemmings.push(makeLemming(state.hatch.x + i * 14, state.hatch.y));
  }
}

function updateHud() {
  levelLabel.textContent = String(state.levelIndex + 1);
  savedLabel.textContent = String(state.saveCount);
  targetLabel.textContent = String(state.target);
  buildLabel.textContent = String(state.builds);
}

function loadLevel(levelIndex) {
  const level = LEVELS[levelIndex % LEVELS.length];
  state.levelIndex = levelIndex;
  state.hatch = { ...level.hatch };
  state.castle = { ...level.castle };
  state.target = level.target;
  state.terrain = level.platforms.map(platform => ({ ...platform }));
  state.gaps = level.gaps.map(gap => ({ ...gap }));
  state.bridges = [];
  state.started = false;
  state.completed = false;
  startBtn.disabled = false;
  state.saveCount = 0;
  state.builds = 0;
  spawnLemmings();
  updateHud();
  nextBtn.disabled = true;
  setMessage(`${level.name}: click a gap to build a bridge, then start the swarm.`);
}

function selectTool(tool) {
  state.activeTool = tool;
  buildBtn.classList.toggle('active', tool === 'build');
  removeBtn.classList.toggle('active', tool === 'remove');
  setMessage(tool === 'build' ? 'Build mode: click directly over a red gap to place a bridge.' : 'Remove mode: click a bridge to break it apart.');
}

function placeBridge(x, y) {
  const gap = state.gaps.find((piece) => x >= piece.x && x <= piece.x + piece.width && y >= 440 && y <= 520);
  if (!gap) {
    setMessage('Not over a gap. Build across the dark red chasm only.');
    return;
  }

  const width = gap.width + 12;
  const bridgeX = gap.x - 6;
  const bridge = {
    x: bridgeX,
    y: 500,
    width,
    height: 14,
    type: 'bridge',
  };

  const overlaps = state.bridges.some(existing => {
    const overlapX = bridge.x < existing.x + existing.width && bridge.x + bridge.width > existing.x;
    const overlapY = bridge.y < existing.y + existing.height && bridge.y + bridge.height > existing.y;
    return overlapX && overlapY;
  });
  if (overlaps) {
    setMessage('A bridge is already there. Remove it or place a new one elsewhere.');
    return;
  }

  state.bridges.push(bridge);
  state.builds += 1;
  updateHud();
  setMessage('Bridge laid. The swarm can now cross that gap.');
}

function removeBridge(x, y) {
  const index = state.bridges.findIndex((bridge) => {
    return x >= bridge.x && x <= bridge.x + bridge.width && y >= bridge.y && y <= bridge.y + bridge.height;
  });

  if (index === -1) {
    setMessage('Nothing to remove there.');
    return;
  }

  state.bridges.splice(index, 1);
  state.builds = Math.max(0, state.builds - 1);
  updateHud();
  setMessage('Bridge removed. The path is open again.');
}

function startSwarm() {
  if (state.completed) return;
  state.started = true;
  setMessage('The swarm is moving. Keep the bridge path safe.');
}

function registerSavedLemming(lemming) {
  if (lemming.saved) return;
  lemming.saved = true;
  lemming.alive = false;
  state.saveCount += 1;
  updateHud();

  if (state.saveCount >= state.target) {
    state.completed = true;
    state.started = false;
    startBtn.disabled = true;
    const finalLevel = state.levelIndex >= LEVELS.length - 1;
    nextBtn.disabled = finalLevel;
    setMessage(finalLevel
      ? `All levels cleared! ${state.saveCount} rescued.`
      : `Goal reached! ${state.saveCount} rescued. You can move to the next level.`);
  }
}

function updateLemmings() {
  if (!state.started) return;

  for (const lemming of state.lemmings) {
    if (!lemming.alive) continue;

    const support = getSurfaceAt(lemming.x + lemming.width / 2, lemming.y + lemming.height + 1);

    if (support) {
      lemming.grounded = true;
      lemming.y = support.y - lemming.height;
      lemming.vy = 0;
      const step = 1.2;
      const nextX = lemming.x + lemming.direction * step;
      const futureSupport = getSurfaceAt(nextX + lemming.width / 2, lemming.y + lemming.height + 1);

      if (nextX <= 0 || nextX + lemming.width >= canvas.width) {
        lemming.direction *= -1;
      }

      if (!futureSupport && lemming.x + lemming.width > state.castle.x - 30) {
        lemming.direction = -1;
      }

      lemming.x += lemming.direction * step;
    } else {
      lemming.grounded = false;
      lemming.x += lemming.direction * 1.2;
      lemming.vy += 0.34;
      lemming.y += lemming.vy;
    }

    const castleRect = state.castle;
    const insideCastle = lemming.x + lemming.width > castleRect.x && lemming.x < castleRect.x + castleRect.width && lemming.y + lemming.height > castleRect.y && lemming.y < castleRect.y + castleRect.height;
    if (insideCastle) {
      registerSavedLemming(lemming);
      continue;
    }

    if (lemming.y > canvas.height + 40) {
      lemming.alive = false;
    }
  }

  state.lemmings = state.lemmings.filter(lemming => lemming.alive || !lemming.saved);
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#0c1d2f');
  sky.addColorStop(1, '#071521');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 24; i += 1) {
    const x = ((i * 61) % canvas.width) + 24;
    const y = 40 + ((i * 47) % 150);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = '#1c3745';
  ctx.fillRect(0, 500, canvas.width, 44);

  for (const platform of state.terrain) {
    ctx.fillStyle = '#4d78a6';
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = '#7bb9d8';
    ctx.fillRect(platform.x, platform.y, platform.width, 6);
  }

  for (const gap of state.gaps) {
    ctx.fillStyle = 'rgba(255, 112, 88, 0.35)';
    ctx.fillRect(gap.x, 440, gap.width, 80);
  }

  for (const bridge of state.bridges) {
    ctx.fillStyle = '#e9c46a';
    ctx.fillRect(bridge.x, bridge.y, bridge.width, bridge.height);
    ctx.fillStyle = '#b2732d';
    ctx.fillRect(bridge.x + 4, bridge.y + 2, bridge.width - 8, 4);
  }

  const castle = state.castle;
  ctx.fillStyle = '#d9d3a7';
  ctx.fillRect(castle.x, castle.y, castle.width, castle.height);
  ctx.fillStyle = '#a89d72';
  ctx.fillRect(castle.x + 18, castle.y + 20, castle.width - 36, castle.height - 30);
  ctx.fillStyle = '#ffd166';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(castle.x + 10 + i * 15, castle.y - 14, 8, 12);
  }

  const hatch = state.hatch;
  ctx.fillStyle = '#6fe8ff';
  ctx.fillRect(hatch.x - 10, hatch.y - 14, 28, 32);
  ctx.fillStyle = '#dffcff';
  ctx.beginPath();
  ctx.arc(hatch.x + 4, hatch.y - 18, 15, 0, Math.PI * 2);
  ctx.fill();
}

function drawLemmings() {
  for (const lemming of state.lemmings) {
    if (!lemming.alive) continue;
    ctx.fillStyle = lemming.color;
    ctx.fillRect(lemming.x, lemming.y, lemming.width, lemming.height);
    ctx.fillStyle = '#132730';
    ctx.fillRect(lemming.x + 3, lemming.y - 2, 3, 3);
    ctx.fillRect(lemming.x + 9, lemming.y - 2, 3, 3);
  }
}

function drawUiOverlay() {
  ctx.fillStyle = 'rgba(9, 18, 26, 0.44)';
  ctx.fillRect(18, 18, 240, 42);
  ctx.fillStyle = '#ebf8ff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`Saved ${state.saveCount}/${state.target}`, 32, 44);
}

function render() {
  drawBackground();
  drawLemmings();
  drawUiOverlay();
}

function step(timestamp) {
  const delta = Math.min((timestamp - state.lastTime) / 16.67 || 1, 2);
  state.lastTime = timestamp;

  if (state.started && !state.completed) {
    for (let i = 0; i < delta; i += 1) {
      updateLemmings();
    }
  }

  render();
  requestAnimationFrame(step);
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

  if (state.activeTool === 'build') {
    placeBridge(x, y);
  } else {
    removeBridge(x, y);
  }
}

buildBtn.addEventListener('click', () => selectTool('build'));
removeBtn.addEventListener('click', () => selectTool('remove'));
startBtn.addEventListener('click', startSwarm);
resetBtn.addEventListener('click', () => loadLevel(state.levelIndex));
nextBtn.addEventListener('click', () => {
  const nextIndex = state.levelIndex + 1;
  loadLevel(nextIndex);
});
canvas.addEventListener('click', handleCanvasClick);

selectTool('build');
loadLevel(0);
requestAnimationFrame(step);
