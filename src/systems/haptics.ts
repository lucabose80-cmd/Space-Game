import { getDeviceSettings } from './deviceSettings';

let last = 0;

/** Kurzer Vibrations-Impuls (nur Touch-Geräte, abschaltbar, max. alle 80 ms). Reine Optik/Haptik, kein Spielzustand. */
export function haptic(ms: number | number[]): void {
  if (!getDeviceSettings().vibration) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
  } catch {
    return;
  }
  const now = performance.now();
  if (now - last < 80) return;
  last = now;
  try {
    navigator.vibrate(ms);
  } catch {
    /* ignorieren */
  }
}
