/**
 * Meilenstein 10-A — Story-Bibel (reine Daten): Kapitel, Vertrauens-Boni, Passanten-Plan & -Sprüche.
 * Keine Imports aus der Spiel-Logik (nur Typen), damit alles rein testbar bleibt.
 */
import type { StoryFlagId, StoryNpcId, StoryProgress } from '../../types';

export const STORY_NPCS: StoryNpcId[] = ['kael', 'lyra', 'nyx', 'vex'];
export const STORY_CHAPTER_MAX = 6;
export const TRUST_MIN = 0;
export const TRUST_MAX = 10;
export const TRUST_START = 2;
export const TRUST_PERK_THRESHOLD = 7;

export interface StoryChapterDef {
  id: number;
  title: string;
  /** Anzeige in der Chronik. */
  trigger: string;
  /** Sichtbare Änderung auf Port Solaris. */
  stationChange: string;
}

export const STORY_CHAPTERS: StoryChapterDef[] = [
  {
    id: 0,
    title: 'Prolog · Ankunft auf Port Solaris',
    trigger: 'Spielstart',
    stationChange:
      'Grundzustand: Tech-Labor, Schwarzmarkt und Terrasse sind noch Baustellen. Sie öffnen durch deine Expeditionen und Geschäfte.',
  },
  {
    id: 1,
    title: 'Kapitel I · Junos Zeichen',
    trigger: 'Nach dem Sieg über A.E.G.I.S. LEVIATHAN',
    stationChange: 'Die Lichterketten leuchten wieder, die Marktplatz-Terrasse wird freigegeben und Kaels Gehilfin Mina zieht ein.',
  },
  {
    id: 2,
    title: 'Kapitel II · Das Lied der Kristalle',
    trigger: 'Nach dem Sieg über ★ PRISMA-ARCHON',
    stationChange: 'Kristall-Laternen an Schmiede & Med-Bay, Kristall-Pilger auf der Promenade.',
  },
  {
    id: 3,
    title: 'Kapitel III · Funken der Sonnenschmiede',
    trigger: 'Nach dem Sieg über ★ VULKAN-TITAN',
    stationChange: 'Solar-Wimpel über dem Platz, Gießerei-Arbeiter bei den Ständen.',
  },
  {
    id: 4,
    title: 'Kapitel IV · Das Erbe der Ältesten',
    trigger: 'Nach dem Sieg über ★ DER STERNEN-ARCHON',
    stationChange: 'Ein Holo-Obelisk der Ältesten steht in der Platzmitte, Gelehrte besuchen die Station.',
  },
  {
    id: 5,
    title: 'Kapitel V · Licht jenseits des 5. Tors',
    trigger: 'Nach dem Sieg über ★ OMEGA STERNEN-ARCHON',
    stationChange: 'Omega-Fest: Sternenbanner und Feuerwerk über Port Solaris.',
  },
  {
    id: 6,
    title: 'Epilog · Ein neuer Zyklus',
    trigger: 'Nach dem Start von New Game+',
    stationChange: 'Ein Zyklus-Hologramm zählt neben der Kapitäns-Tafel mit.',
  },
];

/** Rein: höchstes aktuell verdientes Kapitel. */
export function computeStoryChapter(s: {
  sector1Cleared: boolean;
  sector2Cleared: boolean;
  sector3Cleared: boolean;
  sector4Cleared: boolean;
  omegaCleared: boolean;
  ngPlusLevel: number;
}): number {
  if (s.ngPlusLevel >= 1) return 6;
  if (s.omegaCleared) return 5;
  if (s.sector4Cleared) return 4;
  if (s.sector3Cleared) return 3;
  if (s.sector2Cleared) return 2;
  if (s.sector1Cleared) return 1;
  return 0;
}

export function createEmptyStory(): StoryProgress {
  return {
    chapter: 0,
    trust: { kael: TRUST_START, lyra: TRUST_START, nyx: TRUST_START, vex: TRUST_START },
    flags: [],
    seenScenes: [],
    skippedScenes: [],
    choiceLog: [],
  };
}

export const ALL_STORY_FLAGS: StoryFlagId[] = [
  'knows_juno',
  'kael_memorial',
  'kael_forward',
  'lyra_clinic',
  'lyra_told_truth',
  'vex_shared_signal',
  'vex_spiral',
  'vex_stays',
  'nyx_helion_known',
  'nyx_confronted',
  'nyx_covered',
  'nyx_redeemed',
  'festival_seen',
];

// ==================== NPC-Metadaten ====================
export interface StoryNpcMeta {
  id: StoryNpcId;
  name: string;
  role: string;
  /** Plakettenfarbe im Dialog & in der Chronik. */
  color: string;
  /** Station, die nach dem Gespräch geöffnet wird. */
  station: string;
  /** Welchen Ton diese Figur schätzt (nur Flavour für die Chronik). */
  likes: 'warm' | 'direkt' | 'neugierig' | 'vorsichtig';
}

export const NPC_META: Record<StoryNpcId, StoryNpcMeta> = {
  kael: { id: 'kael', name: 'Kael', role: 'Schmied', color: '#fb923c', station: 'Exo-Schmiede', likes: 'direkt' },
  lyra: { id: 'lyra', name: 'Dr. Lyra', role: 'Ärztin', color: '#34d399', station: 'Med-Bay', likes: 'warm' },
  nyx: { id: 'nyx', name: 'Nyx', role: 'Schwarzmarkt', color: '#c084fc', station: 'Schwarzmarkt', likes: 'vorsichtig' },
  vex: { id: 'vex', name: 'Vex', role: 'Ingenieurin', color: '#38bdf8', station: 'Tech-Labor', likes: 'neugierig' },
};

export const TONE_ICON: Record<'warm' | 'direkt' | 'neugierig' | 'vorsichtig', string> = {
  warm: '💛',
  direkt: '⚡',
  neugierig: '🔍',
  vorsichtig: '🛡',
};

// ==================== Vertrauens-Boni (ab Vertrauen ≥ 7) ====================
export interface TrustPerkDef {
  npc: StoryNpcId;
  name: string;
  description: string;
}

export const TRUST_PERKS: Record<StoryNpcId, TrustPerkDef> = {
  kael: { npc: 'kael', name: 'Meisterhand', description: 'Schmiede-Upgrades & Waffen-Fertigung kosten 5 % weniger Credits.' },
  lyra: { npc: 'lyra', name: 'Lyras Notfallset', description: '+1 Stimpack-Ladung auf Expeditionen (nicht in der Galaktischen Prüfung).' },
  nyx: { npc: 'nyx', name: 'Hinterzimmer-Ware', description: '+1 zusätzliches seltenes Angebot im täglichen Schwarzmarkt-Sortiment.' },
  vex: { npc: 'vex', name: 'Sektor-Scanner', description: 'Die Minimap zeigt Schatz- und Bossraum ab Betreten der Ebene (nicht in der Galaktischen Prüfung).' },
};

// ==================== Promenaden-Passanten ====================
export type StrollerKind = 'wanderer' | 'astro' | 'horned' | 'pilgrim' | 'foundry' | 'scholar' | 'guest';

/** Zusätzliche Passanten ab diesem Kapitel (kumulativ, Gesamtzahl ≤ 6 inkl. der 2 Standard-Passanten). */
export const STROLLER_PLAN: Array<{ minChapter: number; kind: StrollerKind }> = [
  { minChapter: 2, kind: 'pilgrim' },
  { minChapter: 3, kind: 'foundry' },
  { minChapter: 4, kind: 'scholar' },
  { minChapter: 5, kind: 'guest' },
];

export interface ChatterLine {
  /** Höchstens 68 Zeichen (2 Zeilen à 34). */
  text: string;
  /** Nur wenn dieser Weltzustand gilt (z. B. 'techlab_locked', 'terrace_open', 'quarters_2', 'shop_2'). */
  needs?: string;
  minChapter: number;
  maxChapter?: number;
  flag?: StoryFlagId;
}

export const CHATTER_LINES: ChatterLine[] = [
  // Prolog / Kapitel 0
  { text: 'Hörst du das Summen? Nein? Gut.', minChapter: 0, maxChapter: 0 },
  { text: 'Neue Kapitäne halten selten lange.', minChapter: 0, maxChapter: 0 },
  { text: 'Die Wracks flüstern nachts.', minChapter: 0, maxChapter: 0 },
  { text: 'Kael sagt, er hätte Besseres zu tun.', minChapter: 0, maxChapter: 0 },
  // Kapitel 1
  { text: 'Der Leviathan ist tot! Wirklich tot!', minChapter: 1, maxChapter: 1 },
  { text: 'Endlich wieder Licht auf der Promenade.', minChapter: 1, maxChapter: 1 },
  { text: 'Kael schlägt seit Tagen auf denselben Amboss.', minChapter: 1, maxChapter: 1 },
  { text: 'Das Echo klingt leiser, findest du nicht?', minChapter: 1, maxChapter: 2 },
  // Kapitel 2
  { text: 'Die Kristalle singen, sagen die Pilger.', minChapter: 2, maxChapter: 2 },
  { text: 'Vex sagt, das Echo sind Koordinaten!', minChapter: 2, flag: 'vex_shared_signal' },
  { text: 'Lyras Echo-Station hat mir geholfen.', minChapter: 2, flag: 'lyra_clinic' },
  { text: 'Violettes Licht beruhigt mich irgendwie.', minChapter: 2, maxChapter: 3 },
  // Kapitel 3
  { text: 'Heiß wie in der Gießerei heute.', minChapter: 3, maxChapter: 3 },
  { text: 'Die Wimpel hat Kael bezahlt, sagt man.', minChapter: 3, maxChapter: 3 },
  { text: 'Der Titan war ein Schmied? Unheimlich.', minChapter: 3, maxChapter: 4 },
  { text: 'Wer war der Mann mit dem goldenen Ring?', minChapter: 3, maxChapter: 4 },
  // Weltzustand: Baustellen & Ausbau
  { text: 'Im Tech-Labor wird noch gehämmert. Wochenlang.', minChapter: 0, needs: 'techlab_locked' },
  { text: 'Nyx’ Stand ist zu. Wer weiß, was sie plant.', minChapter: 0, needs: 'blackmarket_locked' },
  { text: 'Die Terrasse bleibt zu, bis der Leviathan fällt.', minChapter: 0, maxChapter: 0, needs: 'terrace_locked' },
  { text: 'Vex hat endlich ihr Labor eröffnet!', minChapter: 0, maxChapter: 2, needs: 'techlab_open' },
  { text: 'Milos Elixiere riechen nach Ozon und Honig.', minChapter: 1, needs: 'terrace_open' },
  { text: 'Der Kapitän hat jetzt eine Jukebox im Quartier!', minChapter: 0, maxChapter: 3, needs: 'quarters_1' },
  { text: 'Gold bis unters Dach: die Suite des Kapitäns.', minChapter: 0, needs: 'quarters_2' },
  { text: 'Astro-Barter glänzt wie ein Flaggschiff-Basar.', minChapter: 0, needs: 'shop_2' },
  { text: 'Lyras kleiner Droide piept nach jedem Pflaster.', minChapter: 2, needs: 'pip' },
  { text: 'Pings Antenne dreht sich im Takt des Echos.', minChapter: 3, needs: 'ping' },
  { text: 'Nyx’ Katze schaut mich an, als wüsste sie was.', minChapter: 4, needs: 'midnight' },
  // Kapitel 4
  { text: 'Der Obelisk summt nachts. Beruhigend.', minChapter: 4, maxChapter: 4 },
  { text: 'Vier Siegel … und das Tor ist offen.', minChapter: 4, maxChapter: 4 },
  { text: 'Die Gelehrten reden von einer Warnung.', minChapter: 4, maxChapter: 5 },
  // Kapitel 5
  { text: 'Auf den Kapitän!', minChapter: 5, maxChapter: 5 },
  { text: 'Hast du das Feuerwerk gesehen?', minChapter: 5, maxChapter: 5 },
  { text: 'Ein Stern für Juno im Feuerwerk.', minChapter: 5, flag: 'kael_memorial' },
  { text: 'Das Echo ist weg. Es fühlt sich leer an.', minChapter: 5, maxChapter: 5 },
  // Kapitel 6
  { text: 'Alles von vorn? Respekt.', minChapter: 6 },
  { text: 'Die alten Wracks sollen wütender sein.', minChapter: 6 },
  { text: 'Das Leuchtfeuer am Tor blinkt die ganze Nacht.', minChapter: 6, flag: 'vex_spiral' },
  { text: 'Vex unterrichtet jetzt Lehrlinge!', minChapter: 6, flag: 'vex_stays' },
];

/** Reine Auswahl der passenden Zeilen für Kapitel + Flags. */
export function getChatterPool(chapter: number, flags: readonly StoryFlagId[], facts?: readonly string[]): ChatterLine[] {
  return CHATTER_LINES.filter(
    (l) =>
      (l.needs === undefined || (facts?.includes(l.needs) ?? false)) &&
      chapter >= l.minChapter &&
      (l.maxChapter === undefined || chapter <= l.maxChapter || l.flag !== undefined) &&
      (l.flag === undefined || flags.includes(l.flag)),
  );
}
