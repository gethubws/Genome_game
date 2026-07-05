(function () {
  var STORAGE_KEY = 'gene-current-image-api-key';
  var SETTINGS = {
    baseUrl: 'https://zmzai.cn/v1',
    model: 'gpt-image-2'
  };

  function getApiKey() {
    return Utils.storageGet(STORAGE_KEY, '');
  }

  function hasApiKey() {
    return !!getApiKey();
  }

  function setApiKey(value) {
    var key = String(value || '').trim();
    if (!key) return clearApiKey();
    return Utils.storageSet(STORAGE_KEY, key);
  }

  function clearApiKey() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return Utils.storageSet(STORAGE_KEY, '');
    }
  }

  function maskedKey() {
    var key = getApiKey();
    if (!key) return '';
    return 'saved locally';
  }

  function generateClearImage(state) {
    if (!state.clearImage) return Promise.resolve(null);
    if (!hasApiKey()) {
      setStatus(state, 'missing-key', 'image key not saved');
      return Promise.resolve(null);
    }
    if (state.clearImage.status === 'loading') return Promise.resolve(null);

    var prompt = buildClearPrompt(state);
    var snapshot = createClearRecord(state, prompt, '');
    state.clearImage.status = 'loading';
    state.clearImage.error = '';
    state.clearImage.prompt = prompt;
    state.clearImage.image = '';
    state.clearImage.record = snapshot;
    notifyImageUI(state);

    return requestImage(prompt).then(function (image) {
      snapshot.image = image;
      snapshot.thumbnail = image;
      state.clearImage.status = 'ready';
      state.clearImage.image = image;
      state.clearImage.record = snapshot;
      notifyImageUI(state);
      return saveGalleryRecord(snapshot).then(function (saved) {
        snapshot.saved = !!saved;
        state.clearImage.record = snapshot;
        notifyImageUI(state);
        if (window.GameUI && GameUI.refreshGalleryCount) GameUI.refreshGalleryCount();
        return snapshot;
      });
    }).catch(function (error) {
      setStatus(state, 'error', error && error.message ? error.message : 'image request failed');
      return null;
    });
  }

  function buildClearPrompt(state) {
    var words = state.words.found.map(function (word) { return word.text; }).slice(0, 10);
    var genome = state.genome.letters.join('').toUpperCase();
    var traits = Object.keys(state.player.visualFlags || {}).filter(function (key) { return state.player.visualFlags[key]; });
    var power = window.CombatSystem ? CombatSystem.effectivePower(state).toFixed(1) : 'unknown';

    return [
      'Square game victory portrait for a geometric sci-fi browser game called Gene Current.',
      'Create a bright cyan radar arena avatar made from abstract letters and clean polygonal gene shapes.',
      'Avoid realistic fish, gore, text labels, logos, UI, screenshots, or photorealism.',
      'Use crisp arcade concept art, luminous teal, cyan, magenta, gold accents, dark navy negative space.',
      'Final genome letters: ' + genome + '.',
      'Expressed words: ' + (words.length ? words.join(', ') : 'none') + '.',
      'Visual traits: ' + (traits.length ? traits.join(', ') : 'base gene current') + '.',
      'Final combat power: ' + power + '.'
    ].join(' ');
  }

  function createClearRecord(state, prompt, image) {
    return {
      id: 'clear-' + Date.now().toString(36),
      title: 'Cleared Genome',
      createdAt: new Date().toISOString(),
      image: image || '',
      thumbnail: image || '',
      prompt: prompt,
      genome: state.genome.letters.join(''),
      words: state.words.found.map(function (word) { return word.text; }),
      power: window.CombatSystem ? CombatSystem.effectivePower(state) : 0
    };
  }

  function requestImage(prompt) {
    return fetch(SETTINGS.baseUrl + '/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + getApiKey()
      },
      body: JSON.stringify({
        model: SETTINGS.model,
        prompt: prompt,
        size: '1024x1024',
        n: 1
      })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          throw new Error(body.error && body.error.message ? body.error.message : 'image request failed: ' + response.status);
        }
        return parseImageResponse(body);
      });
    });
  }

  function parseImageResponse(body) {
    var first = body && body.data && body.data[0];
    if (!first && body && body.images && body.images[0]) first = body.images[0];
    if (!first) throw new Error('image response was empty');
    if (first.url) return first.url;
    if (first.b64_json) return 'data:image/png;base64,' + first.b64_json;
    if (first.image) return first.image;
    if (typeof first === 'string') return first;
    throw new Error('image response did not include an image');
  }

  function setStatus(state, status, error) {
    state.clearImage.status = status;
    state.clearImage.error = error || '';
    notifyImageUI(state);
  }

  function saveGalleryRecord(record) {
    return openGalleryDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('records', 'readwrite');
        tx.objectStore('records').put(record);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error('gallery save failed')); };
      });
    }).catch(function () {
      return saveGalleryRecordFallback(record);
    });
  }

  function loadGalleryRecords() {
    return openGalleryDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('records', 'readonly');
        var request = tx.objectStore('records').getAll();
        request.onsuccess = function () { resolve(sortRecords(request.result || [])); };
        request.onerror = function () { reject(request.error || new Error('gallery load failed')); };
      });
    }).catch(function () {
      return Promise.resolve(sortRecords(readGalleryFallback()));
    });
  }

  function openGalleryDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('indexedDB unavailable'));
        return;
      }
      var request = indexedDB.open('gene-current-gallery', 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('records')) {
          db.createObjectStore('records', { keyPath: 'id' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('gallery open failed')); };
    });
  }

  function saveGalleryRecordFallback(record) {
    var records = readGalleryFallback().filter(function (item) { return item.id !== record.id; });
    records.unshift(record);
    records = records.slice(0, 24);
    return Promise.resolve(Utils.storageSet('gene-current-gallery', JSON.stringify(records)));
  }

  function readGalleryFallback() {
    try {
      var records = JSON.parse(Utils.storageGet('gene-current-gallery', '[]'));
      return Array.isArray(records) ? records : [];
    } catch (error) {
      return [];
    }
  }

  function sortRecords(records) {
    return records.slice().sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function notifyImageUI(state) {
    if (window.GameUI && GameUI.renderClearImage) GameUI.renderClearImage(state);
  }

  window.ImageSystem = {
    settings: SETTINGS,
    getApiKey: getApiKey,
    hasApiKey: hasApiKey,
    setApiKey: setApiKey,
    clearApiKey: clearApiKey,
    maskedKey: maskedKey,
    generateClearImage: generateClearImage,
    buildClearPrompt: buildClearPrompt,
    createClearRecord: createClearRecord,
    parseImageResponse: parseImageResponse,
    saveGalleryRecord: saveGalleryRecord,
    loadGalleryRecords: loadGalleryRecords
  };
})();
