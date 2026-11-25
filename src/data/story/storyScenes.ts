/**
 * Meilenstein 10-A — Gesprächsszenen als Dialog-Graphen (reine Daten).
 * Regeln (siehe MILESTONE_10_ARCHITECTURE.md §1.1/§4.0): ≤ 180 Zeichen pro Box, ≤ 8 Boxen pro Pfad,
 * ≤ 3 Antworten, Erzähltext sparsam. Geprüft durch validateStoryScenes() in storyEngine.ts.
 */
import type { StoryScene } from './storyTypes';

export const STORY_SCENES: StoryScene[] = [
  {
    id: 'kael_c0',
    npc: 'kael',
    chapter: 0,
    title: 'Die leere Werkbank',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'kael',
        text: 'Noch ein Kapitän, der glaubt, die Wracks wären ein Spaziergang. Zeig mal deine Klinge.',
        next: 'n2',
      },
      n2: {
        speaker: 'narrator',
        text: 'Kael dreht die Klinge im Licht der Esse. Neben ihm steht eine zweite Werkbank — sauber, unberührt, als warte sie auf jemanden.',
        next: 'n3',
      },
      n3: {
        speaker: 'kael',
        text: 'Grobe Arbeit, aber ehrlich. Bring mir Schrott aus den Wracks, und ich mach dir was draus, das nicht beim ersten Hieb splittert.',
        choices: [
          {
            id: 'a',
            tone: 'direkt',
            label: 'Ich brauche keine Ratschläge. Nur gutes Werkzeug.',
            trust: { kael: 2 },
            chronicle: 'Du hast Kael gezeigt, dass du nicht drum herumredest.',
            next: 'a1',
          },
          {
            id: 'b',
            tone: 'neugierig',
            label: 'Für wen ist die zweite Werkbank?',
            setFlags: ['knows_juno'],
            chronicle: 'Du hast Kael nach der leeren Werkbank gefragt.',
            next: 'b1',
          },
          {
            id: 'c',
            tone: 'warm',
            label: 'Danke, Kael. Ich lerne gern vom Besten.',
            trust: { kael: 1 },
            chronicle: 'Du hast Kael für seine Hilfe gedankt.',
            next: 'c1',
          },
        ],
      },
      a1: {
        speaker: 'kael',
        text: 'Ha! Endlich jemand, der nicht drum herumredet. Wir verstehen uns, {captain}.',
        next: 'end',
      },
      b1: {
        speaker: 'kael',
        text: '… Für meine Schülerin. Juno. Sie ist mit der Korvette rausgeflogen. Vor drei Jahren. Frag nicht weiter.',
        next: 'b2',
      },
      b2: {
        speaker: 'narrator',
        text: 'Er wendet sich ab und schlägt härter auf den Amboss als nötig.',
        next: 'end',
      },
      c1: {
        speaker: 'kael',
        text: 'Hmpf. Schmeichelei schärft keine Klingen. … Schadet aber auch nicht.',
        next: 'end',
      },
    },
  },
];
