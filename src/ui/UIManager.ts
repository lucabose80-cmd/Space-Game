import { getHDArt } from '../assets/artLoader';
import {
  COMPANION_DEFS,
  COMPANION_ORDER,
  evaluateCompanionUnlock,
  MARKET_EVENT_META,
  MUSIC_TRACK_META,
} from '../data/companions';
import { getItemDef, ITEMS, RARITY_META } from '../data/items';
import { UPGRADE_TRACKS, WEAPON_META } from '../data/upgrades';
import { sound } from '../engine/audio';
import {
  getDemandLabel,
  getDemandLevel,
  getSuggestedStartPrice,
} from '../systems/economy';
import type { GameState } from '../systems/gameState';
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
  CompanionId,
  ItemStack,
  MusicTrack,
  PedestalSlot,
  RunSummary,
  SceneId,
  UpgradeKey,
  WeaponId,
} from '../types';
import type { RoomChest } from '../world/dungeonGen';

export interface UIHooks {
  onStartNewGame: () => void;
  onContinueGame: () => void;
  onToggleShopOpen: () => void;
  onSwapWeapon: () => void;
  onModalStateChange: (open: boolean) => void;
  onMuteToggle: () => void;
  onMusicToggle: () => void;
}

export class UIManager {
  private state: GameState;
  private hooks: UIHooks;

  private hudEl: HTMLElement;
  private modalEl: HTMLElement;
  private toastEl: HTMLElement;
  private titleEl: HTMLElement;

  public currentScene: SceneId = 'shop';
  public dungeonSector: 1 | 2 = 1;
  public dungeonFloor: 1 | 2 | 3 = 1;
  public shopIsOpen = false;
  public modalOpen = false;
  public titleVisible = true;

  private selectedSlot: { container: ContainerId; index: number } | null = null;
  private activeInvTab: 'bag' | 'codex' | 'help' = 'bag';
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
        <div class="title-kicker">PORT SOLARIS · ASTRO-BARTER</div>
        <h1 class="title-logo">STARLIGHTER</h1>
        <p class="title-sub">
          Führe deinen Relikt-Shop auf Port Solaris, schmiede 6 Waffenklassen bis Kristall-Meister MK-VI bei Kael
          und bezwinge Sektor 1 (Wrackfeld) &amp; Sektor 2 (Kristall-Nebel) bis zum Prisma-Archon!
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
          <div><strong>WASD / Stick</strong> Bewegen</div>
          <div><strong>SPACE</strong> Jetpack-Dash</div>
          <div><strong>LMB / J</strong> Aktive Waffe</div>
          <div><strong>RMB / K</strong> Schild / Spezial</div>
          <div><strong>C</strong> Waffe wechseln</div>
          <div><strong>E</strong> Interagieren / Kasse</div>
          <div><strong>I / TAB</strong> Fracht &amp; Codex</div>
          <div><strong>R halten</strong> Extraktion (Warp)</div>
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
    const compDef = this.state.equippedCompanion ? COMPANION_DEFS[this.state.equippedCompanion] : null;
    const evMeta = MARKET_EVENT_META[this.state.marketEvent];
    const isNight = this.state.timeOfDay === 'night';
    const timeLabel = isNight ? `🌙 NACHT ${this.state.day}` : `☀ TAG ${this.state.day}`;
    const timeColor = isNight ? '#818cf8' : 'var(--accent-amber)';
    const floorTag =
      this.dungeonSector === 2
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
            : this.currentScene === 'hangar'
              ? `${timeLabel} · RAUMHAFEN (DOCKS I–IV)`
              : isNight
                ? `🌙 S${this.dungeonSector} · ${floorTag} (+35% RAR)`
                : `SEKTOR ${this.dungeonSector} · ${floorTag}`;

    const hintText =
      this.currentScene === 'shop'
        ? this.shopIsOpen
          ? 'Kunden stöbern! Geh rechts hinter den Tresen [E] · VIP-Sammler zahlen +40 % · Diebe fangen [SPACE]!'
          : 'Podeste [E] · Oben links: Hinterzimmer (Bett, Truhen, Drohnen & Jukebox) · Laden [O]'
        : this.currentScene === 'backroom'
          ? 'Kapitäns-Quartier: Ruhekapsel (Tag↔Nacht), Drohnen-Dock (Begleiter), Sternen-Jukebox & Lagertruhen!'
          : this.currentScene === 'hub'
            ? isNight
              ? '🌙 Nacht-Bonus aktiv: +35 % seltener Loot · Rechts: Raumhafen (Docks I–IV) · Unten links: Nyx!'
              : 'Oben: Kael (6 Waffen) & Dr. Lyra · Unten: Nyx & Vex · Rechts: Raumhafen (Sektor-Docks I–IV)!'
            : this.currentScene === 'hangar'
              ? this.state.sector1Cleared
                ? 'Raumhafen: Dock I → Sektor 1 · Dock II (Kristall-Kreuzer) → Sektor 2 · 5. Tor (Mitte) zeigt Sektor-Siegel!'
                : 'Raumhafen: Dock I (oben links) startet nach Sektor 1 · Docks II–IV & 5. Tor (Mitte) über Sektor-Schlüssel!'
              : `${wMeta.name} (${this.state.equippedWeapon === 'blade' ? 'Schild verbraucht EN · Perfekt-Parade!' : wMeta.secondaryLabel}) · [R] Extraktion`;

    const eventPillHtml =
      this.state.marketEvent !== 'normal' && (this.currentScene === 'shop' || this.currentScene === 'hub')
        ? `<div style="margin-top:2px;padding:2px 6px;border:1px solid ${evMeta.color};background:rgba(15,23,42,0.85);font-family:var(--font-pixel);font-size:8px;color:${evMeta.color};text-align:center" title="${evMeta.description}">★ ${evMeta.shortBadge}</div>`
        : '';

    const pinnedList = this.state.getPinnedRecipeDetails();
    const pinTrackerHtml =
      pinnedList.length > 0
        ? `
        <div class="hud-pin-tracker">
          <div class="hud-pin-head">
            <span>📌 MERKLISTE (${pinnedList.length})</span>
          </div>
          ${pinnedList
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
      <div class="hud-top">
        <div style="display:flex;flex-direction:column;align-items:flex-start">
          <div class="hud-vitals">
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
          </div>
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

        <div class="hud-actions ${this.currentScene === 'dungeon' ? 'dungeon-offset' : ''}">
          ${
            this.currentScene === 'shop'
              ? `<button id="hud-shop-toggle" class="hud-btn ${this.shopIsOpen ? 'active-open' : 'primary'}">
                  ${this.shopIsOpen ? '[O] Schließen' : '[O] Öffnen'}
                </button>`
              : ''
          }
          <button id="hud-bag-btn" class="hud-btn">[I] Fracht (${bagCount})</button>
          <button id="hud-music-btn" class="hud-btn" title="Musik umschalten [M]">
            ${sound.isMusicMuted() || sound.isMuted() ? '♪ AUS' : '♪ MUSIK'}
          </button>
          <button id="hud-mute-btn" class="hud-btn" title="Alle Töne stumm/an">
            ${sound.isMuted() ? 'TON AUS' : 'SFX AN'}
          </button>
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
                    : `<span><kbd>LMB/J</kbd>${wMeta.shortName}</span>
                       <span><kbd>RMB/K</kbd>${this.state.equippedWeapon === 'blade' ? 'Schild' : 'Spezial'}</span>
                       <span><kbd>C</kbd>Wechseln</span>
                       <span><kbd>SPACE</kbd>Dash</span>
                       <span><kbd>R</kbd>Extraktion</span>`
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

  public closeModal(): void {
    if (!this.modalOpen) return;
    this.modalOpen = false;
    this.selectedSlot = null;
    this.activePedestal = null;
    this.modalEl.classList.add('hidden');
    this.modalEl.innerHTML = '';
    this.hooks.onModalStateChange(false);
    this.renderHud();
  }

  private showModalHtml(html: string): void {
    this.modalOpen = true;
    this.modalEl.innerHTML = html;
    this.modalEl.classList.remove('hidden');
    this.hooks.onModalStateChange(true);
    this.modalEl.querySelector('#modal-close-btn')?.addEventListener('click', () => {
      sound.playUiClick();
      this.closeModal();
    });
  }

  // ==================== INVENTORY, CHEST & SCAN-CODEX ====================
  public openInventoryModal(withChest: boolean, tab: 'bag' | 'codex' | 'help' = 'bag'): void {
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
      const unlockedList = (['blade', 'spear', 'fists', 'discus', 'blaster', 'hammer'] as WeaponId[]).filter(
        (id) => this.state.unlockedWeapons[id],
      );
      const weaponBarHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:8px 10px;background:var(--panel-bg-soft);border:1px solid var(--border-steel)">
          <span style="font-family:var(--font-pixel);font-size:10px;color:var(--text-muted)">AUSGERÜSTETE WAFFE:</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${unlockedList
              .map((wid) => {
                const m = WEAPON_META[wid];
                const isMain = this.state.equippedWeapon === wid;
                const isSec = this.state.secondaryWeapon === wid;
                return `
                  <button class="btn btn-equip-bag" data-wid="${wid}" style="padding:5px 10px;font-size:9.5px;display:inline-flex;align-items:center;gap:5px;border-color:${isMain ? m.accentColor : isSec ? '#64748b' : 'var(--border-steel)'}">
                    <img src="${m.iconUrl}" alt="${m.name}" style="width:16px;height:16px;image-rendering:pixelated" />
                    <span>${m.name}</span>
                    ${isMain ? '<span style="color:var(--accent-emerald)">(AKTIV)</span>' : isSec ? '<span style="color:var(--text-muted)">(2.)</span>' : ''}
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      `;

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
                      item.sector === 2 ? 'Finde dieses Kristall-Relikt in Sektor 2.' : 'Finde dieses Relikt in Sektor 1.'
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
                    <span style="font-size:10px;color:${demand.color}">${demand.arrow} ${demand.text.split(' ')[0]}</span>
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
    } else {
      bodyHtml = `
        <div class="inspector-box" style="gap:10px">
          <div style="font-family:var(--font-pixel);font-size:12px;color:var(--accent-cyan)">SO SPIELST DU STARLIGHTER</div>
          <p style="font-size:13px;line-height:1.5;color:var(--text-muted)">
            <strong>1. Astro-Barter &amp; Ausbau:</strong> Bestücke deine Holo-Podeste [E], geh zum Abkassieren rechts hinter den Tresen und schnapp <strong>Weltraum-Diebe</strong> per Dash [SPACE] (+35 Cr Kopfgeld)!
            Am linken <strong>Shop-Ausbau-Terminal</strong> vergrößerst du deinen Laden (Stufe I → II → III: bis zu 8 Podeste, 48 Truhen-Slots &amp; automatische <strong>Sonderangebots-Kiste</strong>).
          </p>
          <p style="font-size:13px;line-height:1.5;color:var(--text-muted)">
            <strong>2. Tag-/Nacht-Rhythmus &amp; Aufträge:</strong> Nutze die <strong>Chrono-Ruhekapsel</strong> (oben links), um zwischen Tag und Nacht zu wechseln — <strong>Nacht-Expeditionen</strong> geben <strong>+35 % Chance auf seltene &amp; epische Relikte</strong>!
            An der <strong>Auftrags-Pinnwand</strong> (oben rechts) warten täglich lukrative Kunden-Aufträge (+65 % Bonus-Erlös).
          </p>
          <p style="font-size:13px;line-height:1.5;color:var(--text-muted)">
            <strong>3. Skill-Schild &amp; Fracht-Synergien:</strong> Dein Hex-Aegis-Schild verbraucht beim Halten Energie und überhitzt bei 0 EN — time <strong>Perfekt-Paraden</strong> (+16 EN &amp; Konter!) oder weiche per Dash [SPACE] aus.
            Sortiere Relikte clever im Rucksack: <strong>↑ Klon-Würfel</strong>, <strong>→ Quanten-Gyroskop</strong>, <strong>← Nova-Kondensator</strong> &amp; <strong>▲ Phasen-Splitter</strong> (nur oberste Reihe!).
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
          <span class="modal-title">${this.chestMode ? 'LAGERTRUHE &amp; RUCKSACK' : 'EXPEDITIONS-RUCKSACK'}</span>
          <div class="modal-tabs">
            <button class="tab-btn ${this.activeInvTab === 'bag' ? 'active' : ''}" data-tab="bag">Fracht</button>
            <button class="tab-btn ${this.activeInvTab === 'codex' ? 'active' : ''}" data-tab="codex">Scan-Codex</button>
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
        this.activeInvTab = btn.dataset.tab as 'bag' | 'codex' | 'help';
        this.renderInventoryModal();
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('.btn-equip-bag').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wid = btn.dataset.wid as WeaponId;
        this.state.equipWeapon(wid, 'primary');
        sound.playWeaponSwap();
        this.renderInventoryModal();
        this.renderHud();
      });
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
            <span style="font-size:11px;color:${demand.color}">${demand.arrow} ${demand.text}</span>
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
            <div style="font-family:var(--font-pixel);color:${this.state.deepestFloor >= 1 ? '#38e8d4' : 'var(--text-muted)'}">EBENE I</div>
            <div style="color:var(--text-muted);margin-top:2px">Schott-Brecher</div>
          </div>
          <div style="text-align:center;font-size:10px">
            <div style="font-family:var(--font-pixel);color:${this.state.deepestFloor >= 2 ? '#34d399' : 'var(--text-muted)'}">EBENE II</div>
            <div style="color:var(--text-muted);margin-top:2px">Core-Wächter</div>
          </div>
          <div style="text-align:center;font-size:10px">
            <div style="font-family:var(--font-pixel);color:${this.state.deepestFloor >= 3 ? '#fb923c' : 'var(--text-muted)'}">EBENE III</div>
            <div style="color:var(--text-muted);margin-top:2px">A.E.G.I.S. Leviathan</div>
          </div>
          <div style="text-align:center;font-size:10px;border-left:1px solid rgba(255,255,255,0.12);padding-left:6px">
            <div style="font-family:var(--font-pixel);color:${
              this.state.sector2Cleared ? '#e879f9' : this.state.sector1Cleared ? '#fde047' : '#94a3b8'
            }">${
              this.state.sector2Cleared
                ? '★ S2 BEZWUNGEN'
                : this.state.sector1Cleared
                  ? `★ S2 · E${this.state.deepestFloorS2}/3`
                  : '🔒 SEKTOR 2'
            }</div>
            <div style="color:${
              this.state.sector2Cleared ? '#f0abfc' : this.state.sector1Cleared ? '#fde047' : 'var(--text-muted)'
            };margin-top:2px">${
              this.state.sector2Cleared
                ? 'S3-Schlüssel aktiv!'
                : this.state.sector1Cleared
                  ? 'Dock II bereit!'
                  : 'Leviathan nötig'
            }</div>
          </div>
        </div>
      `
      : '';

    const npcBanner = isForge
      ? `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(249,115,22,0.1);border:1px solid rgba(251,146,60,0.4)">
          <img src="/art/sprites/npc_kael.png" alt="Schmied Kael" style="width:42px;height:46px;image-rendering:pixelated" />
          <div style="font-size:12px;line-height:1.4">
            <strong style="font-family:var(--font-pixel);font-size:11px;color:#fbbf24">SCHMIED KAEL</strong>
            <div style="color:var(--text-muted)">„6 Waffenklassen bis Kristall-Meister MK-VI! Bring mir Materialien aus Sektor 1 sowie Amethyst-Kerne, Prisma-Matrizen &amp; Archon-Herzen aus Sektor 2.“</div>
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
          const hasCr = this.state.credits >= track.craftCost.creditCost;
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
                    <span class="mat-pill ${hasCr ? 'ok' : 'missing'}">${track.craftCost.creditCost} Cr</span>
                    ${matsHtml}
                  </div>
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

        const equipControls = wid
          ? (() => {
              const isMain = this.state.equippedWeapon === wid;
              const isSec = this.state.secondaryWeapon === wid;
              return `
                <div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap">
                  <button class="btn btn-equip-forge" data-wid="${wid}" data-slot="primary" style="padding:4px 8px;font-size:9px;${isMain ? 'border-color:var(--accent-emerald);color:var(--accent-emerald)' : ''}" ${isMain ? 'disabled' : ''}>
                    ${isMain ? '✓ Hauptwaffe' : 'Als Hauptwaffe'}
                  </button>
                  <button class="btn btn-equip-forge" data-wid="${wid}" data-slot="secondary" style="padding:4px 8px;font-size:9px;${isSec ? 'border-color:var(--accent-cyan);color:var(--accent-cyan)' : ''}" ${isSec || isMain ? 'disabled' : ''}>
                    ${isSec ? '✓ 2. Slot [C]' : 'In 2. Slot [C]'}
                  </button>
                </div>
              `;
            })()
          : '';

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
        const tierLocked =
          track.requiresShopTier !== undefined && (this.state.upgrades.shopTier ?? 0) < track.requiresShopTier;
        const hasCredits = this.state.credits >= nextTier.creditCost;
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
                    ? `<div style="font-size:11px;color:var(--accent-coral);margin-top:4px">🔒 Benötigt zuerst: Shop-Vergrößerung Stufe II (Astro-Barter Galerie)</div>`
                    : `<div class="mat-list">
                        <span class="mat-pill ${hasCredits ? 'ok' : 'missing'}">${nextTier.creditCost} Cr</span>
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

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title">${modalTitle}</span>
          <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${this.state.credits} CR</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          ${npcBanner}
          <div class="upgrade-list">${cardsHtml}</div>
        </div>
      </div>
    `);

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
          sound.playUpgrade();
          this.toast(`${WEAPON_META[wid].name} geschmiedet! Wechsle jederzeit mit [C].`, 'good');
          this.openStationShopModal(shop);
          this.renderHud();
        }
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('.btn-equip-forge').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wid = btn.dataset.wid as WeaponId;
        const slot = btn.dataset.slot as 'primary' | 'secondary';
        this.state.equipWeapon(wid, slot);
        sound.playWeaponSwap();
        this.openStationShopModal(shop);
        this.renderHud();
      });
    });

    this.modalEl.querySelectorAll<HTMLElement>('.btn-buy-upgrade').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key as UpgradeKey;
        if (this.state.purchaseUpgrade(key)) {
          sound.playUpgrade();
          if (key === 'shopTier') {
            const lvl = this.state.upgrades.shopTier;
            this.toast(
              lvl === 1
                ? '★ Stufe II erreicht! 6 Holo-Podeste, Sale-Box & 2 Lagertruhen (36 Slots) im Hinterzimmer!'
                : '★ Stufe III erreicht! 8 Podeste & 3 Lagertruhen (48 Slots) im Kapitäns-Quartier!',
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
          this.openStationShopModal(shop);
          this.renderHud();
        }
      });
    });
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

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title">AUFTRAGS-PINNWAND · TAG ${this.state.day}</span>
          <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${this.state.credits} CR</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="modifier-box" style="border-left-color:var(--accent-cyan);background:rgba(56,232,212,0.08);color:#cffafe">
            ★ Bewohner von Port Solaris zahlen <strong>+65 % Bonus-Marktwert</strong> für gezielte Lieferungen!
            Jeden neuen Morgen (nach der Nacht-Ruhe) erscheinen 3 frische Sonderaufträge.
          </div>
          <div class="upgrade-list">${cardsHtml}</div>
        </div>
      </div>
    `);

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
              const salePrice = Math.max(10, Math.round(def.baseValue * 0.7));
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
              const salePrice = Math.max(10, Math.round(def.baseValue * 0.7));
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
    const isS2 = summary.sector === 2;
    const title = summary.sector2Cleared
      ? '★ SEKTOR 2 BEZWUNGEN!'
      : summary.sector1Cleared
        ? '★ SEKTOR 1 BEZWUNGEN!'
        : summary.reason === 'boss_victory'
          ? 'TRIUMPHALE EXTRAKTION!'
          : summary.victory
            ? 'EXTRAKTION ERFOLGREICH!'
            : isS2
              ? 'IM KRISTALL-NEBEL GEFALLEN (0 HP)'
              : 'IM WRACK GEFALLEN (0 HP)';
    const titleColor = summary.sector2Cleared
      ? '#e879f9'
      : summary.sector1Cleared
        ? '#fde047'
        : summary.victory
          ? 'var(--accent-emerald)'
          : 'var(--accent-coral)';
    const floorLabel = `${isS2 ? 'S2 · ' : 'S1 · '}${
      summary.floorReached === 3
        ? 'Ebene III'
        : summary.floorReached === 2
          ? 'Ebene II'
          : 'Ebene I'
    }`;

    const extraNotes: string[] = [];
    if (summary.sector2Cleared) {
      extraNotes.push(
        `💎 <strong>PRISMA-ARCHON BESIEGT!</strong> <strong>Sektor-3-Schlüssel</strong> &amp; <strong>Siegel #2</strong> am 5. Tor im Raumhafen sowie das violette Archon-Herz im Kapitäns-Quartier aktiviert!`,
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
        'Alle ungeschützten Relikte im Expeditions-Rucksack gingen im Wrack verloren! Nutze beim nächsten Mal den Warp-Beacon [R] oder platziere dein Quanten-Gyroskop (→) links neben dem wichtigsten Relikt.',
      );
    } else if (summary.itemsSaved > 0) {
      extraNotes.push(
        'Gehe links zurück über die Promenade in deinen Shop „Astro-Barter“, um deine Beute für Credits zu verkaufen!',
      );
    }

    this.showModalHtml(`
      <div class="modal-window" style="max-width:560px">
        <div class="modal-header">
          <span class="modal-title" style="color:${titleColor}">${title}</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="summary-grid">
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Tiefe erreicht</div>
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

    const cardsHtml = this.state.nyxStock
      .map((offer) => {
        const def = getItemDef(offer.itemId);
        const rarity = RARITY_META[def.rarity];
        const soldOut = offer.stock <= 0;
        const canBuy = !soldOut && this.state.credits >= offer.price;
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
                  <span class="mat-pill ${this.state.credits >= offer.price ? 'ok' : 'missing'}">${offer.price} Cr</span>
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
    const trackIds: MusicTrack[] = ['shop_day', 'shop_night', 'hub', 'dungeon', 'dungeon_s2', 'boss'];

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
}
