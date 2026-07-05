(function () {
  window.GameConfig = {
    width: 1280,
    height: 720,
    metersPerPixel: 1 / 12,
    initialGenomeCapacity: 20,
    maxGenomeCapacity: 32,
    bossDepthStep: 300,
    player: {
      basePower: 1,
      startRadius: 21,
      moveSpeed: 205,
      friction: 0.88,
      invulnerableAfterHit: 0.8
    },
    enemies: {
      targetCount: 46,
      spawnMargin: 360,
      despawnMargin: 620,
      baseRadius: 10,
      maxRadius: 36,
      specialChance: 0.09
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
      shot: { cooldown: 0.82, speed: 560, life: 1.15, radius: 5, weaken: 0.32 }
    },
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
})();
