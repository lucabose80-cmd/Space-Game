// BEHELFSMÄSSIGES Boss-Labor (Entwicklungs-/Test-Werkzeug, M11): Bosse & Gegner auswählen und in Bewegung ansehen.
// Aufruf NUR über die Adresse mit `?bosslab` (z. B. https://…/?bosslab; Groß-/Kleinschreibung egal).
// Tab „Bosse“ → Abschnitt „ARENEN“: Endboss-Raum wie im Spiel (Großarena, Kamera, Auftritt, 3 Phasen) ohne Durchspielen. Im normalen Spiel nirgends verlinkt.
// Fasst den Spielstand NICHT an: Speichern ist gesperrt (state.saveLocked), nichts wird abgeschlossen oder verkauft.
// Hinweis: bewusst außerhalb der Spielwelt — bleibt ein Dev-Werkzeug und wird vor einem Release wieder entfernt.
import { getHDArt } from '../assets/artLoader';
import { ARENAS, attachArenas } from '../data/arenas';
import { labDestroyArm, startMoveForTest, type LevArenaMove } from '../dungeon/bosses/leviathanArena';
import { ENDBOSS_ARENA } from '../data/balance';
import { RIG_BY_KIND } from '../data/rigs';
import { BOSS_DEFS } from '../dungeon/bosses/defs';
import type { BossState, Enemy } from '../dungeon/dungeonTypes';
import type { DungeonScene } from '../scenes/DungeonScene';
import type { GameState } from '../systems/gameState';
import type { SectorId } from '../types';
import { ROOM_CENTER_X, ROOM_CENTER_Y, type EnemyKind } from '../world/dungeonGen';

type Kind = Enemy['kind'];

interface LabBoss {
  kind: Kind;
  name: string;
  sector: SectorId;
  floor: 1 | 2 | 3;
}

export /** Leviathan-Labor: Angriffe (Reihenfolge der Wiedergabe) und Schadensstufen (HP-Anteil → Phase/Rumpf-Variante) */
const LEV_MOVES: Array<[LevArenaMove, string]> = [['hammer', 'Hammer'], ['whip', 'Welle'], ['quake', 'Doppelschlag'], ['steam', 'Dampf'], ['beam', 'Strahl'], ['debris', 'Trümmer'], ['grab', 'Griff'], ['pulse', 'Puls'], ['glow', 'Glut']];
const LEV_STAGES: Array<[number, string]> = [[1, 'P1 100'], [0.85, 'P1 85'], [0.7, 'P1 70'], [0.6, 'P2 60'], [0.48, 'P2 48'], [0.36, 'P2 36'], [0.25, 'P3 25'], [0.12, 'P3 12']];
/**
 * Boss-Labor: gezielte Angriffe für Bosse mit eigener Zustandsmaschine (`enemyAi.ts`). Die KI wählt den nächsten Angriff über `e.phase % mod`
 * — wir setzen `phase` passend und lassen die KI im Ruhezustand sofort starten. `incBefore`: KI erhöht `phase` VOR der Auswahl.
 */
const PHASE_ATTACKS: Partial<Record<Kind, { mod: number; idle: BossState; incBefore: boolean; atks: string[] }>> = {
  boss: { mod: 4, idle: 'stalk', incBefore: false, atks: ['Orbit-Salve', 'Sturm/Anlauf', 'Sprung-Angriff', 'Reaktor-Laser'] },
  boss_quartz_golem: { mod: 3, idle: 's2_idle', incBefore: true, atks: ['Kristall-Beben', 'Quarz-Salve'] },
  boss_prism_weaver: { mod: 2, idle: 's2_idle', incBefore: true, atks: ['Phasen-Sprung', 'Laser-Gitter'] },
  boss_prisma_archon: { mod: 3, idle: 's2_idle', incBefore: true, atks: ['Zwillings-Strahl', 'Kristall-Lanzen', 'Prisma-Nova'] },
  boss_omega_archon: { mod: 3, idle: 's2_idle', incBefore: true, atks: ['Zwillings-Strahl', 'Kristall-Lanzen', 'Prisma-Nova'] },
};
/** Schadensstufen (HP-Anteil) für Bosse bzw. normale Gegner */
const BOSS_STAGES: Array<[number, string]> = [[1, '100 %'], [0.8, '80 %'], [0.65, '65 %'], [0.5, '50 % · Phase II'], [0.35, '35 %'], [0.25, '25 %'], [0.14, '14 % kritisch']];
const ENEMY_STAGES: Array<[number, string]> = [[1, '100 %'], [0.66, '66 %'], [0.33, '33 %'], [0.1, '10 %']];

const LAB_BOSSES: LabBoss[] = [
  { kind: 'boss_breacher', name: 'Krall', sector: 1, floor: 1 },
  { kind: 'boss', name: 'Kern-Wächter', sector: 1, floor: 2 },
  { kind: 'boss_leviathan', name: 'Leviathan', sector: 1, floor: 3 },
  { kind: 'boss_quartz_golem', name: 'Quarz-Koloss', sector: 2, floor: 1 },
  { kind: 'boss_prism_weaver', name: 'Prisma-Weberin', sector: 2, floor: 2 },
  { kind: 'boss_prisma_archon', name: 'Prisma-Archon', sector: 2, floor: 3 },
  { kind: 'boss_slag_overlord', name: 'Schlacken-Koloss', sector: 3, floor: 1 },
  { kind: 'boss_forge_warden', name: 'Gießerei-Meisterin', sector: 3, floor: 2 },
  { kind: 'boss_vulkan_titan', name: 'Vulkan-Titan', sector: 3, floor: 3 },
  { kind: 'boss_chrono_sentinel', name: 'Chrono-Wächter', sector: 4, floor: 1 },
  { kind: 'boss_monolith_colossus', name: 'Monolith-Koloss', sector: 4, floor: 2 },
  { kind: 'boss_star_archon', name: 'Sternen-Archon', sector: 4, floor: 3 },
  { kind: 'boss_omega_archon', name: 'Omega-Archon', sector: 5, floor: 3 },
];

export const LAB_ENEMIES: Array<{ kind: Kind; name: string }> = [
  { kind: 'slime', name: 'Schleim' },
  { kind: 'drone', name: 'Drohne' },
  { kind: 'turret', name: 'Geschütz' },
  { kind: 'shield_drone', name: 'Schild-Drohne' },
  { kind: 'spore_spitter', name: 'Sporenspucker' },
  { kind: 'phase_stalker', name: 'Phasen-Jäger' },
  { kind: 'crystal_crawler', name: 'Kristall-Krabbler' },
  { kind: 'prism_drone', name: 'Prisma-Drohne' },
  { kind: 'shard_sniper', name: 'Splitter-Scharfschütze' },
  { kind: 'void_crawler', name: 'Leere-Krabbler' },
  { kind: 'resonance_warden', name: 'Resonanz-Wächter' },
  { kind: 'slag_beetle', name: 'Schlacken-Käfer' },
  { kind: 'solar_drone', name: 'Solar-Drohne' },
  { kind: 'magma_mortar', name: 'Magma-Mörser' },
  { kind: 'ember_stalker', name: 'Glut-Jäger' },
  { kind: 'forge_golem', name: 'Gießerei-Golem' },
  { kind: 'astral_scarab', name: 'Astral-Skarabäus' },
  { kind: 'chrono_eye', name: 'Chrono-Auge' },
  { kind: 'star_lancer', name: 'Sternen-Lanzer' },
  { kind: 'void_wraith', name: 'Leere-Phantom' },
  { kind: 'monolith_guard', name: 'Monolith-Wächter' },
];

export interface BossLabHooks {
  /** Nach Sektor-/Ebenenwechsel: HUD, Touch & Musik der Hauptschleife aktualisieren */
  onSceneChange: () => void;
}

export class BossLab {
  private readonly dng: DungeonScene;
  private readonly state: GameState;
  private readonly hooks: BossLabHooks;
  private panel!: HTMLDivElement;
  private info!: HTMLDivElement;
  private body!: HTMLDivElement;
  private selected: LabBoss | null = null;
  private selectedEnemy: Kind | null = null;
  /** M12: gewählte Endboss-Arena (echter Bossraum der Ebene III statt leerer Laborraum) */
  private selectedArena: EnemyKind | null = null;
  private arenaActive = false;
  /** Biom-Override (null = Auto: Boss → Heimat-Sektor, Gegner → S1). Zum Prüfen von Boden-Effekten in fremden Sektoren (AGENTS.md Regel 16). */
  private biom: SectorId | null = null;
  /** Aktuell geladene Arena */
  private loaded: { sector: SectorId; floor: 1 | 2 | 3 } | null = null;
  private tab: 'bosse' | 'gegner' | 'mehr' = 'bosse';
  private timeScale = 1;
  /** Leviathan-Labor: Zug-Wiedergabe */
  private levMoveIdx = 0;
  private levAuto = false;
  private paused = false;
  private bossImmortal = true;
  private playerImmortal = true;
  private rigOn = true;
  private rigBackup: Record<string, ReturnType<typeof getHDArt>['rigs'][string]> = {};
  private infoTimer = 0;
  private tabsEl!: HTMLDivElement;
  /** Dynamischer Abschnitt „ANGRIFFE & STATI“ (je Pane einer; wird bei jeder Auswahl neu aufgebaut) */
  private actionEls: HTMLDivElement[] = [];
  private atkIdx = 0;
  private open = window.innerHeight >= 520 && window.innerWidth >= 700; // Handy (hoch oder quer): eingeklappt starten
  private muteToastUntil = 0;

  constructor(dng: DungeonScene, state: GameState, hooks: BossLabHooks) {
    this.dng = dng;
    this.state = state;
    this.hooks = hooks;
  }

  // ---------- Start ----------
  public enter(): void {
    this.state.saveLocked = true; // Spielstand bleibt unangetastet
    const origToast = this.dng.callbacks.onToast;
    this.dng.callbacks.onToast = (msg, tone) => {
      if (Date.now() < this.muteToastUntil) return; // Ebenen-Hinweise beim Arena-Aufbau weglassen
      origToast(msg, tone);
    };
    this.buildPanel();
    this.loadArena(1, 1);
    this.select(LAB_BOSSES[0]);
  }

  /** Von der Hauptschleife: Zeitlupe/Pause auf dt anwenden. */
  public scaleDt(dt: number): number {
    return this.paused ? 0 : dt * this.timeScale;
  }

  /** Nach jedem Dungeon-Update (Hauptschleife). */
  public afterUpdate(dt: number): void {
    const stats = this.state.getStats();
    if (this.playerImmortal) {
      this.state.hp = stats.maxHp;
      this.state.energy = 100;
      this.dng.invulnTimer = Math.max(this.dng.invulnTimer, 5);
    }
    if (this.bossImmortal) {
      for (const e of this.dng.enemies) {
        if (this.dng.isBossKind(e.kind) && e.hp < e.maxHp * 0.05) e.hp = e.maxHp * 0.05;
      }
    }
    // Leviathan-Labor: Auto-Wiedergabe — sobald der Boss ruht, kommt der nächste Zug der Liste
    if (this.levAuto) {
      const be = this.bossEntity();
      if (be?.levArena && be.levArena.state === 'idle') this.levPlayNext();
    }
    this.infoTimer -= dt;
    if (this.infoTimer <= 0) {
      this.infoTimer = 0.25;
      this.refreshInfo();
    }
  }

  /** Falls das Spiel versucht, den Dungeon zu verlassen (Tod/Extraktion): im Labor einfach neu aufbauen. */
  public onReturnAttempt(): void {
    if (this.selectedArena) {
      this.selectArena(this.selectedArena);
    } else if (this.selected) {
      const a = this.arenaFor(this.selected);
      this.loadArena(a.sector, a.floor);
      this.spawnBoss(this.selected);
    } else {
      this.loadArena(this.biom ?? 1, 1);
    }
  }

  /** Arena für einen Boss: Biom-Override oder Heimat-Sektor (Ebene bleibt, außer in Ω). */
  private arenaFor(b: LabBoss): { sector: SectorId; floor: 1 | 2 | 3 } {
    const sector = this.biom ?? b.sector;
    return { sector, floor: sector === 5 ? 1 : b.floor };
  }

  // ---------- Arena ----------
  private loadArena(sector: SectorId, floor: 1 | 2 | 3): void {
    const d = this.dng;
    this.loaded = { sector, floor };
    this.arenaActive = false;
    this.muteToastUntil = Date.now() + 500;
    d.startRun(sector);
    if (sector !== 5 && floor > 1) d.startFloor(floor, false, sector);
    const room = d.currentRoom;
    room.type = 'combat';
    room.cleared = true;
    room.doors = { north: false, south: false, east: false, west: false };
    room.obstacles = [];
    room.chasms = [];
    room.hazards = [];
    room.spawns = [];
    room.chest = null;
    room.prisms = undefined;
    room.flameJets = undefined;
    room.magnetPlates = undefined;
    room.teleporters = undefined;
    room.extractBeacon = undefined;
    room.riftPortal = null;
    room.hasHealStation = false;
    room.pods.forEach((p) => (p.broken = true));
    d.mechanics.resetForRoom();
    d.rebuildNav();
    d.bossFx.clear();
    d.enemies.length = 0;
    d.projectiles.length = 0;
    d.playerX = ROOM_CENTER_X - 90;
    d.playerY = ROOM_CENTER_Y + 30;
    d.invulnTimer = 5;
    this.hooks.onSceneChange();
  }

  /** M12: echten Arena-Bossraum (Ebene III des Heimat-Sektors) laden und betreten — mit Auftritt, Kamera und Kampf. */
  private selectArena(kind: EnemyKind): void {
    const d = this.dng;
    const lb = LAB_BOSSES.find((x) => x.kind === kind);
    if (!lb) return;
    this.selected = null;
    this.selectedEnemy = null;
    this.selectedArena = kind;
    this.loaded = { sector: lb.sector, floor: lb.floor };
    this.arenaActive = true;
    this.muteToastUntil = Date.now() + 500;
    d.startRun(lb.sector);
    d.startFloor(lb.floor, false, lb.sector);
    const boss = d.floor.rooms.get(d.floor.bossKey);
    if (boss && !boss.bounds) attachArenas(d.floor); // unabhängig von ENDBOSS_ARENA_LIVE
    if (boss) boss.doors = { north: false, south: true, east: false, west: false };
    d.enterRoom(d.floor.bossKey, 'south');
    d.invulnTimer = 5;
    this.hooks.onSceneChange();
    this.refreshButtons();
  }

  private spawnBoss(b: LabBoss): void {
    const d = this.dng;
    d.enemies.length = 0;
    d.projectiles.length = 0;
    d.bossFx.clear();
    d.spawnEnemy(b.kind, ROOM_CENTER_X + 40, ROOM_CENTER_Y - 30);
    this.applyRig();
  }

  private select(b: LabBoss): void {
    const a = this.arenaFor(b);
    const needArena = !this.loaded || this.arenaActive || this.loaded.sector !== a.sector || this.loaded.floor !== a.floor;
    this.selected = b;
    this.selectedEnemy = null;
    this.selectedArena = null;
    if (needArena) this.loadArena(a.sector, a.floor);
    this.spawnBoss(b);
    this.refreshButtons();
  }

  private spawnEnemy(kind: Kind): void {
    this.selectedEnemy = kind;
    this.selected = null;
    this.selectedArena = null;
    const d = this.dng;
    const want = this.biom ?? 1;
    if (!this.loaded || this.arenaActive || this.loaded.sector !== want || this.loaded.floor !== 1) this.loadArena(want, 1);
    d.enemies.length = 0;
    d.bossFx.clear();
    d.spawnEnemy(kind, ROOM_CENTER_X + 50, ROOM_CENTER_Y - 20);
    this.refreshButtons();
  }

  private setBiom(b: SectorId | null): void {
    this.biom = b;
    if (this.selectedArena) this.selectArena(this.selectedArena);
    else if (this.selected) this.select(this.selected);
    else if (this.selectedEnemy) this.spawnEnemy(this.selectedEnemy);
    else this.refreshButtons();
  }

  // ---------- Leviathan-Labor ----------
  private levPlay(move: LevArenaMove): void {
    const e = this.bossEntity();
    const L = e?.levArena;
    if (!e || !L) return;
    if (L.state === 'intro' || L.state === 'transition' || L.state === 'dead') {
      L.state = 'idle';
      this.dng.camera.cancelFocus();
    }
    this.dng.bossFx.clear();
    for (const a of e.levArms ?? []) if (!a.dead) a.state = 'returning';
    startMoveForTest(this.dng, e, move);
  }

  private levPlayNext(): void {
    const m = LEV_MOVES[this.levMoveIdx % LEV_MOVES.length];
    this.levMoveIdx++;
    this.levPlay(m[0]);
  }

  /** Boss auf eine Schadensstufe setzen (HP-Anteil). Niedrigere Phase als aktuell → Arena neu laden (Phasen gehen nur vorwärts). */
  private levStage(frac: number): void {
    let e = this.bossEntity();
    if (!e?.levArena) return;
    const target = frac <= ENDBOSS_ARENA.leviathan.phase3At ? 3 : frac <= ENDBOSS_ARENA.leviathan.phase2At ? 2 : 1;
    if (e.levArena.phase > target || e.levArena.state === 'dead') {
      this.selectArena('boss_leviathan');
      e = this.bossEntity();
      if (!e?.levArena) return;
      this.dng.camera.cancelFocus();
      this.dng.arenaBanner = null;
    }
    const L = e.levArena;
    if (L.state === 'intro') L.state = 'idle';
    L.timer = 0.4;
    e.hp = Math.max(1, Math.round(e.maxHp * frac));
    this.dng.invulnTimer = 5;
  }

  private bossEntity(): Enemy | undefined {
    return this.dng.enemies.find((e) => this.dng.isBossKind(e.kind));
  }

  // ---------- Rig an/aus ----------
  private applyRig(): void {
    const art = getHDArt();
    for (const id of Object.keys(art.rigs)) {
      if (!(id in this.rigBackup)) this.rigBackup[id] = art.rigs[id];
      art.rigs[id] = this.rigOn ? this.rigBackup[id] : null;
    }
  }

  // ---------- Oberfläche ----------
  private buildPanel(): void {
    const style = document.createElement('style');
    style.textContent = `
      #boss-lab{position:fixed;left:4px;top:70px;z-index:60;font-family:var(--font-pixel,monospace);font-size:10px;color:#e2e8f0;pointer-events:auto;max-width:min(240px,62vw)}
      #boss-lab .bl-head,#boss-lab .bl-biom,#boss-lab .bl-tabs{display:flex;gap:3px;align-items:center;flex-wrap:wrap}
      #boss-lab .bl-biom{margin-top:3px}
      #boss-lab .bl-biom span{color:#94a3b8;font-size:9px}
      #boss-lab button{font:inherit;color:#e2e8f0;background:rgba(15,23,42,.92);border:1px solid #475569;padding:4px 7px;min-height:32px;min-width:32px;cursor:pointer;touch-action:manipulation}
      #boss-lab .bl-biom button{padding:2px 6px;min-height:28px;min-width:28px}
      #boss-lab button.on{border-color:#38e8d4;color:#38e8d4}
      #boss-lab button.sel{background:#0e7490;border-color:#67e8f9}
      #boss-lab .bl-tabs{margin-top:4px}
      #boss-lab .bl-tabs button{flex:1}
      #boss-lab .bl-body{margin-top:3px;background:rgba(10,15,26,.9);border:1px solid #334155;padding:5px;max-height:58vh;overflow:auto}
      #boss-lab h4{margin:5px 0 3px;font-size:9px;color:#fbbf24;font-weight:normal}
      #boss-lab .bl-grid{display:flex;flex-wrap:wrap;gap:3px}
      #boss-lab .bl-pane{display:none}
      #boss-lab .bl-pane.show{display:block}
      #boss-lab .bl-info{margin-top:3px;padding:3px 6px;background:rgba(10,15,26,.88);border:1px solid #334155;line-height:1.4;white-space:pre-line;font-size:9px}
    `;
    document.head.appendChild(style);
    this.panel = document.createElement('div');
    this.panel.id = 'boss-lab';
    this.panel.addEventListener('mousedown', (e) => e.preventDefault()); // Tastatur-Fokus bleibt auf dem Spiel
    const head = document.createElement('div');
    head.className = 'bl-head';
    const toggle = this.btn('🧪 Labor ▾', () => {
      this.open = !this.open;
      this.body.style.display = this.open ? 'block' : 'none';
      this.tabsEl.style.display = this.open ? 'flex' : 'none';
    });
    head.appendChild(toggle);
    // immer sichtbar (auch eingeklappt): die Knöpfe, die man beim Zusehen ständig braucht
    head.appendChild(this.btn('⏸', () => { this.paused = !this.paused; this.refreshButtons(); }, 'pause'));
    head.appendChild(this.btn('⏭', () => this.levPlayNext(), 'lev:next-head'));
    head.appendChild(this.btn('PII', () => { const e = this.bossEntity(); if (e) e.hp = Math.min(e.hp, e.maxHp * 0.45); }, 'phase2'));
    head.appendChild(this.btn('↻', () => (this.selectedArena ? this.selectArena(this.selectedArena) : this.selected ? this.select(this.selected) : this.selectedEnemy && this.spawnEnemy(this.selectedEnemy)), 'respawn'));
    head.appendChild(this.btn('✕', () => (window.location.href = window.location.pathname)));
    this.panel.appendChild(head);
    const biomRow = document.createElement('div');
    biomRow.className = 'bl-biom';
    const bl = document.createElement('span');
    bl.textContent = 'Biom';
    biomRow.appendChild(bl);
    biomRow.appendChild(this.btn('Auto', () => this.setBiom(null), 'biom:auto'));
    for (const sec of [1, 2, 3, 4, 5] as SectorId[]) biomRow.appendChild(this.btn(sec === 5 ? 'Ω' : `S${sec}`, () => this.setBiom(sec), `biom:${sec}`));
    this.panel.appendChild(biomRow);
    this.info = document.createElement('div'); // direkt unter den Knöpfen, damit die Liste (unten) nichts davon verdeckt
    this.info.className = 'bl-info';
    this.panel.appendChild(this.info);
    const tabs = document.createElement('div');
    tabs.className = 'bl-tabs';
    for (const [id, label] of [['bosse', 'Bosse'], ['gegner', 'Gegner'], ['mehr', 'Mehr']] as const) {
      tabs.appendChild(this.btn(label, () => { this.tab = id; this.refreshButtons(); }, `tab:${id}`));
    }
    this.tabsEl = tabs;
    this.panel.appendChild(tabs);
    this.body = document.createElement('div');
    this.body.className = 'bl-body';
    this.panel.appendChild(this.body);
    document.body.appendChild(this.panel);
    this.buildBody();
    this.body.style.display = this.open ? 'block' : 'none';
    this.tabsEl.style.display = this.open ? 'flex' : 'none';
    this.refreshButtons();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 200));
  }

  /** Hochformat: Panel in den freien Bereich UNTER dem Spielfeld; sonst links über dem Spielfeld. */
  private layout(): void {
    const portrait = window.innerHeight > window.innerWidth;
    const r = document.getElementById('game-canvas')?.getBoundingClientRect();
    this.panel.style.left = '4px';
    if (portrait && r) {
      this.panel.style.top = `${Math.round(r.bottom + 6)}px`;
      this.panel.style.maxWidth = 'calc(100vw - 8px)';
      this.body.style.maxHeight = `${Math.max(110, Math.round(Math.min(window.innerHeight * 0.3, window.innerHeight - r.bottom - 6 - 170)))}px`;
    } else {
      this.panel.style.top = '112px'; // unter dem HP/EN-Block (bleibt lesbar)
      this.panel.style.maxWidth = 'min(240px, 62vw)';
      this.body.style.maxHeight = '30vh';
    }
  }

  private btn(label: string, fn: () => void, id?: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.tabIndex = -1;
    if (id) b.dataset.lab = id;
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      fn();
      b.blur();
    });
    return b;
  }

  private dyn(parent: HTMLElement): HTMLDivElement {
    const el = document.createElement('div');
    parent.appendChild(el);
    return el;
  }

  // ---------- Angriffe & Stati (alle Bosse/Gegner) ----------
  private selectedKind(): Kind | null {
    return this.selected?.kind ?? this.selectedEnemy ?? null;
  }

  /** Angriffsliste des gewählten Bosses [Name, Auslöser]; Leviathan-Arena hat eigene Abschnitte. */
  private attackList(kind: Kind): Array<[string, (e: Enemy) => void]> {
    const def = BOSS_DEFS[kind];
    if (def) {
      return def.moves.map((m, i): [string, (e: Enemy) => void] => [
        m.name,
        (e) => {
          const p2 = e.bossPhase2 === true && e.splitGroup === undefined;
          const seq = p2 ? def.movesP2 ?? def.movesP1 : def.movesP1;
          const order = seq ?? def.moves.map((_, k) => k);
          const pos = order.indexOf(i);
          if (pos < 0) { this.dng.callbacks.onToast(`„${m.name}“ gehört nicht zum Zugplan dieser Phase`, 'warn'); return; }
          e.bossSub = 'idle';
          e.bossStateTimer = 0;
          e.bossMoveIdx = pos;
        },
      ]);
    }
    const pa = PHASE_ATTACKS[kind];
    if (pa) {
      return pa.atks.map((name, t): [string, (e: Enemy) => void] => [
        name,
        (e) => {
          e.bossState = pa.idle;
          e.bossStateTimer = 0;
          e.bossHeight = 0;
          e.phase = pa.incBefore ? (t - 1 + pa.mod) % pa.mod : t;
        },
      ]);
    }
    return [];
  }

  private runAttack(fn: (e: Enemy) => void): void {
    const e = this.bossEntity() ?? this.dng.enemies[0];
    if (!e) return;
    this.dng.bossFx.clear();
    this.dng.projectiles.length = 0;
    e.vx = 0;
    e.vy = 0;
    fn(e);
  }

  private setHpStage(frac: number): void {
    const e = this.bossEntity() ?? this.dng.enemies[0];
    if (!e) return;
    if (frac > 0.5 && e.bossPhase2) {
      // Phasen gehen nur vorwärts → Gegner neu aufbauen
      if (this.selected) this.spawnBoss(this.selected);
      else if (this.selectedEnemy) this.spawnEnemy(this.selectedEnemy);
      this.setHpStage(frac);
      return;
    }
    e.hp = Math.max(1, Math.round(e.maxHp * frac));
    this.dng.invulnTimer = 5;
  }

  private renderActions(): void {
    const kind = this.selectedKind();
    for (const el of this.actionEls) el.replaceChildren();
    if (!kind || this.selectedArena) return;
    const isBoss = this.selected !== null;
    const label = this.selected?.name ?? LAB_ENEMIES.find((x) => x.kind === kind)?.name ?? kind;
    for (const el of this.actionEls) {
      const g = this.section(el, `${label.toUpperCase()} · ANGRIFFE`);
      const atks = this.attackList(kind);
      if (atks.length > 0) {
        g.appendChild(this.btn('⏭ Nächster', () => { const a = atks[this.atkIdx++ % atks.length]; this.runAttack(a[1]); }));
        for (const [name, fn] of atks) g.appendChild(this.btn(name, () => this.runAttack(fn)));
      } else if (isBoss && kind === 'boss_leviathan') {
        g.appendChild(this.btn('→ Arena „🏟 Leviathan“ wählen (eigene Angriffsliste)', () => this.selectArena('boss_leviathan')));
      } else if (!isBoss) {
        g.appendChild(this.btn('⚔ Angriff jetzt', () => this.runAttack((e) => { e.aiTimer = 0; e.telegraphTimer = 0; }), 'atk:now'));
      } else {
        g.appendChild(this.btn('⚔ Angriff jetzt', () => this.runAttack((e) => { e.aiTimer = 0; }), 'atk:now'));
      }
      const gs = this.section(el, `${label.toUpperCase()} · STATI`);
      for (const [frac, name] of isBoss ? BOSS_STAGES : ENEMY_STAGES) gs.appendChild(this.btn(name, () => this.setHpStage(frac)));
      gs.appendChild(this.btn('💥 Treffer', () => { const e = this.bossEntity() ?? this.dng.enemies[0]; if (e) this.dng.damageEnemy(e, 1, 1, 0, 60); }));
      gs.appendChild(this.btn('☠ Tod', () => {
        const e = this.bossEntity() ?? this.dng.enemies[0];
        if (!e) return;
        this.bossImmortal = false;
        this.refreshButtons();
        e.hp = 1;
        this.dng.damageEnemy(e, e.maxHp + 99, 1, 0, 60, true);
      }));
      gs.appendChild(this.btn('↺ Neu', () => {
        if (this.selected) this.select(this.selected);
        else if (this.selectedEnemy) this.spawnEnemy(this.selectedEnemy);
      }));
    }
  }

  private pane(id: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'bl-pane';
    el.dataset.pane = id;
    this.body.appendChild(el);
    return el;
  }

  private section(parent: HTMLElement, title: string): HTMLDivElement {
    const h = document.createElement('h4');
    h.textContent = title;
    parent.appendChild(h);
    const g = document.createElement('div');
    g.className = 'bl-grid';
    parent.appendChild(g);
    return g;
  }

  private buildBody(): void {
    // Tab „Bosse“: nach Sektor gruppiert
    const pb = this.pane('bosse');
    this.actionEls.push(this.dyn(pb));
    // M12: Endboss-Arenen (echter Bossraum, so wie im Spiel) — künftige Arenen erscheinen hier automatisch
    const ga = this.section(pb, 'ARENEN (Endboss-Raum)');
    for (const kind of Object.keys(ARENAS) as EnemyKind[]) {
      const lb = LAB_BOSSES.find((x) => x.kind === kind);
      ga.appendChild(this.btn(`🏟 ${lb?.name ?? kind}`, () => this.selectArena(kind), `arena:${kind}`));
    }
    // Leviathan-Labor: alle Angriffe nacheinander abspielen & alle Schadensstufen/Phasen anspringen
    const gl = this.section(pb, 'LEVIATHAN · ANGRIFFE');
    gl.appendChild(this.btn('⏭ Nächster', () => this.levPlayNext(), 'lev:next'));
    gl.appendChild(this.btn('▶▶ Auto', () => { this.levAuto = !this.levAuto; this.refreshButtons(); }, 'lev:auto'));
    for (const [m, label] of LEV_MOVES) gl.appendChild(this.btn(label, () => this.levPlay(m), `lev:${m}`));
    const gs = this.section(pb, 'LEVIATHAN · PHASEN & SCHÄDEN');
    for (const [frac, label] of LEV_STAGES) gs.appendChild(this.btn(label, () => this.levStage(frac), `levs:${frac}`));
    gs.appendChild(this.btn('Arm L ab', () => { const e = this.bossEntity(); if (e?.levArena) labDestroyArm(this.dng, e, 0); }, 'lev:armL'));
    gs.appendChild(this.btn('Arm R ab', () => { const e = this.bossEntity(); if (e?.levArena) labDestroyArm(this.dng, e, 1); }, 'lev:armR'));
    for (const sec of [1, 2, 3, 4, 5] as SectorId[]) {
      const g = this.section(pb, sec === 5 ? 'Ω OMEGA' : `SEKTOR ${sec}`);
      for (const b of LAB_BOSSES.filter((x) => x.sector === sec)) {
        g.appendChild(this.btn(`${sec === 5 ? 'Ω' : b.floor} ${b.name}`, () => this.select(b), `boss:${b.kind}`));
      }
    }
    // Tab „Gegner“
    const pg = this.pane('gegner');
    this.actionEls.push(this.dyn(pg));
    const g3 = this.section(pg, 'GEGNER (einzeln)');
    for (const en of LAB_ENEMIES) g3.appendChild(this.btn(en.name, () => this.spawnEnemy(en.kind), `enemy:${en.kind}`));
    // Tab „Mehr“: Zeit & Schalter
    const pm = this.pane('mehr');
    const gt = this.section(pm, 'ZEIT');
    for (const sp of [0.25, 0.5, 1]) gt.appendChild(this.btn(`${sp}×`, () => { this.timeScale = sp; this.refreshButtons(); }, `speed:${sp}`));
    const g2 = this.section(pm, 'SCHALTER');
    g2.appendChild(this.btn('HP voll', () => { const e = this.bossEntity(); if (e) e.hp = e.maxHp; }, 'heal'));
    g2.appendChild(this.btn('Rig', () => { this.rigOn = !this.rigOn; this.applyRig(); this.refreshButtons(); }, 'rig'));
    g2.appendChild(this.btn('Boss ∞', () => { this.bossImmortal = !this.bossImmortal; this.refreshButtons(); }, 'bossImmortal'));
    g2.appendChild(this.btn('Ich ∞', () => { this.playerImmortal = !this.playerImmortal; this.refreshButtons(); }, 'playerImmortal'));
  }

  private refreshButtons(): void {
    this.renderActions();
    const set = (id: string, on: boolean) => this.panel.querySelector(`[data-lab="${id}"]`)?.classList.toggle('on', on);
    set('pause', this.paused);
    set('lev:auto', this.levAuto);
    this.panel.querySelectorAll('[data-pane]').forEach((el) => el.classList.toggle('show', (el as HTMLElement).dataset.pane === this.tab));
    for (const t of ['bosse', 'gegner', 'mehr']) this.panel.querySelector(`[data-lab="tab:${t}"]`)?.classList.toggle('sel', this.tab === t);
    set('biom:auto', this.biom === null);
    for (const sec of [1, 2, 3, 4, 5]) set(`biom:${sec}`, this.biom === sec);
    set('rig', this.rigOn);
    set('bossImmortal', this.bossImmortal);
    set('playerImmortal', this.playerImmortal);
    for (const s of [0.25, 0.5, 1]) set(`speed:${s}`, this.timeScale === s);
    this.panel.querySelectorAll('[data-lab^="boss:"], [data-lab^="enemy:"], [data-lab^="arena:"]').forEach((el) => {
      const id = (el as HTMLElement).dataset.lab ?? '';
      el.classList.toggle('sel', id === `boss:${this.selected?.kind}` || id === `enemy:${this.selectedEnemy}` || id === `arena:${this.selectedArena}`);
    });
  }

  private refreshInfo(): void {
    this.layout(); // Spielfeld-Größe kann sich nach dem Laden/Drehen noch ändern
    const e = this.bossEntity() ?? this.dng.enemies[0];
    if (!e) {
      this.info.textContent = 'Kein Gegner';
      return;
    }
    const rig = RIG_BY_KIND[e.kind];
    const rigState = rig ? (getHDArt().rigs[rig] ? 'Rig an' : 'Rig aus') : 'kein Rig';
    const pct = Math.round((e.hp / e.maxHp) * 100);
    const biomTxt = this.loaded ? (this.loaded.sector === 5 ? 'Ω' : `S${this.loaded.sector}`) : '–';
    this.info.textContent = `${this.selectedArena ? `🏟 ${LAB_BOSSES.find((x) => x.kind === this.selectedArena)?.name ?? ''}` : this.selected?.name ?? e.kind} · Biom ${biomTxt}${this.biom === null ? ' (auto)' : ''} · HP ${pct} %${e.bossPhase2 ? ' · PHASE II' : ''}\n${e.bossStatusText ?? e.bossSub ?? ''} · ${rigState}${this.paused ? ' · PAUSE' : this.timeScale !== 1 ? ` · ${this.timeScale}×` : ''}`;
  }
}
