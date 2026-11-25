/**
 * Meilenstein 9 — Galaktisches Netzwerk: reine HTML-Renderer (keine DOM-Zugriffe, keine Events).
 * Die Event-Bindings bleiben im UIManager (Kapitäns-Tafel) bzw. in main.ts.
 * ALLE Fremd-Strings (Namen, Grüße, Aktivitäten) laufen durch escapeHtml!
 */
import { ACHIEVEMENT_DEFS, SUIT_THEMES } from '../data/companions';
import { getInfusionDef } from '../data/infusions';
import { getMarketTrendPctLabel, getTodayMarketTrend } from '../data/marketTrends';
import { WEAPON_META } from '../data/upgrades';
import { formatDurationSec, formatRelativeTime } from '../services/firebaseService';
import type { LeaderboardEntry, SectorId } from '../types';

export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dayLabel(d: number | null | undefined): string {
  return d === null || d === undefined ? '—' : `Tag ${d}`;
}

// ==================== F1: KLICKBARE KAPITÄNS-AKTE ====================
export function renderCaptainFileHtml(e: LeaderboardEntry, isMe: boolean): string {
  const suit = SUIT_THEMES[e.suitTheme] ?? SUIT_THEMES.classic;
  const wep = WEAPON_META[e.equippedWeapon] ?? WEAPON_META.blade;
  const inf = e.activeInfusion ? getInfusionDef(e.activeInfusion) : null;
  const unlocked = new Set(e.achievementIds ?? []);
  const hasAchList = Array.isArray(e.achievementIds);

  const sectorCells = ([1, 2, 3, 4, 5] as SectorId[])
    .map(
      (sid) => `
      <div class="m9-file-cell">
        <div class="m9-file-label">${sid === 5 ? '5. TOR' : `SEKTOR ${sid}`}</div>
        <div class="m9-file-val" style="color:#38e8d4">${formatDurationSec(e.bestSectorClearSec?.[sid])}</div>
      </div>`,
    )
    .join('');

  const achievementsHtml = hasAchList
    ? `<div class="m9-ach-grid">${ACHIEVEMENT_DEFS.map((a) => {
        const on = unlocked.has(a.id);
        return `<span class="m9-ach ${on ? 'on' : ''}" title="${escapeHtml(a.title)} — ${escapeHtml(a.desc)}">${a.icon}</span>`;
      }).join('')}</div>
      <div class="m9-file-sub">${unlocked.size} / ${ACHIEVEMENT_DEFS.length} Erfolge freigeschaltet</div>`
    : `<div class="m9-file-sub">${e.achievementsCount} / ${ACHIEVEMENT_DEFS.length} Erfolge (Details erscheinen nach dem nächsten Sync)</div>`;

  const badges = e.trialBadges ?? { gold: 0, silver: 0, bronze: 0 };
  const totalBadges = badges.gold + badges.silver + badges.bronze;
  const trialHtml =
    totalBadges > 0
      ? `<div class="m9-file-badges">
           <span title="Gold">🥇 ${badges.gold}</span><span title="Silber">🥈 ${badges.silver}</span><span title="Bronze">🥉 ${badges.bronze}</span>
         </div>
         <div class="m9-file-sub">${
           e.bestTrialTimeSec
             ? `Beste Prüfung: ${formatDurationSec(e.bestTrialTimeSec)}${e.bestTrialWeekId ? ` (${escapeHtml(e.bestTrialWeekId)})` : ''}`
             : 'Galaktische Prüfung bestanden'
         }</div>`
      : `<div class="m9-file-sub">Noch keine Prüfungs-Abzeichen.</div>`;

  const greeting = e.ghostGreeting
    ? `<div class="m9-file-greeting">„${escapeHtml(e.ghostGreeting)}“</div>`
    : '';

  return `
    <div class="m9-file">
      <div class="m9-file-head">
        <span class="m9-suit-dot" style="background:${suit.accent};box-shadow:0 0 10px ${suit.auraColor}"></span>
        <div style="flex:1;min-width:0">
          <div class="m9-file-name">${escapeHtml(e.captainName)}${isMe ? ' <span class="m9-me-tag">DU</span>' : ''}</div>
          <div class="m9-file-sub">${e.ngPlusLevel > 0 ? `NG+${e.ngPlusLevel} · ` : ''}${e.omegaCleared ? '🌌 Omega-Bezwinger' : `${e.sectorsCleared}/4 Sektoren`} · ${escapeHtml(suit.name)}${
            e.updatedAt ? ` · zuletzt aktiv ${formatRelativeTime(e.updatedAt)}` : ''
          }</div>
        </div>
      </div>
      ${greeting}
      <div class="m9-file-grid">
        <div class="m9-file-box">
          <div class="m9-file-title">⚔ HAUPTWAFFE</div>
          <div class="m9-file-row">
            <img src="${wep.iconUrl}" alt="${escapeHtml(wep.shortName)}" style="width:28px;height:28px;image-rendering:pixelated" />
            <div>
              <div class="m9-file-val" style="color:${wep.accentColor}">${escapeHtml(wep.name)}</div>
              <div class="m9-file-sub">${inf ? `${inf.icon} ${escapeHtml(inf.name)}` : 'Keine Prägung'}</div>
            </div>
          </div>
        </div>
        <div class="m9-file-box">
          <div class="m9-file-title">💰 HÄNDLER</div>
          <div class="m9-file-val" style="color:#fbbf24">${e.totalEarned.toLocaleString('de-DE')} Cr</div>
          <div class="m9-file-sub">${e.totalSold} Relikte · Shop Stufe ${e.shopTier + 1}</div>
        </div>
      </div>
      <div class="m9-file-box">
        <div class="m9-file-title">⏱ SEKTOR-BESTZEITEN</div>
        <div class="m9-file-cells">${sectorCells}</div>
      </div>
      <div class="m9-file-grid">
        <div class="m9-file-box">
          <div class="m9-file-title">☀ TAGE-REKORDE</div>
          <div class="m9-file-sub">S4: <strong>${dayLabel(e.fastestSector4Days)}</strong></div>
          <div class="m9-file-sub">Omega: <strong>${dayLabel(e.fastestOmegaDays)}</strong></div>
          <div class="m9-file-sub">NG+: <strong>${dayLabel(e.fastestNgPlusDays)}</strong></div>
        </div>
        <div class="m9-file-box">
          <div class="m9-file-title">🌀 RIFT</div>
          <div class="m9-file-val" style="color:#e879f9">${(e.deepestRiftFloor ?? 0) > 0 ? `∞ Ebene ${e.deepestRiftFloor}` : '—'}</div>
          <div class="m9-file-sub">${e.riftsCleared ?? 0} Rift-Risse gesäubert</div>
        </div>
      </div>
      <div class="m9-file-grid">
        <div class="m9-file-box">
          <div class="m9-file-title">🏆 ERFOLGE</div>
          ${achievementsHtml}
        </div>
        <div class="m9-file-box">
          <div class="m9-file-title">🏅 PRÜFUNGS-ABZEICHEN</div>
          ${trialHtml}
        </div>
      </div>
    </div>`;
}

// ==================== F2: GLOBALE MARKT-KONJUNKTUR ====================
/** Banner für die Kapitäns-Tafel (alle Tabs). */
export function renderTrendBannerHtml(now: Date = new Date()): string {
  const t = getTodayMarketTrend(now);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const hours = Math.max(0, Math.ceil((midnight - now.getTime()) / 3600000));
  return `
    <div class="m9-trend-banner" style="border-color:${t.accent}" title="Weltweiter Tages-Trend — gilt für alle Kapitäne gleichzeitig">
      <span class="m9-trend-icon" style="color:${t.accent}">${t.icon}</span>
      <div style="flex:1;min-width:0">
        <div class="m9-trend-title" style="color:${t.accent}">MARKT-KONJUNKTUR · ${escapeHtml(t.name)}</div>
        <div class="m9-file-sub">${escapeHtml(t.description)} · noch ~${hours} Std. (bis 00:00 UTC)</div>
      </div>
    </div>`;
}

/** Kleine Pille „📈 +25 %“ / „📉 −15 %“ für Codex & Podest-Modal, leer wenn Item unbetroffen. */
export function renderTrendPillHtml(itemId: string, now: Date = new Date()): string {
  const label = getMarketTrendPctLabel(itemId, now);
  if (!label) return '';
  const up = label.startsWith('+');
  const t = getTodayMarketTrend(now);
  return `<span class="m9-trend-pill ${up ? 'up' : 'down'}" title="${escapeHtml(t.name)}: ${escapeHtml(t.description)}">${up ? '📈' : '📉'} ${label}</span>`;
}
