import { getAtlas } from '../assets/sprites';
import { getItemDef, ITEMS, RARITY_META } from '../data/items';
import { UPGRADE_TRACKS } from '../data/upgrades';
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
  getAllAvailableShopItems,
  quickTransferSlot,
  swapOrMergeSlots,
  takeOneFromSlot,
  type ContainerId,
} from '../systems/inventory';
import type { PedestalSlot, RunSummary, SceneId, UpgradeKey } from '../types';

export interface UIHooks {
  onStartNewGame: () => void;
  onContinueGame: () => void;
  onToggleShopOpen: () => void;
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
          Führe bei Tag deinen gemütlichen Relikt-Shop auf einer Frontier-Raumstation –
          und plündere in den Drift-Sektoren verlassene Korvetten nach seltener Alien-Technologie.
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
          <div><strong>WASD</strong> Bewegen</div>
          <div><strong>SPACE</strong> Jetpack-Dash</div>
          <div><strong>LMB / J</strong> Plasma-Klinge</div>
          <div><strong>RMB / K</strong> Puls-Blaster</div>
          <div><strong>E</strong> Interagieren / Kasse</div>
          <div><strong>I / TAB</strong> Fracht &amp; Codex</div>
          <div><strong>Q</strong> Stimpack (Heilen)</div>
          <div><strong>R halten</strong> Warp-Beacon</div>
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

    const locationText =
      this.currentScene === 'shop'
        ? this.shopIsOpen
          ? `TAG ${this.state.day} · ASTRO-BARTER (OFFEN)`
          : `TAG ${this.state.day} · ASTRO-BARTER`
        : `SEKTOR 1 · VERLASSENE KORVETTE`;

    const hintText =
      this.currentScene === 'shop'
        ? this.shopIsOpen
          ? 'Kunden stöbern! Bediene wartende Käufer an der Kasse mit [E].'
          : 'Podeste [E] bestücken & Laden öffnen [O] — oder rechts ins Warp-Gate zu Sektor 1!'
        : 'Sammle Relikte, finde Schatzraum & Boss — halte [R] für Warp-Beacon (20 Cr).';

    this.hudEl.innerHTML = `
      <div class="hud-top">
        <div class="hud-vitals">
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
            <span class="hud-stims">STIM [Q]: ${this.state.stimCharges}/${stats.maxStimCharges}</span>
          </div>
        </div>

        <div class="hud-center">
          <div class="hud-location-pill ${this.currentScene === 'shop' && this.shopIsOpen ? 'shop-open' : ''}">
            ${locationText}
          </div>
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
                 <span><kbd>O</kbd>Laden öffnen</span>
                 <span><kbd>I</kbd>Fracht &amp; Codex</span>`
              : `<span><kbd>LMB/J</kbd>Plasma-Klinge</span>
                 <span><kbd>RMB/K</kbd>Blaster</span>
                 <span><kbd>SPACE</kbd>Dash</span>
                 <span><kbd>Q</kbd>Heilen</span>
                 <span><kbd>R</kbd>Warp (20 Cr)</span>`
          }
        </div>
        <div class="hud-hint">${hintText}</div>
      </div>
    `;

    this.hudEl.querySelector('#hud-bag-btn')?.addEventListener('click', () => {
      sound.playUiClick();
      this.openInventoryModal(this.currentScene === 'shop', 'bag');
    });
    this.hudEl.querySelector('#hud-shop-toggle')?.addEventListener('click', () => {
      this.hooks.onToggleShopOpen();
    });
    this.hudEl.querySelector('#hud-mute-btn')?.addEventListener('click', () => {
      this.hooks.onMuteToggle();
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
    const atlas = getAtlas();

    const renderSlot = (container: ContainerId, index: number, isSafe = false): string => {
      const stack = this.state.inventory[container][index];
      const isSelected =
        this.selectedSlot?.container === container && this.selectedSlot?.index === index;
      let inner = '';
      let title = 'Leerer Slot';
      if (stack) {
        const def = getItemDef(stack.itemId);
        const modDot =
          def.modifier === 'fragile'
            ? '<span class="slot-mod-dot" style="background:#fb7185" title="Zerbrechlich"></span>'
            : def.modifier === 'warp_anchor'
              ? '<span class="slot-mod-dot" style="background:#34d399" title="Warp-Anker"></span>'
              : def.modifier === 'smuggler'
                ? '<span class="slot-mod-dot" style="background:#fde047" title="Schmuggler-Bonus"></span>'
                : '';
        inner = `
          ${modDot}
          <img class="pixel-icon" src="${atlas.itemDataUrls[stack.itemId]}" alt="${def.name}" />
          <span class="slot-qty">${stack.qty}</span>
        `;
        title = `${def.name} (x${stack.qty})`;
      }
      return `
        <button class="inv-slot ${isSafe ? 'safe' : ''} ${isSelected ? 'selected' : ''}"
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

      const inspectorHtml =
        selDef && selStack && selEntry && selRarity
          ? `
          <div class="inspector-box">
            <div class="inspector-head">
              <div class="inspector-icon-wrap">
                <img class="pixel-icon" src="${atlas.itemDataUrls[selDef.id]}" alt="${selDef.name}" />
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
              selDef.modifierLabel
                ? `<div class="modifier-box">⚡ ${selDef.modifierLabel}</div>`
                : ''
            }
            <div style="font-size:11px;color:var(--text-muted)">
              ${
                selEntry.maxFairPrice !== null
                  ? `Bekannter Fair-Preis: <strong style="color:var(--accent-emerald)">${selEntry.minFairPrice}–${selEntry.maxFairPrice} Cr</strong>`
                  : 'Preis noch unbekannt — teste ihn im Shop!'
              }
            </div>
            <button id="btn-quick-transfer" class="btn" style="margin-top:auto">
              ${
                this.selectedSlot?.container === 'chest'
                  ? 'In Rucksack verschieben'
                  : this.chestMode
                    ? 'In Lagertruhe lagern'
                    : this.selectedSlot?.container === 'cargo'
                      ? 'In Gürtel sichern'
                      : 'In Frachtraum legen'
              }
            </button>
          </div>
        `
          : `
          <div class="inspector-box" style="justify-content:center;align-items:center;text-align:center;color:var(--text-muted);font-size:12px">
            <p>Klicke auf einen Slot, um ein Relikt auszuwählen oder mit einem anderen Slot zu tauschen.</p>
            <p style="margin-top:6px;color:var(--accent-emerald)">Tipp: Die 5 grünen Gürtel-Slots bleiben bei einer Niederlage sicher erhalten!</p>
          </div>
        `;

      const rightColumn = this.chestMode
        ? `
          <div>
            <div class="section-label">
              <span>LAGERTRUHE (28 SLOTS)</span>
              <span style="color:var(--accent-cyan)">Sicher im Shop</span>
            </div>
            <div class="slot-grid chest-grid">
              ${this.state.inventory.chest.map((_, i) => renderSlot('chest', i)).join('')}
            </div>
            ${inspectorHtml}
          </div>
        `
        : inspectorHtml;

      bodyHtml = `
        <div class="inv-layout ${this.chestMode ? '' : 'single'}">
          <div>
            <div class="section-label">
              <span>SICHERHEITS-GÜRTEL (5 SLOTS)</span>
              <span class="safe-tag">✓ Sicher bei Tod</span>
            </div>
            <div class="slot-grid">
              ${this.state.inventory.safeBelt.map((_, i) => renderSlot('safeBelt', i, true)).join('')}
            </div>
            <div class="section-label">
              <span>FRACHTRAUM (15 SLOTS)</span>
              <span style="color:var(--accent-coral)">Verlust bei 0 HP</span>
            </div>
            <div class="slot-grid">
              ${this.state.inventory.cargo.map((_, i) => renderSlot('cargo', i, false)).join('')}
            </div>
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
                  <img class="pixel-icon" src="${atlas.itemDataUrls[item.id]}" alt="${item.name}" />
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
            <strong>1. Expedition (Sektor 1):</strong> Gehe rechts im Shop durch das leuchtende Warp-Gate in die <em>Verlassene Korvette</em>.
            Kämpfe mit <strong>Plasma-Klinge (LMB / J)</strong>, <strong>Puls-Blaster (RMB / K)</strong> und <strong>Jetpack-Dash (SPACE)</strong>.
            Zerstöre goldene Frachtkapseln, finde den Schatzraum und besiege den <strong>Core-Wächter MK-IV</strong>.
          </p>
          <p style="font-size:13px;line-height:1.5;color:var(--text-muted)">
            <strong>2. Sicher zurückkehren:</strong> Halte jederzeit <strong>[R]</strong> für den Warp-Beacon (20 Cr) oder nutze das Start-/Sieges-Portal gratis.
            Bei 0 HP wirst du not-teleportiert und verlierst den Frachtraum – nur deine <strong>5 grünen Gürtel-Slots</strong> bleiben sicher!
          </p>
          <p style="font-size:13px;line-height:1.5;color:var(--text-muted)">
            <strong>3. Space-Shop (Astro-Barter):</strong> Lege Relikte auf die 4 Holo-Podeste [E], wähle einen Preis und öffne den Laden [O].
            Beobachte die Kunden-Reaktionen und kassiere Käufer an der Theke mit [E] ab! Investiere Credits &amp; Relikte an der <strong>Exo-Werkbank</strong> links.
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
          <span class="modal-title">${this.chestMode ? 'LAGERTRUHE &amp; FRACHT' : 'CARGO-RUCKSACK'}</span>
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

    // Bind tabs
    this.modalEl.querySelectorAll<HTMLElement>('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        this.activeInvTab = btn.dataset.tab as 'bag' | 'codex' | 'help';
        this.renderInventoryModal();
      });
    });

    // Bind slot clicks
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
    const atlas = getAtlas();

    // Aggregate counts by itemId across backpack + chest (plus whatever is already on this pedestal)
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
                  <img src="${atlas.itemDataUrls[id]}" alt="${def.name}" />
                  <div style="flex:1">
                    <div style="font-family:var(--font-pixel);font-size:11px;color:${rarity.color}">${def.name}</div>
                    <div style="font-size:11px;color:var(--text-muted)">Verfügbar: ${total}×</div>
                  </div>
                </button>
              `;
            })
            .join('')
        : `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:12px">
             Keine Relikte im Inventar oder in der Truhe. Starte rechts eine Expedition in Sektor 1!
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
            ${
              ped.itemId
                ? `<button id="btn-clear-pedestal" class="btn btn-danger">Leeren</button>`
                : ''
            }
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

      // Return previous pedestal contents to inventory first
      if (ped.itemId && ped.qty > 0) {
        addItemAnywhere(this.state.inventory, ped.itemId, ped.qty);
        ped.itemId = null;
        ped.qty = 0;
      }

      // Pull desired quantity from inventory (cargo -> chest -> safeBelt)
      let taken = 0;
      const order: ContainerId[] = ['cargo', 'chest', 'safeBelt'];
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

  // ==================== EXO-WERKBANK UPGRADE MODAL ====================
  public openWorkbenchModal(): void {
    const atlas = getAtlas();

    const cardsHtml = UPGRADE_TRACKS.map((track) => {
      const curLvl = this.state.upgrades[track.key];
      const nextTier = track.tiers[curLvl];
      const pips = track.tiers
        .map((_, idx) => `<span class="pip ${idx < curLvl ? 'filled' : ''}"></span>`)
        .join('');

      if (!nextTier) {
        return `
          <div class="upgrade-card">
            <div class="upgrade-left">
              <div class="inspector-icon-wrap">
                <img class="pixel-icon" src="${atlas.itemDataUrls[track.iconItemId]}" alt="${track.title}" />
              </div>
              <div>
                <div style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-emerald)">
                  ${track.title} <span class="upgrade-pips">${pips}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">Maximal aufgerüstet!</div>
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
          const ok = owned >= m.qty;
          return `
            <span class="mat-pill ${ok ? 'ok' : 'missing'}">
              ${def.name}: ${owned}/${m.qty}
            </span>
          `;
        })
        .join('');

      return `
        <div class="upgrade-card">
          <div class="upgrade-left">
            <div class="inspector-icon-wrap">
              <img class="pixel-icon" src="${atlas.itemDataUrls[track.iconItemId]}" alt="${track.title}" />
            </div>
            <div>
              <div style="font-family:var(--font-pixel);font-size:11px;color:#fff">
                ${track.title}: <span style="color:var(--accent-cyan)">${nextTier.name}</span>
                <span class="upgrade-pips">${pips}</span>
              </div>
              <div style="font-size:12px;color:var(--text-muted)">${nextTier.description} · <strong style="color:var(--accent-amber)">${nextTier.statLabel}</strong></div>
              <div class="mat-list">
                <span class="mat-pill ${hasCredits ? 'ok' : 'missing'}">${nextTier.creditCost} Cr</span>
                ${matsHtml}
              </div>
            </div>
          </div>
          <button class="btn btn-primary btn-buy-upgrade" data-key="${track.key}" ${canAfford ? '' : 'disabled'}>
            Aufrüsten
          </button>
        </div>
      `;
    }).join('');

    this.showModalHtml(`
      <div class="modal-window">
        <div class="modal-header">
          <span class="modal-title">EXO-WERKBANK · AUSRÜSTUNG &amp; SHOP-UPGRADES</span>
          <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${this.state.credits} CR</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="upgrade-list">${cardsHtml}</div>
        </div>
      </div>
    `);

    this.modalEl.querySelectorAll<HTMLElement>('.btn-buy-upgrade').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key as UpgradeKey;
        if (this.state.purchaseUpgrade(key)) {
          sound.playUpgrade();
          this.toast('Upgrade erfolgreich geschmiedet!', 'good');
          this.openWorkbenchModal();
          this.renderHud();
        }
      });
    });
  }

  // ==================== EXPEDITION SUMMARY MODAL ====================
  public openRunSummaryModal(summary: RunSummary): void {
    const title =
      summary.reason === 'boss_victory'
        ? 'TRIUMPHALE RÜCKKEHR!'
        : summary.victory
          ? 'WARP ERFOLGREICH!'
          : 'NOT-TELEPORT AUSGELÖST';
    const titleColor = summary.victory ? 'var(--accent-emerald)' : 'var(--accent-coral)';

    const extraNotes: string[] = [];
    if (summary.warpedToChest.length > 0) {
      extraNotes.push(
        `⚡ <strong>Warp-Anker:</strong> ${summary.warpedToChest.join(', ')} direkt in deine Lagertruhe teleportiert!`,
      );
    }
    if (summary.shatteredItems.length > 0) {
      extraNotes.push(
        `💥 <strong>Zerbrechlich:</strong> ${summary.shatteredItems.join(', ')} ist beim Not-Teleport zerbrochen.`,
      );
    }
    if (!summary.victory) {
      extraNotes.push(
        'Dein Frachtraum ging verloren, aber die geschützten Gürtel-Slots blieben sicher erhalten.',
      );
    }

    this.showModalHtml(`
      <div class="modal-window" style="max-width:520px">
        <div class="modal-header">
          <span class="modal-title" style="color:${titleColor}">${title}</span>
          <button id="modal-close-btn" class="modal-close">ESC ✕</button>
        </div>
        <div class="modal-body">
          <div class="summary-grid">
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Räume gesäubert</div>
              <div class="val">${summary.roomsCleared}</div>
            </div>
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Gegner besiegt</div>
              <div class="val">${summary.enemiesDefeated}</div>
            </div>
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Relikte geborgen</div>
              <div class="val" style="color:var(--accent-emerald)">${summary.itemsSaved}</div>
            </div>
            <div class="summary-stat">
              <div style="font-size:11px;color:var(--text-muted)">Fracht verloren</div>
              <div class="val" style="color:${summary.itemsLost > 0 ? 'var(--accent-coral)' : 'var(--text-muted)'}">${summary.itemsLost}</div>
            </div>
          </div>
          ${
            extraNotes.length > 0
              ? `<div class="modifier-box" style="display:flex;flex-direction:column;gap:5px">${extraNotes.map((n) => `<div>${n}</div>`).join('')}</div>`
              : ''
          }
          <button id="btn-summary-ok" class="btn btn-primary" style="width:100%">Zurück in den Space-Shop</button>
        </div>
      </div>
    `);

    this.modalEl.querySelector('#btn-summary-ok')?.addEventListener('click', () => {
      sound.playUiClick();
      this.closeModal();
    });
  }
}
