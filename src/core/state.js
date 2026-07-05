(function () {
  function createParticle(x, y, vx, vy, color, life, size) {
    return { x: x, y: y, vx: vx, vy: vy, color: color, life: life, maxLife: life, size: size };
  }

  function createState(canvas) {
    var config = GameConfig;
    var stored = Number(Utils.storageGet('gene-current-achievements', '0'));
    var achievementBonus = Math.min(8, Math.floor(stored / 4));

    return {
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      screen: { width: canvas.clientWidth || config.width, height: canvas.clientHeight || config.height, dpr: 1 },
      time: 0,
      dt: 0,
      paused: false,
      runOver: false,
      camera: { x: 0, y: 0 },
      input: {
        keys: {},
        pointer: { x: 0, y: 0, down: false, right: false, worldX: 0, worldY: 0 }
      },
      player: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: Math.PI / 2,
        radius: config.player.startRadius,
        basePower: config.player.basePower + achievementBonus,
        health: 1,
        invulnerable: 0,
        color: '#65e5ff',
        accent: '#64f0b6',
        visualFlags: {},
        activeSlots: ['dash', 'shot', 'scan']
      },
      genome: {
        capacity: config.initialGenomeCapacity,
        letters: [],
        lastAddedAt: 0
      },
      words: {
        found: [],
        occurrences: [],
        multiplier: 1,
        unlocked: new Set(),
        globalUnlocked: new Set(JSON.parse(Utils.storageGet('gene-current-unlocked', '[]'))),
        potentialFound: [],
        potentialOccurrences: [],
        potentialMultiplier: 1,
        lastExpressionReason: 'birth'
      },
      skills: {
        scan: { cooldown: 0, active: false, age: 0, hits: new Set() },
        dash: { cooldown: 0, active: false, age: 0, direction: { x: 0, y: 1 }, boost: 1 },
        shot: { cooldown: 0 }
      },
      enemies: [],
      bullets: [],
      particles: [],
      floatingTexts: [],
      boss: {
        depth: config.bossDepthStep,
        active: null,
        defeated: 0,
        notice: 0
      },
      reward: null,
      uiDirty: true
    };
  }

  window.GameState = {
    create: createState,
    createParticle: createParticle
  };
})();
