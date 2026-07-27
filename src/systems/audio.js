(function () {
  var context = null, master = null, music = null, sfx = null, musicTimer = null, step = 0;
  function ensure() {
    if (context) { if (context.state === 'suspended') context.resume(); return true; }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    context = new Ctx(); master = context.createGain(); music = context.createGain(); sfx = context.createGain();
    music.connect(master); sfx.connect(master); master.connect(context.destination); sync(); return true;
  }
  function sync() {
    if (!context) return;
    var v = SettingsSystem.get(), hidden = document.hidden && v.muteBackground;
    master.gain.setTargetAtTime(v.muted || hidden ? 0 : v.master, context.currentTime, 0.03);
    music.gain.setTargetAtTime(v.music, context.currentTime, 0.03); sfx.gain.setTargetAtTime(v.sfx, context.currentTime, 0.03);
  }
  function tone(freq, duration, type, volume, destination, delay) {
    if (!ensure()) return;
    var now = context.currentTime + (delay || 0), osc = context.createOscillator(), gain = context.createGain();
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(freq, now); gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.04), now + 0.025); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain); gain.connect(destination || sfx); osc.start(now); osc.stop(now + duration + 0.03);
  }
  function play(name) {
    if (!ensure()) return;
    if (name === 'consume') { tone(420, .12, 'sine', .045); tone(650, .16, 'sine', .035, sfx, .06); }
    else if (name === 'letter') { tone(720, .11, 'triangle', .04); tone(960, .15, 'triangle', .028, sfx, .07); }
    else if (name === 'hit') { tone(92, .22, 'sawtooth', .055); tone(54, .3, 'sine', .05); }
    else if (name === 'guard') { tone(390, .25, 'triangle', .04); tone(780, .32, 'sine', .025, sfx, .03); }
    else if (name === 'skill') { tone(280, .1, 'square', .025); tone(520, .2, 'triangle', .03, sfx, .05); }
    else if (name === 'boss') { tone(78, .7, 'sawtooth', .05); tone(117, .9, 'sine', .045, sfx, .18); }
    else if (name === 'collapse') { tone(160, .65, 'sawtooth', .055); tone(72, 1.1, 'sine', .06, sfx, .15); }
  }
  function musicBeat() {
    if (!context) return;
    var notes = [55, 65.41, 73.42, 49, 55, 82.41, 65.41, 55];
    tone(notes[step++ % notes.length], 2.8, 'sine', .024, music);
    if (step % 4 === 0) tone(notes[(step + 2) % notes.length] * 2, 1.6, 'triangle', .008, music, .35);
  }
  function startMusic() { if (!ensure() || musicTimer) return; musicBeat(); musicTimer = window.setInterval(musicBeat, 1700); }
  document.addEventListener('visibilitychange', sync);
  window.AudioSystem = { ensure: ensure, sync: sync, play: play, startMusic: startMusic };
})();
