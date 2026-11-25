/** Meilenstein 10-A — Datenformat der Dialog-Graphen (reine Typen). */
import type { StoryFlagId, StoryNpcId } from '../../types';

export type StorySpeaker = StoryNpcId | 'narrator' | 'captain';
export type StoryTone = 'warm' | 'direkt' | 'neugierig' | 'vorsichtig';

export interface StoryCondition {
  /** Flag muss gesetzt sein. */
  flag?: StoryFlagId;
  /** Flag darf nicht gesetzt sein. */
  notFlag?: StoryFlagId;
  minTrust?: Partial<Record<StoryNpcId, number>>;
}

export interface StoryChoice {
  /** Eindeutig innerhalb der Szene, z. B. "a". */
  id: string;
  /** Antworttext (≤ 90 Zeichen). */
  label: string;
  tone: StoryTone;
  trust?: Partial<Record<StoryNpcId, number>>;
  setFlags?: StoryFlagId[];
  requires?: StoryCondition;
  /** Chronik-Satz, z. B. "Du hast Kael geraten, Junos Opfer zu ehren." */
  chronicle: string;
  /** Knoten-ID oder "end". */
  next: string;
}

export interface StoryNode {
  speaker: StorySpeaker;
  /** ≤ 180 Zeichen, {captain} erlaubt. */
  text: string;
  variants?: Array<{ when: StoryCondition; text: string }>;
  /** Entweder choices … */
  choices?: StoryChoice[];
  /** … oder next ("end" beendet, "@speaker" nur im Omega-Fest). */
  next?: string;
}

export interface StoryScene {
  /** "kael_c1", "event_festival" */
  id: string;
  npc: StoryNpcId | 'event';
  /** 0..6 */
  chapter: number;
  title: string;
  start: string;
  nodes: Record<string, StoryNode>;
}
