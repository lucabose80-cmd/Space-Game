/** Meilenstein 9 — Holo-Grüße der Geister-Kapitäne. */

export const GHOST_GREETING_MAX = 60;

export const GHOST_GREETING_PRESETS: string[] = [
  'Grüße aus Dock III — schöne Podeste!',
  'Möge dein Warp-Anker nie reißen!',
  'Tolle Relikte! Ich komme wieder.',
  'Frische Ware von der Frontier, Kollege?',
  'Sternenlicht auf deinen Wegen, Händler!',
  'Dein Laden glänzt wie ein Kristall-Nebel.',
  'Ich suche nur Schnäppchen — sag nichts!',
  'Funkspruch von Port Solaris: weiter so!',
];

/** Entfernt Steuer-/Sonderzeichen, kappt die Länge und trimmt. Für lokale + fremde Grüße. */
export function sanitizeGreeting(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\p{So}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, GHOST_GREETING_MAX);
}
