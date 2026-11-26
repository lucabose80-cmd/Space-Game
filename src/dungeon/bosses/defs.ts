// M10-C (G3): eigenständige Boss-Zugfolgen für S1 Ebene I und S3/S4 Ebene I–III.
// Alle Angriffe sind telegrafiert (Vorwarnung ≥ 0,4 s) und deterministisch (kein globaler Zufall).
import { sound } from '../../engine/audio';
import type { Enemy } from '../dungeonTypes';
import { around, bossBolt, clampToRoom, glideTo, ROOM, type BossCtx, type BossDef } from './bossEngine';

const fx = (c: BossCtx) => c.scene.bossFx;
const TAU = Math.PI * 2;

function approach(e: Enemy, c: BossCtx, want: number, speed: number): void {
  const radial = c.dist > want + 10 ? 1 : c.dist < want - 20 ? -1 : 0;
  e.vx += (c.nx * radial * speed - c.ny * e.moveDirX * speed * 0.5) * c.dt * 4;
  e.vy += (c.ny * radial * speed + c.nx * e.moveDirX * speed * 0.5) * c.dt * 4;
}

function floatTop(e: Enemy, c: BossCtx, ax: number, ay: number, speed: number): void {
  const t = c.scene.time;
  // M11 Teilen: die beiden Hälften schweben getrennt links/rechts
  const side = e.splitRole === undefined ? 0 : e.splitRole === 0 ? -85 : 85;
  const amp = e.splitRole === undefined ? ax : ax * 0.35;
  glideTo(e, ROOM.CX + side + Math.sin(t * speed + (e.splitRole ?? 0) * Math.PI) * amp, ROOM.T + 58 + Math.sin(t * speed * 2) * ay, 2.2);
}

// ---------------- S1 Ebene I: SCHROTT-SAMMLER „KRALL“ (kind boss_breacher) ----------------
const krall: BossDef = {
  title: 'SCHROTT-SAMMLER „KRALL“',
  phase2Toast: '🚨 KRALL PHASE II — SCHROTT-HAGEL!',
  idleSec: [0.9, 0.6],
  idleMove: (e, c) => approach(e, c, 88, 62),
  moves: [
    {
      name: 'MAGNET-ZUG',
      windup: 0.6,
      start: (e, c) => fx(c).add({ shape: 'circle', x: e.x, y: e.y, r: 125, delay: 0.6, life: 1.1, pull: 85, color: '#94a3b8' }),
      fire: (e, c) => fx(c).add({ shape: 'circle', x: e.x, y: e.y, r: 32, delay: 1.0, life: 0.3, burst: 22, color: '#f87171' }),
      recover: 1.3,
    },
    {
      name: 'SCHROTT-WURF',
      windup: 0.5,
      fire: (e, c) => {
        sound.playBlaster();
        [-0.3, 0, 0.3].forEach((off, i) => bossBolt(c.scene, e.x, e.y, e.aimAngle + off, 125, 14, '#a16207', 4.6, 2.2, { sprite: 'scrap', scrapVariant: i }));
      },
      recover: 0.9,
    },
    {
      name: 'GREIFARM-STOSS',
      windup: 0.65,
      start: (e, c) => {
        e.chargeDirX = c.nx;
        e.chargeDirY = c.ny;
        fx(c).add({ shape: 'line', x: e.x, y: e.y, x2: e.x + c.nx * 150, y2: e.y + c.ny * 150, width: 14, delay: 0.65, life: 0.25, burst: 24, color: '#f87171' });
      },
      fire: (e) => {
        sound.playBossSlam();
        e.vx += (e.chargeDirX ?? 0) * 170;
        e.vy += (e.chargeDirY ?? 0) * 170;
      },
      recover: 0.9,
    },
    {
      name: 'SCHROTT-HAGEL',
      windup: 0.5,
      start: (_e, c) => {
        for (let i = 0; i < 6; i++) {
          const p = around(c, i, 6, 48, 0.4);
          fx(c).add({ shape: 'circle', x: p.x, y: p.y, r: 22, delay: 0.9 + i * 0.12, life: 0.25, burst: 18, color: '#fb923c' });
        }
      },
      recover: 1.1,
    },
  ],
  movesP1: [1, 2, 0, 1],
  movesP2: [3, 2, 0, 1, 3],
};

// ---------------- S3 Ebene I: SCHLACKEN-KOLOSS (boss_slag_overlord) ----------------
const slag: BossDef = {
  title: 'SCHLACKEN-KOLOSS',
  phase2Toast: '🚨 SCHLACKEN-KOLOSS PHASE II — KETTENREAKTION!',
  idleSec: [1.0, 0.7],
  idleMove: (e, c) => approach(e, c, 80, 48),
  moves: [
    {
      name: 'SCHLACKEN-PFÜTZEN',
      windup: 0.5,
      start: (_e, c) => {
        for (let i = 0; i < 3; i++) {
          const p = i === 0 ? { x: c.scene.playerX, y: c.scene.playerY } : around(c, i, 3, 34, 0.6);
          fx(c).add({ shape: 'circle', x: p.x, y: p.y, r: 24, delay: 0.7, life: 6, burst: 10, dps: 8, color: '#f97316' });
          // Phase 2: Pfützen entzünden sich nacheinander (Kettenreaktion)
          if (c.p2) fx(c).add({ shape: 'circle', x: p.x, y: p.y, r: 30, delay: 2.4 + i * 0.35, life: 0.3, burst: 16, color: '#fde047' });
        }
      },
      recover: 1.2,
    },
    {
      name: 'BODENWELLE',
      windup: 0.6,
      start: (e, c) => fx(c).add({ shape: 'line', x: e.x, y: e.y, x2: e.x + c.nx * 230, y2: e.y + c.ny * 230, width: 22, delay: 0.6, life: 0.3, burst: 20, color: '#fb923c' }),
      fire: (e, c) => {
        sound.playBossSlam();
        c.scene.triggerShake(0.25, 3.5);
        c.scene.shockwaves.push({ x: e.x, y: e.y, maxRadius: 40, color: '#fb923c', life: 0.25, maxLife: 0.25 });
      },
      recover: 1.0,
    },
    {
      name: 'ROLLANGRIFF',
      windup: 0.8,
      start: (e, c) => {
        e.chargeDirX = c.nx;
        e.chargeDirY = c.ny;
        e.burstDelay = 0;
        fx(c).add({ shape: 'line', x: e.x, y: e.y, x2: e.x + c.nx * 330, y2: e.y + c.ny * 330, width: 26, delay: 0.8, life: 0.1, color: '#fbbf24' });
      },
      duration: 1.0,
      active: (e, c) => {
        e.vx = (e.chargeDirX ?? 0) * 225;
        e.vy = (e.chargeDirY ?? 0) * 225;
        e.burstDelay = Math.max(0, (e.burstDelay ?? 0) - c.dt);
        if (c.dist < e.radius + 8 && (e.burstDelay ?? 0) <= 0) {
          e.burstDelay = 0.5;
          c.scene.damagePlayer(20, c.nx, c.ny, e);
        }
      },
      recover: 1.2,
    },
  ],
  movesP1: [0, 1, 2],
  movesP2: [0, 2, 1, 0],
};

// ---------------- S3 Ebene II: GIESSEREI-MEISTERIN (boss_forge_warden) ----------------
const ANVILS = [
  { x: ROOM.L + 80, y: ROOM.B - 50 },
  { x: ROOM.R - 80, y: ROOM.B - 50 },
  { x: ROOM.CX, y: ROOM.T + 62 },
];
const forge: BossDef = {
  title: 'GIESSEREI-MEISTERIN',
  phase2Toast: '🚨 GIESSEREI-MEISTERIN PHASE II — SCHMELZ-DÜSEN!',
  idleSec: [0.9, 0.6],
  idleMove: (e, c) => approach(e, c, 100, 52),
  moves: [
    {
      name: 'GUSSFORMEN',
      windup: 0.8,
      start: (_e, c) => {
        for (const off of [-64, 0, 64]) {
          const p = clampToRoom(c.scene.playerX + off, c.scene.playerY + (off === 0 ? 0 : 18), 24);
          fx(c).add({ shape: 'rect', x: p.x, y: p.y, w: 42, h: 42, delay: 0.8, life: 0.3, burst: 22, color: '#fb923c' });
        }
      },
      recover: 1.1,
    },
    {
      name: 'FUNKEN-KEGEL',
      windup: 0.5,
      start: (e) => {
        e.stuckTimer = 0;
      },
      fire: (e, c) => {
        sound.playBlaster();
        for (let k = -2; k <= 2; k++) bossBolt(c.scene, e.x, e.y, e.aimAngle + k * 0.26, 140, 14, '#fbbf24');
      },
      duration: 0.4,
      active: (e, c, t) => {
        if (t >= 0.36 && e.stuckTimer !== 1) {
          e.stuckTimer = 1;
          for (let k = -2; k <= 2; k++) bossBolt(c.scene, e.x, e.y, e.aimAngle + k * 0.26 + 0.13, 140, 14, '#fbbf24');
        }
      },
      recover: 0.9,
    },
    {
      name: 'AMBOSS-SPRUNG',
      windup: 0.6,
      start: (e, c) => {
        const a = ANVILS[(e.bossMoveIdx ?? 0) % ANVILS.length];
        e.bossTargetX = a.x;
        e.bossTargetY = a.y;
        fx(c).add({ shape: 'circle', x: a.x, y: a.y, r: 28, delay: 0.6, life: 0.3, burst: 20, color: '#f87171' });
      },
      fire: (e, c) => {
        sound.playBossSlam();
        e.x = e.bossTargetX ?? e.x;
        e.y = e.bossTargetY ?? e.y;
        c.scene.shockwaves.push({ x: e.x, y: e.y, maxRadius: 36, color: '#fb923c', life: 0.28, maxLife: 0.28 });
      },
      recover: 1.0,
    },
    {
      name: 'SCHMELZ-DÜSEN',
      windup: 0.6,
      start: (_e, c) => {
        for (const off of [-34, 34]) {
          const y = clampToRoom(0, c.scene.playerY + off, 20).y;
          fx(c).add({ shape: 'line', x: ROOM.L + 6, y, x2: ROOM.R - 6, y2: y, width: 12, delay: 0.9, life: 1.4, dps: 22, color: '#ef4444' });
        }
      },
      recover: 1.5,
    },
  ],
  movesP1: [0, 1, 2],
  movesP2: [3, 0, 1, 2, 3],
};

// ---------------- S3 Ebene III: ★ VULKAN-TITAN (boss_vulkan_titan) ----------------
const vulkan: BossDef = {
  title: 'VULKAN-TITAN',
  phase2Toast: '🚨 VULKAN-TITAN PHASE II — DIE ARENA SCHMILZT!',
  idleSec: [0.9, 0.65],
  idleMove: (e, c) => floatTop(e, c, 90, 16, 0.8),
  onPhase2: (_e, c) => {
    const w = ROOM.R - ROOM.L;
    const h = ROOM.B - ROOM.T;
    for (const z of [
      { x: ROOM.CX, y: ROOM.T + 9, w, h: 18 },
      { x: ROOM.CX, y: ROOM.B - 9, w, h: 18 },
      { x: ROOM.L + 9, y: ROOM.CY, w: 18, h },
      { x: ROOM.R - 9, y: ROOM.CY, w: 18, h },
    ]) {
      fx(c).add({ shape: 'rect', ...z, delay: 1.5, life: 9999, dps: 10, color: '#ef4444' });
    }
  },
  moves: [
    {
      name: 'METEOR-REGEN',
      windup: 0.4,
      start: (e, c) => {
        for (let i = 0; i < 7; i++) {
          const p = around(c, i, 7, i % 2 === 0 ? 34 : 78, (e.bossMoveIdx ?? 0) * 0.7);
          fx(c).add({ shape: 'circle', x: p.x, y: p.y, r: 20, delay: 0.8 + i * 0.1, life: 0.25, burst: 20, color: '#f97316' });
        }
      },
      recover: 1.4,
    },
    {
      name: 'LAVA-RING',
      windup: 0.7,
      start: (e, c) => {
        fx(c).add({ shape: 'ring', x: e.x, y: e.y, r: 128, r0: 58, gapA: Math.atan2(c.dy, c.dx), gapHalf: 0.55, delay: 0.8, life: 0.5, burst: 24, color: '#ef4444' });
      },
      recover: 1.1,
    },
    {
      name: 'ERDSPALTEN-KREUZ',
      windup: 0.7,
      start: (e, c) => {
        const dirs = c.p2 ? [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4] : [0, Math.PI / 2];
        for (const a of dirs) {
          const dx = Math.cos(a) * 260;
          const dy = Math.sin(a) * 260;
          fx(c).add({ shape: 'line', x: e.x - dx, y: e.y - dy, x2: e.x + dx, y2: e.y + dy, width: 16, delay: 0.75, life: 0.3, burst: 24, color: '#fb923c' });
        }
      },
      recover: 1.2,
    },
  ],
};

// ---------------- S4 Ebene I: CHRONO-WÄCHTER (boss_chrono_sentinel) ----------------
const chrono: BossDef = {
  title: 'CHRONO-WÄCHTER',
  phase2Toast: '🚨 CHRONO-WÄCHTER PHASE II — DIE ZEIGER RASEN!',
  idleSec: [0.8, 0.55],
  idleMove: (e, c) => {
    const want = 112;
    const radial = c.dist > want + 12 ? 1 : c.dist < want - 20 ? -1 : 0;
    glideTo(e, e.x + (c.nx * radial * 40 - c.ny * e.moveDirX * 30), e.y + (c.ny * radial * 40 + c.nx * e.moveDirX * 30), 1);
  },
  moves: [
    {
      name: 'ZEIT-ECHO',
      windup: 0.4,
      start: (_e, c) => {
        fx(c).add({ shape: 'circle', x: c.scene.playerX, y: c.scene.playerY, r: 28, delay: 2.0, life: 0.4, burst: 24, color: '#fde047' });
        if (c.p2) {
          const p = around(c, 0, 1, 60, 1.2);
          fx(c).add({ shape: 'circle', x: p.x, y: p.y, r: 26, delay: 2.4, life: 0.4, burst: 22, color: '#fde047' });
        }
      },
      recover: 0.8,
    },
    {
      name: 'ZEIGER-LASER',
      windup: 0.9,
      start: (e, c) => {
        e.bossLaserAngle = Math.atan2(c.dy, c.dx);
        e.bossLaserDir = (e.bossMoveIdx ?? 0) % 2 === 0 ? 1 : -1;
      },
      windupTick: (e, c) => {
        const n = c.p2 ? 3 : 2;
        for (let k = 0; k < n; k++) fx(c).beams.push({ x: e.x, y: e.y, angle: (e.bossLaserAngle ?? 0) + (k * TAU) / n, len: 240, width: 8, color: '#fde047', warn: true });
      },
      fire: () => sound.playBossLaser(),
      duration: 2.2,
      active: (e, c, t) => {
        const n = c.p2 ? 3 : 2;
        const a = (e.bossLaserAngle ?? 0) + (e.bossLaserDir ?? 1) * t * (c.p2 ? 1.5 : 1.0);
        for (let k = 0; k < n; k++) fx(c).beams.push({ x: e.x, y: e.y, angle: a + (k * TAU) / n, len: 240, width: 8, color: '#fde047', warn: false });
      },
      recover: 1.0,
    },
    {
      name: 'ZEIT-FELD',
      windup: 0.6,
      start: (_e, c) => {
        fx(c).add({ shape: 'circle', x: c.scene.playerX, y: c.scene.playerY, r: 62, delay: 0.6, life: 3.5, slow: 0.55, color: '#38e8d4' });
        if (c.p2) {
          const p = around(c, 0, 1, 70, 2.4);
          fx(c).add({ shape: 'circle', x: p.x, y: p.y, r: 50, delay: 0.6, life: 3.5, slow: 0.55, color: '#38e8d4' });
        }
      },
      recover: 0.9,
    },
  ],
  movesP1: [0, 1, 2],
  movesP2: [1, 0, 2, 1],
};

// ---------------- S4 Ebene II: MONOLITH-KOLOSS (boss_monolith_colossus) ----------------
const monolith: BossDef = {
  title: 'MONOLITH-KOLOSS',
  phase2Toast: '🚨 MONOLITH-KOLOSS PHASE II — SÄULEN BRECHEN AUS DEM BODEN!',
  idleSec: [0.9, 0.65],
  idleMove: (e, c) => approach(e, c, 84, 46),
  onPhase2: (_e, c) => {
    const room = c.scene.currentRoom;
    for (const [x, y] of [[ROOM.CX - 95, ROOM.CY - 32], [ROOM.CX + 95, ROOM.CY - 32], [ROOM.CX, ROOM.CY + 52]]) {
      const near = Math.hypot(c.scene.playerX - x, c.scene.playerY - y) < 40;
      room.obstacles.push({ x: x - 10 + (near ? 44 : 0), y: y - 10, w: 20, h: 20, kind: 'monolith_obelisk' });
    }
    c.scene.rebuildNav();
  },
  moves: [
    {
      name: 'PLATTEN-WIRBEL',
      windup: 0.5,
      duration: 3.0,
      active: (e, c, t) => {
        const n = c.p2 ? 6 : 4;
        const rad = c.p2 ? 64 : 56;
        for (let k = 0; k < n; k++) {
          const a = t * (c.p2 ? 2.8 : 2.2) + (k * TAU) / n;
          fx(c).plates.push({ x: e.x + Math.cos(a) * rad, y: e.y + Math.sin(a) * rad, r: 8, color: '#fde047' });
        }
      },
      recover: 0.8,
    },
    {
      name: 'PLATTEN-WURF',
      windup: 0.6,
      fire: (e) => {
        e.burstDelay = 0;
      },
      duration: 1.2,
      active: (e, c) => {
        e.burstDelay = (e.burstDelay ?? 0) - c.dt;
        if ((e.burstDelay ?? 0) <= 0) {
          e.burstDelay = 0.3;
          sound.playBlaster();
          bossBolt(c.scene, e.x, e.y, Math.atan2(c.dy, c.dx), 150, 18, '#fde047', 6);
        }
      },
      recover: 0.9,
    },
    {
      name: 'ERDSTOSS',
      windup: 0.7,
      start: (e, c) => {
        fx(c).add({ shape: 'circle', x: e.x, y: e.y, r: 70, delay: 0.7, life: 0.3, burst: 26, color: '#a16207' });
        fx(c).add({ shape: 'ring', x: e.x, y: e.y, r: 112, r0: 76, delay: 1.05, life: 0.4, burst: 20, color: '#fde047' });
      },
      fire: (_e, c) => {
        sound.playBossSlam();
        c.scene.triggerShake(0.3, 4);
      },
      recover: 1.1,
    },
  ],
  movesP1: [0, 1, 2],
  movesP2: [2, 0, 1, 2],
};

// ---------------- S4 Ebene III: ★ STERNEN-ARCHON (boss_star_archon) ----------------
const star: BossDef = {
  title: 'STERNEN-ARCHON',
  phase2Toast: '🚨 STERNEN-ARCHON PHASE II — DER ARCHON TEILT SICH!',
  onPhase2: (e, c) => void c.scene.splitBoss(e),
  idleSec: [0.85, 0.6],
  idleMove: (e, c) => floatTop(e, c, 80, 18, 0.9),
  moves: [
    {
      name: 'STERNBILD',
      windup: 0.5,
      start: (e, c) => {
        const chains = c.p2 ? [{ r: 118, a0: 0 }, { r: 70, a0: 0.55 }] : [{ r: 118, a0: 0 }];
        for (const ch of chains) {
          const base = ch.a0 + (e.bossMoveIdx ?? 0) * 0.4;
          const pts = [0, 1, 2, 3, 4].map((k) => ({ x: ROOM.CX + Math.cos(base + (k * 2 * TAU) / 5) * ch.r * 1.4, y: ROOM.CY + Math.sin(base + (k * 2 * TAU) / 5) * ch.r * 0.8 }));
          for (let k = 0; k < 5; k++) {
            const a = clampToRoom(pts[k].x, pts[k].y, 14);
            const b = clampToRoom(pts[(k + 1) % 5].x, pts[(k + 1) % 5].y, 14);
            fx(c).add({ shape: 'line', x: a.x, y: a.y, x2: b.x, y2: b.y, width: 10, delay: 0.9, life: 0.3, burst: 20, color: '#a5b4fc' });
          }
        }
      },
      recover: 1.2,
    },
    {
      name: 'GRAVITATIONS-BRUNNEN',
      windup: 0.5,
      start: (_e, c) => {
        const wells = c.p2 ? [ROOM.CX - 70, ROOM.CX + 70] : [ROOM.CX];
        for (const x of wells) {
          fx(c).add({ shape: 'circle', x, y: ROOM.CY, r: 95, delay: 0.5, life: 2.4, pull: c.p2 ? 80 : 55, color: '#818cf8' });
          fx(c).add({ shape: 'circle', x, y: ROOM.CY, r: 26, delay: 2.9, life: 0.3, burst: 22, color: '#f87171' });
        }
      },
      recover: 3.4,
    },
    {
      name: 'SUPERNOVA',
      windup: 0.5,
      start: (_e, c) => {
        const spots = c.p2 ? [{ x: c.scene.playerX, y: c.scene.playerY }, around(c, 0, 1, 52, 0.9)] : [{ x: c.scene.playerX, y: c.scene.playerY }];
        for (const s of spots) {
          fx(c).add({
            shape: 'circle', x: s.x, y: s.y, r: 18, delay: 1.4, life: 0.3, burst: 14, color: '#fde047',
            onFire: (scene) => {
              for (let k = 0; k < 8; k++) bossBolt(scene, s.x, s.y, (k * TAU) / 8, 100, 12, '#fde047', 3.4, 1.6);
            },
          });
        }
      },
      recover: 0.9,
    },
  ],
  movesP1: [0, 1, 2],
  movesP2: [0, 2, 1, 2, 0],
  // M11 Teilen: Hälfte A zeichnet Sternbilder & Brunnen, Hälfte B wirft Supernovae
  splitMoves: [[0, 1], [2]],
};

export const BOSS_DEFS: Partial<Record<Enemy['kind'], BossDef>> = {
  boss_breacher: krall,
  boss_slag_overlord: slag,
  boss_forge_warden: forge,
  boss_vulkan_titan: vulkan,
  boss_chrono_sentinel: chrono,
  boss_monolith_colossus: monolith,
  boss_star_archon: star,
};
