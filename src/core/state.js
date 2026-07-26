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
      tick: 0,
      started: false,
      paused: true,
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
        activeSlots: [null, null, null]
      },
      growthPower: 0,
      damageTaken: false,
      genome: {
        capacity: config.initialGenomeCapacity,
        letters: [],
        lastAddedAt: 0,
        lockedBlocks: [],
        maxLockedBlocks: config.map.maxLockedBlocks
      },
      words: {
        found: [],
        occurrences: [],
        multiplier: 1,
        logMultiplier: 0,
        multiplierDisplay: 'x1.00',
        multiplierOverflow: false,
        occurrenceCount: 0,
        occurrenceCounts: {},
        unlocked: new Set(),
        globalUnlocked: new Set(JSON.parse(Utils.storageGet('gene-current-unlocked', '[]'))),
        potentialFound: [],
        potentialOccurrences: [],
        potentialMultiplier: 1,
        potentialLogMultiplier: 0,
        potentialMultiplierDisplay: 'x1.00',
        potentialMultiplierOverflow: false,
        potentialOccurrenceCount: 0,
        potentialOccurrenceCounts: {},
        lastExpressionReason: 'birth'
      },
      skills: {
        scan: { cooldown: 0, active: false, age: 0, hits: new Set() },
        dash: { cooldown: 0, active: false, age: 0, direction: { x: 0, y: 1 }, boost: 1 },
        shot: { cooldown: 0 },
        nova: { cooldown: 0, active: false, age: 0, radius: 0 },
        guard: { cooldown: 0, active: false, age: 0, duration: 0 },
        freeze: { cooldown: 0 },
        growth: { cooldown: 0, active: false, age: 0, duration: 0, charges: 0, multiplier: 1, totalBonus: 0 },
        splice: { cooldown: 0, active: false, age: 0, duration: 0, movedCount: 0, lastSequence: '' },
        echo: { cooldown: 0, active: false, age: 0, duration: 0, multiplier: 1, boost: 1, word: '', sourceMultiplier: 1, splicePrime: null },
        corrode: { cooldown: 0, active: false, age: 0, duration: 0, target: null, weaken: 0 }
      },
      skillInventory: {
        unlocked: new Set(),
        newlyUnlocked: [],
        pendingSlots: [null, null, null]
      },
      enemies: [],
      enemyBullets: [],
      bullets: [],
      particles: [],
      shockwaves: [],
      floatingTexts: [],
      map: {
        seed: '',
        width: config.map.worldWidth,
        height: config.map.layerCount * config.map.layerHeight,
        layers: [],
        regions: [],
        walls: [],
        gates: [],
        currentLayer: 1,
        completed: false
      },
      recommendation: {
        dirty: true,
        signature: '',
        target: null,
        missing: [],
        bestRegion: null,
        tailSuggestions: [],
        nextLetters: []
      },
      clearImage: {
        status: 'idle',
        error: '',
        prompt: '',
        image: '',
        record: null
      },
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
