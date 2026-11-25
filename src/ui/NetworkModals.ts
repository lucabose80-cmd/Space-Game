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
import {
  formatTrialRemaining,
  formatWeekLabel,
  TRIAL_BADGE_META,
  TRIAL_PAR_TIMES,
  TRIAL_SECTOR_NAMES,
} from '../systems/weeklyTrial';
import type {
  LeaderboardEntry,
  RunSummary,
  SectorId,
  TrialBadge,
  WeeklyTrialEntry,
  WeeklyTrialInfo,
  WeeklyTrialRecord,
} from '../types';
import { RIFT_MUTATORS } from '../data/infusions';

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

// ==================== F4: GALAKTISCHE PRÜFUNG ====================
function badgeIcon(b: TrialBadge | null | undefined): string {
  return b ? TRIAL_BADGE_META[b].icon : '—';
}

/** Dritte Karte im 5.-Tor-Modal (Ziel-Wahl). */
export function renderTrialGateCardHtml(
  info: WeeklyTrialInfo,
  rec: WeeklyTrialRecord | null,
  unlocked: boolean,
): string {
  const mut = RIFT_MUTATORS[info.mutator];
  const par = TRIAL_PAR_TIMES[info.sector];
  const own = rec && rec.weekId === info.weekId ? rec : null;
  const ownLine = own
    ? own.completed
      ? `Dein Bestwert: <strong style="color:#38e8d4">${formatDurationSec(own.bestTimeSec)}</strong> ${badgeIcon(own.badge)} · ${own.attempts} Versuch${own.attempts === 1 ? '' : 'e'}`
      : `Bisher: Ebene ${own.bestFloorReached}/3 · ${own.attempts} Versuch${own.attempts === 1 ? '' : 'e'}`
    : 'Noch kein Versuch diese Woche';
  return `
    <div class="inspector-box" style="gap:7px;border-color:${unlocked ? 'rgba(253,224,71,0.75)' : 'rgba(100,116,139,0.4)'};background:${unlocked ? 'rgba(250,204,21,0.07)' : 'rgba(15,23,42,0.55)'}">
      <div style="font-family:var(--font-pixel);font-size:11px;color:${unlocked ? '#fde047' : '#94a3b8'};white-space:nowrap">🏅 GALAKT. PRÜFUNG</div>
      <div style="font-size:11.5px;color:#e2e8f0;line-height:1.4">
        <strong>${formatWeekLabel(info.weekId)}</strong> · Sektor ${info.sector} (${TRIAL_SECTOR_NAMES[info.sector]})<br/>
        Mutator: <strong style="color:${mut.color}">${mut.icon} ${escapeHtml(mut.name)}</strong>
      </div>
      <div style="font-size:10.5px;color:var(--text-muted);line-height:1.45">
        Endet in ${formatTrialRemaining(info.endsAtUtc)} · 🥇 &lt; ${formatDurationSec(par.gold)} · 🥈 &lt; ${formatDurationSec(par.silver)}<br/>
        ${ownLine}
      </div>
      <div style="font-size:10px;color:var(--text-muted)">Normierte MK-V-Ausrüstung · keine Prägung, Drohne oder Elixier · keine Beute</div>
      ${
        unlocked
          ? `<button id="btn-launch-weekly-trial" class="btn btn-primary" style="margin-top:auto;background:rgba(250,204,21,0.25);border-color:#fde047;color:#fef9c3">🏅 Prüfung starten</button>`
          : `<button class="btn" disabled style="margin-top:auto">🔒 Besiege erst Sektor 1</button>`
      }
    </div>`;
}

/** Ergebnis-Karte nach einer Prüfung. Upload-Status wird per #trial-upload-status nachgereicht. */
export function renderWeeklyTrialResultHtml(summary: RunSummary): string {
  const res = summary.trialResult;
  const rec = res?.record;
  const outcome = summary.trialOutcome ?? 'abort';
  const title =
    outcome === 'victory' ? '🏅 PRÜFUNG BESTANDEN!' : outcome === 'defeat' ? '💀 IN DER PRÜFUNG GEFALLEN' : '⏏ PRÜFUNG ABGEBROCHEN';
  const titleColor = outcome === 'victory' ? '#fde047' : outcome === 'defeat' ? 'var(--accent-coral)' : '#94a3b8';
  const badge = res?.badge ?? null;
  const badgeHtml = badge
    ? `<div style="text-align:center;font-size:44px;line-height:1.1">${TRIAL_BADGE_META[badge].icon}</div>
       <div style="text-align:center;font-family:var(--font-pixel);font-size:12px;color:${TRIAL_BADGE_META[badge].color}">${TRIAL_BADGE_META[badge].label}-Abzeichen</div>`
    : '';
  return `
    <div class="modal-window" style="max-width:560px">
      <div class="modal-header">
        <span class="modal-title" style="color:${titleColor};white-space:nowrap">${title}</span>
        <button id="modal-close-btn" class="modal-close" style="white-space:nowrap">ESC ✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:10px">
        ${badgeHtml}
        <div class="m8-stat-grid">
          <div class="m8-stat-card"><span class="m8-stat-label">ZEIT</span><span class="m8-stat-val" style="color:#38e8d4">${formatDurationSec(summary.runDurationSec)}</span></div>
          <div class="m8-stat-card"><span class="m8-stat-label">ERREICHT</span><span class="m8-stat-val">Ebene ${Math.min(3, summary.floorReached)}/3</span></div>
          <div class="m8-stat-card"><span class="m8-stat-label">RÄUME · GEGNER</span><span class="m8-stat-val">${summary.roomsCleared} · ${summary.enemiesDefeated}</span></div>
          <div class="m8-stat-card"><span class="m8-stat-label">VERSUCH NR.</span><span class="m8-stat-val">${rec?.attempts ?? 1}</span></div>
        </div>
        ${
          res?.isNewBest
            ? `<div class="m8-pill" style="border-color:#fde047;color:#fde047;justify-content:center;padding:5px">★ NEUER WOCHEN-BESTWERT!</div>`
            : `<div class="m9-file-sub" style="text-align:center">Dein Wochen-Bestwert bleibt: ${
                rec?.completed ? formatDurationSec(rec.bestTimeSec) : `Ebene ${rec?.bestFloorReached ?? 0}/3`
              }</div>`
        }
        <div class="m9-file-sub" style="text-align:center">Deine Fracht &amp; Credits blieben unberührt — in der Prüfung zählt nur Ruhm.</div>
        <div id="trial-upload-status" class="m9-file-sub" style="text-align:center;color:#7dd3fc">☁ Ergebnis wird gemeldet …</div>
        <div class="m9-file-sub" style="text-align:center">Die Wochen-Rangliste findest du an der <strong>Kapitäns-Tafel</strong> auf der Promenade (Tab „Prüfung“).</div>
        <button id="btn-trial-result-close" class="btn btn-primary">Weiter</button>
      </div>
    </div>`;
}

/** Tab „Prüfung“ der Kapitäns-Tafel. */
export function renderTrialBoardHtml(args: {
  entries: WeeklyTrialEntry[];
  localUid: string;
  info: WeeklyTrialInfo;
  loading: boolean;
}): string {
  const { entries, localUid, info, loading } = args;
  const mut = RIFT_MUTATORS[info.mutator];
  const rows = [...entries].filter((e) => e.weekId === info.weekId).sort((a, b) => a.score - b.score).slice(0, 30);
  const rowsHtml = rows.length
    ? rows
        .map((r, idx) => {
          const isMe = r.uid === localUid;
          const suit = SUIT_THEMES[r.suitTheme] ?? SUIT_THEMES.classic;
          const wep = WEAPON_META[r.weapon] ?? WEAPON_META.blade;
          const rankColor = idx === 0 ? '#fde047' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#fb923c' : '#64748b';
          return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid ${isMe ? 'rgba(56,232,212,0.7)' : 'var(--border-steel)'};background:${isMe ? 'rgba(56,232,212,0.1)' : 'rgba(13,20,34,0.72)'}">
              <div style="font-family:var(--font-pixel);font-size:12px;width:24px;text-align:center;color:${rankColor}">#${idx + 1}</div>
              <span style="width:11px;height:11px;border-radius:50%;background:${suit.accent};box-shadow:0 0 8px ${suit.auraColor};flex-shrink:0" title="Anzug: ${escapeHtml(suit.name)}"></span>
              <img src="${wep.iconUrl}" alt="${escapeHtml(wep.shortName)}" style="width:20px;height:20px;image-rendering:pixelated;flex-shrink:0" title="Waffe: ${escapeHtml(wep.name)}" />
              <div style="flex:1;min-width:0">
                <strong style="font-family:var(--font-pixel);font-size:10.5px;color:${isMe ? '#38e8d4' : '#f8fafc'}">${escapeHtml(r.captainName)}</strong>
                ${isMe ? '<span class="m9-me-tag">DU</span>' : ''}
                <div class="m9-file-sub">${r.attempts} Versuch${r.attempts === 1 ? '' : 'e'}</div>
              </div>
              <div style="text-align:right">
                <div style="font-family:var(--font-pixel);font-size:11px;color:${r.completed ? '#38e8d4' : '#94a3b8'}">${
                  r.completed ? `⏱ ${formatDurationSec(r.timeSec)}` : `Ebene ${r.floorReached}/3`
                }</div>
                <div style="font-size:13px">${badgeIcon(r.badge)}</div>
              </div>
            </div>`;
        })
        .join('')
    : `<div class="inspector-box" style="color:var(--text-muted);font-size:12px">${
        loading ? 'Lade Wochen-Rangliste …' : 'Noch keine Prüfungs-Ergebnisse diese Woche. Starte die Prüfung am 5. Tiefenraum-Tor im Raumhafen!'
      }</div>`;
  return `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="npc-banner" style="border-color:rgba(253,224,71,0.42)">
        <span style="font-size:30px">🏅</span>
        <div style="flex:1;min-width:0">
          <strong style="font-family:var(--font-pixel);font-size:11px;color:#fde047">GALAKTISCHE PRÜFUNG · ${formatWeekLabel(info.weekId)}</strong>
          <div class="m9-file-sub" style="margin-top:3px">
            Sektor ${info.sector} (${TRIAL_SECTOR_NAMES[info.sector]}) · Mutator ${mut.icon} ${escapeHtml(mut.name)} · endet in ${formatTrialRemaining(info.endsAtUtc)}
          </div>
          <div class="m9-file-sub">Identisches Layout &amp; normierte Ausrüstung für alle Kapitäne — schnellste Zeit gewinnt.</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:290px;overflow-y:auto">${rowsHtml}</div>
    </div>`;
}
