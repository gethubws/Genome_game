(function () {
  window.GameConfig = {
    width: 1280,
    height: 720,
    metersPerPixel: 1 / 12,
    initialGenomeCapacity: 20,
    maxGenomeCapacity: 32,
    bossDepthStep: 300,
    combat: {
      consumeSizeRatio: 0.96,
      radiusBase: 10,
      radiusMaxBonus: 52,
      radiusLogScale: 6
    },
    boss: {
      // Base power plus the average letter score of a full 20-slot genome.
      referencePower: 21,
      powerMultipliers: [2, 4, 8, 16]
    },
    player: {
      basePower: 1,
      startRadius: 21,
      moveSpeed: 205,
      friction: 0.88,
      invulnerableAfterHit: 0.8
    },
    enemies: {
      targetCount: 28,
      spawnMargin: 360,
      despawnMargin: 620,
      baseRadius: 10,
      maxRadius: 48,
      specialChance: 0.1,
      denseCoreChance: 0.075,
      layerPower: [8, 16, 29, 46],
      dangerPower: 8.5
      ,rolePower: {
        growth: [0.48, 0.72], letter: [0.68, 0.96], hunter: [1.18, 1.48], spitter: [0.96, 1.24], disruptor: [1.02, 1.3], reward: [1.8, 2.2]
      }
    },
    map: {
      layerCount: 4,
      layerHeight: 3600,
      worldWidth: 2200,
      regionCountMin: 5,
      regionCountMax: 7,
      dangerRegionsMin: 1,
      dangerRegionsMax: 2,
      wallBandThickness: 116,
      gateGapWidth: 620,
      bossRoomWidth: 860,
      bossRoomHeight: 620,
      rewardCounts: [2, 4, 8, 16],
      maxLockedBlocks: 2
    },
    skills: {
      scan: { cooldown: 4.8, duration: 0.82, radius: 350, revealTime: 2.0 },
      dash: { cooldown: 3.2, duration: 0.46, speed: 540, maxBoost: 1.85 },
      shot: { cooldown: 0.82, speed: 560, life: 1.15, radius: 5, weaken: 0.32 },
      nova: { cooldown: 6.2, radius: 255, weaken: 0.42 },
      guard: { cooldown: 8.5, duration: 2.8 },
      freeze: { cooldown: 7.2, radius: 310, duration: 3.2 },
      growth: { cooldown: 9.5, duration: 8.5, charges: 3, multiplier: 1.55 },
      splice: { cooldown: 7.6, duration: 0.5, moves: 1 },
      echo: { cooldown: 10.5, duration: 5.4, baseRepeat: 0.85 },
      corrode: { cooldown: 7.8, range: 520, weaken: 0.26, duration: 3.5 }
    },
    growth: { fishBase: 0.6, fishPerLayer: 0.35, hitLoss: 0.8 },
    camera: {
      follow: 0.08,
      lookAhead: 120
    },
    palette: {
      cyan: '#65e5ff',
      mint: '#64f0b6',
      gold: '#ffd36f',
      pink: '#ff6fa8',
      danger: '#ff7868',
      ink: '#edf8ff'
    }
  };

  function merge(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
        merge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  }

  try {
    merge(window.GameConfig, JSON.parse(localStorage.getItem('geometric-dive-balance-v1') || '{}'));
  } catch (error) {
    // Invalid local tuning data falls back to the built-in balance.
  }
})();
