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

  function logOnePlusExp(value) {
    if (value === Infinity) return Infinity;
    if (!isFinite(value)) return 0;
    if (value > 40) return value;
    if (value < -40) return Math.exp(value);
    return Math.log1p(Math.exp(value));
  }

  // Shared visual language: equal combat power produces equal base body size.
  // The asymptote keeps extreme expression multipliers inside the playfield.
  function powerRadiusFromLog(logPower) {
    var config = GameConfig.combat || {};
    var base = typeof config.radiusBase === 'number' ? config.radiusBase : 10;
    var maxBonus = typeof config.radiusMaxBonus === 'number' ? config.radiusMaxBonus : 52;
    var logScale = typeof config.radiusLogScale === 'number' ? Math.max(0.1, config.radiusLogScale) : 6;
    var logOnePlusPower = logOnePlusExp(logPower);
    var progress = logOnePlusPower === Infinity ? 1 : 1 - Math.exp(-Math.max(0, logOnePlusPower) / logScale);
    return base + Math.max(0, maxBonus) * progress;
  }

  function powerRadius(power) {
    var safePower = Number(power);
    if (!(safePower > 0)) return powerRadiusFromLog(-Infinity);
    return powerRadiusFromLog(isFinite(safePower) ? Math.log(safePower) : Infinity);
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
    powerRadius: powerRadius,
    powerRadiusFromLog: powerRadiusFromLog,
    worldToScreen: worldToScreen,
    screenToWorld: screenToWorld,
    hsl: hsl,
    storageGet: storageGet,
    storageSet: storageSet
  };
})();
