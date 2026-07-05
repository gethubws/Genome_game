(function () {
  var letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function dist2(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function normalize(x, y) {
    var d = Math.sqrt(x * x + y * y) || 1;
    return { x: x / d, y: y / d };
  }

  function depthAtY(y) {
    return Math.max(0, Math.floor(y * GameConfig.metersPerPixel));
  }

  function letterValue(letter) {
    var rare = { j: 2.0, k: 1.7, q: 2.4, v: 1.9, w: 1.6, x: 2.3, y: 1.5, z: 2.2 };
    return rare[letter] || 1;
  }

  function randomLetter() {
    return pick(letters);
  }

  function otherLetter(except) {
    var next = randomLetter();
    return next === except ? otherLetter(except) : next;
  }

  function formatNumber(value, digits) {
    return Number(value).toFixed(digits);
  }

  function worldToScreen(state, point) {
    return {
      x: point.x - state.camera.x + state.screen.width / 2,
      y: point.y - state.camera.y + state.screen.height / 2
    };
  }

  function screenToWorld(state, point) {
    return {
      x: point.x + state.camera.x - state.screen.width / 2,
      y: point.y + state.camera.y - state.screen.height / 2
    };
  }

  function hsl(h, s, l, a) {
    return 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a + ')';
  }

  function storageGet(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      return false;
    }
    return true;
  }

  window.Utils = {
    letters: letters,
    clamp: clamp,
    lerp: lerp,
    rand: rand,
    randInt: randInt,
    pick: pick,
    dist: dist,
    dist2: dist2,
    normalize: normalize,
    depthAtY: depthAtY,
    letterValue: letterValue,
    randomLetter: randomLetter,
    otherLetter: otherLetter,
    formatNumber: formatNumber,
    worldToScreen: worldToScreen,
    screenToWorld: screenToWorld,
    hsl: hsl,
    storageGet: storageGet,
    storageSet: storageSet
  };
})();
