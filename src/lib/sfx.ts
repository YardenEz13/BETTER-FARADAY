/**
 * sfx — a tiny, fully-synthesized WebAudio sound module.
 *
 * No audio files: every sound is generated on the fly from oscillators and
 * noise buffers. The design brief is "subtle + electric": all cues are short
 * (<150ms), quiet (~-18dB), and non-fatiguing so they can fire on every
 * interaction without wearing thin.
 *
 * Rules of the road:
 *   - The AudioContext is created lazily, on the first sound after a user
 *     gesture (browsers block audio started without one). It is resume-safe:
 *     every call nudges a suspended context back to "running".
 *   - A global mute preference lives in localStorage (`faraday_sfx_muted`).
 *     `prefers-reduced-motion: reduce` defaults the app to muted.
 *   - Every export is a safe no-op when WebAudio is unavailable or the user
 *     is muted — call sites never need to guard.
 */

const MUTED_KEY = "faraday_sfx_muted";

/** Master gain, in linear amplitude. ~-18dB — deliberately quiet. */
const MASTER = 0.13;

/* ------------------------------------------------------------------ context */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Cached decision so we don't hit localStorage on every sound. */
let muted: boolean | null = null;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function readMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(MUTED_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    /* localStorage unavailable (private mode / disabled) — fall through */
  }
  // No stored preference: default to muted when the user asked for reduced motion.
  return prefersReducedMotion();
}

/** True when sound should not play. */
export function isMuted(): boolean {
  if (muted === null) muted = readMuted();
  return muted;
}

/** Persist and apply the mute preference. */
export function setMuted(value: boolean): void {
  muted = value;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MUTED_KEY, value ? "true" : "false");
    } catch {
      /* ignore persistence failure — the in-memory value still applies */
    }
  }
}

/**
 * Lazily create (and resume) the shared AudioContext + master gain. Returns
 * null when audio is unavailable or the user is muted, so callers can bail.
 */
function ensureContext(): { ac: AudioContext; out: GainNode } | null {
  if (isMuted() || typeof AudioContext === "undefined") return null;

  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
      return null;
    }
  }
  if (!ctx || !master) return null;

  // Autoplay policies suspend contexts created before a gesture — nudge back.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }
  return { ac: ctx, out: master };
}

/* -------------------------------------------------------------- synth utils */

/** A short burst of white noise routed through a bandpass — used for crackle. */
function noiseBurst(
  ac: AudioContext,
  out: GainNode,
  t0: number,
  { duration, freq, q, gain }: { duration: number; freq: number; q: number; gain: number },
): void {
  const frames = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = q;

  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(band).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + duration);
}

/** A single enveloped oscillator tone. */
function tone(
  ac: AudioContext,
  out: GainNode,
  t0: number,
  {
    type,
    from,
    to,
    duration,
    gain,
    detune = 0,
  }: {
    type: OscillatorType;
    from: number;
    to?: number;
    duration: number;
    gain: number;
    detune?: number;
  },
): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== undefined && to !== from) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
  }

  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/* ------------------------------------------------------------------- sounds */

/** Soft clay press — filtered noise burst + a low sine thump. (~90ms) */
export function click(): void {
  const c = ensureContext();
  if (!c) return;
  const { ac, out } = c;
  const t = ac.currentTime;
  noiseBurst(ac, out, t, { duration: 0.045, freq: 1800, q: 0.8, gain: 0.35 });
  tone(ac, out, t, { type: "sine", from: 170, to: 90, duration: 0.08, gain: 0.5 });
}

/** Correct answer — a quick rising two-tone chirp with a tiny noise crackle. (~140ms) */
export function spark(): void {
  const c = ensureContext();
  if (!c) return;
  const { ac, out } = c;
  const t = ac.currentTime;
  tone(ac, out, t, { type: "sine", from: 520, to: 760, duration: 0.07, gain: 0.5 });
  tone(ac, out, t + 0.06, { type: "sine", from: 780, to: 1180, duration: 0.08, gain: 0.42 });
  noiseBurst(ac, out, t + 0.02, { duration: 0.05, freq: 3600, q: 1.4, gain: 0.16 });
}

/** Wrong answer — a very soft, low square-wave buzz. Non-punishing. (~130ms) */
export function buzz(): void {
  const c = ensureContext();
  if (!c) return;
  const { ac, out } = c;
  const t = ac.currentTime;
  tone(ac, out, t, { type: "square", from: 150, to: 116, duration: 0.13, gain: 0.14 });
}
