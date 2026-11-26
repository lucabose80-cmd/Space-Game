// BEHELFSMÄSSIGES Boss-Labor (Entwicklungs-/Test-Werkzeug, M11): Bosse & Gegner auswählen und in Bewegung ansehen.
// Aufruf NUR über die Adresse mit `?bosslab` (z. B. https://…/?bosslab). Im normalen Spiel nirgends verlinkt.
// Fasst den Spielstand NICHT an: Speichern ist gesperrt (state.saveLocked), nichts wird abgeschlossen oder verkauft.
// Hinweis: bewusst außerhalb der Spielwelt — bleibt ein Dev-Werkzeug und wird vor einem Release wieder entfernt.
import { getHDArt } from '../assets/artLoader';
import { RIG_BY_KIND } from '../data/rigs';
import type { Enemy } from '../dungeon/dungeonTypes';
import type { DungeonScene } from '../scenes/DungeonScene';
import type { GameState } from '../systems/gameState';
import type { SectorId } from '../types';
import { ROOM_CENTER_X, ROOM_CENTER_Y } from '../world/dungeonGen';

type Kind = Enemy['kind'];

interface LabBoss {
  kind: Kind;
  name: string;
  sector: SectorId;
  floor: 1 | 2 | 3;
}

export const LAB_BOSSES: LabBoss[] = [
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
  private timeScale = 1;
  private paused = false;
  private bossImmortal = true;
  private playerImmortal = true;
  private rigOn = true;
  private rigBackup: Record<string, ReturnType<typeof getHDArt>['rigs'][string]> = {};
  private infoTimer = 0;
  private open = window.innerHeight >= 520; // Querformat-Handy: eingeklappt starten
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
    this.infoTimer -= dt;
    if (this.infoTimer <= 0) {
      this.infoTimer = 0.25;
      this.refreshInfo();
    }
  }

  /** Falls das Spiel versucht, den Dungeon zu verlassen (Tod/Extraktion): im Labor einfach neu aufbauen. */
  public onReturnAttempt(): void {
    this.loadArena(this.selected?.sector ?? 1, this.selected?.floor ?? 1);
    if (this.selected) this.spawnBoss(this.selected);
  }

  // ---------- Arena ----------
  private loadArena(sector: SectorId, floor: 1 | 2 | 3): void {
    const d = this.dng;
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

  private spawnBoss(b: LabBoss): void {
    const d = this.dng;
    d.enemies.length = 0;
    d.projectiles.length = 0;
    d.bossFx.clear();
    d.spawnEnemy(b.kind, ROOM_CENTER_X + 40, ROOM_CENTER_Y - 30);
    this.applyRig();
  }

  private select(b: LabBoss): void {
    const needArena = !this.selected || this.selected.sector !== b.sector || this.selected.floor !== b.floor;
    this.selected = b;
    this.selectedEnemy = null;
    if (needArena) this.loadArena(b.sector, b.floor);
    this.spawnBoss(b);
    this.refreshButtons();
  }

  private spawnEnemy(kind: Kind): void {
    this.selectedEnemy = kind;
    this.selected = null;
    const d = this.dng;
    if (d.currentSector !== 1) this.loadArena(1, 1);
    d.enemies.length = 0;
    d.bossFx.clear();
    d.spawnEnemy(kind, ROOM_CENTER_X + 50, ROOM_CENTER_Y - 20);
    this.refreshButtons();
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
      #boss-lab .bl-head{display:flex;gap:4px;align-items:center}
      #boss-lab button{font:inherit;color:#e2e8f0;background:rgba(15,23,42,.92);border:1px solid #475569;padding:5px 6px;min-height:30px;cursor:pointer;touch-action:manipulation}
      #boss-lab button.on{border-color:#38e8d4;color:#38e8d4}
      #boss-lab button.sel{background:#0e7490;border-color:#67e8f9}
      #boss-lab .bl-body{margin-top:4px;background:rgba(10,15,26,.9);border:1px solid #334155;padding:6px;max-height:58vh;overflow:auto}
      #boss-lab h4{margin:6px 0 3px;font-size:9px;color:#fbbf24;font-weight:normal}
      #boss-lab .bl-grid{display:flex;flex-wrap:wrap;gap:3px}
      #boss-lab .bl-info{margin-top:4px;padding:4px 6px;background:rgba(10,15,26,.9);border:1px solid #334155;line-height:1.5;white-space:pre-line}
    `;
    document.head.appendChild(style);
    this.panel = document.createElement('div');
    this.panel.id = 'boss-lab';
    this.panel.addEventListener('mousedown', (e) => e.preventDefault()); // Tastatur-Fokus bleibt auf dem Spiel
    const head = document.createElement('div');
    head.className = 'bl-head';
    const toggle = this.btn('🧪 BOSS-LABOR ▾', () => {
      this.open = !this.open;
      this.body.style.display = this.open ? 'block' : 'none';
    });
    head.appendChild(toggle);
    head.appendChild(this.btn('✕ Zurück', () => (window.location.href = window.location.pathname)));
    this.panel.appendChild(head);
    this.body = document.createElement('div');
    this.body.className = 'bl-body';
    this.panel.appendChild(this.body);
    this.info = document.createElement('div');
    this.info.className = 'bl-info';
    this.panel.appendChild(this.info);
    document.body.appendChild(this.panel);
    this.buildBody();
    this.body.style.display = this.open ? 'block' : 'none';
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
      this.body.style.maxHeight = `${Math.max(110, Math.round(window.innerHeight - r.bottom - 6 - 200 - 70))}px`;
    } else {
      this.panel.style.top = '70px';
      this.panel.style.maxWidth = 'min(240px, 62vw)';
      this.body.style.maxHeight = '46vh';
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

  private section(title: string): HTMLDivElement {
    const h = document.createElement('h4');
    h.textContent = title;
    this.body.appendChild(h);
    const g = document.createElement('div');
    g.className = 'bl-grid';
    this.body.appendChild(g);
    return g;
  }

  private buildBody(): void {
    const g2 = this.section('STEUERUNG');
    g2.appendChild(this.btn('↻ Neu', () => (this.selected ? this.select(this.selected) : this.selectedEnemy && this.spawnEnemy(this.selectedEnemy)), 'respawn'));
    g2.appendChild(this.btn('Phase II', () => { const e = this.bossEntity(); if (e) e.hp = Math.min(e.hp, e.maxHp * 0.45); }, 'phase2'));
    g2.appendChild(this.btn('HP voll', () => { const e = this.bossEntity(); if (e) e.hp = e.maxHp; }, 'heal'));
    g2.appendChild(this.btn('⏸ Pause', () => { this.paused = !this.paused; this.refreshButtons(); }, 'pause'));
    for (const s of [0.25, 0.5, 1]) g2.appendChild(this.btn(`${s}×`, () => { this.timeScale = s; this.refreshButtons(); }, `speed:${s}`));
    g2.appendChild(this.btn('Rig', () => { this.rigOn = !this.rigOn; this.applyRig(); this.refreshButtons(); }, 'rig'));
    g2.appendChild(this.btn('Boss ∞', () => { this.bossImmortal = !this.bossImmortal; this.refreshButtons(); }, 'bossImmortal'));
    g2.appendChild(this.btn('Ich ∞', () => { this.playerImmortal = !this.playerImmortal; this.refreshButtons(); }, 'playerImmortal'));
    const g1 = this.section('BOSSE');
    for (const b of LAB_BOSSES) g1.appendChild(this.btn(`${b.sector === 5 ? 'Ω' : 'S' + b.sector + '·' + b.floor} ${b.name}`, () => this.select(b), `boss:${b.kind}`));
    const g3 = this.section('GEGNER (einzeln)');
    for (const en of LAB_ENEMIES) g3.appendChild(this.btn(en.name, () => this.spawnEnemy(en.kind), `enemy:${en.kind}`));
  }

  private refreshButtons(): void {
    const set = (id: string, on: boolean) => this.panel.querySelector(`[data-lab="${id}"]`)?.classList.toggle('on', on);
    set('pause', this.paused);
    set('rig', this.rigOn);
    set('bossImmortal', this.bossImmortal);
    set('playerImmortal', this.playerImmortal);
    for (const s of [0.25, 0.5, 1]) set(`speed:${s}`, this.timeScale === s);
    this.panel.querySelectorAll('[data-lab^="boss:"], [data-lab^="enemy:"]').forEach((el) => {
      const id = (el as HTMLElement).dataset.lab ?? '';
      el.classList.toggle('sel', id === `boss:${this.selected?.kind}` || id === `enemy:${this.selectedEnemy}`);
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
    this.info.textContent = `${this.selected?.name ?? e.kind} · HP ${pct} %${e.bossPhase2 ? ' · PHASE II' : ''}\n${e.bossStatusText ?? e.bossSub ?? ''} · ${rigState}${this.paused ? ' · PAUSE' : this.timeScale !== 1 ? ` · ${this.timeScale}×` : ''}`;
  }
}
