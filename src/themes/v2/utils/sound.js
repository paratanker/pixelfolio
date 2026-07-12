// All v2 audio — the background chiptune loop and interaction SFX — is
// synthesized with the Web Audio API, so there are no audio files to load,
// license, or ship. Browsers only allow an AudioContext to start after a user
// gesture; every entry point here already sits behind one (character-select
// click, keydown-driven jump, menu clicks), so the lazy ensure() below never
// runs ahead of that unlock.

const MUTED_KEY = 'pixelfolio.v2.muted'
const VOLUME_KEY = 'pixelfolio.v2.volume'

let ctx = null
let master = null // mute gate: everything routes through here
let musicGain = null
let musicTimer = null
let musicStep = 0
let nextNoteTime = 0

let muted = false
let volume = 0.6 // user-facing 0..1 level; squared into gain for a perceptual taper — starts at 3/5 bars so there's headroom to raise it
try {
  muted = localStorage.getItem(MUTED_KEY) === '1'
  const storedVolume = localStorage.getItem(VOLUME_KEY)
  if (storedVolume !== null && Number.isFinite(Number(storedVolume))) {
    volume = Math.min(1, Math.max(0, Number(storedVolume)))
  }
} catch {
  // storage blocked (private mode etc.) — default to sound on, don't persist
}

// Boost above the raw squared taper so the bars sit louder at every position
// (the limiter below catches any resulting peaks, so this can't clip).
const MASTER_BOOST = 3.5
const masterLevel = () => (muted ? 0 : volume * volume * MASTER_BOOST)

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    // Safety limiter on the way out: the mix below runs hot (near full scale
    // when SFX and music voices overlap), and this catches the peaks so they
    // squash instead of clipping into distortion.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -3
    limiter.knee.value = 3
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    limiter.connect(ctx.destination)
    master = ctx.createGain()
    master.gain.value = masterLevel()
    master.connect(limiter)
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.3
    musicGain.connect(master)
    // Silence the whole context while the tab is hidden. suspend() also freezes
    // ctx.currentTime, which stalls the music scheduler's while-loop for free.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend()
      else ctx.resume()
    })
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume()
  return ctx
}

const freqOf = (midi) => 440 * 2 ** ((midi - 69) / 12)

// One enveloped oscillator note: gain jumps to `gain` at `at`, decays to
// silence over `dur`; an optional `to` frequency makes it a pitch sweep.
function tone({ type = 'square', from, to = from, at, dur, gain, dest = master }) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + dur)
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + dur)
  osc.connect(g)
  g.connect(dest)
  osc.start(at)
  osc.stop(at + dur)
}

// One shared SFX level so no effect jumps out or gets buried. Triangle waves
// carry less energy than squares at the same peak, so they get a small boost
// to land at the same perceived loudness.
const SFX_GAIN = 0.85
const TRI_GAIN = SFX_GAIN * 1.3

const SFX = {
  move: (t) => tone({ from: 520, at: t, dur: 0.04, gain: SFX_GAIN }),
  jump: (t) => tone({ from: 240, to: 620, at: t, dur: 0.1, gain: SFX_GAIN }),
  land: (t) => tone({ type: 'triangle', from: 150, to: 55, at: t, dur: 0.08, gain: TRI_GAIN }),
  open: (t) => {
    tone({ from: 523, at: t, dur: 0.045, gain: SFX_GAIN })
    tone({ from: 784, at: t + 0.045, dur: 0.08, gain: SFX_GAIN })
  },
  close: (t) => {
    tone({ from: 784, at: t, dur: 0.045, gain: SFX_GAIN })
    tone({ from: 523, at: t + 0.045, dur: 0.08, gain: SFX_GAIN })
  },
  select: (t) => {
    tone({ from: 660, at: t, dur: 0.05, gain: SFX_GAIN })
    tone({ from: 880, at: t + 0.05, dur: 0.09, gain: SFX_GAIN })
  },
}

export function playSfx(name) {
  if (muted) return
  // Character-select hover blips can arrive before any real gesture; creating
  // the context then would start it suspended, and notes booked at a frozen
  // currentTime all burst out together on the eventual resume. Wait for a
  // click/keypress (hover never counts as user activation).
  if (!ctx && !navigator.userActivation?.isActive) return
  if (!ensure() || ctx.state !== 'running') return
  SFX[name]?.(ctx.currentTime)
}

// ---------- Background music: a two-voice A-minor loop ----------
// 32 eighth-note steps (~4.8s per loop) as MIDI numbers, 0 = rest. The bass
// (triangle) walks the root movement A–C–G–A / A–C–D–E while the lead (square,
// well under the SFX in the mix) picks out a sparse melancholic melody on top.
const STEP = 0.15 // seconds per eighth note (200 BPM)
const SCHEDULE_AHEAD = 0.3 // how far past currentTime notes get booked
const LOOKAHEAD_MS = 120 // scheduler wake interval; must stay < SCHEDULE_AHEAD

const BASS = [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 45, 0, 45, 0, 45, 0, 45, 0, 48, 0, 50, 0, 40, 0, 40, 0, 43, 0, 43, 0]
const LEAD = [69, 0, 0, 72, 0, 0, 71, 0, 67, 0, 0, 0, 64, 0, 67, 0, 69, 0, 0, 72, 0, 0, 74, 0, 76, 0, 74, 0, 72, 0, 71, 0]

function scheduleLoop() {
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    const bass = BASS[musicStep]
    const lead = LEAD[musicStep]
    // Bass plays an octave above the written pattern: A2 (110 Hz) sits below
    // what laptop speakers reproduce, so the loop was inaudible on them.
    if (bass) tone({ type: 'triangle', from: freqOf(bass + 12), at: nextNoteTime, dur: STEP * 1.8, gain: 0.3, dest: musicGain })
    if (lead) tone({ from: freqOf(lead), at: nextNoteTime, dur: STEP * 1.5, gain: 0.22, dest: musicGain })
    musicStep = (musicStep + 1) % BASS.length
    nextNoteTime += STEP
  }
}

export function startMusic() {
  if (musicTimer || !ensure()) return
  musicStep = 0
  nextNoteTime = ctx.currentTime + 0.1
  scheduleLoop()
  musicTimer = setInterval(scheduleLoop, LOOKAHEAD_MS)
}

// Short ramp instead of a hard jump so level changes never pop.
function applyMaster() {
  if (ensure()) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.02)
}

export function isMuted() {
  return muted
}

// True once the visitor has made the enable/mute choice (either path creates
// the AudioContext via ensure()) — lets the gate stay dismissed across
// character-select remounts within the same page load.
export function isAudioUnlocked() {
  return ctx !== null
}

export function toggleMuted() {
  muted = !muted
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  } catch {
    // storage blocked — the toggle still works for this visit
  }
  applyMaster()
  return muted
}

export function getVolume() {
  return volume
}

export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v))
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // storage blocked — the setting still works for this visit
  }
  applyMaster()
  return volume
}
