import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { drawBossLook } from './bosses/bossLooks';
import { getBossPose, smoothBossBody } from './anim/bossAnims';
import { drawDetached, spawnPhase2Parts } from './anim/detached';
import { enemyMotion, wantsMotion } from './anim/motion';
import { turretFacing } from './anim/enemyAnims';
import { drawRig } from '../engine/rig';
import { RIG_BY_KIND, RIGS } from '../data/rigs';
import { getAtlas } from '../assets/sprites';
import { shakeFactor } from '../systems/deviceSettings';
import { COMPANION_DEFS, SUIT_THEMES } from '../data/companions';
import { getInfusionDef, RIFT_MUTATORS } from '../data/infusions';
import { getItemDef } from '../data/items';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import {
  ROOM_BOTTOM,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  ROOM_LEFT,
  ROOM_RIGHT,
  ROOM_TOP,
  roomKey,
  type DungeonRoom,
} from '../world/dungeonGen';
import { ENEMY_SHIELDS } from '../data/balance';
import type { DungeonScene } from '../scenes/DungeonScene';
import { formatWeekLabel } from '../systems/weeklyTrial';
import { getMechanicsDrawables, renderMechanicsGround } from './roomMechanicsRenderer';
import type { Enemy, SpearThrustFx, WeaponSwing } from './dungeonTypes';

export class DungeonRenderer {
  private scene: DungeonScene;

  constructor(scene: DungeonScene) {
    this.scene = scene;
  }

  // ==================== HD RENDERING ====================
  public render(ctx: CanvasRenderingContext2D, input: InputManager): void {
    const art = getHDArt();
    const atlas = getAtlas();

    ctx.save();
    const shakeK = shakeFactor();
    if (this.scene.shakeTimer > 0 && shakeK > 0) {
      const sx = (Math.random() - 0.5) * 2 * this.scene.shakeMag * shakeK;
      const sy = (Math.random() - 0.5) * 2 * this.scene.shakeMag * shakeK;
      ctx.translate(sx, sy);
    }

    const visSec = this.scene.floor.visualSector ?? this.scene.currentSector;
    const roomBg =
      visSec >= 4
        ? art.dungeonBgS4 ?? art.dungeonBg
        : visSec === 3
          ? art.dungeonBgS3 ?? art.dungeonBg
          : visSec === 2
            ? art.dungeonBgS2 ?? art.dungeonBg
            : art.dungeonBg;
    if (roomBg) {
      ctx.drawImage(roomBg, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else {
      ctx.fillStyle =
        visSec >= 4
          ? '#0d1522'
          : visSec === 3
            ? '#22100a'
            : visSec === 2
              ? '#150d28'
              : '#0e131f';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Subtle violet-cyan Rift Dimension atmosphere when inside a Rift Chamber or the Endless Spiral!
    if (this.scene.isEndlessRift || this.scene.currentRoom.isRiftChamber) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.14)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Distinct Sector & Floor I / II / III Atmospheric Tints + Cosmic Night Ambience!
    if (this.scene.currentSector === 5) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (this.scene.currentSector === 4) {
      if (this.scene.currentFloor === 2) {
        ctx.fillStyle = 'rgba(14, 48, 66, 0.16)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      } else if (this.scene.currentFloor === 3) {
        ctx.fillStyle = 'rgba(66, 48, 12, 0.16)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
    } else if (this.scene.currentSector === 3) {
      if (this.scene.currentFloor === 2) {
        ctx.fillStyle = 'rgba(66, 22, 8, 0.15)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      } else if (this.scene.currentFloor === 3) {
        ctx.fillStyle = 'rgba(84, 18, 10, 0.2)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
    } else if (this.scene.currentSector === 2) {
      if (this.scene.currentFloor === 2) {
        ctx.fillStyle = 'rgba(26, 18, 62, 0.16)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      } else if (this.scene.currentFloor === 3) {
        ctx.fillStyle = 'rgba(58, 12, 68, 0.19)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
    } else if (this.scene.currentFloor === 2) {
      ctx.fillStyle = 'rgba(10, 56, 46, 0.2)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (this.scene.currentFloor === 3) {
      ctx.fillStyle = 'rgba(54, 16, 12, 0.22)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
    if (this.scene.state.timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(15, 23, 54, 0.16)';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    // Subterranean Moonlighter Secret Vault ambiance & Grav-Rope exit shaft!
    if (this.scene.currentRoom.type === 'secret') {
      this.renderSecretVaultOverlay(ctx);
    }

    // Integrated Abyssal Chasms & Pits (including subtle sparkling Secret Pit!)
    if (this.scene.currentRoom.chasms && this.scene.currentRoom.chasms.length > 0) {
      this.renderChasms(ctx);
    }

    // Floor slime & crater decals
    for (const d of this.scene.decals) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life / d.maxLife);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Floor II/III Steam & Plasma Hazard Vents!
    for (const h of this.scene.currentRoom.hazards) {
      const cycle = (this.scene.time + h.phase) % 4.0;
      const warning = cycle >= 2.2 && cycle < 3.0;
      const active = cycle >= 3.0;
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = active ? (this.scene.currentSector === 2 ? '#e879f9' : '#fb923c') : warning ? '#fbbf24' : '#334155';
      ctx.lineWidth = active ? 2 : 1.1;
      ctx.stroke();
      // Metal grate bars
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let gx = -h.r * 0.55; gx <= h.r * 0.55; gx += 4.5) {
        ctx.beginPath();
        ctx.moveTo(h.x + gx, h.y - h.r * 0.45);
        ctx.lineTo(h.x + gx, h.y + h.r * 0.45);
        ctx.stroke();
      }
      if (warning) {
        const wPulse = 0.5 + 0.5 * Math.sin(this.scene.time * 26);
        ctx.fillStyle = `rgba(251, 191, 36, ${0.18 + wPulse * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (active) {
        const ventGlow = this.scene.currentSector === 2 ? '#e879f9' : '#38e8d4';
        drawGlow(ctx, h.x, h.y - 4, h.r * 1.9, ventGlow, 0.48);
        ctx.fillStyle = this.scene.currentSector === 2 ? 'rgba(232, 121, 249, 0.55)' : 'rgba(56, 232, 212, 0.55)';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r * 0.9, h.r * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y - 1, h.r * 0.45, h.r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Milestone 10-A: Boden-Layer der Sektor-Mechaniken (Magnetplatten, Düsen-Schienen, Teleporter-Pads)
    renderMechanicsGround(ctx, this.scene);
    this.scene.bossFx.render(ctx, this.scene.time);

    // Ambient bioluminescent spores / shimmering crystal motes in Sector 2!
    for (let s = 0; s < 12; s++) {
      const sx = ROOM_LEFT + ((s * 73 + this.scene.currentRoom.tileSeed) % (ROOM_RIGHT - ROOM_LEFT));
      const sy =
        ROOM_TOP +
        ((s * 47 + Math.floor(this.scene.time * 8) + this.scene.currentRoom.tileSeed) % (ROOM_BOTTOM - ROOM_TOP));
      const a = 0.25 + 0.45 * Math.sin(this.scene.time * 2.5 + s);
      ctx.fillStyle =
        this.scene.currentSector === 2
          ? s % 3 === 0
            ? `rgba(232, 121, 249, ${Math.max(0, a)})`
            : s % 2 === 0
              ? `rgba(56, 232, 212, ${Math.max(0, a)})`
              : `rgba(253, 224, 71, ${Math.max(0, a * 0.85)})`
          : this.scene.currentFloor === 3
            ? `rgba(251, 146, 60, ${Math.max(0, a)})`
            : this.scene.currentFloor === 2
              ? `rgba(52, 211, 153, ${Math.max(0, a)})`
              : `rgba(56, 232, 212, ${Math.max(0, a)})`;
      ctx.fillRect(sx + Math.sin(this.scene.time + s) * 4, sy, 1.5, 1.5);
    }

    this.renderDoors(ctx);

    if (this.scene.currentRoom.type === 'start') {
      this.renderWarpPad(ctx, ROOM_CENTER_X, ROOM_CENTER_Y - 12, this.scene.currentSector === 2 ? '#c084fc' : '#38e8d4');
      // Floor III Start Room Emergency Med-Station!
      if (this.scene.currentRoom.hasHealStation) {
        const hx = ROOM_CENTER_X + 70;
        const hy = ROOM_CENTER_Y - 12;
        const used = Boolean(this.scene.currentRoom.healStationUsed);
        drawPixelShadow(ctx, hx, hy + 10, 11, 4, 0.48);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(hx - 10, hy - 14, 20, 22);
        ctx.strokeStyle = used ? '#475569' : '#34d399';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx - 10, hy - 14, 20, 22);
        ctx.fillStyle = used ? '#334155' : '#10b981';
        ctx.fillRect(hx - 6, hy - 9, 12, 10);
        if (!used) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(hx - 1.2, hy - 7.5, 2.4, 7);
          ctx.fillRect(hx - 3.5, hy - 5.2, 7, 2.4);
          drawGlow(ctx, hx, hy - 4, 24, '#34d399', 0.34 + Math.sin(this.scene.time * 5) * 0.08);
        }
      }
    } else if (this.scene.currentRoom.type === 'boss' && this.scene.floorBossDefeated) {
      if (this.scene.isEndlessRift) {
        const padY = ROOM_CENTER_Y + 6;
        this.renderWarpPad(ctx, ROOM_CENTER_X - 48, padY, '#38e8d4');
        this.renderWarpPad(ctx, ROOM_CENTER_X + 48, padY, '#c084fc');
        ctx.font = 'bold 5px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#67e8f9';
        ctx.fillText('EXTRAKTION', ROOM_CENTER_X - 48, padY + 22);
        ctx.fillStyle = '#e879f9';
        ctx.fillText(`∞ EBENE ${this.scene.riftDepth + 1}`, ROOM_CENTER_X + 48, padY + 22);
      } else if (this.scene.currentFloor < 3 && this.scene.currentSector !== 5) {
        const padY = ROOM_CENTER_Y + 6;
        this.renderWarpPad(ctx, ROOM_CENTER_X - 48, padY, '#38e8d4');
        this.renderWarpPad(ctx, ROOM_CENTER_X + 48, padY, this.scene.currentSector === 2 ? '#e879f9' : '#fbbf24');
        ctx.font = 'bold 5px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#67e8f9';
        ctx.fillText('EXTRAKTION', ROOM_CENTER_X - 48, padY + 22);
        ctx.fillStyle = this.scene.currentSector === 2 ? '#f0abfc' : '#fde047';
        ctx.fillText(this.scene.currentFloor === 1 ? '▼ EBENE II' : '▼ EBENE III', ROOM_CENTER_X + 48, padY + 22);
      } else {
        const vy = ROOM_CENTER_Y + 12;
        const winColor =
          this.scene.currentSector === 5
            ? '#fde047'
            : this.scene.currentSector === 4
              ? '#38e8d4'
              : this.scene.currentSector === 3
                ? '#fb923c'
                : this.scene.currentSector === 2
                  ? '#e879f9'
                  : '#fde047';
        this.renderWarpPad(ctx, ROOM_CENTER_X, vy, winColor);
        ctx.font = 'bold 5.2px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = winColor;
        ctx.fillText(
          this.scene.currentSector === 5
            ? '★ OMEGA-SIEG!'
            : `★ SEKTOR-${this.scene.currentSector} SIEG!`,
          ROOM_CENTER_X,
          vy + 22,
        );
      }
    }

    // M10-C: Notfall-Bake (Teleporter-Säule; aktiv erst nach Raum-Clear)
    {
      const bc = this.scene.currentRoom.extractBeacon;
      if (bc && !bc.used && !this.scene.isWeeklyTrial) {
        const live = this.scene.currentRoom.cleared;
        const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 4);
        drawPixelShadow(ctx, bc.x, bc.y + 4, 9, 3, 0.45);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(bc.x - 7, bc.y - 1, 14, 6);
        ctx.fillStyle = '#334155';
        ctx.fillRect(bc.x - 5, bc.y - 11, 10, 11);
        ctx.fillStyle = live ? '#38e8d4' : '#475569';
        ctx.fillRect(bc.x - 3, bc.y - 9, 6, 3);
        ctx.fillStyle = live ? `rgba(165, 243, 252, ${0.55 + 0.4 * pulse})` : '#64748b';
        ctx.fillRect(bc.x - 2, bc.y - 16, 4, 6);
        if (live) drawGlow(ctx, bc.x, bc.y - 10, 20 + pulse * 4, '#38e8d4', 0.3);
      }
    }

    // Milestone 7: Swirling Unstable Rift-Riss portal inside cleared regular rooms
    if (
      this.scene.currentRoom.cleared &&
      this.scene.currentRoom.riftPortal &&
      !this.scene.currentRoom.riftPortal.cleared
    ) {
      const rp = this.scene.currentRoom.riftPortal;
      const pulse = Math.sin(this.scene.time * 5.2);
      drawGlow(ctx, rp.x, rp.y, 34 + pulse * 4, '#c084fc', 0.42);
      drawGlow(ctx, rp.x, rp.y, 18, '#38e8d4', 0.35);
      ctx.save();
      ctx.translate(rp.x, rp.y);
      ctx.rotate(this.scene.time * 2.4);
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(-this.scene.time * 4.2);
      ctx.strokeStyle = '#38e8d4';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6, 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#0f0620';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.font = 'bold 4.8px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0abfc';
      ctx.fillText('🌀 RIFT-RISS', rp.x, rp.y + 19);
    }

    // Milestone 7: Cleared Rift Anomaly Chamber return portal
    if (this.scene.currentRoom.isRiftChamber && this.scene.currentRoom.cleared) {
      const rx = ROOM_CENTER_X;
      const ry = ROOM_BOTTOM - 28;
      this.renderWarpPad(ctx, rx, ry, '#c084fc');
      ctx.font = 'bold 4.8px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e879f9';
      ctx.fillText('🌀 ZURÜCK', rx, ry + 18);
    }

    for (const ob of this.scene.currentRoom.obstacles) {
      this.renderObstacle(ctx, ob);
    }

    for (const pod of this.scene.currentRoom.pods) {
      if (!pod.broken) {
        drawPixelShadow(ctx, pod.x, pod.y + 9, 9, 3.5, 0.48);
        if (art.podIntact) {
          ctx.drawImage(art.podIntact, pod.x - 11, pod.y - 13, 22, 24);
        } else {
          ctx.drawImage(atlas.props.podIntact, Math.round(pod.x - 8), Math.round(pod.y - 7));
        }
        drawGlow(ctx, pod.x, pod.y - 1, 16, '#fbbf24', 0.22);
      } else {
        ctx.drawImage(atlas.props.podBroken, Math.round(pod.x - 8), Math.round(pod.y - 5));
      }
    }

    if (this.scene.currentRoom.chest) {
      const ch = this.scene.currentRoom.chest;
      drawPixelShadow(ctx, ch.x, ch.y + 10, 14, 4.5, 0.5);
      const chestSpr = ch.opened ? art.chestOpen : art.chestClosed;
      if (chestSpr) {
        ctx.drawImage(chestSpr, ch.x - 14, ch.y - 13, 28, 25);
      } else {
        ctx.drawImage(
          ch.opened ? atlas.props.chestOpen : atlas.props.chestClosed,
          Math.round(ch.x - 10),
          Math.round(ch.y - 6),
        );
      }
      if (!ch.opened) {
        drawGlow(ctx, ch.x, ch.y - 2, 28, '#fbbf24', 0.34 + Math.sin(this.scene.time * 4) * 0.08);
      }
    }

    for (const d of this.scene.drops) {
      const def = getItemDef(d.itemId);
      const bob = Math.sin(this.scene.time * 5 + d.x) * 2.2;
      const pinNeed = this.scene.state.getPinnedItemNeed(d.itemId);
      const wanted = Boolean(pinNeed && pinNeed.stillNeeded > 0);
      drawPixelShadow(ctx, d.x, d.y + 7, 6, 2.5, 0.42);
      drawGlow(ctx, d.x, d.y + bob, wanted ? 22 : 16, wanted ? '#fde047' : def.glowColor, wanted ? 0.56 : 0.4);
      const spr = art.items[d.itemId] ?? atlas.items[d.itemId];
      if (spr) {
        ctx.drawImage(spr, d.x - 9, d.y - 10 + bob, 18, 18);
      }
      if (wanted) {
        const pinBob = Math.sin(this.scene.time * 7 + d.x) * 1.5;
        ctx.fillStyle = 'rgba(15, 22, 36, 0.92)';
        ctx.fillRect(d.x - 10, d.y - 20 + pinBob, 20, 8);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 0.7;
        ctx.strokeRect(d.x - 10, d.y - 20 + pinBob, 20, 8);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 4.8px Silkscreen, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ PIN', d.x, d.y - 14 + pinBob);
      }
    }

    for (const a of this.scene.afterimages) {
      ctx.save();
      ctx.globalAlpha = (a.life / a.maxLife) * 0.45;
      if (art.heroFlash) {
        ctx.drawImage(art.heroFlash, a.x - 12, a.y - 16, 24, 28);
      } else {
        ctx.drawImage(atlas.heroFlash, Math.round(a.x - 8), Math.round(a.y - 10));
      }
      ctx.restore();
    }

    // Glowing Rocket-Charge Boss Afterimages!
    for (const ba of this.scene.bossAfterimages) {
      const alpha = (ba.life / ba.maxLife) * 0.48;
      const bFlash = ba.isBreacher ? art.bossBreacherFlash : art.bossFlash;
      if (bFlash) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.translate(ba.x, ba.y - ba.height);
        ctx.rotate(ba.tilt);
        ctx.drawImage(bFlash, -26, -28, 52, 50);
        ctx.restore();
      }
      drawGlow(ctx, ba.x, ba.y - ba.height, 26, ba.enraged ? '#fb7185' : '#fb923c', alpha * 0.7);
    }

    // Leviathan Falling Reactor Debris Telegraphs!
    for (const dr of this.scene.debrisDrops) {
      const prog = 1 - Math.max(0, dr.timer / dr.maxTimer);
      ctx.save();
      ctx.fillStyle = `rgba(244, 63, 94, ${0.14 + prog * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(dr.x, dr.y, dr.r * prog, dr.r * prog * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.65 + prog * 0.35})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(dr.x, dr.y, dr.r, dr.r * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Falling glowing hull chunk descending into reticle
      if (prog > 0.35) {
        const dropH = (1 - prog) * 140;
        ctx.fillStyle = '#475569';
        ctx.fillRect(dr.x - 6, dr.y - dropH - 6, 12, 10);
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(dr.x - 4, dr.y - dropH - 4, 8, 4);
      }
      ctx.restore();
    }

    // Enemy & Boss Floor Telegraphs
    for (const e of this.scene.enemies) {
      if ((e.kind === 'drone' || e.kind === 'shard_sniper') && e.telegraphTimer > 0) {
        const isSniper = e.kind === 'shard_sniper';
        const locked = isSniper && e.telegraphTimer <= 0.26;
        ctx.save();
        ctx.strokeStyle = isSniper
          ? locked
            ? '#ffffff'
            : `rgba(244, 114, 182, ${0.55 + 0.4 * Math.sin(this.scene.time * 42)})`
          : `rgba(251, 113, 133, ${0.4 + 0.4 * Math.sin(this.scene.time * 36)})`;
        ctx.lineWidth = isSniper ? (locked ? 2.1 : 1.5) : 1.2;
        if (!locked) ctx.setLineDash(isSniper ? [6, 3] : [4, 3]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        const len = isSniper ? 260 : 145;
        ctx.lineTo(e.x + Math.cos(e.aimAngle) * len, e.y + Math.sin(e.aimAngle) * len);
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'boss_quartz_golem' && e.bossState === 's2_slam_windup') {
        const prog = 1 - Math.max(0, (e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 0.6));
        const r = (e.bossPhase2 ? 92 : 76) * 0.72;
        ctx.save();
        ctx.strokeStyle = `rgba(192, 132, 252, ${0.4 + prog * 0.55})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(192, 132, 252, ${0.08 + prog * 0.22})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * prog, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (e.kind === 'boss_prism_weaver' && e.bossState === 's2_blink_windup') {
        const tx = e.bossTargetX ?? ROOM_CENTER_X;
        const ty = e.bossTargetY ?? ROOM_CENTER_Y;
        const prog = 1 - Math.max(0, (e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 0.6));
        ctx.save();
        ctx.strokeStyle = `rgba(232, 121, 249, ${0.5 + prog * 0.45})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tx, ty, 20 - prog * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
        drawGlow(ctx, tx, ty, 24, '#e879f9', 0.35 + prog * 0.25);
      } else if (e.kind === 'boss' || e.kind === 'boss_breacher') {
        this.renderBossFloorTelegraph(ctx, e);
      } else if (e.kind === 'boss_leviathan') {
        this.renderLeviathanFloorTelegraphs(ctx, e);
      }
    }

    // Depth-sorted enemies & hero (airborne boss renders above grounded actors!)
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];
    for (const e of this.scene.enemies) {
      const sortY =
        e.kind === 'boss_leviathan'
          ? ROOM_TOP + 20
          : e.kind === 'boss' && (e.bossHeight ?? 0) > 12
            ? 999
            : e.y;
      drawables.push({
        y: sortY,
        draw: () =>
          this.withSplitScale(ctx, e, () => {
          if (!wantsMotion(e)) {
            this.renderEnemy(ctx, e);
            return;
          }
          // M11: prozedurale Bewegung (Lehnen/Atmen/Ausholen/Zucken) um den Fußpunkt — nur Darstellung
          const m = enemyMotion(e, this.scene.time);
          ctx.save();
          ctx.translate(e.x + m.dx, e.y + e.radius + m.dy);
          ctx.rotate(m.rot);
          ctx.scale(m.sx, m.sy);
          ctx.translate(-e.x, -(e.y + e.radius));
          this.renderEnemy(ctx, e);
          ctx.restore();
          }),
      });
    }
    // Milestone 10-A: solide Kristall-Prismen (S2) y-sortiert zwischen Gegnern & Held
    for (const d of getMechanicsDrawables(ctx, this.scene)) drawables.push(d);
    for (const d of this.scene.detached) drawables.push({ y: d.y + 2, draw: () => drawDetached(ctx, d) });
    drawables.push({ y: this.scene.playerY, draw: () => this.renderPlayer(ctx) });
    if (this.scene.activeCompanion) {
      drawables.push({ y: this.scene.companionY, draw: () => this.renderCompanion(ctx) });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Milestone 10-A: Smart-Zielhilfe — pulsierendes Fadenkreuz unter dem anvisierten Ziel
    const aim = this.scene.getAimTarget();
    if (aim) {
      const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 9);
      const rr = aim.r + 5 + pulse * 1.5;
      ctx.save();
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.65 + pulse * 0.3})`;
      ctx.lineWidth = 1.2;
      const k = 3.5;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        ctx.beginPath();
        ctx.moveTo(aim.x + sx * rr, aim.y + sy * (rr - k));
        ctx.lineTo(aim.x + sx * rr, aim.y + sy * rr);
        ctx.lineTo(aim.x + sx * (rr - k), aim.y + sy * rr);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Active Aegis-Bot Halo golden orbital shield ring around hero when charged!
    if (this.scene.activeCompanion === 'halo' && this.scene.haloShieldReady) {
      const hp = 0.5 + 0.5 * Math.sin(this.scene.time * 5.2);
      ctx.save();
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.55 + hp * 0.35})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(this.scene.playerX, this.scene.playerY - 1, 14 + hp * 1.5, 16 + hp * 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      drawGlow(ctx, this.scene.playerX, this.scene.playerY - 1, 20, '#fbbf24', 0.14 + hp * 0.08);
      ctx.restore();
    }

    // Active Boss Sweeping Reactor & Prism Laser Beams (Kern-Wächter, Leviathan & ★ Prisma-Archon!)
    for (const e of this.scene.enemies) {
      if (e.kind === 'boss' && e.bossState === 'laser_sweep') {
        this.renderBossLaserBeam(ctx, e);
      } else if (e.kind === 'boss_leviathan' && (e.bossState === 'lev_twin_windup' || e.bossState === 'lev_twin_beam')) {
        this.renderLeviathanTwinBeams(ctx, e);
      } else if (
        (e.kind === 'boss_prisma_archon' ||
          e.kind === 'boss_vulkan_titan' ||
          e.kind === 'boss_star_archon' ||
          e.kind === 'boss_omega_archon') &&
        (e.bossState === 's2_beam_windup' || e.bossState === 's2_twin_sweep')
      ) {
        this.renderPrismaArchonTwinBeams(ctx, e);
      }
    }

    // Faceted 2.5D Hex-Aegis Kinetic Shield (animates smoothly on deploy & retract!)
    if (this.scene.shieldOpenAnim > 0.02) {
      this.renderKineticShield(ctx);
    } else if (this.scene.shieldOverheatTimer > 0) {
      const pct = Math.max(0, this.scene.shieldOverheatTimer / 1.8);
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(this.scene.playerX, this.scene.playerY + 11, 10, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Hand-Crafted 2.5D Tapered Crescent Weapon Swings, Ionen-Speer Thrusts, Kinetik-Fäuste & Phasen-Diskus!
    for (const s of this.scene.swings) {
      this.renderWeaponSwing(ctx, s);
    }
    for (const tr of this.scene.thrusts) {
      this.renderSpearThrust(ctx, tr);
    }
    this.renderFistBursts(ctx);
    this.renderDiscs(ctx);

    // Crisp X-Slash Impact Flashes on Struck Enemies!
    for (const h of this.scene.slashHits) {
      const t = 1 - h.life / h.maxLife;
      const alpha = Math.max(0, 1 - t);
      const len = 11 + t * 9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle);
      for (const offset of [-0.55, 0.55]) {
        ctx.save();
        ctx.rotate(offset);
        ctx.fillStyle = h.color;
        ctx.globalAlpha = alpha * 0.85;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(0, -2.8 * (1 - t * 0.5));
        ctx.lineTo(len, 0);
        ctx.lineTo(0, 2.8 * (1 - t * 0.5));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(-len * 0.72, 0);
        ctx.lineTo(0, -1.1);
        ctx.lineTo(len * 0.72, 0);
        ctx.lineTo(0, 1.1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Piercing Railgun Beams (Puls-Blaster Secondary!)
    for (const b of this.scene.beams) {
      const alpha = b.life / b.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.55})`;
      ctx.lineWidth = 11 * alpha + 3;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(56, 232, 212, ${alpha})`;
      ctx.lineWidth = 5 * alpha + 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }

    // Shockwave Rings (Hammer Secondary, Blade Finisher & Boss Slam!)
    for (const sw of this.scene.shockwaves) {
      const progress = 1 - sw.life / sw.maxLife;
      const r = 10 + (sw.maxRadius - 10) * progress;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 4 * alpha + 1;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, r, r * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ⚡ Ionen-Kette Lightning Arcs (Milestone 7)
    for (const arc of this.scene.lightningArcs) {
      const a = Math.max(0, arc.life / arc.maxLife);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = arc.color;
      ctx.globalAlpha = a * 0.95;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      const segs = 4;
      for (let k = 1; k < segs; k++) {
        const t = k / segs;
        const mx = arc.x1 + (arc.x2 - arc.x1) * t + (Math.random() - 0.5) * 11;
        const my = arc.y1 + (arc.y2 - arc.y1) * t + (Math.random() - 0.5) * 11;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 🟣 Leeren-Siphon Homing Healing Orbs (Milestone 7)
    for (const o of this.scene.siphonOrbs) {
      drawGlow(ctx, o.x, o.y, 13, '#e879f9', 0.65);
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const fistParts = getHDArt().rigs.core_warden?.parts;
    const krallParts = getHDArt().rigs.krall?.parts;
    for (const p of this.scene.projectiles) {
      if (p.sprite === 'fist' && fistParts?.fist_angled) {
        // M11: abgefeuerte Faust (Kern-Wächter Phase 2) — dieselbe Faust wie im Orbit (gleiche Größe), Schweif hinter, in Flugrichtung gedreht
        const ang = Math.atan2(p.vy, p.vx);
        drawGlow(ctx, p.x, p.y, 13, p.color, 0.6);
        const tr = fistParts.fist_trail;
        const f = fistParts.fist_angled;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        if (tr) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.85;
          ctx.drawImage(tr, -tr.width * 0.5 - 4, -tr.height * 0.25, tr.width * 0.5, tr.height * 0.5);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        ctx.rotate(0.4); // Manschette hinten, Knöchel in Flugrichtung
        ctx.drawImage(f, -f.width * 0.25, -f.height * 0.25, f.width * 0.5, f.height * 0.5);
        ctx.restore();
        continue;
      }
      const scrapImg = p.sprite === 'scrap' ? krallParts?.[['scrap_a', 'scrap_b', 'scrap_c'][(p.scrapVariant ?? 0) % 3]] : undefined;
      if (scrapImg) {
        // M11: Schrottklumpen (Krall) — trudelt in Flugrichtung, Größe aus der Hitbox
        const sz = p.radius * 2.8;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.scene.time * 9 + (p.scrapVariant ?? 0) * 2.1);
        ctx.drawImage(scrapImg, -sz / 2, -sz / 2, sz, sz * (scrapImg.height / scrapImg.width));
        ctx.restore();
        continue;
      }
      drawGlow(ctx, p.x, p.y, 12, p.color, 0.55);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    for (const p of this.scene.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.font = 'bold 6.5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    for (const f of this.scene.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.4));
      ctx.fillStyle = '#0e131f';
      ctx.fillText(f.text, f.x + 0.8, f.y + 0.8);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (input.isMouseActive() && !input.locked) {
      const m = input.getMousePos();
      ctx.strokeStyle = 'rgba(56, 232, 212, 0.8)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(m.x - 3.5, m.y - 3.5, 7, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(m.x - 0.5, m.y - 0.5, 1, 1);
    }

    ctx.restore();

    this.renderMinimap(ctx);
    this.renderBossBar(ctx);

    if (this.scene.activePrompt) {
      this.renderPrompt(ctx, this.scene.activePrompt.label, this.scene.activePrompt.x, this.scene.activePrompt.y);
    }

    if (this.scene.roomFade > 0) {
      ctx.fillStyle = `rgba(10, 14, 24, ${Math.min(1, this.scene.roomFade / 0.22)})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
  }

  /**
   * Draws a razor-sharp 2.5D tapered polygon crescent ribbon (Moonlighter / Hyper Light Drifter feel)
   * that starts needle-thin at tailAngle and swells smoothly into a cutting blade head at headAngle.
   */
  private drawTaperedCrescent(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    baseRadius: number,
    tailAngle: number,
    headAngle: number,
    maxThickness: number,
    squashY: number,
    fillStyle: string,
  ): void {
    const segs = 22;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    // Outer cutting edge (tail -> head)
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const a = tailAngle + (headAngle - tailAngle) * u;
      const taper = Math.sin(Math.pow(u, 0.68) * Math.PI);
      const rOut = baseRadius + taper * maxThickness * 0.55;
      const px = cx + Math.cos(a) * rOut;
      const py = cy + Math.sin(a) * rOut * squashY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    // Inner trailing edge (head -> tail)
    for (let i = segs; i >= 0; i--) {
      const u = i / segs;
      const a = tailAngle + (headAngle - tailAngle) * u;
      const taper = Math.sin(Math.pow(u, 0.85) * Math.PI);
      const rIn = Math.max(4, baseRadius - taper * maxThickness * 0.72);
      const px = cx + Math.cos(a) * rIn;
      const py = cy + Math.sin(a) * rIn * squashY;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  private renderWeaponSwing(ctx: CanvasRenderingContext2D, s: WeaponSwing): void {
    const art = getHDArt();
    const t = 1 - s.life / s.maxLife; // 0 -> 1 over swing
    const alpha = Math.max(0, 1 - Math.pow(t, 1.45));
    // Ultra-snappy whip-out curve: fast slice across front, crisp hang at follow-through!
    const eased = 1 - Math.pow(1 - t, 3.6);

    const startA = s.dir === 1 ? s.angle - s.sweep / 2 : s.angle + s.sweep / 2;
    const endA = s.dir === 1 ? s.angle + s.sweep / 2 : s.angle - s.sweep / 2;
    const curA = startA + (endA - startA) * eased;
    const trailFrac = Math.max(0, eased - (s.comboStep === 2 ? 0.85 : 0.78));
    const tailA = startA + (endA - startA) * trailFrac;

    const isHammer = s.weapon === 'hammer';
    const isBackhand = s.weapon === 'blade' && s.comboStep === 1;
    const isFinisher = s.weapon === 'blade' && s.comboStep === 2;
    const cx = this.scene.playerX;
    const cy = this.scene.playerY - 2;
    const squashY = 0.84;

    const outerGlow = isHammer
      ? `rgba(234, 88, 12, ${alpha * 0.52})`
      : isFinisher
        ? `rgba(245, 158, 11, ${alpha * 0.56})`
        : isBackhand
          ? `rgba(56, 189, 248, ${alpha * 0.52})`
          : `rgba(13, 148, 136, ${alpha * 0.55})`;

    const midCore = isHammer
      ? `rgba(251, 146, 60, ${alpha * 0.92})`
      : isFinisher
        ? `rgba(253, 224, 71, ${alpha * 0.95})`
        : isBackhand
          ? `rgba(103, 232, 249, ${alpha * 0.92})`
          : `rgba(56, 232, 212, ${alpha * 0.94})`;

    const edgeWhite = `rgba(255, 255, 255, ${alpha * 0.96})`;

    // 1. Multi-layered 2.5D Tapered Energy Crescent Ribbon!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Wide outer atmospheric energy plume
    this.drawTaperedCrescent(
      ctx,
      cx,
      cy,
      s.radius * 0.82,
      tailA,
      curA,
      isHammer ? 19 : isFinisher ? 17 : 14,
      squashY,
      outerGlow,
    );

    // Rich primary razor crescent
    this.drawTaperedCrescent(
      ctx,
      cx,
      cy,
      s.radius * 0.88,
      tailA + (curA - tailA) * 0.08,
      curA,
      isHammer ? 12 : isFinisher ? 11 : 9,
      squashY,
      midCore,
    );

    // Twin inner plasma streak on Combo 3 Finisher or Backhand!
    if (isFinisher || isBackhand) {
      this.drawTaperedCrescent(
        ctx,
        cx,
        cy,
        s.radius * 0.62,
        tailA + (curA - tailA) * 0.14,
        curA,
        isFinisher ? 6.5 : 4.2,
        squashY,
        isFinisher ? `rgba(56, 232, 212, ${alpha * 0.85})` : `rgba(167, 243, 208, ${alpha * 0.65})`,
      );
    }

    // Razor white-hot leading cutting edge
    this.drawTaperedCrescent(
      ctx,
      cx,
      cy,
      s.radius * 0.96,
      tailA + (curA - tailA) * 0.28,
      curA,
      isHammer ? 4.2 : 3.2,
      squashY,
      edgeWhite,
    );

    // Crisp kinetic speed-line arc slicing inside the ribbon
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const a = tailA + (curA - tailA) * (0.2 + u * 0.78);
      const rLine = s.radius * 0.74;
      const px = cx + Math.cos(a) * rLine;
      const py = cy + Math.sin(a) * rLine * squashY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // 2. 3-Frame Motion-Blur Ghost Trail + Solid HD Weapon Sprite sweeping around hero's hand!
    const wepSpr = isHammer ? art.weapons.hammer : art.weapons.blade;
    if (wepSpr) {
      const baseSize = isHammer ? 30 : isFinisher ? 28 : 25;
      const swingReach = isHammer ? 10 : 8;
      const velScale = 1 + Math.sin(t * Math.PI) * 0.14;

      // 3 fading motion-blur afterimages trailing behind the active blade!
      for (let g = 3; g >= 1; g--) {
        const gFrac = Math.max(0, eased - g * 0.11);
        const gA = startA + (endA - startA) * gFrac;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * (0.42 - g * 0.1);
        ctx.translate(cx + Math.cos(gA) * swingReach, cy + Math.sin(gA) * swingReach * squashY);
        ctx.rotate(gA + Math.PI / 4);
        ctx.drawImage(wepSpr, -baseSize * 0.18, -baseSize * 0.92, baseSize, baseSize);
        ctx.restore();
      }

      // Main crisp weapon sprite at current blade head
      ctx.save();
      ctx.translate(cx + Math.cos(curA) * swingReach, cy + Math.sin(curA) * swingReach * squashY);
      ctx.rotate(curA + Math.PI / 4);
      ctx.scale(velScale, velScale);
      ctx.drawImage(wepSpr, -baseSize * 0.18, -baseSize * 0.92, baseSize, baseSize);
      ctx.restore();

      // Gleaming 4-point pixel star-glint right at the plasma blade tip!
      if (t < 0.72) {
        const tipX = cx + Math.cos(curA) * (s.radius * 0.96);
        const tipY = cy + Math.sin(curA) * (s.radius * 0.96) * squashY;
        const glint = (1 - t / 0.72) * (isFinisher ? 9 : 6.5);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tipX - glint, tipY - 0.8, glint * 2, 1.6);
        ctx.fillRect(tipX - 0.8, tipY - glint, 1.6, glint * 2);
        drawGlow(ctx, tipX, tipY, 14, isHammer ? '#fb923c' : isFinisher ? '#fde047' : '#38e8d4', alpha * 0.75);
        ctx.restore();
      }
    }
  }

  private renderKineticShield(ctx: CanvasRenderingContext2D): void {
    const open = this.scene.shieldOpenAnim;
    // Elastic snap-open spring curve
    const spring = open < 1 ? open * (1 + Math.sin(open * Math.PI) * 0.14) : 1;
    const halfSpan = Math.PI * 0.46 * Math.min(1.06, spring);
    if (halfSpan < 0.05) return;

    const cx = this.scene.playerX;
    const cy = this.scene.playerY - 2;
    const squashY = 0.86;
    const baseR = 17.5 - this.scene.shieldRecoil * 2.8;
    const innerR = baseR - 5.2;
    const outerR = baseR + 2.4;
    const panels = 6;
    const startA = this.scene.shieldAngle - halfSpan;
    const endA = this.scene.shieldAngle + halfSpan;

    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 11);
    const perfectWindow = this.scene.shieldActive && this.scene.shieldHoldTime <= 0.24;
    const energyPct = Math.max(0, Math.min(1, this.scene.state.energy / 100));
    const lowEnergy = energyPct < 0.28;
    const warnFlicker = lowEnergy ? 0.55 + 0.45 * Math.sin(this.scene.time * 38) : 1;
    const flash = Math.max(this.scene.shieldHitFlash, perfectWindow ? 0.55 : 0);
    const alpha = Math.min(1, open * 1.15) * warnFlicker;

    const pt = (r: number, a: number) => ({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r * squashY,
    });

    const emitter = pt(6.5, this.scene.shieldAngle);
    const leftTip = pt(baseR, startA);
    const rightTip = pt(baseR, endA);
    const frontMid = pt(outerR + 0.8, this.scene.shieldAngle);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Holographic projector beams shooting from hero's wrist emitter to shield wings!
    ctx.strokeStyle =
      flash > 0.4
        ? `rgba(253, 224, 71, ${alpha * 0.45})`
        : lowEnergy
          ? `rgba(251, 113, 133, ${alpha * 0.48})`
          : `rgba(56, 232, 212, ${alpha * 0.36})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(emitter.x, emitter.y);
    ctx.lineTo(leftTip.x, leftTip.y);
    ctx.moveTo(emitter.x, emitter.y);
    ctx.lineTo(rightTip.x, rightTip.y);
    ctx.stroke();

    // 2. Translucent 6-Panel Faceted 2.5D Hex-Aegis Field Fill!
    ctx.beginPath();
    for (let i = 0; i <= panels; i++) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(outerR, a);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let i = panels; i >= 0; i--) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(innerR, a);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle =
      flash > 0.35
        ? `rgba(253, 224, 71, ${alpha * (0.28 + flash * 0.34)})`
        : lowEnergy
          ? `rgba(244, 63, 94, ${alpha * (0.26 + pulse * 0.16)})`
          : `rgba(20, 184, 166, ${alpha * (0.24 + pulse * 0.1)})`;
    ctx.fill();

    // 3. Illuminated Sci-Fi Honeycomb / Facet Grid Struts + Traveling Scanline!
    const scanIdx = ((this.scene.time * 4.2) % (panels + 1)) - 0.5;
    for (let i = 0; i < panels; i++) {
      const a0 = startA + (endA - startA) * (i / panels);
      const a1 = startA + (endA - startA) * ((i + 1) / panels);
      const am = (a0 + a1) * 0.5;
      const scanBoost = Math.max(0, 1 - Math.abs(i - scanIdx) * 0.85);

      const o0 = pt(outerR, a0);
      const o1 = pt(outerR, a1);
      const i0 = pt(innerR, a0);
      const i1 = pt(innerR, a1);
      const midIn = pt((innerR + outerR) * 0.5, am);

      // Highlight individual scanned facet subtly
      if (scanBoost > 0.15) {
        ctx.fillStyle = lowEnergy
          ? `rgba(253, 186, 116, ${alpha * scanBoost * 0.3})`
          : `rgba(165, 243, 252, ${alpha * scanBoost * 0.28})`;
        ctx.beginPath();
        ctx.moveTo(o0.x, o0.y);
        ctx.lineTo(o1.x, o1.y);
        ctx.lineTo(i1.x, i1.y);
        ctx.lineTo(i0.x, i0.y);
        ctx.closePath();
        ctx.fill();
      }

      // Crisp honeycomb diagonal struts inside each energy panel
      ctx.strokeStyle =
        flash > 0.45
          ? `rgba(255, 251, 235, ${alpha * 0.8})`
          : lowEnergy
            ? `rgba(251, 146, 60, ${alpha * (0.55 + scanBoost * 0.4)})`
            : `rgba(103, 232, 249, ${alpha * (0.42 + scanBoost * 0.45)})`;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(i0.x, i0.y);
      ctx.lineTo(o0.x, o0.y);
      ctx.moveTo(i0.x, i0.y);
      ctx.lineTo(midIn.x, midIn.y);
      ctx.lineTo(o1.x, o1.y);
      ctx.stroke();
    }

    // 4. Outer Razor Facet Frame (Teal / Warning Coral Halo + Incandescent Core Edge)
    ctx.strokeStyle =
      flash > 0.4
        ? `rgba(253, 224, 71, ${alpha * 0.92})`
        : lowEnergy
          ? `rgba(251, 113, 133, ${alpha * 0.95})`
          : `rgba(56, 232, 212, ${alpha * (0.85 + pulse * 0.15)})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i <= panels; i++) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(outerR, a);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Inner subtle boundary rail + live diegetic shield-energy meter arc!
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= panels; i++) {
      const a = startA + (endA - startA) * (i / panels);
      const p = pt(innerR, a);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    const meterSpan = halfSpan * energyPct;
    ctx.strokeStyle =
      energyPct < 0.28 ? '#fb7185' : energyPct < 0.55 ? '#fbbf24' : '#38e8d4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const meterSegs = 10;
    for (let i = 0; i <= meterSegs; i++) {
      const a = this.scene.shieldAngle - meterSpan + meterSpan * 2 * (i / meterSegs);
      const p = pt(innerR, a);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // 5. Expanding Energy Impact Ripple Wave on Block / Deploy!
    if (this.scene.shieldRipple > 0.04) {
      const rp = pt(baseR, this.scene.shieldRippleAngle);
      const rWave = (1 - this.scene.shieldRipple) * 16 + 3;
      ctx.strokeStyle =
        this.scene.shieldHitFlash > 0.2
          ? `rgba(253, 224, 71, ${this.scene.shieldRipple})`
          : `rgba(165, 243, 252, ${this.scene.shieldRipple * 0.9})`;
      ctx.lineWidth = 1.8 * this.scene.shieldRipple + 0.6;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rWave, rWave * 0.72, this.scene.shieldAngle + Math.PI / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 6. Dual Wing Emitter Nodes & Central Aegis Diamond!
    const nodeColor = flash > 0.4 ? '#fde047' : lowEnergy ? '#fb7185' : '#38e8d4';
    for (const tip of [leftTip, rightTip]) {
      ctx.fillStyle = nodeColor;
      ctx.fillRect(tip.x - 1.8, tip.y - 1.8, 3.6, 3.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tip.x - 0.8, tip.y - 0.8, 1.6, 1.6);
    }

    // Central Aegis core emblem at front center of barrier
    ctx.fillStyle = nodeColor;
    ctx.beginPath();
    ctx.moveTo(frontMid.x, frontMid.y - 3.2);
    ctx.lineTo(frontMid.x + 2.8, frontMid.y);
    ctx.lineTo(frontMid.x, frontMid.y + 3.2);
    ctx.lineTo(frontMid.x - 2.8, frontMid.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(frontMid.x - 1, frontMid.y - 1, 2, 2);

    // Soft ambient shield glow
    drawGlow(ctx, frontMid.x, frontMid.y, 19, nodeColor, alpha * (0.34 + flash * 0.25));
    ctx.restore();
  }

  private renderDoors(ctx: CanvasRenderingContext2D): void {
    const locked = !this.scene.currentRoom.cleared;
    const doors = this.scene.currentRoom.doors;
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 5);

    const drawH = (x: number, y: number) => {
      if (locked) {
        ctx.fillStyle = 'rgba(42, 12, 22, 0.85)';
        ctx.fillRect(x - 16, y - 5, 32, 10);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(x - 15, y - 3, 30, 2);
        ctx.fillRect(x - 15, y + 1, 30, 2);
        ctx.fillStyle = '#fff1f2';
        ctx.fillRect(x - 14, y - 2.5, 28, 0.8);
        ctx.fillRect(x - 14, y + 1.5, 28, 0.8);
        drawGlow(ctx, x, y, 26, '#fb7185', 0.42);
      } else {
        ctx.fillStyle = 'rgba(8, 30, 42, 0.85)';
        ctx.fillRect(x - 15, y - 5, 30, 10);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(x - 13, y - 1.5, 26, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 10, y - 0.5, 20, 1);
        drawGlow(ctx, x, y, 24 + pulse * 4, '#38e8d4', 0.36);
      }
    };

    const drawV = (x: number, y: number) => {
      if (locked) {
        ctx.fillStyle = 'rgba(42, 12, 22, 0.85)';
        ctx.fillRect(x - 5, y - 18, 10, 36);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(x - 3, y - 16, 2, 32);
        ctx.fillRect(x + 1, y - 16, 2, 32);
        ctx.fillStyle = '#fff1f2';
        ctx.fillRect(x - 2.5, y - 15, 0.8, 30);
        ctx.fillRect(x + 1.5, y - 15, 0.8, 30);
        drawGlow(ctx, x, y, 26, '#fb7185', 0.42);
      } else {
        ctx.fillStyle = 'rgba(8, 30, 42, 0.85)';
        ctx.fillRect(x - 5, y - 16, 10, 32);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(x - 1.5, y - 14, 3, 28);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 0.5, y - 11, 1, 22);
        drawGlow(ctx, x, y, 24 + pulse * 4, '#38e8d4', 0.36);
      }
    };

    if (doors.north) drawH(ROOM_CENTER_X, ROOM_TOP - 6);
    if (doors.south) drawH(ROOM_CENTER_X, ROOM_BOTTOM + 10);
    if (doors.west) drawV(ROOM_LEFT - 10, ROOM_CENTER_Y);
    if (doors.east) drawV(ROOM_RIGHT + 10, ROOM_CENTER_Y);
  }

  private renderWarpPad(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 5);
    ctx.fillStyle = 'rgba(18, 26, 40, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 12 + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3 + pulse * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawGlow(ctx, x, y, 32, color, 0.4);
  }

  private renderSecretVaultOverlay(ctx: CanvasRenderingContext2D): void {
    const isS2 = this.scene.currentSector === 2;
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 3.4);
    const accent = isS2 ? '#e879f9' : '#fde047';

    // Moody subterranean chamber vignette
    ctx.save();
    ctx.fillStyle = isS2 ? 'rgba(10, 4, 24, 0.34)' : 'rgba(6, 10, 22, 0.36)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Etched ancient floor sanctuary rune circle around the Secret Treasure Chest
    const cx = ROOM_CENTER_X;
    const cy = ROOM_CENTER_Y - 12;
    ctx.strokeStyle = isS2
      ? `rgba(232, 121, 249, ${0.32 + pulse * 0.18})`
      : `rgba(253, 224, 71, ${0.32 + pulse * 0.18})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 42, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 32, 21, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawGlow(ctx, cx, cy, 52, accent, 0.22 + pulse * 0.08);

    // Glowing Grav-Rope Return Pad & focused escape light shaft (cleanly below the chest!)
    const rx = ROOM_CENTER_X;
    const ry = ROOM_BOTTOM - 28;
    this.renderWarpPad(ctx, rx, ry, '#38e8d4');
    const shaftTop = ry - 36;
    const shaftGrad = ctx.createLinearGradient(rx, ry, rx, shaftTop);
    shaftGrad.addColorStop(0, 'rgba(56, 232, 212, 0.34)');
    shaftGrad.addColorStop(0.65, 'rgba(56, 232, 212, 0.14)');
    shaftGrad.addColorStop(1, 'rgba(56, 232, 212, 0)');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(rx - 7, shaftTop, 14, ry - shaftTop);

    // Shimmering Grav-Rope tether rising cleanly into the escape beam
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.88)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx, shaftTop + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 4.8px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#67e8f9';
    ctx.fillText('▲ GRAV-SEIL', rx, ry + 20);
    ctx.fillStyle = accent;
    ctx.fillText('★ GEHEIME SCHATZKAMMER', cx, ROOM_TOP + 14);
    ctx.restore();
  }

  private renderChasms(ctx: CanvasRenderingContext2D): void {
    const isS2 = this.scene.currentSector === 2;
    const isS3 = this.scene.currentSector === 3;
    const isS4 = this.scene.currentSector >= 4;
    for (let idx = 0; idx < this.scene.currentRoom.chasms.length; idx++) {
      const ch = this.scene.currentRoom.chasms[idx];
      const { x, y, w, h } = ch;
      const cliffH = Math.min(12, Math.max(7, Math.floor(h * 0.34)));

      ctx.save();
      // 1. Integrated beveled floor rim matching sector architecture
      ctx.fillStyle = isS4 ? '#080e18' : isS3 ? '#1f0c08' : isS2 ? '#120b24' : '#0f1624';
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = isS4 ? '#2c3d52' : isS3 ? '#5c2c1c' : isS2 ? '#3d2c6e' : '#3d4f69';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = isS4 ? '#162233' : isS3 ? '#331710' : isS2 ? '#231845' : '#1f2a3d';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

      // Subtle rim highlight along bottom & right lip catching overhead room light
      ctx.fillStyle = isS4 ? '#d4af37' : isS3 ? '#c2410c' : isS2 ? '#6d4db5' : '#617999';
      ctx.fillRect(x - 1, y + h + 1, w + 2, 1);
      ctx.fillRect(x + w + 1, y - 1, 1, h + 2);

      // Corner inlays themed per sector
      if (isS4) {
        ctx.fillStyle = '#fde047';
        ctx.fillRect(x - 2, y - 2, 3, 2);
        ctx.fillRect(x + w - 1, y + h, 3, 2);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(x + w - 1, y - 2, 3, 2);
        ctx.fillRect(x - 2, y + h, 3, 2);
      } else if (isS3) {
        ctx.fillStyle = '#f97316';
        ctx.fillRect(x - 2, y - 2, 4, 2);
        ctx.fillRect(x + w - 2, y - 2, 4, 2);
        ctx.fillRect(x - 2, y + h, 4, 2);
        ctx.fillRect(x + w - 2, y + h, 4, 2);
      } else if (isS2) {
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(x - 2, y - 2, 3, 2);
        ctx.fillRect(x + w - 1, y + h, 3, 2);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(x + w - 1, y - 2, 3, 2);
        ctx.fillRect(x - 2, y + h, 3, 2);
      } else {
        ctx.fillStyle = '#d97706';
        ctx.fillRect(x - 2, y - 2, 4, 2);
        ctx.fillRect(x + w - 2, y - 2, 4, 2);
        ctx.fillRect(x - 2, y + h, 4, 2);
        ctx.fillRect(x + w - 2, y + h, 4, 2);
      }

      // 2. Deep abyssal / molten void interior
      ctx.fillStyle = isS4 ? '#040812' : isS3 ? '#1a0604' : isS2 ? '#070314' : '#050812';
      ctx.fillRect(x, y, w, h);

      // Sector 3 deep molten lava shimmer at the bottom of the foundry pit!
      if (isS3) {
        const lavaPulse = 0.25 + 0.14 * Math.sin(this.scene.time * 2.4 + idx);
        const lavaGrad = ctx.createLinearGradient(x, y + cliffH, x, y + h);
        lavaGrad.addColorStop(0, 'rgba(234, 88, 12, 0.08)');
        lavaGrad.addColorStop(1, `rgba(249, 115, 22, ${lavaPulse})`);
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(x, y + cliffH, w, Math.max(2, h - cliffH));
      }

      // 3. 3D North Vertical Cliff Face
      const cliffGrad = ctx.createLinearGradient(x, y, x, y + cliffH);
      if (isS4) {
        cliffGrad.addColorStop(0, '#1e2c40');
        cliffGrad.addColorStop(0.6, '#0d1522');
        cliffGrad.addColorStop(1, '#040812');
      } else if (isS3) {
        cliffGrad.addColorStop(0, '#472116');
        cliffGrad.addColorStop(0.6, '#260f09');
        cliffGrad.addColorStop(1, '#1a0604');
      } else if (isS2) {
        cliffGrad.addColorStop(0, '#27194f');
        cliffGrad.addColorStop(0.6, '#140c2e');
        cliffGrad.addColorStop(1, '#070314');
      } else {
        cliffGrad.addColorStop(0, '#232f42');
        cliffGrad.addColorStop(0.6, '#121a28');
        cliffGrad.addColorStop(1, '#050812');
      }
      ctx.fillStyle = cliffGrad;
      ctx.fillRect(x, y, w, cliffH);

      ctx.fillStyle = isS4
        ? 'rgba(18, 28, 42, 0.72)'
        : isS3
          ? 'rgba(54, 22, 14, 0.72)'
          : isS2
            ? 'rgba(34, 21, 68, 0.72)'
            : 'rgba(24, 34, 52, 0.72)';
      ctx.fillRect(x, y, 3, h);
      ctx.fillRect(x + w - 3, y, 3, h);

      for (let fx = x + 10; fx < x + w - 10; fx += 20) {
        const notchW = 4 + ((fx + idx * 3) % 4);
        ctx.fillStyle = isS4 ? '#223348' : isS3 ? '#4c2317' : isS2 ? '#362663' : '#35465e';
        ctx.fillRect(fx, y - 1, notchW, 2);
        ctx.fillStyle = isS4 ? '#354c68' : isS3 ? '#7c341d' : isS2 ? '#4c3685' : '#4a5f7d';
        ctx.fillRect(fx + 5, y + h - 1, notchW - 1, 2);
      }

      if (isS4) {
        // Golden celestial glyph pillars along the obsidian cliff wall
        for (let sx = x + 8; sx < x + w - 6; sx += 16) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(sx, y, 3, cliffH - 1);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(sx + 1, y + 1, 1, Math.max(2, cliffH - 3));
        }
      } else if (isS3) {
        // Molten glowing furnace vents along the slag shaft
        for (let sx = x + 8; sx < x + w - 6; sx += 16) {
          ctx.fillStyle = '#3f1d14';
          ctx.fillRect(sx, y, 3, cliffH - 1);
          ctx.fillStyle = '#f97316';
          ctx.fillRect(sx + 1, y + 2, 1, Math.max(2, cliffH - 4));
        }
      } else if (isS2) {
        for (let sx = x + 6; sx < x + w - 6; sx += 14) {
          const stH = 4 + ((sx * 7 + idx * 5) % 6);
          ctx.fillStyle = (sx + idx) % 2 === 0 ? '#5b21b6' : '#0e7490';
          ctx.fillRect(sx, y, 3, stH);
          ctx.fillStyle = (sx + idx) % 2 === 0 ? '#c084fc' : '#38e8d4';
          ctx.fillRect(sx + 1, y, 1, Math.max(2, stH - 2));
        }
      } else {
        for (let sx = x + 8; sx < x + w - 6; sx += 16) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(sx, y, 3, cliffH - 1);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(sx + 1, y + 2, 1, cliffH - 3);
        }
        ctx.fillStyle = '#1e3a4c';
        ctx.fillRect(x + 2, y + 3, w - 4, 2);
      }

      // Faint deep-space stars / glowing embers far below
      const starCount = Math.max(2, Math.floor((w * h) / 720));
      for (let s = 0; s < starCount; s++) {
        const seed = (idx + 1) * 97 + s * 53 + this.scene.currentRoom.tileSeed;
        const px = x + 5 + (seed % Math.max(4, w - 10));
        const py = y + cliffH + 2 + ((seed * 3) % Math.max(4, h - cliffH - 5));
        const a = 0.14 + 0.18 * Math.sin(this.scene.time * 1.8 + s * 2.1 + idx);
        ctx.fillStyle = isS4
          ? `rgba(253, 224, 71, ${Math.max(0.05, a)})`
          : isS3
            ? `rgba(251, 146, 60, ${Math.max(0.08, a * 1.4)})`
            : isS2
              ? `rgba(192, 132, 252, ${Math.max(0.04, a)})`
              : `rgba(148, 163, 184, ${Math.max(0.04, a)})`;
        ctx.fillRect(px, py, 1, 1);
      }

      // 4. MOONLIGHTER SECRET SPARKLING PIT TELL!
      if (ch.secret) {
        const cx = x + w * 0.5;
        const cy = y + cliffH + (h - cliffH) * 0.55;
        if (ch.secretVisited) {
          const p = 0.35 + 0.25 * Math.sin(this.scene.time * 3.2);
          ctx.strokeStyle = `rgba(253, 224, 71, ${p})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 4);
          ctx.lineTo(cx + 4, cy);
          ctx.lineTo(cx, cy + 4);
          ctx.lineTo(cx - 4, cy);
          ctx.closePath();
          ctx.stroke();
        } else {
          const cycle = (this.scene.time + idx * 0.7) % 3.4;
          if (cycle < 0.72) {
            const flash = Math.sin((cycle / 0.72) * Math.PI);
            const alpha = flash * 0.56;
            const ox = Math.sin(Math.floor(this.scene.time / 3.4) * 1.9) * Math.min(10, w * 0.18);
            const sx = cx + ox;
            const sy = cy;
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
            ctx.fillRect(sx - 2.5, sy - 0.5, 5, 1);
            ctx.fillRect(sx - 0.5, sy - 2.5, 1, 5);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.1})`;
            ctx.fillRect(sx - 0.7, sy - 0.7, 1.4, 1.4);
            drawGlow(ctx, sx, sy, 9, '#fde047', alpha * 0.28);
          }
        }
      }
      ctx.restore();
    }
  }

  private renderObstacle(ctx: CanvasRenderingContext2D, ob: DungeonRoom['obstacles'][number]): void {
    const atlas = getAtlas();
    const isS2 = this.scene.currentSector === 2;
    const isS3 = this.scene.currentSector === 3;
    const isS4 = this.scene.currentSector >= 4;
    const { x, y, w, h } = ob;

    if (ob.kind === 'crate') {
      drawPixelShadow(ctx, x + w / 2, y + h + 1, w / 2, 3, 0.42);
      ctx.drawImage(atlas.props.crate, x, y, w, h);
      return;
    }

    if (ob.kind === 'forge_pillar') {
      // Sector 3 Heavy Cast-Iron & Glowing Magma Foundry Pillar!
      ctx.fillStyle = 'rgba(12, 4, 2, 0.78)';
      ctx.fillRect(x - 2, y + 3, w + 4, h + 1);
      ctx.fillStyle = '#29120c';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#472116';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 4);
      ctx.fillStyle = '#6e3421';
      ctx.fillRect(x + 2, y + 1, w - 4, 4);
      // Molten magma core slit
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x + 4, y + Math.floor(h / 2) - 2, w - 8, 4);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + 6, y + Math.floor(h / 2) - 1, w - 12, 2);
      drawGlow(ctx, x + w / 2, y + h / 2, 18, '#f97316', 0.28);
      return;
    }

    if (ob.kind === 'monolith_obelisk') {
      // Sector 4/5 Gilded Obsidian Celestial Obelisk with glowing cyan-gold Elder Rune!
      ctx.fillStyle = 'rgba(4, 8, 18, 0.8)';
      ctx.fillRect(x - 2, y + 3, w + 4, h + 1);
      ctx.fillStyle = '#0e1726';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#1b2a40';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 4);
      // Gold trim bevel
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(x + 1, y + 1, w - 2, 2);
      ctx.fillRect(x + 1, y + h - 5, w - 2, 1.5);
      // Glowing cyan celestial rune diamond
      const cx = x + w / 2;
      const cy = y + h / 2 - 1;
      ctx.fillStyle = '#38e8d4';
      ctx.fillRect(cx - 2.5, cy - 1, 5, 2);
      ctx.fillRect(cx - 1, cy - 2.5, 2, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 0.8, cy - 0.8, 1.6, 1.6);
      drawGlow(ctx, cx, cy, 18, '#38e8d4', 0.26);
      return;
    }

    if (ob.kind === 'crystal_spire' || (isS2 && ob.kind === 'pillar')) {
      const cx = Math.round(x + w * 0.5);
      const by = Math.round(y + h);
      drawPixelShadow(ctx, cx, by - 1, w * 0.56, 4.5, 0.56);

      ctx.fillStyle = '#120a26';
      ctx.fillRect(cx - 11, by - 9, 22, 8);
      ctx.fillRect(cx - 9, by - 11, 18, 11);
      ctx.fillStyle = '#261a4a';
      ctx.fillRect(cx - 10, by - 8, 20, 6);
      ctx.fillRect(cx - 8, by - 10, 16, 8);
      ctx.fillStyle = '#3a296e';
      ctx.fillRect(cx - 8, by - 9, 14, 3);

      const drawPixelCrystal = (
        px: number,
        baseY: number,
        cw: number,
        ch: number,
        dark: string,
        mid: string,
        bright: string,
      ) => {
        const half = Math.floor(cw / 2);
        ctx.fillStyle = '#120a26';
        ctx.fillRect(px - half - 1, baseY - ch + 3, cw + 2, ch - 2);
        ctx.fillRect(px - Math.max(1, half - 1) - 1, baseY - ch + 1, Math.max(2, cw - 2) + 2, 3);
        ctx.fillRect(px - 1, baseY - ch - 1, 2, 3);
        ctx.fillStyle = dark;
        ctx.fillRect(px - half, baseY - ch + 3, cw, ch - 3);
        ctx.fillRect(px - Math.max(1, half - 1), baseY - ch + 1, Math.max(2, cw - 2), 3);
        ctx.fillStyle = mid;
        ctx.fillRect(px - half, baseY - ch + 3, Math.max(1, half), ch - 4);
        ctx.fillRect(px - Math.max(1, half - 1), baseY - ch + 1, Math.max(1, half - 1), 2);
        ctx.fillStyle = bright;
        ctx.fillRect(px - Math.max(0, half - 1), baseY - ch + 2, 1, Math.max(3, ch - 6));
        ctx.fillRect(px, baseY - ch, 1, 2);
      };

      drawPixelCrystal(cx - 6, by - 6, 6, 13, '#0e7490', '#22d3ee', '#cffafe');
      drawPixelCrystal(cx + 6, by - 6, 6, 11, '#6b21a8', '#a855f7', '#e9d5ff');
      drawPixelCrystal(cx, by - 6, 8, 19, '#581c87', '#c084fc', '#fae8ff');

      ctx.fillStyle = '#38e8d4';
      ctx.fillRect(cx - 5, by - 4, 3, 1);
      ctx.fillStyle = '#e879f9';
      ctx.fillRect(cx + 2, by - 3, 3, 1);
      drawGlow(ctx, cx, by - 12, 20, '#c084fc', 0.24);
      return;
    }

    // Grounded recessed floor contact shadow & architectural flange
    ctx.fillStyle = 'rgba(6, 9, 18, 0.74)';
    ctx.fillRect(x - 2, y + 3, w + 4, h + 1);

    ctx.fillStyle = isS4 ? '#101b2b' : isS3 ? '#2e140d' : isS2 ? '#1a1233' : '#182233';
    ctx.fillRect(x - 1, y + h - 4, w + 2, 5);
    ctx.fillStyle = isS4 ? '#1d2d44' : isS3 ? '#421e14' : isS2 ? '#251a4a' : '#253247';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = isS4 ? '#2d4363' : isS3 ? '#5e2c1d' : isS2 ? '#3c2c70' : '#3c4e69';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 5);
    ctx.fillStyle = isS4 ? '#ca8a04' : isS3 ? '#9a3412' : isS2 ? '#59429e' : '#586f8f';
    ctx.fillRect(x + 2, y + 1, w - 4, 4);
    ctx.fillStyle = isS4 ? '#fde047' : isS3 ? '#fb923c' : isS2 ? '#8064c9' : '#7b95b8';
    ctx.fillRect(x + 3, y + 2, w - 6, 1.2);
    ctx.fillStyle = isS4 ? '#fde047' : isS3 ? '#fdba74' : isS2 ? '#a78bfa' : '#94a3b8';
    ctx.fillRect(x + 3, y + 3, 1.5, 1.5);
    ctx.fillRect(x + w - 4.5, y + 3, 1.5, 1.5);
    ctx.fillRect(x + 3, y + h - 7, 1.5, 1.5);
    ctx.fillRect(x + w - 4.5, y + h - 7, 1.5, 1.5);

    if (ob.kind === 'conduit') {
      const glowCol = isS4 ? '#fde047' : isS3 ? '#f97316' : isS2 ? '#e879f9' : '#38e8d4';
      ctx.fillStyle = isS4 ? '#0f172a' : isS3 ? '#290d06' : isS2 ? '#1b0d30' : '#0d2536';
      ctx.fillRect(x + 4, y + Math.floor(h / 2) - 4, w - 8, 8);
      ctx.fillStyle = glowCol;
      ctx.fillRect(x + 6, y + Math.floor(h / 2) - 2, w - 12, 3.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8, y + Math.floor(h / 2) - 1, w - 16, 1.2);
      drawGlow(ctx, x + w / 2, y + h / 2, 24, glowCol, 0.34);
    } else if (ob.kind === 'bulkhead_wall') {
      // Integrated starship deck barrier with recessed ventilation louver & amber caution stripe!
      ctx.fillStyle = '#1d283a';
      ctx.fillRect(x + 4, y + 7, w - 8, h - 13);
      ctx.fillStyle = '#2d3c54';
      for (let vy = y + 8; vy < y + h - 7; vy += 3) {
        ctx.fillRect(x + 5, vy, w - 10, 1.2);
      }
      ctx.fillStyle = '#d97706';
      ctx.fillRect(x + 2, y + h - 5, 5, 1.5);
      ctx.fillRect(x + w - 7, y + h - 5, 5, 1.5);
    } else {
      ctx.fillStyle = isS2 ? '#291c52' : '#2b394f';
      ctx.fillRect(x + 5, y + 7, w - 10, h - 13);
      ctx.fillStyle = isS2 ? '#a855f7' : '#38e8d4';
      ctx.fillRect(x + Math.floor(w / 2) - 2, y + Math.floor(h / 2) - 2, 4, 2);
    }
  }

  private renderBossFloorTelegraph(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const state = e.bossState ?? 'stalk';
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 22);

    if (state === 'charge_windup') {
      // Glowing red Rocket-Charge corridor + scrolling warning chevrons!
      const len = 165;
      const angle = Math.atan2(e.chargeDirY, e.chargeDirX);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(244, 63, 94, ${0.14 + pulse * 0.14})`;
      ctx.fillRect(0, -14, len, 28);
      ctx.strokeStyle = `rgba(251, 113, 133, ${0.65 + pulse * 0.3})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(0, -14, len, 28);
      ctx.setLineDash([]);
      // Animated scrolling directional chevrons inside lane
      const shift = (this.scene.time * 85) % 24;
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 1.6;
      for (let x = shift; x < len - 10; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x - 4, -6);
        ctx.lineTo(x + 3, 0);
        ctx.lineTo(x - 4, 6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (state === 'slam_jump' || state === 'slam_air') {
      // Pulsing Crimson Ground Target Reticle for Gravity Jump Slam!
      const tx = e.bossTargetX ?? e.x;
      const ty = e.bossTargetY ?? e.y;
      const maxT = e.bossStateMax ?? 0.5;
      const prog =
        state === 'slam_jump'
          ? 0.2
          : Math.min(1, 0.2 + 0.8 * (1 - Math.max(0, e.bossStateTimer ?? 0) / maxT));
      ctx.save();
      ctx.fillStyle = `rgba(244, 63, 94, ${0.12 + prog * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(tx, ty + 4, 42 * prog, 42 * prog * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(251, 113, 133, ${0.75 + pulse * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(tx, ty + 4, 42, 42 * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner lock-on crosshair
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx - 12, ty + 4);
      ctx.lineTo(tx + 12, ty + 4);
      ctx.moveTo(tx, ty - 5);
      ctx.lineTo(tx, ty + 13);
      ctx.stroke();
      ctx.restore();
    } else if (state === 'laser_windup') {
      // Blinking crimson targeting beam before Reactor Laser Sweep!
      const a = e.bossLaserAngle ?? 0;
      const lx = e.x;
      const ly = e.y - 8;
      ctx.save();
      ctx.strokeStyle = `rgba(251, 113, 133, ${0.45 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(a) * 260, ly + Math.sin(a) * 260);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderBossLaserBeam(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const a = e.bossLaserAngle ?? 0;
    const lx = e.x;
    const ly = e.y - 8 - (e.bossHeight ?? 0);
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    let maxT = 320;
    for (let t = 12; t < 320; t += 6) {
      const px = lx + cosA * t;
      const py = ly + sinA * t;
      if (px < ROOM_LEFT || px > ROOM_RIGHT || py < ROOM_TOP || py > ROOM_BOTTOM) {
        maxT = t;
        break;
      }
    }
    const ex = lx + cosA * maxT;
    const ey = ly + sinA * maxT;
    const flicker = 0.85 + Math.sin(this.scene.time * 48) * 0.15;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // Wide blazing crimson plasma sheath
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
    ctx.lineWidth = 17 * flicker;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Molten orange inner beam
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.92)';
    ctx.lineWidth = 9 * flicker;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Incandescent white-gold core
    ctx.strokeStyle = '#fffbeb';
    ctx.lineWidth = 3.5 * flicker;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Glowing reactor muzzle & wall impact blast flare!
    drawGlow(ctx, lx, ly, 24, '#fb7185', 0.8);
    drawGlow(ctx, ex, ey, 22, '#fde047', 0.85);
    ctx.restore();
  }

  private drawBossPylon(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    bossX: number,
    bossY: number,
    enraged: boolean,
    charging: boolean,
    fistScale = 1,
  ): void {
    if (enraged && fistScale <= 0.02 && getHDArt().rigs.core_warden?.parts.fist_angled) return; // Faust ist unterwegs: Platz leer (kein Schweif, keine Leine)
    const coreColor = enraged ? '#fb7185' : charging ? '#fde047' : '#38e8d4';
    // Thin glowing energy tether linking pylon to boss reactor
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = coreColor;
    ctx.globalAlpha = charging ? 0.55 : 0.25;
    ctx.lineWidth = charging ? 1.5 : 0.9;
    ctx.beginPath();
    ctx.moveTo(bossX, bossY);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.restore();

    // M11 K6/S4: in Phase 2 kreisen die abgelösten Fäuste statt der Rauten (Bilder aus fists.png; Hitbox/Schüsse bleiben die der Pylonen)
    const rigParts = enraged ? getHDArt().rigs.core_warden?.parts : null;
    const fistImg = rigParts ? (charging ? rigParts.fist_charged : rigParts.fist_angled) : null;
    if (rigParts && fistImg) {
      drawGlow(ctx, px, py, charging ? 16 : 11, coreColor, charging ? 0.6 : 0.3);
      const ang = Math.atan2(py - bossY, px - bossX); // Richtung Boss → Pylon
      const trail = charging && fistScale > 0.9 ? rigParts.fist_trail : null;
      if (trail) {
        // Energie-Schweif hinter der Faust (entgegen der Umlaufrichtung)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.translate(px, py);
        ctx.rotate(ang + Math.PI / 2);
        ctx.drawImage(trail, -trail.width / 2 - 4, -trail.height / 4, trail.width / 2, trail.height / 2);
        ctx.restore();
      }
      if (fistScale > 0.02) {
        ctx.save();
        ctx.translate(px, py);
        if (!charging) ctx.rotate(ang + 0.4); // Manschette (unten links im Bild) zeigt zum Boss
        ctx.scale(fistScale, fistScale);
        ctx.drawImage(fistImg, -fistImg.width / 4, -fistImg.height / 4, fistImg.width / 2, fistImg.height / 2);
        ctx.restore();
      }
      return;
    }

    // Armored diamond satellite pylon
    drawGlow(ctx, px, py, charging ? 16 : 11, coreColor, charging ? 0.65 : 0.35);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(px, py - 6.5);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 6.5);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Glowing inner plasma crystal
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(px, py - 3.6);
    ctx.lineTo(px + 2.8, py);
    ctx.lineTo(px, py + 3.6);
    ctx.lineTo(px - 2.8, py);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }

  private renderAnimatedBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const frame = Math.floor(e.anim) % 2;
    const state = e.bossState ?? 'stalk';
    const enraged = Boolean(e.bossPhase2);
    const z = e.bossHeight ?? 0;

    // Ground shadow shrinks naturally as Boss rockets high into the air!
    const shadowScale = Math.max(0.32, 1 - z / 115);
    drawPixelShadow(ctx, e.x, e.y + 18, 23 * shadowScale, 7.5 * shadowScale, 0.58 * shadowScale);

    // State-driven mechanical body squash/stretch, recoil shudder & banking tilt!
    const hover =
      state === 'slam_jump' || state === 'slam_air' || state === 'slam_impact'
        ? 0
        : Math.sin(this.scene.time * (enraged ? 6.5 : 4.2)) * 2.6;

    let scaleX = 1;
    let scaleY = 1;
    let tilt = Math.max(-0.18, Math.min(0.18, e.vx * 0.0014));
    let jitterX = 0;
    let jitterY = 0;

    if (state === 'charge_windup') {
      scaleX = 1.2;
      scaleY = 0.8;
      jitterX = (Math.random() - 0.5) * 2.4;
      jitterY = (Math.random() - 0.5) * 1.4;
    } else if (state === 'charge_dash') {
      scaleX = 1.15;
      scaleY = 0.88;
      tilt = e.chargeDirX * 0.25;
    } else if (state === 'slam_jump') {
      scaleX = 0.84;
      scaleY = 1.24;
    } else if (state === 'slam_air') {
      scaleX = 1.06;
      scaleY = 1.06;
      tilt = Math.sin(this.scene.time * 16) * 0.06;
    } else if (state === 'slam_impact') {
      const p = 1 - Math.max(0, e.bossStateTimer ?? 0) / (e.bossStateMax ?? 0.42);
      const bounce = Math.max(0, 1 - p * 2.4);
      scaleX = 1 + bounce * 0.34;
      scaleY = 1 - bounce * 0.3;
    } else if (state === 'laser_windup' || state === 'phase2_roar') {
      jitterX = (Math.random() - 0.5) * 2.6;
      jitterY = (Math.random() - 0.5) * 2.2;
      scaleX = 1 + Math.sin(this.scene.time * 30) * 0.06;
      scaleY = 1 - Math.sin(this.scene.time * 30) * 0.05;
    } else if (state === 'stunned') {
      tilt = Math.sin(this.scene.time * 18) * 0.14;
      scaleX = 1.06;
      scaleY = 0.94;
    }

    if (getHDArt().rigs.core_warden) {
      // M11 K1/K2: mit Rig zeigen die Teile Stauchen/Strecken selbst → Ganzkörper-Effekt abmildern, weich nachführen, Zittern halbieren
      const sm = smoothBossBody(e, scaleX, scaleY, tilt, this.scene.time, 0.3);
      scaleX = sm.sx;
      scaleY = sm.sy;
      tilt = sm.tilt;
      jitterX *= 0.5;
      jitterY *= 0.5;
    }
    const bodyX = e.x + jitterX;
    const bodyY = e.y - z + hover + jitterY;
    const pylons = this.scene.enemyAi.getBossPylonPositions(e);
    const pylonCharging = state === 'pylon_barrage' || state === 'phase2_roar';
    // M11: solange Fäuste unterwegs sind, ist der Orbit leer; danach kehren sie zurück (wachsen in 0,5 s nach) — nur Optik
    const fistScale = this.fistReturnScale(e);

    // 1. Back-orbiting 3D plasma pylons (drawn behind boss chassis)
    for (const py of pylons) {
      if (py.depth < 0) {
        this.drawBossPylon(ctx, py.x, py.y, bodyX, bodyY - 4, enraged, pylonCharging, fistScale);
      }
    }

    // 2. Animated Plasma Thruster Flames under chassis & Rocket-Charge Jet Cone!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const jetFlicker = 0.75 + Math.sin(this.scene.time * 42) * 0.25;
    const jetLen = state === 'slam_jump' ? 24 * jetFlicker : state === 'stalk' ? 10 * jetFlicker : 14 * jetFlicker;
    const jetColor = enraged ? '#fb7185' : '#38e8d4';
    for (const ox of [-10, 10]) {
      ctx.fillStyle = jetColor;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(bodyX + ox - 3.5, bodyY + 13);
      ctx.lineTo(bodyX + ox + 3.5, bodyY + 13);
      ctx.lineTo(bodyX + ox, bodyY + 13 + jetLen);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(bodyX + ox - 1.5, bodyY + 13);
      ctx.lineTo(bodyX + ox + 1.5, bodyY + 13);
      ctx.lineTo(bodyX + ox, bodyY + 13 + jetLen * 0.55);
      ctx.closePath();
      ctx.fill();
    }

    // Massive horizontal rocket booster flame during Rocket Charge Dash!
    if (state === 'charge_dash') {
      const ca = Math.atan2(-e.chargeDirY, -e.chargeDirX);
      ctx.save();
      ctx.translate(bodyX, bodyY);
      ctx.rotate(ca);
      ctx.fillStyle = '#f97316';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(12, -11);
      ctx.lineTo(12, 11);
      ctx.lineTo(44 * jetFlicker, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(12, -5);
      ctx.lineTo(12, 5);
      ctx.lineTo(28 * jetFlicker, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 3. Main Boss Chassis Sprite with Mechanical Squash/Stretch & Tilt!
    let rigUsed = false;
    const spr = e.flashTimer > 0 ? art.bossFlash ?? atlas.bossFlash : art.boss ?? atlas.boss[frame];
    ctx.save();
    ctx.translate(bodyX, bodyY + 16);
    ctx.rotate(tilt);
    ctx.scale(scaleX, scaleY);
    if (this.tryDrawRig(ctx, e, 0, 7, bodyX, bodyY + 16)) {
      rigUsed = true; // M11: Rig statt Einzelbild
    } else if (art.boss) {
      ctx.drawImage(spr, -27, -45, 54, 52);
    } else {
      ctx.drawImage(spr, -14, -29);
    }
    ctx.restore();

    // 4. Pulsing Chest Reactor Core Glow Overlay (changes color with attack & Phase 2!)
    const corePulse = 0.5 + 0.5 * Math.sin(this.scene.time * (enraged ? 14 : 7));
    const coreColor =
      state === 'laser_windup' || state === 'laser_sweep' || enraged
        ? '#fb7185'
        : state === 'charge_windup' || state === 'charge_dash'
          ? '#fb923c'
          : '#fbbf24';
    const coreR = state === 'laser_windup' || state === 'laser_sweep' ? 28 + corePulse * 8 : 18 + corePulse * 5;
    // M11: Rig hat einen eigenen leuchtenden Kern im Bild — Überlagerung dezenter, damit der Rumpf lesbar bleibt
    drawGlow(ctx, bodyX, bodyY + (rigUsed ? 5 : -6), rigUsed ? coreR * 0.7 : coreR, coreColor, (0.45 + corePulse * 0.25) * (rigUsed ? 0.45 : 1));

    // Hot glowing center core dot right on the chest reactor
    if (state === 'laser_windup' || state === 'laser_sweep' || enraged) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.65 + corePulse * 0.35;
      ctx.beginPath();
      ctx.arc(bodyX, bodyY - 6, state === 'laser_windup' ? 4.5 + corePulse * 2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Front-orbiting 3D plasma pylons (drawn IN FRONT of boss chassis!)
    for (const py of pylons) {
      if (py.depth >= 0) {
        this.drawBossPylon(ctx, py.x, py.y, bodyX, bodyY - 4, enraged, pylonCharging, fistScale);
      }
    }
  }

  private renderSpearThrust(ctx: CanvasRenderingContext2D, tr: SpearThrustFx): void {
    const art = getHDArt();
    const t = 1 - tr.life / tr.maxLife;
    const alpha = Math.max(0, 1 - Math.pow(t, 1.35));
    const extend = Math.min(1, t * 4.2);
    const len = tr.length * (0.45 + 0.55 * extend);
    const isFinisher = tr.comboStep === 2 || tr.isCharge;

    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.rotate(tr.angle);

    // 1. Multi-layer piercing plasma lance cone & sonic shock rings!
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = isFinisher
      ? `rgba(253, 224, 71, ${alpha * 0.46})`
      : `rgba(56, 232, 212, ${alpha * 0.45})`;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(len * 0.28, -(isFinisher ? 9 : 6.5));
    ctx.lineTo(len + 6, 0);
    ctx.lineTo(len * 0.28, isFinisher ? 9 : 6.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isFinisher
      ? `rgba(56, 232, 212, ${alpha * 0.85})`
      : `rgba(103, 232, 249, ${alpha * 0.85})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.32, -(isFinisher ? 4.8 : 3.4));
    ctx.lineTo(len + 3, 0);
    ctx.lineTo(len * 0.32, isFinisher ? 4.8 : 3.4);
    ctx.closePath();
    ctx.fill();

    // White-hot needle core
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.96})`;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(len * 0.45, -1.6);
    ctx.lineTo(len + 2, 0);
    ctx.lineTo(len * 0.45, 1.6);
    ctx.closePath();
    ctx.fill();

    // Expanding sonic piercing rings along shaft
    ctx.strokeStyle = isFinisher
      ? `rgba(253, 224, 71, ${alpha * 0.85})`
      : `rgba(165, 243, 252, ${alpha * 0.78})`;
    ctx.lineWidth = 1.2;
    for (const frac of [0.35, 0.68]) {
      const rx = len * frac;
      const ry = (isFinisher ? 7.5 : 5.5) * (0.6 + t * 0.7);
      ctx.beginPath();
      ctx.ellipse(rx, 0, 2.2, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Lunging HD Ionen-Speer sprite right inside the plasma lance!
    if (art.weapons.spear) {
      const lungeDist = len * 0.42;
      ctx.save();
      ctx.translate(tr.x + Math.cos(tr.angle) * lungeDist, tr.y + Math.sin(tr.angle) * lungeDist);
      ctx.rotate(tr.angle + Math.PI / 4);
      ctx.globalAlpha = Math.min(1, alpha * 1.4);
      ctx.drawImage(art.weapons.spear, -13, -15, 28, 28);
      ctx.restore();
    }
  }

  private renderLeviathanFloorTelegraphs(ctx: CanvasRenderingContext2D, e: Enemy): void {
    if (!e.levArms) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 24);
    for (const arm of e.levArms) {
      if (arm.state === 'tracking' || arm.state === 'slamming') {
        ctx.save();
        ctx.fillStyle = `rgba(244, 63, 94, ${0.18 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.ellipse(arm.targetX, arm.targetY + 4, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(251, 113, 133, ${0.75 + pulse * 0.25})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(arm.targetX, arm.targetY + 4, 30, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(arm.targetX - 10, arm.targetY + 4);
        ctx.lineTo(arm.targetX + 10, arm.targetY + 4);
        ctx.moveTo(arm.targetX, arm.targetY - 4);
        ctx.lineTo(arm.targetX, arm.targetY + 12);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private renderLeviathanTwinBeams(ctx: CanvasRenderingContext2D, e: Enemy): void {
    if (!e.levArms) return;
    const windup = e.bossState === 'lev_twin_windup';
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 36);
    for (const arm of e.levArms) {
      const cosA = Math.cos(arm.beamAngle);
      const sinA = Math.sin(arm.beamAngle);
      const ex = arm.x + cosA * 255;
      const ey = arm.y + sinA * 255;
      ctx.save();
      if (windup) {
        ctx.strokeStyle = `rgba(251, 113, 133, ${0.45 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(arm.x, arm.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.58)';
        ctx.lineWidth = 14 + pulse * 3;
        ctx.beginPath();
        ctx.moveTo(arm.x, arm.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.92)';
        ctx.lineWidth = 7 + pulse * 2;
        ctx.stroke();
        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = 2.8;
        ctx.stroke();
        drawGlow(ctx, arm.x, arm.y, 20, '#fb7185', 0.8);
      }
      ctx.restore();
    }
  }

  private readonly fistSeen = new WeakMap<Enemy, number>();
  /** Orbit-Fäuste: 0 solange abgefeuerte Fäuste fliegen, danach in 0,5 s zurück auf 1. */
  private fistReturnScale(e: Enemy): number {
    const t = this.scene.time;
    if (this.scene.projectiles.some((p) => p.sprite === 'fist')) {
      this.fistSeen.set(e, t);
      return 0;
    }
    const seen = this.fistSeen.get(e);
    return seen === undefined ? 1 : Math.max(0, Math.min(1, (t - seen) / 0.5));
  }

  /** M11 Teilen: Boss-Hälften etwas kleiner zeichnen (um den Fußpunkt). */
  private withSplitScale(ctx: CanvasRenderingContext2D, e: Enemy, draw: () => void): void {
    if (e.splitGroup === undefined) {
      draw();
      return;
    }
    const fy = e.y + e.radius;
    ctx.save();
    ctx.translate(e.x, fy);
    ctx.scale(0.85, 0.85);
    ctx.translate(-e.x, -fy);
    draw();
    ctx.restore();
  }

  /** M11: Boss/Gegner mit Rig zeichnen (Ursprung = Fußpunkt bei (ox, oy)). false → bisherige Darstellung. */
  private tryDrawRig(ctx: CanvasRenderingContext2D, e: Enemy, ox: number, oy: number, wx: number, wy: number): boolean {
    const rigId = RIG_BY_KIND[e.kind];
    if (!rigId) return false;
    const images = getHDArt().rigs[rigId];
    if (!images) return false;
    const pose = getBossPose(rigId, e, this.scene.time, this.scene.playerX - e.x);
    // M11 Phase 2: Verwandlung — Teile mit `detach: 'phase2'` lösen sich genau einmal (Pose zeigt sie ab da nicht mehr)
    if (e.bossPhase2 && !e.rigDetached) {
      e.rigDetached = true;
      const pre = getBossPose(rigId, { ...e, bossPhase2: false }, this.scene.time);
      if (spawnPhase2Parts(this.scene.detached, RIGS[rigId], images, pre, ox, oy, wx, wy) > 0) {
        this.scene.spawnBurst(wx + ox, wy + oy - 14, '#fbbf24', 16);
        this.scene.triggerShake(0.25, 3.5);
      }
    }
    drawRig(ctx, RIGS[rigId], images, ox, oy, pose, { flash: e.flashTimer > 0 });
    return true;
  }

  /** M11 Phase 7: Gegner-Rig (Teile-Sheet Typ G) zeichnen — Boden bei `e.y + 11`, Blickrichtung zum Spieler (Rig gespiegelt). */
  private tryDrawEnemyRig(ctx: CanvasRenderingContext2D, e: Enemy, _moving: boolean): boolean {
    const rigId = RIG_BY_KIND[e.kind];
    if (!rigId) return false;
    const images = getHDArt().rigs[rigId];
    if (!images) return false;
    const dx = this.scene.playerX - e.x;
    const dy = this.scene.playerY - e.y;
    const facing = e.kind === 'turret' ? turretFacing(e, this.scene.playerX) : 1;
    const pose = getBossPose(rigId, e, this.scene.time, dx * facing, dy);
    drawPixelShadow(ctx, e.x, e.y + 10, 11, 3.6, 0.45);
    drawRig(ctx, RIGS[rigId], images, e.x, e.y + 11, pose, { flash: e.flashTimer > 0, flipX: facing < 0 });
    return true;
  }

  private renderBreacherBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const state = e.bossState ?? 'stalk';
    const enraged = Boolean(e.bossPhase2);
    const moving = Math.min(1, Math.hypot(e.vx, e.vy) / 60);
    const stompBob = Math.abs(Math.sin(this.scene.time * (enraged ? 11 : 7))) * 1.2 * moving; // nur beim Laufen wippen (stehend wirkte der Boss zappelig)
    let scaleX = 1;
    let scaleY = 1;
    let tilt = Math.max(-0.18, Math.min(0.18, e.vx * 0.0014));
    if (state === 'charge_windup') {
      scaleX = 1.22;
      scaleY = 0.78;
    } else if (state === 'breacher_stomp') {
      scaleX = 0.86;
      scaleY = 1.22;
    } else if (state === 'stunned') {
      tilt = Math.sin(this.scene.time * 18) * 0.14;
    }

    drawPixelShadow(ctx, e.x, e.y + 17, 22, 7.2, 0.55);
    let rigUsed = false;
    const spr = e.flashTimer > 0 ? art.bossBreacherFlash : art.bossBreacher;
    if (spr) {
      ctx.save();
      ctx.translate(e.x, e.y + 16 - stompBob);
      const sm = smoothBossBody(e, scaleX, scaleY, tilt, this.scene.time, 0.3);
      ctx.rotate(sm.tilt);
      ctx.scale(sm.sx, sm.sy);
      if (this.tryDrawRig(ctx, e, 0, 7, e.x, e.y + 16 - stompBob)) rigUsed = true;
      else drawBossLook(ctx, art, e, this.scene.time, spr, -27, -45, 54, 52);
      ctx.restore();
    }
    const corePulse = 0.5 + 0.5 * Math.sin(this.scene.time * (enraged ? 14 : 7));
    if (e.bossStatusText === 'MAGNET-ZUG' && (e.bossSub === 'windup' || e.bossSub === 'active' || e.bossSub === 'recover')) {
      // M11: Magnet lädt/zieht — kaltes Leuchten um den Magneten (Sog selbst: BossFx 'pull')
      drawGlow(ctx, e.x, e.y - 30, 22 + corePulse * 6, '#67e8f9', e.bossSub === 'windup' ? 0.3 : 0.55);
    }
    // M11: Rig hat seinen eigenen Glühkern im Bild — Überlagerung dezenter
    drawGlow(ctx, e.x, e.y - 4, (20 + corePulse * 6) * (rigUsed ? 0.7 : 1), enraged ? '#fb7185' : '#fbbf24', (0.42 + corePulse * 0.22) * (rigUsed ? 0.35 : 1));
  }

  private renderLeviathanBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const enraged = Boolean(e.bossPhase2);
    const flash = e.flashTimer > 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * (enraged ? 14 : 6));
    const breath = Math.sin(this.scene.time * 2.8) * 1.8;
    const cx = e.x;
    const cy = e.y + breath;

    // 1. Massive Armored Titan Hull Chassis spanning top of Reactor Core Arena!
    ctx.save();
    drawPixelShadow(ctx, cx, cy + 28, 84, 14, 0.58);

    // Armored Outer Wing Bulkheads with metallic bevel & rivets
    ctx.fillStyle = flash ? '#f8fafc' : '#111827';
    ctx.fillRect(cx - 90, cy - 29, 180, 48);
    ctx.fillStyle = flash ? '#ffffff' : '#1e293b';
    ctx.fillRect(cx - 86, cy - 27, 172, 43);
    ctx.fillStyle = flash ? '#ffffff' : '#334155';
    ctx.fillRect(cx - 82, cy - 24, 164, 34);
    // Top armor bevel highlight
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 82, cy - 24, 164, 2.5);

    // Bronze / Steel Shoulder Armor Plates, Horn Fins & Glowing Exhaust Vents
    ctx.fillStyle = flash ? '#fef3c7' : enraged ? '#7f1d1d' : '#78350f';
    ctx.fillRect(cx - 78, cy - 22, 46, 28);
    ctx.fillRect(cx + 32, cy - 22, 46, 28);
    ctx.fillStyle = enraged ? '#b91c1c' : '#b45309';
    ctx.fillRect(cx - 76, cy - 20, 42, 4);
    ctx.fillRect(cx + 34, cy - 20, 42, 4);
    ctx.strokeStyle = enraged ? '#fb7185' : '#fbbf24';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 78, cy - 22, 46, 28);
    ctx.strokeRect(cx + 32, cy - 22, 46, 28);

    // Armored corner bolts
    ctx.fillStyle = '#fde68a';
    for (const bx of [cx - 75, cx - 36, cx + 35, cx + 74]) {
      ctx.fillRect(bx, cy - 19, 2, 2);
      ctx.fillRect(bx, cy + 2, 2, 2);
    }

    // Shoulder plasma radiator slits
    for (const side of [-1, 1]) {
      const vx = cx + side * 55;
      ctx.fillStyle = enraged ? '#fb7185' : '#38e8d4';
      for (let s = 0; s < 3; s++) {
        ctx.fillRect(vx - 13, cy - 14 + s * 6, 26, 2.6);
      }
      drawGlow(ctx, vx, cy - 8, 22, enraged ? '#fb7185' : '#38e8d4', 0.32 + pulse * 0.14);
    }

    // Central Crown Crest & Mandible Hull
    ctx.fillStyle = flash ? '#ffffff' : '#475569';
    ctx.beginPath();
    ctx.moveTo(cx - 36, cy - 28);
    ctx.lineTo(cx + 36, cy - 28);
    ctx.lineTo(cx + 28, cy + 24);
    ctx.lineTo(cx, cy + 33);
    ctx.lineTo(cx - 28, cy + 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 30, cy - 27, 60, 4);
    ctx.strokeStyle = enraged ? '#fb7185' : '#fbbf24';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Twin golden-crimson brow fins flanking Omega Eye
    ctx.fillStyle = enraged ? '#fb7185' : '#fbbf24';
    ctx.fillRect(cx - 26, cy - 20, 10, 3);
    ctx.fillRect(cx + 16, cy - 20, 10, 3);

    // Rotating Omega Reactor Eye Ring (Core Weakpoint!)
    const coreColor = enraged ? '#fb7185' : '#fbbf24';
    drawGlow(ctx, cx, cy + 2, 34 + pulse * 8, coreColor, 0.5 + pulse * 0.25);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 13, this.scene.time * 2, this.scene.time * 2 + Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 8 + pulse * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Articulated Segmented Chain Arms + Massive Hydraulic Giant Gauntlets!
    if (e.levArms) {
      for (const arm of e.levArms) {
        const shX = cx + arm.side * 66;
        const shY = cy + 6;
        const grounded = arm.state === 'grounded';
        const slamming = arm.state === 'slamming';

        // Segmented steel hydraulic chain joints from shoulder -> gauntlet
        ctx.save();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(shX, shY);
        ctx.lineTo(arm.x, arm.y);
        ctx.stroke();
        ctx.strokeStyle = enraged ? '#fb7185' : '#38e8d4';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        for (let seg = 1; seg <= 3; seg++) {
          const u = seg / 4;
          const jx = shX + (arm.x - shX) * u;
          const jy = shY + (arm.y - shY) * u;
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(jx, jy, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }

        // Ground shadow under gauntlet
        drawPixelShadow(ctx, arm.x, arm.y + 16, grounded ? 19 : 14, grounded ? 6 : 4, grounded ? 0.58 : 0.35);

        // Massive Armored Gauntlet Fist!
        ctx.translate(arm.x, arm.y);
        const fistFill = flash ? '#ffffff' : grounded ? '#92400e' : '#334155';
        ctx.fillStyle = fistFill;
        ctx.fillRect(-15, -13, 30, 26);
        ctx.strokeStyle = slamming || enraged ? '#fb7185' : grounded ? '#fde047' : '#38e8d4';
        ctx.lineWidth = grounded ? 1.8 : 1.2;
        ctx.strokeRect(-15, -13, 30, 26);
        // Knuckle plates & glowing plasma core emitter inside fist
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-12, 7, 6, 7);
        ctx.fillRect(-3, 8, 6, 7);
        ctx.fillRect(6, 7, 6, 7);
        ctx.fillStyle = enraged ? '#fb7185' : grounded ? '#fde047' : '#38e8d4';
        ctx.beginPath();
        ctx.arc(0, -1, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -3, 4, 4);
        ctx.restore();

        drawGlow(
          ctx,
          arm.x,
          arm.y,
          grounded ? 26 : 18,
          grounded ? '#fde047' : enraged ? '#fb7185' : '#38e8d4',
          grounded ? 0.45 : 0.25,
        );
      }
    }
  }

  private renderPrismaArchonTwinBeams(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const base = e.bossLaserAngle ?? Math.PI / 2;
    const isWindup = e.bossState === 's2_beam_windup';
    const prog = 1 - Math.max(0, (e.bossStateTimer ?? 0) / Math.max(0.01, e.bossStateMax ?? 1));
    const spread = isWindup ? 0.85 : 0.85 - prog * 0.72;
    const angles = [base - spread, base + spread];

    ctx.save();
    for (const a of angles) {
      const x2 = e.x + Math.cos(a) * 260;
      const y2 = e.y + Math.sin(a) * 260;
      if (isWindup) {
        ctx.strokeStyle = `rgba(232, 121, 249, ${0.4 + 0.45 * Math.sin(this.scene.time * 38)})`;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private renderQuartzGolemBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const enraged = Boolean(e.bossPhase2);
    const hover = Math.sin(this.scene.time * 3.8) * 2.2;
    drawPixelShadow(ctx, e.x, e.y + 16, 20, 6.5, 0.55);
    drawGlow(ctx, e.x, e.y - 2 + hover, 36, enraged ? '#e879f9' : '#c084fc', enraged ? 0.52 : 0.34);

    // Orbiting quartz crystal shards around the colossus
    ctx.save();
    for (let k = 0; k < 4; k++) {
      const a = this.scene.time * (enraged ? 3.2 : 1.9) + k * (Math.PI / 2);
      const ox = e.x + Math.cos(a) * 23;
      const oy = e.y - 2 + Math.sin(a) * 14;
      ctx.fillStyle = k % 2 === 0 ? '#fde047' : '#e879f9';
      ctx.fillRect(ox - 2, oy - 3, 4, 6);
    }
    ctx.restore();

    const spr = e.flashTimer > 0 ? art.resonanceWardenFlash : art.resonanceWarden;
    if (spr) {
      ctx.drawImage(spr, e.x - 23, e.y - 23 + hover, 46, 44);
    }
  }

  private renderPrismWeaverBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const enraged = Boolean(e.bossPhase2);
    const hover = Math.sin(this.scene.time * 5.2) * 3.2;
    drawPixelShadow(ctx, e.x, e.y + 15, 17, 5.5, 0.48);
    drawGlow(ctx, e.x, e.y + hover, 34, enraged ? '#f472b6' : '#38e8d4', enraged ? 0.55 : 0.38);

    // Rotating prism laser ring
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = enraged ? '#f472b6' : '#38e8d4';
    ctx.lineWidth = 1.4;
    const base = e.bossOrbitAngle ?? 0;
    for (let k = 0; k < 3; k++) {
      const a = base + k * ((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.arc(e.x, e.y + hover, 21, a, a + 0.85);
      ctx.stroke();
    }
    ctx.restore();

    const spr = e.flashTimer > 0 ? art.prismDroneFlash : art.prismDrone;
    if (spr) {
      ctx.save();
      if (e.bossState === 's2_blink_windup') {
        ctx.globalAlpha = 0.45 + 0.45 * Math.sin(this.scene.time * 38);
      }
      ctx.drawImage(spr, e.x - 21, e.y - 21 + hover, 42, 42);
      ctx.restore();
    }
  }

  private renderPrismaArchonBoss(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const enraged = Boolean(e.bossPhase2);
    const hover = Math.sin(this.scene.time * 3.4) * 3.6;
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 6.0);

    drawPixelShadow(ctx, e.x, e.y + 24, 30, 8.5, 0.55);
    drawGlow(ctx, e.x, e.y - 4 + hover, 56, enraged ? '#f43f5e' : '#c084fc', 0.42 + pulse * 0.16);
    drawGlow(ctx, e.x, e.y - 4 + hover, 28, '#fde047', 0.28 + pulse * 0.12);

    // Radiant rotating celestial prism halo behind the Archon!
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = enraged ? 'rgba(244, 114, 182, 0.72)' : 'rgba(232, 121, 249, 0.62)';
    ctx.lineWidth = 1.6;
    const orbit = e.bossOrbitAngle ?? 0;
    for (let k = 0; k < 4; k++) {
      const a = orbit + k * (Math.PI / 2);
      ctx.beginPath();
      ctx.arc(e.x, e.y - 4 + hover, 34, a, a + 0.72);
      ctx.stroke();
    }
    ctx.restore();

    const spr = e.flashTimer > 0 ? art.bossPrismaArchonFlash : art.bossPrismaArchon;
    if (spr) {
      ctx.drawImage(spr, e.x - 36, e.y - 32 + hover, 72, 60);
    }
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const art = getHDArt();
    const atlas = getAtlas();
    const frame = Math.floor(e.anim) % 2;

    if (e.kind === 'boss') {
      this.renderAnimatedBoss(ctx, e);
      return;
    }
    if (e.kind === 'boss_breacher') {
      this.renderBreacherBoss(ctx, e);
      return;
    }
    if (e.kind === 'boss_leviathan') {
      this.renderLeviathanBoss(ctx, e);
      return;
    }
    if (e.kind === 'boss_quartz_golem') {
      this.renderQuartzGolemBoss(ctx, e);
      return;
    }
    if (e.kind === 'boss_prism_weaver') {
      this.renderPrismWeaverBoss(ctx, e);
      return;
    }
    if (e.kind === 'boss_prisma_archon') {
      this.renderPrismaArchonBoss(ctx, e);
      return;
    }
    if (
      e.kind === 'boss_slag_overlord' ||
      e.kind === 'boss_forge_warden' ||
      e.kind === 'boss_vulkan_titan' ||
      e.kind === 'boss_chrono_sentinel' ||
      e.kind === 'boss_monolith_colossus' ||
      e.kind === 'boss_star_archon' ||
      e.kind === 'boss_omega_archon'
    ) {
      const enraged = Boolean(e.bossPhase2);
      const isS3Boss =
        e.kind === 'boss_slag_overlord' || e.kind === 'boss_forge_warden' || e.kind === 'boss_vulkan_titan';
      const isMajor =
        e.kind === 'boss_vulkan_titan' || e.kind === 'boss_star_archon' || e.kind === 'boss_omega_archon';
      const isOmega = e.kind === 'boss_omega_archon';
      const hover = Math.sin(this.scene.time * 3.2) * (isMajor ? 3.5 : 2.2);
      const pulse = 0.5 + 0.5 * Math.sin(this.scene.time * 6.0);
      const glowA = isOmega ? '#fde047' : isS3Boss ? '#f97316' : '#38e8d4';
      const glowB = isOmega ? '#e879f9' : '#fde047';

      drawPixelShadow(ctx, e.x, e.y + (isMajor ? 24 : 18), isMajor ? 30 : 22, isMajor ? 8.5 : 6.5, 0.56);
      drawGlow(ctx, e.x, e.y - 4 + hover, isMajor ? 58 : 40, enraged ? '#f43f5e' : glowA, 0.44 + pulse * 0.16);
      drawGlow(ctx, e.x, e.y - 4 + hover, isMajor ? 30 : 20, glowB, 0.28 + pulse * 0.12);

      if (isMajor) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = isOmega ? 'rgba(253, 224, 71, 0.85)' : isS3Boss ? 'rgba(251, 146, 60, 0.72)' : 'rgba(56, 232, 212, 0.78)';
        ctx.lineWidth = isOmega ? 2.2 : 1.6;
        const orbit = e.bossOrbitAngle ?? this.scene.time * 1.4;
        for (let k = 0; k < (isOmega ? 6 : 4); k++) {
          const a = orbit + k * ((Math.PI * 2) / (isOmega ? 6 : 4));
          ctx.beginPath();
          ctx.arc(e.x, e.y - 4 + hover, isOmega ? 38 : 34, a, a + 0.65);
          ctx.stroke();
        }
        ctx.restore();
      }

      const spr =
        e.kind === 'boss_vulkan_titan'
          ? e.flashTimer > 0
            ? art.bossVulkanTitanFlash
            : art.bossVulkanTitan
          : e.kind === 'boss_star_archon' || e.kind === 'boss_omega_archon'
            ? e.flashTimer > 0
              ? art.bossStarArchonFlash
              : art.bossStarArchon
            : e.kind === 'boss_slag_overlord'
              ? e.flashTimer > 0
                ? art.forgeGolemFlash
                : art.forgeGolem
              : e.kind === 'boss_forge_warden'
                ? e.flashTimer > 0
                  ? art.emberStalkerFlash
                  : art.emberStalker
                : e.kind === 'boss_chrono_sentinel'
                  ? e.flashTimer > 0
                    ? art.chronoEyeFlash
                    : art.chronoEye
                  : e.flashTimer > 0
                    ? art.monolithGuardFlash
                    : art.monolithGuard;
      if (spr) {
        const w = isOmega ? 78 : isMajor ? 72 : 48;
        const h = isOmega ? 70 : isMajor ? 64 : 48;
        drawBossLook(ctx, art, e, this.scene.time, spr, e.x - w / 2, e.y - h / 2 - 4 + hover, w, h);
      }
      return;
    }

    drawPixelShadow(ctx, e.x, e.y + 9, 8.5, 3.2, 0.48);

    // Sector 3 & Sector 4 HD Pixel-Art Enemies!
    const m6SpriteMap: Partial<
      Record<
        Enemy['kind'],
        {
          spr: HTMLCanvasElement | null;
          flash: HTMLCanvasElement | null;
          w: number;
          h: number;
          glow: string;
          hovers?: boolean;
          shield?: boolean;
        }
      >
    > = {
      slag_beetle: { spr: art.slagBeetle, flash: art.slagBeetleFlash, w: 26, h: 24, glow: '#f97316' },
      solar_drone: { spr: art.solarDrone, flash: art.solarDroneFlash, w: 24, h: 24, glow: '#fde047', hovers: true },
      magma_mortar: { spr: art.magmaMortar, flash: art.magmaMortarFlash, w: 26, h: 26, glow: '#fb923c' },
      ember_stalker: { spr: art.emberStalker, flash: art.emberStalkerFlash, w: 25, h: 26, glow: '#f97316' },
      forge_golem: { spr: art.forgeGolem, flash: art.forgeGolemFlash, w: 30, h: 30, glow: '#f97316', shield: true },
      astral_scarab: { spr: art.astralScarab, flash: art.astralScarabFlash, w: 26, h: 24, glow: '#38e8d4' },
      chrono_eye: { spr: art.chronoEye, flash: art.chronoEyeFlash, w: 24, h: 24, glow: '#fde047', hovers: true },
      star_lancer: { spr: art.starLancer, flash: art.starLancerFlash, w: 26, h: 28, glow: '#fde047' },
      void_wraith: { spr: art.voidWraith, flash: art.voidWraithFlash, w: 26, h: 26, glow: '#38e8d4', hovers: true },
      monolith_guard: { spr: art.monolithGuard, flash: art.monolithGuardFlash, w: 30, h: 30, glow: '#fde047', hovers: true, shield: true },
    };
    const m6Def = m6SpriteMap[e.kind];
    if (m6Def) {
      const offY = m6Def.hovers ? Math.sin(this.scene.time * 5.2 + e.id) * 2.5 : -Math.abs(Math.sin(e.anim * 5.6)) * 2.0;
      const spr = e.flashTimer > 0 ? m6Def.flash : m6Def.spr;
      if (spr) {
        ctx.drawImage(spr, e.x - m6Def.w / 2, e.y - m6Def.h / 2 - 2 + offY, m6Def.w, m6Def.h);
      }
      if (m6Def.shield) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = e.telegraphTimer > 0 ? '#fde047' : m6Def.glow;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(e.x, e.y + offY, 16, e.aimAngle - 0.9, e.aimAngle + 0.9);
        ctx.stroke();
        ctx.restore();
      }
      drawGlow(ctx, e.x, e.y + offY, e.telegraphTimer > 0 ? 22 : 16, m6Def.glow, e.telegraphTimer > 0 ? 0.56 : 0.3);
      this.renderEnemyMiniHp(ctx, e);
      return;
    }

    if (e.kind === 'crystal_crawler') {
      const hop = Math.abs(Math.sin(e.anim * 5.8)) * (e.chargeActive > 0 ? 4.2 : 1.8);
      const spr = e.flashTimer > 0 ? art.crystalCrawlerFlash : art.crystalCrawler;
      if (spr) {
        ctx.drawImage(spr, e.x - 13, e.y - 12 - hop, 26, 22);
      }
      drawGlow(ctx, e.x, e.y, e.telegraphTimer > 0 ? 20 : 15, '#c084fc', e.telegraphTimer > 0 ? 0.55 : 0.28);
      this.renderEnemyMiniHp(ctx, e);
      return;
    }
    if (e.kind === 'prism_drone') {
      const hover = Math.sin(this.scene.time * 6.0 + e.id) * 2.8;
      const spr = e.flashTimer > 0 ? art.prismDroneFlash : art.prismDrone;
      if (spr) {
        ctx.drawImage(spr, e.x - 12, e.y - 13 + hover, 24, 24);
      }
      drawGlow(
        ctx,
        e.x,
        e.y + hover,
        e.telegraphTimer > 0 ? 22 : 16,
        e.telegraphTimer > 0 ? '#e879f9' : '#38e8d4',
        e.telegraphTimer > 0 ? 0.58 : 0.3,
      );
      this.renderEnemyMiniHp(ctx, e);
      return;
    }
    if (e.kind === 'shard_sniper') {
      const spr = e.flashTimer > 0 ? art.shardSniperFlash : art.shardSniper;
      if (spr) {
        ctx.drawImage(spr, e.x - 12, e.y - 16, 24, 27);
      }
      drawGlow(ctx, e.x, e.y - 2, e.telegraphTimer > 0 ? 22 : 15, '#f472b6', e.telegraphTimer > 0 ? 0.58 : 0.28);
      this.renderEnemyMiniHp(ctx, e);
      return;
    }
    if (e.kind === 'void_crawler') {
      const hop = Math.abs(Math.sin(e.anim * 6.6)) * (e.chargeActive > 0 ? 4.8 : 2.2);
      const spr = e.flashTimer > 0 ? art.voidCrawlerFlash : art.voidCrawler;
      if (spr) {
        ctx.drawImage(spr, e.x - 13, e.y - 12 - hop, 26, 22);
      }
      drawGlow(
        ctx,
        e.x,
        e.y,
        e.chargeActive > 0 ? 22 : 16,
        e.chargeActive > 0 ? '#38e8d4' : '#e879f9',
        e.chargeActive > 0 ? 0.55 : 0.32,
      );
      this.renderEnemyMiniHp(ctx, e);
      return;
    }
    if (e.kind === 'resonance_warden') {
      const hover = Math.sin(this.scene.time * 4.5 + e.id) * 2.4;
      const spr = e.flashTimer > 0 ? art.resonanceWardenFlash : art.resonanceWarden;
      if (spr) {
        ctx.drawImage(spr, e.x - 14, e.y - 16 + hover, 28, 28);
      }
      // Rotating amethyst-gold crystal barrier arc! (M10-C: fällt beim Angriff / Überhitzen)
      this.renderShieldArc(ctx, e, hover, 15.5, 0.95, '#e879f9', 2.8);
      drawGlow(ctx, e.x, e.y + hover, 19, '#c084fc', e.telegraphTimer > 0 ? 0.52 : 0.3);
      this.renderEnemyMiniHp(ctx, e);
      return;
    }

    if (e.kind === 'slime') {
      const speed = Math.hypot(e.vx, e.vy);
      const crouch = e.telegraphTimer > 0 ? 0.24 : Math.sin(e.anim * 1.6) * 0.12;
      const hopLift = Math.min(5, speed * 0.045);
      const spr = e.flashTimer > 0 ? art.slimeFlash ?? atlas.slimeFlash : art.slime ?? atlas.slime[frame];
      if (art.slime) {
        ctx.save();
        ctx.translate(e.x, e.y + 9 - hopLift);
        ctx.scale(1 + crouch, 1 - crouch);
        ctx.drawImage(spr, -11, -20, 22, 21);
        ctx.restore();
      } else {
        ctx.drawImage(spr, Math.round(e.x - 8), Math.round(e.y - 8));
      }
      drawGlow(ctx, e.x, e.y, 16, e.telegraphTimer > 0 ? '#f472b6' : '#c084fc', e.telegraphTimer > 0 ? 0.45 : 0.22);
    } else if (e.kind === 'slime_magma') {
      const hop = Math.abs(Math.sin(e.anim * 5.2)) * (e.chargeActive > 0 ? 5.2 : 2.6);
      const sq = e.telegraphTimer > 0 ? 0.22 : Math.sin(e.anim * 5.2) * 0.1;
      const spr = e.flashTimer > 0 ? art.slimeMagmaFlash ?? art.slimeFlash : art.slimeMagma ?? art.slime;
      if (spr) {
        ctx.save();
        ctx.translate(e.x, e.y + 7 - hop);
        ctx.scale(1 + sq, 1 - sq);
        ctx.drawImage(spr, -12, -20, 24, 21);
        ctx.restore();
      }
      drawGlow(ctx, e.x, e.y, e.telegraphTimer > 0 ? 22 : 17, '#f97316', e.telegraphTimer > 0 ? 0.56 : 0.34);
    } else if (e.kind === 'drone') {
      const hover = Math.sin(this.scene.time * 6.5 + e.id) * 2.6;
      const bank = Math.max(-0.22, Math.min(0.22, e.vx * 0.0025));
      const spr = e.flashTimer > 0 ? art.droneFlash ?? atlas.droneFlash : art.drone ?? atlas.drone[0];
      if (art.drone) {
        ctx.save();
        ctx.translate(e.x, e.y + hover);
        ctx.rotate(bank);
        ctx.drawImage(spr, -11, -12, 22, 22);
        ctx.restore();
      } else {
        ctx.drawImage(spr, Math.round(e.x - 8), Math.round(e.y - 9 + hover));
      }
      if (e.telegraphTimer > 0) drawGlow(ctx, e.x, e.y + hover, 18, '#fb7185', 0.55);
      else drawGlow(ctx, e.x, e.y + hover, 13, '#38e8d4', 0.22);
    } else if (e.kind === 'drone_arc') {
      const hover = Math.sin(this.scene.time * 7.2 + e.id) * 2.8;
      const bank = Math.max(-0.24, Math.min(0.24, e.vx * 0.0028));
      const spr = e.flashTimer > 0 ? art.droneArcFlash ?? art.droneFlash : art.droneArc ?? art.drone;
      if (spr) {
        ctx.save();
        ctx.translate(e.x, e.y + hover);
        ctx.rotate(bank);
        ctx.drawImage(spr, -12.5, -13, 25, 25);
        ctx.restore();
      }
      drawGlow(
        ctx,
        e.x,
        e.y + hover,
        e.telegraphTimer > 0 ? 22 : 16,
        e.telegraphTimer > 0 ? '#38e8d4' : '#c084fc',
        e.telegraphTimer > 0 ? 0.6 : 0.32,
      );
    } else if (e.kind === 'phase_stalker') {
      // Draw pulsing magenta teleport landing telegraph ring right before phase-blink!
      if (e.telegraphTimer > 0 && e.bossTargetX !== undefined && e.bossTargetY !== undefined) {
        const p = 1 - Math.max(0, e.telegraphTimer / 0.54);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.45 + p * 0.5})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(e.bossTargetX, e.bossTargetY, 15 - p * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(232, 121, 249, ${0.35 + p * 0.45})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.bossTargetX, e.bossTargetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawGlow(ctx, e.bossTargetX, e.bossTargetY, 18, '#f43f5e', 0.3 + p * 0.25);
      }
      const hover = Math.sin(this.scene.time * 6 + e.id) * 1.4;
      const spr = e.flashTimer > 0 ? art.phaseStalkerFlash : art.phaseStalker;
      if (spr) {
        ctx.save();
        if (e.telegraphTimer > 0) {
          ctx.globalAlpha = 0.45 + 0.4 * Math.sin(this.scene.time * 36);
        }
        ctx.translate(e.x, e.y + 10 - hover);
        ctx.drawImage(spr, -13, -27, 26, 28);
        ctx.restore();
      }
      drawGlow(
        ctx,
        e.x,
        e.y,
        e.chargeActive > 0 ? 22 : 16,
        e.chargeActive > 0 ? '#f43f5e' : '#e879f9',
        e.chargeActive > 0 ? 0.52 : 0.28,
      );
    } else if (e.kind === 'shield_drone') {
      const hover = Math.sin(this.scene.time * 5.2 + e.id) * 2.2;
      const spr = e.flashTimer > 0 ? art.shieldDroneFlash : art.shieldDrone;
      if (spr) {
        ctx.drawImage(spr, e.x - 13, e.y - 14 + hover, 26, 26);
      }
      // Frontaler Schild: 100 % Block — fällt beim Angriff / Überhitzen (Konter-Fenster!), Hitze färbt ihn orange
      this.renderShieldArc(ctx, e, hover, 14, 1.08, '#38e8d4', 2.6);
      drawGlow(ctx, e.x, e.y + hover, 17, '#38e8d4', 0.28);
    } else if (e.kind === 'spore_spitter') {
      const pulse = Math.sin(this.scene.time * 7 + e.id) * 0.1;
      const spr = e.flashTimer > 0 ? art.sporeSpitterFlash : art.sporeSpitter;
      if (spr) {
        ctx.save();
        ctx.translate(e.x, e.y + 8);
        ctx.scale(1 + pulse, 1 - pulse);
        ctx.drawImage(spr, -12, -22, 24, 23);
        ctx.restore();
      }
      drawGlow(
        ctx,
        e.x,
        e.y - 2,
        e.telegraphTimer > 0 ? 22 : 15,
        e.telegraphTimer > 0 ? '#a3e635' : '#34d399',
        e.telegraphTimer > 0 ? 0.52 : 0.26,
      );
    } else {
      const scurrying = e.scurryTimer > 0;
      const bob = scurrying ? Math.abs(Math.sin(this.scene.time * 22 + e.id)) * 2.2 : 0;
      const tilt = scurrying ? Math.sin(this.scene.time * 22 + e.id) * 0.08 : 0;
      if (this.tryDrawEnemyRig(ctx, e, scurrying)) {
        // M11: Rig (Sockel + drehendes Gehäuse + Rohr) statt Einzelbild
        if (e.telegraphTimer > 0) drawGlow(ctx, e.x, e.y - 4, 20, '#fbbf24', 0.45);
        this.renderEnemyMiniHp(ctx, e);
        return;
      }
      const spr =
        e.flashTimer > 0
          ? art.turretFlash ?? atlas.turretFlash
          : e.telegraphTimer > 0
            ? art.turret1 ?? atlas.turret[1]
            : art.turret0 ?? atlas.turret[0];
      if (art.turret0) {
        ctx.save();
        ctx.translate(e.x, e.y - bob);
        ctx.rotate(tilt);
        ctx.drawImage(spr, -12, -13, 24, 24);
        ctx.restore();
      } else {
        ctx.drawImage(spr, Math.round(e.x - 8), Math.round(e.y - 8));
      }
      if (e.telegraphTimer > 0) drawGlow(ctx, e.x, e.y, 20, '#fbbf24', 0.5);
    }

    this.renderEnemyMiniHp(ctx, e);
  }

  /** M10-C (G4): Schildbogen — intakt / aufgeheizt (orange) / unten (gestrichelt grau, mit Konter-Hinweis). */
  private renderShieldArc(
    ctx: CanvasRenderingContext2D,
    e: Enemy,
    hover: number,
    radius: number,
    halfArc: number,
    baseColor: string,
    width: number,
  ): void {
    const down = (e.shieldDownTimer ?? 0) > 0;
    const heat = Math.min(1, (e.shieldHeat ?? 0) / (e.kind === 'resonance_warden' ? ENEMY_SHIELDS.resonance_warden.maxHeat : ENEMY_SHIELDS.shield_drone.maxHeat));
    ctx.save();
    if (down) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.scene.time * 18);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(e.x, e.y + hover, radius, e.aimAngle - halfArc, e.aimAngle + halfArc);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 6px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▼', e.x, e.y - e.radius - 6 + hover);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = heat >= 0.7 ? '#fb923c' : e.telegraphTimer > 0 ? '#fde047' : baseColor;
      ctx.lineWidth = width + heat * 0.8;
      ctx.beginPath();
      ctx.arc(e.x, e.y + hover, radius, e.aimAngle - halfArc, e.aimAngle + halfArc);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderEnemyMiniHp(ctx: CanvasRenderingContext2D, e: Enemy): void {
    // M10-C: Elite — goldener Rand
    if (e.elite) {
      ctx.save();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.65 + 0.3 * Math.sin(this.scene.time * 6 + e.id);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Milestone 7: Visual elemental & Rift mutator status auras
    if (e.mutator) {
      const mCol = RIFT_MUTATORS[e.mutator].color;
      drawGlow(ctx, e.x, e.y, e.radius + 9, mCol, 0.24);
    }
    if (e.burnTimer && e.burnTimer > 0) {
      drawGlow(ctx, e.x, e.y - 2, e.radius + 10, '#fb923c', 0.36);
    }
    if (e.cryoTimer && e.cryoTimer > 0) {
      drawGlow(ctx, e.x, e.y, e.radius + 10, '#67e8f9', 0.36);
      ctx.save();
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (e.hp >= e.maxHp) return;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#0e131f';
    ctx.fillRect(e.x - 10, e.y - 16, 20, 3);
    ctx.fillStyle = e.cryoTimer && e.cryoTimer > 0 ? '#67e8f9' : e.burnTimer && e.burnTimer > 0 ? '#fb923c' : '#fb7185';
    ctx.fillRect(e.x - 9, e.y - 15, 18 * pct, 1.2);
  }

  private drawReadyMeleeWeapon(ctx: CanvasRenderingContext2D, bob: number): void {
    const art = getHDArt();
    const wep = this.scene.state.equippedWeapon;
    if (
      (wep !== 'blade' && wep !== 'spear' && wep !== 'hammer') ||
      this.scene.swings.length > 0 ||
      this.scene.thrusts.length > 0
    ) {
      return;
    }
    const spr =
      wep === 'hammer'
        ? art.weapons.hammer
        : wep === 'spear'
          ? art.weapons.spear
          : art.weapons.blade;
    if (!spr) return;

    const idleBreath = Math.sin(this.scene.time * 4.2) * 0.06;
    const walkSwing = this.scene.walkAnim > 0 ? Math.sin(this.scene.walkAnim) * 0.14 : 0;
    const size = wep === 'spear' ? 23 : wep === 'hammer' ? 21 : 19;

    let ox = 8;
    let oy = -2;
    let rot = -0.35 + idleBreath + walkSwing;
    if (this.scene.shieldActive) {
      // Brace blade defensively right behind the Kinetic Shield!
      ox = Math.cos(this.scene.shieldAngle) * 7;
      oy = -2 + Math.sin(this.scene.shieldAngle) * 6;
      rot = this.scene.shieldAngle + Math.PI * 0.72;
    } else if (this.scene.facing === 'left') {
      ox = -8;
      oy = -2;
      rot = -Math.PI * 0.72 - idleBreath - walkSwing;
    } else if (this.scene.facing === 'up') {
      ox = 7;
      oy = -5;
      rot = -0.65 + idleBreath;
    } else if (this.scene.facing === 'down') {
      ox = 8;
      oy = 0;
      rot = 0.28 + idleBreath + walkSwing;
    }

    ctx.save();
    ctx.translate(this.scene.playerX + ox, this.scene.playerY + oy - bob * 0.65);
    ctx.rotate(rot + Math.PI / 4);
    ctx.drawImage(spr, -size * 0.22, -size * 0.82, size, size);
    ctx.restore();
  }

  private renderCompanion(ctx: CanvasRenderingContext2D): void {
    const compId = this.scene.activeCompanion;
    if (!compId) return;
    const art = getHDArt();
    const def = COMPANION_DEFS[compId];
    const bob = Math.sin(this.scene.time * 5.2) * 2.2;

    drawPixelShadow(ctx, this.scene.companionX, this.scene.companionY + 9, 5.5, 2.2, 0.36);
    drawGlow(ctx, this.scene.companionX, this.scene.companionY - 2 + bob, 14, def.accentColor, 0.28);
    const spr = art.companions[compId];
    if (spr) {
      ctx.drawImage(spr, this.scene.companionX - 9, this.scene.companionY - 12 + bob, 18, 18);
    } else {
      ctx.fillStyle = def.accentColor;
      ctx.beginPath();
      ctx.arc(this.scene.companionX, this.scene.companionY - 2 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderFistBursts(ctx: CanvasRenderingContext2D): void {
    for (const f of this.scene.fistBursts) {
      const t = 1 - f.life / f.maxLife;
      const alpha = Math.max(0, 1 - t);
      const len = (f.isFinisher ? 24 : 15) + t * (f.isFinisher ? 14 : 8);
      const spread = f.isFinisher ? 12 : 7;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);

      // Kinetic shockwave cone / knuckle arc
      ctx.strokeStyle = f.isFinisher ? `rgba(251, 191, 36, ${alpha})` : `rgba(56, 232, 212, ${alpha})`;
      ctx.lineWidth = f.isFinisher ? 3.2 : 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, len * 0.55, -0.85, 0.85);
      ctx.stroke();

      ctx.fillStyle = f.isFinisher
        ? `rgba(254, 240, 138, ${alpha * 0.72})`
        : `rgba(165, 243, 252, ${alpha * 0.65})`;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(len * 0.85, -spread * (1 - t * 0.35));
      ctx.lineTo(len, 0);
      ctx.lineTo(len * 0.85, spread * (1 - t * 0.35));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderDiscs(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();

    // Active ricochet & recalling Phase Discs
    for (const d of this.scene.discs) {
      // Glowing phase trail
      if (d.trail.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i < d.trail.length; i++) {
          const p0 = d.trail[i - 1];
          const p1 = d.trail[i];
          const frac = i / d.trail.length;
          ctx.strokeStyle = d.recalling
            ? `rgba(240, 171, 252, ${frac * 0.85})`
            : `rgba(56, 232, 212, ${frac * 0.75})`;
          ctx.lineWidth = 1.5 + frac * 2.5;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      drawGlow(ctx, d.x, d.y, d.recalling ? 20 : 16, d.recalling ? '#f0abfc' : '#c084fc', 0.42);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.spin);
      if (art.weapons.discus) {
        ctx.drawImage(art.weapons.discus, -8, -8, 16, 16);
      } else {
        ctx.strokeStyle = '#38e8d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Active Klingen-Orbit twin phase blades (Discus secondary with 0 active discs)
    if (this.scene.discusOrbitTimer > 0) {
      const orbitR = 26;
      const alpha = Math.min(1, this.scene.discusOrbitTimer / 0.45);
      ctx.save();
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.scene.playerX, this.scene.playerY - 1, orbitR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (let b = 0; b < 2; b++) {
        const a = this.scene.discusOrbitAngle + b * Math.PI;
        const bx = this.scene.playerX + Math.cos(a) * orbitR;
        const by = this.scene.playerY - 1 + Math.sin(a) * orbitR;
        drawGlow(ctx, bx, by, 14, '#c084fc', 0.36 * alpha);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(bx, by);
        ctx.rotate(this.scene.time * 18);
        if (art.weapons.discus) {
          ctx.drawImage(art.weapons.discus, -7, -7, 14, 14);
        }
        ctx.restore();
      }
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const atlas = getAtlas();
    if (
      this.scene.invulnTimer > 0 &&
      this.scene.dashTimer <= 0 &&
      this.scene.lanceChargeTimer <= 0 &&
      this.scene.cometSlamTimer <= 0 &&
      Math.floor(this.scene.time * 24) % 2 === 0
    ) {
      return;
    }

    // Dramatic Moonlighter pit-fall shrink & tumble animation into the abyss!
    if (this.scene.pitFallTimer > 0) {
      const prog = 1 - Math.max(0, this.scene.pitFallTimer / Math.max(0.05, this.scene.pitFallDuration));
      const fallScale = Math.max(0.08, 1 - prog * 0.88);
      const fallSpr = art.heroDown;
      if (fallSpr) {
        ctx.save();
        ctx.globalAlpha = Math.max(0.12, 1 - prog * 0.85);
        ctx.translate(this.scene.playerX, this.scene.playerY + prog * 14);
        ctx.rotate(prog * 5.2);
        ctx.scale(fallScale, fallScale);
        ctx.drawImage(fallSpr, -12, -16, 24, 28);
        ctx.restore();
      }
      return;
    }

    const walking = this.scene.walkAnim > 0;
    const bob = walking ? Math.abs(Math.sin(this.scene.walkAnim)) * 2.2 : Math.sin(this.scene.time * 3) * 0.4;

    // Dynamic Melee Body Lunge, Squash/Stretch & Lean during Blade / Spear / Fists / Hammer attacks!
    let lungeX = 0;
    let lungeY = 0;
    let scaleX = 1;
    let scaleY = 1;
    let tilt = walking ? Math.sin(this.scene.walkAnim) * 0.05 : 0;
    if (this.scene.swingPoseTimer > 0) {
      const p = 1 - this.scene.swingPoseTimer / Math.max(0.05, this.scene.swingPoseMax);
      const pulse = Math.sin(p * Math.PI);
      lungeX = Math.cos(this.scene.swingPoseAngle) * pulse * 4.2;
      lungeY = Math.sin(this.scene.swingPoseAngle) * pulse * 3.2;
      scaleX = 1 + pulse * 0.14;
      scaleY = 1 - pulse * 0.1;
      tilt +=
        this.scene.swingPoseCombo === 2
          ? Math.sin(p * Math.PI * 2) * 0.24
          : this.scene.swingPoseDir * pulse * 0.22;
    }

    // Hide shadow while dashing/leaping right over a chasm so the jump reads clearly!
    const overChasm = this.scene.getChasmAt(this.scene.playerX, this.scene.playerY + 4, -2) !== null;
    if (!overChasm) {
      drawPixelShadow(ctx, this.scene.playerX + lungeX * 0.5, this.scene.playerY + 11, 8, 3.2, 0.5);
    }

    // Draw ready weapon BEHIND hero when facing up!
    if (this.scene.facing === 'up') {
      this.drawReadyMeleeWeapon(ctx, bob);
    }

    const hdSpr =
      this.scene.playerFlashTimer > 0
        ? art.heroFlash
        : this.scene.facing === 'up'
          ? art.heroUp
          : this.scene.facing === 'right'
            ? art.heroRight
            : this.scene.facing === 'left'
              ? art.heroLeft
              : art.heroDown;

    if (hdSpr) {
      ctx.save();
      ctx.translate(this.scene.playerX + lungeX, this.scene.playerY + 10 - bob + lungeY);
      ctx.rotate(tilt);
      ctx.scale(scaleX, scaleY);
      ctx.drawImage(hdSpr, -12, -26, 24, 28);
      ctx.restore();
    } else {
      const frame = Math.floor(this.scene.walkAnim) % 2;
      let spr = atlas.heroDown[frame];
      if (this.scene.facing === 'up') spr = atlas.heroUp[frame];
      else if (this.scene.facing === 'right') spr = atlas.heroRight[frame];
      else if (this.scene.facing === 'left') spr = atlas.heroLeft[frame];
      if (this.scene.playerFlashTimer > 0) spr = atlas.heroFlash;
      ctx.drawImage(spr, Math.round(this.scene.playerX - 8), Math.round(this.scene.playerY - 10));
    }

    // Draw ready melee weapon IN FRONT of hero when facing down / left / right!
    if (this.scene.facing !== 'up') {
      this.drawReadyMeleeWeapon(ctx, bob);
    }

    // Show equipped Puls-Blaster, Kinetik-Fäuste, or ready Phasen-Diskus in hand!
    if (this.scene.state.equippedWeapon === 'blaster' && art.weapons.blaster) {
      const a = this.scene.lastAimAngle;
      const recoil = this.scene.blasterRecoil * 3.5;
      ctx.save();
      ctx.translate(
        this.scene.playerX + Math.cos(a) * (8 - recoil),
        this.scene.playerY - 1 + Math.sin(a) * (8 - recoil),
      );
      ctx.rotate(a + Math.PI / 4);
      ctx.drawImage(art.weapons.blaster, -8, -8, 16, 16);
      ctx.restore();
    } else if (this.scene.state.equippedWeapon === 'fists' && art.weapons.fists) {
      // Dual glowing kinetic energy gauntlets flanking hero — alternating left/right jab thrusts!
      const a = this.scene.swingPoseTimer > 0 ? this.scene.swingPoseAngle : this.scene.lastAimAngle;
      const perpX = -Math.sin(a);
      const perpY = Math.cos(a);
      const isPunching = this.scene.swingPoseTimer > 0;
      const punchPhase = isPunching
        ? Math.sin((1 - this.scene.swingPoseTimer / Math.max(0.05, this.scene.swingPoseMax)) * Math.PI)
        : 0;
      const isFinisher = isPunching && this.scene.swingPoseCombo === 2;

      for (const side of [-1, 1] as const) {
        const activeSide = isFinisher || (isPunching && this.scene.swingPoseDir === side);
        const reach = activeSide ? 8 + punchPhase * (isFinisher ? 11 : 8) : 5.5;
        const spread = activeSide ? (isFinisher ? 4.5 : 3.2) : 6.5;
        const gx = this.scene.playerX + lungeX + Math.cos(a) * reach + perpX * side * spread;
        const gy = this.scene.playerY - 1 - bob + Math.sin(a) * reach + perpY * side * spread;
        drawGlow(
          ctx,
          gx,
          gy,
          activeSide ? 13 : 8,
          isFinisher ? '#fde047' : activeSide ? '#38e8d4' : '#fb923c',
          activeSide ? 0.5 : 0.24,
        );
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(a + Math.PI / 2);
        const sz = activeSide ? 11 : 8.5;
        const halfW = art.weapons.fists.width / 2;
        const srcX = side < 0 ? 0 : halfW;
        ctx.drawImage(
          art.weapons.fists,
          srcX,
          0,
          halfW,
          art.weapons.fists.height,
          -sz * 0.42,
          -sz * 0.55,
          sz * 0.84,
          sz * 1.1,
        );
        ctx.restore();
      }
    } else if (this.scene.state.equippedWeapon === 'discus' && this.scene.discs.length < 2 && art.weapons.discus) {
      // Hovering mini phase-discus spinning lightly beside hero's hand when ready to throw!
      const hx = this.scene.playerX + (this.scene.facing === 'left' ? -10 : 10);
      const hy = this.scene.playerY - 2 - bob;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(this.scene.time * 6);
      ctx.drawImage(art.weapons.discus, -6, -6, 12, 12);
      ctx.restore();
    }

    const suitAura = SUIT_THEMES[this.scene.state.suitTheme] ?? SUIT_THEMES.classic;
    drawGlow(ctx, this.scene.playerX, this.scene.playerY, 24, suitAura.auraColor, this.scene.state.suitTheme === 'classic' ? 0.14 : 0.24);
    if (this.scene.state.suitTheme !== 'classic') {
      ctx.save();
      ctx.strokeStyle = suitAura.accent;
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.scene.time * 4.2);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.ellipse(this.scene.playerX, this.scene.playerY + 9, 10, 4.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderMinimap(ctx: CanvasRenderingContext2D): void {
    const cx = VIRTUAL_WIDTH - 26;
    const cy = 22;
    const cell = 6;

    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.fillRect(cx - 22, cy - 17, 44, 34);
    ctx.strokeStyle = this.scene.currentRoom.type === 'secret' ? '#fde047' : '#475569';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(cx - 21.5, cy - 16.5, 43, 33);

    if (this.scene.currentRoom.type === 'secret') {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 5px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★ GEHEIM', cx, cy + 2);
      return;
    }

    for (const room of this.scene.floor.rooms.values()) {
      if (room.type === 'secret') continue;
      // Vertrauensbonus Vex („Sektor-Scanner“): Schatz- & Bossraum sind ab Betreten der Ebene sichtbar
      // (nicht in der Galaktischen Prüfung, dort gelten für alle dieselben Bedingungen)
      const scannerReveal =
        (room.type === 'boss' || room.type === 'treasure') &&
        !this.scene.isWeeklyTrial &&
        this.scene.state.hasTrustPerk('vex');
      const adjVisited =
        scannerReveal ||
        room.visited ||
        this.scene.floor.rooms.get(roomKey(room.gx + 1, room.gy))?.visited ||
        this.scene.floor.rooms.get(roomKey(room.gx - 1, room.gy))?.visited ||
        this.scene.floor.rooms.get(roomKey(room.gx, room.gy + 1))?.visited ||
        this.scene.floor.rooms.get(roomKey(room.gx, room.gy - 1))?.visited;
      if (!adjVisited) continue;

      const rx = cx + (room.gx - this.scene.currentRoom.gx) * cell;
      const ry = cy + (room.gy - this.scene.currentRoom.gy) * cell;
      if (rx < cx - 18 || rx > cx + 16 || ry < cy - 13 || ry > cy + 12) continue;

      if (room.key === this.scene.currentRoom.key) {
        ctx.fillStyle = '#38e8d4';
      } else if (room.type === 'boss') {
        ctx.fillStyle = '#fb7185';
      } else if (room.type === 'treasure') {
        ctx.fillStyle = '#fbbf24';
      } else if (room.visited) {
        ctx.fillStyle = '#64748b';
      } else {
        ctx.fillStyle = '#293448';
      }
      ctx.fillRect(rx - 2, ry - 2, 5, 5);
      if (room.extractBeacon && !room.extractBeacon.used && room.visited && !this.scene.isWeeklyTrial) {
        ctx.fillStyle = '#a5f3fc';
        ctx.fillRect(rx - 0.5, ry - 0.5, 2, 2); // Notfall-Bake
      }
    }

    // Crisp live Speedrun Timer directly beneath the minimap
    const totalSec = Math.floor(this.scene.runElapsedSec);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.fillRect(cx - 22, cy + 19, 44, 10);
    ctx.strokeStyle = this.scene.isEndlessRift ? 'rgba(192, 132, 252, 0.7)' : 'rgba(56, 232, 212, 0.45)';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(cx - 21.5, cy + 19.5, 43, 9);
    ctx.fillStyle = this.scene.isEndlessRift ? '#f0abfc' : '#a5f3fc';
    ctx.font = 'bold 5px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⏱ ' + mm + ':' + ss, cx, cy + 25.8);

    // Optional compact badge for active Elementar-Prägung or Endless Spiral Mutator
    let nextY = cy + 31;
    const infDef = getInfusionDef(this.scene.state.getActiveInfusion());
    if (infDef) {
      ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
      ctx.fillRect(cx - 22, nextY, 44, 9);
      ctx.strokeStyle = infDef.color;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(cx - 21.5, nextY + 0.5, 43, 8);
      ctx.fillStyle = infDef.color;
      ctx.font = 'bold 4.4px Silkscreen, monospace';
      ctx.fillText(`${infDef.icon} ${infDef.shortName}`, cx, nextY + 6.2);
      nextY += 11;
    }
    if (this.scene.isWeeklyTrial && this.scene.trialInfo) {
      ctx.fillStyle = 'rgba(28, 22, 6, 0.9)';
      ctx.fillRect(cx - 22, nextY, 44, 9);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(cx - 21.5, nextY + 0.5, 43, 8);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 4.2px Silkscreen, monospace';
      ctx.fillText(
        `🏅 ${formatWeekLabel(this.scene.trialInfo.weekId)} E${this.scene.currentFloor}/3`,
        cx,
        nextY + 6.2,
      );
      nextY += 11;
    }
    if ((this.scene.isEndlessRift || this.scene.isWeeklyTrial) && this.scene.activeRiftMutator) {
      const mut = RIFT_MUTATORS[this.scene.activeRiftMutator];
      ctx.fillStyle = 'rgba(20, 10, 34, 0.9)';
      ctx.fillRect(cx - 22, nextY, 44, 9);
      ctx.strokeStyle = mut.color;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(cx - 21.5, nextY + 0.5, 43, 8);
      ctx.fillStyle = mut.color;
      ctx.font = 'bold 4.1px Silkscreen, monospace';
      ctx.fillText(
        this.scene.isWeeklyTrial ? `${mut.icon} ${mut.name}`.slice(0, 11) : `${mut.icon} E${this.scene.riftDepth}`,
        cx,
        nextY + 6.2,
      );
    }
  }

  private renderBossBar(ctx: CanvasRenderingContext2D): void {
    const boss = this.scene.enemies.find((e) => this.scene.isBossKind(e.kind));
    if (!boss) return;

    const pct = Math.max(0, boss.hp / boss.maxHp);
    const enraged = Boolean(boss.bossPhase2);
    const bw = 244;
    const bx = (VIRTUAL_WIDTH - bw) / 2;
    const by = VIRTUAL_HEIGHT - 27;

    const isS2Boss =
      boss.kind === 'boss_quartz_golem' ||
      boss.kind === 'boss_prism_weaver' ||
      boss.kind === 'boss_prisma_archon';
    const isS3Boss =
      boss.kind === 'boss_slag_overlord' ||
      boss.kind === 'boss_forge_warden' ||
      boss.kind === 'boss_vulkan_titan';
    const isS4Boss =
      boss.kind === 'boss_chrono_sentinel' ||
      boss.kind === 'boss_monolith_colossus' ||
      boss.kind === 'boss_star_archon' ||
      boss.kind === 'boss_omega_archon';

    ctx.fillStyle = 'rgba(12, 16, 26, 0.94)';
    ctx.fillRect(bx - 5, by - 12, bw + 10, 21);
    ctx.strokeStyle =
      boss.kind === 'boss_omega_archon'
        ? '#fde047'
        : isS4Boss
          ? enraged
            ? '#fde047'
            : '#38e8d4'
          : isS3Boss
            ? enraged
              ? '#ef4444'
              : '#f97316'
            : boss.kind === 'boss_prisma_archon'
              ? enraged
                ? '#f43f5e'
                : '#e879f9'
              : isS2Boss
                ? enraged
                  ? '#f472b6'
                  : '#c084fc'
                : boss.kind === 'boss_leviathan'
                  ? enraged
                    ? '#fb7185'
                    : '#fde047'
                  : enraged
                    ? '#fb7185'
                    : '#fb923c';
    ctx.lineWidth = 0.9;
    ctx.strokeRect(bx - 4.5, by - 11.5, bw + 9, 20);

    const baseNameMap: Partial<Record<Enemy['kind'], string>> = {
      boss_breacher: 'SCHROTT-SAMMLER „KRALL“',
      boss: 'KERN-WÄCHTER MK-IV',
      boss_leviathan: '★ A.E.G.I.S. LEVIATHAN',
      boss_quartz_golem: 'QUARZ-KOLOSS MK-I',
      boss_prism_weaver: 'PRISMA-WEBERIN',
      boss_prisma_archon: '★ PRISMA-ARCHON',
      boss_slag_overlord: 'SCHLACKEN-KOLOSS',
      boss_forge_warden: 'GIESSEREI-MEISTERIN',
      boss_vulkan_titan: '★ VULKAN-TITAN',
      boss_chrono_sentinel: 'CHRONO-WÄCHTER',
      boss_monolith_colossus: 'MONOLITH-KOLOSS',
      boss_star_archon: '★ DER STERNEN-ARCHON',
      boss_omega_archon: '🌌 ★ OMEGA STERNEN-ARCHON',
    };
    const baseName = baseNameMap[boss.kind] ?? 'SEKTOR-BOSS';
    const status = boss.bossStatusText ? ` · ${boss.bossStatusText}` : '';
    const title = enraged ? `${baseName} [PHASE II]${status}` : `${baseName}${status}`;
    ctx.fillStyle = enraged ? '#fda4af' : isS4Boss ? '#a5f3fc' : isS3Boss ? '#fed7aa' : isS2Boss ? '#f5d0fe' : '#fde047';
    ctx.font = 'bold 5.2px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIRTUAL_WIDTH / 2, by - 3.5);

    ctx.fillStyle = '#2a1822';
    ctx.fillRect(bx, by, bw, 5.5);
    ctx.fillStyle = enraged
      ? '#e11d48'
      : boss.kind === 'boss_omega_archon'
        ? '#eab308'
        : isS4Boss
          ? '#06b6d4'
          : isS3Boss
            ? '#ea580c'
            : boss.kind === 'boss_prisma_archon'
              ? '#c026d3'
              : isS2Boss
                ? '#a855f7'
                : boss.kind === 'boss_leviathan'
                  ? '#f59e0b'
                  : '#f97316';
    ctx.fillRect(bx, by, bw * pct, 5.5);
    ctx.fillStyle = enraged ? '#fda4af' : isS4Boss ? '#fde047' : isS2Boss ? '#f5d0fe' : '#fde047';
    ctx.fillRect(bx, by, bw * pct, 1.3);

    // Phase-2 threshold notch at 50%
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + bw * 0.5 - 0.5, by - 0.5, 1, 6.5);
  }

  private renderPrompt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.font = 'bold 5.5px Silkscreen, monospace';
    const w = Math.max(54, Math.ceil(ctx.measureText(text).width) + 14);
    const px = Math.max(8, Math.min(VIRTUAL_WIDTH - w - 8, x - w / 2));
    const py = Math.max(8, y - 8);

    ctx.fillStyle = 'rgba(11, 16, 28, 0.94)';
    ctx.fillRect(px, py, w, 12);
    ctx.strokeStyle = '#38e8d4';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(px, py, w, 12);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(text, px + w / 2, py + 8);
  }
}
