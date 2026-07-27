(function () {
  function setup(state) {
    window.addEventListener('keydown', function (event) {
      state.input.keys[event.key.toLowerCase()] = true;
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        SkillSystem.activateSlot(state, Number(event.key) - 1);
      }
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(event.key.toLowerCase()) !== -1) {
        event.preventDefault();
      }
    });

    window.addEventListener('keyup', function (event) {
      state.input.keys[event.key.toLowerCase()] = false;
    });

    state.canvas.addEventListener('pointermove', function (event) {
      updatePointer(state, event);
    });

    state.canvas.addEventListener('pointerdown', function (event) {
      updatePointer(state, event);
      if (event.button === 2) {
        state.input.pointer.right = true;
        SkillSystem.activate(state, 'scan');
      } else {
        state.input.pointer.down = true;
        SkillSystem.activate(state, 'shot');
      }
    });

    state.canvas.addEventListener('pointerup', function (event) {
      updatePointer(state, event);
      state.input.pointer.down = false;
      state.input.pointer.right = false;
    });

    state.canvas.addEventListener('contextmenu', function (event) {
      event.preventDefault();
    });

    [0, 1, 2].forEach(function (slot) {
      bindButton('skillSlot' + (slot + 1), function () { SkillSystem.activateSlot(state, slot); });
    });
  }

  function bindButton(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  function updatePointer(state, event) {
    var rect = state.canvas.getBoundingClientRect();
    state.input.pointer.x = event.clientX - rect.left;
    state.input.pointer.y = event.clientY - rect.top;
    var world = Utils.screenToWorld(state, state.input.pointer);
    state.input.pointer.worldX = world.x;
    state.input.pointer.worldY = world.y;
  }

  function axis(state) {
    var keys = state.input.keys;
    var x = 0;
    var y = 0;
    if (keys.a || keys.arrowleft) x -= 1;
    if (keys.d || keys.arrowright) x += 1;
    if (keys.w || keys.arrowup) y -= 1;
    if (keys.s || keys.arrowdown) y += 1;
    return Utils.normalize(x, y);
  }

  function updatePlayerMovement(state) {
    var player = state.player;
    var keys = state.input.keys;
    var vector = axis(state);
    var hasKeyboardMove = Math.abs(vector.x) + Math.abs(vector.y) > 0.01;

    if (hasKeyboardMove) {
      player.angle = Math.atan2(vector.y, vector.x);
    } else {
      var aimX = state.input.pointer.worldX - player.x;
      var aimY = state.input.pointer.worldY - player.y;
      if (Math.abs(aimX) + Math.abs(aimY) > 6) player.angle = Math.atan2(aimY, aimX);
    }

    if (keys[' '] || keys.shift) SkillSystem.activate(state, 'dash');
    if (keys.k) SkillSystem.activate(state, 'scan');
    if (keys.j) SkillSystem.activate(state, 'shot');

    var speed = GameConfig.player.moveSpeed;
    player.vx += vector.x * speed * state.dt * 6;
    player.vy += vector.y * speed * state.dt * 6;
    player.vx *= Math.pow(GameConfig.player.friction, state.dt * 60);
    player.vy *= Math.pow(GameConfig.player.friction, state.dt * 60);

    player.x += player.vx * state.dt;
    player.y += player.vy * state.dt;
    player.y = Math.max(-160, player.y);
  }

  window.InputSystem = {
    setup: setup,
    updatePlayerMovement: updatePlayerMovement
  };
})();
