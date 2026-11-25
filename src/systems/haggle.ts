import type { PatronId, Rarity } from '../types';

export type HaggleAction = 'accept' | 'gentle' | 'bold' | 'greedy';

export interface HaggleOptionPreview {
  action: HaggleAction;
  label: string;
  targetPrice: number;
  bonusPct: number;
  successChance: number; // 0..100
  patienceRisk: number;
}

export interface HaggleSession {
  customerId: number;
  customerTitle: string;
  patronId: PatronId | null;
  isVip: boolean;
  itemId: string;
  itemName: string;
  rarity: Rarity;
  basePrice: number;
  currentOffer: number;
  round: number; // 1..2
  maxRounds: number;
  patience: number; // 0..100
  status: 'active' | 'accepted' | 'rejected';
  dialogue: string;
  chanceBonusPct: number; // from patron tier + Tala's Holo-Globe deco
}

const MAX_BONUS_MULT = 1.4; // Cap total haggle bonus at +40%

export function createHaggleSession(params: {
  customerId: number;
  customerTitle: string;
  patronId: PatronId | null;
  patronTier: number;
  isVip: boolean;
  itemId: string;
  itemName: string;
  rarity: Rarity;
  basePrice: number;
  hasHoloGlobeDeco: boolean;
}): HaggleSession {
  const chanceBonusPct =
    (params.patronId ? params.patronTier * 5 : 0) +
    (params.hasHoloGlobeDeco ? 6 : 0) +
    (params.isVip ? 5 : 0);

  return {
    customerId: params.customerId,
    customerTitle: params.customerTitle,
    patronId: params.patronId,
    isVip: params.isVip,
    itemId: params.itemId,
    itemName: params.itemName,
    rarity: params.rarity,
    basePrice: params.basePrice,
    currentOffer: params.basePrice,
    round: 1,
    maxRounds: 2,
    patience: 100,
    status: 'active',
    dialogue: params.patronId
      ? `„Ein wunderbares Stück! ${params.basePrice} Cr stehen — willst du noch verhandeln?“`
      : `„${params.basePrice} Cr für ${params.itemName}. Kommen wir ins Geschäft?“`,
    chanceBonusPct,
  };
}

export function getHaggleOptions(session: HaggleSession): HaggleOptionPreview[] {
  const maxPrice = Math.round(session.basePrice * MAX_BONUS_MULT);
  const roundPenalty = session.round > 1 ? 14 : 0;
  const epicBonus = session.rarity === 'epic' ? 8 : 0;

  const mkTarget = (mult: number) =>
    Math.min(maxPrice, Math.max(session.currentOffer + 1, Math.round(session.basePrice * mult)));

  const gentlePrice = mkTarget(session.round === 1 ? 1.15 : 1.28);
  const boldPrice = mkTarget(session.round === 1 ? 1.28 : 1.36);
  const greedyPrice = mkTarget(1.4);

  const clampChance = (v: number) => Math.max(12, Math.min(96, Math.round(v)));

  return [
    {
      action: 'accept',
      label: `Deal annehmen (${session.currentOffer} Cr)`,
      targetPrice: session.currentOffer,
      bonusPct: Math.round(((session.currentOffer - session.basePrice) / Math.max(1, session.basePrice)) * 100),
      successChance: 100,
      patienceRisk: 0,
    },
    {
      action: 'gentle',
      label: 'Charme & sanft erhöhen',
      targetPrice: gentlePrice,
      bonusPct: Math.round(((gentlePrice - session.basePrice) / Math.max(1, session.basePrice)) * 100),
      successChance: clampChance(82 + session.chanceBonusPct - roundPenalty),
      patienceRisk: 38,
    },
    {
      action: 'bold',
      label: 'Selbstbewusst verhandeln',
      targetPrice: boldPrice,
      bonusPct: Math.round(((boldPrice - session.basePrice) / Math.max(1, session.basePrice)) * 100),
      successChance: clampChance(58 + session.chanceBonusPct - roundPenalty),
      patienceRisk: 54,
    },
    {
      action: 'greedy',
      label: 'Hoch pokern (+40 %)',
      targetPrice: greedyPrice,
      bonusPct: Math.round(((greedyPrice - session.basePrice) / Math.max(1, session.basePrice)) * 100),
      successChance: clampChance(34 + session.chanceBonusPct + epicBonus - roundPenalty),
      patienceRisk: 72,
    },
  ];
}

export function applyHaggleAction(session: HaggleSession, action: HaggleAction): HaggleSession {
  if (session.status !== 'active') return session;

  if (action === 'accept') {
    session.status = 'accepted';
    session.dialogue = `„Abgemacht! ${session.currentOffer} Cr sind fair.“`;
    return session;
  }

  const opt = getHaggleOptions(session).find((o) => o.action === action);
  if (!opt) return session;

  const roll = Math.random() * 100;
  const succeeded = roll <= opt.successChance;

  if (succeeded) {
    session.currentOffer = opt.targetPrice;
    if (session.round >= session.maxRounds || session.currentOffer >= Math.round(session.basePrice * MAX_BONUS_MULT)) {
      session.status = 'accepted';
      session.dialogue = `„Du hast mich überzeugt! Ich zahle ${session.currentOffer} Cr!“`;
    } else {
      session.round += 1;
      session.patience = Math.max(30, session.patience - 18);
      session.dialogue = `„Hmm, ${session.currentOffer} Cr klingen machbar… schlagen wir ein?“`;
    }
    return session;
  }

  // Failed attempt: customer loses patience and makes a counter-offer (or walks away if patience hits 0)
  session.patience = Math.max(0, session.patience - opt.patienceRisk);
  if (session.patience <= 0) {
    session.status = 'rejected';
    session.dialogue = '„Das ist mir zu gierig! Ich schaue mich woanders um.“';
    return session;
  }

  // Counter-offer on remaining patience
  const counterMult = action === 'greedy' ? 0.94 : 1.04;
  session.currentOffer = Math.max(
    Math.round(session.basePrice * 0.9),
    Math.min(session.currentOffer, Math.round(session.basePrice * counterMult)),
  );
  if (session.round >= session.maxRounds) {
    session.round = session.maxRounds;
    session.dialogue = `„Mein letztes Wort: ${session.currentOffer} Cr — nimm es oder lass es!“`;
  } else {
    session.round += 1;
    session.dialogue = `„Puh, zu hoch! Wie wäre es mit ${session.currentOffer} Cr?“`;
  }
  return session;
}
