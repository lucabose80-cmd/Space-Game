import { getHDArt } from '../assets/artLoader';
import { MARKET_EVENT_META } from '../data/companions';
import {
  ALCHEMY_BUFFS,
  ALCHEMY_BUFF_ORDER,
  getPatronTierLabel,
  MAX_ACTIVE_BANK_INVESTMENTS,
  PATRON_DEFS,
  PATRON_ORDER,
  PATRON_XP_THRESHOLDS,
  TRADE_ROUTES,
  TRADE_ROUTE_ORDER,
} from '../data/guildMarket';
import { getItemDef, RARITY_META } from '../data/items';
import { sound } from '../engine/audio';
import type { GameState } from '../systems/gameState';
import {
  applyHaggleAction,
  createHaggleSession,
  getHaggleOptions,
  type HaggleAction,
  type HaggleSession,
} from '../systems/haggle';
import { countItemTotal } from '../systems/inventory';
import type { AlchemyBuffId, HagglePayload, PatronId, ShiftSummary, TradeRouteId } from '../types';

export interface MarketModalHost {
  state: GameState;
  modalEl: HTMLElement;
  showModalHtml: (html: string) => void;
  closeModal: () => void;
  renderHud: () => void;
  toast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
  openBountiesModal: () => void;
}

// ==================== 1. TAGESBILANZ / SCHICHT-ABSCHLUSSKARTE ====================
export function renderShiftSummaryModal(host: MarketModalHost, summary: ShiftSummary): void {
  const evMeta = MARKET_EVENT_META[summary.nextMarketEvent];
  const phaseTitle = summary.newDay
    ? `☀ TAG ${summary.nextDay} BEGINNT`
    : `🌙 NACHT ${summary.nextDay} BRICHT AN (+35 % RAR-LOOT)`;
  const patronBadges =
    summary.patronVisits.length > 0
      ? summary.patronVisits
          .map((pid) => {
            const p = PATRON_DEFS[pid];
            return `<span class="m8-pill" style="border-color:${p.accentColor};color:${p.accentColor}">${p.shortTag} ${p.name}</span>`;
          })
          .join('')
      : `<span style="color:var(--text-muted);font-size:12px">Keine Stammkunden in dieser Schicht.</span>`;

  host.showModalHtml(`
    <div class="modal-window" style="max-width:560px">
      <div class="modal-header">
        <span class="modal-title">📊 SCHICHT-BILANZ · ASTRO-BARTER</span>
        <button id="modal-close-btn" class="modal-close">ESC ✕</button>
      </div>
      <div class="modal-body">
        <div class="m8-shift-banner">
          <div style="font-family:var(--font-pixel);font-size:12px;color:${summary.newDay ? 'var(--accent-amber)' : '#a5b4fc'}">
            ${phaseTitle}
          </div>
          ${
            summary.newDay && summary.nextMarketEvent !== 'normal'
              ? `<div style="font-size:12px;color:${evMeta.color};margin-top:4px">★ Tages-Event: <strong>${evMeta.name}</strong> — ${evMeta.description}</div>`
              : ''
          }
          ${
            summary.maturedBankCount > 0
              ? `<div style="font-size:12px;color:#4ade80;margin-top:4px">🏦 ${summary.maturedBankCount} Handelsroute(n) abgeschlossen! Auf der Marktplatz-Terrasse auszahlbar.</div>`
              : ''
          }
        </div>

        <div class="m8-stat-grid">
          <div class="m8-stat-card">
            <span class="m8-stat-label">VERKAUFTE RELIKTE</span>
            <strong class="m8-stat-val" style="color:#38e8d4">${summary.itemsSold}×</strong>
          </div>
          <div class="m8-stat-card">
            <span class="m8-stat-label">SCHICHT-UMSATZ</span>
            <strong class="m8-stat-val" style="color:#fde047">+${summary.totalCredits} CR</strong>
          </div>
          <div class="m8-stat-card">
            <span class="m8-stat-label">FEILSCH-ERFOLGE</span>
            <strong class="m8-stat-val" style="color:#4ade80">${summary.haggleWins} (+${summary.haggleBonusCredits} Cr)</strong>
          </div>
          <div class="m8-stat-card">
            <span class="m8-stat-label">VIP / DIEBE</span>
            <strong class="m8-stat-val" style="color:#fbbf24">${summary.vipSales} VIP · ${summary.thievesCaught}🚨</strong>
          </div>
        </div>

        ${
          summary.topItemName
            ? `<div class="modifier-box" style="border-left-color:#fbbf24;background:rgba(251,191,36,0.08);color:#fef3c7">
                 ★ Top-Verkauf: <strong>${summary.topItemName}</strong> für <strong>${summary.topItemPrice} Cr</strong>
                 ${summary.saleBoxCredits > 0 ? ` · Sale-Box: +${summary.saleBoxCredits} Cr` : ''}
               </div>`
            : ''
        }

        <div style="margin-top:8px">
          <div class="section-label"><span>STAMMKUNDEN-BESUCHE</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${patronBadges}</div>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:14px">
          <button id="btn-shift-ok" class="btn btn-amber">Weiter →</button>
        </div>
      </div>
    </div>
  `);

  host.modalEl.querySelector('#btn-shift-ok')?.addEventListener('click', () => {
    sound.playUiClick();
    host.closeModal();
  });
}

// ==================== 2. VERHANDLUNGS-SYSTEM („FEILSCHEN“) ====================
export function renderHaggleModal(
  host: MarketModalHost,
  payload: HagglePayload,
  onComplete: (result: { accepted: boolean; finalPrice: number; bonusCredits: number }) => void,
): void {
  const itemDef = getItemDef(payload.itemId);
  const patronTier = payload.patronId ? (host.state.patronProgress[payload.patronId]?.tier ?? 0) : 0;
  const hasHoloGlobe = Boolean(host.state.patronProgress?.tala?.decoUnlocked);

  const session: HaggleSession = createHaggleSession({
    customerId: payload.customerId,
    customerTitle: payload.customerTitle,
    patronId: payload.patronId,
    patronTier,
    isVip: payload.isVip,
    itemId: payload.itemId,
    itemName: itemDef.name,
    rarity: itemDef.rarity,
    basePrice: payload.basePrice,
    hasHoloGlobeDeco: hasHoloGlobe,
  });

  const draw = () => {
    const art = getHDArt();
    const rarity = RARITY_META[itemDef.rarity];
    const options = getHaggleOptions(session);
    const patienceColor =
      session.patience > 55 ? '#4ade80' : session.patience > 25 ? '#fbbf24' : '#f87171';
    const bonusNow = Math.max(0, session.currentOffer - session.basePrice);

    const actionsHtml =
      session.status === 'active'
        ? options
            .map((opt) => {
              const cls =
                opt.action === 'accept'
                  ? 'btn btn-emerald'
                  : opt.action === 'gentle'
                    ? 'btn btn-cyan'
                    : opt.action === 'bold'
                      ? 'btn btn-amber'
                      : 'btn btn-danger';
              const sub =
                opt.action === 'accept'
                  ? '100 % sicher'
                  : `${opt.targetPrice} Cr (+${opt.bonusPct} %) · Chance ${opt.successChance} %`;
              return `
                <button class="${cls} m8-haggle-btn" data-haggle-action="${opt.action}">
                  <span>${opt.label}</span>
                  <small>${sub}</small>
                </button>
              `;
            })
            .join('')
        : `
          <div style="grid-column:1 / -1;display:flex;justify-content:center;margin-top:6px">
            <button id="btn-haggle-finish" class="btn ${session.status === 'accepted' ? 'btn-amber' : 'btn-danger'}" style="min-width:220px">
              ${
                session.status === 'accepted'
                  ? `✓ Kassieren (+${session.currentOffer} Cr)`
                  : '✕ Abgebrochen (Item sicher in Truhe)'
              }
            </button>
          </div>
        `;

    host.showModalHtml(`
      <div class="modal-window" style="max-width:560px">
        <div class="modal-header">
          <span class="modal-title">🤝 VERHANDLUNG · RUNDE ${session.round}/${session.maxRounds}</span>
          <span style="font-family:var(--font-pixel);font-size:10px;color:${rarity.color}">${rarity.label}</span>
        </div>
        <div class="modal-body">
          <div class="m8-haggle-top">
            <div class="inspector-icon-wrap" style="width:52px;height:52px">
              <img class="pixel-icon" src="${art.itemUrls[payload.itemId]}" alt="${itemDef.name}" />
            </div>
            <div style="flex:1">
              <div style="font-family:var(--font-pixel);font-size:12px;color:#fff">${payload.customerTitle}</div>
              <div style="font-size:12px;color:${rarity.color};margin-top:2px">${itemDef.name}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                Basis: ${session.basePrice} Cr · Aktuelles Gebot: <strong style="color:#fde047">${session.currentOffer} Cr</strong>
                ${bonusNow > 0 ? `<span style="color:#4ade80"> (+${bonusNow} Cr)</span>` : ''}
                ${hasHoloGlobe ? ` · <span style="color:#38e8d4">🌐 Globus +6 %</span>` : ''}
              </div>
            </div>
          </div>

          <div class="m8-patience-wrap">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
              <span>KUNDEN-GEDULD</span>
              <strong style="color:${patienceColor}">${session.patience} %</strong>
            </div>
            <div class="m8-bar-track">
              <div class="m8-bar-fill" style="width:${session.patience}%;background:${patienceColor}"></div>
            </div>
          </div>

          <div class="m8-dialogue-box">${session.dialogue}</div>

          <div class="m8-haggle-grid">${actionsHtml}</div>
        </div>
      </div>
    `);

    // Prevent accidental ESC abort while negotiating: ESC acts as safe "Accept" if active, or closes if finished
    host.modalEl.querySelectorAll<HTMLElement>('[data-haggle-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.haggleAction as HaggleAction;
        const prevOffer = session.currentOffer;
        applyHaggleAction(session, action);
        if (session.status === 'accepted') {
          sound.playRegister();
          // Immediately complete if user clicked "accept" directly
          if (action === 'accept') {
            host.closeModal();
            onComplete({
              accepted: true,
              finalPrice: session.currentOffer,
              bonusCredits: Math.max(0, session.currentOffer - session.basePrice),
            });
            return;
          }
        } else if (session.status === 'rejected') {
          sound.playReaction('outrageous');
        } else if (session.currentOffer > prevOffer) {
          sound.playReaction('fair');
        } else {
          sound.playReaction('expensive');
        }
        draw();
      });
    });

    host.modalEl.querySelector('#btn-haggle-finish')?.addEventListener('click', () => {
      sound.playUiClick();
      host.closeModal();
      onComplete({
        accepted: session.status === 'accepted',
        finalPrice: session.currentOffer,
        bonusCredits: session.status === 'accepted' ? Math.max(0, session.currentOffer - session.basePrice) : 0,
      });
    });
  };

  draw();
}

// ==================== 3. STAMMKUNDEN-RUF, DEKO & GROSSAUFTRÄGE ====================
export function renderPatronsModal(host: MarketModalHost, showBountiesTab = true): void {
  const art = getHDArt();

  const cardsHtml = PATRON_ORDER.map((pid: PatronId) => {
    const def = PATRON_DEFS[pid];
    const prog = host.state.patronProgress[pid];
    const nextThreshold =
      prog.tier < 3 ? PATRON_XP_THRESHOLDS[prog.tier + 1] : PATRON_XP_THRESHOLDS[3];
    const prevThreshold = PATRON_XP_THRESHOLDS[prog.tier];
    const pct =
      prog.tier >= 3
        ? 100
        : Math.min(100, Math.round(((prog.xp - prevThreshold) / Math.max(1, nextThreshold - prevThreshold)) * 100));

    const order = def.bigOrder;
    const canDeliver = host.state.canCompleteBigOrder(pid);
    const reqPills = order.items
      .map((req) => {
        const idef = getItemDef(req.itemId);
        const owned = countItemTotal(host.state.inventory, req.itemId);
        const ok = owned >= req.qty || prog.bigOrderCompleted;
        return `<span class="mat-pill ${ok ? 'ok' : 'missing'}">${idef.name}: ${owned}/${req.qty}</span>`;
      })
      .join('');

    const orderSection =
      prog.tier < 3
        ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">🔒 Großauftrag wird ab <strong>Rufstufe 3</strong> freigeschaltet.</div>`
        : prog.bigOrderCompleted
          ? `<div style="font-size:11px;color:#4ade80;margin-top:6px">✓ Großauftrag erledigt! Permanenter Bonus aktiv: <strong>${def.tier3PerkText}</strong></div>`
          : `
            <div class="m8-bigorder-box">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                <div>
                  <div style="font-family:var(--font-pixel);font-size:10px;color:${def.accentColor}">★ GROSSAUFTRAG: ${order.title}</div>
                  <div style="font-size:11px;color:var(--text-muted)">Belohnung: <strong style="color:#fde047">+${order.rewardCredits} Cr</strong> & ${def.tier3PerkText}</div>
                  <div class="mat-list" style="margin-top:4px">${reqPills}</div>
                </div>
                <button class="btn ${canDeliver ? 'btn-amber' : ''} btn-deliver-bigorder" data-patron-id="${pid}" ${canDeliver ? '' : 'disabled'}>
                  Abliefern
                </button>
              </div>
            </div>
          `;

    return `
      <div class="upgrade-card" style="flex-direction:column;align-items:stretch;gap:6px;border-color:${prog.tier >= 3 ? def.accentColor : 'rgba(148,163,184,0.28)'}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div>
            <span style="font-family:var(--font-pixel);font-size:12px;color:${def.accentColor}">${def.shortTag} ${def.name}</span>
            <span style="font-size:11px;color:var(--text-muted);margin-left:6px">${def.role}</span>
          </div>
          <span class="m8-pill" style="border-color:${def.accentColor};color:${def.accentColor}">
            Stufe ${prog.tier}/3 · ${getPatronTierLabel(prog.tier)}
          </span>
        </div>

        <div style="font-size:11px;color:#cbd5e1;font-style:italic">${def.greetings[prog.tier]}</div>

        <div style="display:flex;align-items:center;gap:10px;font-size:11px">
          <span style="min-width:74px;color:var(--text-muted)">Ruf: ${prog.xp}/${nextThreshold}</span>
          <div class="m8-bar-track" style="flex:1">
            <div class="m8-bar-fill" style="width:${pct}%;background:${def.accentColor}"></div>
          </div>
          <span style="color:var(--text-muted)">Besuche: ${prog.visits}</span>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px">
          <span class="mat-pill ok" style="border-color:rgba(56,232,212,0.4);color:#a5f3fc">Vorliebe: ${def.favoriteLabel}</span>
          <span class="mat-pill ${prog.decoUnlocked ? 'ok' : 'missing'}">
            ${prog.decoUnlocked ? '✓ Deko aktiv' : 'Stufe 2 Deko'}: ${def.decoName} (${def.decoBonusText})
          </span>
        </div>

        ${orderSection}
      </div>
    `;
  }).join('');

  const tabBar = showBountiesTab
    ? `
      <div class="modal-tabs" style="margin-bottom:10px">
        <button class="tab-btn" id="tab-goto-bounties">📋 Tages-Aufträge</button>
        <button class="tab-btn active">🏛️ Stammkunden & Großaufträge</button>
      </div>
    `
    : '';

  // Keep art referenced cleanly if we later show portraits
  void art;

  host.showModalHtml(`
    <div class="modal-window" style="max-width:700px">
      <div class="modal-header">
        <span class="modal-title">🏛️ HÄNDLER-GILDE · STAMMKUNDEN & RUF</span>
        <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${host.state.credits} CR</span>
        <button id="modal-close-btn" class="modal-close">ESC ✕</button>
      </div>
      <div class="modal-body">
        ${tabBar}
        <div class="modifier-box" style="border-left-color:#fbbf24;background:rgba(251,191,36,0.08);color:#fef3c7;margin-bottom:10px">
          ★ Stammkunden besuchen deinen Laden <strong>Astro-Barter</strong>! Verkaufe ihnen Relikte (besonders ihre Vorlieben), um Ruf, <strong>exklusive Shop-Deko (Stufe 2)</strong> & <strong>Großaufträge (Stufe 3)</strong> freizuschalten.
        </div>
        <div class="upgrade-list">${cardsHtml}</div>
      </div>
    </div>
  `);

  host.modalEl.querySelector('#tab-goto-bounties')?.addEventListener('click', () => {
    sound.playUiClick();
    host.openBountiesModal();
  });

  host.modalEl.querySelectorAll<HTMLElement>('.btn-deliver-bigorder').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.patronId as PatronId;
      const res = host.state.completeBigOrder(pid);
      if (res.ok) {
        sound.playCompanionUnlock();
        host.toast(
          `🏛️ Großauftrag für ${res.patronName} geliefert! +${res.rewardCredits} Cr & permanenter Gilden-Bonus aktiv!`,
          'good',
        );
        host.renderHud();
        renderPatronsModal(host, showBountiesTab);
      }
    });
  });
}

// ==================== 4. MILO'S ALCHEMIE-BAR (RUN-BUFFS) ====================
export function renderAlchemyBarModal(host: MarketModalHost): void {
  const activeId = host.state.activeAlchemyBuff;
  const activeDef = activeId ? ALCHEMY_BUFFS[activeId] : null;

  const cardsHtml = ALCHEMY_BUFF_ORDER.map((bid: AlchemyBuffId) => {
    const def = ALCHEMY_BUFFS[bid];
    const isActive = activeId === bid;
    const canBrew = host.state.canBrewAlchemyBuff(bid);

    const matPills = def.materials
      .map((m) => {
        const idef = getItemDef(m.itemId);
        const owned = countItemTotal(host.state.inventory, m.itemId);
        return `<span class="mat-pill ${owned >= m.qty ? 'ok' : 'missing'}">${idef.name}: ${owned}/${m.qty}</span>`;
      })
      .join('');

    return `
      <div class="upgrade-card" style="${isActive ? `border-color:${def.color};background:rgba(16,42,42,0.5)` : ''}">
        <div class="upgrade-left">
          <div class="inspector-icon-wrap" style="font-size:22px;display:flex;align-items:center;justify-content:center;border-color:${def.color}">
            ${def.icon}
          </div>
          <div>
            <div style="font-family:var(--font-pixel);font-size:11px;color:${def.color}">
              ${def.name} ${isActive ? '· AKTIV' : ''}
            </div>
            <div style="font-size:12px;color:#e2e8f0;margin-top:2px">${def.effectSummary}</div>
            <div class="mat-list" style="margin-top:4px">
              <span class="mat-pill ${host.state.credits >= def.creditCost ? 'ok' : 'missing'}">${def.creditCost} Cr</span>
              ${matPills}
            </div>
          </div>
        </div>
        ${
          isActive
            ? `<span class="rarity-badge" style="color:${def.color}">✓ BEREIT</span>`
            : `<button class="btn ${canBrew ? 'btn-amber' : ''} btn-brew-buff" data-buff-id="${bid}" ${canBrew ? '' : 'disabled'}>
                 Brauen
               </button>`
        }
      </div>
    `;
  }).join('');

  host.showModalHtml(`
    <div class="modal-window" style="max-width:680px">
      <div class="modal-header">
        <span class="modal-title">🧪 MILO'S ALCHEMIE-BAR · EXPEDITIONS-ELIXIERE</span>
        <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${host.state.credits} CR</span>
        <button id="modal-close-btn" class="modal-close">ESC ✕</button>
      </div>
      <div class="modal-body">
        <div class="modifier-box" style="border-left-color:#34d399;background:rgba(52,211,153,0.09);color:#d1fae5;margin-bottom:10px">
          ${
            activeDef
              ? `Aktives Elixier für deine nächste Expedition: <strong style="color:${activeDef.color}">${activeDef.icon} ${activeDef.name}</strong> (${activeDef.effectSummary}).`
              : `Milo braut aus überschüssigen Sektor-Materialien starke <strong>Run-Buffs</strong> für deine nächste Expedition (1 Elixier gleichzeitig aktiv).`
          }
        </div>
        <div class="upgrade-list">${cardsHtml}</div>
      </div>
    </div>
  `);

  host.modalEl.querySelectorAll<HTMLElement>('.btn-brew-buff').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bid = btn.dataset.buffId as AlchemyBuffId;
      const res = host.state.brewAlchemyBuff(bid);
      if (res.ok) {
        sound.playUpgrade();
        host.toast(`🧪 ${res.buffName} gebraut! Aktiv für deine nächste Sektor-Expedition!`, 'good');
        host.renderHud();
        renderAlchemyBarModal(host);
      } else if (res.reason) {
        sound.playReaction('expensive');
        host.toast(res.reason, 'warn');
      }
    });
  });
}

// ==================== 5. SOLARIS-HANDELSBANK (HANDELSROUTEN) ====================
export function renderTradeBankModal(host: MarketModalHost): void {
  const talaBonus = Boolean(host.state.patronProgress?.tala?.bigOrderCompleted);

  const activeHtml =
    host.state.bankInvestments.length > 0
      ? host.state.bankInvestments
          .map((inv) => {
            const def = TRADE_ROUTES[inv.routeId];
            const matured = inv.maturedPayout !== null;
            const doneCycles = inv.cyclesTotal - inv.cyclesRemaining;
            const pct = Math.min(100, Math.round((doneCycles / Math.max(1, inv.cyclesTotal)) * 100));

            return `
              <div class="upgrade-card" style="${matured ? 'border-color:#4ade80;background:rgba(16,46,36,0.55)' : ''}">
                <div class="upgrade-left" style="flex:1">
                  <div class="inspector-icon-wrap" style="font-size:20px;display:flex;align-items:center;justify-content:center;border-color:${def.color}">
                    ${def.icon}
                  </div>
                  <div style="flex:1">
                    <div style="font-family:var(--font-pixel);font-size:11px;color:${def.color}">${def.name}</div>
                    <div style="font-size:12px;color:#e2e8f0">
                      Einsatz: <strong>${inv.principal} Cr</strong>
                      ${
                        matured
                          ? ` → <strong style="color:#4ade80">${inv.maturedPayout} Cr</strong> (${inv.outcomeLabel ?? 'Abgeschlossen'})`
                          : ` · Noch <strong>${inv.cyclesRemaining}</strong> von ${inv.cyclesTotal} Tag/Nacht-Zyklen`
                      }
                    </div>
                    <div class="m8-bar-track" style="margin-top:5px">
                      <div class="m8-bar-fill" style="width:${pct}%;background:${matured ? '#4ade80' : def.color}"></div>
                    </div>
                  </div>
                </div>
                ${
                  matured
                    ? `<button class="btn btn-amber btn-claim-inv" data-inv-id="${inv.id}">Auszahlen (+${inv.maturedPayout} Cr)</button>`
                    : `<span class="rarity-badge" style="color:${def.color}">UNTERWEGS</span>`
                }
              </div>
            `;
          })
          .join('')
      : `<div style="padding:10px;font-size:12px;color:var(--text-muted);text-align:center">Keine aktiven Handelsrouten. Investiere unten in eine Route!</div>`;

  const routesHtml = TRADE_ROUTE_ORDER.map((rid: TradeRouteId) => {
    const def = TRADE_ROUTES[rid];
    const unlocked = host.state.isTradeRouteUnlocked(rid);
    const canInvest = host.state.canInvestTradeRoute(rid);
    const minPct = Math.round((def.minReturnMult - 1 + (talaBonus ? 0.05 : 0)) * 100);
    const maxPct = Math.round((def.maxReturnMult - 1 + (talaBonus ? 0.05 : 0)) * 100);

    return `
      <div class="upgrade-card" style="${!unlocked ? 'opacity:0.55' : ''}">
        <div class="upgrade-left">
          <div class="inspector-icon-wrap" style="font-size:20px;display:flex;align-items:center;justify-content:center;border-color:${def.color}">
            ${def.icon}
          </div>
          <div>
            <div style="font-family:var(--font-pixel);font-size:11px;color:${def.color}">${def.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${def.description}</div>
            <div class="mat-list" style="margin-top:4px">
              <span class="mat-pill ${host.state.credits >= def.principal ? 'ok' : 'missing'}">Einsatz: ${def.principal} Cr</span>
              <span class="mat-pill ok" style="color:#4ade80;border-color:rgba(74,222,128,0.45)">Rendite: +${minPct} % bis +${maxPct} %</span>
              <span class="mat-pill ok">Dauer: ${def.cycles} Zyklen</span>
            </div>
            ${!unlocked ? `<div style="font-size:11px;color:#fb923c;margin-top:3px">🔒 ${def.unlockRequirementText}</div>` : ''}
          </div>
        </div>
        <button class="btn ${canInvest ? 'btn-amber' : ''} btn-start-route" data-route-id="${rid}" ${canInvest ? '' : 'disabled'}>
          Investieren
        </button>
      </div>
    `;
  }).join('');

  host.showModalHtml(`
    <div class="modal-window" style="max-width:700px">
      <div class="modal-header">
        <span class="modal-title">🏦 SOLARIS-HANDELSBANK · HANDELSROUTEN</span>
        <span style="font-family:var(--font-pixel);font-size:11px;color:var(--accent-amber)">${host.state.credits} CR</span>
        <button id="modal-close-btn" class="modal-close">ESC ✕</button>
      </div>
      <div class="modal-body">
        <div class="modifier-box" style="border-left-color:#fbbf24;background:rgba(251,191,36,0.08);color:#fef3c7;margin-bottom:10px">
          ★ Investiere Credits in Handelskarawanen (max. <strong>${MAX_ACTIVE_BANK_INVESTMENTS}</strong> gleichzeitig). Jeder Tag↔Nacht-Wechsel (Ruhekoje oder Schichtende) bringt deine Schiffe 1 Zyklus weiter!
          ${talaBonus ? `<br/><strong style="color:#4ade80">✓ Ingenieurin Tala Bonus aktiv: +5 % Extra-Rendite auf alle Routen!</strong>` : ''}
        </div>

        <div class="section-label"><span>AKTIVE ROUTEN (${host.state.bankInvestments.length}/${MAX_ACTIVE_BANK_INVESTMENTS})</span></div>
        <div class="upgrade-list" style="margin-bottom:12px">${activeHtml}</div>

        <div class="section-label"><span>VERFÜGBARE HANDELSROUTEN</span></div>
        <div class="upgrade-list">${routesHtml}</div>
      </div>
    </div>
  `);

  host.modalEl.querySelectorAll<HTMLElement>('.btn-start-route').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rid = btn.dataset.routeId as TradeRouteId;
      const res = host.state.startBankInvestment(rid);
      if (res.ok) {
        sound.playRegister();
        host.toast(`🏦 Investition in ${TRADE_ROUTES[rid].name} gestartet!`, 'good');
        host.renderHud();
        renderTradeBankModal(host);
      } else if (res.reason) {
        sound.playReaction('expensive');
        host.toast(res.reason, 'warn');
      }
    });
  });

  host.modalEl.querySelectorAll<HTMLElement>('.btn-claim-inv').forEach((btn) => {
    btn.addEventListener('click', () => {
      const invId = btn.dataset.invId!;
      const res = host.state.claimBankInvestment(invId);
      if (res.ok) {
        sound.playVipChime();
        host.toast(
          `🏦 ${res.routeName} ausgezahlt: +${res.payout} Cr (Gewinn: +${res.profit} Cr)!`,
          'good',
        );
        host.renderHud();
        renderTradeBankModal(host);
      }
    });
  });
}
