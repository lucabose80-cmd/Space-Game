/**
 * Meilenstein 10-A — Gesprächsszenen als Dialog-Graphen (reine Daten).
 * Regeln (siehe MILESTONE_10_ARCHITECTURE.md §1.1/§4.0): ≤ 180 Zeichen pro Box, ≤ 8 Boxen pro Pfad,
 * ≤ 3 Antworten, Erzähltext sparsam (≤ 2 Boxen pro Pfad). Geprüft durch validateStoryScenes() in storyEngine.ts.
 * Der Kapitän wird mit „du“ angesprochen (keine geschlechtsspezifischen Pronomen); {captain} = Kapitänsname.
 */
import type { StoryChoice, StoryScene, StoryTone } from './storyTypes';

type ChoiceExtra = Pick<StoryChoice, 'trust' | 'setFlags' | 'requires'>;

/** Kurzschreibweise für Antworten. */
function c(
  id: string,
  tone: StoryTone,
  label: string,
  chronicle: string,
  next: string,
  extra: ChoiceExtra = {},
): StoryChoice {
  return { id, tone, label, chronicle, next, ...extra };
}

export const STORY_SCENES: StoryScene[] = [
  // ======================= KAEL =======================
  {
    id: 'kael_c0', npc: 'kael', chapter: 0, title: 'Die leere Werkbank', start: 'n1',
    nodes: {
      n1: { speaker: 'kael', text: 'Noch ein Kapitän, der glaubt, die Wracks wären ein Spaziergang. Zeig mal deine Klinge.', next: 'n2' },
      n2: { speaker: 'narrator', text: 'Kael dreht die Klinge im Licht der Esse. Neben ihm steht eine zweite Werkbank — sauber, unberührt, als warte sie auf jemanden.', next: 'n3' },
      n3: {
        speaker: 'kael',
        text: 'Grobe Arbeit, aber ehrlich. Bring mir Schrott aus den Wracks, und ich mach dir was draus, das nicht beim ersten Hieb splittert.',
        choices: [
          c('a', 'direkt', 'Ich brauche keine Ratschläge. Nur gutes Werkzeug.', 'Du hast Kael gezeigt, dass du nicht drum herumredest.', 'a1', { trust: { kael: 2 } }),
          c('b', 'neugierig', 'Für wen ist die zweite Werkbank?', 'Du hast Kael nach der leeren Werkbank gefragt.', 'b1', { setFlags: ['knows_juno'] }),
          c('c', 'warm', 'Danke, Kael. Ich lerne gern vom Besten.', 'Du hast Kael für seine Hilfe gedankt.', 'c1', { trust: { kael: 1 } }),
        ],
      },
      a1: { speaker: 'kael', text: 'Ha! Endlich jemand, der nicht drum herumredet. Wir verstehen uns, {captain}.', next: 'end' },
      b1: { speaker: 'kael', text: '… Für meine Schülerin. Juno. Sie ist mit der Korvette rausgeflogen. Vor drei Jahren. Frag nicht weiter.', next: 'b2' },
      b2: { speaker: 'narrator', text: 'Er wendet sich ab und schlägt härter auf den Amboss als nötig.', next: 'end' },
      c1: { speaker: 'kael', text: 'Hmpf. Schmeichelei schärft keine Klingen. … Schadet aber auch nicht.', next: 'end' },
    },
  },
  {
    id: 'kael_c1', npc: 'kael', chapter: 1, title: 'Junos Zeichen', start: 'n1',
    nodes: {
      n1: { speaker: 'narrator', text: 'Kael hält einen geschmolzenen Splitter aus dem Kern des Leviathan in der Zange. Ins Metall ist ein kleines Zeichen geprägt: ein Stern über einem Hammer.', next: 'n2' },
      n2: {
        speaker: 'kael',
        text: 'Dieses Zeichen gehört meiner Schülerin Juno. Sie war auf der Korvette, als sie verschwand. Sie war dort, {captain}.',
        variants: [
          { when: { flag: 'knows_juno' }, text: 'Das ist Junos Zeichen. Ich hab es ihr selbst beigebracht. Sie war dort, {captain}. Im Herz von diesem Ding.' },
        ],
        next: 'n3',
      },
      n3: {
        speaker: 'kael',
        text: 'Der Reaktor war mit einer Schmiedenaht versiegelt. Von innen. Wer das gemacht hat, wusste, dass er nicht mehr rauskommt.',
        choices: [
          c('a', 'warm', 'Dann hat sie die Crew gerettet. Lass uns ihr ein Denkmal schmieden.', 'Du hast Kael geraten, Junos Opfer mit einem Denkmal zu ehren.', 'a1', { trust: { kael: 2 }, setFlags: ['kael_memorial'] }),
          c('b', 'direkt', 'Du kannst es nicht mehr ändern, Kael. Schmiede nach vorne.', 'Du hast Kael ermutigt, nach vorne zu schauen.', 'b1', { trust: { kael: 1 }, setFlags: ['kael_forward'] }),
          c('c', 'neugierig', 'Vielleicht hat sie überlebt?', 'Du hast Kael Hoffnung gemacht.', 'c1'),
        ],
      },
      a1: { speaker: 'kael', text: 'Ein Denkmal … aus dem Stahl, den sie gebändigt hat. Ja. Das machen wir.', next: 'a2' },
      a2: { speaker: 'narrator', text: 'Zum ersten Mal sieht Kael nicht wütend aus, sondern stolz.', next: 'end' },
      b1: { speaker: 'kael', text: '… Hart, aber wahr. Sie hätte dasselbe gesagt. Dann nach vorne — mit ihrem Stahl in deiner Klinge.', next: 'end' },
      c1: { speaker: 'kael', text: 'Hoffnung ist ein schlechtes Metall. Biegt sich, wenn man sie braucht.', next: 'c2' },
      c2: { speaker: 'kael', text: 'Aber … halt da draußen die Augen offen. Bitte.', next: 'end' },
    },
  },
  {
    id: 'kael_c2', npc: 'kael', chapter: 2, title: 'Kristall in der Esse', start: 'n1',
    nodes: {
      n1: { speaker: 'narrator', text: 'In Kaels Esse knistert violettes Licht. Er hält einen Kristallsplitter in der Zange, als wäre er aus Glas — und aus Glück.', next: 'n2' },
      n2: {
        speaker: 'kael',
        text: 'Kristall in der Esse. Knistert wie ein Lagerfeuer. Hätte nie gedacht, dass ich das mal sage.',
        variants: [
          { when: { flag: 'kael_memorial' }, text: 'Das Denkmal für Juno ist fertig. Aus ihrem Stahl, mit Kristallglut verziert. Dort drüben, siehst du? Ich … komme gern hin.' },
          { when: { flag: 'kael_forward' }, text: 'Hab eine neue Werkbank aufgebaut. Für Lehrlinge. Zwei Kinder vom Markt wollen lernen. Kristall in der Esse — das fasziniert sie.' },
        ],
        choices: [
          c('a', 'neugierig', 'Zeig mir, was du gemacht hast.', 'Du hast dir Kaels neueste Kristallarbeit zeigen lassen.', 'a1', { trust: { kael: 1 } }),
          c('b', 'direkt', 'Bring mir bei, wie das geht.', 'Du hast Kael gebeten, dir das Kristallschmieden beizubringen.', 'b1', { trust: { kael: 2 } }),
        ],
      },
      a1: { speaker: 'kael', text: 'Hier. Eine Klinge, deren Schneide im Dunkeln leuchtet. Nutzlos im Kampf, aber … schön. Sag keinem, dass ich das gesagt hab.', next: 'end2' },
      b1: { speaker: 'kael', text: 'Beibringen? Hah! Gut: Kristall nie zu heiß, nie zu schnell. Er singt, wenn er bereit ist. Hör hin.', next: 'end2' },
      end2: { speaker: 'kael', text: 'Ein Funke Talent hast du, {captain}. Ein kleiner.', next: 'end' },
    },
  },
  {
    id: 'kael_c3', npc: 'kael', chapter: 3, title: 'Der Schmied der Sonne', start: 'n1',
    nodes: {
      n1: { speaker: 'kael', text: 'Der Vulkan-Titan war ein Schmied, weißt du. Einer der Ältesten. Sein Werkzeug war perfekt. Kein Kratzer. Und trotzdem hat es ihn nicht gerettet.', next: 'n2' },
      n2: {
        speaker: 'kael',
        text: 'Ein Meister, der zum Monster wird. Das macht mir mehr Angst als jeder Boss. Wer sagt, dass ich nicht auch einer werde?',
        choices: [
          c('a', 'warm', 'Du bist nicht wie er.', 'Du hast Kael versichert, dass er nicht wie der Titan ist.', 'a1', { trust: { kael: 1 } }),
          c('b', 'direkt', 'Dann schmiede besser als er.', 'Du hast Kael herausgefordert, besser zu schmieden als der Titan.', 'b1', { trust: { kael: 2 } }),
        ],
      },
      a1: { speaker: 'kael', text: 'Nicht? … Vielleicht nicht. Er hatte niemanden. Ich hab dich. Und Lyra. Und Vex.', next: 'end2' },
      b1: { speaker: 'kael', text: 'Besser als ein Meister der Ältesten? Haha! Frechheit. … Aber gefällt mir.', next: 'end2' },
      end2: { speaker: 'narrator', text: 'Kael legt ein Stück Titan-Glut in seine Esse. Sie glimmt wärmer als zuvor.', next: 'end' },
    },
  },
  {
    id: 'kael_c4', npc: 'kael', chapter: 4, title: 'Junos letzte Nachricht', start: 'n1',
    nodes: {
      n1: { speaker: 'narrator', text: 'Vex hat ein rekonstruiertes Logbuch aus der Korvette gebracht. Aus dem Gerät knistert Junos Stimme: „Reaktor versiegelt … Sagt Kael, sein Stahl hat gehalten.“', next: 'n2' },
      n2: {
        speaker: 'kael',
        text: 'Sie wusste es. Sie hat es mit Absicht getan. Meine Schülerin. Sie hat die ganze Crew gerettet und mir ausrichten lassen, dass mein Stahl hält.',
        choices: [
          c('a', 'warm', 'Sie war eine Heldin.', 'Du hast Juno vor Kael eine Heldin genannt.', 'a1', { trust: { kael: 2 } }),
          c('b', 'direkt', 'Sie hat von dir gelernt.', 'Du hast Kael daran erinnert, dass Juno von ihm gelernt hat.', 'b1', { trust: { kael: 2 } }),
          c('c', 'warm', '(Hand auf seine Schulter legen.)', 'Du hast Kael wortlos die Hand auf die Schulter gelegt.', 'c1', { trust: { kael: 1 } }),
        ],
      },
      a1: { speaker: 'kael', text: 'Ja. Das war sie. … Und ich war zu stur, um es früher zu sehen.', next: 'end2' },
      b1: { speaker: 'kael', text: 'Von mir? … Nein. Sie war besser als ich. Aber ich hab ihr beigebracht, nicht aufzugeben.', next: 'end2' },
      c1: { speaker: 'narrator', text: 'Du legst Kael wortlos die Hand auf die Schulter. Er nickt, ohne aufzusehen, und seine Schultern sinken ein kleines Stück.', next: 'end2' },
      end2: { speaker: 'kael', text: 'Danke. Für alles.', next: 'end' },
    },
  },
  {
    id: 'kael_c5', npc: 'kael', chapter: 5, title: 'Feuer für das Fest', start: 'n1',
    nodes: {
      n1: { speaker: 'kael', text: 'Ich baue das Feuerwerk für heute Abend. Aus Restfunken der Esse. Ein Schmied, der Feuerwerk baut! Wenn das meine Mutter sähe.', next: 'n2' },
      n2: {
        speaker: 'kael',
        text: 'Ich hab alles so gelegt, dass die Funken die Farben der vier Sektoren treffen. Wenn das klappt, kriegt die Station eine Show.',
        variants: [
          { when: { flag: 'kael_memorial' }, text: 'In die Mitte formen sie einen Stern: Junos Stern. Kein Kommentar. Kein Wort davon zu irgendwem.' },
        ],
        choices: [
          c('a', 'direkt', 'Lass mich helfen.', 'Du hast Kael beim Feuerwerk geholfen.', 'a1', { trust: { kael: 1 } }),
          c('b', 'warm', 'Du hast dir eine Pause verdient.', 'Du hast Kael eine Pause nahegelegt.', 'b1', { trust: { kael: 1 } }),
        ],
      },
      a1: { speaker: 'kael', text: 'Hilfst du mir? Gut. Halt die Zündschnur. Nicht loslassen. Nie.', next: 'end2' },
      b1: { speaker: 'kael', text: 'Pause? Hah. Wenn ich pausiere, rost ich. … Aber vielleicht ein Becher auf dem Platz.', next: 'end2' },
      end2: { speaker: 'kael', text: 'Und, {captain}? … Gut gemacht da draußen. Ich mein’s ernst.', next: 'end' },
    },
  },
  {
    id: 'kael_c6', npc: 'kael', chapter: 6, title: 'Alles von vorn', start: 'n1',
    nodes: {
      n1: {
        speaker: 'kael',
        text: 'Alles von vorn, hm? Gut. Diesmal mit besseren Klingen.',
        variants: [
          { when: { flag: 'kael_memorial' }, text: 'Alles von vorn? Gut. Schau — Junos Stern hab ich in deine Klinge geprägt. Er bringt kein Glück. Aber er erinnert dich, wofür du kämpfst.' },
          { when: { flag: 'kael_forward' }, text: 'Alles von vorn? Gut. Meine Lehrlinge haben deine Klinge poliert. Zum ersten Mal ohne dass ich eingreifen musste. Sie lernen schnell.' },
        ],
        next: 'n2',
      },
      n2: {
        speaker: 'kael',
        text: 'Die alten Wracks sind wach. Wütender als beim ersten Mal. Ich schmied dir, was ich kann.',
        choices: [
          c('a', 'direkt', 'Diesmal besser.', 'Du hast Kael versprochen, es diesmal besser zu machen.', 'a1', { trust: { kael: 1 } }),
          c('b', 'warm', 'Mit euch allen im Rücken.', 'Du hast Kael gesagt, dass du auf die Station im Rücken zählst.', 'b1', { trust: { kael: 1 } }),
        ],
      },
      a1: { speaker: 'kael', text: 'Das will ich hören. Dann los, {captain}.', next: 'end' },
      b1: { speaker: 'kael', text: 'Im Rücken. Hah. Wir haben dich im Rücken, nicht umgekehrt. … Aber schön gesagt.', next: 'end' },
    },
  },

  // ======================= LYRA =======================
  {
    id: 'lyra_c0', npc: 'lyra', chapter: 0, title: 'Erste Visite', start: 'n1',
    nodes: {
      n1: { speaker: 'lyra', text: 'Willkommen auf Port Solaris, Kapitän. Hier flicken wir alles — auch Kapitäne. Setz dich kurz, ich schaue nach deinen Reflexen.', next: 'n2' },
      n2: { speaker: 'narrator', text: 'Lyra leuchtet dir mit einer kleinen Lampe in die Augen und notiert etwas. Im Regal hinter ihr stapeln sich Berichte über „Summen im Schlaf“.', next: 'n3' },
      n3: {
        speaker: 'lyra',
        text: 'Seltsam: In letzter Zeit klagen viele über ein Summen im Schlaf. Wie Wind in einer Röhre. Hast du so etwas schon mal gehört?',
        choices: [
          c('a', 'warm', 'Nein, aber ich halte die Ohren offen.', 'Du hast Lyra versprochen, die Ohren offen zu halten.', 'a1', { trust: { lyra: 1 } }),
          c('b', 'direkt', 'Klingt nach Raumkoller.', 'Du hast Lyras Sorge als Raumkoller abgetan.', 'b1'),
        ],
      },
      a1: { speaker: 'lyra', text: 'Danke. Manchmal hilft es schon, wenn jemand zuhört.', next: 'end2' },
      b1: { speaker: 'lyra', text: 'Möglich. Raumkoller macht reizbar, nicht hellhörig. Aber du kennst die Stationsluft besser als ich.', next: 'end2' },
      end2: { speaker: 'lyra', text: 'Hier, ein Pflaster. Für später. Komm vorbei, bevor du gehst — nicht erst danach.', next: 'end' },
    },
  },
  {
    id: 'lyra_c1', npc: 'lyra', chapter: 1, title: 'Das erste Licht', start: 'n1',
    nodes: {
      n1: { speaker: 'narrator', text: 'Über der Promenade glimmen die Lichterketten auf. In Lyras Praxis schläft eine Patientin — zum ersten Mal seit Wochen ohne Unruhe.', next: 'n2' },
      n2: { speaker: 'lyra', text: 'Seit dem Leviathan ist es stiller geworden. Meine Patienten wachen nicht mehr schweißgebadet auf. Ich wollte es dir sagen. Persönlich.', next: 'n3' },
      n3: {
        speaker: 'lyra',
        text: 'Ich weiß nicht, ob es Zufall ist. Aber ich schreibe es auf. Immer aufschreiben, das ist meine Regel.',
        choices: [
          c('a', 'warm', 'Freut mich für sie. Und für dich.', 'Du hast dich mit Lyra über die ruhigeren Nächte gefreut.', 'a1', { trust: { lyra: 1 } }),
          c('b', 'neugierig', 'Zufall oder Zusammenhang? Sprich mit Vex.', 'Du hast Lyra geraten, ihre Notizen mit Vex zu besprechen.', 'b1', { trust: { lyra: 1, vex: 1 } }),
        ],
      },
      a1: { speaker: 'lyra', text: 'Danke. Das bedeutet mir mehr, als ich sage. Ich notiere es: Leviathan besiegt, Echo leiser.', next: 'end' },
      b1: { speaker: 'lyra', text: 'Vex? Sie redet schneller, als ich zuhören kann. Aber gut. Ich bringe ihr meine Notizen: Leviathan besiegt, Echo leiser.', next: 'b2' },
      b2: { speaker: 'lyra', text: 'Zwei Köpfe, ein Rätsel. Danke für den Anstoß.', next: 'end' },
    },
  },
  {
    id: 'lyra_c2', npc: 'lyra', chapter: 2, title: 'Das Echo-Fieber', start: 'n1',
    nodes: {
      n1: { speaker: 'lyra', text: 'Seit du den Prisma-Archon besiegt hast, kommen mehr Leute zu mir. Sie hören etwas im Schlaf. Ein Summen, wie Kristall unter einem Finger.', next: 'n2' },
      n2: {
        speaker: 'lyra',
        text: 'Die Händler wollen, dass ich schweige — schlecht fürs Geschäft. Aber die Kranken brauchen einen Ort, an dem sie keine Angst haben müssen.',
        choices: [
          c('a', 'warm', 'Eröffne eine Echo-Station. Ich stehe hinter dir.', 'Du hast Lyra ermutigt, die Echo-Station zu eröffnen.', 'a1', { trust: { lyra: 2 }, setFlags: ['lyra_clinic'] }),
          c('b', 'vorsichtig', 'Halte es ruhig, bis wir mehr wissen.', 'Du hast Lyra zur Vorsicht geraten.', 'b1', { trust: { lyra: 1 } }),
          c('c', 'neugierig', 'Vex untersucht das Signal. Arbeitet zusammen.', 'Du hast Lyra und Vex zusammengebracht.', 'c1', { trust: { lyra: 1, vex: 1 } }),
        ],
      },
      a1: { speaker: 'lyra', text: 'Du meinst das ernst? Dann hänge ich heute noch das Schild auf. Danke, {captain}.', next: 'end' },
      b1: { speaker: 'lyra', text: 'Vielleicht hast du recht. Panik hilft niemandem. Aber ich führe Buch über jeden Fall.', next: 'end' },
      c1: { speaker: 'lyra', text: 'Vex? Sie redet schneller, als ich zuhören kann … Aber gut. Zwei Köpfe, ein Rätsel.', next: 'end' },
    },
  },
  {
    id: 'lyra_c3', npc: 'lyra', chapter: 3, title: 'Brandsalbe & Geduld', start: 'n1',
    nodes: {
      n1: {
        speaker: 'lyra',
        text: 'Drei Gießerei-Arbeiter mit Verbrennungen liegen hier. Und die Brandsalbe ist fast alle. Ich stehe seit Sonnenaufgang auf den Beinen.',
        variants: [
          { when: { flag: 'lyra_clinic' }, text: 'Die Echo-Station ist voll, dazu die Brandfälle aus der Gießerei. Seit gestern habe ich nicht richtig geschlafen — und es fühlt sich richtig an.' },
        ],
        next: 'n2',
      },
      n2: {
        speaker: 'lyra',
        text: 'Ich brauche nichts. Wirklich. Es geht schon.',
        choices: [
          c('a', 'warm', 'Brauchst du Hilfe? Ich kann Material besorgen.', 'Du hast Lyra deine Hilfe angeboten.', 'a1', { trust: { lyra: 2 } }),
          c('b', 'direkt', 'Du arbeitest zu viel.', 'Du hast Lyra gesagt, dass sie zu viel arbeitet.', 'b1', { trust: { lyra: 1 } }),
        ],
      },
      a1: { speaker: 'lyra', text: 'Du würdest …? Ja. Bio-Gel, wenn du welches findest. Es ist das Einzige, das die Narben mildert.', next: 'end2' },
      b1: { speaker: 'lyra', text: 'Ja. Ich weiß. Und du? Wer sagt dir das?', next: 'end2' },
      end2: { speaker: 'narrator', text: 'Lyra lacht — zum ersten Mal richtig, laut, mit zurückgeworfenem Kopf. Es klingt, als hätte jemand ein Fenster aufgestoßen.', next: 'end' },
    },
  },
  {
    id: 'lyra_c4', npc: 'lyra', chapter: 4, title: 'Die erste Expedition', start: 'n1',
    nodes: {
      n1: { speaker: 'lyra', text: 'Ich muss dir etwas gestehen. Bevor das hier war, war ich Ärztin der ersten Expedition in den Ältesten-Monolith. Wir waren zwölf.', next: 'n2' },
      n2: {
        speaker: 'lyra',
        text: 'Sieben kamen zurück. Fünf Verletzte konnte ich nicht tragen. Ich musste entscheiden. Und ich habe jeden Tag seither daran gedacht.',
        choices: [
          c('a', 'warm', 'Du hast getan, was du konntest.', 'Du hast Lyra zugesprochen, dass sie ihr Möglichstes getan hat.', 'a1', { trust: { lyra: 2 }, setFlags: ['lyra_told_truth'] }),
          c('b', 'direkt', 'Warum erzählst du es erst jetzt?', 'Du hast Lyra gefragt, warum sie erst jetzt davon erzählt.', 'b1', { setFlags: ['lyra_told_truth'] }),
          c('c', 'vorsichtig', 'Das muss nicht heute sein.', 'Du hast Lyra Zeit gelassen.', 'c1', { trust: { lyra: 1 } }),
        ],
      },
      a1: { speaker: 'lyra', text: 'Das sagen alle. Aber von dir glaube ich es fast.', next: 'end2' },
      b1: { speaker: 'lyra', text: 'Weil du den Sternen-Archon besiegt hast. Weil du dort warst. Weil ich nicht mehr allein damit sein will.', next: 'end2' },
      c1: { speaker: 'lyra', text: 'Nein. … Danke. Ich wollte es nur einmal ausgesprochen haben. Es reicht fürs Erste.', next: 'end2' },
      end2: { speaker: 'lyra', text: 'Versprich mir, dass du vor dem Tor zu mir kommst.', next: 'end' },
    },
  },
  {
    id: 'lyra_c5', npc: 'lyra', chapter: 5, title: 'Endlich durchschlafen', start: 'n1',
    nodes: {
      n1: {
        speaker: 'lyra',
        text: 'Das Echo-Fieber verschwindet. Letzte Woche waren es dreißig Patienten, heute sind es zwei. Die Leute schlafen wieder durch.',
        variants: [
          { when: { flag: 'lyra_told_truth' }, text: 'Das Echo-Fieber verschwindet. Dreißig Patienten letzte Woche, heute zwei. Und ich schlafe auch wieder — seit dem Gespräch über die Expedition.' },
        ],
        next: 'n2',
      },
      n2: {
        speaker: 'lyra',
        text: 'Ich dachte, ich fühle mich leer, wenn alles vorbei ist. Aber es fühlt sich … leicht an.',
        choices: [
          c('a', 'warm', 'Und du? Schläfst du auch?', 'Du hast dich bei Lyra nach ihrem eigenen Schlaf erkundigt.', 'a1', { trust: { lyra: 2 } }),
          c('b', 'direkt', 'Gut gemacht, Doktor.', 'Du hast Lyra für ihre Arbeit gelobt.', 'b1', { trust: { lyra: 1 } }),
        ],
      },
      a1: { speaker: 'lyra', text: 'Heute Nacht, glaube ich, zum ersten Mal richtig. Danke, dass du fragst.', next: 'end2' },
      b1: { speaker: 'lyra', text: 'Doktor. Das klingt nach Respekt. Danke.', next: 'end2' },
      end2: { speaker: 'lyra', text: 'Ruh dich aus, {captain}. Wirklich.', next: 'end' },
    },
  },
  {
    id: 'lyra_c6', npc: 'lyra', chapter: 6, title: 'Neue Narben', start: 'n1',
    nodes: {
      n1: {
        speaker: 'lyra',
        text: 'Ein neuer Zyklus. Neue Narben, nehme ich an. Die Med-Bay ist bereit. Wie immer.',
        variants: [
          { when: { flag: 'lyra_clinic' }, text: 'Ein neuer Zyklus. Die Echo-Station ist inzwischen ein Ort für alle, die nachts nicht schlafen können. Das Schild hängt noch. Ich lasse es dort.' },
          { when: { flag: 'lyra_told_truth' }, text: 'Ein neuer Zyklus. Neue Narben, nehme ich an. Und ich habe Frieden mit der Expedition gemacht. Ich glaube, das hast du mir geschenkt.' },
        ],
        next: 'n2',
      },
      n2: {
        speaker: 'lyra',
        text: 'Was auch kommt: Ich bin hier.',
        choices: [
          c('a', 'warm', 'Die Med-Bay ist mein Zuhause.', 'Du hast Lyra gesagt, dass die Med-Bay dein Zuhause ist.', 'a1', { trust: { lyra: 1 } }),
          c('b', 'direkt', 'Halt die Betten frei.', 'Du hast Lyra gebeten, die Betten freizuhalten.', 'b1', { trust: { lyra: 1 } }),
        ],
      },
      a1: { speaker: 'lyra', text: 'Zuhause. Ja. Das gefällt mir als Wort. Wie immer, {captain}.', next: 'end' },
      b1: { speaker: 'lyra', text: 'Immer. Wie immer, {captain}.', next: 'end' },
    },
  },

  // ======================= NYX =======================
  {
    id: 'nyx_c0', npc: 'nyx', chapter: 0, title: 'Nicht im Katalog', start: 'n1',
    nodes: {
      n1: { speaker: 'nyx', text: 'Psst. Nicht jede Ware steht im Katalog. Manche steht nur in meinem Kopf.', next: 'n2' },
      n2: { speaker: 'narrator', text: 'Nyx lehnt sich über den Tresen. Zwischen ihren Fingern wandert eine Münze hin und her, ohne je herunterzufallen.', next: 'n3' },
      n3: {
        speaker: 'nyx',
        text: 'Ein Rätsel für Neue: Ich verkaufe dir einen Schlüssel ohne Schloss. Kaufst du?',
        choices: [
          c('a', 'vorsichtig', 'Erst will ich das Schloss sehen.', 'Du hast von Nyx erst das Schloss sehen wollen.', 'a1', { trust: { nyx: 2 } }),
          c('b', 'direkt', 'Wenn er glänzt, gern.', 'Du hättest Nyx’ Schlüssel gern gekauft, wenn er glänzt.', 'b1', { trust: { nyx: 1 } }),
        ],
      },
      a1: { speaker: 'nyx', text: 'Hah. Klug. Die meisten fragen nach dem Preis, nicht nach dem Schloss.', next: 'end2' },
      b1: { speaker: 'nyx', text: 'Er glänzt. Aber Glanz ist selten das Wichtigste.', next: 'end2' },
      end2: { speaker: 'nyx', text: 'Komm wieder, wenn du mehr Mut als Credits hast.', next: 'end' },
    },
  },
  {
    id: 'nyx_c1', npc: 'nyx', chapter: 1, title: 'Reaktorkern-Interessenten', start: 'n1',
    nodes: {
      n1: { speaker: 'nyx', text: 'Du hast den Leviathan gefällt. Und plötzlich fragen Leute nach seinem Reaktorkern. Ungewöhnlich viele. Ungewöhnlich höflich.', next: 'n2' },
      n2: { speaker: 'narrator', text: 'Nyx wirft eine goldene Münze in die Luft und fängt sie wieder. Auf der Rückseite glänzt ein Ring wie eine kleine Sonne.', next: 'n3' },
      n3: {
        speaker: 'nyx',
        text: 'Jemand will wissen, ob du verkaufst. Und zwar gut. Sehr gut.',
        choices: [
          c('a', 'neugierig', 'Für wen fragst du?', 'Du hast Nyx gefragt, wer nach dem Reaktorkern fragt.', 'a1', { trust: { nyx: 1 } }),
          c('b', 'vorsichtig', 'Der Kern bleibt bei mir.', 'Du hast Nyx gesagt, dass der Reaktorkern bei dir bleibt.', 'b1', { trust: { nyx: 2 } }),
        ],
      },
      a1: { speaker: 'nyx', text: 'Für jemanden, der seinen Namen lieber im Schatten lässt. Mehr gibt’s nicht — umsonst.', next: 'a2' },
      a2: { speaker: 'nyx', text: 'Aber ich sag dir Bescheid, wenn jemand zu aufdringlich wird.', next: 'end' },
      b1: { speaker: 'nyx', text: 'Gute Antwort. Behalt ihn. Und behalte auch, wer danach gefragt hat.', next: 'b2' },
      b2: { speaker: 'nyx', text: 'Ich glaube, wir beide verstehen uns, {captain}.', next: 'end' },
    },
  },
  {
    id: 'nyx_c2', npc: 'nyx', chapter: 2, title: 'Zu viele Fragen', start: 'n1',
    nodes: {
      n1: { speaker: 'nyx', text: 'Auf dem Markt fragen Fremde nach dir. Wann du startest, welche Routen du nimmst, wie dein Laden läuft. Sehr interessiert. Sehr freundlich.', next: 'n2' },
      n2: {
        speaker: 'nyx',
        text: 'Freundlich ist verdächtig. Ich dachte, du solltest das wissen. Gratis. Ausnahmsweise.',
        choices: [
          c('a', 'warm', 'Danke für die Warnung.', 'Du hast Nyx für die Warnung gedankt.', 'a1', { trust: { nyx: 1 } }),
          c('b', 'vorsichtig', 'Wer genau?', 'Du hast Nyx gefragt, wer sich nach dir erkundigt.', 'b1', { trust: { nyx: 2 } }),
        ],
      },
      a1: { speaker: 'nyx', text: 'Gern geschehen. Sag es nicht weiter, sonst ruiniere ich meinen Ruf.', next: 'end2' },
      b1: { speaker: 'nyx', text: 'Zwei Gesichter, die ich nicht kenne. Ein Mann mit Handschuhen. Eine Frau mit viel zu sauberen Stiefeln.', next: 'end2' },
      end2: { speaker: 'nyx', text: 'Halt die Augen offen in der Gießerei. Da unten sind die Wände dünn.', next: 'end' },
    },
  },
  {
    id: 'nyx_c3', npc: 'nyx', chapter: 3, title: 'Der Mann mit dem Ring', start: 'n1',
    nodes: {
      n1: { speaker: 'narrator', text: 'Ein Fremder in schwarzem Mantel verlässt Nyx’ Stand. An seiner Hand blitzt ein goldener Sonnenring. Er sieht dich an. Nur kurz. Dann ist er in der Menge.', next: 'n2' },
      n2: {
        speaker: 'nyx',
        text: 'Du hast ihn gesehen. Natürlich hast du das.',
        choices: [
          c('a', 'neugierig', 'Wer war das?', 'Du hast Nyx nach dem Mann mit dem Sonnenring gefragt.', 'a1', { trust: { nyx: 1 }, setFlags: ['nyx_helion_known'] }),
          c('b', 'vorsichtig', 'Ich hab nichts gesehen.', 'Du hast Nyx versichert, nichts gesehen zu haben.', 'b1', { trust: { nyx: 1 } }),
        ],
      },
      a1: { speaker: 'nyx', text: 'Ein Bote. Von einer Firma, die sich Helion nennt. Mehr Name kriegst du nicht.', next: 'a2' },
      a2: { speaker: 'nyx', text: 'Neugier kostet extra, {captain}.', next: 'end' },
      b1: { speaker: 'nyx', text: 'Gut. Dann haben wir beide nichts gesehen.', next: 'b2' },
      b2: { speaker: 'nyx', text: 'Schweigen ist Gold. Das ist übrigens kein Spruch, sondern mein Geschäftsmodell.', next: 'end' },
    },
  },
  {
    id: 'nyx_c4', npc: 'nyx', chapter: 4, title: 'Der Sonnenring', start: 'n1',
    nodes: {
      n1: { speaker: 'narrator', text: 'Hinter Nyx’ Stand flackert ein verschlüsselter Bildschirm. Bevor sie ihn zuklappt, blitzt ein Logo auf: ein goldener Sonnenring.', next: 'n2' },
      n2: { speaker: 'nyx', text: 'Du hast nichts gesehen. … Na gut. Du hast etwas gesehen.', next: 'n3' },
      n3: {
        speaker: 'nyx',
        text: 'Das Helion-Konsortium will die Koordinaten des 5. Tors. Sie zahlen genug, um diesen ganzen Markt zu kaufen. Mich eingeschlossen.',
        choices: [
          c('a', 'direkt', 'Sag ihnen ab, Nyx. Port Solaris ist mehr wert als ihr Geld.', 'Du hast Nyx aufgefordert, Helion abzusagen.', 'a1', { trust: { nyx: 1 }, setFlags: ['nyx_confronted'] }),
          c('b', 'vorsichtig', 'Ich habe nichts gesehen. Das ist deine Sache.', 'Du hast Nyx’ Geheimnis für dich behalten.', 'b1', { trust: { nyx: 2 }, setFlags: ['nyx_covered'] }),
          c('c', 'neugierig', 'Ich weiß schon länger von Helion. Ich habe gewartet, bis du es sagst.', 'Du hast Nyx gezeigt, dass du ihr Geheimnis längst kanntest.', 'c1', { trust: { nyx: 2 }, setFlags: ['nyx_confronted'], requires: { flag: 'nyx_helion_known' } }),
        ],
      },
      a1: { speaker: 'nyx', text: 'Mehr wert? Du klingst wie jemand, der nie Schulden hatte.', next: 'a2' },
      a2: { speaker: 'narrator', text: 'Sie starrt lange auf den zugeklappten Bildschirm.', next: 'a3' },
      a3: { speaker: 'nyx', text: 'Ich denk drüber nach. Mehr versprech ich nicht.', next: 'end' },
      b1: { speaker: 'nyx', text: 'Klüger, als du aussiehst, {captain}. Ich werde mich daran erinnern.', next: 'end' },
      c1: { speaker: 'nyx', text: 'Du hast mich durchschaut und trotzdem bei mir gekauft? Entweder bist du verrückt oder ein Freund. Vielleicht beides.', next: 'end' },
    },
  },
  {
    id: 'nyx_c5', npc: 'nyx', chapter: 5, title: 'Falsche Koordinaten', start: 'n1',
    nodes: {
      n1: {
        speaker: 'nyx',
        text: 'Helion hat aufgegeben. Für jetzt. Ihre Boten sind abgereist. Ob sie wiederkommen? Immer.',
        variants: [
          { when: { flag: 'nyx_redeemed' }, text: 'Ich hab Helion Koordinaten geschickt. Falsche. Sie führen ins Nichts, tausend Lichtjahre vom nächsten Stern. Ihre Schiffe suchen jetzt dort. Gern geschehen.' },
        ],
        next: 'n2',
      },
      n2: {
        speaker: 'nyx',
        text: 'Ich dachte, du solltest es von mir hören. Wir sind quitt, du und ich. Oder fast.',
        choices: [
          c('a', 'warm', 'Danke, Nyx.', 'Du hast Nyx gedankt.', 'a1', { trust: { nyx: 1 } }),
          c('b', 'neugierig', 'Und was jetzt?', 'Du hast Nyx gefragt, wie es weitergeht.', 'b1', { trust: { nyx: 1 } }),
        ],
      },
      a1: {
        speaker: 'nyx',
        text: 'Gern. Ich sag’s ungern zweimal: Du bist okay, {captain}.',
        variants: [
          { when: { flag: 'nyx_redeemed' }, text: 'Danke mir nicht. Lass mich am Stand eine Laterne aufhängen. Eine, die etwas bedeutet: Freihandel.' },
        ],
        next: 'end',
      },
      b1: {
        speaker: 'nyx',
        text: 'Jetzt? Jetzt warte ich. Man weiß nie, wer als Nächstes mit einem Ring zur Tür hereinkommt.',
        variants: [
          { when: { flag: 'nyx_redeemed' }, text: 'Jetzt hänge ich eine Laterne auf. Freihandel. Und ich verkaufe wieder ehrlich — oder zumindest ehrlicher.' },
        ],
        next: 'end',
      },
    },
  },
  {
    id: 'nyx_c6', npc: 'nyx', chapter: 6, title: 'Für Veteranen', start: 'n1',
    nodes: {
      n1: {
        speaker: 'nyx',
        text: 'Veteran. Hah. Manche Geschichten wiederholen sich. Die guten werden teurer.',
        variants: [
          { when: { flag: 'nyx_redeemed' }, text: 'Veteran. Hah. Die Laterne am Stand brennt, und ich verkaufe wieder ehrlicher. Sagen wir: ehrlich genug.' },
        ],
        next: 'n2',
      },
      n2: {
        speaker: 'nyx',
        text: 'Ich hab da was für Veteranen … Keine Sorge, nichts Illegales. Ziemlich.',
        variants: [
          { when: { flag: 'nyx_confronted' }, text: 'Ich weiß noch, wie du Helion die Tür gewiesen hast. Das vergesse ich nicht. Ich hab da was für Veteranen … ziemlich legal.' },
          { when: { flag: 'nyx_covered' }, text: 'Ich weiß noch, wie du geschwiegen hast. Das vergesse ich nicht. Ich hab da was für Veteranen … ziemlich legal.' },
        ],
        choices: [
          c('a', 'neugierig', 'Was hast du?', 'Du hast Nyx gefragt, was sie für Veteranen hat.', 'a1', { trust: { nyx: 1 } }),
          c('b', 'warm', 'Ich vertraue dir.', 'Du hast Nyx gesagt, dass du ihr vertraust.', 'b1', { trust: { nyx: 1 } }),
        ],
      },
      a1: { speaker: 'nyx', text: 'Eine Geschichte. Die kostet nichts. Ausnahmsweise.', next: 'a2' },
      a2: { speaker: 'narrator', text: 'Nyx zwinkert dir zu.', next: 'end' },
      b1: { speaker: 'nyx', text: 'Das ist gefährlich. Aber … danke.', next: 'b2' },
      b2: { speaker: 'narrator', text: 'Nyx zwinkert dir zu, und diesmal sieht es fast aufrichtig aus.', next: 'end' },
    },
  },

  // ======================= VEX =======================
  {
    id: 'vex_c0', npc: 'vex', chapter: 0, title: 'Frische Daten', start: 'n1',
    nodes: {
      n1: { speaker: 'vex', text: 'Ein neuer Kapitän! Perfekt! Schau — ich zeichne das Echo seit Wochen auf. Das Muster wiederholt sich alle 47 Sekunden. Alle. Siebenundvierzig.', next: 'n2' },
      n2: {
        speaker: 'vex',
        text: 'Meine Kollegen sagen Störfunk. Aber Störfunk hat keinen Rhythmus! Was denkst du?',
        choices: [
          c('a', 'neugierig', 'Was bedeutet das Muster?', 'Du hast Vex nach der Bedeutung des Echo-Musters gefragt.', 'a1', { trust: { vex: 2 } }),
          c('b', 'direkt', 'Klingt nach Störfunk.', 'Du hast das Echo-Muster als Störfunk bezeichnet.', 'b1', { trust: { vex: -1 } }),
        ],
      },
      a1: { speaker: 'vex', text: 'Keine Ahnung! Aber genau das macht es so schön! Ich vermute eine Kennung — oder eine Warnung.', next: 'end2' },
      b1: { speaker: 'vex', text: 'Störfunk … ja. Natürlich. Das sagen alle. Aber nett, dass du ehrlich bist!', next: 'end2' },
      end2: { speaker: 'vex', text: 'Ich finde es heraus. Und du bringst mir Wrack-Daten, ja? Versprochen?', next: 'end' },
    },
  },
  {
    id: 'vex_c1', npc: 'vex', chapter: 1, title: 'Das zweite Signal', start: 'n1',
    nodes: {
      n1: { speaker: 'vex', text: 'Das Signal aus Sektor 1 ist verstummt! Seit dem Leviathan — nichts mehr. Aber! Ein zweites wird lauter. Aus dem Kristall-Nebel!', next: 'n2' },
      n2: {
        speaker: 'vex',
        text: 'Und es klingt anders. Weicher. Fast wie … Musik. Ich hab es durch drei Filter geschickt.',
        choices: [
          c('a', 'neugierig', 'Spiel es mir vor.', 'Du hast dir von Vex das zweite Signal vorspielen lassen.', 'a1', { trust: { vex: 2 } }),
          c('b', 'vorsichtig', 'Kann es gefährlich sein?', 'Du hast Vex gefragt, ob das zweite Signal gefährlich sein kann.', 'b1', { trust: { vex: 1 } }),
        ],
      },
      a1: { speaker: 'narrator', text: 'Vex dreht an einem Regler. Aus dem Lautsprecher perlt ein heller, wechselnder Klang, wie ein Finger auf Glas.', next: 'a2' },
      a2: { speaker: 'vex', text: 'Siehst du? Musik! Oder ein sehr hübscher Alarm.', next: 'a3' },
      a3: { speaker: 'narrator', text: 'Vex summt die Melodie mit — schief, aber mit Hingabe.', next: 'end' },
      b1: { speaker: 'vex', text: 'Gefährlich? Hm. Alles Unbekannte ist potenziell gefährlich! Aber Musik tut selten weh.', next: 'b2' },
      b2: { speaker: 'vex', text: 'Ich bleibe vorsichtig. Versprochen. Meistens.', next: 'b3' },
      b3: { speaker: 'narrator', text: 'Vex summt die Melodie vor sich hin — falsch, aber glücklich.', next: 'end' },
    },
  },
  {
    id: 'vex_c2', npc: 'vex', chapter: 2, title: 'Linsen aus Licht', start: 'n1',
    nodes: {
      n1: { speaker: 'vex', text: 'Ich hab es! Teilweise! Das Echo — es sind Koordinaten! Vier Reihen, immer dieselbe Struktur. Vier Siegel. Vier Orte!', next: 'n2' },
      n2: {
        speaker: 'vex',
        text: 'Ich möchte es der ganzen Station zeigen. Die Leute haben Angst vor dem Summen. Wenn sie wissen, was es ist … Aber vielleicht ist es zu früh?',
        choices: [
          c('a', 'neugierig', 'Erzähl es allen!', 'Du hast Vex ermutigt, das Echo öffentlich zu machen.', 'a1', { trust: { vex: 2 }, setFlags: ['vex_shared_signal'] }),
          c('b', 'vorsichtig', 'Behalte es vorerst für uns.', 'Du hast Vex geraten, das Echo vorerst geheim zu halten.', 'b1', { trust: { vex: 1 } }),
        ],
      },
      a1: { speaker: 'vex', text: 'Ja! Wissen ist Licht! Ich hänge heute Abend ein Diagramm an die Promenade!', next: 'end2' },
      b1: { speaker: 'vex', text: 'Hm. Vorsicht … ja, du hast recht. Erst absichern, dann verkünden.', next: 'end2' },
      end2: { speaker: 'vex', text: 'Tipp für den Nebel: Prismen bündeln Licht wie Linsen. Schieß mal auf eins — vertrau mir.', next: 'end' },
    },
  },
  {
    id: 'vex_c3', npc: 'vex', chapter: 3, title: 'Magnetfeld-Musik', start: 'n1',
    nodes: {
      n1: {
        speaker: 'vex',
        text: 'Die Gießerei ist ein Traum für Ingenieure! Magnetplatten im Boden — sie ziehen Metall an. Oder stoßen es ab. Je nach Polung!',
        variants: [
          { when: { flag: 'vex_shared_signal' }, text: 'Die halbe Station summt jetzt das Echo nach! Überall höre ich es. Und unten in der Gießerei: Magnetplatten! Sie ziehen Metall an — oder stoßen es ab.' },
        ],
        next: 'n2',
      },
      n2: {
        speaker: 'vex',
        text: 'Magnetplatten ziehen alles in ihren Kreis — dich, Gegner, Projektile. Alles, was Metall hat. Oder einfach Pech.',
        choices: [
          c('a', 'neugierig', 'Wie nutze ich die Platten?', 'Du hast Vex gefragt, wie man die Magnetplatten nutzt.', 'a1', { trust: { vex: 2 } }),
          c('b', 'neugierig', 'Und das Echo?', 'Du hast Vex nach dem Stand der Echo-Forschung gefragt.', 'b1', { trust: { vex: 1 } }),
        ],
      },
      a1: { speaker: 'vex', text: 'Locke Gegner hinein, dann schieb sie in Düsen! Die Strahlen schmelzen alles, was lange genug steht.', next: 'a2' },
      a2: { speaker: 'vex', text: 'Bosse sind zu schwer, die lassen sich nicht ziehen. Schade eigentlich!', next: 'end2' },
      b1: { speaker: 'vex', text: 'Noch nicht ganz entschlüsselt. Aber die Koordinaten verraten, wo das letzte Siegel liegt: im Ältesten-Monolith.', next: 'end2' },
      end2: { speaker: 'vex', text: 'Dort warten Teleporter. Paare, die dieselbe Farbe teilen. Merk dir das!', next: 'end' },
    },
  },
  {
    id: 'vex_c4', npc: 'vex', chapter: 4, title: 'Das Muster der Tore', start: 'n1',
    nodes: {
      n1: { speaker: 'vex', text: 'Das Echo ist entschlüsselt! Es ist keine Einladung, es ist eine Warnung. Die Ältesten haben es gesungen: „Öffnet das Tor nur, um es zu schließen.“', next: 'n2' },
      n2: {
        speaker: 'vex',
        text: 'Die vier Siegel halten etwas zurück. Die Omega-Anomalie. Jeder Wächter, den du besiegt hast, war ein Gefangener seiner eigenen Pflicht.',
        choices: [
          c('a', 'direkt', 'Dann schließen wir es.', 'Du hast Vex gesagt, dass ihr das Tor wieder schließen werdet.', 'a1', { trust: { vex: 1 } }),
          c('b', 'neugierig', 'Was steckt dahinter?', 'Du hast Vex gefragt, was hinter dem 5. Tor steckt.', 'b1', { trust: { vex: 2 } }),
        ],
      },
      a1: { speaker: 'vex', text: 'Genau! Das ist der Plan! Das 5. Tor ist offen — wir müssen hindurch, um es von innen zu versiegeln.', next: 'end2' },
      b1: { speaker: 'vex', text: 'Das weiß niemand! Ich vermute eine Energiequelle, vielleicht Zeit selbst … Ich will es sehen! Und gleichzeitig will ich es nicht.', next: 'end2' },
      end2: { speaker: 'narrator', text: 'Vex’ Messgeräte zittern leise, als würden sie das Tor schon spüren.', next: 'end' },
    },
  },
  {
    id: 'vex_c5', npc: 'vex', chapter: 5, title: 'Jenseits der Spirale', start: 'n1',
    nodes: {
      n1: { speaker: 'vex', text: 'Das Echo ist verstummt! Weißt du, was das heißt? Die Siegel singen nicht mehr, weil nichts mehr eingesperrt werden muss!', next: 'n2' },
      n2: { speaker: 'vex', text: 'Aber hinter dem 5. Tor dreht sich die Spirale weiter. Endlos. Meine Messwerte ergeben keinen Sinn. Wunderschöne, unsinnige Messwerte!', next: 'n3' },
      n3: {
        speaker: 'vex',
        text: 'Ich will ein Forschungs-Leuchtfeuer am Tor bauen. Das dauert ein Jahr. Vielleicht länger. Was meinst du?',
        choices: [
          c('a', 'neugierig', 'Bau es. Die Galaxis braucht Leute wie dich.', 'Du hast Vex ermutigt, die Spirale zu erforschen.', 'a1', { trust: { vex: 2 }, setFlags: ['vex_spiral'] }),
          c('b', 'warm', 'Bleib hier. Port Solaris braucht seine Ingenieurin.', 'Du hast Vex gebeten, auf Port Solaris zu bleiben.', 'b1', { trust: { vex: 1 }, setFlags: ['vex_stays'] }),
        ],
      },
      a1: { speaker: 'vex', text: 'Ja! Ja, ja, ja! Ich fange heute Nacht an. Du bekommst den ersten Datensatz, versprochen!', next: 'end' },
      b1: { speaker: 'vex', text: 'Hm. … Vielleicht. Die Station hat genug Rätsel für ein ganzes Leben. Ich bleibe. Fürs Erste.', next: 'end' },
    },
  },
  {
    id: 'vex_c6', npc: 'vex', chapter: 6, title: 'Zyklus-Daten', start: 'n1',
    nodes: {
      n1: {
        speaker: 'vex',
        text: 'Zyklus-Daten werden archiviert! Das Hologramm zählt mit.',
        variants: [
          { when: { flag: 'vex_spiral' }, text: 'Das Leuchtfeuer am Tor sendet! Die ersten Daten aus der Spirale: Zahlen, die sich selbst umschreiben. Ich bin so glücklich, dass es wehtut!' },
          { when: { flag: 'vex_stays' }, text: 'Ich unterrichte jetzt! Zwölf Lehrlinge, alle in Overalls, alle mit Fragen. Die Station hat die schlausten Kinder der Galaxis.' },
        ],
        next: 'n2',
      },
      n2: {
        speaker: 'vex',
        text: 'Ich will sehen, wie weit du diesmal kommst. Ich führe Buch. Natürlich.',
        choices: [
          c('a', 'neugierig', 'Was hast du herausgefunden?', 'Du hast Vex nach ihren neuesten Erkenntnissen gefragt.', 'a1', { trust: { vex: 1 } }),
          c('b', 'warm', 'Ich bin stolz auf dich.', 'Du hast Vex gesagt, dass du stolz auf sie bist.', 'b1', { trust: { vex: 1 } }),
        ],
      },
      a1: { speaker: 'vex', text: 'Alles! Und nichts! Aber das Muster ist wunderschön. Mal sehen, wie weit du diesmal kommst!', next: 'end' },
      b1: { speaker: 'vex', text: 'Oh. … Danke! Das hat noch nie jemand gesagt. Ich … schreib es auf.', next: 'end' },
    },
  },

  // ======================= OMEGA-FEST (Ereignis, einmalig) =======================
  {
    id: 'event_festival', npc: 'event', chapter: 5, title: 'Das Omega-Fest', start: 'n1',
    nodes: {
      n1: { speaker: 'narrator', text: 'Port Solaris leuchtet. Banner hängen zwischen den Ständen, und über der Promenade zerplatzen Funken in den Farben der vier Sektoren.', next: '@speaker' },
      speech_kael: {
        speaker: 'kael',
        text: 'Ich bin kein Redner. Also kurz: Dieser Kapitän hat die Wracks bezwungen, vor denen wir jahrelang Angst hatten. Auf {captain}!',
        variants: [
          { when: { flag: 'kael_memorial' }, text: 'Ich bin kein Redner. Also kurz: Dieser Kapitän hat die Wracks bezwungen, vor denen wir jahrelang Angst hatten. Juno wäre stolz gewesen. Auf {captain}!' },
        ],
        next: 'toast_kael',
      },
      speech_lyra: { speaker: 'lyra', text: 'Vor einem Jahr hatte ich mehr Patienten als Betten. Heute schlafen die Leute wieder durch. Das verdanken wir dir, {captain}.', next: 'toast_lyra' },
      speech_nyx: { speaker: 'nyx', text: 'Normalerweise verkaufe ich Geheimnisse. Heute verschenke ich eins: Ohne diesen Kapitän gäbe es keinen Markt mehr, auf dem man irgendwas verkaufen könnte.', next: 'toast_nyx' },
      speech_vex: { speaker: 'vex', text: 'Laut meinen Berechnungen lag deine Überlebenschance bei 3,7 Prozent! Ich hab mich noch nie so gern verrechnet!', next: 'toast_vex' },
      toast_kael: {
        speaker: 'narrator',
        text: 'Alle Blicke richten sich auf dich.',
        choices: [
          c('kael_a', 'warm', 'Hebt die Gläser — auf Port Solaris!', 'Du hast auf ganz Port Solaris angestoßen.', 'end', { trust: { kael: 1, lyra: 1, nyx: 1, vex: 1 } }),
          c('kael_b', 'warm', 'Ich war nicht allein. Danke euch allen.', 'Du hast deinen Freunden auf Port Solaris gedankt.', 'end', { trust: { kael: 2 } }),
          c('kael_c', 'vorsichtig', '(Still lächeln und anstoßen.)', 'Du hast still mitgefeiert.', 'end'),
        ],
      },
      toast_lyra: {
        speaker: 'narrator',
        text: 'Alle Blicke richten sich auf dich.',
        choices: [
          c('lyra_a', 'warm', 'Hebt die Gläser — auf Port Solaris!', 'Du hast auf ganz Port Solaris angestoßen.', 'end', { trust: { kael: 1, lyra: 1, nyx: 1, vex: 1 } }),
          c('lyra_b', 'warm', 'Ich war nicht allein. Danke euch allen.', 'Du hast deinen Freunden auf Port Solaris gedankt.', 'end', { trust: { lyra: 2 } }),
          c('lyra_c', 'vorsichtig', '(Still lächeln und anstoßen.)', 'Du hast still mitgefeiert.', 'end'),
        ],
      },
      toast_nyx: {
        speaker: 'narrator',
        text: 'Alle Blicke richten sich auf dich.',
        choices: [
          c('nyx_a', 'warm', 'Hebt die Gläser — auf Port Solaris!', 'Du hast auf ganz Port Solaris angestoßen.', 'end', { trust: { kael: 1, lyra: 1, nyx: 1, vex: 1 } }),
          c('nyx_b', 'warm', 'Ich war nicht allein. Danke euch allen.', 'Du hast deinen Freunden auf Port Solaris gedankt.', 'end', { trust: { nyx: 2 } }),
          c('nyx_c', 'vorsichtig', '(Still lächeln und anstoßen.)', 'Du hast still mitgefeiert.', 'end'),
        ],
      },
      toast_vex: {
        speaker: 'narrator',
        text: 'Alle Blicke richten sich auf dich.',
        choices: [
          c('vex_a', 'warm', 'Hebt die Gläser — auf Port Solaris!', 'Du hast auf ganz Port Solaris angestoßen.', 'end', { trust: { kael: 1, lyra: 1, nyx: 1, vex: 1 } }),
          c('vex_b', 'warm', 'Ich war nicht allein. Danke euch allen.', 'Du hast deinen Freunden auf Port Solaris gedankt.', 'end', { trust: { vex: 2 } }),
          c('vex_c', 'vorsichtig', '(Still lächeln und anstoßen.)', 'Du hast still mitgefeiert.', 'end'),
        ],
      },
    },
  },
];
