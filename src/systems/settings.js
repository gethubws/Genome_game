(function () {
  var key = 'gene-current-settings-v1';
  var defaults = { language: 'zh-CN', master: 0.8, music: 0.42, sfx: 0.75, muted: false, muteBackground: true, shake: 'standard', flash: 'soft', combatText: 'full', quality: 'standard' };
  var settings = load();
  function load() { try { return Object.assign({}, defaults, JSON.parse(Utils.storageGet(key, '{}'))); } catch (e) { return Object.assign({}, defaults); } }
  function get() { return settings; }
  function set(name, value) { settings[name] = value; Utils.storageSet(key, JSON.stringify(settings)); apply(); if (window.AudioSystem) AudioSystem.sync(); }
  function reset() { settings = Object.assign({}, defaults); Utils.storageSet(key, JSON.stringify(settings)); apply(); if (window.AudioSystem) AudioSystem.sync(); }
  function apply() {
    document.body.dataset.quality = settings.quality;
    document.body.dataset.flash = settings.flash;
    document.body.dataset.combatText = settings.combatText;
    document.dispatchEvent(new CustomEvent('game-settings-changed', { detail: settings }));
  }
  function effectDensity() { return settings.quality === 'high' ? 1.25 : settings.quality === 'performance' ? 0.55 : 1; }
  window.SettingsSystem = { defaults: defaults, get: get, set: set, reset: reset, apply: apply, effectDensity: effectDensity };
})();
