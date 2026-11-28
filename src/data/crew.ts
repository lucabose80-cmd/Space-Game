/**
 * Welt-Überarbeitung P7 — Crew-Begleiter der Shop-Besitzer (reine Daten).
 * Mina (Kael), Pip (Lyra), Ping (Vex) und Mitternacht (Nyx) sind im Dungeon gefangen (Ebene II ihres Sektors).
 * Befreit bringen sie dem Laden ihres Besitzers einen echten Vorteil (nie Credits-Gewinn — nur günstigere Preise).
 */
import type { CrewId, SectorId, StoryNpcId } from '../types';
import type { StoryScene } from './story/storyTypes';

export const CREW_ORDER: CrewId[] = ['mina', 'pip', 'ping', 'midnight'];

export interface CrewDef {
  id: CrewId;
  name: string;
  owner: StoryNpcId;
  ownerName: string;
  /** Laden, den der Begleiter verbessert. */
  shopLabel: string;
  /** Sektor & Ebene, in der er gefangen ist. */
  sector: SectorId;
  floor: 2;
  sectorName: string;
  /** Preisnachlass (Anteil) im Laden des Besitzers. */
  discount: number;
  effectText: string;
  color: string;
  /** Hinweis des Besitzers, solange der Begleiter vermisst wird. */
  hint: string;
  /** Wenn der Sektor noch nicht erreichbar ist. */
  hintEarly: string;
}

export const CREW_DEFS: Record<CrewId, CrewDef> = {
  mina: {
    id: 'mina',
    name: 'Mina',
    owner: 'kael',
    ownerName: 'Kael',
    shopLabel: 'Exo-Schmiede',
    sector: 1,
    floor: 2,
    sectorName: 'Wrack-Sektor',
    discount: 0.1,
    effectText: 'Schmiede: −10 % Credits auf Upgrades & Waffen-Fertigung',
    color: '#fb923c',
    hint:
      'Mina ist vor Wochen in die Wracks gelaufen, um Altmetall zu holen, und nie zurückgekommen. Ihr Funk blinkt aus Ebene II des Wrack-Sektors: ein Käfig-Signal, tief in einem Kampfraum. Hol sie raus, {captain}.',
    hintEarly: 'Mina ist im Wrack-Sektor verschwunden. Sobald du dich auf Ebene II traust, such nach ihrem Käfig-Signal.',
  },
  pip: {
    id: 'pip',
    name: 'Pip',
    owner: 'lyra',
    ownerName: 'Dr. Lyra',
    shopLabel: 'Med-Bay',
    sector: 2,
    floor: 2,
    sectorName: 'Kristall-Nebel',
    discount: 0.1,
    effectText: 'Med-Bay: −10 % Credits auf Bio- & Stimpack-Upgrades',
    color: '#2dd4bf',
    hint:
      'Pip, mein Assistent, ist bei einer Probentour im Kristall-Nebel verschwunden. Seine Kennung pulsiert noch, Ebene II, in einer Kristallkammer. Bring ihn heim, ich brauche seine Hände. Und er seinen Verbandskasten.',
    hintEarly: 'Pip ist im Kristall-Nebel verschollen. Der Nebel ist noch zu weit weg. Erst wenn du dort bist, sehen wir weiter.',
  },
  ping: {
    id: 'ping',
    name: 'Ping',
    owner: 'vex',
    ownerName: 'Vex',
    shopLabel: 'Tech-Labor',
    sector: 3,
    floor: 2,
    sectorName: 'Solar-Gießerei',
    discount: 0.1,
    effectText: 'Tech-Labor: −10 % Credits auf Modul-Upgrades',
    color: '#38bdf8',
    hint:
      'Meine Echo-Sonde Ping hat sich in der Gießerei an ein Signal geheftet und ist hängen geblieben. Ihr Peilton kommt aus Ebene II, aus einem Käfig. Sie hört auf deine Stimme, wenn du nah genug bist.',
    hintEarly: 'Ping ist in der Solar-Gießerei verloren gegangen. Ohne Sektor 3 kommen wir nicht an ihr Signal.',
  },
  midnight: {
    id: 'midnight',
    name: 'Mitternacht',
    owner: 'nyx',
    ownerName: 'Nyx',
    shopLabel: 'Schwarzmarkt',
    sector: 4,
    floor: 2,
    sectorName: 'Ältesten-Monolith',
    discount: 0.1,
    effectText: 'Schwarzmarkt: −10 % Preise & 1 zusätzliches seltenes Angebot',
    color: '#c084fc',
    hint:
      'Meine Katze ist weg. Sie ist durch dein Schiff gehuscht und im Ältesten-Monolith gelandet. Ebene II, hinter einem Käfig aus Licht. Nicht im Katalog, aber trotzdem meine. Hol sie.',
    hintEarly: 'Mitternacht ist im Ältesten-Monolith. Nyx will nicht darüber reden. Ich würde warten, bis du dort bist.',
  },
};

/** Welche Crew ist in diesem Sektor gefangen (Ebene II)? */
export function crewForSector(sector: number): CrewId | null {
  for (const id of CREW_ORDER) if (CREW_DEFS[id].sector === sector) return id;
  return null;
}

export function crewForOwner(npc: StoryNpcId): CrewId | null {
  for (const id of CREW_ORDER) if (CREW_DEFS[id].owner === npc) return id;
  return null;
}

/** Ein-Box-Szene für den Hinweis eines Shop-Besitzers (nur Anzeige, nicht Teil von STORY_SCENES). */
export function crewHintScene(id: CrewId, reachable: boolean): StoryScene {
  const def = CREW_DEFS[id];
  return {
    id: `crew_hint_${id}`,
    npc: def.owner,
    chapter: 0,
    title: `Vermisst: ${def.name}`,
    start: 'n1',
    nodes: { n1: { speaker: def.owner, text: reachable ? def.hint : def.hintEarly, next: 'end' } },
  };
}
