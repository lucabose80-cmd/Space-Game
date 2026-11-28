import { getHDArt } from '../assets/artLoader';
import { sound } from '../engine/audio';
import { firebaseService } from '../services/firebaseService';
import { GameState as GS, SAVE_SLOTS } from '../systems/gameState';
import type { GameState, SaveSlot } from '../systems/gameState';

export interface TitleScreenCallbacks {
  onStartNewGame: () => void;
  onContinueGame: () => void;
  /** Spielstand-Slot wurde gewechselt (State ist schon umgeschaltet). */
  onSlotChanged: () => void;
  onHideTitle: () => void;
  onMuteToggle: () => void;
  onToast: (msg: string, tone?: 'info' | 'good' | 'warn') => void;
}

const planetUrlCache = new Map<string, string>();
/** Data-URL eines geladenen Planeten-Sprites (P3-56…59) oder null → CSS-Fallback. */
function planetUrl(key: 'titlePlanet1' | 'titlePlanet2' | 'titlePlanet3' | 'titlePlanetEmpty'): string | null {
  const hit = planetUrlCache.get(key);
  if (hit) return hit;
  const c = getHDArt()[key];
  if (!c) return null;
  try {
    const u = c.toDataURL('image/png');
    planetUrlCache.set(key, u);
    return u;
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Startscreen-Controller für `#title-overlay`.
 * Liegt transparent über dem animierten `TitleBackdrop`-Canvas und bietet:
 * - Atmosphärische Welt-Vorschau (Kapitän, Tag/Nacht, Credits, Sektoren, NG+)
 * - Direktes Cloud-Konto-Panel (Google-Login, E-Mail-Login, Konto erstellen, Sync)
 * - Sicherheitsabfrage vor dem Überschreiben eines Spielstands
 * - Weiche Ausblende-Übergänge in `intro_arrival` (Neues Spiel) bzw. `ContinueIntroCutscene` (Weiterspielen)
 */
export class TitleScreen {
  private el: HTMLElement;
  private state: GameState;
  private cb: TitleScreenCallbacks;

  private accountOpen = false;
  private controlsOpen = false;
  private confirmNewGame = false;
  private confirmClear = false;
  private authMode: 'login' | 'register' = 'login';
  private authBusy = false;
  private authFeedback: { text: string; tone: 'info' | 'good' | 'warn' } | null = null;
  private exiting = false;

  constructor(el: HTMLElement, state: GameState, cb: TitleScreenCallbacks) {
    this.el = el;
    this.state = state;
    this.cb = cb;
  }

  public show(): void {
    this.exiting = false;
    this.confirmNewGame = false;
    this.confirmClear = false;
    this.el.classList.remove('hidden', 'title-exiting');
    this.render();
  }

  public hide(): void {
    this.exiting = false;
    this.accountOpen = false;
    this.controlsOpen = false;
    this.confirmNewGame = false;
    this.el.classList.remove('title-exiting');
    this.el.classList.add('hidden');
  }

  public refresh(): void {
    if (this.el.classList.contains('hidden') || this.exiting) return;
    this.render();
  }

  private transitionOut(afterFade: () => void): void {
    if (this.exiting) return;
    this.exiting = true;
    this.el.classList.add('title-exiting');
    window.setTimeout(() => {
      this.cb.onHideTitle();
      afterFade();
    }, 300);
  }

  private renderSectorGems(): string {
    const sectors = [
      { done: this.state.sector1Cleared, label: 'Sektor I · Wrack-Korvette', color: '#38e8d4' },
      { done: this.state.sector2Cleared, label: 'Sektor II · Kristall-Nebel', color: '#c084fc' },
      { done: this.state.sector3Cleared, label: 'Sektor III · Sonnenschmiede', color: '#fb923c' },
      { done: this.state.sector4Cleared, label: 'Sektor IV · Sternen-Archiv', color: '#facc15' },
      { done: this.state.omegaCleared, label: '5. Tor · Omega-Anomalie', color: '#f472b6' },
    ];
    return sectors
      .map(
        (s) =>
          `<span class="ts-gem ${s.done ? 'on' : ''}" style="--gem-color:${s.color}" title="${s.label}"></span>`,
      )
      .join('');
  }

  private renderAccountDrawer(): string {
    if (!this.accountOpen) return '';
    const user = firebaseService.currentUser;
    const feedbackHtml = this.authFeedback
      ? `<div class="ts-auth-feedback ${this.authFeedback.tone}">${escapeHtml(this.authFeedback.text)}</div>`
      : '';

    if (user) {
      const syncLabel =
        firebaseService.syncStatus === 'syncing'
          ? 'Synchronisiert…'
          : firebaseService.syncStatus === 'synced'
            ? 'Cloud-Stand aktuell'
            : firebaseService.syncStatus === 'error'
              ? 'Sync-Fehler'
              : 'Verbunden';
      return `
        <aside class="ts-account-drawer" role="region" aria-label="Cloud-Konto">
          <div class="ts-drawer-head">
            <span class="ts-drawer-title">☁ KAPITÄNS-KONTO</span>
            <button id="btn-title-account-close" class="ts-icon-close" type="button" aria-label="Schließen">✕</button>
          </div>
          <div class="ts-user-box">
            <div class="ts-user-avatar">${escapeHtml(user.displayName.charAt(0).toUpperCase())}</div>
            <div class="ts-user-meta">
              <div class="ts-user-name">${escapeHtml(user.displayName)}</div>
              <div class="ts-user-sub">${escapeHtml(user.email ?? (user.isGoogle ? 'Google-Konto' : 'Cloud-Konto'))}</div>
              <div class="ts-sync-pill ${firebaseService.syncStatus}">● ${syncLabel}</div>
            </div>
          </div>
          ${feedbackHtml}
          <div class="ts-user-sub">Alle 3 Slots liegen in der Cloud (Bestenliste &amp; Wochen-Prüfung nur Slot 1).</div>
          <div class="ts-drawer-actions">
            <button id="btn-title-cloud-load" class="btn btn-sm" type="button" ${this.authBusy ? 'disabled' : ''}>⬇ Cloud-Stand laden</button>
            <button id="btn-title-cloud-save" class="btn btn-sm" type="button" ${this.authBusy || !this.state.hasSave() ? 'disabled' : ''}>⬆ Jetzt sichern</button>
          </div>
          <button id="btn-title-logout" class="btn btn-sm btn-danger ts-full-btn" type="button" ${this.authBusy ? 'disabled' : ''}>Abmelden</button>
        </aside>
      `;
    }

    const isReg = this.authMode === 'register';
    const defaultCap =
      this.state.captainName && this.state.captainName !== 'Sternen-Kapitän' ? this.state.captainName : '';

    return `
      <aside class="ts-account-drawer" role="region" aria-label="Konto verbinden oder erstellen">
        <div class="ts-drawer-head">
          <span class="ts-drawer-title">☁ CLOUD-KONTO &amp; SYNC</span>
          <button id="btn-title-account-close" class="ts-icon-close" type="button" aria-label="Schließen">✕</button>
        </div>
        <p class="ts-drawer-hint">
          Verknüpfe ein Konto, um deinen Spielstand nahtlos zwischen PC &amp; Handy zu synchronisieren.
        </p>

        <button id="btn-title-google" class="btn btn-primary ts-full-btn ts-google-btn" type="button" ${this.authBusy ? 'disabled' : ''}>
          G · Mit Google anmelden
        </button>

        <div class="ts-divider"><span>oder per E-Mail</span></div>

        <div class="ts-auth-tabs" role="tablist">
          <button type="button" class="ts-tab ${!isReg ? 'active' : ''}" data-ts-authmode="login">Anmelden</button>
          <button type="button" class="ts-tab ${isReg ? 'active' : ''}" data-ts-authmode="register">Konto erstellen</button>
        </div>

        <form id="form-title-auth" class="ts-auth-form" autocomplete="on">
          ${
            isReg
              ? `<input id="input-ts-captain" class="ts-input" type="text" maxlength="22" placeholder="Kapitäns-Name (z. B. Nova)" value="${escapeHtml(defaultCap)}" />`
              : ''
          }
          <input id="input-ts-email" class="ts-input" type="email" autocomplete="email" placeholder="E-Mail-Adresse" required />
          <input id="input-ts-pass" class="ts-input" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="6" placeholder="Passwort (mind. 6 Zeichen)" required />
          ${feedbackHtml}
          <button id="btn-title-email-submit" class="btn btn-amber ts-full-btn" type="submit" ${this.authBusy ? 'disabled' : ''}>
            ${this.authBusy ? 'Verbinde…' : isReg ? '✦ Konto erstellen & verknüpfen' : '☁ Mit E-Mail anmelden'}
          </button>
        </form>
      </aside>
    `;
  }

  private render(): void {
    const hasSave = this.state.hasSave();
    const user = firebaseService.currentUser;
    const isNight = this.state.timeOfDay === 'night';
    const ngTag = this.state.ngPlusLevel > 0 ? ` · NG+${this.state.ngPlusLevel}` : '';
    const capName = escapeHtml(this.state.captainName || 'Sternen-Kapitän');
    const muted = this.state.muted;

    const accountPillText = user
      ? `<span class="ts-dot on"></span>☁ ${escapeHtml(user.displayName)}`
      : `<span class="ts-dot"></span>☁ Konto verbinden / erstellen`;

    const saveCardHtml = hasSave
      ? `
        <div class="ts-save-card">
          <div class="ts-save-row">
            <span class="ts-save-cap">★ ${capName}</span>
            <span class="ts-save-day ${isNight ? 'night' : 'day'}">
              ${isNight ? '🌙' : '☀'} Tag ${this.state.day}${ngTag}
            </span>
          </div>
          <div class="ts-save-meta">
            <span>💰 ${this.state.credits.toLocaleString('de-DE')} Cr</span>
            <span class="ts-gems-wrap" title="Befreite Sektoren">${this.renderSectorGems()}</span>
            ${user ? '<span class="ts-cloud-tag">☁ Cloud</span>' : ''}
          </div>
        </div>
      `
      : '';

    const slot = this.state.activeSlot;
    // Slots als „Sternbild“ im Hintergrund: jeder Slot ist ein anklickbarer Planet (leer = blasser Stern)
    const planetHtml = (n: SaveSlot, filled: boolean): string => {
      const url = planetUrl(filled ? (`titlePlanet${n}` as 'titlePlanet1') : 'titlePlanetEmpty');
      return url
        ? `<span class="ts-planet has-sprite"><img src="${url}" alt="" draggable="false" /></span>`
        : `<span class="ts-planet">${filled ? '' : '✦'}</span>`;
    };
    const constellationHtml = `
      <div class="ts-constellation" role="group" aria-label="Spielstand-Slot wählen">
        <svg class="ts-const-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="64,80 79,70 92,80" /></svg>
        ${SAVE_SLOTS.map((n) => {
          const pv = GS.peekSlot(n);
          const cap = pv
            ? `<span class="ts-slot-cap">${escapeHtml(pv.captainName)}</span><span class="ts-slot-meta">${pv.isNight ? '🌙' : '☀'} Tag ${pv.day}${pv.ngPlusLevel > 0 ? ` · NG+${pv.ngPlusLevel}` : ''} · ${pv.sectorsCleared}/4 ◆</span>`
            : `<span class="ts-slot-cap">Unentdeckt</span><span class="ts-slot-meta">Neue Welt starten</span>`;
          return `<button class="ts-slot-star s${n} ${pv ? 'filled' : 'empty'} ${n === slot ? 'active' : ''}" data-slot="${n}" type="button" aria-pressed="${n === slot}" aria-label="Slot ${n}">
            ${planetHtml(n, !!pv)}
            <span class="ts-slot-label"><span class="ts-slot-no">SLOT ${n}${user ? ' ☁' : ''}</span>${cap}</span>
          </button>`;
        }).join('')}
      </div>`;
    const cloudWarn = user ? ` Auch der Cloud-Stand von Slot ${slot} wird dabei überschrieben.` : '';
    const clearHtml = this.confirmClear
      ? `
        <div class="ts-confirm-box">
          <span>Slot ${slot} (Tag ${this.state.day}) endgültig löschen?${user ? ' Auch die Cloud-Kopie wird gelöscht.' : ''}</span>
          <div class="ts-confirm-actions">
            <button id="btn-confirm-clear-yes" class="btn btn-sm btn-danger" type="button">Ja, löschen</button>
            <button id="btn-confirm-clear-no" class="btn btn-sm" type="button">Abbrechen</button>
          </div>
        </div>
      `
      : '';

    const confirmHtml = this.confirmNewGame
      ? `
        <div class="ts-confirm-box">
          <span>Slot ${slot} (Tag ${this.state.day}) wirklich neu starten?${cloudWarn}</span>
          <div class="ts-confirm-actions">
            <button id="btn-confirm-new-yes" class="btn btn-sm btn-danger" type="button">Ja, neu starten</button>
            <button id="btn-confirm-new-no" class="btn btn-sm" type="button">Abbrechen</button>
          </div>
        </div>
      `
      : '';

    const controlsHtml = this.controlsOpen
      ? `
        <div class="ts-controls-pop">
          <div><strong>WASD / Stick</strong> Bewegen</div>
          <div><strong>SPACE / A</strong> Jetpack-Dash</div>
          <div><strong>LMB / J / X</strong> Waffe</div>
          <div><strong>RMB / K / B</strong> Schild / Spezial</div>
          <div><strong>C / RB</strong> Waffe wechseln</div>
          <div><strong>E / Y</strong> Interagieren &amp; Kasse</div>
          <div><strong>I / TAB</strong> Fracht &amp; Logbuch</div>
          <div><strong>E (Teleporter)</strong> Extraktion</div>
        </div>
      `
      : '';

    this.el.innerHTML = `
      <div class="ts-shell">
        <header class="ts-topbar">
          <div class="ts-station-badge">
            <span class="ts-star-pulse">✦</span>
            <span>PORT SOLARIS · ASTRO-BARTER${ngTag}</span>
          </div>
          <div class="ts-top-right">
            <button id="btn-title-account" class="ts-account-pill ${user ? 'connected' : ''} ${this.accountOpen ? 'open' : ''}" type="button">
              ${accountPillText}
            </button>
          </div>
        </header>

        <div class="ts-body">
          <section class="ts-hero">
            <div class="ts-kicker">COZY RETRO-SCI-FI ACTION-RPG &amp; SPACE-SHOP</div>
            <h1 class="ts-logo" aria-label="STARLIGHTER">
              <span class="ts-logo-main">STARLIGHTER</span>
            </h1>
            <p class="ts-tagline">
              Plündere am Tag vergessene Raumschiff-Wracks. Öffne bei Nacht die Pforten von
              <em>Astro-Barter</em> auf Port Solaris.
            </p>

            ${saveCardHtml}

            <div class="ts-actions">
              ${
                hasSave
                  ? `<button id="btn-continue" class="btn btn-primary ts-btn-hero" type="button">▶ Weiterspielen</button>`
                  : ''
              }
              <button id="btn-new-game" class="btn ${hasSave ? 'ts-btn-secondary' : 'btn-primary ts-btn-hero'}" type="button">
                ${hasSave ? '✦ Neues Spiel' : '▶ Expedition starten'}
              </button>
              ${
                hasSave && slot !== 1
                  ? `<button id="btn-slot-clear" class="btn btn-sm ts-btn-secondary" type="button">🗑 Slot leeren</button>`
                  : ''
              }
              ${
                !hasSave && !user
                  ? `<button id="btn-title-quick-account" class="btn ts-btn-secondary" type="button">☁ Konto verknüpfen</button>`
                  : ''
              }
            </div>

            ${confirmHtml}
            ${clearHtml}
          </section>

          ${this.renderAccountDrawer()}
        </div>

        ${constellationHtml}

        <footer class="ts-footer">
          <div class="ts-footer-left">
            <button id="btn-title-controls" class="ts-chip ${this.controlsOpen ? 'active' : ''}" type="button">
              ⌨ Steuerung
            </button>
            <button id="btn-title-mute" class="ts-chip" type="button" title="Ton umschalten">
              ${muted ? '🔇 Ton aus' : '🔊 Ton an'}
            </button>
          </div>
          <div class="ts-footer-right">
            <span>Port Solaris · v1.4</span>
          </div>
          ${controlsHtml}
        </footer>
      </div>
    `;

    this.bindEvents(hasSave);
  }

  private bindEvents(hasSave: boolean): void {
    this.el.querySelectorAll<HTMLButtonElement>('.ts-slot-star').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.slot) as SaveSlot;
        if (n === this.state.activeSlot) return;
        sound.unlock();
        sound.playUiClick();
        this.confirmNewGame = false;
        this.confirmClear = false;
        this.state.switchSlot(n);
        this.cb.onSlotChanged();
        this.render();
      });
    });
    this.el.querySelector('#btn-slot-clear')?.addEventListener('click', () => {
      sound.playUiClick();
      this.confirmClear = true;
      this.confirmNewGame = false;
      this.render();
    });
    this.el.querySelector('#btn-confirm-clear-yes')?.addEventListener('click', () => {
      sound.playUiClick();
      this.state.clearSlot(this.state.activeSlot);
      this.confirmClear = false;
      this.cb.onToast('Slot geleert.', 'info');
      this.render();
    });
    this.el.querySelector('#btn-confirm-clear-no')?.addEventListener('click', () => {
      sound.playUiClick();
      this.confirmClear = false;
      this.render();
    });

    this.el.querySelector('#btn-continue')?.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      this.transitionOut(() => this.cb.onContinueGame());
    });

    this.el.querySelector('#btn-new-game')?.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      if (hasSave && !this.confirmNewGame) {
        this.confirmNewGame = true;
        this.render();
        return;
      }
      this.transitionOut(() => this.cb.onStartNewGame());
    });

    this.el.querySelector('#btn-confirm-new-yes')?.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      this.confirmNewGame = false;
      this.transitionOut(() => this.cb.onStartNewGame());
    });

    this.el.querySelector('#btn-confirm-new-no')?.addEventListener('click', () => {
      sound.playUiClick();
      this.confirmNewGame = false;
      this.render();
    });

    const toggleAccount = () => {
      sound.unlock();
      sound.playUiClick();
      this.accountOpen = !this.accountOpen;
      this.authFeedback = null;
      this.render();
    };
    this.el.querySelector('#btn-title-account')?.addEventListener('click', toggleAccount);
    this.el.querySelector('#btn-title-quick-account')?.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      this.accountOpen = true;
      this.authFeedback = null;
      this.render();
    });
    this.el.querySelector('#btn-title-account-close')?.addEventListener('click', () => {
      sound.playUiClick();
      this.accountOpen = false;
      this.render();
    });

    this.el.querySelector('#btn-title-controls')?.addEventListener('click', () => {
      sound.playUiClick();
      this.controlsOpen = !this.controlsOpen;
      this.render();
    });

    this.el.querySelector('#btn-title-mute')?.addEventListener('click', () => {
      sound.unlock();
      this.cb.onMuteToggle();
      this.render();
    });

    this.el.querySelectorAll<HTMLElement>('[data-ts-authmode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playUiClick();
        this.authMode = (btn.dataset.tsAuthmode as 'login' | 'register') || 'login';
        this.authFeedback = null;
        this.render();
      });
    });

    this.el.querySelector('#btn-title-google')?.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      this.authBusy = true;
      this.authFeedback = { text: 'Öffne Google-Anmeldung…', tone: 'info' };
      this.render();
      void firebaseService.signInWithGoogle().then((res) => {
        this.authBusy = false;
        if (res.ok) {
          this.authFeedback = { text: '☁ Erfolgreich mit Google verbunden!', tone: 'good' };
          this.cb.onToast('☁ Mit Google verbunden — Cloud-Sync aktiv!', 'good');
        } else {
          this.authFeedback = { text: res.error ?? 'Google-Anmeldung fehlgeschlagen.', tone: 'warn' };
        }
        this.render();
      });
    });

    this.el.querySelector('#form-title-auth')?.addEventListener('submit', (e) => {
      e.preventDefault();
      sound.unlock();
      const email = (this.el.querySelector('#input-ts-email') as HTMLInputElement | null)?.value.trim() ?? '';
      const pass = (this.el.querySelector('#input-ts-pass') as HTMLInputElement | null)?.value ?? '';
      const capInput = (this.el.querySelector('#input-ts-captain') as HTMLInputElement | null)?.value.trim() ?? '';

      if (!email || pass.length < 6) {
        this.authFeedback = { text: 'Bitte gültige E-Mail & Passwort (mind. 6 Zeichen) eingeben.', tone: 'warn' };
        this.render();
        return;
      }

      sound.playUiClick();
      this.authBusy = true;
      this.authFeedback = {
        text: this.authMode === 'register' ? 'Erstelle Kapitäns-Konto…' : 'Melde an…',
        tone: 'info',
      };
      this.render();

      const chosenName = capInput || this.state.captainName || email.split('@')[0] || 'Sternen-Kapitän';
      if (this.authMode === 'register' && capInput) {
        this.state.captainName = capInput.slice(0, 22);
      }

      const action =
        this.authMode === 'register'
          ? firebaseService.registerWithEmail(email, pass, chosenName)
          : firebaseService.signInWithEmail(email, pass);

      void action.then((res) => {
        this.authBusy = false;
        if (res.ok) {
          this.authFeedback = {
            text:
              this.authMode === 'register'
                ? '✦ Konto erstellt & mit der Cloud verknüpft!'
                : '☁ Anmeldung erfolgreich — Spielstand wird geprüft!',
            tone: 'good',
          };
          this.cb.onToast('☁ Cloud-Konto verbunden!', 'good');
        } else {
          this.authFeedback = { text: res.error ?? 'Anmeldung fehlgeschlagen.', tone: 'warn' };
        }
        this.render();
      });
    });

    this.el.querySelector('#btn-title-cloud-load')?.addEventListener('click', () => {
      sound.playUiClick();
      this.authBusy = true;
      this.authFeedback = { text: 'Suche Cloud-Spielstand…', tone: 'info' };
      this.render();
      void firebaseService.downloadCloudSave(this.state.activeSlot).then((res) => {
        this.authBusy = false;
        if (res.ok && res.saveJson) {
          const imp = this.state.importSaveJson(res.saveJson);
          if (imp.ok) {
            sound.playUpgrade();
            this.authFeedback = { text: `⬇ Cloud-Stand geladen (Tag ${this.state.day})!`, tone: 'good' };
            this.cb.onToast(`☁ Cloud-Spielstand geladen (Tag ${this.state.day})!`, 'good');
          } else {
            this.authFeedback = { text: imp.error ?? 'Import fehlgeschlagen.', tone: 'warn' };
          }
        } else {
          this.authFeedback = { text: res.error ?? 'Noch kein Cloud-Spielstand vorhanden.', tone: 'warn' };
        }
        this.render();
      });
    });

    this.el.querySelector('#btn-title-cloud-save')?.addEventListener('click', () => {
      sound.playUiClick();
      this.authBusy = true;
      this.authFeedback = { text: 'Sichere Spielstand in der Cloud…', tone: 'info' };
      this.render();
      void firebaseService.syncAllToCloud(this.state).then((res) => {
        this.authBusy = false;
        if (res.ok) {
          sound.playUpgrade();
          this.authFeedback = { text: '☁ Spielstand in der Cloud gesichert!', tone: 'good' };
        } else {
          this.authFeedback = { text: res.error ?? 'Upload fehlgeschlagen.', tone: 'warn' };
        }
        this.render();
      });
    });

    this.el.querySelector('#btn-title-logout')?.addEventListener('click', () => {
      sound.playUiClick();
      this.authBusy = true;
      this.render();
      void firebaseService.signOutUser().then(() => {
        this.authBusy = false;
        this.authFeedback = { text: 'Abgemeldet (lokaler Spielstand bleibt erhalten).', tone: 'info' };
        this.cb.onToast('Vom Cloud-Konto abgemeldet.', 'info');
        this.render();
      });
    });
  }
}
