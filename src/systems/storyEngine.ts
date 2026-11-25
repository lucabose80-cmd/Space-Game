/**
 * Meilenstein 10-A — Story-Engine (rein, keine DOM-/Spiel-Zugriffe, voll testbar).
 * Szenen auswählen, Varianten/Antworten auflösen, Entscheidungen anwenden, Szenen validieren.
 */
import { ALL_STORY_FLAGS, STORY_CHAPTER_MAX, STORY_NPCS, TRUST_MAX, TRUST_MIN, TRUST_PERK_THRESHOLD } from '../data/story/storyChapters';
import { STORY_SCENES } from '../data/story/storyScenes';
import type { StoryChoice, StoryCondition, StoryNode, StoryScene } from '../data/story/storyTypes';
import type { StoryFlagId, StoryNpcId, StoryProgress } from '../types';

export const STORY_TEXT_MAX = 180;
export const STORY_CHOICE_LABEL_MAX = 90;
export const STORY_PATH_MAX_BOXES = 8;
export const STORY_PATH_MAX_NARRATOR = 2;
export const CHOICE_LOG_MAX = 80;

export function getSceneById(id: string, scenes: StoryScene[] = STORY_SCENES): StoryScene | undefined {
  return scenes.find((s) => s.id === id);
}

export function hasFlag(p: StoryProgress, flag: StoryFlagId): boolean {
  return p.flags.includes(flag);
}

export function isSceneSeen(p: StoryProgress, sceneId: string): boolean {
  return p.seenScenes.includes(sceneId);
}

export function isSceneSkipped(p: StoryProgress, sceneId: string): boolean {
  return p.skippedScenes.includes(sceneId);
}

/** Älteste ungelesene NPC-Szene mit chapter ≤ aktuelles Kapitel (lückenlose Geschichte). */
export function getPendingScene(
  p: StoryProgress,
  npc: StoryNpcId,
  scenes: StoryScene[] = STORY_SCENES,
): StoryScene | null {
  let best: StoryScene | null = null;
  for (const s of scenes) {
    if (s.npc !== npc || s.chapter > p.chapter || isSceneSeen(p, s.id)) continue;
    if (!best || s.chapter < best.chapter) best = s;
  }
  return best;
}

export function checkCondition(cond: StoryCondition | undefined, p: StoryProgress): boolean {
  if (!cond) return true;
  if (cond.flag && !hasFlag(p, cond.flag)) return false;
  if (cond.notFlag && hasFlag(p, cond.notFlag)) return false;
  if (cond.minTrust) {
    for (const [npc, min] of Object.entries(cond.minTrust) as Array<[StoryNpcId, number]>) {
      if ((p.trust[npc] ?? 0) < min) return false;
    }
  }
  return true;
}

/** Erste Variante, deren Bedingung erfüllt ist, ersetzt den Standardtext. */
export function resolveNodeText(node: StoryNode, p: StoryProgress): string {
  for (const v of node.variants ?? []) {
    if (checkCondition(v.when, p)) return v.text;
  }
  return node.text;
}

export function getVisibleChoices(node: StoryNode, p: StoryProgress): StoryChoice[] {
  return (node.choices ?? []).filter((c) => checkCondition(c.requires, p));
}

export function formatStoryText(text: string, captainName: string): string {
  const name = captainName.trim() || 'Kapitän';
  return text.replace(/\{captain\}/g, name);
}

/** NPC mit dem höchsten Vertrauen; Gleichstand: Kael > Lyra > Nyx > Vex. */
export function pickFestivalSpeaker(p: StoryProgress): StoryNpcId {
  let best: StoryNpcId = STORY_NPCS[0];
  for (const npc of STORY_NPCS) {
    if ((p.trust[npc] ?? 0) > (p.trust[best] ?? 0)) best = npc;
  }
  return best;
}

/** '@speaker' → 'speech_<npc>' (nur Omega-Fest), sonst unverändert. */
export function resolveNext(next: string, p: StoryProgress): string {
  return next === '@speaker' ? `speech_${pickFestivalSpeaker(p)}` : next;
}

/** `nyx_redeemed` ist berechnet: (confronted && Vertrauen ≥ 5) || (covered && Vertrauen ≥ 7). */
export function recomputeDerivedFlags(p: StoryProgress): void {
  const redeemed =
    (hasFlag(p, 'nyx_confronted') && p.trust.nyx >= 5) || (hasFlag(p, 'nyx_covered') && p.trust.nyx >= 7);
  const has = hasFlag(p, 'nyx_redeemed');
  if (redeemed && !has) p.flags.push('nyx_redeemed');
  if (!redeemed && has) p.flags = p.flags.filter((f) => f !== 'nyx_redeemed');
}

/** Vor dem Start einer Szene aufrufen (nyx_redeemed vor Nyx · Kap. V erneut berechnen). */
export function prepareScene(p: StoryProgress, scene: StoryScene): void {
  if (scene.id === 'nyx_c5') recomputeDerivedFlags(p);
}

export function clampTrust(v: number): number {
  return Math.max(TRUST_MIN, Math.min(TRUST_MAX, Math.round(v)));
}

/** Wendet eine Antwort an (mutiert p). Gibt Vertrauen vorher + neu erreichte Boni zurück. */
export function applyChoice(
  p: StoryProgress,
  sceneId: string,
  c: StoryChoice,
  now: number = Date.now(),
): { trustBefore: Record<StoryNpcId, number>; newPerks: StoryNpcId[] } {
  const trustBefore = { ...p.trust };
  for (const [npc, delta] of Object.entries(c.trust ?? {}) as Array<[StoryNpcId, number]>) {
    p.trust[npc] = clampTrust((p.trust[npc] ?? 0) + delta);
  }
  for (const f of c.setFlags ?? []) {
    if (!p.flags.includes(f)) p.flags.push(f);
  }
  if (sceneId === 'nyx_c4') recomputeDerivedFlags(p);
  p.choiceLog.push({ sceneId, choiceId: c.id, ts: now });
  if (p.choiceLog.length > CHOICE_LOG_MAX) p.choiceLog.splice(0, p.choiceLog.length - CHOICE_LOG_MAX);
  const newPerks = STORY_NPCS.filter(
    (npc) => trustBefore[npc] < TRUST_PERK_THRESHOLD && p.trust[npc] >= TRUST_PERK_THRESHOLD,
  );
  return { trustBefore, newPerks };
}

export function hasTrustPerk(p: StoryProgress, npc: StoryNpcId): boolean {
  return (p.trust[npc] ?? 0) >= TRUST_PERK_THRESHOLD;
}

/** Defensives Laden eines gespeicherten StoryProgress (unbekannte IDs verwerfen, Werte klemmen). */
export function sanitizeStory(raw: unknown, scenes: StoryScene[] = STORY_SCENES): StoryProgress {
  const out: StoryProgress = {
    chapter: 0,
    trust: { kael: 2, lyra: 2, nyx: 2, vex: 2 },
    flags: [],
    seenScenes: [],
    skippedScenes: [],
    choiceLog: [],
  };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<StoryProgress>;
  out.chapter = Math.max(0, Math.min(STORY_CHAPTER_MAX, Math.floor(Number(r.chapter) || 0)));
  if (r.trust && typeof r.trust === 'object') {
    for (const npc of STORY_NPCS) {
      const v = Number((r.trust as Record<string, unknown>)[npc]);
      if (Number.isFinite(v)) out.trust[npc] = clampTrust(v);
    }
  }
  if (Array.isArray(r.flags)) {
    out.flags = [...new Set(r.flags.filter((f): f is StoryFlagId => ALL_STORY_FLAGS.includes(f as StoryFlagId)))];
  }
  const ids = new Set(scenes.map((s) => s.id));
  if (Array.isArray(r.seenScenes)) {
    out.seenScenes = [...new Set(r.seenScenes.filter((x): x is string => typeof x === 'string' && ids.has(x)))];
  }
  if (Array.isArray(r.skippedScenes)) {
    out.skippedScenes = [...new Set(r.skippedScenes.filter((x): x is string => typeof x === 'string' && ids.has(x)))];
  }
  if (Array.isArray(r.choiceLog)) {
    out.choiceLog = r.choiceLog
      .filter(
        (e) =>
          e && typeof e.sceneId === 'string' && typeof e.choiceId === 'string' && ids.has(e.sceneId),
      )
      .map((e) => ({ sceneId: e.sceneId, choiceId: e.choiceId, ts: Number(e.ts) || 0 }))
      .slice(-CHOICE_LOG_MAX);
  }
  return out;
}

// ==================== Validierung ====================
function allNextTargets(node: StoryNode, sceneId: string): string[] {
  const t: string[] = [];
  if (node.next) t.push(node.next);
  for (const c of node.choices ?? []) t.push(c.next);
  // '@speaker' verzweigt (nur Omega-Fest) auf alle 4 Redner-Knoten
  return t.flatMap((x) => (x === '@speaker' && sceneId === 'event_festival' ? STORY_NPCS.map((n) => `speech_${n}`) : [x]));
}

function checkCond(cond: StoryCondition | undefined, where: string, errors: string[]): void {
  if (!cond) return;
  if (cond.flag && !ALL_STORY_FLAGS.includes(cond.flag)) errors.push(`${where}: unbekanntes Flag "${cond.flag}"`);
  if (cond.notFlag && !ALL_STORY_FLAGS.includes(cond.notFlag)) errors.push(`${where}: unbekanntes Flag "${cond.notFlag}"`);
  for (const npc of Object.keys(cond.minTrust ?? {})) {
    if (!STORY_NPCS.includes(npc as StoryNpcId)) errors.push(`${where}: unbekannter NPC "${npc}" in minTrust`);
  }
}

function checkText(text: string, max: number, where: string, errors: string[]): void {
  if (!text || !text.trim()) errors.push(`${where}: leerer Text`);
  if (text.length > max) errors.push(`${where}: Text zu lang (${text.length} > ${max})`);
  const stray = text.replace(/\{captain\}/g, '').match(/[{}]/);
  if (stray) errors.push(`${where}: unerlaubter Platzhalter / Klammer`);
}

/** Leere Liste = gültig. `requireComplete` prüft zusätzlich: je NPC Kapitel 0–6 + event_festival. */
export function validateStoryScenes(
  scenes: StoryScene[],
  opts: { requireComplete?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const slots = new Set<string>();

  for (const scene of scenes) {
    const sid = scene.id;
    if (ids.has(sid)) errors.push(`${sid}: doppelte Szenen-ID`);
    ids.add(sid);
    if (scene.npc !== 'event' && !STORY_NPCS.includes(scene.npc)) errors.push(`${sid}: unbekannter NPC`);
    if (!Number.isInteger(scene.chapter) || scene.chapter < 0 || scene.chapter > STORY_CHAPTER_MAX) {
      errors.push(`${sid}: Kapitel außerhalb 0..${STORY_CHAPTER_MAX}`);
    }
    const slot = `${scene.npc}:${scene.chapter}`;
    if (slots.has(slot)) errors.push(`${sid}: zweite Szene für ${slot}`);
    slots.add(slot);
    if (!scene.nodes[scene.start]) errors.push(`${sid}: Start-Knoten "${scene.start}" fehlt`);

    const choiceIds = new Set<string>();
    for (const [nid, node] of Object.entries(scene.nodes)) {
      const where = `${sid}.${nid}`;
      checkText(node.text, STORY_TEXT_MAX, where, errors);
      for (const v of node.variants ?? []) {
        checkText(v.text, STORY_TEXT_MAX, `${where}.variant`, errors);
        checkCond(v.when, `${where}.variant`, errors);
      }
      const hasChoices = Boolean(node.choices && node.choices.length > 0);
      if (hasChoices === Boolean(node.next)) errors.push(`${where}: genau eines von choices/next nötig`);
      if (hasChoices) {
        if ((node.choices?.length ?? 0) > 3) errors.push(`${where}: mehr als 3 Antworten`);
        for (const c of node.choices ?? []) {
          const cw = `${where}.${c.id}`;
          if (choiceIds.has(c.id)) errors.push(`${cw}: Antwort-ID nicht eindeutig in der Szene`);
          choiceIds.add(c.id);
          checkText(c.label, STORY_CHOICE_LABEL_MAX, `${cw}.label`, errors);
          if (!c.chronicle || !c.chronicle.trim()) errors.push(`${cw}: Chronik-Satz fehlt`);
          for (const [npc, d] of Object.entries(c.trust ?? {})) {
            if (!STORY_NPCS.includes(npc as StoryNpcId)) errors.push(`${cw}: unbekannter NPC "${npc}" in trust`);
            if (typeof d !== 'number' || d < -1 || d > 2) errors.push(`${cw}: trust ${npc} außerhalb -1..+2`);
          }
          for (const f of c.setFlags ?? []) {
            if (!ALL_STORY_FLAGS.includes(f)) errors.push(`${cw}: unbekanntes Flag "${f}"`);
          }
          checkCond(c.requires, `${cw}.requires`, errors);
        }
      }
      for (const target of allNextTargets(node, sid)) {
        if (target === 'end') continue;
        if (target === '@speaker') {
          errors.push(`${where}: "@speaker" ist nur in event_festival erlaubt`);
          continue;
        }
        if (!scene.nodes[target]) errors.push(`${where}: Ziel-Knoten "${target}" fehlt`);
      }
    }

    // Erreichbarkeit + Pfadlängen (DFS, Zyklen = Fehler)
    const reachable = new Set<string>();
    const onStack = new Set<string>();
    let cycle = false;
    let longest = 0;
    let narratorMax = 0;
    const walk = (nid: string, depth: number, narr: number): void => {
      const node = scene.nodes[nid];
      if (!node) return;
      if (onStack.has(nid)) {
        cycle = true;
        return;
      }
      reachable.add(nid);
      const n2 = narr + (node.speaker === 'narrator' ? 1 : 0);
      const d2 = depth + 1;
      longest = Math.max(longest, d2);
      narratorMax = Math.max(narratorMax, n2);
      onStack.add(nid);
      for (const t of allNextTargets(node, sid)) if (t !== 'end') walk(t, d2, n2);
      onStack.delete(nid);
    };
    walk(scene.start, 0, 0);
    if (cycle) errors.push(`${sid}: Zyklus im Dialog-Graph`);
    for (const nid of Object.keys(scene.nodes)) {
      if (!reachable.has(nid)) errors.push(`${sid}.${nid}: nicht erreichbar`);
    }
    if (longest > STORY_PATH_MAX_BOXES) errors.push(`${sid}: Pfad mit ${longest} Boxen (> ${STORY_PATH_MAX_BOXES})`);
    if (narratorMax > STORY_PATH_MAX_NARRATOR) errors.push(`${sid}: ${narratorMax} Erzähler-Boxen auf einem Pfad (> ${STORY_PATH_MAX_NARRATOR})`);
    if (sid === 'event_festival') {
      for (const npc of STORY_NPCS) {
        if (!scene.nodes[`speech_${npc}`]) errors.push(`${sid}: Knoten speech_${npc} fehlt`);
      }
    }
  }

  if (opts.requireComplete) {
    for (const npc of STORY_NPCS) {
      for (let ch = 0; ch <= STORY_CHAPTER_MAX; ch++) {
        if (!slots.has(`${npc}:${ch}`)) errors.push(`Szene fehlt: ${npc} Kapitel ${ch}`);
      }
    }
    if (!ids.has('event_festival')) errors.push('Szene fehlt: event_festival');
  }
  return errors;
}
