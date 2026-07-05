(function () {
  var els = {};

  function init(state) {
    els.depth = document.getElementById('depthValue');
    els.combat = document.getElementById('combatValue');
    els.capacity = document.getElementById('capacityValue');
    els.multiplier = document.getElementById('multiplierValue');
    els.genomeSlots = document.getElementById('genomeSlots');
    els.letterHint = document.getElementById('letterHint');
    els.wordList = document.getElementById('wordList');
    els.wordSummary = document.getElementById('wordSummary');
    els.scanButton = document.getElementById('scanButton');
    els.dashButton = document.getElementById('dashButton');
    els.shotButton = document.getElementById('shotButton');
    els.scanCooldown = document.getElementById('scanCooldown');
    els.dashCooldown = document.getElementById('dashCooldown');
    els.shotCooldown = document.getElementById('shotCooldown');
    els.bossStatus = document.getElementById('bossStatus');
    els.toastStack = document.getElementById('toastStack');
    els.evolutionModal = document.getElementById('evolutionModal');
    els.evolutionTitle = document.getElementById('evolutionTitle');
    els.evolutionBody = document.getElementById('evolutionBody');
    els.rewardRow = document.getElementById('rewardRow');
    els.continueButton = document.getElementById('continueButton');

    els.continueButton.addEventListener('click', function () {
      state.paused = false;
      state.reward = null;
      els.evolutionModal.classList.remove('show');
    });

    renderGenome(state);
    update(state, true);
  }

  function update(state, force) {
    if (!force && !state.uiDirty) {
      updateAbility(els.scanButton, ScanSkill.charge(state), state.skills.scan.cooldown <= 0);
      updateAbility(els.dashButton, DashSkill.charge(state), state.skills.dash.cooldown <= 0);
      updateAbility(els.shotButton, ShotSkill.charge(state), state.skills.shot.cooldown <= 0);
      updateCooldownLabels(state);
      return;
    }

    var depth = Utils.depthAtY(state.player.y);
    els.depth.textContent = depth + 'm';
    els.combat.textContent = CombatSystem.effectivePower(state).toFixed(1);
    els.capacity.textContent = state.genome.letters.length + ' / ' + state.genome.capacity;
    els.multiplier.textContent = 'x' + state.words.multiplier.toFixed(2);
    els.bossStatus.textContent = state.boss.active ? 'active' : state.boss.depth + 'm';
    els.letterHint.textContent = 'letter score ' + GenomeSystem.letterScore(state).toFixed(1);

    renderGenome(state);
    renderWords(state);
    updateAbility(els.scanButton, ScanSkill.charge(state), state.skills.scan.cooldown <= 0);
    updateAbility(els.dashButton, DashSkill.charge(state), state.skills.dash.cooldown <= 0);
    updateAbility(els.shotButton, ShotSkill.charge(state), state.skills.shot.cooldown <= 0);
    updateCooldownLabels(state);

    state.uiDirty = false;
  }

  function renderGenome(state) {
    var slots = els.genomeSlots;
    slots.style.setProperty('--capacity', state.genome.capacity);
    slots.innerHTML = '';
    for (var i = 0; i < state.genome.capacity; i += 1) {
      var letter = state.genome.letters[i] || '';
      var cell = document.createElement('span');
      cell.className = 'gene-slot' + (letter ? ' filled' : '');
      if (letter && i === state.genome.letters.length - 1 && state.time - state.genome.lastAddedAt < 0.4) {
        cell.className += ' new';
      }
      cell.textContent = letter.toUpperCase();
      slots.appendChild(cell);
    }
  }

  function renderWords(state) {
    els.wordList.innerHTML = '';
    if (!state.words.found.length) {
      els.wordSummary.textContent = state.words.potentialFound.length ? state.words.potentialFound.length + ' potential' : 'none yet';
      return;
    }

    els.wordSummary.textContent = state.words.found.length + ' words / ' + state.words.potentialFound.length + ' potential';
    state.words.found.slice(0, 16).forEach(function (word) {
      var chip = document.createElement('span');
      chip.className = 'word-chip ' + word.type;
      chip.innerHTML = '<span>' + word.text + '</span><span class="mult">x' + word.mult.toFixed(2) + '</span>';
      els.wordList.appendChild(chip);
    });
  }

  function updateAbility(button, charge, ready) {
    button.style.setProperty('--charge', Math.round(charge * 100) + '%');
    button.classList.toggle('ready', ready);
  }

  function updateCooldownLabels(state) {
    setCooldown(els.scanCooldown, state.skills.scan.cooldown);
    setCooldown(els.dashCooldown, state.skills.dash.cooldown);
    setCooldown(els.shotCooldown, state.skills.shot.cooldown);
  }

  function setCooldown(el, value) {
    if (!el) return;
    el.textContent = value <= 0 ? 'ready' : value.toFixed(1) + 's';
  }

  function toast(state, title, body) {
    if (!els.toastStack) return;
    var node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = '<strong>' + title + '</strong><span>' + body + '</span>';
    els.toastStack.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 3200);
  }

  function showEvolution(state) {
    if (!state.reward) return;
    els.evolutionTitle.textContent = state.reward.title;
    els.evolutionBody.textContent = state.reward.body;
    els.rewardRow.innerHTML = '';
    state.reward.pills.forEach(function (text) {
      var pill = document.createElement('span');
      pill.className = 'reward-pill';
      pill.textContent = text;
      els.rewardRow.appendChild(pill);
    });
    els.evolutionModal.classList.add('show');
  }

  window.GameUI = {
    init: init,
    update: update,
    toast: toast,
    showEvolution: showEvolution
  };
})();
