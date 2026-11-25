import type { InfusionId, RiftMutatorId } from '../types';

export interface InfusionDef {
  id: Exclude<InfusionId, 'none'>;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  glowColor: string;
  summary: string;
  combatDetail: string;
  creditCost: number;
  materials: Array<{ itemId: string; qty: number }>;
}

export const INFUSIONS: InfusionDef[] = [
  {
    id: 'solar_burn',
    name: 'Solar-Brand',
    shortName: 'BRAND',
    icon: '🔥',
    color: '#fb923c',
    glowColor: '#f97316',
    summary: 'Treffer entzünden Gegner (3 s Brandschaden) + Feuer-Nova beim Tod!',
    combatDetail: '3 s Burn-DoT (12 %/s) + 38 % AoE-Explosion bei Kill',
    creditCost: 950,
    materials: [
      { itemId: 'rift_catalyst', qty: 1 },
      { itemId: 'plasma_cell', qty: 2 },
    ],
  },
  {
    id: 'cryo_stasis',
    name: 'Kryo-Stasis',
    shortName: 'KRYO',
    icon: '❄️',
    color: '#67e8f9',
    glowColor: '#22d3ee',
    summary: 'Friert getroffene Gegner 2,6 s ein (-42 % Tempo & langsamere Angriffe)!',
    combatDetail: '2,6 s Verlangsamung (-42 %) + +10 % Schaden an vereisten Zielen',
    creditCost: 950,
    materials: [
      { itemId: 'rift_catalyst', qty: 1 },
      { itemId: 'cryo_amber', qty: 2 },
    ],
  },
  {
    id: 'ion_chain',
    name: 'Ionen-Kette',
    shortName: 'BLITZ',
    icon: '⚡',
    color: '#fde047',
    glowColor: '#38bdf8',
    summary: 'Treffer schlagen Kettenblitze (38 % Schaden) auf bis zu 2 nahe Gegner!',
    combatDetail: 'Kettenblitz-Sprung (92 px Radius, max. 2 Ziele, 38 % DMG)',
    creditCost: 1250,
    materials: [
      { itemId: 'rift_catalyst', qty: 2 },
      { itemId: 'nova_core', qty: 1 },
    ],
  },
  {
    id: 'void_siphon',
    name: 'Leeren-Siphon',
    shortName: 'SIPHON',
    icon: '🟣',
    color: '#e879f9',
    glowColor: '#c084fc',
    summary: 'Jeder 4. Treffer entzieht Lebensenergie (+4 % Max-HP & +14 EN)!',
    combatDetail: '4-Treffer-Seelen-Orb: heilt +4 % Max-HP & +14 EN',
    creditCost: 1450,
    materials: [
      { itemId: 'rift_catalyst', qty: 2 },
      { itemId: 'phase_geode', qty: 1 },
    ],
  },
];

export const INFUSIONS_BY_ID: Record<Exclude<InfusionId, 'none'>, InfusionDef> = Object.fromEntries(
  INFUSIONS.map((inf) => [inf.id, inf]),
) as Record<Exclude<InfusionId, 'none'>, InfusionDef>;

export function getInfusionDef(id: InfusionId): InfusionDef | null {
  if (id === 'none') return null;
  return INFUSIONS_BY_ID[id] ?? null;
}

export interface RiftMutatorDef {
  id: RiftMutatorId;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const RIFT_MUTATORS: Record<RiftMutatorId, RiftMutatorDef> = {
  overcharged: {
    id: 'overcharged',
    name: 'ÜBERLADEN',
    icon: '⚡',
    color: '#fde047',
    description: 'Gegner verursachen +25 % Schaden & funkeln elektrisch',
  },
  armored: {
    id: 'armored',
    name: 'GEPANZERT',
    icon: '🛡',
    color: '#93c5fd',
    description: 'Gegner besitzen +30 % maximale Lebenspunkte',
  },
  vampiric: {
    id: 'vampiric',
    name: 'VAMPIRISCH',
    icon: '🩸',
    color: '#f43f5e',
    description: 'Gegner heilen sich bei Treffern leicht & sind aggressiver',
  },
  hasted: {
    id: 'hasted',
    name: 'BESCHLEUNIGT',
    icon: '💨',
    color: '#34d399',
    description: 'Gegner bewegen sich +22 % schneller durch den Rift',
  },
};

export const RIFT_MUTATOR_LIST: RiftMutatorId[] = ['overcharged', 'armored', 'vampiric', 'hasted'];
