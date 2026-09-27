// Power-on sound for the TV intro, synthesized on the spot (no audio files).
// Call it from inside the press handler: browsers only allow audio after a
// user gesture, which is the reason the gate exists.
//
// hiss: { in, full, fade, out } seconds from the press (crtTimeline HISS), or
// omit for just the relay thunk and degauss hum (reduced motion).

const MASTER = 0.2;

function closeLater(ctx, seconds) {
  setTimeout(() => {
    try {
      const p = ctx.close();
      if (p && p.catch) p.catch(() => {});
    } catch {
      // already closed
    }
  }, seconds * 1000);
}

export function playPowerOn({ hiss } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let ctx;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  if (ctx.resume) ctx.resume();

  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = MASTER;
  out.connect(ctx.destination);

  // Relay thunk: a short sine dropping in pitch.
  const thunk = ctx.createOscillator();
  thunk.frequency.setValueAtTime(110, now);
  thunk.frequency.exponentialRampToValueAtTime(40, now + 0.18);
  const thunkGain = ctx.createGain();
  thunkGain.gain.setValueAtTime(0.0001, now);
  thunkGain.gain.exponentialRampToValueAtTime(1, now + 0.006);
  thunkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  thunk.connect(thunkGain).connect(out);
  thunk.start(now);
  thunk.stop(now + 0.32);

  // Degauss hum: a mains buzz that swells and dies (audible on laptop speakers,
  // where the thunk alone is too low to hear).
  const hum = ctx.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 60;
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 400;
  const humGain = ctx.createGain();
  humGain.gain.setValueAtTime(0.0001, now);
  humGain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
  humGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  hum.connect(humFilter).connect(humGain).connect(out);
  hum.start(now);
  hum.stop(now + 0.75);

  let end = 0.8;
  if (hiss) {
    const len = Math.ceil(ctx.sampleRate * hiss.out);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.setValueAtTime(0, now + hiss.in);
    g.gain.linearRampToValueAtTime(0.28, now + hiss.full);
    g.gain.setValueAtTime(0.28, now + hiss.fade);
    g.gain.linearRampToValueAtTime(0, now + hiss.out);
    noise.connect(hp).connect(g).connect(out);
    noise.start(now);
    noise.stop(now + hiss.out);
    end = Math.max(end, hiss.out);
  }

  closeLater(ctx, end + 0.3);
}
