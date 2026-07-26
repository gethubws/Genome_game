(function () {
  var state;
  var lastTime = performance.now();

  function boot() {
    var canvas = document.getElementById('gameCanvas');
    state = GameState.create(canvas);
    RenderSystem.resize(state);
    MapSystem.generate(state);
    seedOpeningGenome(state);
    state.player.radius = CombatSystem.visualRadius(state);
    RecommendationSystem.update(state);
    InputSystem.setup(state);
    GameUI.init(state);
    window.addEventListener('resize', function () { RenderSystem.resize(state); });
    requestAnimationFrame(loop);
  }

  function seedOpeningGenome(state) {
    'gene'.split('').forEach(function (letter) {
      state.genome.letters.push(letter);
    });
    WordSystem.express(state, 'birth');
  }

  function loop(now) {
    var elapsed = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    state.dt = elapsed;
    state.tick += 1;

    if (state.started && !state.paused && !state.runOver) {
      state.time += elapsed;
      state.player.radius = CombatSystem.visualRadius(state);
      InputSystem.updatePlayerMovement(state);
      SkillSystem.updateAll(state);
      MapSystem.update(state);
      EnemySystem.update(state);
      CombatSystem.update(state);
      RecommendationSystem.update(state);
      RenderSystem.updateCamera(state);
      RenderSystem.updateEffects(state);
      maybeAddAmbientParticles(state);
    }

    RenderSystem.draw(state);
    GameUI.update(state, false);
    requestAnimationFrame(loop);
  }

  function maybeAddAmbientParticles(state) {
    var density = window.SettingsSystem ? SettingsSystem.effectDensity() : 1;
    if (state.particles.length > 180 * density) return;
    if (Math.random() > 0.55 * density) return;
    var x = state.camera.x + Utils.rand(-state.screen.width * 0.55, state.screen.width * 0.55);
    var y = state.camera.y + Utils.rand(-state.screen.height * 0.5, state.screen.height * 0.62);
    state.particles.push(GameState.createParticle(x, y, Utils.rand(-8, 8), Utils.rand(-26, -8), 'rgba(189, 243, 255, 0.72)', Utils.rand(1.2, 2.4), Utils.rand(0.8, 2.2)));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
