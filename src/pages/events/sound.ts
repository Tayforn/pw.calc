// =========================================================
// Розклад Евентів: звуки нагадувань на WebAudio (без аудіофайлів).
// AudioContext лінивий + resume на першому жесті (autoplay policy).
// =========================================================

import type { EvtSettings } from './types';

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Викликати на першому користувацькому жесті на сторінці. */
export function warmupAudio(): void {
  ensureCtx();
}

/** Один тон з експоненційним затуханням. */
function tone(ac: AudioContext, dest: AudioNode, type: OscillatorType, freq: number, at: number, dur: number, peak: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

export function playPreset(preset: EvtSettings['preset'], volume: number): void {
  const ac = ensureCtx();
  if (!ac) return;
  const master = ac.createGain();
  // Перцептивна крива гучності.
  master.gain.value = Math.pow(Math.max(0, Math.min(100, volume)) / 100, 1.5);
  master.connect(ac.destination);
  const t = ac.currentTime + 0.02;
  if (preset === 'bell') {
    tone(ac, master, 'sine', 880, t, 1.1, 0.5);
    tone(ac, master, 'sine', 1320, t, 0.8, 0.22);
  } else if (preset === 'gong') {
    tone(ac, master, 'triangle', 220, t, 1.8, 0.6);
    tone(ac, master, 'triangle', 331, t, 1.5, 0.3);
    tone(ac, master, 'sine', 442, t, 1.0, 0.15);
  } else {
    for (let i = 0; i < 3; i++) tone(ac, master, 'square', 1046, t + i * 0.22, 0.12, 0.25);
  }
}
