/**
 * Meilenstein 10-A — Laufzeit der Sektor-Raum-Mechaniken (Muster wie DungeonEnemyAi).
 *  - S2 Kristall-Prismen: solide, spiegeln Gegner-Projektile (×1,5 Schaden), teilen Spieler-Projektile in 3 Splitter.
 *  - S3 Schmelz-Düsen & Magnetplatten, S4 Astral-Teleporter (folgen in späteren Commits dieser Datei).
 * Alle Zyklen laufen über `scene.mechanicsClock` (raumlokale Uhr, Reset bei enterRoom) — nie über scene.time.
 */
import { sound } from '../engine/audio';
import type { DungeonScene } from '../scenes/DungeonScene';
import {
  type CrystalPrism,
  type FlameJet,
  type MagnetPlate,
  type TeleportPad,
} from '../world/dungeonGen';
import type { Enemy, Projectile } from './dungeonTypes';

export type ProjectileResult = 'pass' | 'reflected' | 'split' | 'absorbed';

export const PRISM_SPLIT_COOLDOWN = 0.35;
export const PRISM_MELEE_COOLDOWN = 2.5;
const PRISM_FLASH = 0.28;

// ---------- S3: Zyklen (raumlokale Uhr) ----------
export const JET_PERIOD = 3.6;
export const JET_WARN_FROM = 2.0;
export const JET_ACTIVE_FROM = 2.8;
export const JET_DAMAGE = 16;
export const JET_ENEMY_DPS = 30;
export const JET_BOSS_FACTOR = 0.25;
export const JET_HALF_WIDTH = 5;
export const PLATE_PERIOD = 5.0;
export const PLATE_ACTIVE_SEC = 1.6;
export const PLATE_REACH = 34;
export const PLATE_PLAYER_SPEED = 70;
export const PLATE_ENEMY_SPEED = 90;
export const PLATE_PROJECTILE_TURN = 0.436; // 25°/s in rad

// ---------- S4: Astral-Teleporter ----------
export const PAD_RADIUS = 9;
export const PAD_DWELL_SEC = 0.25;
export const PAD_LOCK_SEC = 1.2;
export const PAD_COLORS = ['#38e8d4', '#fde047', '#c084fc'] as const;

export type JetState = 'safe' | 'warn' | 'active';

export function jetState(clock: number, phase: number): JetState {
  const c = (((clock + phase) % JET_PERIOD) + JET_PERIOD) % JET_PERIOD;
  return c >= JET_ACTIVE_FROM ? 'active' : c >= JET_WARN_FROM ? 'warn' : 'safe';
}

export function plateActive(clock: number, phase: number): boolean {
  return (((clock + phase) % PLATE_PERIOD) + PLATE_PERIOD) % PLATE_PERIOD < PLATE_ACTIVE_SEC;
}

export function jetEnds(j: FlameJet): { x1: number; y1: number; x2: number; y2: number } {
  return j.axis === 'h'
    ? { x1: j.x - j.length / 2, y1: j.y, x2: j.x + j.length / 2, y2: j.y }
    : { x1: j.x, y1: j.y - j.length / 2, x2: j.x, y2: j.y + j.length / 2 };
}

export class RoomMechanicsSystem {
  // ⚠ erasableSyntaxOnly: keine Parameter-Properties → Feld explizit deklarieren
  private scene: DungeonScene;
  private prismSplitCd = new Map<number, number>();
  private prismMeleeCd = new Map<number, number>();
  /** Für den Renderer: verbleibende Blitz-Zeit je Prisma. */
  public prismFlash = new Map<number, number>();
  // S3: aufgelaufener Düsen-Schaden je Gegner (Enemy-id → Akku), alle 0,25 s ganzzahlig angewendet
  private jetAcc = new Map<number, number>();
  private jetFlushTimer = 0;
  private jetSparkAcc = 0;
  // S4: Verweildauer auf dem aktuellen Pad, Sperren je Pad, „erst absteigen“-Sicherung gegen Ping-Pong
  private padDwellId: number | null = null;
  private padDwell = 0;
  private padLock = new Map<number, number>();
  private padArmed = true;

  constructor(scene: DungeonScene) {
    this.scene = scene;
  }

  private get prisms(): CrystalPrism[] {
    return this.scene.currentRoom?.prisms ?? [];
  }

  public resetForRoom(): void {
    this.prismSplitCd.clear();
    this.prismMeleeCd.clear();
    this.prismFlash.clear();
    this.jetAcc.clear();
    this.jetFlushTimer = 0;
    this.jetSparkAcc = 0;
    this.padDwellId = null;
    this.padDwell = 0;
    this.padLock.clear();
    this.padArmed = true;
  }

  public update(dt: number): void {
    for (const m of [this.prismSplitCd, this.prismMeleeCd, this.prismFlash]) {
      for (const [id, v] of m) {
        if (v - dt <= 0) m.delete(id);
        else m.set(id, v - dt);
      }
    }
    if (this.scene.finished) return;
    const room = this.scene.currentRoom;
    if (!room) return;
    this.updateJets(dt);
    this.updatePlates(dt);
    this.updateTeleporters(dt);
  }

  // ---------- S4: Astral-Teleporter ----------
  /** Anteil (0..1) der Verweil-Aufladung für den Renderer. */
  public getPadCharge(pad: TeleportPad): number {
    return this.padDwellId === pad.id ? Math.min(1, this.padDwell / PAD_DWELL_SEC) : 0;
  }

  public isPadLocked(pad: TeleportPad): boolean {
    return (this.padLock.get(pad.id) ?? 0) > 0;
  }

  private updateTeleporters(dt: number): void {
    const pads = this.scene.currentRoom.teleporters;
    if (!pads || pads.length < 2) return;
    const sc = this.scene;
    for (const [id, v] of this.padLock) {
      if (v - dt <= 0) this.padLock.delete(id);
      else this.padLock.set(id, v - dt);
    }
    const under = pads.find((p) => Math.hypot(sc.playerX - p.x, sc.playerY - p.y) < PAD_RADIUS);
    // Nach einem Teleport muss der Spieler erst von den Pads absteigen (kein Ping-Pong)
    if (!under) {
      const near = pads.some((p) => Math.hypot(sc.playerX - p.x, sc.playerY - p.y) < PAD_RADIUS + 3);
      if (!near) this.padArmed = true;
      this.padDwellId = null;
      this.padDwell = 0;
      return;
    }
    if (!this.padArmed || sc.dashTimer > 0 || this.isPadLocked(under)) {
      this.padDwellId = null;
      this.padDwell = 0;
      return;
    }
    if (this.padDwellId !== under.id) {
      this.padDwellId = under.id;
      this.padDwell = 0;
    }
    this.padDwell += dt;
    if (this.padDwell < PAD_DWELL_SEC) return;
    const partner = pads.find((p) => p.pairId === under.pairId && p.id !== under.id);
    this.padDwellId = null;
    this.padDwell = 0;
    if (!partner) return;
    // Teleport: Gegner werden NICHT mitgenommen (Aggro-Abbau ist der taktische Kern)
    sc.spawnBurst(under.x, under.y, PAD_COLORS[under.colorIdx], 14);
    sc.playerX = partner.x;
    sc.playerY = partner.y;
    sc.lastSafeX = partner.x;
    sc.lastSafeY = partner.y;
    sc.invulnTimer = Math.max(sc.invulnTimer, 0.3);
    sc.spawnBurst(partner.x, partner.y, PAD_COLORS[partner.colorIdx], 14);
    sound.playWarp();
    this.padLock.set(under.id, PAD_LOCK_SEC);
    this.padLock.set(partner.id, PAD_LOCK_SEC);
    this.padArmed = false;
  }

  public getJetState(j: FlameJet): JetState {
    return jetState(this.scene.mechanicsClock, j.phase);
  }

  public isPlateActive(m: MagnetPlate): boolean {
    return plateActive(this.scene.mechanicsClock, m.phase);
  }

  // ---------- S3: Schmelz-Düsen ----------
  private updateJets(dt: number): void {
    const jets = this.scene.currentRoom.flameJets;
    if (!jets || jets.length === 0) return;
    const sc = this.scene;
    for (const j of jets) {
      if (this.getJetState(j) !== 'active') continue;
      const e = jetEnds(j);
      // Glut-Funken entlang des Strahls
      this.jetSparkAcc += dt * 16;
      while (this.jetSparkAcc >= 1) {
        this.jetSparkAcc -= 1;
        const t = (sc.time * 1000 + this.jetSparkAcc * 977) % 1;
        sc.particles.push({
          x: e.x1 + (e.x2 - e.x1) * t,
          y: e.y1 + (e.y2 - e.y1) * t - 1,
          vx: ((t * 7919) % 1 - 0.5) * 18,
          vy: -16 - ((t * 104729) % 1) * 14,
          color: t > 0.5 ? '#fb923c' : '#fde047',
          size: 1.6,
          life: 0.3,
          maxLife: 0.3,
        });
      }
      // Spieler: Dash & Lanzen-Vorstoß sind sicher (wie bei den Vents)
      if (sc.dashTimer <= 0 && sc.lanceChargeTimer <= 0) {
        const d = sc.pointToSegmentDist(sc.playerX, sc.playerY, e.x1, e.y1, e.x2, e.y2);
        if (d <= JET_HALF_WIDTH + 6) {
          const nx = j.axis === 'h' ? 0 : Math.sign(sc.playerX - j.x) || 1;
          const ny = j.axis === 'h' ? Math.sign(sc.playerY - j.y) || -1 : 0;
          sc.damagePlayer(JET_DAMAGE, nx, ny);
        }
      }
    }
    // Aufgelaufenen Gegner-Schaden alle 0,25 s ganzzahlig anwenden (damageEnemy kennt keinen DoT-Modus)
    this.jetFlushTimer += dt;
    if (this.jetFlushTimer >= 0.25) {
      this.jetFlushTimer = 0;
      this.flushJetDamage();
    }
  }

  private flushJetDamage(): void {
    for (const [id, acc] of [...this.jetAcc]) {
      const enemy = this.scene.enemies.find((x) => x.id === id);
      if (!enemy || enemy.hp <= 0) {
        this.jetAcc.delete(id);
        continue;
      }
      const n = Math.floor(acc);
      if (n >= 1) {
        this.jetAcc.set(id, acc - n);
        this.scene.damageEnemy(enemy, n, 0, 0, 0, true, false); // piercing: Schilde blocken Lava nicht; keine Prägungs-Effekte
      }
    }
  }

  // ---------- S3: Magnetplatten ----------
  private updatePlates(dt: number): void {
    const plates = this.scene.currentRoom.magnetPlates;
    if (!plates || plates.length === 0) return;
    const sc = this.scene;
    for (const m of plates) {
      if (!this.isPlateActive(m)) continue;
      const reach = m.r + PLATE_REACH;
      const sign = m.polarity === 'pull' ? 1 : -1;
      // Spieler (nicht im Dash; nie in eine Schlucht ziehen)
      if (sc.dashTimer <= 0) {
        const dx = m.x - sc.playerX;
        const dy = m.y - sc.playerY;
        const d = Math.hypot(dx, dy);
        if (d > 1 && d < reach) {
          const sx = (dx / d) * sign * PLATE_PLAYER_SPEED * dt;
          const sy = (dy / d) * sign * PLATE_PLAYER_SPEED * dt;
          if (!sc.getChasmAt(sc.playerX + sx * 3, sc.playerY + sy * 3, 4)) sc.moveEntityWithCollisions(sx, sy);
        }
      }
      // Projektile: pull-Platten biegen die Flugbahn zur Mitte (max. 25°/s)
      if (m.polarity === 'pull') {
        for (const p of sc.projectiles) {
          if (Math.hypot(p.x - m.x, p.y - m.y) > reach) continue;
          const speed = Math.hypot(p.vx, p.vy);
          if (speed < 1) continue;
          const cur = Math.atan2(p.vy, p.vx);
          let diff = Math.atan2(m.y - p.y, m.x - p.x) - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-PLATE_PROJECTILE_TURN * dt, Math.min(PLATE_PROJECTILE_TURN * dt, diff));
          p.vx = Math.cos(cur + turn) * speed;
          p.vy = Math.sin(cur + turn) * speed;
        }
      }
    }
  }

  /** Pro Gegner und Frame aus enemyAi.updateEnemies: Düsen-Schaden (Akku) & Magnetkraft (nicht auf Bosse/Geschütze). */
  public applyToEnemy(e: Enemy, dt: number): void {
    const room = this.scene.currentRoom;
    if (!room || e.hp <= 0) return;
    const boss = this.scene.isBossKind(e.kind);
    for (const j of room.flameJets ?? []) {
      if (this.getJetState(j) !== 'active') continue;
      const en = jetEnds(j);
      if (this.scene.pointToSegmentDist(e.x, e.y, en.x1, en.y1, en.x2, en.y2) <= JET_HALF_WIDTH + e.radius) {
        this.jetAcc.set(e.id, (this.jetAcc.get(e.id) ?? 0) + JET_ENEMY_DPS * dt * (boss ? JET_BOSS_FACTOR : 1));
      }
    }
    if (boss || e.kind === 'turret') return;
    for (const m of room.magnetPlates ?? []) {
      if (!this.isPlateActive(m)) continue;
      const dx = m.x - e.x;
      const dy = m.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= 1 || d >= m.r + PLATE_REACH) continue;
      const sign = m.polarity === 'pull' ? 1 : -1;
      const nx = e.x + (dx / d) * sign * PLATE_ENEMY_SPEED * dt;
      const ny = e.y + (dy / d) * sign * PLATE_ENEMY_SPEED * dt;
      const sc = this.scene;
      const rb = sc.bounds; // M12: Raumgrenzen
      const inside = nx > rb.l + e.radius && nx < rb.r - e.radius && ny > rb.t + e.radius && ny < rb.b - e.radius;
      if (inside && !sc.collidesRoomObstacle(nx, ny, e.radius) && !sc.collidesRoomChasm(nx, ny, e.radius * 0.8)) {
        e.x = nx;
        e.y = ny;
      }
    }
  }

  /** Nur Prismen sind solide (Düsen, Platten & Pads nicht). */
  public collides(x: number, y: number, r: number): boolean {
    for (const pr of this.prisms) {
      if (Math.hypot(x - pr.x, y - pr.y) < pr.r + r) return true;
    }
    return false;
  }

  // ---------- Projektile ----------
  /** Wird in updateProjectiles VOR der Wand-Prüfung aufgerufen. 'split' / 'absorbed' → Projektil entfernen. */
  public handleProjectile(p: Projectile): ProjectileResult {
    for (const pr of this.prisms) {
      const dist = Math.hypot(p.x - pr.x, p.y - pr.y);
      if (dist >= pr.r + p.radius) continue;
      const nx = dist > 0.001 ? (p.x - pr.x) / dist : 1;
      const ny = dist > 0.001 ? (p.y - pr.y) / dist : 0;
      const dot = p.vx * nx + p.vy * ny;
      if (dot >= 0) continue; // fliegt schon weg (z. B. gerade gespiegelt)

      const splitCd = this.prismSplitCd.get(pr.id) ?? 0;
      const canSplit = p.fromPlayer && splitCd <= 0 && (p.splitGen ?? 0) < 1;
      this.prismFlash.set(pr.id, PRISM_FLASH);

      if (canSplit) {
        this.splitProjectile(p, pr);
        return 'split';
      }
      // Spiegeln: Geschwindigkeit an der Kreis-Normalen reflektieren
      p.vx -= 2 * dot * nx;
      p.vy -= 2 * dot * ny;
      p.x = pr.x + nx * (pr.r + p.radius + 1);
      p.y = pr.y + ny * (pr.r + p.radius + 1);
      if (!p.fromPlayer) {
        p.fromPlayer = true;
        p.damage = Math.max(1, Math.round(p.damage * 1.5));
        p.color = '#e879f9';
        p.life = Math.max(p.life, 0.8);
        p.splitGen = (p.splitGen ?? 0) + 1;
        this.scene.spawnBurst(pr.x, pr.y, '#e879f9', 6);
        sound.playShieldBlock();
      } else {
        this.scene.spawnBurst(pr.x, pr.y, '#c084fc', 4);
      }
      return 'reflected';
    }
    return 'pass';
  }

  /** Spieler-Projektil trifft Prisma: 3 Splitter (je 55 % Schaden) auf die nächsten Gegner, sonst Fächer ±25°. */
  private splitProjectile(p: Projectile, pr: CrystalPrism): void {
    this.prismSplitCd.set(pr.id, PRISM_SPLIT_COOLDOWN);
    const speed = Math.max(60, Math.hypot(p.vx, p.vy));
    const base = Math.atan2(p.vy, p.vx);
    const targets = this.scene.enemies
      .filter((e) => e.hp > 0)
      .map((e) => ({ e, d: Math.hypot(e.x - pr.x, e.y - pr.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((t) => Math.atan2(t.e.y - pr.y, t.e.x - pr.x));
    const fan = [-0.436, 0.436, 0]; // ±25°, dann Mitte
    for (let i = 0; targets.length < 3; i++) targets.push(base + fan[i % fan.length]);
    for (const a of targets) {
      this.scene.projectiles.push({
        x: pr.x + Math.cos(a) * (pr.r + p.radius + 3),
        y: pr.y + Math.sin(a) * (pr.r + p.radius + 3),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        fromPlayer: true,
        damage: Math.max(1, Math.round(p.damage * 0.55)),
        color: '#c084fc',
        radius: 2.6,
        life: 1.0,
        splitGen: (p.splitGen ?? 0) + 1,
      });
    }
    this.scene.spawnBurst(pr.x, pr.y, '#c084fc', 10);
    sound.playSecretChime();
  }

  // ---------- Nahkampf ----------
  /**
   * Nahkampf/Disc trifft ein Prisma → radialer Burst aus 6 Splittern (Cooldown 2,5 s pro Prisma).
   * `test` bekommt die Prisma-Position und entscheidet (dieselbe Geometrie wie bei den Pods).
   */
  public onMeleeHitWhere(test: (x: number, y: number) => boolean): void {
    for (const pr of this.prisms) {
      if ((this.prismMeleeCd.get(pr.id) ?? 0) > 0) continue;
      if (!test(pr.x, pr.y)) continue;
      this.prismMeleeCd.set(pr.id, PRISM_MELEE_COOLDOWN);
      this.prismFlash.set(pr.id, PRISM_FLASH);
      const dmg = Math.round(12 * (1 + (this.scene.currentFloor - 1) * 0.25));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        this.scene.projectiles.push({
          x: pr.x + Math.cos(a) * (pr.r + 4),
          y: pr.y + Math.sin(a) * (pr.r + 4),
          vx: Math.cos(a) * 130,
          vy: Math.sin(a) * 130,
          fromPlayer: true,
          damage: dmg,
          color: '#e879f9',
          radius: 2.6,
          life: 0.7,
          splitGen: 1,
        });
      }
      this.scene.spawnBurst(pr.x, pr.y, '#e879f9', 12);
      sound.playSecretChime();
    }
  }

  /** Komfort-Variante mit Kreis (Plan-API). */
  public onMeleeHit(x: number, y: number, r: number): void {
    this.onMeleeHitWhere((px, py) => Math.hypot(px - x, py - y) <= r);
  }
}
