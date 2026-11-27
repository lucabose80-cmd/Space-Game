import { sound } from '../engine/audio';
import { ENEMY_SHIELDS, SHIELD_HEAT_DECAY_SEC } from '../data/balance';
import { runBoss } from './bosses/bossEngine';
import { BOSS_DEFS } from './bosses/defs';
import type { DungeonScene } from '../scenes/DungeonScene';
import type { BossState, Enemy } from './dungeonTypes';

export class DungeonEnemyAi {
  private scene: DungeonScene;

  constructor(scene: DungeonScene) {
    this.scene = scene;
  }

  // ==================== LIVELY, DYNAMIC ENEMY AI ====================
  public updateEnemies(rawDt: number): void {
    const rb = this.scene.bounds; // M12: Raumgrenzen (Standard = ROOM_LEFT…)
    for (let i = this.scene.enemies.length - 1; i >= 0; i--) {
      const e = this.scene.enemies[i];

      // Milestone 7: Solar-Brand Burn DoT ticking every 0.5s
      if (e.burnTimer && e.burnTimer > 0) {
        e.burnTimer = Math.max(0, e.burnTimer - rawDt);
        e.burnTickTimer = (e.burnTickTimer ?? 0.5) - rawDt;
        if (Math.random() < rawDt * 7) {
          this.scene.particles.push({
            x: e.x + (Math.random() - 0.5) * e.radius * 1.4,
            y: e.y - Math.random() * e.radius,
            vx: (Math.random() - 0.5) * 14,
            vy: -18 - Math.random() * 14,
            color: '#fb923c',
            size: 1.6,
            life: 0.28,
            maxLife: 0.28,
          });
        }
        if (e.burnTickTimer <= 0) {
          e.burnTickTimer = 0.5;
          const burnDmg = Math.max(4, Math.round((e.burnDps ?? 6) * 0.5));
          e.hp -= burnDmg;
          e.flashTimer = 0.06;
          this.scene.floats.push({
            x: e.x + (Math.random() - 0.5) * 8,
            y: e.y - e.radius - 6,
            text: `🔥${burnDmg}`,
            color: '#fb923c',
            life: 0.55,
            maxLife: 0.55,
          });
          if (e.hp <= 0) {
            this.scene.onEnemyKilled(e);
            continue;
          }
        }
      }

      // Milestone 7: Kryo-Stasis (-42% tempo) & Hasted Mutator (+22% tempo)
      let dt = rawDt;
      if (e.cryoTimer && e.cryoTimer > 0) {
        e.cryoTimer = Math.max(0, e.cryoTimer - rawDt);
        dt *= 0.58;
        if (Math.random() < rawDt * 5) {
          this.scene.particles.push({
            x: e.x + (Math.random() - 0.5) * e.radius * 1.3,
            y: e.y + (Math.random() - 0.5) * e.radius,
            vx: 0,
            vy: 8,
            color: '#67e8f9',
            size: 1.5,
            life: 0.3,
            maxLife: 0.3,
          });
        }
      }
      if (e.mutator === 'hasted') {
        dt *= 1.22;
      }

      e.anim += dt * 7.5;
      e.flashTimer = Math.max(0, e.flashTimer - rawDt);
      // M10-C Schilde: Fenster läuft ab, Hitze klingt ab
      if (e.shieldDownTimer && e.shieldDownTimer > 0) e.shieldDownTimer = Math.max(0, e.shieldDownTimer - rawDt);
      if (e.shieldHeat && e.shieldHeat > 0) e.shieldHeat = Math.max(0, e.shieldHeat - rawDt / SHIELD_HEAT_DECAY_SEC);

      e.vx *= Math.pow(0.03, dt);
      e.vy *= Math.pow(0.03, dt);

      // Milestone 10-A: Düsen-Schaden & Magnetplatten-Kräfte der Sektor-Mechaniken
      this.scene.mechanics.applyToEnemy(e, dt);

      const dx = this.scene.playerX - e.x;
      const dy = this.scene.playerY - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      // M10-C Navigation: Bodenläufer umgehen Hindernisse (nur bei blockierter Sichtlinie, sonst wie bisher)
      const steered = this.steer(e, dx / dist, dy / dist, dist, dt);
      const nx = steered.x;
      const ny = steered.y;

      if (e.kind === 'slime') {
        // Energetic continuous bouncing hops + slime trail + telegraphed pounce every 3rd hop!
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            // Fast pounce lunge!
            e.vx += e.chargeDirX * 195;
            e.vy += e.chargeDirY * 195;
            this.scene.spawnBurst(e.x, e.y + 4, '#c084fc', 5);
            e.aiTimer = 0.72;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.phase += 1;
            if (e.phase % 3 === 0 && dist < 130) {
              // Wind-up crouch before pounce
              e.telegraphTimer = 0.36;
              e.chargeDirX = nx;
              e.chargeDirY = ny;
            } else {
              // Bouncy zig-zag hop toward player
              const jitter = (Math.random() - 0.5) * 0.65;
              const hopAngle = Math.atan2(ny, nx) + jitter;
              e.vx += Math.cos(hopAngle) * 112;
              e.vy += Math.sin(hopAngle) * 112;
              this.scene.decals.push({
                x: e.x,
                y: e.y + 7,
                r: 4 + Math.random() * 2,
                color: 'rgba(168, 85, 247, 0.35)',
                life: 2.2,
                maxLife: 2.2,
              });
              e.aiTimer = 0.56 + Math.random() * 0.22;
            }
          }
        }
      } else if (e.kind === 'drone') {
        // Agile orbiting strafe + laser lock sightline + rapid 2-bolt burst + tactical side-dash!
        e.phase += dt * 2.2;
        const desiredDist = 86;
        const radial = dist > desiredDist + 12 ? 1 : dist < 56 ? -1 : 0;
        const strafe = e.moveDirX;
        const tx = -ny * strafe * 62 + nx * radial * 54;
        const ty = nx * strafe * 62 + ny * radial * 54;
        e.vx += tx * dt * 4.5;
        e.vy += ty * dt * 4.5;

        // Subtle cyan thruster exhaust
        if (Math.random() < dt * 10) {
          this.scene.particles.push({
            x: e.x,
            y: e.y + 4,
            vx: -e.vx * 0.25,
            vy: 12,
            color: '#38e8d4',
            size: 1.4,
            life: 0.22,
            maxLife: 0.22,
          });
        }

        if (e.subBurst > 0) {
          e.burstDelay -= dt;
          if (e.burstDelay <= 0) {
            this.fireEnemyBolt(e.x, e.y, e.aimAngle + (Math.random() - 0.5) * 0.08, 162, 13, '#e879f9');
            e.subBurst -= 1;
            e.burstDelay = 0.16;
            if (e.subBurst === 0) {
              // Immediate agile side-dash reposition!
              e.moveDirX = -e.moveDirX;
              e.vx += -ny * e.moveDirX * 145;
              e.vy += nx * e.moveDirX * 145;
              e.aiTimer = 1.45 + Math.random() * 0.5;
            }
          }
        } else if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          e.aimAngle = Math.atan2(dy, dx);
          if (e.telegraphTimer <= 0) {
            e.subBurst = 2;
            e.burstDelay = 0;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.46;
            e.aimAngle = Math.atan2(dy, dx);
          }
        }
      } else if (e.kind === 'turret') {
        // Mobile Scurry-Turret: scurries briskly to flank -> plants & fires 3-bolt fan -> repositions!
        if (e.scurryTimer > 0) {
          e.scurryTimer -= dt;
          if (e.moveDirX === 0 && e.moveDirY === 0) {
            const perp = Math.random() > 0.5 ? 1 : -1;
            const a = Math.atan2(dy, dx) + perp * (0.75 + Math.random() * 0.6);
            e.moveDirX = Math.cos(a);
            e.moveDirY = Math.sin(a);
          }
          e.vx = e.moveDirX * 72;
          e.vy = e.moveDirY * 72;
          if (Math.random() < dt * 8) {
            this.scene.particles.push({
              x: e.x,
              y: e.y + 8,
              vx: -e.vx * 0.2,
              vy: -6,
              color: '#94a3b8',
              size: 1.5,
              life: 0.25,
              maxLife: 0.25,
            });
          }
          if (e.scurryTimer <= 0) {
            e.moveDirX = 0;
            e.moveDirY = 0;
            e.aiTimer = 0.45;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const baseAngle = Math.atan2(dy, dx);
            for (const offset of [-0.28, 0, 0.28]) {
              this.fireEnemyBolt(e.x, e.y, baseAngle + offset, 142, 15, '#fb923c');
            }
            this.scene.spawnBurst(e.x, e.y, '#fbbf24', 6);
            // Scurry immediately after firing!
            e.scurryTimer = 0.95 + Math.random() * 0.45;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.52;
          }
        }
      } else if (e.kind === 'shield_drone') {
        // Armored Aegis-Drone: tracks player with frontal kinetic shield arc (flank or pierce!), fires 3-bolt burst!
        const targetAng = Math.atan2(dy, dx);
        const turnDiff = this.scene.normalizeAngle(targetAng - e.aimAngle);
        const turnRate = e.telegraphTimer > 0 ? 1.2 : 2.3;
        e.aimAngle += Math.max(-turnRate * dt, Math.min(turnRate * dt, turnDiff));

        const desiredDist = 74;
        const radial = dist > desiredDist + 14 ? 1 : dist < 50 ? -1 : 0;
        const strafe = e.moveDirX;
        e.vx += (-ny * strafe * 44 + nx * radial * 46) * dt * 4;
        e.vy += (nx * strafe * 44 + ny * radial * 46) * dt * 4;

        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            for (const off of [-0.24, 0, 0.24]) {
              this.fireEnemyBolt(e.x, e.y, e.aimAngle + off, 148, 14, '#38e8d4');
            }
            this.scene.spawnBurst(e.x + Math.cos(e.aimAngle) * 10, e.y + Math.sin(e.aimAngle) * 10, '#38e8d4', 6);
            e.moveDirX = -e.moveDirX;
            e.aiTimer = 1.65 + Math.random() * 0.45;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.48;
            // Angriff öffnet den Schild (Vorwarnung + Nachwirkung) — Zeit für einen Konter
            e.shieldDownTimer = Math.max(e.shieldDownTimer ?? 0, ENEMY_SHIELDS.shield_drone.attackOpenSec);
          }
        }
      } else if (e.kind === 'spore_spitter') {
        // Bioluminescent Floor II/III Spore-Spitter: fires bursting spore globs that split into 5 mini-spores, then burrows!
        if (e.scurryTimer > 0) {
          e.scurryTimer -= dt;
          e.vx = e.moveDirX * 84;
          e.vy = e.moveDirY * 84;
          if (Math.random() < dt * 14) {
            this.scene.particles.push({
              x: e.x,
              y: e.y + 6,
              vx: (Math.random() - 0.5) * 20,
              vy: -14,
              color: '#34d399',
              size: 1.8,
              life: 0.25,
              maxLife: 0.25,
            });
          }
          if (e.scurryTimer <= 0) {
            e.aiTimer = 0.7 + Math.random() * 0.4;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const ang = Math.atan2(dy, dx);
            this.scene.projectiles.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(ang) * 124,
              vy: Math.sin(ang) * 124,
              fromPlayer: false,
              damage: 14,
              color: '#a3e635',
              radius: 5.0,
              life: 0.85,
              isSporeGlob: true,
            });
            this.scene.spawnBurst(e.x, e.y, '#34d399', 7);
            // Skitter away to a new flank angle
            const away = ang + Math.PI + (Math.random() - 0.5) * 1.4;
            e.moveDirX = Math.cos(away);
            e.moveDirY = Math.sin(away);
            e.scurryTimer = 0.72;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.5;
          }
        }
      } else if (e.kind === 'drone_arc') {
        // Floor II/III Overcharged Arc-Drone: agile orbital strafing + 3-bolt electric arc fan!
        e.phase += dt * 2.4;
        const desiredDist = 104;
        const radial = dist > desiredDist + 16 ? 1 : dist < desiredDist - 16 ? -1 : 0;
        const tx = -ny * Math.sin(e.phase * 0.7) * 68;
        const ty = nx * Math.sin(e.phase * 0.7) * 68;
        e.vx = nx * radial * 52 + tx;
        e.vy = ny * radial * 52 + ty;
        if (e.telegraphTimer > 0) {
          e.vx *= 0.22;
          e.vy *= 0.22;
          e.telegraphTimer -= dt;
          if (Math.random() < dt * 16) {
            this.scene.particles.push({
              x: e.x + (Math.random() - 0.5) * 14,
              y: e.y + (Math.random() - 0.5) * 14,
              vx: (Math.random() - 0.5) * 26,
              vy: (Math.random() - 0.5) * 26,
              color: Math.random() < 0.5 ? '#c084fc' : '#38e8d4',
              size: 1.6,
              life: 0.2,
              maxLife: 0.2,
            });
          }
          if (e.telegraphTimer <= 0) {
            const baseAng = Math.atan2(dy, dx);
            for (const offset of [-0.25, 0, 0.25]) {
              const a = baseAng + offset;
              this.scene.projectiles.push({
                x: e.x + Math.cos(a) * 10,
                y: e.y + Math.sin(a) * 10,
                vx: Math.cos(a) * 148,
                vy: Math.sin(a) * 148,
                fromPlayer: false,
                damage: 14,
                color: offset === 0 ? '#38e8d4' : '#c084fc',
                radius: 3.4,
                life: 1.7,
              });
            }
            this.scene.spawnBurst(e.x, e.y, '#c084fc', 8);
            e.aiTimer = 1.65 + Math.random() * 0.45;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.48;
          }
        }
      } else if (e.kind === 'slime_magma') {
        // Floor III Reactor Magma-Slime: aggressive flaming hops leaving molten ember decals + 2-shot ember burst on pounce!
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          e.vx = e.chargeDirX * 138;
          e.vy = e.chargeDirY * 138;
          if (Math.random() < dt * 22) {
            this.scene.particles.push({
              x: e.x,
              y: e.y + 4,
              vx: (Math.random() - 0.5) * 26,
              vy: (Math.random() - 0.5) * 26,
              color: Math.random() < 0.5 ? '#fb923c' : '#fde047',
              size: 2.0,
              life: 0.28,
              maxLife: 0.28,
            });
          }
          if (e.chargeActive <= 0) {
            // Molten landing impact: fire decal + 2 flanking sparks!
            this.scene.decals.push({
              x: e.x,
              y: e.y + 5,
              r: 13,
              color: 'rgba(249, 115, 22, 0.36)',
              life: 3.4,
              maxLife: 3.4,
            });
            const ang = Math.atan2(dy, dx);
            for (const off of [-0.45, 0.45]) {
              this.scene.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(ang + off) * 116,
                vy: Math.sin(ang + off) * 116,
                fromPlayer: false,
                damage: 13,
                color: '#fb923c',
                radius: 3.6,
                life: 1.15,
              });
            }
            this.scene.spawnBurst(e.x, e.y, '#f97316', 9);
            e.aiTimer = 0.85 + Math.random() * 0.35;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.chargeActive = 0.34;
          }
        } else {
          e.vx = nx * 44;
          e.vy = ny * 44;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.38;
          }
        }
      } else if (e.kind === 'phase_stalker') {
        // Brand-new Floor III Phase-Stalker: stalks, telegraphs a magenta phase-blink near the player's flank, teleports & lunges with twin plasma blades!
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          e.vx = e.chargeDirX * 195;
          e.vy = e.chargeDirY * 195;
          if (Math.random() < dt * 28) {
            this.scene.particles.push({
              x: e.x,
              y: e.y,
              vx: -e.chargeDirX * 22,
              vy: -e.chargeDirY * 22,
              color: '#f43f5e',
              size: 2.0,
              life: 0.24,
              maxLife: 0.24,
            });
          }
          if (e.chargeActive <= 0) {
            e.aiTimer = 1.25 + Math.random() * 0.45;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.15;
          e.vy *= 0.15;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            // Execute phase-blink to telegraphed flank spot, then strike toward hero!
            this.scene.spawnBurst(e.x, e.y, '#e879f9', 10);
            const tx = Math.max(rb.l + 18, Math.min(rb.r - 18, e.bossTargetX ?? e.x));
            const ty = Math.max(rb.t + 18, Math.min(rb.b - 18, e.bossTargetY ?? e.y));
            if (!this.scene.collidesRoomObstacle(tx, ty, e.radius)) {
              e.x = tx;
              e.y = ty;
            }
            this.scene.spawnBurst(e.x, e.y, '#f43f5e', 12);
            const sdx = this.scene.playerX - e.x;
            const sdy = this.scene.playerY - e.y;
            const sd = Math.max(1, Math.hypot(sdx, sdy));
            e.chargeDirX = sdx / sd;
            e.chargeDirY = sdy / sd;
            e.aimAngle = Math.atan2(sdy, sdx);
            e.chargeActive = 0.24;
            // Also fire a crisp twin-blade energy wave on dash!
            this.scene.projectiles.push({
              x: e.x + e.chargeDirX * 10,
              y: e.y + e.chargeDirY * 10,
              vx: e.chargeDirX * 175,
              vy: e.chargeDirY * 175,
              fromPlayer: false,
              damage: 15,
              color: '#f43f5e',
              radius: 4.0,
              life: 0.65,
            });
          }
        } else {
          // Agile flanking stalk
          const ang = Math.atan2(dy, dx);
          e.aimAngle = ang;
          e.vx = nx * 48 - ny * 26 * e.moveDirX;
          e.vy = ny * 48 + nx * 26 * e.moveDirX;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            // Choose a telegraphed blink position ~58px beside/behind hero
            const flankAngle = ang + Math.PI + (Math.random() < 0.5 ? 0.9 : -0.9);
            e.bossTargetX = Math.max(
              rb.l + 22,
              Math.min(rb.r - 22, this.scene.playerX + Math.cos(flankAngle) * 58),
            );
            e.bossTargetY = Math.max(
              rb.t + 22,
              Math.min(rb.b - 22, this.scene.playerY + Math.sin(flankAngle) * 52),
            );
            e.telegraphTimer = 0.54;
            e.moveDirX = -e.moveDirX;
          }
        }
      } else if (e.kind === 'crystal_crawler') {
        // Sector 2 Floor I: Armored quartz arachnid — brisk crystalline scuttle + telegraphed violet shard dash!
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          e.vx = e.chargeDirX * 190;
          e.vy = e.chargeDirY * 190;
          if (Math.random() < dt * 20) {
            this.scene.particles.push({
              x: e.x,
              y: e.y + 3,
              vx: -e.chargeDirX * 20,
              vy: -e.chargeDirY * 20,
              color: '#c084fc',
              size: 1.8,
              life: 0.22,
              maxLife: 0.22,
            });
          }
          if (e.chargeActive <= 0) {
            e.aiTimer = 0.85 + Math.random() * 0.35;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.chargeActive = 0.3;
            this.scene.spawnBurst(e.x, e.y, '#c084fc', 8);
          }
        } else {
          const strafe = Math.sin(this.scene.time * 4 + e.id) * 0.45;
          e.vx = (nx - ny * strafe) * 56;
          e.vy = (ny + nx * strafe) * 56;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0 && dist < 135) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.aimAngle = Math.atan2(dy, dx);
            e.telegraphTimer = 0.38;
          }
        }
      } else if (e.kind === 'prism_drone') {
        // Sector 2 Floor I/II: Hovering prism octahedron — rotates and fires 4-way '+' / 'x' crystal cross pulses!
        e.phase += dt * 1.4;
        const desiredDist = 92;
        const radial = dist < desiredDist - 18 ? -46 : dist > desiredDist + 24 ? 46 : 0;
        const orbit = 38 * e.moveDirX;
        e.vx = nx * radial - ny * orbit;
        e.vy = ny * radial + nx * orbit;

        if (e.telegraphTimer > 0) {
          e.vx *= 0.25;
          e.vy *= 0.25;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const offset = e.subBurst % 2 === 0 ? 0 : Math.PI / 4;
            e.subBurst += 1;
            sound.playBlaster();
            this.scene.spawnBurst(e.x, e.y, '#38e8d4', 8);
            for (let k = 0; k < 4; k++) {
              const a = offset + k * (Math.PI / 2);
              this.scene.projectiles.push({
                x: e.x + Math.cos(a) * 9,
                y: e.y + Math.sin(a) * 9,
                vx: Math.cos(a) * 142,
                vy: Math.sin(a) * 142,
                fromPlayer: false,
                damage: 14,
                color: k % 2 === 0 ? '#38e8d4' : '#e879f9',
                radius: 3.6,
                life: 1.55,
              });
            }
            e.aiTimer = 1.45 + Math.random() * 0.4;
            if (Math.random() < 0.4) e.moveDirX = -e.moveDirX;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.46;
          }
        }
      } else if (e.kind === 'shard_sniper') {
        // Sector 2 Floor II/III: Long-range amethyst marksman — projects magenta laser sightline (0.65s) then fires blazing crystal lance!
        if (e.telegraphTimer > 0) {
          e.vx *= 0.1;
          e.vy *= 0.1;
          // Track player during first 60% of windup, then lock line so player can dodge!
          if (e.telegraphTimer > 0.26) {
            e.aimAngle = Math.atan2(dy, dx);
          }
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playRailBeam();
            const ax = Math.cos(e.aimAngle);
            const ay = Math.sin(e.aimAngle);
            this.scene.spawnBurst(e.x + ax * 10, e.y + ay * 10, '#f472b6', 10);
            this.scene.projectiles.push({
              x: e.x + ax * 11,
              y: e.y + ay * 11,
              vx: ax * 275,
              vy: ay * 275,
              fromPlayer: false,
              damage: 19,
              color: '#f472b6',
              radius: 4.2,
              life: 1.35,
            });
            e.aiTimer = 1.65 + Math.random() * 0.45;
            e.moveDirX = -e.moveDirX;
          }
        } else {
          const desiredDist = 132;
          const radial = dist < desiredDist - 22 ? -64 : dist > desiredDist + 24 ? 44 : 0;
          e.vx = nx * radial - ny * 34 * e.moveDirX;
          e.vy = ny * radial + nx * 34 * e.moveDirX;
          e.aimAngle = Math.atan2(dy, dx);
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.65;
          }
        }
      } else if (e.kind === 'void_crawler') {
        // Sector 2 Floor II/III Elite Variant: Neon void-crystal crawler — faster dash that leaves 4 glowing cyan-magenta crystal bursts!
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          e.vx = e.chargeDirX * 225;
          e.vy = e.chargeDirY * 225;
          if (Math.random() < dt * 28) {
            this.scene.particles.push({
              x: e.x,
              y: e.y + 2,
              vx: -e.chargeDirX * 26,
              vy: -e.chargeDirY * 26,
              color: Math.random() > 0.5 ? '#e879f9' : '#38e8d4',
              size: 2.0,
              life: 0.24,
              maxLife: 0.24,
            });
          }
          if (e.chargeActive <= 0) {
            this.scene.spawnBurst(e.x, e.y, '#e879f9', 10);
            for (let k = 0; k < 4; k++) {
              const a = Math.PI / 4 + k * (Math.PI / 2);
              this.scene.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * 118,
                vy: Math.sin(a) * 118,
                fromPlayer: false,
                damage: 14,
                color: k % 2 === 0 ? '#e879f9' : '#38e8d4',
                radius: 3.5,
                life: 0.85,
              });
            }
            e.aiTimer = 0.9 + Math.random() * 0.35;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.15;
          e.vy *= 0.15;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.chargeActive = 0.32;
            this.scene.spawnBurst(e.x, e.y, '#38e8d4', 10);
          }
        } else {
          e.vx = (nx - ny * 0.4 * e.moveDirX) * 68;
          e.vy = (ny + nx * 0.4 * e.moveDirX) * 68;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0 && dist < 155) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.aimAngle = Math.atan2(dy, dx);
            e.telegraphTimer = 0.36;
            e.moveDirX = -e.moveDirX;
          }
        }
      } else if (e.kind === 'resonance_warden') {
        // Sector 2 Floor III: Floating golden-amethyst monolith with rotating crystal shield arc & 6-way radial shock-pulse!
        e.aimAngle += dt * 1.75;
        e.vx = nx * 30 - ny * 18 * e.moveDirX;
        e.vy = ny * 30 + nx * 18 * e.moveDirX;
        if (e.telegraphTimer > 0) {
          e.vx *= 0.25;
          e.vy *= 0.25;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playBossSlam();
            this.scene.shockwaves.push({
              x: e.x,
              y: e.y,
              maxRadius: 68,
              color: '#c084fc',
              life: 0.32,
              maxLife: 0.32,
            });
            for (let k = 0; k < 6; k++) {
              const a = e.aimAngle + k * (Math.PI / 3);
              this.scene.projectiles.push({
                x: e.x + Math.cos(a) * 10,
                y: e.y + Math.sin(a) * 10,
                vx: Math.cos(a) * 134,
                vy: Math.sin(a) * 134,
                fromPlayer: false,
                damage: 16,
                color: k % 2 === 0 ? '#fde047' : '#c084fc',
                radius: 3.9,
                life: 1.45,
              });
            }
            e.aiTimer = 1.85 + Math.random() * 0.45;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.52;
            e.shieldDownTimer = Math.max(e.shieldDownTimer ?? 0, ENEMY_SHIELDS.resonance_warden.attackOpenSec);
          }
        }
      } else if (e.kind === 'slag_beetle' || e.kind === 'astral_scarab') {
        // Armored dash-crawler (S3 Slag Beetle / S4 Astral Scarab): rapid locked charge + 4-way spark burst!
        const isS4 = e.kind === 'astral_scarab';
        const colA = isS4 ? '#fde047' : '#f97316';
        const colB = isS4 ? '#38e8d4' : '#fde047';
        if (e.chargeActive > 0) {
          e.chargeActive -= dt;
          const spd = isS4 ? 245 : 220;
          e.vx = e.chargeDirX * spd;
          e.vy = e.chargeDirY * spd;
          if (Math.random() < dt * 26) {
            this.scene.particles.push({
              x: e.x,
              y: e.y + 2,
              vx: -e.chargeDirX * 24,
              vy: -e.chargeDirY * 24,
              color: Math.random() > 0.5 ? colA : colB,
              size: 2.0,
              life: 0.24,
              maxLife: 0.24,
            });
          }
          if (e.chargeActive <= 0) {
            this.scene.spawnBurst(e.x, e.y, colA, 10);
            for (let k = 0; k < 4; k++) {
              const a = (isS4 ? 0 : Math.PI / 4) + k * (Math.PI / 2);
              this.scene.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * (isS4 ? 138 : 122),
                vy: Math.sin(a) * (isS4 ? 138 : 122),
                fromPlayer: false,
                damage: isS4 ? 20 : 17,
                color: k % 2 === 0 ? colA : colB,
                radius: 3.6,
                life: 0.9,
              });
            }
            e.aiTimer = (isS4 ? 0.8 : 0.95) + Math.random() * 0.35;
          }
        } else if (e.telegraphTimer > 0) {
          e.vx *= 0.15;
          e.vy *= 0.15;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.chargeActive = 0.32;
            this.scene.spawnBurst(e.x, e.y, colB, 8);
          }
        } else {
          e.vx = (nx - ny * 0.35 * e.moveDirX) * (isS4 ? 76 : 66);
          e.vy = (ny + nx * 0.35 * e.moveDirX) * (isS4 ? 76 : 66);
          e.aiTimer -= dt;
          if (e.aiTimer <= 0 && dist < 165) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.aimAngle = Math.atan2(dy, dx);
            e.telegraphTimer = 0.34;
            e.moveDirX = -e.moveDirX;
          }
        }
      } else if (e.kind === 'solar_drone' || e.kind === 'chrono_eye') {
        // Orbiting S3 Solar Drone (3-shot solar fan) / S4 Chrono Eye (4-shot swirling astral burst)!
        const isS4 = e.kind === 'chrono_eye';
        const desiredDist = 112;
        const radial = dist < desiredDist - 18 ? -52 : dist > desiredDist + 18 ? 48 : 0;
        e.vx = nx * radial - ny * 46 * e.moveDirX;
        e.vy = ny * radial + nx * 46 * e.moveDirX;
        e.aimAngle = Math.atan2(dy, dx);
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playBlaster();
            const count = isS4 ? 4 : 3;
            for (let k = 0; k < count; k++) {
              const offset = (k - (count - 1) / 2) * (isS4 ? 0.24 : 0.28);
              const a = e.aimAngle + offset;
              this.scene.projectiles.push({
                x: e.x + Math.cos(a) * 9,
                y: e.y + Math.sin(a) * 9,
                vx: Math.cos(a) * (isS4 ? 175 : 158),
                vy: Math.sin(a) * (isS4 ? 175 : 158),
                fromPlayer: false,
                damage: isS4 ? 21 : 17,
                color: isS4 ? (k % 2 === 0 ? '#38e8d4' : '#fde047') : k % 2 === 0 ? '#f97316' : '#fde047',
                radius: 3.7,
                life: 1.5,
              });
            }
            e.aiTimer = (isS4 ? 1.3 : 1.45) + Math.random() * 0.4;
            if (Math.random() < 0.45) e.moveDirX = -e.moveDirX;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) e.telegraphTimer = 0.44;
        }
      } else if (e.kind === 'magma_mortar' || e.kind === 'star_lancer') {
        // S3 Magma Mortar (heavy 4-shell molten cross volley) / S4 Star Lancer (high-speed twin precision beam-lances)!
        const isS4 = e.kind === 'star_lancer';
        if (e.telegraphTimer > 0) {
          e.vx *= 0.1;
          e.vy *= 0.1;
          if (e.telegraphTimer > 0.24) e.aimAngle = Math.atan2(dy, dx);
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playRailBeam();
            if (isS4) {
              for (const off of [-0.07, 0.07]) {
                const a = e.aimAngle + off;
                this.scene.projectiles.push({
                  x: e.x + Math.cos(a) * 11,
                  y: e.y + Math.sin(a) * 11,
                  vx: Math.cos(a) * 295,
                  vy: Math.sin(a) * 295,
                  fromPlayer: false,
                  damage: 23,
                  color: '#fde047',
                  radius: 4.1,
                  life: 1.35,
                });
              }
            } else {
              this.scene.spawnBurst(e.x, e.y, '#f97316', 12);
              for (let k = 0; k < 4; k++) {
                const a = e.aimAngle + k * (Math.PI / 2);
                this.scene.projectiles.push({
                  x: e.x + Math.cos(a) * 9,
                  y: e.y + Math.sin(a) * 9,
                  vx: Math.cos(a) * 165,
                  vy: Math.sin(a) * 165,
                  fromPlayer: false,
                  damage: 20,
                  color: '#fb923c',
                  radius: 4.5,
                  life: 1.4,
                });
              }
            }
            e.aiTimer = (isS4 ? 1.5 : 1.65) + Math.random() * 0.4;
            e.moveDirX = -e.moveDirX;
          }
        } else {
          const desiredDist = isS4 ? 136 : 118;
          const radial = dist < desiredDist - 20 ? -56 : dist > desiredDist + 24 ? 42 : 0;
          e.vx = nx * radial - ny * 32 * e.moveDirX;
          e.vy = ny * radial + nx * 32 * e.moveDirX;
          e.aimAngle = Math.atan2(dy, dx);
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) e.telegraphTimer = 0.58;
        }
      } else if (e.kind === 'ember_stalker' || e.kind === 'void_wraith') {
        // Phasing assassin: blinks near player with burst & fires 5-way shadow/ember spread!
        const isS4 = e.kind === 'void_wraith';
        const col = isS4 ? '#38e8d4' : '#f97316';
        if (e.telegraphTimer > 0) {
          e.vx *= 0.15;
          e.vy *= 0.15;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const ang = Math.random() * Math.PI * 2;
            const bx = Math.max(rb.l + 22, Math.min(rb.r - 22, this.scene.playerX + Math.cos(ang) * 72));
            const by = Math.max(rb.t + 22, Math.min(rb.b - 22, this.scene.playerY + Math.sin(ang) * 62));
            if (!this.scene.collidesRoomObstacle(bx, by, 10) && !this.scene.collidesRoomChasm(bx, by, 8)) {
              this.scene.spawnBurst(e.x, e.y, col, 10);
              e.x = bx;
              e.y = by;
            }
            sound.playWarp();
            this.scene.spawnBurst(e.x, e.y, col, 12);
            const aim = Math.atan2(this.scene.playerY - e.y, this.scene.playerX - e.x);
            const shots = isS4 ? 5 : 3;
            for (let k = 0; k < shots; k++) {
              const a = aim + (k - (shots - 1) / 2) * 0.24;
              this.scene.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * (isS4 ? 172 : 162),
                vy: Math.sin(a) * (isS4 ? 172 : 162),
                fromPlayer: false,
                damage: isS4 ? 22 : 18,
                color: k % 2 === 0 ? col : '#fde047',
                radius: 3.6,
                life: 1.35,
              });
            }
            e.aiTimer = (isS4 ? 1.35 : 1.5) + Math.random() * 0.4;
          }
        } else {
          e.vx = (nx + ny * 0.45 * e.moveDirX) * 64;
          e.vy = (ny - nx * 0.45 * e.moveDirX) * 64;
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.42;
            e.moveDirX = -e.moveDirX;
          }
        }
      } else if (e.kind === 'forge_golem' || e.kind === 'monolith_guard') {
        // Heavy Floor III Elite Sentinel: rotating barrier + radial 8-way magma/starlight shockwave!
        const isS4 = e.kind === 'monolith_guard';
        const colA = isS4 ? '#fde047' : '#f97316';
        const colB = isS4 ? '#38e8d4' : '#ef4444';
        e.aimAngle += dt * 1.9;
        e.vx = nx * 34 - ny * 18 * e.moveDirX;
        e.vy = ny * 34 + nx * 18 * e.moveDirX;
        if (e.telegraphTimer > 0) {
          e.vx *= 0.2;
          e.vy *= 0.2;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            sound.playBossSlam();
            this.scene.shockwaves.push({
              x: e.x,
              y: e.y,
              maxRadius: 74,
              color: colA,
              life: 0.32,
              maxLife: 0.32,
            });
            for (let k = 0; k < 8; k++) {
              const a = e.aimAngle + k * (Math.PI / 4);
              this.scene.projectiles.push({
                x: e.x + Math.cos(a) * 10,
                y: e.y + Math.sin(a) * 10,
                vx: Math.cos(a) * (isS4 ? 155 : 142),
                vy: Math.sin(a) * (isS4 ? 155 : 142),
                fromPlayer: false,
                damage: isS4 ? 23 : 20,
                color: k % 2 === 0 ? colA : colB,
                radius: 4.0,
                life: 1.45,
              });
            }
            e.aiTimer = 1.7 + Math.random() * 0.4;
          }
        } else {
          e.aiTimer -= dt;
          if (e.aiTimer <= 0) e.telegraphTimer = 0.5;
        }
      } else if (BOSS_DEFS[e.kind]) {
        // M10-C: eigenständige Boss-Zugfolgen (Krall, Schlacken-Koloss, Gießerei-Meisterin, Vulkan-Titan, Chrono-Wächter, Monolith-Koloss, Sternen-Archon)
        runBoss(e, { scene: this.scene, dx, dy, nx, ny, dist, dt, p2: false }, BOSS_DEFS[e.kind]!);
      } else if (e.kind === 'boss_quartz_golem') {
        this.updateQuartzGolemAI(e, dt, dx, dy, nx, ny);
      } else if (e.kind === 'boss_prism_weaver') {
        this.updatePrismWeaverAI(e, dt, dx, dy, nx, ny);
      } else if (e.kind === 'boss_prisma_archon' || e.kind === 'boss_omega_archon') {
        this.updatePrismaArchonAI(e, dt, dx, dy);
      } else if (e.kind === 'boss') {
        this.updateBossAI(e, dt, dx, dy, nx, ny);
      } else if (e.kind === 'boss_leviathan') {
        this.updateLeviathanAI(e, dt);
      }

      const prevX = e.x;
      const prevY = e.y;
      const airborne = e.kind === 'boss' && (e.bossHeight ?? 0) > 22;
      const hovers =
        e.kind === 'drone' ||
        e.kind === 'drone_arc' ||
        e.kind === 'shield_drone' ||
        e.kind === 'prism_drone' ||
        e.kind === 'resonance_warden' ||
        e.kind === 'solar_drone' ||
        e.kind === 'chrono_eye' ||
        e.kind === 'void_wraith' ||
        e.kind === 'monolith_guard' ||
        e.kind === 'boss_prism_weaver' ||
        e.kind === 'boss_prisma_archon' ||
        e.kind === 'boss_forge_warden' ||
        e.kind === 'boss_vulkan_titan' ||
        e.kind === 'boss_chrono_sentinel' ||
        e.kind === 'boss_star_archon' ||
        e.kind === 'boss_omega_archon' ||
        airborne;

      if (e.kind !== 'boss_leviathan') {
        const ex = Math.max(rb.l + e.radius, Math.min(rb.r - e.radius, e.x + e.vx * dt));
        if (
          (!this.scene.collidesRoomObstacle(ex, e.y, e.radius * 0.85) &&
            !this.scene.collidesRoomChasm(ex, e.y, e.radius * 0.7)) ||
          hovers
        ) {
          e.x = ex;
        } else if (e.kind === 'turret' || e.kind === 'spore_spitter') {
          e.moveDirX = -e.moveDirX;
        }
        const ey = Math.max(rb.t + e.radius, Math.min(rb.b - e.radius, e.y + e.vy * dt));
        if (
          (!this.scene.collidesRoomObstacle(e.x, ey, e.radius * 0.85) &&
            !this.scene.collidesRoomChasm(e.x, ey, e.radius * 0.7)) ||
          hovers
        ) {
          e.y = ey;
        } else if (e.kind === 'turret' || e.kind === 'spore_spitter') {
          e.moveDirY = -e.moveDirY;
        }
      }

      // Boss wall slam bounce during Rocket/Hydraulic Charge!
      if ((e.kind === 'boss' || e.kind === 'boss_breacher') && e.bossState === 'charge_dash') {
        const hitWall =
          (Math.abs(e.vx) > 20 && Math.abs(e.x - prevX) < 0.25) ||
          (Math.abs(e.vy) > 20 && Math.abs(e.y - prevY) < 0.25);
        if (hitWall) {
          sound.playBossSlam();
          this.scene.triggerShake(0.28, 4.5);
          this.scene.spawnBurst(e.x, e.y, '#fbbf24', 18);
          this.scene.shockwaves.push({
            x: e.x,
            y: e.y,
            maxRadius: 42,
            color: '#fb923c',
            life: 0.26,
            maxLife: 0.26,
          });
          e.vx = -e.chargeDirX * 55;
          e.vy = -e.chargeDirY * 55;
          e.bossState = 'stunned';
          e.bossStateTimer = 0.6;
          e.bossStateMax = 0.6;
          e.bossStatusText = 'ÜBERHITZT';
        }
      }

      if (!airborne) {
        const pDist = Math.hypot(this.scene.playerX - e.x, this.scene.playerY - e.y);
        if (pDist < e.radius + 7) {
          const pushX = (this.scene.playerX - e.x) / Math.max(1, pDist);
          const pushY = (this.scene.playerY - e.y) / Math.max(1, pDist);
          this.scene.damagePlayer(this.scene.isBossKind(e.kind) ? 20 : 12, pushX, pushY, e);
        }
        // Leviathan gauntlet contact damage during slams!
        if (e.kind === 'boss_leviathan' && e.levArms) {
          for (const arm of e.levArms) {
            if (arm.state === 'slamming') {
              const aDist = Math.hypot(this.scene.playerX - arm.x, this.scene.playerY - arm.y);
              if (aDist < 19) {
                this.scene.damagePlayer(
                  20,
                  (this.scene.playerX - arm.x) / Math.max(1, aDist),
                  (this.scene.playerY - arm.y) / Math.max(1, aDist),
                  e,
                );
              }
            }
          }
        }
      }
    }
  }

  public updateHazardsAndDebris(dt: number): void {
    // 1. Floor II/III Steam / Plasma Floor Vents (4.0s cycle: safe 0..2.2, warn 2.2..3.0, active 3.0..4.0)
    for (const h of this.scene.currentRoom.hazards) {
      const cycle = (this.scene.time + h.phase) % 4.0;
      if (cycle >= 3.0) {
        if (Math.random() < dt * 16) {
          this.scene.particles.push({
            x: h.x + (Math.random() - 0.5) * h.r,
            y: h.y + (Math.random() - 0.5) * h.r * 0.7,
            vx: (Math.random() - 0.5) * 18,
            vy: -34 - Math.random() * 24,
            color: Math.random() > 0.45 ? '#38e8d4' : '#fb923c',
            size: 2,
            life: 0.25,
            maxLife: 0.25,
          });
        }
        if (this.scene.dashTimer <= 0 && this.scene.lanceChargeTimer <= 0) {
          const dist = Math.hypot(this.scene.playerX - h.x, this.scene.playerY - h.y);
          if (dist < h.r + 4) {
            this.scene.damagePlayer(
              14,
              (this.scene.playerX - h.x) / Math.max(1, dist),
              (this.scene.playerY - h.y) / Math.max(1, dist),
            );
          }
        }
      }
    }

    // 2. Leviathan Falling Reactor Debris Rings!
    for (let i = this.scene.debrisDrops.length - 1; i >= 0; i--) {
      const d = this.scene.debrisDrops[i];
      d.timer -= dt;
      if (d.timer <= 0) {
        sound.playBossSlam();
        this.scene.triggerShake(0.16, 2.8);
        this.scene.decals.push({
          x: d.x,
          y: d.y + 2,
          r: d.r * 0.7,
          color: 'rgba(15, 23, 42, 0.55)',
          life: 4.5,
          maxLife: 4.5,
        });
        this.scene.shockwaves.push({
          x: d.x,
          y: d.y,
          maxRadius: d.r + 12,
          color: '#fb923c',
          life: 0.26,
          maxLife: 0.26,
        });
        this.scene.spawnBurst(d.x, d.y, '#fbbf24', 14);
        const pd = Math.hypot(this.scene.playerX - d.x, this.scene.playerY - d.y);
        if (pd <= d.r + 4) {
          this.scene.damagePlayer(
            18,
            (this.scene.playerX - d.x) / Math.max(1, pd),
            (this.scene.playerY - d.y) / Math.max(1, pd),
          );
        }
        this.scene.debrisDrops.splice(i, 1);
      }
    }
  }

  // ==================== SECTOR 2 FLOOR I BOSS: QUARZ-KOLOSS MK-I ====================
  /** Bodenläufer mit Wegfindung (M10-C B1): melee-artige Gegner, keine Schützen/Türme/Bosse/Schweber. */
  private static readonly STEER_KINDS = new Set<Enemy['kind']>([
    'slime',
    'slime_magma',
    'crystal_crawler',
    'void_crawler',
    'slag_beetle',
    'astral_scarab',
    'forge_golem',
    'ember_stalker',
    'phase_stalker',
    'star_lancer',
  ]);

  private hasLineOfWalk(e: Enemy, tx: number, ty: number): boolean {
    const d = Math.hypot(tx - e.x, ty - e.y);
    const steps = Math.max(1, Math.ceil(d / 6));
    for (let i = 1; i <= steps; i++) {
      const px = e.x + ((tx - e.x) * i) / steps;
      const py = e.y + ((ty - e.y) * i) / steps;
      if (
        this.scene.collidesRoomObstacle(px, py, e.radius * 0.85) ||
        this.scene.collidesRoomChasm(px, py, e.radius * 0.7)
      ) {
        return false;
      }
    }
    return true;
  }

  private steer(e: Enemy, nx: number, ny: number, dist: number, dt: number): { x: number; y: number } {
    if (!DungeonEnemyAi.STEER_KINDS.has(e.kind) || !this.scene.nav) return { x: nx, y: ny };

    // Anti-Hänger: kaum Bewegung trotz Wunsch → kurz seitlich ausweichen
    if (e.sidestepTimer && e.sidestepTimer > 0) {
      e.sidestepTimer = Math.max(0, e.sidestepTimer - dt);
      const dir = e.sidestepDir ?? 1;
      return { x: -ny * dir * 0.9 + nx * 0.3, y: nx * dir * 0.9 + ny * 0.3 };
    }
    e.stuckTimer = (e.stuckTimer ?? 0) + dt;
    if (e.stuckRefX === undefined || e.stuckRefY === undefined) {
      e.stuckRefX = e.x;
      e.stuckRefY = e.y;
    }
    if (e.stuckTimer >= 0.6) {
      const moved = Math.hypot(e.x - e.stuckRefX, e.y - e.stuckRefY);
      if (moved < 2 && dist > e.radius + 14) {
        const left = !this.scene.collidesRoomObstacle(e.x + ny * 10, e.y - nx * 10, e.radius * 0.85);
        e.sidestepDir = left ? -1 : 1;
        e.sidestepTimer = 0.4;
      }
      e.stuckTimer = 0;
      e.stuckRefX = e.x;
      e.stuckRefY = e.y;
    }

    if (dist < 12 || this.hasLineOfWalk(e, this.scene.playerX, this.scene.playerY)) return { x: nx, y: ny };
    const flow = this.scene.nav.flowDir(e.x, e.y);
    return flow ?? { x: nx, y: ny };
  }

  private updateQuartzGolemAI(e: Enemy, dt: number, dx: number, dy: number, nx: number, ny: number): void {
    const enraged = e.hp <= e.maxHp * 0.5;
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      sound.playBossRoar();
      this.scene.triggerShake(0.35, 4.2);
      this.scene.shockwaves.push({ x: e.x, y: e.y, maxRadius: 82, color: '#c084fc', life: 0.36, maxLife: 0.36 });
      this.scene.spawnBurst(e.x, e.y, '#e879f9', 22);
      this.scene.callbacks.onToast('⚠ Quarz-Koloss MK-I geht in Kristall-Resonanz!', 'warn');
      this.scene.splitBoss(e); // M11: Koloss spaltet sich — Hälfte A Beben (Nahkampf), Hälfte B Salve (Fernkampf)
    }

    const state: BossState = e.bossState ?? 's2_idle';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;
    e.aimAngle = Math.atan2(dy, dx);

    if (state === 's2_idle') {
      const spd = enraged ? 54 : 40;
      e.vx = nx * spd;
      e.vy = ny * spd;
      if (e.bossStateTimer <= 0) {
        e.phase = (e.phase + 1) % 3;
        if (e.splitRole === undefined ? e.phase === 0 || e.phase === 2 : e.splitRole === 0) {
          e.bossState = 's2_slam_windup';
          e.bossStateTimer = enraged ? 0.48 : 0.62;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'KRISTALL-BEBEN';
        } else {
          e.bossState = 's2_prism_grid';
          e.bossStateTimer = enraged ? 0.52 : 0.68;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'QUARZ-SALVE';
        }
      }
    } else if (state === 's2_slam_windup') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBossSlam();
        this.scene.triggerShake(0.3, 4.6);
        const radius = enraged ? 92 : 76;
        this.scene.shockwaves.push({ x: e.x, y: e.y, maxRadius: radius, color: '#c084fc', life: 0.38, maxLife: 0.38 });
        this.scene.spawnBurst(e.x, e.y, '#fde047', 18);
        const count = enraged ? 10 : 8;
        for (let k = 0; k < count; k++) {
          const a = e.aimAngle + (k / count) * Math.PI * 2;
          this.scene.projectiles.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * (enraged ? 156 : 134),
            vy: Math.sin(a) * (enraged ? 156 : 134),
            fromPlayer: false,
            damage: 17,
            color: k % 2 === 0 ? '#c084fc' : '#fde047',
            radius: 4.0,
            life: 1.55,
          });
        }
        if (Math.hypot(dx, dy) < radius * 0.72) {
          this.scene.damagePlayer(18, nx, ny);
        }
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.78 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'RESONANZ II' : 'QUARZ-KERN AKTIV';
      }
    } else if (state === 's2_prism_grid') {
      e.vx *= 0.25;
      e.vy *= 0.25;
      if (e.bossStateTimer <= 0) {
        sound.playBlaster();
        const fan = enraged ? 5 : 3;
        const spread = 0.22;
        for (let k = -Math.floor(fan / 2); k <= Math.floor(fan / 2); k++) {
          const a = e.aimAngle + k * spread;
          this.scene.projectiles.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 185,
            vy: Math.sin(a) * 185,
            fromPlayer: false,
            damage: 16,
            color: '#38e8d4',
            radius: 4.2,
            life: 1.45,
          });
        }
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.72 : 0.96;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'RESONANZ II' : 'QUARZ-KERN AKTIV';
      }
    }
  }

  // ==================== SECTOR 2 FLOOR II BOSS: PRISMA-WEBERIN ====================
  private updatePrismWeaverAI(e: Enemy, dt: number, dx: number, dy: number, nx: number, ny: number): void {
    const rb = this.scene.bounds; // M12: Raumgrenzen (Standard = ROOM_LEFT…)
    const enraged = e.hp <= e.maxHp * 0.5;
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      sound.playBossRoar();
      this.scene.triggerShake(0.35, 4.5);
      this.scene.shockwaves.push({ x: e.x, y: e.y, maxRadius: 88, color: '#e879f9', life: 0.38, maxLife: 0.38 });
      this.scene.spawnBurst(e.x, e.y, '#38e8d4', 24);
      this.scene.callbacks.onToast('⚠ Prisma-Weberin entfesselt das Hyper-Prisma-Netz!', 'warn');
    }

    const state: BossState = e.bossState ?? 's2_idle';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;
    e.bossOrbitAngle = (e.bossOrbitAngle ?? 0) + dt * (enraged ? 2.6 : 1.8);
    e.aimAngle = Math.atan2(dy, dx);

    if (state === 's2_idle') {
      e.vx = -ny * (enraged ? 58 : 42) * e.moveDirX + nx * 16;
      e.vy = nx * (enraged ? 58 : 42) * e.moveDirX + ny * 16;
      if (e.bossStateTimer <= 0) {
        e.phase = (e.phase + 1) % 2;
        if (e.phase === 0) {
          // Pick one of 4 arena corners for telegraphed blink!
          const corners = [
            { x: rb.l + 54, y: rb.t + 42 },
            { x: rb.r - 54, y: rb.t + 42 },
            { x: rb.l + 54, y: rb.b - 42 },
            { x: rb.r - 54, y: rb.b - 42 },
          ];
          const c = corners[Math.floor(Math.random() * corners.length)];
          e.bossTargetX = c.x;
          e.bossTargetY = c.y;
          e.bossState = 's2_blink_windup';
          e.bossStateTimer = enraged ? 0.45 : 0.6;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'PHASEN-SPRUNG';
        } else {
          e.bossState = 's2_prism_grid';
          e.bossStateTimer = enraged ? 0.55 : 0.72;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'LASER-GITTER';
        }
      }
    } else if (state === 's2_blink_windup') {
      e.vx *= 0.15;
      e.vy *= 0.15;
      if (e.bossStateTimer <= 0) {
        this.scene.spawnBurst(e.x, e.y, '#e879f9', 14);
        e.x = e.bossTargetX ?? rb.cx;
        e.y = e.bossTargetY ?? rb.cy;
        this.scene.spawnBurst(e.x, e.y, '#38e8d4', 18);
        sound.playBossLaser();
        // Fire aimed triple crystal orb volley right on arrival!
        const aim = Math.atan2(this.scene.playerY - e.y, this.scene.playerX - e.x);
        for (let k = -1; k <= 1; k++) {
          const a = aim + k * 0.24;
          this.scene.projectiles.push({
            x: e.x + Math.cos(a) * 12,
            y: e.y + Math.sin(a) * 12,
            vx: Math.cos(a) * (enraged ? 198 : 168),
            vy: Math.sin(a) * (enraged ? 198 : 168),
            fromPlayer: false,
            damage: 17,
            color: k === 0 ? '#f472b6' : '#38e8d4',
            radius: 4.1,
            life: 1.5,
          });
        }
        e.moveDirX = -e.moveDirX;
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.7 : 0.95;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'HYPER-NETZ' : 'PRISMA-NETZ AKTIV';
      }
    } else if (state === 's2_prism_grid') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBlaster();
        const count = enraged ? 12 : 8;
        const base = e.bossOrbitAngle ?? 0;
        for (let k = 0; k < count; k++) {
          const a = base + (k / count) * Math.PI * 2;
          this.scene.projectiles.push({
            x: e.x + Math.cos(a) * 12,
            y: e.y + Math.sin(a) * 12,
            vx: Math.cos(a) * (enraged ? 155 : 132),
            vy: Math.sin(a) * (enraged ? 155 : 132),
            fromPlayer: false,
            damage: 16,
            color: k % 2 === 0 ? '#e879f9' : '#38e8d4',
            radius: 3.8,
            life: 1.65,
          });
        }
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.68 : 0.92;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'HYPER-NETZ' : 'PRISMA-NETZ AKTIV';
      }
    }
  }

  // ==================== SECTOR 2 ENDBOSS: ★ PRISMA-ARCHON ====================
  private updatePrismaArchonAI(e: Enemy, dt: number, dx: number, dy: number): void {
    const rb = this.scene.bounds; // M12: Raumgrenzen (Standard = ROOM_LEFT…)
    const enraged = e.hp <= e.maxHp * 0.5;
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      sound.playBossRoar();
      this.scene.triggerShake(0.55, 6.0);
      this.scene.shockwaves.push({ x: e.x, y: e.y, maxRadius: 130, color: '#e879f9', life: 0.48, maxLife: 0.48 });
      this.scene.spawnBurst(e.x, e.y, '#fde047', 32);
      this.scene.callbacks.onToast('🚨 PRISMA-ARCHON PHASE II — ZERSPLITTERTER NOVA-STURM!', 'warn');
      if (e.summonThreshold > 0) {
        e.summonThreshold = 0;
        this.scene.spawnEnemy('prism_drone', rb.cx - 88, rb.t + 54);
        this.scene.spawnEnemy('prism_drone', rb.cx + 88, rb.t + 54);
      }
    }

    const state: BossState = e.bossState ?? 's2_idle';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;
    e.bossOrbitAngle = (e.bossOrbitAngle ?? 0) + dt * (enraged ? 2.4 : 1.5);
    e.aimAngle = Math.atan2(dy, dx);

    if (state === 's2_idle') {
      // Majestic floating figure-eight glide across upper-mid arena
      const tx = rb.cx + Math.sin(this.scene.time * 0.9) * 84;
      const ty = rb.t + 56 + Math.sin(this.scene.time * 1.8) * 18;
      e.vx = (tx - e.x) * 2.2;
      e.vy = (ty - e.y) * 2.2;

      if (e.bossStateTimer <= 0) {
        e.phase = (e.phase + 1) % 3;
        if (e.phase === 0) {
          e.bossState = 's2_beam_windup';
          e.bossStateTimer = enraged ? 0.62 : 0.78;
          e.bossStateMax = e.bossStateTimer;
          e.bossLaserAngle = Math.atan2(dy, dx);
          e.bossLaserDir = Math.random() < 0.5 ? 1 : -1;
          e.bossLaserTick = 0;
          e.bossStatusText = 'ZWILLINGS-PRISMASTRAHL';
        } else if (e.phase === 1) {
          e.bossState = 's2_prism_grid';
          e.bossStateTimer = enraged ? 0.55 : 0.72;
          e.bossStateMax = e.bossStateTimer;
          e.bossStatusText = 'KRISTALL-LANZEN';
        } else {
          e.bossState = 's2_nova_storm';
          e.bossStateTimer = enraged ? 2.1 : 1.45;
          e.bossStateMax = e.bossStateTimer;
          e.burstDelay = 0.12;
          e.bossStatusText = enraged ? 'NOVA-STURM II' : 'PRISMA-NOVA';
        }
      }
    } else if (state === 's2_beam_windup') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBossLaser();
        this.scene.triggerShake(0.25, 3.8);
        e.bossState = 's2_twin_sweep';
        e.bossStateTimer = enraged ? 1.55 : 1.3;
        e.bossStateMax = e.bossStateTimer;
      }
    } else if (state === 's2_twin_sweep') {
      e.vx *= 0.15;
      e.vy *= 0.15;
      const prog = 1 - Math.max(0, (e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 1));
      const base = e.bossLaserAngle ?? Math.PI / 2;
      const spread = 0.85 - prog * 0.72; // twin beams sweep inward like converging wings!
      e.bossLaserTick = (e.bossLaserTick ?? 0) - dt;
      if (e.bossLaserTick <= 0) {
        e.bossLaserTick = 0.11;
        const angles = [base - spread, base + spread];
        for (const a of angles) {
          const ex = e.x + Math.cos(a) * 260;
          const ey = e.y + Math.sin(a) * 260;
          if (this.scene.pointToSegmentDist(this.scene.playerX, this.scene.playerY, e.x, e.y, ex, ey) < 11) {
            this.scene.damagePlayer(18, Math.cos(a), Math.sin(a));
          }
        }
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.72 : 0.95;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'PHASE II · ARCHON' : 'PRISMA-ARCHON AKTIV';
      }
    } else if (state === 's2_prism_grid') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        sound.playBlaster();
        const count = enraged ? 12 : 8;
        const aim = Math.atan2(dy, dx);
        for (let k = 0; k < count; k++) {
          const a = aim + (k / count) * Math.PI * 2;
          this.scene.projectiles.push({
            x: e.x + Math.cos(a) * 16,
            y: e.y + Math.sin(a) * 16,
            vx: Math.cos(a) * (enraged ? 172 : 148),
            vy: Math.sin(a) * (enraged ? 172 : 148),
            fromPlayer: false,
            damage: 18,
            color: k % 3 === 0 ? '#fde047' : k % 2 === 0 ? '#e879f9' : '#38e8d4',
            radius: 4.2,
            life: 1.75,
          });
        }
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.65 : 0.88;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'PHASE II · ARCHON' : 'PRISMA-ARCHON AKTIV';
      }
    } else if (state === 's2_nova_storm') {
      const tx = rb.cx;
      const ty = rb.cy - 22;
      e.vx = (tx - e.x) * 2.5;
      e.vy = (ty - e.y) * 2.5;
      e.burstDelay -= dt;
      if (e.burstDelay <= 0) {
        e.burstDelay = enraged ? 0.16 : 0.22;
        const arms = enraged ? 4 : 3;
        const base = (e.bossOrbitAngle ?? 0) * 1.4;
        for (let k = 0; k < arms; k++) {
          const a = base + (k / arms) * Math.PI * 2;
          this.scene.projectiles.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 145,
            vy: Math.sin(a) * 145,
            fromPlayer: false,
            damage: 16,
            color: k % 2 === 0 ? '#f472b6' : '#fde047',
            radius: 3.9,
            life: 1.7,
          });
        }
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 's2_idle';
        e.bossStateTimer = enraged ? 0.78 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'PHASE II · ARCHON' : 'PRISMA-ARCHON AKTIV';
      }
    }
  }

  // ==================== FLOOR III GIGANTIC BOSS: A.E.G.I.S. LEVIATHAN ====================
  private updateLeviathanAI(e: Enemy, dt: number): void {
    const rb = this.scene.bounds; // M12: Raumgrenzen (Standard = ROOM_LEFT…)
    const arms = e.levArms;
    if (!arms) return;
    const enraged = e.hp <= e.maxHp * 0.5;

    // Dramatic Phase-2 Omega Overload at 50% HP!
    if (enraged && !e.bossPhase2) {
      e.bossPhase2 = true;
      e.bossState = 'phase2_roar';
      e.bossStateTimer = 1.25;
      e.bossStateMax = 1.25;
      e.bossStatusText = 'OMEGA-ÜBERLASTUNG!';
      for (const arm of arms) {
        arm.state = 'returning';
      }
      sound.playBossRoar();
      this.scene.triggerShake(0.55, 6.2);
      this.scene.shockwaves.push({ x: e.x, y: e.y + 8, maxRadius: 140, color: '#fb7185', life: 0.5, maxLife: 0.5 });
      this.scene.spawnBurst(e.x, e.y + 8, '#fb7185', 34);
      this.scene.callbacks.onToast('🚨 PHASE II: A.E.G.I.S. LEVIATHAN zündet OMEGA-ÜBERLASTUNG!', 'warn');
      return;
    }

    // Update each giant articulated gauntlet smoothly
    for (const arm of arms) {
      if (arm.state === 'idle' || arm.state === 'returning') {
        const hoverY = arm.homeY + Math.sin(this.scene.time * 3.0 + arm.side) * 4;
        arm.x += (arm.homeX - arm.x) * Math.min(1, dt * 6);
        arm.y += (hoverY - arm.y) * Math.min(1, dt * 6);
        if (arm.state === 'returning' && Math.hypot(arm.x - arm.homeX, arm.y - hoverY) < 4) {
          arm.state = 'idle';
        }
      } else if (arm.state === 'tracking') {
        arm.timer -= dt;
        // Track player smoothly during first 65% of lock-on
        if (arm.timer > 0.24) {
          arm.targetX += (this.scene.playerX - arm.targetX) * Math.min(1, dt * 7);
          arm.targetY +=
            (Math.max(rb.t + 62, Math.min(rb.b - 18, this.scene.playerY)) - arm.targetY) *
            Math.min(1, dt * 7);
        }
        arm.x += (arm.targetX - arm.x) * Math.min(1, dt * 5);
        arm.y += (arm.targetY - 38 - arm.y) * Math.min(1, dt * 5);
        if (arm.timer <= 0) {
          arm.state = 'slamming';
          arm.timer = 0.16;
        }
      } else if (arm.state === 'slamming') {
        arm.timer -= dt;
        arm.x += (arm.targetX - arm.x) * Math.min(1, dt * 22);
        arm.y += (arm.targetY - arm.y) * Math.min(1, dt * 24);
        if (arm.timer <= 0) {
          arm.x = arm.targetX;
          arm.y = arm.targetY;
          arm.state = 'grounded';
          arm.timer = enraged ? 0.95 : 1.2;
          sound.playBossSlam();
          this.scene.triggerShake(0.32, 5.2);
          this.scene.decals.push({
            x: arm.x,
            y: arm.y + 6,
            r: 22,
            color: 'rgba(15, 23, 42, 0.58)',
            life: 6.0,
            maxLife: 6.0,
          });
          this.scene.shockwaves.push({
            x: arm.x,
            y: arm.y + 2,
            maxRadius: 58,
            color: enraged ? '#fb7185' : '#fb923c',
            life: 0.32,
            maxLife: 0.32,
          });
          this.scene.spawnBurst(arm.x, arm.y + 4, '#fbbf24', 22);
          const bolts = enraged ? 8 : 6;
          for (let k = 0; k < bolts; k++) {
            this.fireEnemyBolt(arm.x, arm.y, (k / bolts) * Math.PI * 2, enraged ? 130 : 108, 14, '#fb923c');
          }
          const pd = Math.hypot(this.scene.playerX - arm.x, this.scene.playerY - arm.y);
          if (pd <= 34) {
            this.scene.damagePlayer(
              22,
              (this.scene.playerX - arm.x) / Math.max(1, pd),
              (this.scene.playerY - arm.y) / Math.max(1, pd),
              e,
            );
          }
        }
      } else if (arm.state === 'grounded') {
        // Vulnerable on floor so player can slash/spear the giant gauntlet!
        arm.timer -= dt;
        if (arm.timer <= 0) {
          arm.state = 'returning';
        }
      } else if (arm.state === 'beam') {
        const bx = arm.side < 0 ? rb.cx - 96 : rb.cx + 96;
        const by = rb.t + 52;
        arm.x += (bx - arm.x) * Math.min(1, dt * 8);
        arm.y += (by - arm.y) * Math.min(1, dt * 8);
      }
    }

    const state: BossState = e.bossState ?? 'lev_idle';
    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;

    if (state === 'phase2_roar') {
      if (e.bossStateTimer <= 0) {
        e.bossState = 'lev_idle';
        e.bossStateTimer = 0.55;
        e.bossStateMax = 0.55;
        e.bossStatusText = 'OMEGA-ÜBERLASTUNG';
      }
      return;
    }

    if (state === 'lev_arm_track') {
      if (e.bossStateTimer <= 0) {
        e.bossState = 'lev_idle';
        e.bossStateTimer = enraged ? 0.55 : 0.8;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OMEGA-KERN' : 'AKTIV';
      }
      return;
    }

    if (state === 'lev_twin_windup') {
      for (const arm of arms) {
        arm.state = 'beam';
        arm.beamAngle = arm.side < 0 ? 0.65 : Math.PI - 0.65;
      }
      if (e.bossStateTimer <= 0) {
        sound.playBossLaser();
        this.scene.triggerShake(0.28, 3.4);
        e.bossState = 'lev_twin_beam';
        e.bossStateTimer = enraged ? 1.45 : 1.3;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'ZWILLINGS-STRAHL!';
      }
      return;
    }

    if (state === 'lev_twin_beam') {
      const rate = enraged ? 0.98 : 0.78;
      for (const arm of arms) {
        // Left sweeps clockwise toward center, Right sweeps counter-clockwise toward center
        arm.beamAngle += (arm.side < 0 ? 1 : -1) * rate * dt;
        const cosA = Math.cos(arm.beamAngle);
        const sinA = Math.sin(arm.beamAngle);
        const ex = arm.x + cosA * 260;
        const ey = arm.y + sinA * 260;
        if (this.scene.pointToSegmentDist(this.scene.playerX, this.scene.playerY, arm.x, arm.y, ex, ey) <= 10) {
          this.scene.damagePlayer(18, -sinA * arm.side, cosA * arm.side, e);
        }
      }
      if (e.bossStateTimer <= 0) {
        for (const arm of arms) arm.state = 'returning';
        e.bossState = 'lev_idle';
        e.bossStateTimer = enraged ? 0.65 : 0.9;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OMEGA-KERN' : 'AKTIV';
      }
      return;
    }

    if (state === 'lev_debris') {
      e.burstDelay -= dt;
      if (e.subBurst > 0 && e.burstDelay <= 0) {
        e.subBurst -= 1;
        e.burstDelay = enraged ? 0.2 : 0.26;
        // Aim first drop near player, rest scattered across arena!
        const tx =
          e.subBurst % 3 === 0
            ? Math.max(rb.l + 28, Math.min(rb.r - 28, this.scene.playerX + (Math.random() - 0.5) * 34))
            : rb.l + 32 + Math.random() * (rb.r - rb.l - 64);
        const ty =
          e.subBurst % 3 === 0
            ? Math.max(rb.t + 68, Math.min(rb.b - 22, this.scene.playerY + (Math.random() - 0.5) * 28))
            : rb.t + 72 + Math.random() * (rb.b - rb.t - 94);
        this.scene.debrisDrops.push({ x: tx, y: ty, r: 22, timer: 0.95, maxTimer: 0.95 });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'lev_idle';
        e.bossStateTimer = enraged ? 0.6 : 0.85;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OMEGA-KERN' : 'AKTIV';
      }
      return;
    }

    if (state === 'lev_omega_spiral') {
      e.burstDelay -= dt;
      if (e.subBurst > 0 && e.burstDelay <= 0) {
        e.subBurst -= 1;
        e.burstDelay = enraged ? 0.16 : 0.22;
        const base = (e.subBurst * 0.34) + 0.35;
        const count = enraged ? 7 : 5;
        for (let k = 0; k < count; k++) {
          const a = 0.22 + (k / (count - 1)) * (Math.PI - 0.44) + Math.sin(base) * 0.14;
          this.fireEnemyBolt(e.x, e.y + 12, a, enraged ? 142 : 118, 14, enraged ? '#fb7185' : '#38e8d4');
        }
        sound.playBlaster();
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'lev_idle';
        e.bossStateTimer = enraged ? 0.65 : 0.9;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'OMEGA-KERN' : 'AKTIV';
      }
      return;
    }

    // lev_idle: pick next grand titan pattern!
    if (e.bossStateTimer <= 0) {
      const atk = e.phase % 4;
      e.phase += 1;
      if (atk === 0 || atk === 2) {
        // Giant Gauntlet Slam (alternating Left / Right!)
        const sideIdx: 0 | 1 = (e.levActiveSide ?? 0) === 0 ? 1 : 0;
        e.levActiveSide = sideIdx;
        const arm = arms[sideIdx];
        arm.state = 'tracking';
        arm.timer = enraged ? 0.68 : 0.82;
        arm.targetX = Math.max(rb.l + 34, Math.min(rb.r - 34, this.scene.playerX));
        arm.targetY = Math.max(rb.t + 68, Math.min(rb.b - 22, this.scene.playerY));
        e.bossState = 'lev_arm_track';
        e.bossStateTimer = enraged ? 1.85 : 2.25;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'TITANEN-FAUSTSCHLAG!';
      } else if (atk === 1) {
        // Twin Sweeping Plasma Beams!
        e.bossState = 'lev_twin_windup';
        e.bossStateTimer = enraged ? 0.65 : 0.8;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'ZWILLINGS-STRAHL LÄDT...';
      } else if (enraged && e.phase % 8 === 4) {
        // Phase-2 Omega Spiral Plasma Wave!
        e.bossState = 'lev_omega_spiral';
        e.subBurst = 6;
        e.burstDelay = 0.15;
        e.bossStateTimer = 1.5;
        e.bossStateMax = 1.5;
        e.bossStatusText = 'OMEGA-SPIRALE!';
      } else {
        // Falling Reactor Debris Rain!
        e.bossState = 'lev_debris';
        e.subBurst = enraged ? 8 : 6;
        e.burstDelay = 0.1;
        e.bossStateTimer = 1.9;
        e.bossStateMax = 1.9;
        e.bossStatusText = 'TRÜMMER-HAGEL!';
      }
    }
  }

  public getBossPylonPositions(e: Enemy): Array<{ x: number; y: number; depth: number; angle: number }> {
    const count = e.bossPhase2 ? 4 : 3;
    const baseAngle = e.bossOrbitAngle ?? 0;
    const rx = e.bossPylonRadius ?? 28;
    const ry = rx * 0.48;
    const z = e.bossHeight ?? 0;
    const list: Array<{ x: number; y: number; depth: number; angle: number }> = [];
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i / count) * Math.PI * 2;
      list.push({
        x: e.x + Math.cos(a) * rx,
        y: e.y - 4 - z + Math.sin(a) * ry,
        depth: Math.sin(a),
        angle: a,
      });
    }
    return list;
  }

  private updateBossAI(e: Enemy, dt: number, dx: number, dy: number, nx: number, ny: number): void {
    const rb = this.scene.bounds; // M12: Raumgrenzen (Standard = ROOM_LEFT…)
    const enraged = e.hp <= e.maxHp * 0.5;
    const state: BossState = e.bossState ?? 'stalk';

    // Orbiting plasma pylons spin continuously (faster during barrage & Phase 2!)
    const orbitSpeed =
      state === 'pylon_barrage' ? (enraged ? 5.6 : 4.4) : enraged ? 3.1 : 2.1;
    e.bossOrbitAngle = (e.bossOrbitAngle ?? 0) + dt * orbitSpeed;
    const desiredRadius =
      state === 'pylon_barrage' ? 37 : state === 'phase2_roar' ? 42 : 28;
    e.bossPylonRadius =
      (e.bossPylonRadius ?? 28) + (desiredRadius - (e.bossPylonRadius ?? 28)) * Math.min(1, dt * 6);

    // Phase 2 dramatic Overload Transition at 50% HP!
    if (enraged && !e.bossPhase2 && state !== 'slam_air' && state !== 'slam_jump') {
      e.bossPhase2 = true;
      e.bossState = 'phase2_roar';
      e.bossStateTimer = 1.1;
      e.bossStateMax = 1.1;
      e.bossHeight = 0;
      e.bossStatusText = 'KERN-ÜBERLASTUNG!';
      e.vx = 0;
      e.vy = 0;
      sound.playBossRoar();
      this.scene.triggerShake(0.45, 5.2);
      this.scene.shockwaves.push({
        x: e.x,
        y: e.y,
        maxRadius: 96,
        color: '#fb7185',
        life: 0.45,
        maxLife: 0.45,
      });
      this.scene.spawnBurst(e.x, e.y, '#fb7185', 26);
      this.scene.spawnEnemy('slime', rb.cx - 80, rb.cy);
      this.scene.spawnEnemy('drone', rb.cx + 80, rb.cy);
      this.scene.callbacks.onToast('⚠ PHASE II: Kern-Wächter MK-IV im Überlastungs-Modus!', 'warn');
      return;
    }

    // Continuous thruster & damaged-armor embers
    const sparkRate = enraged ? 16 : 9;
    if (Math.random() < dt * sparkRate) {
      this.scene.particles.push({
        x: e.x + (Math.random() - 0.5) * 18,
        y: e.y + 8 - (e.bossHeight ?? 0) + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 18,
        vy: 14 + Math.random() * 18,
        color: enraged ? (Math.random() > 0.4 ? '#fb7185' : '#fbbf24') : '#38e8d4',
        size: 1.7,
        life: 0.3,
        maxLife: 0.3,
      });
    }

    e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;

    if (state === 'phase2_roar') {
      e.bossHeight = Math.sin((1 - Math.max(0, e.bossStateTimer) / 1.1) * Math.PI) * 14;
      if (Math.random() < dt * 22) {
        const a = Math.random() * Math.PI * 2;
        this.scene.particles.push({
          x: e.x + Math.cos(a) * 16,
          y: e.y - (e.bossHeight ?? 0) + Math.sin(a) * 12,
          vx: Math.cos(a) * 70,
          vy: Math.sin(a) * 70,
          color: '#fb7185',
          size: 2.2,
          life: 0.3,
          maxLife: 0.3,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossHeight = 0;
        e.bossState = 'stalk';
        e.bossStateTimer = 0.55;
        e.bossStateMax = 0.55;
        e.bossStatusText = 'ÜBERLASTET';
      }
      return;
    }

    if (state === 'stunned') {
      e.bossHeight = 0;
      if (Math.random() < dt * 12) {
        this.scene.particles.push({
          x: e.x + (Math.random() - 0.5) * 18,
          y: e.y - 12,
          vx: (Math.random() - 0.5) * 20,
          vy: -22,
          color: '#94a3b8',
          size: 2,
          life: 0.35,
          maxLife: 0.35,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.65 : 0.95;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    if (state === 'charge_windup') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      // Continuously refine aim for first 60% of windup, then lock lane cleanly!
      if (e.bossStateTimer > (e.bossStateMax ?? 0.62) * 0.38) {
        e.chargeDirX = nx;
        e.chargeDirY = ny;
      }
      if (Math.random() < dt * 20) {
        this.scene.particles.push({
          x: e.x - e.chargeDirX * 14 + (Math.random() - 0.5) * 10,
          y: e.y - e.chargeDirY * 14 + (Math.random() - 0.5) * 8,
          vx: -e.chargeDirX * 65,
          vy: -e.chargeDirY * 65,
          color: '#fb923c',
          size: 2,
          life: 0.22,
          maxLife: 0.22,
        });
      }
      if (e.bossStateTimer <= 0) {
        sound.playBossCharge();
        e.bossState = 'charge_dash';
        e.bossStateTimer = enraged ? 0.58 : 0.52;
        e.bossStateMax = e.bossStateTimer;
        e.bossAfterimageTick = 0;
        e.bossStatusText = 'RAKETEN-RAMME!';
      }
      return;
    }

    if (state === 'charge_dash') {
      const speed = enraged ? 275 : 230;
      e.vx = e.chargeDirX * speed;
      e.vy = e.chargeDirY * speed;
      e.bossAfterimageTick = (e.bossAfterimageTick ?? 0) - dt;
      if (e.bossAfterimageTick <= 0) {
        e.bossAfterimageTick = 0.055;
        this.scene.bossAfterimages.push({
          x: e.x,
          y: e.y,
          height: e.bossHeight ?? 0,
          tilt: e.chargeDirX * 0.26,
          enraged,
          life: 0.24,
          maxLife: 0.24,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.8 : 1.1;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    if (state === 'slam_jump') {
      const maxT = e.bossStateMax ?? 0.42;
      const p = 1 - Math.max(0, e.bossStateTimer) / maxT;
      e.bossHeight = Math.pow(p, 0.7) * 76;
      e.vx *= 0.4;
      e.vy *= 0.4;
      if (Math.random() < dt * 26) {
        this.scene.particles.push({
          x: e.x + (Math.random() - 0.5) * 14,
          y: e.y + 10 - (e.bossHeight ?? 0),
          vx: (Math.random() - 0.5) * 28,
          vy: 45 + Math.random() * 35,
          color: '#fbbf24',
          size: 2.2,
          life: 0.25,
          maxLife: 0.25,
        });
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'slam_air';
        e.bossStateTimer = enraged ? 0.46 : 0.56;
        e.bossStateMax = e.bossStateTimer;
        e.bossTargetX = this.scene.playerX;
        e.bossTargetY = this.scene.playerY;
        e.bossStatusText = 'SCHWERKRAFT-STURZ!';
      }
      return;
    }

    if (state === 'slam_air') {
      const maxT = e.bossStateMax ?? 0.52;
      const p = 1 - Math.max(0, e.bossStateTimer) / maxT;
      // Track player during first 55% of air hover, then lock landing reticle!
      if (p < 0.55) {
        e.bossTargetX = (e.bossTargetX ?? this.scene.playerX) + (this.scene.playerX - (e.bossTargetX ?? this.scene.playerX)) * Math.min(1, dt * 6);
        e.bossTargetY = (e.bossTargetY ?? this.scene.playerY) + (this.scene.playerY - (e.bossTargetY ?? this.scene.playerY)) * Math.min(1, dt * 6);
      }
      const tx = Math.max(rb.l + 26, Math.min(rb.r - 26, e.bossTargetX ?? rb.cx));
      const ty = Math.max(rb.t + 24, Math.min(rb.b - 24, e.bossTargetY ?? rb.cy));
      e.bossTargetX = tx;
      e.bossTargetY = ty;
      e.x += (tx - e.x) * Math.min(1, dt * 7);
      e.y += (ty - e.y) * Math.min(1, dt * 7);

      if (p > 0.72) {
        // Rapid meteor descent!
        const fallP = (p - 0.72) / 0.28;
        e.bossHeight = 76 * (1 - fallP * fallP);
      } else {
        e.bossHeight = 76;
      }

      if (e.bossStateTimer <= 0) {
        e.bossHeight = 0;
        e.x = tx;
        e.y = ty;
        sound.playBossSlam();
        this.scene.triggerShake(0.36, 5.5);
        // Scorched crater decal + double shockwave + radial embers!
        this.scene.decals.push({
          x: e.x,
          y: e.y + 8,
          r: 22,
          color: 'rgba(15, 23, 42, 0.55)',
          life: 6.0,
          maxLife: 6.0,
        });
        this.scene.shockwaves.push({
          x: e.x,
          y: e.y + 4,
          maxRadius: 68,
          color: enraged ? '#fb7185' : '#fb923c',
          life: 0.34,
          maxLife: 0.34,
        });
        this.scene.shockwaves.push({
          x: e.x,
          y: e.y + 4,
          maxRadius: 42,
          color: '#fde047',
          life: 0.24,
          maxLife: 0.24,
        });
        this.scene.spawnBurst(e.x, e.y + 4, '#fbbf24', 24);
        const bolts = enraged ? 10 : 8;
        for (let k = 0; k < bolts; k++) {
          const a = (k / bolts) * Math.PI * 2 + 0.2;
          this.fireEnemyBolt(e.x, e.y, a, enraged ? 132 : 112, 15, '#fb923c');
        }
        // Slam AoE hit check
        const distPlayer = Math.hypot(this.scene.playerX - e.x, this.scene.playerY - e.y);
        if (distPlayer <= 44) {
          const px = (this.scene.playerX - e.x) / Math.max(1, distPlayer);
          const py = (this.scene.playerY - e.y) / Math.max(1, distPlayer);
          this.scene.damagePlayer(24, px, py, e);
        }
        e.bossState = 'slam_impact';
        e.bossStateTimer = 0.42;
        e.bossStateMax = 0.42;
        e.bossStatusText = 'EINSCHLAG!';
      }
      return;
    }

    if (state === 'slam_impact') {
      e.vx *= 0.2;
      e.vy *= 0.2;
      if (e.bossStateTimer <= 0) {
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.78 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    if (state === 'laser_windup') {
      e.vx *= 0.25;
      e.vy *= 0.25;
      e.bossHeight = 6 + Math.sin(this.scene.time * 18) * 1.5;
      // Spiral imploding energy motes into boss reactor core!
      if (Math.random() < dt * 28) {
        const a = Math.random() * Math.PI * 2;
        this.scene.particles.push({
          x: e.x + Math.cos(a) * 28,
          y: e.y - 6 + Math.sin(a) * 22,
          vx: -Math.cos(a) * 78,
          vy: -Math.sin(a) * 78,
          color: enraged ? '#fb7185' : '#fde047',
          size: 1.8,
          life: 0.3,
          maxLife: 0.3,
        });
      }
      if (e.bossStateTimer <= 0) {
        sound.playBossLaser();
        this.scene.triggerShake(0.25, 2.5);
        e.bossState = 'laser_sweep';
        e.bossStateTimer = enraged ? 1.25 : 1.1;
        e.bossStateMax = e.bossStateTimer;
        e.bossLaserTick = 0;
        e.bossStatusText = 'KERN-LASER!';
      }
      return;
    }

    if (state === 'laser_sweep') {
      e.vx *= 0.15;
      e.vy *= 0.15;
      e.bossHeight = 6;
      const sweepRate = (enraged ? 2.15 : 1.75) * (e.bossLaserDir ?? 1);
      e.bossLaserAngle = (e.bossLaserAngle ?? 0) + sweepRate * dt;

      // Raycast laser to wall & damage player if intersected!
      const lx = e.x;
      const ly = e.y - 8;
      const cosA = Math.cos(e.bossLaserAngle);
      const sinA = Math.sin(e.bossLaserAngle);
      const rayMax = this.scene.rayLimit(320);
      let maxT = rayMax;
      for (let t = 12; t < rayMax; t += 6) {
        const px = lx + cosA * t;
        const py = ly + sinA * t;
        if (px < rb.l || px > rb.r || py < rb.t || py > rb.b) {
          maxT = t;
          break;
        }
      }
      const exWall = lx + cosA * maxT;
      const eyWall = ly + sinA * maxT;
      if (Math.random() < dt * 26) {
        this.scene.particles.push({
          x: exWall,
          y: eyWall,
          vx: -cosA * 40 + (Math.random() - 0.5) * 45,
          vy: -sinA * 40 + (Math.random() - 0.5) * 45,
          color: '#fde047',
          size: 1.9,
          life: 0.22,
          maxLife: 0.22,
        });
      }
      const distLine = this.scene.pointToSegmentDist(this.scene.playerX, this.scene.playerY, lx, ly, exWall, eyWall);
      if (distLine <= 11) {
        this.scene.damagePlayer(18, -sinA * (e.bossLaserDir ?? 1), cosA * (e.bossLaserDir ?? 1), e);
      }

      if (e.bossStateTimer <= 0) {
        e.bossHeight = 0;
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.85 : 1.15;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    if (state === 'pylon_barrage') {
      e.bossHeight = 5 + Math.sin(this.scene.time * 8) * 2;
      e.vx += nx * 24 * dt;
      e.vy += ny * 24 * dt;
      e.burstDelay -= dt;
      if (e.subBurst > 0 && e.burstDelay <= 0) {
        // Fire projectiles straight out of EACH orbiting plasma pylon!
        const pylons = this.getBossPylonPositions(e);
        if (enraged) {
          // M11 Phase 2 „Faust-Salve“: Es gibt nur diese 4 Fäuste — sie fliegen EINMAL los (erste Salve), verfolgen den Spieler ~1,4 s lang (Lenkrate 2 rad/s, dann geradeaus), lösen sich auf und wachsen im Orbit nach;
          // in den übrigen Salven sind die Plätze leer, es wird nichts nachgeschossen.
          if (e.subBurst === 4) {
            pylons.forEach((py, i) => {
              const aim = Math.atan2(this.scene.playerY - py.y, this.scene.playerX - py.x) + (i - (pylons.length - 1) / 2) * 0.16;
              this.scene.projectiles.push({ x: py.x, y: py.y, vx: Math.cos(aim) * 120, vy: Math.sin(aim) * 120, fromPlayer: false, damage: 16, color: '#fb7185', radius: 6, life: 1.9, sprite: 'fist', homing: 2.0, homingUntilLife: 0.5 });
              this.scene.spawnBurst(py.x, py.y, '#fb7185', 6);
            });
          }
        } else {
          for (const py of pylons) {
            const toPlayer = Math.atan2(this.scene.playerY - py.y, this.scene.playerX - py.x);
            const aim = e.subBurst % 2 === 0 ? toPlayer : py.angle;
            this.fireEnemyBolt(py.x, py.y, aim, 122, 14, '#38e8d4');
            this.scene.spawnBurst(py.x, py.y, '#38e8d4', 4);
          }
        }
        sound.playBlaster();
        e.subBurst -= 1;
        e.burstDelay = enraged ? 0.24 : 0.3;
      }
      if (e.bossStateTimer <= 0) {
        e.bossHeight = 0;
        e.bossState = 'stalk';
        e.bossStateTimer = enraged ? 0.8 : 1.05;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = enraged ? 'ÜBERLASTET' : 'AKTIV';
      }
      return;
    }

    // Default 'stalk' state: active hovering pursuit + lateral weave, then launch next attack!
    e.bossHeight = Math.max(0, (e.bossHeight ?? 0) - dt * 20);
    const sway = Math.sin(this.scene.time * 2.4) * 38;
    e.vx += (nx * (enraged ? 58 : 44) - ny * sway) * dt * 3.0;
    e.vy += (ny * (enraged ? 58 : 44) + nx * sway) * dt * 3.0;

    if (e.bossStateTimer <= 0) {
      const atk = e.phase % 4;
      e.phase += 1;
      if (atk === 0) {
        // Orbital Pylon Barrage
        e.bossState = 'pylon_barrage';
        e.subBurst = enraged ? 4 : 3;
        e.burstDelay = 0.35;
        e.bossStateTimer = enraged ? 1.35 : 1.28;
        e.bossStateMax = e.bossStateTimer;
        e.bossStatusText = 'ORBIT-SALVE!';
      } else if (atk === 1) {
        // Rocket Charge Dash
        e.bossState = 'charge_windup';
        e.bossStateTimer = enraged ? 0.54 : 0.64;
        e.bossStateMax = e.bossStateTimer;
        e.chargeDirX = nx;
        e.chargeDirY = ny;
        e.bossStatusText = 'ANLAUF...';
      } else if (atk === 2) {
        // Gravity Jump Slam
        e.bossState = 'slam_jump';
        e.bossStateTimer = 0.4;
        e.bossStateMax = 0.4;
        e.bossTargetX = this.scene.playerX;
        e.bossTargetY = this.scene.playerY;
        sound.playDash();
        e.bossStatusText = 'SPRUNG-ANGRIFF!';
      } else {
        // Sweeping Reactor Laser!
        e.bossState = 'laser_windup';
        e.bossStateTimer = enraged ? 0.65 : 0.76;
        e.bossStateMax = e.bossStateTimer;
        e.bossLaserDir = Math.random() > 0.5 ? 1 : -1;
        e.bossLaserAngle = Math.atan2(dy, dx) - e.bossLaserDir * 0.95;
        e.bossStatusText = 'LASER LÄDT...';
      }
    }
  }

  public fireEnemyBolt(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    color: string,
  ): void {
    this.scene.projectiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      fromPlayer: false,
      damage,
      color,
      radius: 3.5,
      life: 2.8,
    });
  }
}
