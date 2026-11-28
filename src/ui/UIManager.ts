import { scaledSellValue } from '../data/balance';
import { getHDArt } from '../assets/artLoader';
import {
  ACHIEVEMENT_DEFS,
  COMPANION_DEFS,
  COMPANION_ORDER,
  evaluateCompanionUnlock,
  MARKET_EVENT_META,
  MUSIC_TRACK_META,
  SUIT_THEME_ORDER,
  SUIT_THEMES,
} from '../data/companions';
import { GHOST_GREETING_MAX, sanitizeGreeting } from '../data/ghostGreetings';
import { ALCHEMY_BUFFS } from '../data/guildMarket';
import { getInfusionDef, INFUSIONS } from '../data/infusions';
import { getTodayMarketTrend } from '../data/marketTrends';
import { getItemDef, ITEMS, RARITY_META } from '../data/items';
import { UPGRADE_TRACKS, WEAPON_META } from '../data/upgrades';
import { sound } from '../engine/audio';
import {
  firebaseService,
  formatDurationSec,
  formatRelativeTime,
} from '../services/firebaseService';
import { galacticNetwork } from '../services/galacticNetwork';
import {
  getDemandLabel,
  getDemandLevel,
  getSuggestedStartPrice,
} from '../systems/economy';
import type { StoryScene } from '../data/story/storyTypes';
import type { GameState } from '../systems/gameState';
import { getSceneById } from '../systems/storyEngine';
import {
  AIM_MODES,
  getDeviceSettings,
  isLandscapeNow,
  LANDSCAPE_TOUCH_CAP,
  SCREEN_SHAKES,
  saveDeviceSettings,
  TEXT_SPEEDS,
  TOUCH_SCALES,
} from '../systems/deviceSettings';
import { getCurrentWeeklyTrial } from '../systems/weeklyTrial';
import {
  addItemAnywhere,
  addItemToBackpack,
  countBackpackItems,
  countItemTotal,
  depositAllCargoToChest,
  getAllAvailableShopItems,
  quickTransferSlot,
  swapOrMergeSlots,
  takeOneFromSlot,
  type ContainerId,
} from '../systems/inventory';
import type {
  ActivityFeedEntry,
  CompanionId,
  HagglePayload,
  InfusionId,
  ItemStack,
  LeaderboardEntry,
  MusicTrack,
  PedestalSlot,
  RunSummary,
  SceneId,
  SectorId,
  ShiftSummary,
  SuitThemeId,
  UpgradeKey,
  WeaponId,
  WeeklyTrialEntry,
  WeeklyTrialInfo,
} from '../types';
import type { RoomChest } from '../world/dungeonGen';
import {
  renderAlchemyBarModal,
  renderHaggleModal,
  renderPatronsModal,
  renderShiftSummaryModal,
  renderTradeBankModal,
  type MarketModalHost,
} from './MarketModals';
import {
  escapeHtml,
  renderCaptainFileHtml,
  renderTrendBannerHtml,
  renderTrendPillHtml,
  renderTrialBoardHtml,
  renderTrialGateCardHtml,
  renderWeeklyTrialResultHtml,
} from './NetworkModals';
import { bindLoadout, renderLoadoutHtml } from './LoadoutPanel';
import { renderChronicleHtml, StoryDialogController, type StoryDialogOptions, type StoryHost } from './StoryModals';
import { CUTSCENE_CATALOG, type ReplayableCutsceneId } from '../scenes/StoryPanelCutscene';
import type { UpgradeCutsceneConfig } from '../scenes/UpgradeCutsceneOverlay';

export interface UIHooks {
  onStartNewGame: () => void;
  onContinueGame: () => void;
  onToggleShopOpen: () => void;
  onSwapWeapon: () => void;
  onModalStateChange: (open: boolean) => void;
  onMuteToggle: () => void;
  onMusicToggle: () => void;
  onReplayCutscene?: (id: ReplayableCutsceneId) => void;
  onUpgradeCutscene?: (config: UpgradeCutsceneConfig, onDone?: () => void) => void;
}

export type GuildTab = 'leaderboard' | 'feed' | 'trial' | 'account' | 'file';

export class UIManager {
  private state: GameState;
  private hooks: UIHooks;

  private hudEl: HTMLElement;
  private modalEl: HTMLElement;
  private toastEl: HTMLElement;
  private titleEl: HTMLElement;

  public currentScene: SceneId = 'shop';
  public dungeonSector: SectorId = 1;
  public dungeonFloor: 1 | 2 | 3 = 1;
  public dungeonEndlessRift = false;
  public dungeonWeeklyTrial = false;
  public dungeonRiftDepth = 0;
  public shopIsOpen = false;
  public modalOpen = false;
  public titleVisible = true;

  private selectedSlot: { container: ContainerId; index: number } | null = null;
  private activeInvTab: 'bag' | 'codex' | 'logbook' | 'help' = 'bag';
  private chestMode = false;

  // Pedestal modal working state
  private activePedestal: PedestalSlot | null = null;
  private pickedItemId: string | null = null;
  private pickedPrice = 50;
  private pickedQty = 1;

  constructor(state: GameState, hooks: UIHooks) {
    this.state = state;
    this.hooks = hooks;

    this.hudEl = document.getElementById('hud-layer')!;
    this.modalEl = document.getElementById('modal-layer')!;
    this.toastEl = document.getElementById('toast-layer')!;
    this.titleEl = document.getElementById('title-overlay')!;

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.closeModal();
      }
    });
  }

  public showTitle(): void {
    this.titleVisible = true;
    this.titleEl.classList.remove('hidden');
    this.hooks.onModalStateChange(true);
    const hasSave = this.state.hasSave();

    this.titleEl.innerHTML = `
      <div class="title-card">
        <div class="title-kicker">PORT SOLARIS · ASTRO-BARTER${this.state.ngPlusLevel > 0 ? ` · NG+${this.state.ngPlusLevel}` : ''}</div>
        <h1 class="title-logo">STARLIGHTER</h1>
        <p class="title-sub">
          Führe deinen Relikt-Shop auf Port Solaris, schmiede 6 Waffenklassen bis Ältesten-Meister MK-VIII bei Kael
          und bezwinge alle 4 Sektoren sowie das 5. Tiefenraum-Tor (Omega-Anomalie)!
        </p>
        <div class="title-buttons">
          ${
            hasSave
              ? `<button id="btn-continue" class="btn btn-primary">Weiterspielen (Tag ${this.state.day})</button>`
              : ''
          }
          <button id="btn-new-game" class="btn ${hasSave ? '' : 'btn-primary'}">
            ${hasSave ? 'Neues Spiel' : 'Expedition starten'}
          </button>
        </div>
        <div class="title-controls-grid">
          <div><strong>WASD / Stick / Pad</strong> Bewegen</div>
          <div><strong>SPACE / A</strong> Jetpack-Dash</div>
          <div><strong>LMB / J / X</strong> Aktive Waffe</div>
          <div><strong>RMB / K / B</strong> Schild / Spezial</div>
          <div><strong>C / RB</strong> Waffe wechseln</div>
          <div><strong>E / Y</strong> Interagieren / Kasse</div>
          <div><strong>I / TAB</strong> Fracht &amp; Logbuch</div>
          <div><strong>E</strong> Teleporter: Extraktion (Start-Raum, nach Bossen, Notfall-Bake)</div>
        </div>
      </div>
    `;

    this.titleEl.querySelector('#btn-continue')?.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      this.hideTitle();
      this.hooks.onContinueGame();
    });

    this.titleEl.querySelector('#btn-new-game')?.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      this.hideTitle();
      this.hooks.onStartNewGame();
    });
  }

  public hideTitle(): void {
    this.titleVisible = false;
    this.titleEl.classList.add('hidden');
    this.hooks.onModalStateChange(this.modalOpen);
    this.renderHud();
  }

  public toast(msg: string, tone: 'info' | 'good' | 'warn' = 'info'): void {
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.textContent = msg;
    this.toastEl.appendChild(el);
    window.setTimeout(() => {
      el.remove();
    }, 3400);
  }

  public renderHud(): void {
    if (this.titleVisible) {
      this.hudEl.innerHTML = '';
      return;
    }

    const stats = this.state.getStats();
    const hpPct = Math.max(0, Math.min(100, (this.state.hp / stats.maxHp) * 100));
    const enPct = Math.max(0, Math.min(100, this.state.energy));
    const bagCount = countBackpackItems(this.state.inventory);
    const wMeta = WEAPON_META[this.state.equippedWeapon];
    const trialRun = (this.currentScene === 'dungeon' && this.dungeonWeeklyTrial);
    const compDef = this.state.equippedCompanion && !trialRun ? COMPANION_DEFS[this.state.equippedCompanion] : null;
    const evMeta = MARKET_EVENT_META[this.state.marketEvent];
    const isNight = this.state.timeOfDay === 'night';
    const ngTag = this.state.ngPlusLevel > 0 ? ` · NG+${this.state.ngPlusLevel}` : '';
    const timeLabel = isNight ? `🌙 NACHT ${this.state.day}${ngTag}` : `☀ TAG ${this.state.day}${ngTag}`;
    const timeColor = isNight ? '#818cf8' : 'var(--accent-amber)';

    const floorTag =
      this.dungeonWeeklyTrial
        ? `🏅 GALAKTISCHE PRÜFUNG · EBENE ${Math.max(1, this.dungeonFloor)}/3`
        : this.dungeonEndlessRift
        ? `∞ UNENDLICHE SPIRALE · EBENE ${Math.max(1, this.dungeonRiftDepth)}`
        : this.dungeonSector === 5
          ? '5. TOR · OMEGA-ANOMALIE'
        : this.dungeonSector === 4
          ? this.dungeonFloor === 1
            ? 'EBENE I · STERNEN-VORHOF'
            : this.dungeonFloor === 2
              ? 'EBENE II · ASTRAL-BIBLIOTHEK'
              : 'EBENE III · THRON DER ÄLTESTEN'
          : this.dungeonSector === 3
            ? this.dungeonFloor === 1
              ? 'EBENE I · SCHLACKEN-HALLE'
              : this.dungeonFloor === 2
                ? 'EBENE II · SCHMELZ-TRAKT'
                : 'EBENE III · HERZ DER SONNE'
            : this.dungeonSector === 2
              ? this.dungeonFloor === 1
                ? 'EBENE I · QUARZ-KAVERNE'
                : this.dungeonFloor === 2
                  ? 'EBENE II · RESONANZ-ADER'
                  : 'EBENE III · HERZ DES NEBELS'
              : this.dungeonFloor === 1
                ? 'EBENE I · FRACHTDECK'
                : this.dungeonFloor === 2
                  ? 'EBENE II · MASCHINEN-DECK'
                  : 'EBENE III · REAKTOR-KERN';

    const locationText =
      this.currentScene === 'shop'
        ? `${timeLabel} · ASTRO-BARTER`
        : this.currentScene === 'backroom'
          ? `${timeLabel} · KAPITÄNS-QUARTIER`
          : this.currentScene === 'hub'
            ? `${timeLabel} · PORT SOLARIS`
            : this.currentScene === 'market_terrace'
              ? `${timeLabel} · MARKTPLATZ-TERRASSE`
              : this.currentScene === 'hangar'
                ? `${timeLabel} · RAUMHAFEN (DOCKS I–IV & 5. TOR)`
                : trialRun
                  ? floorTag
                  : this.dungeonSector === 5
                  ? `🌌 ${floorTag}${ngTag}`
                  : isNight
                    ? `🌙 S${this.dungeonSector} · ${floorTag} (+35% RAR)`
                    : `SEKTOR ${this.dungeonSector} · ${floorTag}`;

    const keysUnlocked =
      (this.state.sector1Cleared ? 1 : 0) +
      (this.state.sector2Cleared ? 1 : 0) +
      (this.state.sector3Cleared ? 1 : 0) +
      (this.state.sector4Cleared ? 1 : 0);

    const hintText =
      this.currentScene === 'shop'
        ? this.shopIsOpen
          ? 'Kunden stöbern! Geh rechts hinter den Tresen [E] (VIP/Stammkunden: Feilschen!) · Diebe fangen [SPACE]!'
          : isNight
            ? 'Podeste [E] · Schnell-Nachfüllen [F] · Hinten links: Quartier · Laden öffnen [O]'
            : '☀ Tagsüber ist der Laden zu — Podeste bestücken [E], dann ab in den Dungeon! Die Nachtschicht kommt nach dem Run.'
        : this.currentScene === 'backroom'
          ? 'Kapitäns-Quartier: Ruhekoje, Drohnen-Dock, Trophäen-Altar, Jukebox, Waffenschrank (Logbuch & Anzug-Stil darin) & Lagertruhen!'
          : this.currentScene === 'hub'
            ? isNight
              ? '🌙 Nacht: Laden öffnen (Schicht) oder Nacht-Run (+35 % Rar-Loot, Schicht fällt aus) · Unten: Marktplatz-Terrasse · Rechts: Raumhafen!'
              : `Oben: Kael, Kapitäns-Tafel & Lyra · Unten: ${
                  this.state.isHubBuildingOpen('blackmarket') ? 'Nyx' : 'Schwarzmarkt (bald)'
                }, ${this.state.isHubBuildingOpen('terrace') ? 'Marktplatz-Terrasse' : 'Terrasse (gesperrt)'} & ${
                  this.state.isHubBuildingOpen('techlab') ? 'Vex' : 'Tech-Labor (im Aufbau)'
                } · Rechts: Raumhafen!`
            : this.currentScene === 'market_terrace'
              ? 'Marktplatz-Terrasse: Links Milo’s Alchemie-Bar (Run-Elixiere) · Mitte Händler-Gilde · Rechts Solaris-Handelsbank!'
              : this.currentScene === 'hangar'
                ? keysUnlocked >= 4
                  ? '★ ALLE 4 SCHLÜSSEL AKTIV! Betritt das leuchtende 5. Tor in der Mitte für die OMEGA-ANOMALIE!'
                  : `Raumhafen: Docks I–IV starten in die 4 Sektoren · 5. Tor (Mitte): Galaktische Prüfung & Omega (${keysUnlocked}/4 Siegel)!`
                : trialRun
                  ? '🏅 PRÜFUNG: Normierte Ausrüstung · keine Beute · schnellste Zeit zählt · [E] im Start-Raum zum Abbrechen'
                  : `${wMeta.name} (${this.state.equippedWeapon === 'blade' ? 'Schild verbraucht EN · Perfekt-Parade!' : wMeta.secondaryLabel}) · Teleporter [E] = Extraktion`;

    const activeBuffDef = this.state.activeAlchemyBuff && !trialRun ? ALCHEMY_BUFFS[this.state.activeAlchemyBuff] : null;
    const buffPillHtml = activeBuffDef
      ? `<div style="margin-top:2px;padding:2px 6px;border:1px solid ${activeBuffDef.color};background:rgba(15,23,42,0.88);font-family:var(--font-pixel);font-size:8px;color:${activeBuffDef.color};text-align:center" title="${activeBuffDef.name}: ${activeBuffDef.effectSummary}">${activeBuffDef.icon} ${activeBuffDef.shortName} AKTIV</div>`
      : '';
    const bankPillHtml =
      this.state.hasReadyBankPayout() && this.currentScene !== 'dungeon'
        ? `<div style="margin-top:2px;padding:2px 6px;border:1px solid #4ade80;background:rgba(6,58,40,0.88);font-family:var(--font-pixel);font-size:8px;color:#4ade80;text-align:center" title="Handelsroute abgeschlossen — auf der Marktplatz-Terrasse abholen!">🏦 AUSZAHLUNG BEREIT</div>`
        : '';

    const trend = getTodayMarketTrend();
    const trendPillHtml =
      trend.id !== 'calm' &&
      (this.currentScene === 'shop' || this.currentScene === 'hub' || this.currentScene === 'market_terrace')
        ? `<div style="margin-top:2px;padding:2px 6px;border:1px solid ${trend.accent};background:rgba(15,23,42,0.85);font-family:var(--font-pixel);font-size:8px;color:${trend.accent};text-align:center" title="Globale Markt-Konjunktur: ${trend.description}">${trend.icon} ${trend.name.toUpperCase()}</div>`
        : '';

    const eventPillHtml =
      trendPillHtml +
      (this.state.marketEvent !== 'normal' && (this.currentScene === 'shop' || this.currentScene === 'hub')
        ? `<div style="margin-top:2px;padding:2px 6px;border:1px solid ${evMeta.color};background:rgba(15,23,42,0.85);font-family:var(--font-pixel);font-size:8px;color:${evMeta.color};text-align:center" title="${evMeta.description}">★ ${evMeta.shortBadge}</div>`
        : '') +
      buffPillHtml +
      bankPillHtml;

    // M10-C (U1): Kampf-HUD (HP/EN/Stim/Waffe/Bot) nur im Dungeon; sonst kompakte Status-Pille
    const combatHud = this.currentScene === 'dungeon';
    const pinCollapsed = !combatHud && this.readPinCollapsed();
    const statusPillHtml = `
          <div class="hud-status-pill" title="${this.state.credits} Credits">
            <span style="color:${timeColor}">${timeLabel}</span>
            <span class="hud-status-sep">·</span>
            <span class="hud-credits">${this.state.credits} CR</span>
            ${
              this.currentScene === 'shop'
                ? `<span class="hud-status-sep">·</span><span style="color:${this.shopIsOpen ? 'var(--accent-emerald)' : 'var(--text-muted)'}">${this.shopIsOpen ? 'OFFEN' : 'ZU'}</span>`
                : ''
            }
          </div>
          ${eventPillHtml}`;

    const pinnedList = this.state.getPinnedRecipeDetails();
    const pinTrackerHtml =
      pinnedList.length > 0
        ? `
        <div class="hud-pin-tracker">
          <div class="hud-pin-head ${combatHud ? '' : 'toggleable'}" ${combatHud ? '' : 'data-pin-toggle="1"'}>
            <span>📌 MERKLISTE (${pinnedList.length})${combatHud ? '' : pinCollapsed ? ' ▸' : ' ▾'}</span>
          </div>
          ${pinCollapsed ? '' : pinnedList
            .map(
              (rec) => `
            <div class="hud-pin-entry">
              <div class="hud-pin-title-row">
                <span style="color:${rec.canAffordNow ? '#4ade80' : '#f8fafc'}">${rec.canAffordNow ? '✓ ' : ''}${rec.title}</span>
                <button class="hud-pin-unpin" data-pin-key="${rec.key}" title="Von Merkliste entfernen">✕</button>
              </div>
              <div class="hud-pin-mats">
                ${rec.materials
                  .map(
                    (m) =>
                      `<span class="hud-pin-mat ${m.owned >= m.required ? 'done' : ''}">${m.name}: ${m.owned}/${m.required}</span>`,
                  )
                  .join('')}
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      `
        : '';

    this.hudEl.innerHTML = `
      <div class="hud-top ${combatHud ? 'dungeon-layout' : ''}">
        <div style="display:flex;flex-direction:column;align-items:flex-start">
          ${
            combatHud
              ? `          <div class="hud-vitals">
            ${
              this.currentScene === 'shop'
                ? `<div style="display:flex;justify-content:space-between;gap:6px;font-family:var(--font-pixel);font-size:8.5px;margin-bottom:1px">
                    <span style="color:${timeColor}">${timeLabel}</span>
                    <span style="color:${this.shopIsOpen ? 'var(--accent-emerald)' : 'var(--text-muted)'}">${this.shopIsOpen ? 'OFFEN' : 'ZU'}</span>
                  </div>`
                : ''
            }
            <div class="hud-bar-row">
              <span class="hud-bar-label">HP</span>
              <div class="hud-bar-track">
                <div class="hud-bar-fill hp" style="width:${hpPct}%"></div>
              </div>
              <span class="hud-bar-val">${Math.ceil(this.state.hp)}/${stats.maxHp}</span>
            </div>
            <div class="hud-bar-row">
              <span class="hud-bar-label">EN</span>
              <div class="hud-bar-track">
                <div class="hud-bar-fill energy" style="width:${enPct}%"></div>
              </div>
              <span class="hud-bar-val">${Math.floor(this.state.energy)}/100</span>
            </div>
            <div class="hud-meta-row">
              <span class="hud-credits">${this.state.credits} CR</span>
              <span class="hud-stims">STIM: ${this.state.stimCharges}/${stats.maxStimCharges}</span>
            </div>
            <div class="hud-meta-row" style="border-top:none;padding-top:1px;margin-top:0;gap:8px">
              <button id="hud-weapon-chip" style="display:inline-flex;align-items:center;gap:5px;background:none;border:none;color:${wMeta.accentColor};font-family:var(--font-pixel);font-size:8.5px;cursor:pointer;pointer-events:auto;padding:0" title="Waffe wechseln [C]">
                <img src="${wMeta.iconUrl}" alt="${wMeta.name}" style="width:14px;height:14px;image-rendering:pixelated" />
                <span>${wMeta.name}${this.state.secondaryWeapon ? ' [C]' : ''}</span>
              </button>
              ${(() => {
                const inf = getInfusionDef(this.state.getActiveInfusion());
                return inf
                  ? `<span style="font-family:var(--font-pixel);font-size:7.8px;color:${inf.color};border:1px solid ${inf.color};padding:0 3px;background:rgba(10,16,28,0.8)" title="${inf.name}: ${inf.summary}">${inf.icon} ${inf.shortName}</span>`
                  : '';
              })()}
              ${
                compDef
                  ? `<span style="display:inline-flex;align-items:center;gap:3px;font-family:var(--font-pixel);font-size:8px;color:${compDef.accentColor}" title="${compDef.name}: ${compDef.abilitySummary}">
                      <img src="${compDef.iconUrl}" alt="${compDef.shortName}" style="width:12px;height:12px;image-rendering:pixelated" />
                      <span>${compDef.shortName}</span>
                    </span>`
                  : ''
              }
            </div>
            ${eventPillHtml}
          </div>`
              : statusPillHtml
          }
          ${pinTrackerHtml}
        </div>

        <div class="hud-center">
          ${
            this.currentScene !== 'shop'
              ? `<div class="hud-location-pill" style="${
                  this.currentScene === 'dungeon' && this.dungeonSector === 2
                    ? 'border-color:#c084fc;color:#f5d0fe'
                    : isNight
                      ? 'border-color:#818cf8;color:#c7d2fe'
                      : this.currentScene === 'dungeon' && this.dungeonFloor === 3
                        ? 'border-color:#fb923c;color:#fed7aa'
                        : ''
                }">${locationText}</div>`
              : ''
          }
        </div>

        <div class="hud-actions ${combatHud ? 'dungeon-stack' : ''}">
          ${
            this.currentScene === 'shop'
              ? `<button id="hud-shop-toggle" class="hud-btn ${this.shopIsOpen ? 'active-open' : 'primary'}">
                  ${this.shopIsOpen ? '[O] Schließen' : '[O] Öffnen'}
                </button>`
              : ''
          }
          <button id="hud-bag-btn" class="hud-btn">[I] Fracht (${bagCount})</button>
          ${
            combatHud
              ? `<button id="hud-sound-btn" class="hud-btn" title="Ton: ${sound.isMuted() ? 'alles aus' : sound.isMusicMuted() ? 'nur Effekte' : 'Musik + Effekte'} (Klick: weiterschalten · [M] Musik)">
                  ${sound.isMuted() ? '🔇' : sound.isMusicMuted() ? '🔉' : '🔊'}
                </button>`
              : `<button id="hud-music-btn" class="hud-btn" title="Musik umschalten [M]">
                  ${sound.isMusicMuted() || sound.isMuted() ? '♪ AUS' : '♪ MUSIK'}
                </button>
                <button id="hud-mute-btn" class="hud-btn" title="Alle Töne stumm/an">
                  ${sound.isMuted() ? 'TON AUS' : 'SFX AN'}
                </button>`
          }
        </div>
      </div>

      <div class="hud-bottom">
        <div class="controls-bar">
          ${
            this.currentScene === 'shop'
              ? `<span><kbd>WASD</kbd>Gehen</span>
                 <span><kbd>E</kbd>Interagieren</span>
                 <span><kbd>SPACE</kbd>Dash / Dieb fangen</span>
                 <span><kbd>O</kbd>Laden</span>
                 <span><kbd>I</kbd>Fracht &amp; Codex</span>`
              : this.currentScene === 'backroom'
                ? `<span><kbd>WASD</kbd>Quartier</span>
                   <span><kbd>E</kbd>Bett / Drohnen / Jukebox / Truhen</span>
                   <span><kbd>I</kbd>Lager &amp; Waffen</span>`
                : this.currentScene === 'hub'
                  ? `<span><kbd>WASD</kbd>Promenade</span>
                     <span><kbd>E</kbd>Shops / Nyx / Vex / Raumhafen</span>
                     <span><kbd>I</kbd>Fracht &amp; Codex</span>`
                  : this.currentScene === 'hangar'
                    ? `<span><kbd>WASD</kbd>Raumhafen</span>
                       <span><kbd>E</kbd>Schiff besteigen / Docks / 5. Tor</span>
                       <span><kbd>I</kbd>Fracht &amp; Waffen</span>`
                    : this.currentScene === 'market_terrace'
                      ? `<span><kbd>WASD</kbd>Terrasse</span>
                         <span><kbd>E</kbd>Alchemie-Bar / Gilde / Handelsbank / zurück</span>
                         <span><kbd>I</kbd>Fracht &amp; Codex</span>`
                    : `<span><kbd>LMB/J</kbd>${wMeta.shortName}</span>
                       <span><kbd>RMB/K</kbd>${this.state.equippedWeapon === 'blade' ? 'Schild' : 'Spezial'}</span>
                       <span><kbd>C</kbd>Wechseln</span>
                       <span><kbd>SPACE</kbd>Dash</span>
                       <span><kbd>E</kbd>Teleporter</span>`
          }
        </div>
        <div class="hud-hint">${hintText}</div>
      </div>
    `;

    this.hudEl.querySelector('#hud-bag-btn')?.addEventListener('click', () => {
      sound.playUiClick();
      this.openInventoryModal(
        this.currentScene === 'shop' || this.currentScene === 'backroom',
        'bag',
      );
    });
    this.hudEl.querySelector('#hud-shop-toggle')?.addEventListener('click', () => {
      this.hooks.onToggleShopOpen();
    });
    this.hudEl.querySelector('#hud-music-btn')?.addEventListener('click', () => {
      sound.unlock();
      this.hooks.onMusicToggle();
    });
    // M10-C (U2): ein einziger Ton-Button im Dungeon: Musik+Effekte → nur Effekte → aus → …
    this.hudEl.querySelector('#hud-sound-btn')?.addEventListener('click', () => {
      sound.unlock();
      if (sound.isMuted()) {
        this.hooks.onMuteToggle();
        if (sound.isMusicMuted()) this.hooks.onMusicToggle();
      } else if (sound.isMusicMuted()) {
        this.hooks.onMuteToggle();
      } else {
        this.hooks.onMusicToggle();
      }
    });
    this.hudEl.querySelector('[data-pin-toggle]')?.addEventListener('click', () => {
      sound.playUiClick();
      this.writePinCollapsed(!this.readPinCollapsed());
      this.renderHud();
    });
    this.hudEl.querySelector('#hud-mute-btn')?.addEventListener('click', () => {
      this.hooks.onMuteToggle();
    });
    this.hudEl.querySelector('#hud-weapon-chip')?.addEventListener('click', () => {
      this.hooks.onSwapWeapon();
    });
    this.hudEl.querySelectorAll<HTMLElement>('.hud-pin-unpin').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.pinKey;
        if (key) {
          sound.playUiClick();
          this.state.togglePinRecipe(key);
          this.renderHud();
        }
      });
    });
  }

  /** M10-A: Wird beim nächsten closeModal() (ESC, ✕, Hintergrund) einmalig aufgerufen. */
  public setModalCloseHook(cb: (() => void) | null): void {
    this.modalCloseHook = cb;
  }

  public closeModal(): void {
    if (!this.modalOpen) return;
    const closeHook = this.modalCloseHook;
    this.modalCloseHook = null;
    this.modalOpen = false;
    this.guildModalActive = false;
    this.selectedSlot = null;
    this.activePedestal = null;
    this.modalEl.classList.add('hidden');
    this.modalEl.innerHTML = '';
    this.hooks.onModalStateChange(false);
    this.renderHud();
    closeHook?.();
  }

  private showModalHtml(html: string): void {
    // Ein neues Modal ersetzt ein laufendes Gespräch: Listener aufräumen, alten Close-Hook verwerfen
    this.modalCloseHook = null;
    this.activeStory?.destroy();
    this.activeStory = null;
    this.modalOpen = true;
    this.modalEl.innerHTML = html;
    this.modalEl.classList.remove('hidden');
    this.hooks.onModalStateChange(true);
    this.modalEl.querySelector('#modal-close-btn')?.addEventListener('click', () => {
      sound.playUiClick();
      this.closeModal();
    });
  }

  // ==================== MEILENSTEIN 10-A: GERÄTE-EINSTELLUNGEN (Hilfe-Tab) ====================
  private renderDeviceSettingsHtml(): string {
    const s = getDeviceSettings();
    const touchActive = document.body.classList.contains('touch-device');
    const capped = isLandscapeNow() && s.touchScale > LANDSCAPE_TOUCH_CAP;
    const btn = (attr: string, val: string | number, label: string, active: boolean): string =>
      `<button class="btn ${active ? 'btn-primary' : ''}" ${attr}="${val}">${label}</button>`;
    const aimLabel: Record<string, string> = { off: 'Aus', standard: 'Standard', smart: 'Smart' };
    const aimInfo: Record<string, string> = {
      off: 'Aus: Angriffe zielen in deine Laufrichtung — keine automatische Zielerfassung.',
      standard: 'Standard: nächster Gegner in Reichweite wird automatisch anvisiert (wie bisher).',
      smart: 'Smart: bevorzugt Gegner in deiner Blickrichtung, bleibt am Ziel haften und zeigt ein Fadenkreuz.',
    };
    const speedLabel: Record<string, string> = { normal: 'Normal', fast: 'Schnell', instant: 'Sofort' };
    const shakeLabel: Record<string, string> = { full: 'Voll', low: 'Schwach', off: 'Aus' };
    return `
      <div class="inspector-box" style="gap:4px;border-color:rgba(56,232,212,0.45)">
        <div style="font-family:var(--font-pixel);font-size:11px;color:#38e8d4">⚙ STEUERUNG (DIESES GERÄT)</div>
        <div class="m10-setting-row">
          <div style="font-size:12px"><strong>Touch-Größe</strong> <span class="m9-file-sub">(Buttons &amp; Joystick${touchActive ? '' : ' — Touch-Steuerung auf diesem Gerät nicht aktiv'})</span></div>
          <div class="m10-setting-btns">${TOUCH_SCALES.map((v) => btn('data-dev-scale', v, `${Math.round(v * 100)} %`, s.touchScale === v)).join('')}</div>
          ${capped ? `<div class="m9-file-sub" style="color:#fbbf24">Im Querformat max. ${Math.round(LANDSCAPE_TOUCH_CAP * 100)} %</div>` : ''}
        </div>
        <div class="m10-setting-row">
          <div style="font-size:12px"><strong>Zielhilfe</strong> <span class="m9-file-sub">(ohne Maus: Touch, Gamepad &amp; Tastatur)</span></div>
          <div class="m10-setting-btns">${AIM_MODES.map((m) => btn('data-dev-aim', m, aimLabel[m], s.aimAssist === m)).join('')}</div>
          <div class="m9-file-sub">${aimInfo[s.aimAssist]}</div>
        </div>
        <div class="m10-setting-row">
          <div style="font-size:12px"><strong>Textgeschwindigkeit</strong> <span class="m9-file-sub">(Gespräche auf Port Solaris)</span></div>
          <div class="m10-setting-btns">${TEXT_SPEEDS.map((m) => btn('data-dev-text', m, speedLabel[m], s.textSpeed === m)).join('')}</div>
        </div>
        <div class="m10-setting-row">
          <div style="font-size:12px"><strong>Bildschirmwackeln</strong> <span class="m9-file-sub">(Kamera im Kampf)</span></div>
          <div class="m10-setting-btns">${SCREEN_SHAKES.map((m) => btn('data-dev-shake', m, shakeLabel[m], s.screenShake === m)).join('')}</div>
        </div>
        <div class="m10-setting-row">
          <div style="font-size:12px"><strong>Vibration</strong> <span class="m9-file-sub">(Handy: Treffer &amp; Parade)</span></div>
          <div class="m10-setting-btns">${[true, false].map((v) => btn('data-dev-vibe', v ? 'on' : 'off', v ? 'An' : 'Aus', s.vibration === v)).join('')}</div>
        </div>
        <div class="m10-setting-row">
          <div style="font-size:12px"><strong>Kurze Cutscenes</strong> <span class="m9-file-sub">(Upgrades &amp; Wiederholungen zügiger)</span></div>
          <div class="m10-setting-btns">${[false, true].map((v) => btn('data-dev-short-cut', v ? 'on' : 'off', v ? 'Kurz' : 'Normal', s.shortCutscenes === v)).join('')}</div>
        </div>
        <div class="m9-file-sub">Diese Einstellungen gelten nur für dieses Gerät und werden nicht in der Cloud gespeichert.</div>
      </div>`;
  }

  // ==================== MEILENSTEIN 10-A: STORY-GESPRÄCHE ====================
  private getStoryHost(): StoryHost {
    return {
      state: this.state,
      modalEl: this.modalEl,
      showModalHtml: (html) => this.showModalHtml(html),
      closeModal: () => this.closeModal(),
      setModalCloseHook: (cb) => this.setModalCloseHook(cb),
    };
  }

  /** Öffnet eine Gesprächsszene. Gibt den Controller zurück (Tests: advance()/choose()/skipLater()). */
  public openStoryScene(scene: StoryScene, opts: StoryDialogOptions = {}): StoryDialogController {
    const ctrl = new StoryDialogController(this.getStoryHost(), scene, opts);
    ctrl.start();
    this.activeStory = ctrl;
    return ctrl;
  }

  // ==================== INVENTORY, CHEST, SCAN-CODEX & KAPITÄNS-LOGBUCH ====================
  /** M10-C: Waffenschrank im Hinterzimmer – Haupt- & Zweitwaffe; Logbuch/Anzug/Savegame bleiben erreichbar. */
  public openLoadoutModal(): void {
    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title" style="white-space:nowrap">WAFFENSCHRANK</span>
          <button id="modal-close-btn" class="modal-close" style="white-space:nowrap">ESC ✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:10px">
          ${renderLoadoutHtml(this.state)}
          <div style="display:flex;justify-content:flex-end">
            <button id="btn-rack-logbook" class="btn">📖 Logbuch, Anzug &amp; Savegame</button>
          </div>
        </div>
      </div>
    `);
    bindLoadout(this.modalEl, this.state, () => {
      sound.playWeaponSwap();
      this.openLoadoutModal();
      this.renderHud();
    });
    this.modalEl.querySelector('#btn-rack-logbook')?.addEventListener('click', () => {
      sound.playUiClick();
      this.openLogbookModal();
    });
  }

  public openLogbookModal(): void {
    this.openInventoryModal(true, 'logbook');
  }

  public openInventoryModal(withChest: boolean, tab: 'bag' | 'codex' | 'logbook' | 'help' = 'bag'): void {
    this.chestMode = withChest;
    this.activeInvTab = tab;
    this.selectedSlot = null;
    this.renderInventoryModal();
  }

  private renderInventoryModal(): void {
    const art = getHDArt();

    const renderSlot = (container: ContainerId, index: number): string => {
      const stack = this.state.inventory[container][index];
      const isSelected =
        this.selectedSlot?.container === container && this.selectedSlot?.index === index;
      let inner = '';
      let title = 'Leerer Slot';
      if (stack) {
        const def = getItemDef(stack.itemId);
        let modBadge = '';
        if (def.modifier === 'warp_anchor') {
          modBadge = `<span class="slot-mod-badge" style="background:#34d399" title="Warp-Anker (→): Rettet rechten Nachbar sogar bei Tod!">→</span>`;
        } else if (def.modifier === 'mirror_clone') {
          modBadge = `<span class="slot-mod-badge" style="background:#38e8d4" title="Klon-Matrix (↑): Dupliziert Item direkt darüber!">↑</span>`;
        } else if (def.modifier === 'row_curse') {
          const unsafe = container === 'cargo' && index >= 5;
          modBadge = `<span class="slot-mod-badge" style="background:${unsafe ? '#fb7185' : '#c084fc'}" title="Phasen-Fluch (▲): Nur oberste Reihe stabil!">▲</span>`;
        } else if (def.modifier === 'volatile_boost') {
          modBadge = `<span class="slot-mod-badge" style="background:#fbbf24" title="Resonanz (←): Wandelt Item links in 1 Sternen-Kompass um!">←</span>`;
        } else if (def.modifier === 'fragile') {
          modBadge = `<span class="slot-mod-dot" style="background:#fb7185" title="Zerbrechlich"></span>`;
        } else if (def.modifier === 'smuggler') {
          modBadge = `<span class="slot-mod-dot" style="background:#fde047" title="Schmuggler-Bonus (+15 %)"></span>`;
        }
        const pinNeed = this.state.getPinnedItemNeed(stack.itemId);
        const pinBadge = pinNeed
          ? `<span class="slot-pin-badge" title="Angepinnt für: ${pinNeed.recipeTitles.join(', ')} (${pinNeed.owned}/${pinNeed.required})">📌</span>`
          : '';
        inner = `
          ${pinBadge}
          ${modBadge}
          <img class="pixel-icon" src="${art.itemUrls[stack.itemId]}" alt="${def.name}" />
          <span class="slot-qty">${stack.qty}</span>
        `;
        title = `${def.name} (x${stack.qty})${pinNeed ? ` · 📌 Gebraucht (${pinNeed.owned}/${pinNeed.required})` : ''}${def.modifierLabel ? ' — ' + def.modifierLabel : ''}`;
      }
      return `
        <button class="inv-slot ${container === 'chest' ? 'safe' : ''} ${isSelected ? 'selected' : ''}"
          data-container="${container}" data-index="${index}" title="${title}">
          ${inner}
        </button>
      `;
    };

    let bodyHtml = '';

    if (this.activeInvTab === 'bag') {
      const selStack = this.selectedSlot
        ? this.state.inventory[this.selectedSlot.container][this.selectedSlot.index]
        : null;
      const selDef = selStack ? getItemDef(selStack.itemId) : null;
      const selEntry = selStack ? this.state.codex[selStack.itemId] : null;
      const selRarity = selDef ? RARITY_META[selDef.rarity] : null;
      const selPin = selDef ? this.state.getPinnedItemNeed(selDef.id) : null;

      // Active Weapon Loadout Strip (all 6 Frontier weapon classes!)
      const weaponBarHtml = renderLoadoutHtml(this.state, { compact: true });

      const inspectorHtml =
        selDef && selStack && selEntry && selRarity
          ? `
          <div class="inspector-box">
            <div class="inspector-head">
              <div class="inspector-icon-wrap">
                <img class="pixel-icon" src="${art.itemUrls[selDef.id]}" alt="${selDef.name}" />
              </div>
              <div>
                <div style="font-family:var(--font-pixel);font-size:12px;color:#fff">${selDef.name}</div>
                <span class="rarity-badge" style="color:${selRarity.color};background:${selRarity.bg};border-color:${selRarity.border}">
                  ${selRarity.label}
                </span>
              </div>
            </div>
            <p style="font-size:12px;color:var(--text-muted);line-height:1.4">${selDef.description}</p>
            ${
              selPin
                ? `<div class="modifier-box" style="border-left-color:#fbbf24;color:#fde047">
                     📌 <strong>Merkliste (${selPin.owned}/${selPin.required}):</strong> Gebraucht für ${selPin.recipeTitles.join(', ')}
                   </div>`
                : ''
            }
            ${selDef.modifierLabel ? `<div class="modifier-box">⚡ ${selDef.modifierLabel}</div>` : ''}
            <div style="font-size:11px;color:var(--text-muted)">
              ${
                selEntry.maxFairPrice !== null
                  ? `Bekannter Fair-Preis: <strong style="color:var(--accent-emerald)">${selEntry.minFairPrice}–${selEntry.maxFairPrice} Cr</strong>`
                  : 'Preis noch unbekannt — teste ihn im Shop!'
              }
            </div>
            ${
              this.chestMode
                ? `<button id="btn-quick-transfer" class="btn" style="margin-top:auto">
                    ${this.selectedSlot?.container === 'chest' ? 'In Rucksack nehmen' : 'In Lagertruhe sichern'}
                  </button>`
                : ''
            }
          </div>
        `
          : `
          <div class="inspector-box" style="justify-content:center;align-items:center;text-align:center;color:var(--text-muted);font-size:12px">
            <p>Klicke auf zwei Slots, um Relikte taktisch anzuordnen (→ Warp-Anker · ↑ Klon-Matrix · ▲ Oberste Reihe · ← Nova-Resonanz).</p>
            <p style="margin-top:6px;color:var(--accent-coral)">⚠ Rucksack-Beute geht bei 0 HP verloren — außer dein Warp-Anker (→) rettet seinen rechten Nachbar!</p>
          </div>
        `;

      const rightColumn = this.chestMode
        ? `
          <div>
            <div class="section-label">
              <span>LAGERTRUHE (${this.state.inventory.chest.length} SLOTS)</span>
              <span class="safe-tag">✓ Immer sicher im Shop</span>
            </div>
            <div class="slot-grid chest-grid">
              ${this.state.inventory.chest.map((_, i) => renderSlot('chest', i)).join('')}
            </div>
            ${inspectorHtml}
          </div>
        `
        : inspectorHtml;

      bodyHtml = `
        ${weaponBarHtml}
        <div class="inv-layout ${this.chestMode ? '' : 'single'}">
          <div>
            <div class="section-label">
              <span>EXPEDITIONS-RUCKSACK (20 SLOTS)</span>
              <span style="color:var(--accent-coral)">⚠ Verlust bei Tod</span>
            </div>
            <div class="slot-grid">
              ${this.state.inventory.cargo.map((_, i) => renderSlot('cargo', i)).join('')}
            </div>
            ${
              this.chestMode && countBackpackItems(this.state.inventory) > 0
                ? `<button id="btn-deposit-all" class="btn btn-primary" style="width:100%">Alle Beute in Lagertruhe sichern</button>`
                : ''
            }
          </div>
          ${rightColumn}
        </div>
      `;
    } else if (this.activeInvTab === 'codex') {
      bodyHtml = `
        <div style="font-size:12px;color:var(--text-muted)">
          Der Scan-Codex merkt sich automatisch jede Kunden-Reaktion aus deinem Shop und zeigt die aktuelle Nachfrage.
        </div>
        <div class="codex-grid">
          ${ITEMS.map((item) => {
            const entry = this.state.codex[item.id];
            const rarity = RARITY_META[item.rarity];
            const demand = getDemandLabel(getDemandLevel(entry));
            if (!entry.discovered) {
              return `
                <div class="codex-card locked">
                  <div class="inspector-icon-wrap" style="opacity:0.4">?</div>
                  <div>
                    <div style="font-family:var(--font-pixel);font-size:11px">??? (Unentdeckt)</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${
                      item.sector === 4
                        ? 'Finde dieses Ältesten-Relikt in Sektor 4.'
                        : item.sector === 3
                          ? 'Finde dieses Solar-Relikt in Sektor 3.'
                          : item.sector === 2
                            ? 'Finde dieses Kristall-Relikt in Sektor 2.'
                            : 'Finde dieses Relikt in Sektor 1.'
                    }</div>
                  </div>
                </div>
              `;
            }
            return `
              <div class="codex-card">
                <div class="inspector-icon-wrap">
                  <img class="pixel-icon" src="${art.itemUrls[item.id]}" alt="${item.name}" />
                </div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                    <strong style="font-family:var(--font-pixel);font-size:11px;color:${rarity.color}">${item.name}</strong>
                    <span style="display:inline-flex;gap:5px;align-items:center">${renderTrendPillHtml(item.id)}<span style="font-size:10px;color:${demand.color}">${demand.arrow} ${demand.text.split(' ')[0]}</span></span>
                  </div>
                  <div class="codex-hints" style="margin-top:5px">
                    <div class="codex-hint-chip"><span style="color:#38e8d4">★ Billig</span><span>${entry.maxCheapPrice ? `≤${entry.maxCheapPrice}` : '—'}</span></div>
                    <div class="codex-hint-chip"><span style="color:#4ade80">✓ Fair</span><span>${entry.minFairPrice !== null ? `${entry.minFairPrice}–${entry.maxFairPrice}` : '—'}</span></div>
                    <div class="codex-hint-chip"><span style="color:#fb923c">? Teuer</span><span>${entry.minExpensivePrice ? `≥${entry.minExpensivePrice}` : '—'}</span></div>
                    <div class="codex-hint-chip"><span style="color:#f87171">! Wucher</span><span>${entry.minOutrageousPrice ? `≥${entry.minOutrageousPrice}` : '—'}</span></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (this.activeInvTab === 'logbook') {
      this.state.checkAchievements(false);
      const unlockedSet = new Set(this.state.unlockedAchievements);
      const canNgPlus = this.state.sector4Cleared || this.state.omegaCleared;

      const suitCards = SUIT_THEME_ORDER.map((id) => {
        const theme = SUIT_THEMES[id];
        const unlocked = this.state.isSuitThemeUnlocked(id);
        const equipped = this.state.suitTheme === id;
        return `
          <button class="btn ${equipped ? 'btn-amber' : unlocked ? '' : ''}" data-suit-id="${id}"
            style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:7px 9px;opacity:${unlocked ? '1' : '0.5'};border-color:${equipped ? theme.accent : 'var(--border-steel)'}"
            ${unlocked ? '' : 'disabled'}>
            <span style="display:flex;align-items:center;gap:7px">
              <span style="width:12px;height:12px;border-radius:50%;background:${theme.accent};box-shadow:0 0 8px ${theme.auraColor};display:inline-block"></span>
              <span style="text-align:left">
                <div style="font-family:var(--font-pixel);font-size:9.5px;color:${unlocked ? theme.accent : 'var(--text-muted)'}">${theme.name}</div>
                <div style="font-size:10px;color:var(--text-muted)">${equipped ? '✓ Aktiv' : unlocked ? 'Freigeschaltet' : theme.unlockText}</div>
              </span>
            </span>
          </button>
        `;
      }).join('');

      const achCards = ACHIEVEMENT_DEFS.map((a) => {
        const done = unlockedSet.has(a.id);
        return `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid ${done ? 'rgba(250,204,21,0.45)' : 'rgba(71,85,105,0.45)'};background:${done ? 'rgba(250,204,21,0.08)' : 'rgba(15,23,42,0.55)'};opacity:${done ? '1' : '0.62'}">
            <span style="font-size:16px">${done ? a.icon : '🔒'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-family:var(--font-pixel);font-size:9.5px;color:${done ? '#fde047' : 'var(--text-muted)'}">${a.title}</div>
              <div style="font-size:11px;color:var(--text-muted)">${a.desc}</div>
            </div>
            <span style="font-family:var(--font-pixel);font-size:8.5px;color:${done ? '#4ade80' : '#64748b'}">${done ? '✓' : '—'}</span>
          </div>
        `;
      }).join('');

      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="inspector-box" style="gap:8px">
            <div style="font-family:var(--font-pixel);font-size:11px;color:#fb923c">★ EXO-ANZUG FARBSCHEMA &amp; AURA</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px">${suitCards}</div>
          </div>

          <div class="inspector-box" style="gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:var(--font-pixel);font-size:11px;color:#fde047">★ KAPITÄNS-LOGBUCH (${unlockedSet.size} / ${ACHIEVEMENT_DEFS.length})</span>
              <span style="font-size:11px;color:var(--text-muted)">S1–S4 &amp; Omega · NG+${this.state.ngPlusLevel}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px">${achCards}</div>
          </div>

          ${renderChronicleHtml(this.state.story, {
            openBuildings: this.state.hubUnlocks,
            minaPresent: this.state.isMinaPresent(),
            pipPresent: this.state.isPipPresent(),
            quartersTier: this.state.upgrades.quartersTier ?? 0,
            shopTier: this.state.upgrades.shopTier ?? 0,
          })}

          <div class="inspector-box" style="gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:var(--font-pixel);font-size:11px;color:#38e8d4">🎬 KINO-CHRONIK (CUTSCENES)</span>
              <span style="font-size:11px;color:var(--text-muted)">Freigeschaltete Szenen erneut ansehen</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:6px">
              ${CUTSCENE_CATALOG.map((entry) => {
                const unlocked =
                  entry.id === 'intro_arrival' ||
                  this.state.hasSeenCutscene(entry.id) ||
                  (entry.id === 'story_mina_arrives'
                    ? this.state.isMinaPresent()
                    : this.state.story.chapter >= entry.chapter && entry.chapter > 0);
                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border:1px solid ${unlocked ? 'rgba(56,232,212,0.35)' : 'var(--border-steel)'};background:rgba(10,16,30,0.75);opacity:${unlocked ? '1' : '0.55'}">
                    <div style="min-width:0">
                      <div style="font-size:11.5px;font-weight:700;color:${unlocked ? '#f8fafc' : 'var(--text-muted)'}">${entry.icon} ${unlocked ? entry.title : '??? (Noch nicht erlebt)'}</div>
                      <div style="font-size:10.5px;color:var(--text-muted)">${unlocked ? entry.subtitle : `Kapitel ${entry.chapter}`}</div>
                    </div>
                    ${
                      unlocked
                        ? `<button class="btn" style="padding:4px 8px;font-size:10px;white-space:nowrap" data-replay-cutscene="${entry.id}">▶ Ansehen</button>`
                        : `<span style="font-size:11px;color:var(--text-muted)">🔒</span>`
                    }
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="inspector-box" style="gap:8px;border-color:${canNgPlus ? 'rgba(250,204,21,0.5)' : 'var(--border-steel)'}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div>
                <div style="font-family:var(--font-pixel);font-size:11px;color:#c084fc">♾️ NEW GAME+ (ENDLOS-ANOMALIE)</div>
                <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">
                  Behalte alle Waffen, MK-VIII Upgrades, Begleiter, Credits, Stile &amp; Truhe — starte die 4 Sektoren mit +35 % Gegner-HP &amp; neuem Ruhm!
                </div>
              </div>
              <button id="btn-start-ngplus" class="btn ${canNgPlus ? 'btn-amber' : ''}" ${canNgPlus ? '' : 'disabled'}>
                ${canNgPlus ? `★ NG+${this.state.ngPlusLevel + 1} starten` : '🔒 Sektor 4 / Omega nötig'}
              </button>
            </div>
          </div>

          <div class="inspector-box" style="gap:8px">
            <div style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-cyan)">💾 SAVEGAME-TRANSFER (HANDY ↔ PC · JSON)</div>
            <textarea id="save-json-box" rows="3" placeholder="Klicke auf Exportieren oder füge hier einen kopierten STARLIGHTER-Spielstand ein..."
              style="width:100%;background:rgba(8,13,24,0.9);color:#e2e8f0;border:1px solid var(--border-steel);padding:6px 8px;font-family:monospace;font-size:10.5px;resize:vertical"></textarea>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button id="btn-export-save" class="btn btn-primary">Spielstand exportieren &amp; kopieren</button>
              <button id="btn-import-save" class="btn btn-amber">Spielstand importieren</button>
            </div>
          </div>
        </div>
      `;
    } else {
      bodyHtml = `
        ${this.renderDeviceSettingsHtml()}
        <div class="inspector-box" style="gap:10px">
          <div style="font-family:var(--font-pixel);font-size:12px;color:var(--accent-cyan)">SO SPIELST DU STARLIGHTER</div>
          <p style="font-size:13px;line-height:1.5;color:var(--text-muted)">
            <strong>1. Astro-Barter &amp; Ausbau:</strong> Bestücke deine Holo-Podeste [E], geh zum Abkassieren rechts hinter den Tresen und schnapp <strong>Weltraum-Diebe</strong> per Dash [SPACE] (+35 Cr Kopfgeld)!
            Am linken <strong>Shop-Ausbau-Terminal</strong> vergrößerst du deinen Laden (Stufe I → II → III: bis zu 8 Podeste, 48 Truhen-Slots &amp; automatische <strong>Sonderangebots-Kiste</strong>).
          </p>
          <p style="font-size:13px;line-height:1.5;color:var(--text-muted)">
            <strong>2. 4 Sektoren &amp; 5. Omega-Tor:</strong> Im Raumhafen (Docks I–IV) startest du in alle 4 Sektoren (Wrackfeld, Kristall-Nebel, Solar-Gießerei, Ältesten-Monolith). Besiege alle 4 Endbosse für die 4 Siegel am zentralen <strong>5. Tiefenraum-Tor</strong>!
          </p>
          <p style="font-size:13px;line-height:1.5;color:var(--text-muted)">
            <strong>3. Gamepad, Skill-Schild &amp; Geheime Abgründe:</strong> Gamepads (Xbox/PlayStation/Switch) werden direkt unterstützt! Weiche per Dash [SPACE/A] über schmale Schluchten — achte auf winzige funkelnde Abgründe für geheime Schatzkammern!
          </p>
          <div style="display:flex;justify-content:flex-end;margin-top:6px">
            <button id="btn-reset-save" class="btn btn-danger">Spielstand zurücksetzen</button>
          </div>
        </div>
      `;
    }

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title">${this.activeInvTab === 'logbook' ? 'KAPITÄNS-LOGBUCH &amp; STIL' : this.chestMode ? 'LAGERTRUHE &amp; RUCKSACK' : 'EXPEDITIONS-RUCKSACK'}</span>
          <div class="modal-tabs">
            <button class="tab-btn ${this.activeInvTab === 'bag' ? 'active' : ''}" data-tab="bag">Fracht</button>
            <button class="tab-btn ${this.activeInvTab === 'codex' ? 'active' : ''}" data-tab="codex">Codex</button>
            <button class="tab-btn ${this.activeInvTab === 'logbook' ? 'active' : ''}" data-tab="logbook">Logbuch</button>
            <button class="tab-btn ${this.activeInvTab === 'help' ? 'active' : ''}" data-tab="help">Hilfe</button>
          </div>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    `);

    this.modalEl.querySelectorAll<HTMLElement>('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        this.activeInvTab = btn.dataset.tab as 'bag' | 'codex' | 'logbook' | 'help';
        this.renderInventoryModal();
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-suit-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.suitId as SuitThemeId;
        if (this.state.setSuitTheme(sid)) {
          sound.playUpgrade();
          this.toast(`★ Anzug-Stil aktiviert: ${SUIT_THEMES[sid].name}!`, 'good');
          this.renderInventoryModal();
        }
      });
    });

    // M10-A: Geräte-Einstellungen (nur localStorage, wirken live)
    this.modalEl.querySelectorAll<HTMLElement>('[data-dev-scale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        saveDeviceSettings({ touchScale: Number(btn.dataset.devScale) as (typeof TOUCH_SCALES)[number] });
        this.renderInventoryModal();
      });
    });
    this.modalEl.querySelectorAll<HTMLElement>('[data-dev-aim]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        saveDeviceSettings({ aimAssist: btn.dataset.devAim as (typeof AIM_MODES)[number] });
        this.renderInventoryModal();
      });
    });
    this.modalEl.querySelectorAll<HTMLElement>('[data-dev-shake]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        saveDeviceSettings({ screenShake: btn.dataset.devShake as (typeof SCREEN_SHAKES)[number] });
        this.renderInventoryModal();
      });
    });
    this.modalEl.querySelectorAll<HTMLElement>('[data-dev-vibe]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        saveDeviceSettings({ vibration: btn.dataset.devVibe === 'on' });
        this.renderInventoryModal();
      });
    });
    this.modalEl.querySelectorAll<HTMLElement>('[data-dev-short-cut]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        saveDeviceSettings({ shortCutscenes: btn.dataset.devShortCut === 'on' });
        this.renderInventoryModal();
      });
    });
    this.modalEl.querySelectorAll<HTMLElement>('[data-dev-text]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        saveDeviceSettings({ textSpeed: btn.dataset.devText as (typeof TEXT_SPEEDS)[number] });
        this.renderInventoryModal();
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-replay-cutscene]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.dataset.replayCutscene as ReplayableCutsceneId | undefined;
        if (!cid) return;
        sound.playUiClick();
        this.closeModal();
        this.hooks.onReplayCutscene?.(cid);
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-story-replay]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const scene = getSceneById(btn.dataset.storyReplay ?? '');
        if (!scene) return;
        sound.playUiClick();
        const back = (): void => this.openInventoryModal(this.chestMode, 'logbook');
        this.openStoryScene(scene, { replay: true, onClose: back, onFinish: back });
      });
    });

    this.modalEl.querySelector('#btn-start-ngplus')?.addEventListener('click', () => {
      if (!this.state.sector4Cleared && !this.state.omegaCleared) return;
      this.state.startNewGamePlus();
      sound.playWarp();
      this.closeModal();
      this.renderHud();
      this.toast(`♾️ NEW GAME+ ${this.state.ngPlusLevel} gestartet! Alle Upgrades, Waffen & Truhe behalten!`, 'good');
      this.toast(`📜 ${this.state.getStoryChapterTitle()} — auf Port Solaris gibt es Neuigkeiten!`, 'info');
    });

    this.modalEl.querySelector('#btn-export-save')?.addEventListener('click', () => {
      const box = this.modalEl.querySelector('#save-json-box') as HTMLTextAreaElement | null;
      const json = this.state.exportSaveJson();
      if (box) {
        box.value = json;
        box.select();
      }
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(json).catch(() => {});
      }
      sound.playUiClick();
      this.toast('💾 Spielstand exportiert & in die Zwischenablage kopiert!', 'good');
    });

    this.modalEl.querySelector('#btn-import-save')?.addEventListener('click', () => {
      const box = this.modalEl.querySelector('#save-json-box') as HTMLTextAreaElement | null;
      const raw = box?.value.trim() ?? '';
      if (!raw) {
        this.toast('Bitte zuerst einen JSON-Spielstand ins Textfeld einfügen!', 'warn');
        return;
      }
      const res = this.state.importSaveJson(raw);
      if (res.ok) {
        sound.playUpgrade();
        this.renderHud();
        this.renderInventoryModal();
        this.toast('✓ Spielstand erfolgreich importiert!', 'good');
      } else {
        this.toast(res.error ?? 'Import fehlgeschlagen!', 'warn');
      }
    });

    bindLoadout(this.modalEl, this.state, () => {
      sound.playWeaponSwap();
      this.renderInventoryModal();
      this.renderHud();
    });

    this.modalEl.querySelectorAll<HTMLElement>('.inv-slot').forEach((el) => {
      el.addEventListener('click', () => {
        const container = el.dataset.container as ContainerId;
        const index = Number(el.dataset.index);
        if (!this.selectedSlot) {
          if (this.state.inventory[container][index]) {
            this.selectedSlot = { container, index };
            sound.playUiClick();
            this.renderInventoryModal();
          }
        } else {
          if (this.selectedSlot.container === container && this.selectedSlot.index === index) {
            this.selectedSlot = null;
          } else {
            swapOrMergeSlots(
              this.state.inventory,
              this.selectedSlot.container,
              this.selectedSlot.index,
              container,
              index,
            );
            this.selectedSlot = null;
            this.state.save();
          }
          sound.playUiClick();
          this.renderInventoryModal();
        }
      });
    });

    this.modalEl.querySelector('#btn-quick-transfer')?.addEventListener('click', () => {
      if (!this.selectedSlot) return;
      quickTransferSlot(
        this.state.inventory,
        this.selectedSlot.container,
        this.selectedSlot.index,
        this.chestMode,
      );
      this.selectedSlot = null;
      this.state.save();
      sound.playUiClick();
      this.renderInventoryModal();
    });

    this.modalEl.querySelector('#btn-deposit-all')?.addEventListener('click', () => {
      const moved = depositAllCargoToChest(this.state.inventory);
      if (moved > 0) {
        sound.playPickup();
        this.state.save();
        this.toast(`${moved} Relikte sicher in der Lagertruhe verstaut!`, 'good');
        this.renderInventoryModal();
        this.renderHud();
      }
    });

    this.modalEl.querySelector('#btn-reset-save')?.addEventListener('click', () => {
      this.state.resetSave();
      this.closeModal();
      this.hooks.onStartNewGame();
      this.toast('Neuer Spielstand gestartet!', 'info');
    });
  }

  // ==================== HOLO-PEDESTAL PRICE MODAL ====================
  public openPedestalModal(pedestal: PedestalSlot): void {
    this.activePedestal = pedestal;
    if (pedestal.itemId && pedestal.qty > 0) {
      this.pickedItemId = pedestal.itemId;
      this.pickedPrice = pedestal.price;
      this.pickedQty = pedestal.qty;
    } else {
      const available = getAllAvailableShopItems(this.state.inventory);
      if (available.length > 0) {
        this.pickedItemId = available[0].stack.itemId;
        this.pickedPrice = getSuggestedStartPrice(
          this.pickedItemId,
          this.state.codex[this.pickedItemId],
        );
        this.pickedQty = 1;
      } else {
        this.pickedItemId = null;
        this.pickedPrice = 50;
        this.pickedQty = 0;
      }
    }
    this.renderPedestalModal();
  }

  private renderPedestalModal(): void {
    const ped = this.activePedestal;
    if (!ped) return;
    const art = getHDArt();

    const counts = new Map<string, number>();
    for (const entry of getAllAvailableShopItems(this.state.inventory)) {
      counts.set(entry.stack.itemId, (counts.get(entry.stack.itemId) ?? 0) + entry.stack.qty);
    }
    if (ped.itemId && ped.qty > 0) {
      counts.set(ped.itemId, (counts.get(ped.itemId) ?? 0) + ped.qty);
    }

    const itemIds = Array.from(counts.keys());
    const selDef = this.pickedItemId ? getItemDef(this.pickedItemId) : null;
    const selCodex = this.pickedItemId ? this.state.codex[this.pickedItemId] : null;
    const maxAvail = this.pickedItemId ? counts.get(this.pickedItemId) ?? 0 : 0;
    if (this.pickedQty > maxAvail) this.pickedQty = Math.max(1, maxAvail);

    const pickerHtml =
      itemIds.length > 0
        ? itemIds
            .map((id) => {
              const def = getItemDef(id);
              const rarity = RARITY_META[def.rarity];
              const total = counts.get(id) ?? 0;
              const pinNeed = this.state.getPinnedItemNeed(id);
              return `
                <button class="picker-row ${this.pickedItemId === id ? 'selected' : ''}" data-item-id="${id}">
                  <img src="${art.itemUrls[id]}" alt="${def.name}" />
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
                      <span style="font-family:var(--font-pixel);font-size:11px;color:${rarity.color}">${def.name}</span>
                      ${pinNeed ? `<span class="pin-wanted-pill" title="Gebraucht für: ${pinNeed.recipeTitles.join(', ')}">📌 ${pinNeed.owned}/${pinNeed.required}</span>` : ''}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted)">Verfügbar: ${total}×</div>
                  </div>
                </button>
              `;
            })
            .join('')
        : `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:12px">
             Keine Relikte im Lager. Gehe rechts über Port Solaris nach Sektor 1!
           </div>`;

    const demand = selCodex ? getDemandLabel(getDemandLevel(selCodex)) : null;

    const rightHtml =
      selDef && selCodex && demand
        ? `
        <div class="price-panel">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-family:var(--font-pixel);font-size:12px;color:#fff">${selDef.name}</strong>
            <span style="display:inline-flex;gap:6px;align-items:center">${renderTrendPillHtml(selDef.id)}<span style="font-size:11px;color:${demand.color}">${demand.arrow} ${demand.text}</span></span>
          </div>

          <div class="price-readout">${this.pickedPrice} CR</div>

          <div class="price-step-row">
            <button class="step-btn" data-delta="-50">-50</button>
            <button class="step-btn" data-delta="-10">-10</button>
            <button class="step-btn" data-delta="-1">-1</button>
            <button class="step-btn" data-delta="1">+1</button>
            <button class="step-btn" data-delta="10">+10</button>
            <button class="step-btn" data-delta="50">+50</button>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
            <span>Menge auf Podest:</span>
            <div style="display:flex;align-items:center;gap:6px">
              <button class="step-btn" id="qty-minus" style="padding:3px 9px">-</button>
              <strong style="font-family:var(--font-pixel);font-size:12px;min-width:24px;text-align:center">${this.pickedQty}</strong>
              <button class="step-btn" id="qty-plus" style="padding:3px 9px">+</button>
            </div>
          </div>

          <div class="codex-hints">
            <div class="codex-hint-chip"><span style="color:#38e8d4">★ Billig</span><span>${selCodex.maxCheapPrice ? `≤${selCodex.maxCheapPrice}` : '—'}</span></div>
            <div class="codex-hint-chip"><span style="color:#4ade80">✓ Fair</span><span>${selCodex.minFairPrice !== null ? `${selCodex.minFairPrice}–${selCodex.maxFairPrice}` : '—'}</span></div>
            <div class="codex-hint-chip"><span style="color:#fb923c">? Teuer</span><span>${selCodex.minExpensivePrice ? `≥${selCodex.minExpensivePrice}` : '—'}</span></div>
            <div class="codex-hint-chip"><span style="color:#f87171">! Wucher</span><span>${selCodex.minOutrageousPrice ? `≥${selCodex.minOutrageousPrice}` : '—'}</span></div>
          </div>

          <div style="display:flex;gap:8px;margin-top:auto">
            <button id="btn-apply-pedestal" class="btn btn-amber" style="flex:1">Auf Podest legen</button>
            ${ped.itemId ? `<button id="btn-clear-pedestal" class="btn btn-danger">Leeren</button>` : ''}
          </div>
        </div>
      `
        : `<div class="price-panel" style="justify-content:center;text-align:center;color:var(--text-muted);font-size:12px">
             Wähle links ein Relikt aus, um den Preis festzulegen.
           </div>`;

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title">HOLO-PODEST #${ped.id + 1} · PREISFESTLEGUNG</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="pedestal-layout">
            <div>
              <div class="section-label"><span>VERFÜGBARE RELIKTE</span></div>
              <div class="item-picker-list">${pickerHtml}</div>
            </div>
            ${rightHtml}
          </div>
        </div>
      </div>
    `);

    this.modalEl.querySelectorAll<HTMLElement>('.picker-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.itemId!;
        this.pickedItemId = id;
        this.pickedPrice = getSuggestedStartPrice(id, this.state.codex[id]);
        this.pickedQty = 1;
        sound.playUiClick();
        this.renderPedestalModal();
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('.step-btn[data-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.delta);
        this.pickedPrice = Math.max(5, Math.min(9999, this.pickedPrice + delta));
        sound.playUiClick();
        this.renderPedestalModal();
      });
    });

    this.modalEl.querySelector('#qty-minus')?.addEventListener('click', () => {
      this.pickedQty = Math.max(1, this.pickedQty - 1);
      sound.playUiClick();
      this.renderPedestalModal();
    });

    this.modalEl.querySelector('#qty-plus')?.addEventListener('click', () => {
      this.pickedQty = Math.min(Math.min(5, maxAvail), this.pickedQty + 1);
      sound.playUiClick();
      this.renderPedestalModal();
    });

    this.modalEl.querySelector('#btn-clear-pedestal')?.addEventListener('click', () => {
      if (ped.itemId && ped.qty > 0) {
        addItemAnywhere(this.state.inventory, ped.itemId, ped.qty);
        ped.itemId = null;
        ped.qty = 0;
        this.state.save();
        sound.playUiClick();
      }
      this.closeModal();
    });

    this.modalEl.querySelector('#btn-apply-pedestal')?.addEventListener('click', () => {
      if (!this.pickedItemId || this.pickedQty <= 0) return;

      if (ped.itemId && ped.qty > 0) {
        addItemAnywhere(this.state.inventory, ped.itemId, ped.qty);
        ped.itemId = null;
        ped.qty = 0;
      }

      let taken = 0;
      const order: ContainerId[] = ['cargo', 'chest'];
      for (const c of order) {
        const list = this.state.inventory[c];
        for (let i = 0; i < list.length && taken < this.pickedQty; i++) {
          while (list[i]?.itemId === this.pickedItemId && taken < this.pickedQty) {
            if (takeOneFromSlot(this.state.inventory, c, i)) taken++;
          }
        }
      }

      if (taken > 0) {
        ped.itemId = this.pickedItemId;
        ped.qty = taken;
        ped.price = this.pickedPrice;
        this.state.codex[this.pickedItemId].lastSetPrice = this.pickedPrice;
        this.state.lastPedestalItems[ped.id] = this.pickedItemId;
        this.state.save();
        sound.playPickup();
        this.toast(
          `${taken}× ${getItemDef(this.pickedItemId).name} für ${this.pickedPrice} Cr ausgelegt!`,
          'good',
        );
      }
      this.closeModal();
    });
  }

  // ==================== KAEL'S EXO-SCHMIEDE (WEAPONS & SUIT) ====================
  public openForgeModal(): void {
    this.openStationShopModal('forge');
  }

  // ==================== DR. LYRA'S MED-BAY (STIMPACKS & BIO-SERUM) ====================
  public openMedBayModal(): void {
    this.openStationShopModal('medbay');
  }

  // ==================== ASTRO-BARTER SHOP-TERMINAL (SHOP-AUSBAU & DEKO) ====================
  public openShopUpgradeModal(): void {
    this.openStationShopModal('shop_terminal');
  }

  // ==================== VEX' TECH-LABOR (PASSIVE MODULE & SEKTOR-KARTE) ====================
  public openTechLabModal(): void {
    this.openStationShopModal('techlab');
  }

  private openStationShopModal(shop: 'forge' | 'medbay' | 'shop_terminal' | 'techlab'): void {
    const tracks = UPGRADE_TRACKS.filter((t) => t.shop === shop);
    const isForge = shop === 'forge';
    const isMedBay = shop === 'medbay';
    const isShopTerm = shop === 'shop_terminal';
    const isTechLab = shop === 'techlab';

    const sectorProgressHtml = isTechLab
      ? `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:8px 10px;background:rgba(12,20,36,0.72);border:1px solid rgba(56,232,212,0.35)">
          <div style="text-align:center;font-size:10px">
            <div style="font-family:var(--font-pixel);color:${this.state.sector1Cleared ? '#fde047' : '#38e8d4'}">${this.state.sector1Cleared ? '★ S1 CLEAR' : `S1 · E${this.state.deepestFloor}/3`}</div>
            <div style="color:var(--text-muted);margin-top:2px">Wrackfeld</div>
          </div>
          <div style="text-align:center;font-size:10px">
            <div style="font-family:var(--font-pixel);color:${this.state.sector2Cleared ? '#e879f9' : this.state.sector1Cleared ? '#c084fc' : 'var(--text-muted)'}">${this.state.sector2Cleared ? '★ S2 CLEAR' : this.state.sector1Cleared ? `S2 · E${this.state.deepestFloorS2}/3` : '🔒 S2'}</div>
            <div style="color:var(--text-muted);margin-top:2px">Kristall-Nebel</div>
          </div>
          <div style="text-align:center;font-size:10px">
            <div style="font-family:var(--font-pixel);color:${this.state.sector3Cleared ? '#fb923c' : this.state.sector2Cleared ? '#f97316' : 'var(--text-muted)'}">${this.state.sector3Cleared ? '★ S3 CLEAR' : this.state.sector2Cleared ? `S3 · E${this.state.deepestFloorS3}/3` : '🔒 S3'}</div>
            <div style="color:var(--text-muted);margin-top:2px">Solar-Gießerei</div>
          </div>
          <div style="text-align:center;font-size:10px;border-left:1px solid rgba(255,255,255,0.12);padding-left:6px">
            <div style="font-family:var(--font-pixel);color:${this.state.omegaCleared ? '#fde047' : this.state.sector4Cleared ? '#38e8d4' : this.state.sector3Cleared ? '#38bdf8' : '#94a3b8'}">${
              this.state.omegaCleared
                ? '🌌 OMEGA ★'
                : this.state.sector4Cleared
                  ? '★ 5. TOR OFFEN'
                  : this.state.sector3Cleared
                    ? `S4 · E${this.state.deepestFloorS4}/3`
                    : '🔒 S4 & 5. TOR'
            }</div>
            <div style="color:var(--text-muted);margin-top:2px">Ältesten-Monolith</div>
          </div>
        </div>
      `
      : '';

    const npcBanner = isForge
      ? `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(249,115,22,0.1);border:1px solid rgba(251,146,60,0.4)">
          <img src="/art/sprites/npc_kael.png" alt="Schmied Kael" style="width:42px;height:46px;image-rendering:pixelated" />
          <div style="font-size:12px;line-height:1.4">
            <strong style="font-family:var(--font-pixel);font-size:11px;color:#fbbf24">SCHMIED KAEL · EXO-SCHMIEDE (BIS MK-VIII)</strong>
            <div style="color:var(--text-muted)">„6 Waffenklassen bis Ältesten-Meister MK-VIII! Schmiede mit Relikten aus Sektor 1–4: Prisma-Matrizen (S2), Vulkan-Herzen (S3) &amp; Archon-Kronen (S4).“</div>
          </div>
        </div>
      `
      : isMedBay
        ? `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.4)">
          <img src="/art/sprites/npc_lyra.png" alt="Dr. Lyra" style="width:40px;height:46px;image-rendering:pixelated" />
          <div style="font-size:12px;line-height:1.4">
            <strong style="font-family:var(--font-pixel);font-size:11px;color:#34d399">DR. LYRA · MED-BAY &amp; BIO-LABOR</strong>
            <div style="color:var(--text-muted)">„Deine Vitalwerte sind wieder bei 100 %! Verbessere hier deine Med-Stimpacks oder lass dir ein Nano-Vitalserum für automatische Raum-Heilung &amp; Energie-Regen injizieren.“</div>
          </div>
        </div>
      `
        : isTechLab
          ? `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(56,232,212,0.1);border:1px solid rgba(56,232,212,0.42)">
          <img src="/art/sprites/npc_vex.png" alt="Ingenieurin Vex" style="width:42px;height:48px;image-rendering:pixelated" />
          <div style="font-size:12px;line-height:1.4">
            <strong style="font-family:var(--font-pixel);font-size:11px;color:#38e8d4">INGENIEURIN VEX · TECH-LABOR</strong>
            <div style="color:var(--text-muted)">„Meine passiven Exo-Module steigern Krit-Chance, Lauf- &amp; Dash-Tempo und Relikt-Glück dauerhaft — unverzichtbar für Sektor 1 &amp; den Kristall-Nebel!“</div>
          </div>
        </div>
        ${sectorProgressHtml}
      `
          : `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;background:rgba(56,232,212,0.09);border:1px solid rgba(56,232,212,0.38);flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px">
            <img src="/art/sprites/prop_salebox.png" alt="Astro-Barter Ausbau" style="width:36px;height:36px;image-rendering:pixelated" />
            <div style="font-size:12px;line-height:1.4">
              <strong style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-cyan)">
                ASTRO-BARTER · STUFE ${['I', 'II', 'III'][this.state.upgrades.shopTier ?? 0] ?? 'I'}
              </strong>
              <div style="color:var(--text-muted)">
                Vergrößere deinen Laden (4 → 6 → 8 Podeste, mehr Truhen im Hinterzimmer &amp; Sale-Box), hänge Holo-Laternen auf und steigere Erlös &amp; Trinkgeld!
              </div>
            </div>
          </div>
          <button id="btn-open-codex-from-term" class="btn" style="padding:6px 10px;font-size:9.5px">Scan-Codex öffnen</button>
        </div>
      `;

    const cardsHtml = tracks
      .map((track) => {
        const wid = track.weaponId;
        const isLockedWeapon = wid ? !this.state.unlockedWeapons[wid] : false;

        // Uncrafted Weapon Card (e.g. Ionen-Speer, Kinetik-Fäuste, Phasen-Diskus, Puls-Blaster or Grav-Hammer!)
        if (isLockedWeapon && wid && track.craftCost) {
          const canCraft = this.state.canCraftWeapon(wid);
          const typeLock = this.state.getWeaponTypeLock(wid);
          const craftPrice = this.state.getForgeCreditCost(track.craftCost.creditCost, track.shop);
          const hasCr = this.state.credits >= craftPrice;
          const pinKey = `craft:${wid}`;
          const isPinned = this.state.isRecipePinned(pinKey);
          const matsHtml = track.craftCost.materials
            .map((m) => {
              const def = getItemDef(m.itemId);
              const owned = countItemTotal(this.state.inventory, m.itemId);
              return `<span class="mat-pill ${owned >= m.qty ? 'ok' : 'missing'}">${def.name}: ${owned}/${m.qty}</span>`;
            })
            .join('');

          return `
            <div class="upgrade-card" style="border-color:${isPinned ? '#fbbf24' : 'rgba(251,191,36,0.45)'}">
              <div class="upgrade-left">
                <div class="inspector-icon-wrap">
                  <img class="pixel-icon" src="${track.iconUrl}" alt="${track.title}" />
                </div>
                <div>
                  <div style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">
                    NEUE WAFFE: ${track.title}
                  </div>
                  <div style="font-size:12px;color:var(--text-muted)">
                    ${track.primaryDesc ?? ''} · <span style="color:var(--accent-cyan)">${track.secondaryDesc ?? ''}</span>
                  </div>
                  <div class="mat-list">
                    <span class="mat-pill ${hasCr ? 'ok' : 'missing'}">${craftPrice} Cr</span>
                    ${matsHtml}
                  </div>
                  ${typeLock ? `<div class="weapon-type-lock" style="font-size:11px;color:#f87171;margin-top:4px">🔒 ${typeLock}</div>` : ''}
                </div>
              </div>
              <div class="upgrade-actions">
                <button class="btn btn-amber btn-craft-weapon" data-wid="${wid}" ${canCraft ? '' : 'disabled'}>
                  Schmieden
                </button>
                <button class="btn-pin ${isPinned ? 'pinned' : ''}" data-pin-key="${pinKey}" title="Materialien für dieses Rezept merken">
                  ${isPinned ? '📌 Angepinnt' : '📌 Merken'}
                </button>
              </div>
            </div>
          `;
        }

        // Unlocked Weapon or Standard Track Card
        const curLvl = this.state.upgrades[track.key] ?? 0;
        const nextTier = track.tiers[curLvl];
        const pips = track.tiers
          .map((_, idx) => `<span class="pip ${idx < curLvl ? 'filled' : ''}"></span>`)
          .join('');

        // M10-C: Ausrüsten läuft über das Loadout-Panel oben (keine Knöpfe mehr je Karte)
        const equipControls = '';

        if (!nextTier) {
          return `
            <div class="upgrade-card">
              <div class="upgrade-left">
                <div class="inspector-icon-wrap">
                  <img class="pixel-icon" src="${track.iconUrl}" alt="${track.title}" />
                </div>
                <div>
                  <div style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-emerald)">
                    ${track.title} <span class="upgrade-pips">${pips}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-muted)">Maximal aufgerüstet!</div>
                  ${equipControls}
                </div>
              </div>
              <span class="rarity-badge" style="color:var(--accent-emerald)">MAX</span>
            </div>
          `;
        }

        const canAfford = this.state.canAffordUpgrade(track.key);
        const weaponLock = this.state.getWeaponTierLock(track.key); // M10-C: Fortschritts-Sperre
        const tierLocked =
          (track.requiresShopTier !== undefined && (this.state.upgrades.shopTier ?? 0) < track.requiresShopTier) ||
          weaponLock !== null;
        const tierPrice = this.state.getForgeCreditCost(nextTier.creditCost, track.shop);
        const hasCredits = this.state.credits >= tierPrice;
        const pinKey = `upgrade:${track.key}`;
        const isPinned = this.state.isRecipePinned(pinKey);
        const matsHtml = nextTier.materials
          .map((m) => {
            const def = getItemDef(m.itemId);
            const owned = countItemTotal(this.state.inventory, m.itemId);
            return `<span class="mat-pill ${owned >= m.qty ? 'ok' : 'missing'}">${def.name}: ${owned}/${m.qty}</span>`;
          })
          .join('');

        return `
          <div class="upgrade-card" style="${isPinned ? 'border-color:#fbbf24' : track.key === 'shopTier' ? 'border-color:rgba(251,191,36,0.48)' : tierLocked ? 'opacity:0.78' : ''}">
            <div class="upgrade-left">
              <div class="inspector-icon-wrap">
                <img class="pixel-icon" src="${track.iconUrl}" alt="${track.title}" />
              </div>
              <div>
                <div style="font-family:var(--font-pixel);font-size:11px;color:#fff">
                  ${track.title}: <span style="color:var(--accent-cyan)">${nextTier.name}</span>
                  <span class="upgrade-pips">${pips}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">
                  ${nextTier.description} · <strong style="color:var(--accent-amber)">${nextTier.statLabel}</strong>
                </div>
                ${
                  tierLocked
                    ? `<div style="font-size:11px;color:var(--accent-coral);margin-top:4px">🔒 ${weaponLock !== null ? `Benötigt: ${weaponLock}` : 'Benötigt zuerst: Shop-Vergrößerung Stufe II (Astro-Barter Galerie)'}</div>`
                    : `<div class="mat-list">
                        <span class="mat-pill ${hasCredits ? 'ok' : 'missing'}">${tierPrice} Cr</span>
                        ${matsHtml}
                      </div>`
                }
                ${equipControls}
              </div>
            </div>
            <div class="upgrade-actions">
              <button class="btn ${track.key === 'shopTier' ? 'btn-amber' : 'btn-primary'} btn-buy-upgrade" data-key="${track.key}" ${canAfford ? '' : 'disabled'}>
                ${tierLocked ? 'Gesperrt' : isShopTerm ? 'Ausbauen' : isTechLab ? 'Installieren' : 'Verbessern'}
              </button>
              ${
                !tierLocked && nextTier.materials.length > 0
                  ? `<button class="btn-pin ${isPinned ? 'pinned' : ''}" data-pin-key="${pinKey}" title="Materialien für dieses Upgrade merken">
                       ${isPinned ? '📌 Angepinnt' : '📌 Merken'}
                     </button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');

    const modalTitle = isForge
      ? "KAEL'S EXO-SCHMIEDE"
      : isMedBay
        ? "DR. LYRA'S MED-BAY"
        : isTechLab
          ? "VEX' TECH-LABOR · MODULE & SEKTOR-KARTE"
          : 'ASTRO-BARTER · SHOP-AUSBAU';

    const forgeTabsHtml = isForge
      ? `<div class="modal-tabs" style="flex-wrap:nowrap">
           <button class="tab-btn active" style="white-space:nowrap">Schmiede (MK-VIII)</button>
           <button id="btn-forge-tab-infusions" class="tab-btn" style="white-space:nowrap;color:#fb923c">🔥 Prägungen</button>
         </div>`
      : '';

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header" style="gap:8px">
          <span class="modal-title" style="white-space:nowrap">${modalTitle}</span>
          ${forgeTabsHtml}
          <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber);white-space:nowrap">${this.state.credits} CR</span>
          <button id="modal-close-btn" class="modal-close" style="white-space:nowrap">ESC ✕</button>
        </div>
        <div class="modal-body">
          ${npcBanner}
          ${isForge ? renderLoadoutHtml(this.state, { compact: true }) : ''}
          <div class="upgrade-list">${cardsHtml}</div>
        </div>
      </div>
    `);

    this.modalEl.querySelector('#btn-forge-tab-infusions')?.addEventListener('click', () => {
      sound.playUiClick();
      this.openForgeInfusionsModal(this.state.equippedWeapon);
    });

    this.modalEl.querySelector('#btn-open-codex-from-term')?.addEventListener('click', () => {
      sound.playUiClick();
      this.openInventoryModal(true, 'codex');
    });

    this.modalEl.querySelectorAll<HTMLElement>('.btn-pin').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.pinKey!;
        const nowPinned = this.state.togglePinRecipe(key);
        sound.playUiClick();
        this.toast(
          nowPinned
            ? '📌 Rezept angepinnt — benötigte Materialien werden jetzt im HUD, Shop & Sektor markiert!'
            : 'Rezept von der Merkliste entfernt.',
          nowPinned ? 'good' : 'info',
        );
        this.openStationShopModal(shop);
        this.renderHud();
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('.btn-craft-weapon').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wid = btn.dataset.wid as WeaponId;
        if (this.state.craftWeapon(wid)) {
          const meta = WEAPON_META[wid];
          this.toast(`${meta.name} geschmiedet! Wechsle jederzeit mit [C].`, 'good');
          this.renderHud();
          if (this.hooks.onUpgradeCutscene) {
            this.closeModal();
            this.hooks.onUpgradeCutscene(
              {
                kind: 'weapon',
                title: meta.name.toUpperCase(),
                subtitle: 'Neu geschmiedet · Wechsle jederzeit mit [C]',
                accent: meta.accentColor,
                major: true,
                minaPresent: this.state.isMinaPresent(),
                building: 'forge',
                fromTier: this.state.getHubTiers().forge,
                toTier: this.state.getHubTiers().forge,
              },
              () => this.openStationShopModal(shop),
            );
          } else {
            sound.playUpgrade();
            this.openStationShopModal(shop);
          }
        }
      });
    });

    if (isForge) {
      bindLoadout(this.modalEl, this.state, () => {
        sound.playWeaponSwap();
        this.openStationShopModal(shop);
        this.renderHud();
      });
    }

    this.modalEl.querySelectorAll<HTMLElement>('.btn-buy-upgrade').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key as UpgradeKey;
        const prevLevel = this.state.upgrades[key];
        const beforeTiers = this.state.getHubTiers();
        if (this.state.purchaseUpgrade(key)) {
          const nextLevel = this.state.upgrades[key];
          const track = UPGRADE_TRACKS.find((t) => t.key === key);
          if (key === 'shopTier') {
            this.toast(
              nextLevel === 1
                ? '★ Stufe II erreicht! 6 Holo-Podeste, Sale-Box & 2 Lagertruhen (36 Slots) im Hinterzimmer!'
                : '★ Stufe III erreicht! 8 Podeste & 3 Lagertruhen (48 Slots) im Kapitäns-Quartier!',
              'good',
            );
          } else if (key === 'quartersTier') {
            this.toast(
              nextLevel === 1
                ? '★ Quartier Stufe II! Drohnen-Dock & Sternen-Jukebox sind installiert — schau in deiner Kajüte vorbei!'
                : '★ Quartier Stufe III! Die Flaggschiff-Suite mit Trophäen-Vitrinen steht bereit!',
              'good',
            );
          } else {
            this.toast(
              isShopTerm
                ? 'Astro-Barter erfolgreich ausgebaut!'
                : isTechLab
                  ? 'Exo-Modul dauerhaft installiert!'
                  : 'Upgrade erfolgreich fertiggestellt!',
              'good',
            );
          }
          this.renderHud();
          if (this.hooks.onUpgradeCutscene) {
            const isMajor = key === 'shopTier' || key === 'quartersTier';
            const hubTierId = shop === 'forge' ? 'forge' : shop === 'medbay' ? 'med' : shop === 'techlab' ? 'tech' : null;
            const buildingId = hubTierId;
            const afterTiers = this.state.getHubTiers();
            const buildingTierChanged = hubTierId !== null && afterTiers[hubTierId] !== beforeTiers[hubTierId];
            this.closeModal();
            this.hooks.onUpgradeCutscene(
              {
                kind: key === 'quartersTier' ? 'quarters' : isMajor ? 'shop' : isForge ? 'forge_step' : 'tech_step',
                title: (track?.title ?? 'UPGRADE').toUpperCase(),
                subtitle: key === 'quartersTier'
                  ? nextLevel === 1
                    ? 'Stufe II · Drohnen-Dock & Jukebox installiert'
                    : 'Stufe III · Flaggschiff-Suite eingerichtet'
                  : isMajor
                  ? nextLevel === 1
                    ? 'Stufe II · 6 Podeste & Sale-Box freigeschaltet'
                    : 'Stufe III · 8 Podeste & 3 Lagertruhen freigeschaltet'
                  : `Stufe ${prevLevel} → Stufe ${nextLevel}`,
                accent: isMajor ? '#fbbf24' : isForge ? '#fb923c' : isTechLab ? '#38bdf8' : '#34d399',
                major: isMajor || buildingTierChanged,
                minaPresent: this.state.isMinaPresent(),
                ...(buildingId
                  ? { building: buildingId, fromTier: beforeTiers[hubTierId as 'forge' | 'med' | 'tech'], toTier: afterTiers[hubTierId as 'forge' | 'med' | 'tech'] }
                  : {}),
                ...(key === 'shopTier' ? { room: 'shop' as const, fromTier: nextLevel - 1, toTier: nextLevel } : {}),
                ...(key === 'quartersTier' ? { room: 'backroom' as const, fromTier: nextLevel - 1, toTier: nextLevel } : {}),
              },
              () => this.openStationShopModal(shop),
            );
          } else {
            sound.playUpgrade();
            this.openStationShopModal(shop);
          }
        }
      });
    });
  }

  // ==================== KAEL'S ELEMENTAR-PRÄGUNGEN (MEILENSTEIN 7) ====================
  public openForgeInfusionsModal(selectedWeapon: WeaponId = this.state.equippedWeapon): void {
    const forgedWeapons = (['blade', 'spear', 'fists', 'discus', 'blaster', 'hammer'] as WeaponId[]).filter(
      (w) => this.state.unlockedWeapons[w],
    );
    const activeWep: WeaponId = forgedWeapons.includes(selectedWeapon)
      ? selectedWeapon
      : forgedWeapons[0] ?? 'blade';
    const currentInf = this.state.getActiveInfusion(activeWep);
    const wMeta = WEAPON_META[activeWep];

    const wepPillsHtml = forgedWeapons
      .map((wid) => {
        const m = WEAPON_META[wid];
        const inf = getInfusionDef(this.state.getActiveInfusion(wid));
        const isSel = wid === activeWep;
        return `
          <button class="btn ${isSel ? 'btn-primary' : ''}" data-inf-wep="${wid}" style="display:inline-flex;align-items:center;gap:5px;padding:5px 8px;font-size:9.5px">
            <img src="${m.iconUrl}" alt="${m.shortName}" style="width:16px;height:16px;image-rendering:pixelated" />
            <span>${m.shortName}</span>
            ${inf ? `<span style="color:${inf.color}">${inf.icon}</span>` : ''}
          </button>
        `;
      })
      .join('');

    const cardsHtml = INFUSIONS.map((inf) => {
      const unlocked = this.state.isInfusionUnlocked(activeWep, inf.id);
      const equipped = currentInf === inf.id;
      const canBuy = this.state.canUnlockInfusion(activeWep, inf.id);
      const matsHtml = inf.materials
        .map((m) => {
          const def = getItemDef(m.itemId);
          const have = countItemTotal(this.state.inventory, m.itemId);
          const ok = have >= m.qty;
          return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:${ok ? '#4ade80' : '#fb7185'}">
            <img src="/art/sprites/item_${m.itemId}.png" alt="${def.name}" style="width:15px;height:15px;image-rendering:pixelated" />
            ${def.name} ${have}/${m.qty}
          </span>`;
        })
        .join('');

      const btnHtml = equipped
        ? `<button class="btn" data-inf-remove="1" style="font-size:9.5px">Entfernen</button>`
        : unlocked
          ? `<button class="btn btn-primary" data-inf-equip="${inf.id}" style="font-size:9.5px">Aktivieren</button>`
          : `<button class="btn ${canBuy ? 'btn-primary' : ''}" data-inf-unlock="${inf.id}" ${canBuy ? '' : 'disabled'} style="font-size:9.5px">Prägen (${inf.creditCost} CR)</button>`;

      return `
        <div class="upgrade-card" style="border-color:${equipped ? inf.color : unlocked ? 'rgba(56,232,212,0.4)' : 'var(--border-steel)'};background:${equipped ? 'rgba(56,232,212,0.08)' : 'rgba(13,20,34,0.75)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:16px">${inf.icon}</span>
                <strong style="font-family:var(--font-pixel);font-size:11px;color:${inf.color}">${inf.name}</strong>
                ${equipped ? `<span style="font-family:var(--font-pixel);font-size:8px;padding:1px 5px;background:rgba(52,211,153,0.2);color:#34d399;border:1px solid #34d399">AKTIV ✓</span>` : unlocked ? `<span style="font-family:var(--font-pixel);font-size:8px;padding:1px 5px;background:rgba(56,232,212,0.16);color:#38e8d4">FREIGESCHALTET</span>` : ''}
              </div>
              <div style="font-size:11.5px;color:#e2e8f0;margin-top:4px">${inf.summary}</div>
              <div style="font-size:10.5px;color:var(--text-muted);margin-top:2px">Kampf-Effekt: ${inf.combatDetail}</div>
              ${!unlocked ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;align-items:center"><span style="font-family:var(--font-pixel);font-size:9.5px;color:${this.state.credits >= inf.creditCost ? '#fbbf24' : '#fb7185'}">${inf.creditCost} CR</span>${matsHtml}</div>` : '<div style="font-size:10px;color:#67e8f9;margin-top:5px">✓ Bereits für diese Waffe freigeschaltet — jederzeit kostenlos wechselbar!</div>'}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">${btnHtml}</div>
          </div>
        </div>
      `;
    }).join('');

    this.showModalHtml(`
      <div class="modal-window" style="max-width:670px">
        <div class="modal-header" style="gap:8px">
          <span class="modal-title" style="white-space:nowrap">KAEL'S EXO-SCHMIEDE</span>
          <div class="modal-tabs" style="flex-wrap:nowrap">
            <button id="btn-forge-tab-main" class="tab-btn" style="white-space:nowrap">Schmiede (MK-VIII)</button>
            <button class="tab-btn active" style="white-space:nowrap;color:#fb923c">🔥 Prägungen</button>
          </div>
          <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber);white-space:nowrap">${this.state.credits} CR</span>
          <button id="modal-close-btn" class="modal-close" style="white-space:nowrap">ESC ✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:10px">
          <div class="npc-banner" style="border-color:rgba(192,132,252,0.45)">
            <img src="/art/sprites/item_rift_catalyst.png" alt="Rift-Katalysator" style="width:46px;height:46px;image-rendering:pixelated" />
            <div>
              <strong style="font-family:var(--font-pixel);font-size:10.5px;color:#e879f9">RIFT-ELEMENTARPRÄGUNGEN · ${wMeta.name.toUpperCase()}</strong>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:3px">
                Finde <strong>Rift-Katalysatoren</strong> in instabilen 🌀 <strong>Rift-Rissen</strong> mitten in Sektoren oder in der <strong>∞ Unendlichen Spirale</strong>, um deinen Waffen aktive Elementarkräfte einzuprägen!
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <span style="font-family:var(--font-pixel);font-size:9px;color:var(--text-muted)">WAFFE:</span>
            ${wepPillsHtml}
          </div>
          <div class="upgrade-list">${cardsHtml}</div>
        </div>
      </div>
    `);

    this.modalEl.querySelector('#btn-forge-tab-main')?.addEventListener('click', () => {
      sound.playUiClick();
      this.openStationShopModal('forge');
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-inf-wep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        this.openForgeInfusionsModal(btn.dataset.infWep as WeaponId);
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-inf-unlock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const infId = btn.dataset.infUnlock as Exclude<InfusionId, 'none'>;
        const res = this.state.unlockAndEquipInfusion(activeWep, infId);
        if (res.ok) {
          const def = getInfusionDef(infId);
          sound.playUpgrade();
          this.toast(`${def?.icon ?? '🔥'} ${wMeta.name} mit ${def?.name ?? infId} geprägt!`, 'good');
          this.renderHud();
          this.openForgeInfusionsModal(activeWep);
        } else {
          this.toast(res.error ?? 'Prägung fehlgeschlagen', 'warn');
        }
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-inf-equip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const infId = btn.dataset.infEquip as Exclude<InfusionId, 'none'>;
        if (this.state.equipInfusion(activeWep, infId)) {
          const def = getInfusionDef(infId);
          sound.playWeaponSwap();
          this.toast(`${def?.icon ?? '🔥'} ${def?.name ?? infId} auf ${wMeta.name} aktiviert!`, 'good');
          this.renderHud();
          this.openForgeInfusionsModal(activeWep);
        }
      });
    });

    this.modalEl.querySelector('[data-inf-remove]')?.addEventListener('click', () => {
      this.state.equipInfusion(activeWep, 'none');
      sound.playUiClick();
      this.toast(`Prägung von ${wMeta.name} entfernt.`, 'info');
      this.renderHud();
      this.openForgeInfusionsModal(activeWep);
    });
  }

  // ==================== 5. TIEFENRAUM-TOR AUSWAHL (OMEGA vs. ∞ UNENDLICHE SPIRALE) ====================
  public openOmegaGateModal(
    onStartOmega: () => void,
    onStartEndlessRift: () => void,
    onStartWeeklyTrial: (info: WeeklyTrialInfo) => void,
  ): void {
    const keys =
      (this.state.sector1Cleared ? 1 : 0) +
      (this.state.sector2Cleared ? 1 : 0) +
      (this.state.sector3Cleared ? 1 : 0) +
      (this.state.sector4Cleared ? 1 : 0);
    const omegaUnlocked = keys >= 4;
    const spiralUnlocked = this.state.omegaCleared;
    const bestSpiral = this.state.records.deepestRiftFloor ?? 0;
    const trialInfo = getCurrentWeeklyTrial();

    this.showModalHtml(`
      <div class="modal-window" style="max-width:700px">
        <div class="modal-header">
          <span class="modal-title" style="color:#fde047;white-space:nowrap">🌌 5. TIEFENRAUM-TOR · ZIEL WÄHLEN</span>
          <button id="modal-close-btn" class="modal-close" style="white-space:nowrap">ESC ✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
          <div style="font-size:12px;color:var(--text-muted);line-height:1.45">
            Das 5. Tor öffnet drei Wege — die Omega-Anomalie (alle 4 Siegel), die Endlos-Spirale (nach dem Finale) und die wöchentliche Galaktische Prüfung:
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">
            <div class="inspector-box" style="gap:8px;border-color:${omegaUnlocked ? 'rgba(253,224,71,0.55)' : 'rgba(100,116,139,0.4)'};background:${omegaUnlocked ? 'rgba(250,204,21,0.07)' : 'rgba(15,23,42,0.55)'}">
              <div style="font-family:var(--font-pixel);font-size:11px;color:${omegaUnlocked ? '#fde047' : '#94a3b8'}">🌌 OMEGA-ANOMALIE</div>
              <div style="font-size:11.5px;color:#e2e8f0;line-height:1.45">
                Die klassische 5.-Tor-Prüfung gegen <strong>★ OMEGA STERNEN-ARCHON</strong>. Schaltet das Finale, New Game+ &amp; den Omega-Anzug frei.
              </div>
              <div style="font-size:10.5px;color:var(--text-muted)">
                Bestzeit: <strong style="color:#38e8d4">${formatDurationSec(this.state.records.bestSectorClearSec[5])}</strong>
              </div>
              ${
                omegaUnlocked
                  ? `<button id="btn-launch-omega-classic" class="btn btn-primary" style="margin-top:auto">🌌 Omega starten</button>`
                  : `<button class="btn" disabled style="margin-top:auto">🔒 ${keys}/4 Sektor-Siegel</button>`
              }
            </div>

            <div class="inspector-box" style="gap:8px;border-color:${spiralUnlocked ? 'rgba(192,132,252,0.75)' : 'rgba(100,116,139,0.4)'};background:${spiralUnlocked ? 'rgba(139,92,246,0.12)' : 'rgba(15,23,42,0.55)'}">
              <div style="font-family:var(--font-pixel);font-size:11px;color:${spiralUnlocked ? '#e879f9' : '#94a3b8'}">🌀 ∞ UNENDLICHE SPIRALE</div>
              <div style="font-size:11.5px;color:${spiralUnlocked ? '#e2e8f0' : 'var(--text-muted)'};line-height:1.45">
                Endlose Rift-Ebenen (E1 → ∞) mit Elite-Mutatoren, Bossen alle 3 Ebenen, <strong>Singularitäts-Relikten</strong> &amp; eigener Rangliste!
              </div>
              <div style="font-size:10.5px;color:var(--text-muted)">
                Rekord: <strong style="color:#e879f9">${bestSpiral > 0 ? `∞ Ebene ${bestSpiral}` : 'Noch nicht betreten'}</strong>
              </div>
              ${
                spiralUnlocked
                  ? `<button id="btn-launch-endless-spiral" class="btn btn-primary" style="margin-top:auto;background:rgba(168,85,247,0.35);border-color:#c084fc;color:#f5d0fe">🌀 Spirale betreten</button>`
                  : `<button class="btn" disabled style="margin-top:auto">🔒 Besiege erst Omega</button>`
              }
            </div>

            ${renderTrialGateCardHtml(trialInfo, this.state.weeklyTrial, this.state.isWeeklyTrialUnlocked())}
          </div>
        </div>
      </div>
    `);

    this.modalEl.querySelector('#btn-launch-omega-classic')?.addEventListener('click', () => {
      sound.playWarp();
      this.closeModal();
      onStartOmega();
    });

    this.modalEl.querySelector('#btn-launch-endless-spiral')?.addEventListener('click', () => {
      sound.playWarp();
      this.closeModal();
      onStartEndlessRift();
    });

    this.modalEl.querySelector('#btn-launch-weekly-trial')?.addEventListener('click', () => {
      sound.playWarp();
      this.closeModal();
      onStartWeeklyTrial(trialInfo);
    });
  }

  /** Ergebnis-Modal der Galaktischen Prüfung. Gibt eine Funktion zurück, die den Upload-Status nachträgt. */
  public openWeeklyTrialResultModal(summary: RunSummary): (text: string, tone?: 'good' | 'warn') => void {
    this.showModalHtml(renderWeeklyTrialResultHtml(summary));
    this.modalEl.querySelector('#btn-trial-result-close')?.addEventListener('click', () => {
      sound.playUiClick();
      this.closeModal();
    });
    return (text, tone = 'good') => {
      const el = this.modalEl.querySelector<HTMLElement>('#trial-upload-status');
      if (!el) return; // Modal wurde bereits geschlossen
      el.textContent = text;
      el.style.color = tone === 'warn' ? '#fbbf24' : '#4ade80';
    };
  }

  // ==================== AUFTRAGS-PINNWAND (BOUNTY CONTRACTS) ====================
  public openBountiesModal(): void {
    const art = getHDArt();

    const cardsHtml = this.state.bounties
      .map((b) => {
        const def = getItemDef(b.itemId);
        const rarity = RARITY_META[def.rarity];
        const owned = countItemTotal(this.state.inventory, b.itemId);
        const ready = !b.completed && owned >= b.qty;

        return `
          <div class="upgrade-card" style="${ready ? 'border-color:rgba(52,211,153,0.6);background:rgba(16,42,42,0.45)' : b.completed ? 'opacity:0.55' : ''}">
            <div class="upgrade-left">
              <div class="inspector-icon-wrap">
                <img class="pixel-icon" src="${art.itemUrls[b.itemId]}" alt="${def.name}" />
              </div>
              <div>
                <div style="font-family:var(--font-pixel);font-size:11px;color:${rarity.color}">
                  ${b.qty}× ${def.name}
                </div>
                <div style="font-size:12px;color:var(--text-muted)">
                  Auftraggeber: <strong style="color:var(--text-main)">${b.clientName}</strong>
                </div>
                <div class="mat-list">
                  <span class="mat-pill ${owned >= b.qty || b.completed ? 'ok' : 'missing'}">
                    Bestand: ${owned}/${b.qty}
                  </span>
                  <span class="mat-pill ok" style="color:var(--accent-amber);border-color:rgba(251,191,36,0.5)">
                    Prämie: +${b.rewardCredits} Cr (~165 %)
                  </span>
                </div>
              </div>
            </div>
            ${
              b.completed
                ? `<span class="rarity-badge" style="color:var(--accent-emerald)">✓ ERLEDIGT</span>`
                : `<button class="btn ${ready ? 'btn-amber' : ''} btn-complete-bounty" data-bid="${b.id}" ${ready ? '' : 'disabled'}>
                    Abliefern
                  </button>`
            }
          </div>
        `;
      })
      .join('');

    const readyOrdersBadge = this.state.hasReadyBigOrder() ? ' ★' : '';
    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title">AUFTRAGS-PINNWAND · TAG ${this.state.day}</span>
          <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${this.state.credits} CR</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="modal-tabs" style="margin-bottom:10px">
            <button class="tab-btn active">📋 Tages-Aufträge</button>
            <button class="tab-btn" id="tab-goto-patrons">🏛️ Stammkunden & Großaufträge${readyOrdersBadge}</button>
          </div>
          <div class="modifier-box" style="border-left-color:var(--accent-cyan);background:rgba(56,232,212,0.08);color:#cffafe">
            ★ Bewohner von Port Solaris zahlen <strong>+65 % Bonus-Marktwert</strong> für gezielte Lieferungen!
            Jeden neuen Morgen (nach der Nacht-Ruhe) erscheinen 3 frische Sonderaufträge.
          </div>
          <div class="upgrade-list">${cardsHtml}</div>
        </div>
      </div>
    `);

    this.modalEl.querySelector('#tab-goto-patrons')?.addEventListener('click', () => {
      sound.playUiClick();
      this.openPatronsModal(true);
    });

    this.modalEl.querySelectorAll<HTMLElement>('.btn-complete-bounty').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bid = btn.dataset.bid!;
        const done = this.state.completeBounty(bid);
        if (done) {
          sound.playRegister();
          this.toast(
            `Auftrag für ${done.clientName} geliefert! +${done.rewardCredits} Cr erhalten!`,
            'good',
          );
          this.openBountiesModal();
          this.renderHud();
        }
      });
    });
  }

  // ==================== MEILENSTEIN 8 MODALS (DELEGATED TO MarketModals.ts) ====================
  private getMarketModalHost(): MarketModalHost {
    return {
      state: this.state,
      modalEl: this.modalEl,
      showModalHtml: (html) => this.showModalHtml(html),
      closeModal: () => this.closeModal(),
      renderHud: () => this.renderHud(),
      toast: (msg, tone) => this.toast(msg, tone),
      openBountiesModal: () => this.openBountiesModal(),
    };
  }

  public openShiftSummaryModal(summary: ShiftSummary): void {
    renderShiftSummaryModal(this.getMarketModalHost(), summary);
  }

  public openHaggleModal(
    payload: HagglePayload,
    onComplete: (result: { accepted: boolean; finalPrice: number; bonusCredits: number }) => void,
  ): void {
    renderHaggleModal(this.getMarketModalHost(), payload, onComplete);
  }

  public openPatronsModal(showBountiesTab = false): void {
    renderPatronsModal(this.getMarketModalHost(), showBountiesTab);
  }

  public openAlchemyBarModal(): void {
    renderAlchemyBarModal(this.getMarketModalHost());
  }

  public openTradeBankModal(): void {
    renderTradeBankModal(this.getMarketModalHost());
  }

  // ==================== SONDERANGEBOTS-KISTE (SALE-BOX, STUFE II+) ====================
  public openSaleBoxModal(): void {
    const art = getHDArt();

    // Aggregate available inventory items
    const counts = new Map<string, number>();
    for (const entry of getAllAvailableShopItems(this.state.inventory)) {
      counts.set(entry.stack.itemId, (counts.get(entry.stack.itemId) ?? 0) + entry.stack.qty);
    }
    const availIds = Array.from(counts.keys());

    const stockedHtml =
      this.state.saleBox.length > 0
        ? this.state.saleBox
            .map((s, idx) => {
              const def = getItemDef(s.itemId);
              const rarity = RARITY_META[def.rarity];
              const salePrice = Math.max(5, Math.round(scaledSellValue(def.baseValue) * 0.7));
              return `
                <div class="picker-row" style="justify-content:space-between;cursor:default">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0">
                    <img src="${art.itemUrls[s.itemId]}" alt="${def.name}" />
                    <div>
                      <div style="font-family:var(--font-pixel);font-size:10.5px;color:${rarity.color}">${def.name} ×${s.qty}</div>
                      <div style="font-size:11px;color:var(--accent-amber)">Auto-Verkauf: ${salePrice} Cr/Stk</div>
                    </div>
                  </div>
                  <button class="btn btn-take-salebox" data-idx="${idx}" style="padding:4px 8px;font-size:9px">Zurück</button>
                </div>
              `;
            })
            .join('')
        : `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:12px">
             Die Kiste ist leer. Lege rechts überschüssige Relikte hinein!
           </div>`;

    const availHtml =
      availIds.length > 0
        ? availIds
            .map((id) => {
              const def = getItemDef(id);
              const rarity = RARITY_META[def.rarity];
              const total = counts.get(id) ?? 0;
              const salePrice = Math.max(5, Math.round(scaledSellValue(def.baseValue) * 0.7));
              const pinNeed = this.state.getPinnedItemNeed(id);
              return `
                <div class="picker-row" style="justify-content:space-between;cursor:default">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0">
                    <img src="${art.itemUrls[id]}" alt="${def.name}" />
                    <div>
                      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
                        <span style="font-family:var(--font-pixel);font-size:10.5px;color:${rarity.color}">${def.name} (${total}×)</span>
                        ${pinNeed ? `<span class="pin-wanted-pill" title="Gebraucht für: ${pinNeed.recipeTitles.join(', ')}">📌 ${pinNeed.owned}/${pinNeed.required}</span>` : ''}
                      </div>
                      <div style="font-size:11px;color:var(--text-muted)">≈ ${salePrice} Cr/Stk (70 %)</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-amber btn-add-salebox" data-id="${id}" data-qty="1" style="padding:4px 8px;font-size:9px">+1</button>
                    ${
                      total > 1
                        ? `<button class="btn btn-add-salebox" data-id="${id}" data-qty="${Math.min(5, total)}" style="padding:4px 7px;font-size:9px">+${Math.min(5, total)}</button>`
                        : ''
                    }
                  </div>
                </div>
              `;
            })
            .join('')
        : `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:12px">
             Keine Relikte im Rucksack oder in der Lagertruhe.
           </div>`;

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title">SONDERANGEBOTS-KISTE (AUTO-SALE · 70 %)</span>
          <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${this.state.credits} CR</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="modifier-box">
            Relikte in dieser Kiste verkaufen sich bei geöffnetem Laden <strong>vollautomatisch</strong> zum Schnäppchenpreis (70 % Marktwert) — perfekt für schnellen Umsatz ohne Kassen-Wartezeit!
          </div>
          <div class="pedestal-layout">
            <div>
              <div class="section-label"><span>IN DER SALE-BOX (${this.state.saleBox.length}/6 SLOTS)</span></div>
              <div class="item-picker-list">${stockedHtml}</div>
            </div>
            <div>
              <div class="section-label"><span>AUS LAGER EINLEGEN</span></div>
              <div class="item-picker-list">${availHtml}</div>
            </div>
          </div>
        </div>
      </div>
    `);

    this.modalEl.querySelectorAll<HTMLElement>('.btn-add-salebox').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id!;
        const qty = Number(btn.dataset.qty ?? 1);
        if (this.state.addToSaleBox(id, qty)) {
          sound.playPickup();
          this.openSaleBoxModal();
          this.renderHud();
        } else {
          sound.playReaction('expensive');
          this.toast('Sonderangebots-Kiste ist voll (max. 6 Stacks)!', 'warn');
        }
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('.btn-take-salebox').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        if (this.state.takeFromSaleBox(idx)) {
          sound.playUiClick();
          this.openSaleBoxModal();
          this.renderHud();
        }
      });
    });
  }

  // ==================== EXPEDITION SUMMARY MODAL ====================
  public openRunSummaryModal(summary: RunSummary): void {
    const sec = summary.sector ?? 1;
    const title = summary.isEndlessRift
      ? summary.victory
        ? `🌀 ∞ SPIRALE · EBENE ${summary.riftDepthReached ?? summary.floorReached} EXTRAHIERT!`
        : `🌀 IN DER SPIRALE (EBENE ${summary.riftDepthReached ?? summary.floorReached}) GEFALLEN`
      : summary.omegaCleared
        ? '🌌 OMEGA-ANOMALIE BEZWUNGEN! (FINALE)'
        : summary.sector4Cleared
          ? '👑 SEKTOR 4 BEZWUNGEN!'
          : summary.sector3Cleared
            ? '🔥 SEKTOR 3 BEZWUNGEN!'
            : summary.sector2Cleared
              ? '★ SEKTOR 2 BEZWUNGEN!'
              : summary.sector1Cleared
                ? '★ SEKTOR 1 BEZWUNGEN!'
                : summary.reason === 'boss_victory'
                  ? 'TRIUMPHALE EXTRAKTION!'
                  : summary.victory
                    ? 'EXTRAKTION ERFOLGREICH!'
                    : sec === 5
                      ? 'IN DER OMEGA-ANOMALIE GEFALLEN'
                      : sec === 4
                        ? 'IM ÄLTESTEN-MONOLITH GEFALLEN'
                        : sec === 3
                          ? 'IN DER SOLAR-GIESSEREI GEFALLEN'
                          : sec === 2
                            ? 'IM KRISTALL-NEBEL GEFALLEN (0 HP)'
                            : 'IM WRACK GEFALLEN (0 HP)';
    const titleColor = summary.isEndlessRift
      ? summary.victory
        ? '#e879f9'
        : 'var(--accent-coral)'
      : summary.omegaCleared
        ? '#fde047'
        : summary.sector4Cleared
          ? '#38e8d4'
          : summary.sector3Cleared
            ? '#fb923c'
            : summary.sector2Cleared
              ? '#e879f9'
              : summary.sector1Cleared
                ? '#fde047'
                : summary.victory
                  ? 'var(--accent-emerald)'
                  : 'var(--accent-coral)';
    const floorLabel = summary.isEndlessRift
      ? `∞ Spirale · Ebene ${summary.riftDepthReached ?? summary.floorReached}`
      : sec === 5
        ? '5. Tor · Omega'
        : `S${sec} · ${
            summary.floorReached === 3
              ? 'Ebene III'
              : summary.floorReached === 2
                ? 'Ebene II'
                : 'Ebene I'
          }`;

    const extraNotes: string[] = [];
    if (summary.omegaCleared) {
      extraNotes.push(
        `🌌 <strong>STORY-FINALE VOLLENDET!</strong> Du hast das Geheimnis des 5. Tiefenraum-Tors gelüftet und den <strong>★ OMEGA STERNEN-ARCHON</strong> bezwungen! Der legendäre <strong>★ Omega-Sternenlicht-Anzug</strong> &amp; <strong>New Game+</strong> sind im <strong>Kapitäns-Logbuch</strong> freigeschaltet!`,
      );
    } else if (summary.sector4Cleared) {
      extraNotes.push(
        `👑 <strong>DER STERNEN-ARCHON BESIEGT!</strong> Alle <strong>4/4 Sektor-Siegel</strong> glühen jetzt im Raumhafen — das zentrale <strong>5. Tiefenraum-Tor (Omega-Anomalie)</strong> steht offen! Außerdem: <strong>Ältesten-Astral-Anzug</strong> &amp; <strong>MK-VIII Schmiede-Pläne</strong> freigeschaltet!`,
      );
    } else if (summary.sector3Cleared) {
      extraNotes.push(
        `🔥 <strong>VULKAN-TITAN BESIEGT!</strong> <strong>Sektor-4-Schlüssel</strong> (<em>Ältesten-Monolith</em>) an <strong>Dock IV</strong> im Raumhafen, <strong>Siegel #3</strong> am 5. Tor &amp; der <strong>Vulkan-Gold-Anzug</strong> wurden freigeschaltet!`,
      );
    } else if (summary.sector2Cleared) {
      extraNotes.push(
        `💎 <strong>PRISMA-ARCHON BESIEGT!</strong> <strong>Sektor-3-Schlüssel</strong> (<em>Solar-Gießerei</em>) an <strong>Dock III</strong> im Raumhafen, <strong>Siegel #2</strong> am 5. Tor &amp; der <strong>Nebel-Amethyst-Anzug</strong> wurden freigeschaltet!`,
      );
    } else if (summary.sector1Cleared) {
      extraNotes.push(
        `🏆 <strong>A.E.G.I.S. LEVIATHAN BESIEGT!</strong> Sektor-2-Schlüssel (<em>Kristall-Nebel</em>) an <strong>Dock II</strong> im Raumhafen &amp; goldene Trophäe im <strong>Kapitäns-Quartier</strong> aktiviert!`,
      );
    }
    if (summary.nightRun) {
      extraNotes.push(
        `🌙 <strong>Nacht-Expedition:</strong> Erhöhte Fundchance (+35 %) auf seltene &amp; epische Relikte war aktiv!`,
      );
    }
    if (summary.warpedToChest.length > 0) {
      extraNotes.push(
        `⚡ <strong>Warp-Anker (→):</strong> ${summary.warpedToChest.join(', ')} sicher in deine Lagertruhe gerettet!`,
      );
    }
    if (summary.clonedItems && summary.clonedItems.length > 0) {
      extraNotes.push(
        `🧬 <strong>Klon-Matrix (↑):</strong> +1 ${summary.clonedItems.join(', ')} erfolgreich dupliziert!`,
      );
    }
    if (summary.synthesizedItems && summary.synthesizedItems.length > 0) {
      extraNotes.push(
        `☀ <strong>Nova-Resonanz (←):</strong> In +${summary.synthesizedItems.length} ${summary.synthesizedItems[0]} umgewandelt — im Shop verkaufbar!`,
      );
    }
    if (summary.cursedLost && summary.cursedLost.length > 0) {
      extraNotes.push(
        `⚠ <strong>Phasen-Fluch (▲):</strong> ${summary.cursedLost.join(', ')} lag nicht in der obersten Rucksack-Reihe und ist zerfallen!`,
      );
    }
    if (!summary.victory) {
      extraNotes.push(
        'Alle ungeschützten Relikte im Expeditions-Rucksack gingen im Sektor verloren! Nutze beim nächsten Mal Start-Raum, Boss-Teleporter oder die Notfall-Bake [E] oder platziere dein Quanten-Gyroskop (→) links neben dem wichtigsten Relikt.',
      );
    } else if (summary.itemsSaved > 0) {
      extraNotes.push(
        'Gehe links zurück über die Promenade in deinen Shop „Astro-Barter“, um deine Beute für Credits zu verkaufen!',
      );
    }

    this.showModalHtml(`
      <div class="modal-window" style="max-width:580px">
        <div class="modal-header">
          <span class="modal-title" style="color:${titleColor}">${title}</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="summary-grid">
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Tiefe erreicht${summary.runDurationSec ? ` · ⏱ ${formatDurationSec(summary.runDurationSec)}` : ''}</div>
              <div class="val" style="color:#38e8d4">${floorLabel}</div>
            </div>
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Gegner besiegt</div>
              <div class="val">${summary.enemiesDefeated}</div>
            </div>
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Relikte gesichert</div>
              <div class="val" style="color:var(--accent-emerald)">${summary.itemsSaved}</div>
            </div>
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Beute verloren</div>
              <div class="val" style="color:${summary.itemsLost > 0 ? 'var(--accent-coral)' : 'var(--text-muted)'}">${summary.itemsLost}</div>
            </div>
          </div>
          ${
            extraNotes.length > 0
              ? `<div class="modifier-box" style="display:flex;flex-direction:column;gap:5px">${extraNotes.map((n) => `<div>${n}</div>`).join('')}</div>`
              : ''
          }
          <button id="btn-summary-ok" class="btn btn-primary" style="width:100%">Weiter im Raumhafen</button>
        </div>
      </div>
    `);

    this.modalEl.querySelector('#btn-summary-ok')?.addEventListener('click', () => {
      sound.playUiClick();
      this.closeModal();
    });
  }

  // ==================== NYX' SCHWARZMARKT (TÄGLICHE SCHMUGGLER-WARE) ====================
  public openBlackMarketModal(): void {
    const art = getHDArt();
    if (!this.state.nyxStock || this.state.nyxStock.length === 0) {
      this.state.nyxStock = this.state.generateNyxStock();
    }

    const hasRixDiscount = Boolean(this.state.patronProgress?.rix?.bigOrderCompleted);
    const cardsHtml = this.state.nyxStock
      .map((offer) => {
        const def = getItemDef(offer.itemId);
        const rarity = RARITY_META[def.rarity];
        const soldOut = offer.stock <= 0;
        const effectivePrice = this.state.getNyxOfferPrice(offer);
        const canBuy = !soldOut && this.state.credits >= effectivePrice;
        const owned = countItemTotal(this.state.inventory, offer.itemId);
        const pinNeed = this.state.getPinnedItemNeed(offer.itemId);
        return `
          <div class="upgrade-card" style="border-color:${soldOut ? 'var(--border-steel)' : pinNeed && pinNeed.stillNeeded > 0 ? '#fbbf24' : rarity.border};${soldOut ? 'opacity:0.55' : ''}">
            <div class="upgrade-left">
              <div class="inspector-icon-wrap" style="border-color:${rarity.border}">
                <img class="pixel-icon" src="${art.itemUrls[offer.itemId]}" alt="${def.name}" />
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <strong style="font-family:var(--font-pixel);font-size:11px;color:${rarity.color}">${def.name}</strong>
                  <span class="rarity-badge" style="color:${rarity.color};background:${rarity.bg};border-color:${rarity.border}">${rarity.label}</span>
                  ${
                    pinNeed
                      ? `<span class="pin-wanted-pill" title="Angepinnt für: ${pinNeed.recipeTitles.join(', ')}">📌 GESUCHT (${pinNeed.owned}/${pinNeed.required})</span>`
                      : ''
                  }
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${def.description}</div>
                <div class="mat-list">
                  <span class="mat-pill ${this.state.credits >= effectivePrice ? 'ok' : 'missing'}">${effectivePrice} Cr${hasRixDiscount ? ' (-15 % Rix)' : ''}</span>
                  <span class="mat-pill" style="color:var(--text-muted)">Vorrat: ${offer.stock}</span>
                  <span class="mat-pill" style="color:var(--accent-cyan)">Im Besitz: ${owned}</span>
                </div>
              </div>
            </div>
            <button class="btn btn-amber btn-nyx-buy" data-oid="${offer.id}" ${canBuy ? '' : 'disabled'}>
              ${soldOut ? 'Ausverkauft' : 'Kaufen'}
            </button>
          </div>
        `;
      })
      .join('');

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title" style="color:#c084fc">NYX' SCHWARZMARKT · TAG ${this.state.day}</span>
          <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${this.state.credits} CR</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="npc-banner" style="border-color:rgba(192,132,252,0.45)">
            <img src="/art/sprites/npc_nyx.png" alt="Nyx" style="width:46px;height:52px;image-rendering:pixelated" />
            <div>
              <div style="font-family:var(--font-pixel);font-size:11px;color:#e879f9">SCHWARZMARKT-HÄNDLERIN NYX</div>
              <p style="font-size:12px;color:var(--text-muted);margin-top:3px">
                „Psst… dir fehlt noch ein seltenes Schmiede- oder Modul-Teil? Mein Lager wechselt jeden Morgen — kein Nachfragen, woher es stammt.“
              </p>
            </div>
          </div>
          <div class="upgrade-list">${cardsHtml}</div>
        </div>
      </div>
    `);

    this.modalEl.querySelectorAll<HTMLElement>('.btn-nyx-buy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const oid = btn.dataset.oid!;
        const res = this.state.buyFromNyx(oid);
        if (res.ok) {
          sound.playRegister();
          this.toast(`Bei Nyx gekauft: 1× ${res.itemName}!`, 'good');
          this.openBlackMarketModal();
          this.renderHud();
        } else {
          sound.playReaction('expensive');
          this.toast(res.reason ?? 'Kauf fehlgeschlagen!', 'warn');
        }
      });
    });
  }

  // ==================== DROHNEN-DOCKSTATION (FREISCHALTBARE BEGLEITER-BOTS) ====================
  public openCompanionDockModal(): void {
    this.state.checkCompanionUnlocks();
    const snap = this.state.getCompanionProgressSnapshot();
    const unlockedCount = COMPANION_ORDER.filter((id) => this.state.unlockedCompanions[id]).length;

    const cardsHtml = COMPANION_ORDER.map((id) => {
      const def = COMPANION_DEFS[id];
      const unlocked = this.state.unlockedCompanions[id];
      const active = this.state.equippedCompanion === id;
      const evalInfo = evaluateCompanionUnlock(id, snap);
      const pct = Math.round(evalInfo.ratio * 100);

      return `
        <div class="upgrade-card" style="border-color:${active ? def.accentColor : unlocked ? 'rgba(56,232,212,0.4)' : 'var(--border-steel)'};${unlocked ? '' : 'opacity:0.84'}">
          <div class="upgrade-left">
            <div class="inspector-icon-wrap" style="border-color:${unlocked ? def.accentColor : 'var(--border-steel)'};${unlocked ? '' : 'filter:grayscale(0.9) brightness(0.65)'}">
              <img class="pixel-icon" src="${def.iconUrl}" alt="${def.name}" />
            </div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <strong style="font-family:var(--font-pixel);font-size:11px;color:${unlocked ? def.accentColor : '#94a3b8'}">${def.name}</strong>
                <span class="rarity-badge" style="color:${unlocked ? '#4ade80' : '#94a3b8'};border-color:${unlocked ? '#4ade80' : '#475569'}">
                  ${active ? '★ AKTIV' : unlocked ? def.role : '🔒 GESPERRT'}
                </span>
              </div>
              <div style="font-size:12px;color:var(--text-main);margin-top:3px">${def.abilitySummary}</div>
              ${
                unlocked
                  ? `<div style="font-size:11px;color:var(--accent-emerald);margin-top:3px">✓ Freigeschaltet — begleitet dich auf jeder Expedition in Sektor 1!</div>`
                  : `<div style="font-size:11px;color:var(--accent-amber);margin-top:4px">Bedingung: ${def.unlockRequirement}</div>
                     <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                       <div style="flex:1;height:6px;background:#0f172a;border:1px solid #334155">
                         <div style="height:100%;width:${pct}%;background:${def.accentColor}"></div>
                       </div>
                       <span style="font-family:var(--font-pixel);font-size:9px;color:var(--text-muted)">${evalInfo.progressText}</span>
                     </div>`
              }
            </div>
          </div>
          ${
            unlocked
              ? `<button class="btn ${active ? '' : 'btn-primary'} btn-equip-companion" data-cid="${id}">
                  ${active ? 'Ablegen' : 'Ausrüsten'}
                </button>`
              : `<button class="btn" disabled>Gesperrt</button>`
          }
        </div>
      `;
    }).join('');

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title" style="color:#38bdf8">DROHNEN-DOCKSTATION (${unlockedCount}/4)</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="npc-banner" style="border-color:rgba(56,189,248,0.45)">
            <img src="/art/sprites/prop_bot_dock.png" alt="Drohnen-Dock" style="width:46px;height:44px;image-rendering:pixelated" />
            <div>
              <div style="font-family:var(--font-pixel);font-size:11px;color:#38bdf8">AUTONOME BEGLEITER-BOTS (FAMILIARS)</div>
              <p style="font-size:12px;color:var(--text-muted);margin-top:3px">
                Schalte bis zu 4 einzigartige Helfer-Drohnen durch Handels- &amp; Kampf-Meilensteine frei. Du kannst immer 1 Begleiter aktiv mit in den Sektor nehmen!
              </p>
            </div>
          </div>
          <div class="upgrade-list">${cardsHtml}</div>
        </div>
      </div>
    `);

    this.modalEl.querySelectorAll<HTMLElement>('.btn-equip-companion').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.dataset.cid as CompanionId;
        const next: CompanionId | null = this.state.equippedCompanion === cid ? null : cid;
        this.state.equipCompanion(next);
        sound.playWeaponSwap();
        this.toast(
          next ? `${COMPANION_DEFS[next].name} aktiviert & folgt dir in Sektor 1!` : 'Begleiter-Bot im Dock geparkt.',
          'good',
        );
        this.openCompanionDockModal();
        this.renderHud();
      });
    });
  }

  // ==================== STERNEN-JUKEBOX (RETRO-SYNTH SOUNDTRACK) ====================
  public openJukeboxModal(): void {
    const override = sound.getJukeboxOverride();
    const activeTrack = sound.getActiveMusicTrack();
    const musicMuted = sound.isMusicMuted() || sound.isMuted();
    const trackIds: MusicTrack[] = ['shop_day', 'shop_night', 'hub', 'dungeon', 'dungeon_s2', 'dungeon_s3', 'dungeon_s4', 'boss'];

    const rowsHtml = trackIds
      .map((tid) => {
        const meta = MUSIC_TRACK_META[tid];
        const isLockedHere = override === tid;
        const isPlayingNow = !musicMuted && activeTrack === tid;
        return `
          <div class="upgrade-card" style="border-color:${isLockedHere ? meta.accent : 'var(--border-steel)'}">
            <div class="upgrade-left">
              <div class="inspector-icon-wrap" style="border-color:${meta.accent};color:${meta.accent};font-family:var(--font-pixel);font-size:15px">
                ${isPlayingNow ? '♫' : '♪'}
              </div>
              <div>
                <div style="font-family:var(--font-pixel);font-size:11px;color:${meta.accent}">
                  ${meta.title} ${isPlayingNow ? '<span style="color:#4ade80;font-size:9px">● LÄUFT</span>' : ''}
                </div>
                <div style="font-size:12px;color:var(--text-muted)">${meta.subtitle}</div>
              </div>
            </div>
            <button class="btn ${isLockedHere ? 'btn-amber' : 'btn-primary'} btn-juke-track" data-tid="${tid}">
              ${isLockedHere ? '✓ Gewählt' : 'Abspielen'}
            </button>
          </div>
        `;
      })
      .join('');

    this.showModalHtml(`
      <div class="modal-window" style="max-width:600px">
        <div class="modal-header">
          <span class="modal-title" style="color:#e879f9">♪ STERNEN-JUKEBOX</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="npc-banner" style="border-color:rgba(232,121,249,0.45)">
            <img src="/art/sprites/prop_jukebox.png" alt="Jukebox" style="width:42px;height:50px;image-rendering:pixelated" />
            <div style="flex:1">
              <div style="font-family:var(--font-pixel);font-size:11px;color:#f0abfc">RETRO-SYNTH SOUNDTRACK</div>
              <p style="font-size:12px;color:var(--text-muted);margin-top:3px">
                Wähle „Automatik“ für dynamische Zonen-Musik (Tag, Nacht, Promenade, Sektor &amp; Boss) oder fixiere deinen Lieblings-Track!
              </p>
              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                <button id="btn-juke-auto" class="btn ${override === null ? 'btn-amber' : ''}">
                  ${override === null ? '✓ Automatik (Zonen-Musik)' : 'Zurück auf Automatik'}
                </button>
                <button id="btn-juke-mute" class="btn">
                  ${musicMuted ? '♪ Musik einschalten' : '♪ Musik stummschalten'}
                </button>
              </div>
            </div>
          </div>
          <div class="upgrade-list">${rowsHtml}</div>
        </div>
      </div>
    `);

    this.modalEl.querySelector('#btn-juke-auto')?.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      sound.setJukeboxTrack(null);
      this.toast('Jukebox auf dynamische Zonen-Musik gestellt.', 'info');
      this.openJukeboxModal();
    });

    this.modalEl.querySelector('#btn-juke-mute')?.addEventListener('click', () => {
      sound.unlock();
      this.hooks.onMusicToggle();
      this.openJukeboxModal();
    });

    this.modalEl.querySelectorAll<HTMLElement>('.btn-juke-track').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid as MusicTrack;
        sound.unlock();
        if (sound.isMusicMuted()) {
          this.hooks.onMusicToggle();
        }
        sound.setJukeboxTrack(tid);
        sound.playUiClick();
        this.toast(`♫ Jukebox spielt jetzt: ${MUSIC_TRACK_META[tid].title}`, 'good');
        this.openJukeboxModal();
      });
    });
  }

  // ==================== INTERAKTIVE DUNGEON-RELIKT-TRUHE (MOONLIGHTER-STYLE) ====================
  private activeDungeonChest: RoomChest | null = null;
  private chestSelected: { side: 'loot' | 'cargo'; index: number } | null = null;

  public openDungeonChestModal(chest: RoomChest): void {
    if (!chest.slots) {
      chest.slots = new Array(8).fill(null);
    }
    this.activeDungeonChest = chest;
    // Auto-select first available item in the loot chest so details are immediately visible!
    const firstIdx = chest.slots.findIndex((s) => s !== null);
    this.chestSelected = firstIdx >= 0 ? { side: 'loot', index: firstIdx } : null;
    this.renderDungeonChestModal();
  }

  private renderDungeonChestModal(): void {
    const chest = this.activeDungeonChest;
    if (!chest || !chest.slots) return;
    const lootSlots = chest.slots;
    const cargoSlots = this.state.inventory.cargo;
    const art = getHDArt();

    const renderSlot = (side: 'loot' | 'cargo', index: number, stack: ItemStack | null): string => {
      const isSelected = this.chestSelected?.side === side && this.chestSelected?.index === index;
      let inner = '';
      let title = 'Leerer Slot';
      if (stack) {
        const def = getItemDef(stack.itemId);
        let modBadge = '';
        if (def.modifier === 'warp_anchor') {
          modBadge = `<span class="slot-mod-badge" style="background:#34d399" title="Warp-Anker (→)">→</span>`;
        } else if (def.modifier === 'mirror_clone') {
          modBadge = `<span class="slot-mod-badge" style="background:#38e8d4" title="Klon-Matrix (↑)">↑</span>`;
        } else if (def.modifier === 'row_curse') {
          const unsafe = side === 'cargo' && index >= 5;
          modBadge = `<span class="slot-mod-badge" style="background:${unsafe ? '#fb7185' : '#c084fc'}" title="Phasen-Fluch (▲)">▲</span>`;
        } else if (def.modifier === 'volatile_boost') {
          modBadge = `<span class="slot-mod-badge" style="background:#fbbf24" title="Resonanz (←)">←</span>`;
        } else if (def.modifier === 'fragile') {
          modBadge = `<span class="slot-mod-dot" style="background:#fb7185" title="Zerbrechlich"></span>`;
        }
        const pinNeed = this.state.getPinnedItemNeed(stack.itemId);
        const pinBadge = pinNeed
          ? `<span class="slot-pin-badge" title="Merkliste (${pinNeed.owned}/${pinNeed.required})">📌</span>`
          : '';
        inner = `
          ${pinBadge}
          ${modBadge}
          <img class="pixel-icon" src="${art.itemUrls[stack.itemId]}" alt="${def.name}" />
          <span class="slot-qty">${stack.qty}</span>
        `;
        title = `${def.name} (x${stack.qty})${pinNeed ? ` · 📌 Gebraucht (${pinNeed.owned}/${pinNeed.required})` : ''}`;
      }
      return `
        <button class="inv-slot ${side === 'loot' ? 'safe' : ''} ${isSelected ? 'selected' : ''}"
          data-side="${side}" data-index="${index}" title="${title}">
          ${inner}
        </button>
      `;
    };

    const selStack = this.chestSelected
      ? this.chestSelected.side === 'loot'
        ? lootSlots[this.chestSelected.index]
        : cargoSlots[this.chestSelected.index]
      : null;
    const selDef = selStack ? getItemDef(selStack.itemId) : null;
    const selRarity = selDef ? RARITY_META[selDef.rarity] : null;
    const selEntry = selDef ? this.state.codex[selDef.id] : null;
    const selPin = selDef ? this.state.getPinnedItemNeed(selDef.id) : null;
    const lootRemaining = lootSlots.reduce((acc, s) => acc + (s ? s.qty : 0), 0);

    const inspectorHtml =
      selDef && selStack && selRarity && selEntry
        ? `
        <div class="inspector-box" style="margin-top:10px">
          <div class="inspector-head">
            <div class="inspector-icon-wrap" style="border-color:${selRarity.border}">
              <img class="pixel-icon" src="${art.itemUrls[selDef.id]}" alt="${selDef.name}" />
            </div>
            <div>
              <div style="font-family:var(--font-pixel);font-size:11.5px;color:#fff">${selDef.name}</div>
              <span class="rarity-badge" style="color:${selRarity.color};background:${selRarity.bg};border-color:${selRarity.border}">
                ${selRarity.label}
              </span>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text-muted);line-height:1.4">${selDef.description}</p>
          ${
            selPin
              ? `<div class="modifier-box" style="border-left-color:#fbbf24;color:#fde047">
                   📌 <strong>Merkliste (${selPin.owned}/${selPin.required}):</strong> Gebraucht für ${selPin.recipeTitles.join(', ')}
                 </div>`
              : ''
          }
          ${selDef.modifierLabel ? `<div class="modifier-box">⚡ ${selDef.modifierLabel}</div>` : ''}
          <div style="font-size:11px;color:var(--text-muted)">
            ${
              selEntry.maxFairPrice !== null
                ? `Bekannter Fair-Preis: <strong style="color:var(--accent-emerald)">${selEntry.minFairPrice}–${selEntry.maxFairPrice} Cr</strong>`
                : 'Marktwert noch unbekannt — im Shop testen!'
            }
          </div>
          <button id="btn-chest-quick-move" class="btn ${this.chestSelected?.side === 'loot' ? 'btn-amber' : ''}" style="width:100%;margin-top:4px">
            ${this.chestSelected?.side === 'loot' ? '→ In Rucksack nehmen' : '← In Truhe zurücklassen'}
          </button>
        </div>
      `
        : `
        <div class="inspector-box" style="margin-top:10px;text-align:center;color:var(--text-muted);font-size:12px">
          Klicke auf einen Slot, um Relikte gezielt mitzunehmen, gegen Schrott aus dem Rucksack zu tauschen oder zurückzulassen!
        </div>
      `;

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title" style="color:var(--accent-amber)">RELIKT-TRUHE · BEUTE WÄHLEN</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="inv-layout">
            <div>
              <div class="section-label">
                <span>SCHATZTRUHE (${lootRemaining} ITEMS)</span>
                <span style="color:var(--accent-amber)">Bleibt im Raum liegen</span>
              </div>
              <div class="slot-grid" style="grid-template-columns:repeat(4,1fr)">
                ${lootSlots.map((s, i) => renderSlot('loot', i, s)).join('')}
              </div>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button id="btn-chest-take-all" class="btn btn-primary" style="flex:1" ${lootRemaining > 0 ? '' : 'disabled'}>
                  Alles mitnehmen
                </button>
                <button id="btn-chest-done" class="btn">Fertig</button>
              </div>
              ${inspectorHtml}
            </div>
            <div>
              <div class="section-label">
                <span>EXPEDITIONS-RUCKSACK (${countBackpackItems(this.state.inventory)} Items)</span>
                <span style="color:var(--accent-coral)">Klick zum Tauschen</span>
              </div>
              <div class="slot-grid">
                ${cargoSlots.map((s, i) => renderSlot('cargo', i, s)).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    const swapChestSlots = (
      fromSide: 'loot' | 'cargo',
      fromIdx: number,
      toSide: 'loot' | 'cargo',
      toIdx: number,
    ): void => {
      const srcArr = fromSide === 'loot' ? lootSlots : cargoSlots;
      const dstArr = toSide === 'loot' ? lootSlots : cargoSlots;
      const src = srcArr[fromIdx];
      const dst = dstArr[toIdx];
      if (!src) return;
      if (dst && dst.itemId === src.itemId) {
        const maxStack = getItemDef(src.itemId).maxStack;
        const space = maxStack - dst.qty;
        if (space > 0) {
          const move = Math.min(space, src.qty);
          dst.qty += move;
          src.qty -= move;
          if (src.qty <= 0) srcArr[fromIdx] = null;
          return;
        }
      }
      dstArr[toIdx] = src;
      srcArr[fromIdx] = dst;
    };

    this.modalEl.querySelectorAll<HTMLElement>('.inv-slot').forEach((el) => {
      el.addEventListener('click', () => {
        const side = el.dataset.side as 'loot' | 'cargo';
        const index = Number(el.dataset.index);
        const arr = side === 'loot' ? lootSlots : cargoSlots;
        if (!this.chestSelected) {
          if (arr[index]) {
            this.chestSelected = { side, index };
            sound.playUiClick();
            this.renderDungeonChestModal();
          }
        } else if (this.chestSelected.side === side && this.chestSelected.index === index) {
          this.chestSelected = null;
          sound.playUiClick();
          this.renderDungeonChestModal();
        } else {
          swapChestSlots(this.chestSelected.side, this.chestSelected.index, side, index);
          this.chestSelected = null;
          sound.playPickup();
          this.state.save();
          this.renderHud();
          this.renderDungeonChestModal();
        }
      });
    });

    this.modalEl.querySelector('#btn-chest-quick-move')?.addEventListener('click', () => {
      if (!this.chestSelected) return;
      const { side, index } = this.chestSelected;
      if (side === 'loot') {
        const stack = lootSlots[index];
        if (!stack) return;
        const rem = addItemToBackpack(this.state.inventory, stack.itemId, stack.qty);
        if (rem < stack.qty) {
          sound.playPickup();
          if (rem === 0) lootSlots[index] = null;
          else stack.qty = rem;
          this.chestSelected = null;
          this.state.save();
          this.renderHud();
          this.renderDungeonChestModal();
        } else {
          sound.playReaction('expensive');
          this.toast('Rucksack ist voll! Klicke auf ein Rucksack-Item, um es in der Truhe zu tauschen.', 'warn');
        }
      } else {
        const stack = cargoSlots[index];
        if (!stack) return;
        let rem = stack.qty;
        const maxStack = getItemDef(stack.itemId).maxStack;
        for (const s of lootSlots) {
          if (s && s.itemId === stack.itemId && s.qty < maxStack && rem > 0) {
            const take = Math.min(maxStack - s.qty, rem);
            s.qty += take;
            rem -= take;
          }
        }
        for (let i = 0; i < lootSlots.length && rem > 0; i++) {
          if (!lootSlots[i]) {
            const take = Math.min(maxStack, rem);
            lootSlots[i] = { itemId: stack.itemId, qty: take };
            rem -= take;
          }
        }
        if (rem < stack.qty) {
          sound.playUiClick();
          if (rem === 0) cargoSlots[index] = null;
          else stack.qty = rem;
          this.chestSelected = null;
          this.state.save();
          this.renderHud();
          this.renderDungeonChestModal();
        } else {
          sound.playReaction('expensive');
          this.toast('Truhe ist voll!', 'warn');
        }
      }
    });

    this.modalEl.querySelector('#btn-chest-take-all')?.addEventListener('click', () => {
      let moved = 0;
      let full = false;
      for (let i = 0; i < lootSlots.length; i++) {
        const s = lootSlots[i];
        if (!s) continue;
        const rem = addItemToBackpack(this.state.inventory, s.itemId, s.qty);
        moved += s.qty - rem;
        if (rem === 0) {
          lootSlots[i] = null;
        } else {
          s.qty = rem;
          full = true;
        }
      }
      if (moved > 0) {
        sound.playPickup();
        this.state.save();
        this.renderHud();
      }
      if (full) {
        this.toast('Rucksack voll — übrige Relikte bleiben sicher in der Truhe (zum Tauschen anklicken!).', 'warn');
        this.renderDungeonChestModal();
      } else {
        this.toast(`Alle ${moved} Relikte aus der Truhe mitgenommen!`, 'good');
        this.closeModal();
      }
    });

    this.modalEl.querySelector('#btn-chest-done')?.addEventListener('click', () => {
      sound.playUiClick();
      this.closeModal();
    });
  }

  // ==================== GALAKTISCHE KAPITÄNS-TAFEL (FIREBASE SCOREBOARD, REKORDE & CLOUD-SYNC) ====================
  /** M10-C: Merkliste außerhalb des Dungeons standardmäßig eingeklappt (nur pro Gerät, localStorage). */
  private readPinCollapsed(): boolean {
    try {
      return localStorage.getItem('starlighter_pin_collapsed') !== '0';
    } catch {
      return true;
    }
  }

  private writePinCollapsed(collapsed: boolean): void {
    try {
      localStorage.setItem('starlighter_pin_collapsed', collapsed ? '1' : '0');
    } catch {
      /* ohne Speicher weiter */
    }
  }

  private modalCloseHook: (() => void) | null = null;
  private activeStory: StoryDialogController | null = null;
  private guildTab: GuildTab = 'leaderboard';
  private guildSelectedUid: string | null = null;
  private guildSort: 'progress' | 'speed_sector' | 'speed_days' | 'merchant' | 'deepest_rift' = 'progress';
  private guildSectorFilter: SectorId = 1;
  private guildLeaderboardCache: LeaderboardEntry[] = [];
  private guildFeedCache: ActivityFeedEntry[] = [];
  private guildTrialCache: WeeklyTrialEntry[] = [];
  private guildLoading = false;
  private guildAuthMode: 'login' | 'register' = 'login';
  private guildModalActive = false;

  public openGuildBoardModal(tab: GuildTab = 'leaderboard'): void {
    this.guildTab = tab;
    this.guildSelectedUid = null;
    this.guildModalActive = true;
    this.renderGuildBoardModal();
    if (firebaseService.isConfigured()) {
      void this.refreshGuildBoardData();
    }
  }

  public refreshGuildBoardIfOpen(): void {
    if (!this.modalOpen || !this.guildModalActive) return;
    if (firebaseService.isConfigured()) {
      void this.refreshGuildBoardData();
    } else {
      this.renderGuildBoardModal();
    }
  }

  private async refreshGuildBoardData(): Promise<void> {
    this.guildLoading = true;
    if (this.modalOpen && this.guildModalActive) {
      this.renderGuildBoardModal();
    }
    const [board, feed, trialRows] = await Promise.all([
      firebaseService.fetchLeaderboard(30),
      firebaseService.fetchRecentActivities(18),
      galacticNetwork.fetchWeeklyTrialBoard(getCurrentWeeklyTrial().weekId, true),
    ]);
    this.guildLeaderboardCache = board;
    this.guildFeedCache = feed;
    this.guildTrialCache = trialRows;
    this.guildLoading = false;
    if (this.modalOpen && this.guildModalActive) {
      this.renderGuildBoardModal();
    }
  }

  private renderGuildBoardModal(): void {
    const configured = firebaseService.isConfigured();
    const user = firebaseService.currentUser;
    const localUid = user?.uid ?? 'local_captain';
    const localName = this.state.captainName || user?.displayName || 'Sternen-Kapitän';
    const ownEntry = firebaseService.buildLeaderboardEntry(this.state, localUid, localName);

    // Merge remote entries with always-current local captain entry
    const byUid = new Map<string, LeaderboardEntry>();
    for (const row of this.guildLeaderboardCache) {
      byUid.set(row.uid, row);
    }
    byUid.set(ownEntry.uid, ownEntry);
    const allRows = [...byUid.values()];

    const sortRows = (rows: LeaderboardEntry[]): LeaderboardEntry[] => {
      const copy = [...rows];
      if (this.guildSort === 'speed_sector') {
        const sec = this.guildSectorFilter;
        return copy.sort((a, b) => {
          const ta = a.bestSectorClearSec?.[sec] ?? Number.POSITIVE_INFINITY;
          const tb = b.bestSectorClearSec?.[sec] ?? Number.POSITIVE_INFINITY;
          if (ta !== tb) return ta - tb;
          return b.sectorsCleared - a.sectorsCleared;
        });
      }
      if (this.guildSort === 'speed_days') {
        return copy.sort((a, b) => {
          const da = a.fastestOmegaDays ?? a.fastestSector4Days ?? Number.POSITIVE_INFINITY;
          const db = b.fastestOmegaDays ?? b.fastestSector4Days ?? Number.POSITIVE_INFINITY;
          if (da !== db) return da - db;
          return (b.omegaCleared ? 1 : 0) - (a.omegaCleared ? 1 : 0);
        });
      }
      if (this.guildSort === 'merchant') {
        return copy.sort((a, b) => b.totalEarned - a.totalEarned || b.totalSold - a.totalSold);
      }
      if (this.guildSort === 'deepest_rift') {
        return copy.sort(
          (a, b) =>
            (b.deepestRiftFloor ?? 0) - (a.deepestRiftFloor ?? 0) ||
            b.ngPlusLevel - a.ngPlusLevel ||
            b.bossDefeatedCount - a.bossDefeatedCount,
        );
      }
      // Default: Progress & NG+
      return copy.sort((a, b) => {
        const score = (e: LeaderboardEntry) =>
          e.ngPlusLevel * 10000 +
          (e.omegaCleared ? 4000 : 0) +
          (e.deepestRiftFloor ?? 0) * 180 +
          e.sectorsCleared * 500 +
          e.achievementsCount * 40 +
          Math.min(500, Math.floor(e.totalEarned / 100));
        return score(b) - score(a);
      });
    };

    const statusPill = !configured
      ? `<span style="font-family:var(--font-pixel);font-size:8.5px;color:#fbbf24;border:1px solid rgba(251,191,36,0.45);padding:2px 6px">LOKAL-MODUS</span>`
      : user
        ? `<span style="font-family:var(--font-pixel);font-size:8.5px;color:#4ade80;border:1px solid rgba(74,222,128,0.45);padding:2px 6px">☁ ${escapeHtml(user.displayName)}</span>`
        : `<span style="font-family:var(--font-pixel);font-size:8.5px;color:#94a3b8;border:1px solid rgba(148,163,184,0.45);padding:2px 6px">GAST (NICHT ANGEMELDET)</span>`;

    let bodyHtml = '';

    if (this.guildTab === 'leaderboard') {
      const sorted = sortRows(allRows);
      const secFilterBar =
        this.guildSort === 'speed_sector'
          ? `
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
              ${([1, 2, 3, 4, 5] as SectorId[])
                .map(
                  (sid) => `
                  <button class="btn ${this.guildSectorFilter === sid ? 'btn-amber' : ''}" data-gsec="${sid}" style="padding:3px 7px;font-size:9px">
                    ${sid === 5 ? '🌌 5. Tor (Omega)' : `Sektor ${sid}`}
                  </button>
                `,
                )
                .join('')}
            </div>
          `
          : '';

      const rowsHtml = sorted
        .map((r, idx) => {
          const isMe = r.uid === localUid;
          const suit = SUIT_THEMES[r.suitTheme] ?? SUIT_THEMES.classic;
          const wep = WEAPON_META[r.equippedWeapon] ?? WEAPON_META.blade;
          const infDef = r.activeInfusion ? getInfusionDef(r.activeInfusion) : null;
          const rankColor = idx === 0 ? '#fde047' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#fb923c' : '#64748b';
          const metricHtml =
            this.guildSort === 'speed_sector'
              ? `<div style="text-align:right">
                   <div style="font-family:var(--font-pixel);font-size:11px;color:#38e8d4">⏱ ${formatDurationSec(r.bestSectorClearSec?.[this.guildSectorFilter])}</div>
                   <div style="font-size:10px;color:var(--text-muted)">${this.guildSectorFilter === 5 ? 'Omega-Clear' : `Sektor-${this.guildSectorFilter}-Bestzeit`}</div>
                 </div>`
              : this.guildSort === 'speed_days'
                ? `<div style="text-align:right">
                     <div style="font-family:var(--font-pixel);font-size:11px;color:#fde047">${
                       r.fastestOmegaDays !== null
                         ? `Tag ${r.fastestOmegaDays} (Omega)`
                         : r.fastestSector4Days !== null
                           ? `Tag ${r.fastestSector4Days} (S4)`
                           : `Tag ${r.day} (aktiv)`
                     }</div>
                     <div style="font-size:10px;color:var(--text-muted)">${
                       r.fastestNgPlusDays !== null ? `NG+ Rekord: Tag ${r.fastestNgPlusDays}` : `${r.totalCyclesPlayed} Tag/Nacht-Zyklen`
                     }</div>
                   </div>`
                : this.guildSort === 'merchant'
                  ? `<div style="text-align:right">
                       <div style="font-family:var(--font-pixel);font-size:11px;color:#fbbf24">${r.totalEarned.toLocaleString('de-DE')} Cr</div>
                       <div style="font-size:10px;color:var(--text-muted)">${r.totalSold} Relikte · Shop St. ${r.shopTier + 1}</div>
                     </div>`
                  : this.guildSort === 'deepest_rift'
                    ? `<div style="text-align:right">
                         <div style="font-family:var(--font-pixel);font-size:11px;color:#e879f9">${(r.deepestRiftFloor ?? 0) > 0 ? `🌀 ∞ EBENE ${r.deepestRiftFloor}` : '—'}</div>
                         <div style="font-size:10px;color:var(--text-muted)">${infDef ? `${infDef.icon} ${infDef.name}` : 'Unendliche Spirale'}</div>
                       </div>`
                    : `<div style="text-align:right">
                         <div style="font-family:var(--font-pixel);font-size:10.5px;color:${r.omegaCleared ? '#fde047' : '#38e8d4'}">
                           ${r.ngPlusLevel > 0 ? `NG+${r.ngPlusLevel} · ` : ''}${r.omegaCleared ? '🌌 OMEGA ★' : `${r.sectorsCleared}/4 Sektoren`}
                         </div>
                         <div style="font-size:10px;color:var(--text-muted)">${r.achievementsCount}/${ACHIEVEMENT_DEFS.length} Erfolge · ${(r.deepestRiftFloor ?? 0) > 0 ? `∞ E${r.deepestRiftFloor}` : `Tag ${r.day}`}</div>
                       </div>`;

          return `
            <div class="m9-lb-row" data-lb-uid="${escapeHtml(r.uid)}" role="button" tabindex="0" title="Kapitäns-Akte öffnen" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid ${isMe ? 'rgba(56,232,212,0.7)' : 'var(--border-steel)'};background:${isMe ? 'rgba(56,232,212,0.1)' : 'rgba(13,20,34,0.72)'}">
              <div style="font-family:var(--font-pixel);font-size:12px;width:24px;text-align:center;color:${rankColor}">#${idx + 1}</div>
              <span style="width:11px;height:11px;border-radius:50%;background:${suit.accent};box-shadow:0 0 8px ${suit.auraColor};flex-shrink:0" title="Anzug: ${suit.name}"></span>
              <img src="${wep.iconUrl}" alt="${wep.shortName}" style="width:20px;height:20px;image-rendering:pixelated;flex-shrink:0" title="Waffe: ${wep.name}" />
              ${infDef ? `<span style="font-size:12px;flex-shrink:0" title="Prägung: ${infDef.name}">${infDef.icon}</span>` : ''}
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <strong style="font-family:var(--font-pixel);font-size:10.5px;color:${isMe ? '#38e8d4' : '#f8fafc'}">${escapeHtml(r.captainName)}</strong>
                  ${isMe ? '<span style="font-family:var(--font-pixel);font-size:8px;background:rgba(56,232,212,0.2);color:#38e8d4;padding:1px 4px">DU</span>' : ''}
                </div>
                <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.lastActivityText)}</div>
              </div>
              ${metricHtml}
            </div>
          `;
        })
        .join('');

      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="npc-banner" style="border-color:rgba(253,224,71,0.42)">
            <img src="/art/sprites/prop_scoreboard.png" alt="Kapitäns-Tafel" style="width:48px;height:48px;image-rendering:pixelated" />
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                <strong style="font-family:var(--font-pixel);font-size:11px;color:#fde047">GALAKTISCHE KAPITÄNS-TAFEL</strong>
                ${statusPill}
              </div>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:3px">
                Vergleiche Fortschritt, ∞ Rift-Tiefe, NG+-Speedruns in Tagen, schnellste Sektor-Clears (mm:ss) &amp; Händler-Umsätze!
              </div>
            </div>
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <button class="btn ${this.guildSort === 'progress' ? 'btn-primary' : ''}" data-gsort="progress" style="padding:4px 7px;font-size:9px">★ Fortschritt</button>
              <button class="btn ${this.guildSort === 'deepest_rift' ? 'btn-primary' : ''}" data-gsort="deepest_rift" style="padding:4px 7px;font-size:9px">🌀 Tiefster Rift</button>
              <button class="btn ${this.guildSort === 'speed_sector' ? 'btn-primary' : ''}" data-gsort="speed_sector" style="padding:4px 7px;font-size:9px">⏱ Sektor-Zeit</button>
              <button class="btn ${this.guildSort === 'speed_days' ? 'btn-primary' : ''}" data-gsort="speed_days" style="padding:4px 7px;font-size:9px">☀ Tage</button>
              <button class="btn ${this.guildSort === 'merchant' ? 'btn-primary' : ''}" data-gsort="merchant" style="padding:4px 7px;font-size:9px">💰 Händler</button>
            </div>
            ${configured ? `<button id="btn-guild-refresh" class="btn" style="padding:4px 8px;font-size:9.5px">${this.guildLoading ? 'Lädt…' : '↻ Aktualisieren'}</button>` : ''}
          </div>
          ${secFilterBar}

          <div style="display:flex;flex-direction:column;gap:6px;max-height:290px;overflow-y:auto">
            ${rowsHtml}
          </div>
          ${
            !configured
              ? `<div style="font-size:11px;color:var(--text-muted);padding:6px 8px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3)">
                   💡 <strong>Firebase-Verknüpfung bereit:</strong> Öffne den Tab <strong>„Konto &amp; Cloud“</strong>, um deine Firebase-Keys (Vercel) zu verbinden — danach erscheinen hier automatisch alle angemeldeten Kapitäne!
                 </div>`
              : !user
                ? `<div style="font-size:11px;color:var(--text-muted);padding:6px 8px;background:rgba(56,232,212,0.08);border:1px solid rgba(56,232,212,0.3)">
                     ☁ Melde dich im Tab <strong>„Konto &amp; Cloud“</strong> an, um deine Bestzeiten automatisch zu teilen &amp; deinen Spielstand zwischen Handy &amp; PC zu synchronisieren!
                   </div>`
                : ''
          }
        </div>
      `;
    } else if (this.guildTab === 'file') {
      const sel = allRows.find((r) => r.uid === this.guildSelectedUid) ?? ownEntry;
      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <button id="btn-file-back" class="btn" style="padding:4px 9px;font-size:9.5px;white-space:nowrap">← Zurück zur Tafel</button>
            <span style="font-family:var(--font-pixel);font-size:10.5px;color:#fde047;white-space:nowrap">📁 KAPITÄNS-AKTE</span>
          </div>
          <div style="max-height:370px;overflow-y:auto">${renderCaptainFileHtml(sel, sel.uid === localUid)}</div>
        </div>
      `;
    } else if (this.guildTab === 'trial') {
      const trialInfo = getCurrentWeeklyTrial();
      const byUid = new Map<string, WeeklyTrialEntry>();
      for (const row of this.guildTrialCache) byUid.set(row.uid, row);
      const ownTrial = firebaseService.buildWeeklyTrialEntry(this.state, localUid);
      if (ownTrial && ownTrial.weekId === trialInfo.weekId) byUid.set(ownTrial.uid, ownTrial);
      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:flex-end">
            ${configured ? `<button id="btn-guild-refresh" class="btn" style="padding:4px 8px;font-size:9.5px">${this.guildLoading ? 'Lädt…' : '↻ Aktualisieren'}</button>` : ''}
          </div>
          ${renderTrialBoardHtml({ entries: [...byUid.values()], localUid, info: trialInfo, loading: this.guildLoading })}
          ${
            !configured || !user
              ? `<div style="font-size:11px;color:var(--text-muted);padding:6px 8px;background:rgba(56,232,212,0.08);border:1px solid rgba(56,232,212,0.3)">
                   ☁ Melde dich im Tab <strong>„Konto &amp; Cloud“</strong> an, damit deine Prüfungs-Ergebnisse in die Wochen-Rangliste gelangen.
                 </div>`
              : ''
          }
        </div>
      `;
    } else if (this.guildTab === 'feed') {
      const feedItems: ActivityFeedEntry[] =
        this.guildFeedCache.length > 0
          ? this.guildFeedCache
          : this.state.records.recentMilestones.map((m, i) => ({
              id: `local_${i}`,
              uid: localUid,
              captainName: localName,
              text: m.text,
              badge: m.badge,
              accent: m.accent,
              createdAt: m.ts,
            }));

      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-family:var(--font-pixel);font-size:11px;color:#38e8d4">📡 GALAKTISCHER AKTIVITÄTS-FEED</span>
            ${configured ? `<button id="btn-guild-refresh" class="btn" style="padding:4px 8px;font-size:9.5px">${this.guildLoading ? 'Lädt…' : '↻ Aktualisieren'}</button>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto">
            ${
              feedItems.length === 0
                ? `<div class="inspector-box" style="color:var(--text-muted);font-size:12px">Noch keine Meilensteine verzeichnet. Bezwinge Sektor-Bosse, das 5. Tor oder starte New Game+, um hier im Gilden-Feed zu erscheinen!</div>`
                : feedItems
                    .map(
                      (f) => `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(71,85,105,0.55);background:rgba(13,20,34,0.72)">
                      <span style="font-family:var(--font-pixel);font-size:8.5px;color:${f.accent};border:1px solid ${f.accent};padding:2px 5px;flex-shrink:0">${escapeHtml(f.badge)}</span>
                      <div style="flex:1;min-width:0">
                        <strong style="font-family:var(--font-pixel);font-size:10px;color:#f8fafc">${escapeHtml(f.captainName)}</strong>
                        <div style="font-size:11.5px;color:var(--text-muted);margin-top:1px">${escapeHtml(f.text)}</div>
                      </div>
                      <span style="font-size:10px;color:#64748b;flex-shrink:0">${formatRelativeTime(f.createdAt)}</span>
                    </div>
                  `,
                    )
                    .join('')
            }
          </div>
        </div>
      `;
    } else {
      // Tab 3: Kapitäns-Konto, Persönliche Bestzeiten & Firebase Cloud-Sync
      const rec = this.state.records;
      const personalRecordsHtml = `
        <div class="inspector-box" style="gap:8px">
          <div style="font-family:var(--font-pixel);font-size:10.5px;color:#fde047">⏱ DEINE PERSÖNLICHEN REKORDE</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:6px">
            ${([1, 2, 3, 4, 5] as SectorId[])
              .map(
                (sid) => `
                <div style="padding:5px 7px;background:rgba(10,16,28,0.75);border:1px solid rgba(71,85,105,0.5);text-align:center">
                  <div style="font-family:var(--font-pixel);font-size:8.5px;color:var(--text-muted)">${sid === 5 ? '5. TOR OMEGA' : `SEKTOR ${sid}`}</div>
                  <div style="font-family:var(--font-pixel);font-size:11px;color:#38e8d4;margin-top:2px">${formatDurationSec(rec.bestSectorClearSec[sid])}</div>
                </div>
              `,
              )
              .join('')}
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--text-muted)">
            <span>☀ S4-Rekord: <strong style="color:#fde047">${rec.fastestSector4Days !== null ? `Tag ${rec.fastestSector4Days}` : '—'}</strong></span>
            <span>🌌 Omega-Rekord: <strong style="color:#fde047">${rec.fastestOmegaDays !== null ? `Tag ${rec.fastestOmegaDays}` : '—'}</strong></span>
            <span>♾️ NG+-Rekord: <strong style="color:#c084fc">${rec.fastestNgPlusDays !== null ? `Tag ${rec.fastestNgPlusDays}` : '—'}</strong></span>
            <span>🌀 Tiefster Rift: <strong style="color:#e879f9">${(rec.deepestRiftFloor ?? 0) > 0 ? `∞ Ebene ${rec.deepestRiftFloor}` : '—'}</strong></span>
            <span>🌓 Zyklen: <strong style="color:#f8fafc">${rec.totalCyclesPlayed}</strong></span>
          </div>
        </div>
      `;

      const nameEditorHtml = `
        <div class="inspector-box" style="gap:7px">
          <div style="font-family:var(--font-pixel);font-size:10.5px;color:#38e8d4">★ KAPITÄNS-RUFNAME</div>
          <div style="display:flex;gap:8px">
            <input id="input-captain-name" type="text" maxlength="22" value="${escapeHtml(localName)}"
              style="flex:1;background:rgba(8,13,24,0.9);color:#f8fafc;border:1px solid var(--border-steel);padding:6px 8px;font-family:var(--font-pixel);font-size:10.5px" />
            <button id="btn-save-captain-name" class="btn btn-primary">Speichern</button>
          </div>
        </div>
      `;

      const greetingEditorHtml = `
        <div class="inspector-box" style="gap:7px">
          <div style="font-family:var(--font-pixel);font-size:10.5px;color:#7dd3fc">👻 DEIN HOLO-GRUSS (GEISTER-KAPITÄN)</div>
          <div style="font-size:11px;color:var(--text-muted);line-height:1.45">
            Andere Kapitäne sehen dich als Holo-Kunden in ihrem Laden und lesen diesen Gruß (max. ${GHOST_GREETING_MAX} Zeichen).
          </div>
          <div style="display:flex;gap:8px">
            <input id="input-ghost-greeting" type="text" maxlength="${GHOST_GREETING_MAX}" placeholder="z. B. Schöne Podeste — bis bald!" value="${escapeHtml(this.state.ghostGreeting)}"
              style="flex:1;min-width:0;background:rgba(8,13,24,0.9);color:#f8fafc;border:1px solid var(--border-steel);padding:6px 8px;font-size:12px" />
            <button id="btn-save-greeting" class="btn btn-primary">Speichern</button>
          </div>
        </div>
      `;

      const cloudSectionHtml = !configured
        ? `
          <div class="inspector-box" style="gap:7px;border-color:rgba(251,191,36,0.45)">
            <div style="font-family:var(--font-pixel);font-size:10.5px;color:#fbbf24">☁ FIREBASE EINRICHTUNG (1× IN VERCEL)</div>
            <div style="font-size:11.5px;line-height:1.5;color:var(--text-muted)">
              1. Kostenloses Firebase-Projekt anlegen → <strong>Authentication</strong> (Google + E-Mail/Passwort) &amp; <strong>Cloud Firestore</strong> aktivieren.<br/>
              2. Inhalt aus <code>firestore.rules</code> im Firebase-Tab <em>Firestore → Regeln</em> einfügen.<br/>
              3. Die 6 Keys aus <code>.env.example</code> (<code>VITE_FIREBASE_API_KEY</code> …) in <strong>Vercel → Environment Variables</strong> eintragen &amp; neu deployen — sofort aktiv!
            </div>
          </div>
        `
        : user
          ? `
            <div class="inspector-box" style="gap:8px;border-color:rgba(74,222,128,0.45)">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <div>
                  <div style="font-family:var(--font-pixel);font-size:10.5px;color:#4ade80">☁ ANGEMELDET: ${escapeHtml(user.displayName)}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(user.email || 'Google-Konto')} · ${
                    firebaseService.lastSyncAt
                      ? `Zuletzt synchronisiert: ${formatRelativeTime(firebaseService.lastSyncAt)}`
                      : 'Cloud-Sync aktiv'
                  }</div>
                </div>
                <button id="btn-cloud-logout" class="btn btn-danger" style="padding:5px 9px;font-size:9.5px">Abmelden</button>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button id="btn-cloud-upload" class="btn btn-primary">☁ Jetzt in Cloud &amp; Scoreboard sichern</button>
                <button id="btn-cloud-download" class="btn btn-amber">⬇ Cloud-Spielstand laden</button>
              </div>
            </div>
          `
          : `
            <div class="inspector-box" style="gap:9px;border-color:rgba(56,232,212,0.45)">
              <div style="font-family:var(--font-pixel);font-size:10.5px;color:#38e8d4">☁ ANMELDEN (CLOUD-SAVE &amp; SCOREBOARD)</div>
              <button id="btn-google-login" class="btn btn-amber" style="width:100%">Mit Google anmelden (1 Klick)</button>
              <div style="display:flex;gap:6px;margin-top:2px">
                <button class="btn ${this.guildAuthMode === 'login' ? 'btn-primary' : ''}" data-authmode="login" style="flex:1;padding:4px;font-size:9.5px">E-Mail Login</button>
                <button class="btn ${this.guildAuthMode === 'register' ? 'btn-primary' : ''}" data-authmode="register" style="flex:1;padding:4px;font-size:9.5px">Neu registrieren</button>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <input id="input-auth-email" type="email" placeholder="E-Mail-Adresse"
                  style="background:rgba(8,13,24,0.9);color:#f8fafc;border:1px solid var(--border-steel);padding:6px 8px;font-size:12px" />
                <input id="input-auth-pass" type="password" placeholder="Passwort (mind. 6 Zeichen)"
                  style="background:rgba(8,13,24,0.9);color:#f8fafc;border:1px solid var(--border-steel);padding:6px 8px;font-size:12px" />
                <button id="btn-email-submit" class="btn btn-primary" style="width:100%">
                  ${this.guildAuthMode === 'register' ? 'Konto erstellen & verbinden' : 'Mit E-Mail anmelden'}
                </button>
              </div>
            </div>
          `;

      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${personalRecordsHtml}
          ${nameEditorHtml}
          ${greetingEditorHtml}
          ${cloudSectionHtml}
        </div>
      `;
    }

    this.showModalHtml(`
      <div class="modal-window" style="max-width:680px">
        <div class="modal-header" style="gap:8px">
          <span class="modal-title" style="color:#fde047;white-space:nowrap">🏆 KAPITÄNS-TAFEL</span>
          <div class="modal-tabs" style="flex-wrap:nowrap">
            <button class="tab-btn ${this.guildTab === 'leaderboard' || this.guildTab === 'file' ? 'active' : ''}" data-gtab="leaderboard" style="white-space:nowrap">Rangliste</button>
            <button class="tab-btn ${this.guildTab === 'feed' ? 'active' : ''}" data-gtab="feed" style="white-space:nowrap">Aktivitäten</button>
            <button class="tab-btn ${this.guildTab === 'trial' ? 'active' : ''}" data-gtab="trial" style="white-space:nowrap">🏅 Prüfung</button>
            <button class="tab-btn ${this.guildTab === 'account' ? 'active' : ''}" data-gtab="account" style="white-space:nowrap">Konto &amp; Cloud</button>
          </div>
          <button id="modal-close-btn" class="modal-close" style="white-space:nowrap">ESC ✕</button>
        </div>
        <div class="modal-body">${renderTrendBannerHtml()}${bodyHtml}</div>
      </div>
    `);

    this.modalEl.querySelectorAll<HTMLElement>('[data-gtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        this.guildTab = btn.dataset.gtab as GuildTab;
        this.renderGuildBoardModal();
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-lb-uid]').forEach((row) => {
      const open = () => {
        sound.playUiClick();
        this.guildSelectedUid = row.dataset.lbUid ?? null;
        this.guildTab = 'file';
        this.renderGuildBoardModal();
      };
      row.addEventListener('click', open);
      row.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      });
    });

    this.modalEl.querySelector('#btn-file-back')?.addEventListener('click', () => {
      sound.playUiClick();
      this.guildTab = 'leaderboard';
      this.renderGuildBoardModal();
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-gsort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        this.guildSort = btn.dataset.gsort as 'progress' | 'speed_sector' | 'speed_days' | 'merchant' | 'deepest_rift';
        this.renderGuildBoardModal();
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-gsec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        this.guildSectorFilter = Number(btn.dataset.gsec) as SectorId;
        this.renderGuildBoardModal();
      });
    });

    this.modalEl.querySelector('#btn-guild-refresh')?.addEventListener('click', () => {
      sound.playUiClick();
      void this.refreshGuildBoardData();
    });

    this.modalEl.querySelector('#btn-save-captain-name')?.addEventListener('click', () => {
      const inp = this.modalEl.querySelector('#input-captain-name') as HTMLInputElement | null;
      const next = (inp?.value ?? '').trim().slice(0, 22);
      if (!next) {
        this.toast('Bitte einen gültigen Kapitäns-Namen eingeben!', 'warn');
        return;
      }
      this.state.captainName = next;
      this.state.save();
      void firebaseService.updateCaptainName(next).then(() => {
        if (firebaseService.currentUser) {
          void firebaseService.syncAllToCloud(this.state);
        }
      });
      sound.playUpgrade();
      this.toast(`★ Kapitäns-Name gespeichert: ${next}`, 'good');
      this.renderGuildBoardModal();
    });

    this.modalEl.querySelector('#btn-save-greeting')?.addEventListener('click', () => {
      const inp = this.modalEl.querySelector('#input-ghost-greeting') as HTMLInputElement | null;
      this.state.ghostGreeting = sanitizeGreeting(inp?.value ?? '');
      this.state.save();
      sound.playUpgrade();
      this.toast(
        this.state.ghostGreeting
          ? `👻 Holo-Gruß gespeichert: „${this.state.ghostGreeting}“`
          : '👻 Holo-Gruß entfernt — es wird ein Standard-Gruß verwendet.',
        'good',
      );
      this.renderGuildBoardModal();
    });

    this.modalEl.querySelectorAll<HTMLElement>('[data-authmode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        this.guildAuthMode = btn.dataset.authmode as 'login' | 'register';
        this.renderGuildBoardModal();
      });
    });

    this.modalEl.querySelector('#btn-google-login')?.addEventListener('click', () => {
      sound.playUiClick();
      void firebaseService.signInWithGoogle().then((res) => {
        if (res.ok) {
          this.toast('☁ Erfolgreich mit Google angemeldet!', 'good');
          void this.refreshGuildBoardData();
        } else {
          this.toast(res.error ?? 'Google-Login fehlgeschlagen', 'warn');
        }
      });
    });

    this.modalEl.querySelector('#btn-email-submit')?.addEventListener('click', () => {
      const email = (this.modalEl.querySelector('#input-auth-email') as HTMLInputElement | null)?.value ?? '';
      const pass = (this.modalEl.querySelector('#input-auth-pass') as HTMLInputElement | null)?.value ?? '';
      if (!email.trim() || pass.length < 6) {
        this.toast('Bitte gültige E-Mail & Passwort (mind. 6 Zeichen) eingeben.', 'warn');
        return;
      }
      sound.playUiClick();
      const action =
        this.guildAuthMode === 'register'
          ? firebaseService.registerWithEmail(email, pass, this.state.captainName)
          : firebaseService.signInWithEmail(email, pass);
      void action.then((res) => {
        if (res.ok) {
          this.toast('☁ Anmeldung erfolgreich — Cloud-Sync aktiv!', 'good');
          void this.refreshGuildBoardData();
        } else {
          this.toast(res.error ?? 'Anmeldung fehlgeschlagen', 'warn');
        }
      });
    });

    this.modalEl.querySelector('#btn-cloud-upload')?.addEventListener('click', () => {
      sound.playUiClick();
      void firebaseService.syncAllToCloud(this.state).then((res) => {
        if (res.ok) {
          sound.playUpgrade();
          this.toast('☁ Spielstand & Rekorde in der Cloud gespeichert!', 'good');
          void this.refreshGuildBoardData();
        } else {
          this.toast(res.error ?? 'Cloud-Upload fehlgeschlagen', 'warn');
        }
      });
    });

    this.modalEl.querySelector('#btn-cloud-download')?.addEventListener('click', () => {
      sound.playUiClick();
      void firebaseService.downloadCloudSave().then((res) => {
        if (res.ok && res.saveJson) {
          const imp = this.state.importSaveJson(res.saveJson);
          if (imp.ok) {
            sound.playUpgrade();
            this.renderHud();
            this.toast(`⬇ Cloud-Spielstand geladen (Tag ${this.state.day})!`, 'good');
            this.renderGuildBoardModal();
          } else {
            this.toast(imp.error ?? 'Import fehlgeschlagen', 'warn');
          }
        } else {
          this.toast(res.error ?? 'Kein Cloud-Spielstand gefunden', 'warn');
        }
      });
    });

    this.modalEl.querySelector('#btn-cloud-logout')?.addEventListener('click', () => {
      sound.playUiClick();
      void firebaseService.signOutUser().then(() => {
        this.toast('Vom Cloud-Konto abgemeldet (lokaler Spielstand bleibt erhalten).', 'info');
        this.renderGuildBoardModal();
      });
    });
  }
}
