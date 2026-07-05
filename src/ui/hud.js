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
    els.recommendationSummary = document.getElementById('recommendationSummary');
    els.targetWord = document.getElementById('targetWord');
    els.missingLetters = document.getElementById('missingLetters');
    els.bestRegion = document.getElementById('bestRegion');
    els.scanButton = document.getElementById('scanButton');
    els.dashButton = document.getElementById('dashButton');
    els.shotButton = document.getElementById('shotButton');
    els.scanCooldown = document.getElementById('scanCooldown');
    els.dashCooldown = document.getElementById('dashCooldown');
    els.shotCooldown = document.getElementById('shotCooldown');
    els.bossStatus = document.getElementById('bossStatus');
    els.toastStack = document.getElementById('toastStack');
    els.menuButton = document.querySelector('.menu-button');
    els.startScreen = document.getElementById('startScreen');
    els.enterGameButton = document.getElementById('enterGameButton');
    els.openGalleryButton = document.getElementById('openGalleryButton');
    els.galleryCount = document.getElementById('galleryCount');
    els.galleryModal = document.getElementById('galleryModal');
    els.closeGalleryButton = document.getElementById('closeGalleryButton');
    els.galleryGrid = document.getElementById('galleryGrid');
    els.evolutionModal = document.getElementById('evolutionModal');
    els.evolutionTitle = document.getElementById('evolutionTitle');
    els.evolutionBody = document.getElementById('evolutionBody');
    els.rewardRow = document.getElementById('rewardRow');
    els.continueButton = document.getElementById('continueButton');

    els.continueButton.addEventListener('click', function () {
      if (state.runOver) return;
      state.paused = false;
      state.reward = null;
      els.evolutionModal.classList.remove('show');
    });

    if (els.enterGameButton) {
      els.enterGameButton.addEventListener('click', function () { enterGame(state); });
    }
    if (els.openGalleryButton) {
      els.openGalleryButton.addEventListener('click', function () { openGallery(state); });
    }
    if (els.closeGalleryButton) {
      els.closeGalleryButton.addEventListener('click', function () { closeGallery(); });
    }
    if (els.menuButton) {
      els.menuButton.addEventListener('click', function () { showStartMenu(state); });
    }

    refreshGalleryCount();

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
    renderRecommendation(state);
    updateAbility(els.scanButton, ScanSkill.charge(state), state.skills.scan.cooldown <= 0);
    updateAbility(els.dashButton, DashSkill.charge(state), state.skills.dash.cooldown <= 0);
    updateAbility(els.shotButton, ShotSkill.charge(state), state.skills.shot.cooldown <= 0);
    updateCooldownLabels(state);

    state.uiDirty = false;
  }

  function enterGame(state) {
    state.started = true;
    state.paused = false;
    if (els.startScreen) els.startScreen.classList.remove('show');
    if (els.enterGameButton) els.enterGameButton.textContent = 'Resume';
  }

  function showStartMenu(state) {
    if (state.runOver || !els.startScreen) return;
    state.paused = true;
    els.startScreen.classList.add('show');
    if (els.enterGameButton) els.enterGameButton.textContent = state.started ? 'Resume' : 'Enter Game';
    refreshGalleryCount();
  }

  function openGallery(state) {
    if (!els.galleryModal) return;
    if (state.started && !state.runOver) state.paused = true;
    renderGallery();
    els.galleryModal.classList.add('show');
    els.galleryModal.setAttribute('aria-hidden', 'false');
  }

  function closeGallery() {
    if (!els.galleryModal) return;
    els.galleryModal.classList.remove('show');
    els.galleryModal.setAttribute('aria-hidden', 'true');
  }

  function refreshGalleryCount() {
    if (!els.galleryCount) return;
    var records = readGalleryRecords();
    els.galleryCount.textContent = records.length + (records.length === 1 ? ' Record' : ' Records');
  }

  function renderGallery() {
    if (!els.galleryGrid) return;
    var records = readGalleryRecords();
    els.galleryGrid.innerHTML = '';
    if (!records.length) {
      var empty = document.createElement('div');
      empty.className = 'gallery-empty';
      empty.innerHTML = '<strong>No cleared runs yet</strong><span>Final images will appear here after the fourth boss falls.</span>';
      els.galleryGrid.appendChild(empty);
      return;
    }

    records.forEach(function (record) {
      var card = document.createElement('article');
      card.className = 'gallery-item';
      var image = record.thumbnail || record.image;
      if (image) {
        var img = document.createElement('img');
        img.src = image;
        img.alt = record.title || 'Generated genome avatar';
        card.appendChild(img);
      } else {
        var placeholder = document.createElement('div');
        placeholder.className = 'gallery-placeholder';
        placeholder.textContent = 'GENE';
        card.appendChild(placeholder);
      }
      var title = document.createElement('strong');
      title.textContent = record.title || 'Cleared Genome';
      var meta = document.createElement('span');
      meta.textContent = record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'saved run';
      card.appendChild(title);
      card.appendChild(meta);
      els.galleryGrid.appendChild(card);
    });
  }

  function readGalleryRecords() {
    try {
      var records = JSON.parse(Utils.storageGet('gene-current-gallery', '[]'));
      return Array.isArray(records) ? records : [];
    } catch (error) {
      return [];
    }
  }

  function renderGenome(state) {
    var slots = els.genomeSlots;
    slots.style.setProperty('--capacity', state.genome.capacity);
    slots.innerHTML = '';
    for (var i = 0; i < state.genome.capacity; i += 1) {
      var letter = state.genome.letters[i] || '';
      var cell = document.createElement('span');
      cell.className = 'gene-slot' + (letter ? ' filled' : '');
      if (letter && GenomeSystem.isLockedIndex(state.genome, i)) {
        cell.className += ' locked';
      }
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

  function renderRecommendation(state) {
    var recommendation = state.recommendation || {};
    var target = recommendation.target;
    var missing = recommendation.missing || [];
    els.recommendationSummary.textContent = target ? 'x' + target.mult.toFixed(2) : 'route hint';
    els.targetWord.textContent = target ? target.text.toUpperCase() : 'none';
    els.missingLetters.textContent = missing.length ? missing.map(function (letter) { return letter.toUpperCase(); }).join(' ') : 'ready';
    els.bestRegion.textContent = MapSystem.describeRegion(recommendation.bestRegion);
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
    els.continueButton.textContent = state.reward.continueLabel || 'Dive On';
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
    showEvolution: showEvolution,
    refreshGalleryCount: refreshGalleryCount
  };
})();
