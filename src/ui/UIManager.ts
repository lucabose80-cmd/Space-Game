import { getHDArt } from '../assets/artLoader';
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
  countBackpackItems,
  countItemTotal,
  depositAllCargoToChest,
  getAllAvailableShopItems,
  quickTransferSlot,
  swapOrMergeSlots,
  takeOneFromSlot,
  type ContainerId,
} from '../systems/inventory';
import type { PedestalSlot, RunSummary, SceneId, UpgradeKey, WeaponId } from '../types';

export interface UIHooks {
  onStartNewGame: () => void;
  onContinueGame: () => void;
  onToggleShopOpen: () => void;
  onSwapWeapon: () => void;
  onModalStateChange: (open: boolean) => void;
  onMuteToggle: () => void;
}

export class UIManager {
  private state: GameState;
  private hooks: UIHooks;

  private hudEl: HTMLElement;
  private modalEl: HTMLElement;
  private toastEl: HTMLElement;
  private titleEl: HTMLElement;

  public currentScene: SceneId = 'shop';
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
          Führe deinen Relikt-Shop auf Port Solaris, schmiede Waffen bis MK-V bei Kael, installiere Tech-Module bei Vex
          und bezwinge alle 3 Ebenen von Sektor 1 bis zum gigantischen A.E.G.I.S. LEVIATHAN!
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
    const isNight = this.state.timeOfDay === 'night';
    const timeLabel = isNight ? `🌙 NACHT ${this.state.day}` : `☀ TAG ${this.state.day}`;
    const timeColor = isNight ? '#818cf8' : 'var(--accent-amber)';
    const floorTag =
      this.dungeonFloor === 1
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
            : isNight
              ? `🌙 ${floorTag} (+35% RAR)`
              : `SEKTOR 1 · ${floorTag}`;

    const hintText =
      this.currentScene === 'shop'
        ? this.shopIsOpen
          ? 'Kunden stöbern! Geh rechts hinter den Tresen [E] & schnapp Diebe mit [SPACE]!'
          : 'Podeste [E] · Oben links: Hinterzimmer (Bett & Truhen) · Auftrags-Pinnwand · Laden [O]'
        : this.currentScene === 'backroom'
          ? 'Privates Kapitäns-Quartier: Ruhekapsel (Tag↔Nacht), Lagertruhen, Waffen-Ständer & Sektor-1-Trophäe!'
          : this.currentScene === 'hub'
            ? isNight
              ? '🌙 Nacht-Bonus aktiv: +35 % seltener & epischer Loot in Sektor 1!'
              : 'Oben: Kael (Schmiede) & Dr. Lyra (Med-Bay) · Unten rechts: Vex (Tech-Labor) · Rechts: Sektor 1!'
            : `${wMeta.name} (${this.state.equippedWeapon === 'blade' ? 'Schild verbraucht EN · Perfekt-Parade!' : wMeta.secondaryLabel}) · [R] Extraktion`;

    this.hudEl.innerHTML = `
      <div class="hud-top">
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
          <div class="hud-meta-row" style="border-top:none;padding-top:1px;margin-top:0">
            <button id="hud-weapon-chip" style="display:inline-flex;align-items:center;gap:5px;background:none;border:none;color:${wMeta.accentColor};font-family:var(--font-pixel);font-size:8.5px;cursor:pointer;pointer-events:auto;padding:0" title="Waffe wechseln [C]">
              <img src="${wMeta.iconUrl}" alt="${wMeta.name}" style="width:14px;height:14px;image-rendering:pixelated" />
              <span>${wMeta.name}${this.state.secondaryWeapon ? ' [C]' : ''}</span>
            </button>
          </div>
        </div>

        <div class="hud-center">
          ${
            this.currentScene !== 'shop'
              ? `<div class="hud-location-pill" style="${isNight ? 'border-color:#818cf8;color:#c7d2fe' : this.currentScene === 'dungeon' && this.dungeonFloor === 3 ? 'border-color:#fb923c;color:#fed7aa' : ''}">${locationText}</div>`
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
          <button id="hud-mute-btn" class="hud-btn" title="Ton umschalten [M]">
            ${sound.isMuted() ? 'TON AUS' : 'TON AN'}
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
                   <span><kbd>E</kbd>Bett / Truhen / Trophäe</span>
                   <span><kbd>I</kbd>Lager &amp; Waffen</span>`
                : this.currentScene === 'hub'
                  ? `<span><kbd>WASD</kbd>Promenade</span>
                     <span><kbd>E</kbd>Shops / Tech-Labor / Warp</span>
                     <span><kbd>I</kbd>Fracht &amp; Codex</span>`
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
    this.hudEl.querySelector('#hud-mute-btn')?.addEventListener('click', () => {
      this.hooks.onMuteToggle();
    });
    this.hudEl.querySelector('#hud-weapon-chip')?.addEventListener('click', () => {
      this.hooks.onSwapWeapon();
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
          modBadge = `<span class="slot-mod-badge" style="background:#fbbf24" title="Resonanz (←): Opfert Item links für +180 Cr!">←</span>`;
        } else if (def.modifier === 'fragile') {
          modBadge = `<span class="slot-mod-dot" style="background:#fb7185" title="Zerbrechlich"></span>`;
        } else if (def.modifier === 'smuggler') {
          modBadge = `<span class="slot-mod-dot" style="background:#fde047" title="Schmuggler-Bonus (+15 %)"></span>`;
        }
        inner = `
          ${modBadge}
          <img class="pixel-icon" src="${art.itemUrls[stack.itemId]}" alt="${def.name}" />
          <span class="slot-qty">${stack.qty}</span>
        `;
        title = `${def.name} (x${stack.qty})${def.modifierLabel ? ' — ' + def.modifierLabel : ''}`;
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

      // Active Weapon Loadout Strip (all 4 Frontier weapon classes!)
      const unlockedList = (['blade', 'spear', 'blaster', 'hammer'] as WeaponId[]).filter(
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
                    <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Finde dieses Relikt in Sektor 1.</div>
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
              return `
                <button class="picker-row ${this.pickedItemId === id ? 'selected' : ''}" data-item-id="${id}">
                  <img src="${art.itemUrls[id]}" alt="${def.name}" />
                  <div style="flex:1">
                    <div style="font-family:var(--font-pixel);font-size:11px;color:${rarity.color}">${def.name}</div>
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
            <div style="font-family:var(--font-pixel);color:${this.state.sector1Cleared ? '#fde047' : '#94a3b8'}">${this.state.sector1Cleared ? '★ SEKTOR 2' : '🔒 SEKTOR 2'}</div>
            <div style="color:${this.state.sector1Cleared ? '#fde047' : 'var(--text-muted)'};margin-top:2px">${this.state.sector1Cleared ? 'Schlüssel aktiv!' : 'Leviathan nötig'}</div>
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
            <div style="color:var(--text-muted)">„4 Waffenklassen bis Meister-Stufe MK-V! Bring mir Reaktor-Splitter, Aegis-Platten und Leviathan-Kerne aus den Tiefen von Sektor 1.“</div>
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
            <div style="color:var(--text-muted)">„Meine passiven Exo-Module steigern Krit-Chance, Lauf- &amp; Dash-Tempo und Relikt-Glück dauerhaft — unverzichtbar für Ebene II &amp; den A.E.G.I.S. Leviathan!“</div>
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

        // Uncrafted Weapon Card (e.g. Ionen-Speer, Puls-Blaster or Grav-Hammer!)
        if (isLockedWeapon && wid && track.craftCost) {
          const canCraft = this.state.canCraftWeapon(wid);
          const hasCr = this.state.credits >= track.craftCost.creditCost;
          const matsHtml = track.craftCost.materials
            .map((m) => {
              const def = getItemDef(m.itemId);
              const owned = countItemTotal(this.state.inventory, m.itemId);
              return `<span class="mat-pill ${owned >= m.qty ? 'ok' : 'missing'}">${def.name}: ${owned}/${m.qty}</span>`;
            })
            .join('');

          return `
            <div class="upgrade-card" style="border-color:rgba(251,191,36,0.45)">
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
              <button class="btn btn-amber btn-craft-weapon" data-wid="${wid}" ${canCraft ? '' : 'disabled'}>
                Schmieden
              </button>
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
        const hasCredits = this.state.credits >= nextTier.creditCost;
        const matsHtml = nextTier.materials
          .map((m) => {
            const def = getItemDef(m.itemId);
            const owned = countItemTotal(this.state.inventory, m.itemId);
            return `<span class="mat-pill ${owned >= m.qty ? 'ok' : 'missing'}">${def.name}: ${owned}/${m.qty}</span>`;
          })
          .join('');

        return `
          <div class="upgrade-card" style="${track.key === 'shopTier' ? 'border-color:rgba(251,191,36,0.48)' : ''}">
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
                <div class="mat-list">
                  <span class="mat-pill ${hasCredits ? 'ok' : 'missing'}">${nextTier.creditCost} Cr</span>
                  ${matsHtml}
                </div>
                ${equipControls}
              </div>
            </div>
            <button class="btn ${track.key === 'shopTier' ? 'btn-amber' : 'btn-primary'} btn-buy-upgrade" data-key="${track.key}" ${canAfford ? '' : 'disabled'}>
              ${isShopTerm ? 'Ausbauen' : isTechLab ? 'Installieren' : 'Verbessern'}
            </button>
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
              return `
                <div class="picker-row" style="justify-content:space-between;cursor:default">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0">
                    <img src="${art.itemUrls[id]}" alt="${def.name}" />
                    <div>
                      <div style="font-family:var(--font-pixel);font-size:10.5px;color:${rarity.color}">${def.name} (${total}×)</div>
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
    const title = summary.sector1Cleared
      ? '★ SEKTOR 1 BEZWUNGEN!'
      : summary.reason === 'boss_victory'
        ? 'TRIUMPHALE EXTRAKTION!'
        : summary.victory
          ? 'EXTRAKTION ERFOLGREICH!'
          : 'IM WRACK GEFALLEN (0 HP)';
    const titleColor = summary.sector1Cleared
      ? '#fde047'
      : summary.victory
        ? 'var(--accent-emerald)'
        : 'var(--accent-coral)';
    const floorLabel =
      summary.floorReached === 3
        ? 'Ebene III'
        : summary.floorReached === 2
          ? 'Ebene II'
          : 'Ebene I';

    const extraNotes: string[] = [];
    if (summary.sector1Cleared) {
      extraNotes.push(
        `🏆 <strong>A.E.G.I.S. LEVIATHAN BESIEGT!</strong> Sektor-2-Schlüssel (<em>Kristall-Asteroidenfeld</em>) aktiviert &amp; goldene Trophäe im <strong>Kapitäns-Quartier</strong> aufgestellt!`,
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
    if (summary.resonanceBonus && summary.resonanceBonus > 0) {
      extraNotes.push(
        `☀ <strong>Nova-Resonanz (←):</strong> +${summary.resonanceBonus} Cr Sofort-Bonus gutgeschrieben!`,
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
        'Gehe links in deinen Shop „Astro-Barter“, um deine Beute zu verkaufen oder Aufträge an der Pinnwand abzuliefern!',
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
          <button id="btn-summary-ok" class="btn btn-primary" style="width:100%">Weiter auf Port Solaris</button>
        </div>
      </div>
    `);

    this.modalEl.querySelector('#btn-summary-ok')?.addEventListener('click', () => {
      sound.playUiClick();
      this.closeModal();
    });
  }
}
