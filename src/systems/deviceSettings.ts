/**
 * Meilenstein 10-A — Geräte-Einstellungen (Touch-Größe, Zielhilfe, Textgeschwindigkeit).
 * Bewusst NUR in localStorage (pro Gerät) und NICHT im Spielstand/Cloud-Save:
 * Handy und PC sollen sich nicht gegenseitig überschreiben.
 */
import type { AimAssistMode, TextSpeed } from '../types';

export type TouchScale = 0.85 | 1 | 1.15 | 1.3;

export type ScreenShake = 'full' | 'low' | 'off';

export interface DeviceSettings {
  touchScale: TouchScale;
  aimAssist: AimAssistMode;
  textSpeed: TextSpeed;
  /** Kamera-Wackeln: voll · schwach (35 %) · aus */
  screenShake: ScreenShake;
  /** Handy-Vibration bei Treffern/Parade */
  vibration: boolean;
}

export const DEVICE_SETTINGS_KEY = 'starlighter_device_settings_v1';
export const TOUCH_SCALES: TouchScale[] = [0.85, 1, 1.15, 1.3];
export const AIM_MODES: AimAssistMode[] = ['off', 'standard', 'smart'];
export const TEXT_SPEEDS: TextSpeed[] = ['normal', 'fast', 'instant'];
export const SCREEN_SHAKES: ScreenShake[] = ['full', 'low', 'off'];

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  touchScale: 1,
  aimAssist: 'standard',
  textSpeed: 'normal',
  screenShake: 'full',
  vibration: true,
};

/** System meldet „weniger Bewegung“ (Barrierefreiheit). */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Validiert beliebige Eingaben; unbekannte Werte fallen auf die Defaults zurück. */
export function sanitizeDeviceSettings(raw: unknown): DeviceSettings {
  const out: DeviceSettings = { ...DEFAULT_DEVICE_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<Record<keyof DeviceSettings, unknown>>;
  if (TOUCH_SCALES.includes(r.touchScale as TouchScale)) out.touchScale = r.touchScale as TouchScale;
  if (AIM_MODES.includes(r.aimAssist as AimAssistMode)) out.aimAssist = r.aimAssist as AimAssistMode;
  if (TEXT_SPEEDS.includes(r.textSpeed as TextSpeed)) out.textSpeed = r.textSpeed as TextSpeed;
  if (SCREEN_SHAKES.includes(r.screenShake as ScreenShake)) out.screenShake = r.screenShake as ScreenShake;
  if (typeof r.vibration === 'boolean') out.vibration = r.vibration;
  return out;
}

/** Fehlt `screenShake` im Gespeicherten und das System will weniger Bewegung → Standard „schwach“. */
function withMotionDefault(s: DeviceSettings, raw: unknown): DeviceSettings {
  const has = !!raw && typeof raw === 'object' && 'screenShake' in (raw as Record<string, unknown>);
  if (!has && prefersReducedMotion()) return { ...s, screenShake: 'low' };
  return s;
}

export function loadDeviceSettings(): DeviceSettings {
  try {
    const raw = localStorage.getItem(DEVICE_SETTINGS_KEY);
    if (!raw) return withMotionDefault({ ...DEFAULT_DEVICE_SETTINGS }, null);
    const parsed: unknown = JSON.parse(raw);
    return withMotionDefault(sanitizeDeviceSettings(parsed), parsed);
  } catch {
    return withMotionDefault({ ...DEFAULT_DEVICE_SETTINGS }, null);
  }
}

let cached: DeviceSettings | null = null;
const listeners = new Set<(s: DeviceSettings) => void>();

/** Gecachte Instanz (wird beim ersten Zugriff geladen). */
export function getDeviceSettings(): DeviceSettings {
  if (!cached) cached = loadDeviceSettings();
  return cached;
}

export function saveDeviceSettings(next: Partial<DeviceSettings>): DeviceSettings {
  const merged = sanitizeDeviceSettings({ ...getDeviceSettings(), ...next });
  cached = merged;
  try {
    localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    // Speicher blockiert (Private Mode …): Einstellung gilt trotzdem für diese Sitzung
  }
  for (const cb of listeners) cb(merged);
  return merged;
}

export function onDeviceSettingsChange(cb: (s: DeviceSettings) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Faktor für Kamera-Wackeln (voll 1 · schwach 0,35 · aus 0). */
export function shakeFactor(): number {
  const m = getDeviceSettings().screenShake;
  return m === 'off' ? 0 : m === 'low' ? 0.35 : 1;
}

/** Im Querformat verdeckt das Touch-Deck sonst zu viel vom Spielfeld → Obergrenze 115 %. */
export const LANDSCAPE_TOUCH_CAP = 1.15;

/** Wirksame Touch-Skalierung für die aktuelle Ausrichtung (rein, testbar). */
export function effectiveTouchScale(scale: number, landscape: boolean): number {
  return landscape ? Math.min(scale, LANDSCAPE_TOUCH_CAP) : scale;
}

export function isLandscapeNow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(orientation: landscape)').matches;
  } catch {
    return window.innerWidth > window.innerHeight;
  }
}

/** Setzt die CSS-Variable `--touch-scale` (Buttons & Joystick). Gibt den wirksamen Wert zurück. */
export function applyTouchScale(scale: number = getDeviceSettings().touchScale): number {
  const eff = effectiveTouchScale(scale, isLandscapeNow());
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--touch-scale', String(eff));
  }
  return eff;
}

/** Nur für Tests: Cache verwerfen. */
export function resetDeviceSettingsCacheForTest(): void {
  cached = null;
}
