/**
 * Welt-Überarbeitung P4: Port Solaris wächst mit der Geschichte. Diese Gebäude sind anfangs „im Aufbau“ (Baustellen-Patch auf dem
 * Hub-Hintergrund, NPC fehlt, keine Interaktion) und öffnen durch Story-/Dungeon-/Laden-Ereignisse.
 * Reine Daten, keine Imports aus der Spiel-Logik.
 */
export type HubBuildingId = 'techlab' | 'blackmarket' | 'terrace';

export interface HubBuildingDef {
  id: HubBuildingId;
  name: string;
  /** Anzeige am Baustellenschild / in der Chronik */
  lockedHint: string;
  /** Toast beim Öffnen */
  openToast: string;
  /** Sprite (Baustellen-Patch) unter public/art/sprites/<sprite>.png */
  sprite: string;
  /** Position/Größe des Patches in Hub-Pixeln (960×540) — Zeichnung in logischen Koordinaten = /2 */
  rect: { x: number; y: number; w: number; h: number };
}

export const HUB_BUILDINGS: HubBuildingDef[] = [
  {
    id: 'techlab',
    name: 'Tech-Labor',
    lockedHint: 'Im Aufbau · öffnet nach deiner ersten Expedition',
    openToast: '🔧 Das Tech-Labor ist fertig! Vex hat dein Expeditionssignal aufgefangen und baut für dich Exo-Module.',
    sprite: 'hub_lock_tech',
    rect: { x: 576, y: 241, w: 328, h: 271 },
  },
  {
    id: 'blackmarket',
    name: 'Schwarzmarkt',
    lockedHint: 'Geschlossen · Nyx öffnet, sobald du 3 Relikte verkauft hast',
    openToast: '🌙 Nyx hat ihren Schwarzmarkt-Stand geöffnet — sie hat von deinem Laden gehört.',
    sprite: 'hub_lock_black',
    rect: { x: 115, y: 265, w: 276, h: 234 },
  },
  {
    id: 'terrace',
    name: 'Marktplatz-Terrasse',
    lockedHint: 'Gesperrt · wird nach dem ersten Sektor-Sieg freigegeben',
    openToast: '🌌 Die Marktplatz-Terrasse ist freigegeben: Alchemie-Bar, Händler-Gilde und Handelsbank öffnen!',
    sprite: 'hub_lock_terr',
    rect: { x: 380, y: 406, w: 219, h: 126 },
  },
];

export const HUB_BUILDING_IDS: HubBuildingId[] = HUB_BUILDINGS.map((b) => b.id);

/** Äußere Erscheinung der Läden je Upgrade-Stufe (Patch auf dem Hub-Hintergrund; Stufe 0 = Original-Hintergrund). */
export type HubTierId = 'forge' | 'med' | 'tech' | 'shop';

export interface HubTierPatchDef {
  id: HubTierId;
  /** Index 0 = Stufe 1 (Stufe 0 braucht keinen Patch) */
  patches: Array<{ sprite: string; rect: { x: number; y: number; w: number; h: number } }>;
}

export const HUB_TIER_PATCHES: HubTierPatchDef[] = [
  { id: 'forge', patches: [
    { sprite: 'hub_tier_forge1', rect: { x: 192, y: 13, w: 216, h: 213 } },
    { sprite: 'hub_tier_forge2', rect: { x: 189, y: 12, w: 219, h: 233 } },
  ] },
  { id: 'med', patches: [
    { sprite: 'hub_tier_med1', rect: { x: 602, y: 13, w: 189, h: 231 } },
    { sprite: 'hub_tier_med2', rect: { x: 602, y: 13, w: 189, h: 234 } },
  ] },
  { id: 'tech', patches: [
    { sprite: 'hub_tier_tech1', rect: { x: 582, y: 262, w: 306, h: 250 } },
    { sprite: 'hub_tier_tech2', rect: { x: 582, y: 262, w: 306, h: 250 } },
  ] },
  { id: 'shop', patches: [
    { sprite: 'hub_tier_shop1', rect: { x: 43, y: 72, w: 158, h: 226 } },
    { sprite: 'hub_tier_shop2', rect: { x: 41, y: 72, w: 187, h: 236 } },
  ] },
];

export const HUB_TIER_SPRITES: string[] = HUB_TIER_PATCHES.flatMap((t) => t.patches.map((p) => p.sprite));
