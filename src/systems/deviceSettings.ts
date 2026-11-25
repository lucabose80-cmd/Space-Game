/**
 * Meilenstein 10-A — Geräte-Einstellungen (Touch-Größe, Zielhilfe, Textgeschwindigkeit).
 * Bewusst NUR in localStorage (pro Gerät) und NICHT im Spielstand/Cloud-Save:
 * Handy und PC sollen sich nicht gegenseitig überschreiben.
 */
import type { AimAssistMode, TextSpeed } from '../types';

export type TouchScale = 0.85 | 1 | 1.15 | 1.3;

export interface DeviceSettings {
  touchScale: TouchScale;
  aimAssist: AimAssistMode;
  textSpeed: TextSpeed;
}

export const DEVICE_SETTINGS_KEY = 'starlighter_device_settings_v1';
export const TOUCH_SCALES: TouchScale[] = [0.85, 1, 1.15, 1.3];
export const AIM_MODES: AimAssistMode[] = ['off', 'standard', 'smart'];
export const TEXT_SPEEDS: TextSpeed[] = ['normal', 'fast', 'instant'];

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  touchScale: 1,
  aimAssist: 'standard',
  textSpeed: 'normal',
};

/** Validiert beliebige Eingaben; unbekannte Werte fallen auf die Defaults zurück. */
export function sanitizeDeviceSettings(raw: unknown): DeviceSettings {
  const out: DeviceSettings = { ...DEFAULT_DEVICE_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<Record<keyof DeviceSettings, unknown>>;
  if (TOUCH_SCALES.includes(r.touchScale as TouchScale)) out.touchScale = r.touchScale as TouchScale;
  if (AIM_MODES.includes(r.aimAssist as AimAssistMode)) out.aimAssist = r.aimAssist as AimAssistMode;
  if (TEXT_SPEEDS.includes(r.textSpeed as TextSpeed)) out.textSpeed = r.textSpeed as TextSpeed;
  return out;
}

export function loadDeviceSettings(): DeviceSettings {
  try {
    const raw = localStorage.getItem(DEVICE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_DEVICE_SETTINGS };
    return sanitizeDeviceSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DEVICE_SETTINGS };
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
