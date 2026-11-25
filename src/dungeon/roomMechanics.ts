/**
 * Meilenstein 10-A — Laufzeit der Sektor-Raum-Mechaniken (Muster wie DungeonEnemyAi).
 *  - S2 Kristall-Prismen: solide, spiegeln Gegner-Projektile (×1,5 Schaden), teilen Spieler-Projektile in 3 Splitter.
 *  - S3 Schmelz-Düsen & Magnetplatten, S4 Astral-Teleporter (folgen in späteren Commits dieser Datei).
 * Alle Zyklen laufen über `scene.mechanicsClock` (raumlokale Uhr, Reset bei enterRoom) — nie über scene.time.
 */
import { sound } from '../engine/audio';
import type { DungeonScene } from '../scenes/DungeonScene';
import type { CrystalPrism } from '../world/dungeonGen';
import type { Projectile } from './dungeonTypes';

export type ProjectileResult = 'pass' | 'reflected' | 'split' | 'absorbed';

export const PRISM_SPLIT_COOLDOWN = 0.35;
export const PRISM_MELEE_COOLDOWN = 2.5;
const PRISM_FLASH = 0.28;

export class RoomMechanicsSystem {
  // ⚠ erasableSyntaxOnly: keine Parameter-Properties → Feld explizit deklarieren
  private scene: DungeonScene;
  private prismSplitCd = new Map<number, number>();
  private prismMeleeCd = new Map<number, number>();
  /** Für den Renderer: verbleibende Blitz-Zeit je Prisma. */
  public prismFlash = new Map<number, number>();

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
  }

  public update(dt: number): void {
    for (const m of [this.prismSplitCd, this.prismMeleeCd, this.prismFlash]) {
      for (const [id, v] of m) {
        if (v - dt <= 0) m.delete(id);
        else m.set(id, v - dt);
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
