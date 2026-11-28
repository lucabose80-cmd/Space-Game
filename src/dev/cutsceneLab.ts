import { CUTSCENE_CATALOG, type ReplayableCutsceneId } from '../scenes/StoryPanelCutscene';
import type { UpgradeCutsceneConfig } from '../scenes/UpgradeCutsceneOverlay';
import type { GameState } from '../systems/gameState';
import type { SectorId } from '../types';

export interface CutsceneLabHost {
  state: GameState;
  replayCutscene: (id: ReplayableCutsceneId) => void;
  playUpgradeCutscene: (config: UpgradeCutsceneConfig) => void;
  playApproach: (sector: SectorId) => void;
  playReturn: (mode: 'extract' | 'rescue', sector: SectorId) => void;
  playBackroomWakeup: () => void;
  showPromenade: (chapter: number, minaVisible: boolean) => void;
  isCutsceneActive: () => boolean;
  /** Rolltor-Cutscene beim Laden öffnen/schließen */
  playShift: (mode: 'open' | 'close') => void;
  /** P7b: Dungeon-Szenen — Befreiung (`rescue_<crew>`), `cell_<crew>` (Käfig-Kammer ansehen), `spring_<sektor>` (Heilquelle) */
  playDungeonPreview: (kind: string) => void;
  leaveDungeonPreview: () => void;
}

/**
 * Behelfsmäßiges Cutscene-Teststudio (?cutscenelab in der URL).
 * Sperrt das Speichern (`saveLocked = true`), sodass der echte Spielstand unberührt bleibt,
 * und liest Story-/Feier-Cutscenes automatisch aus `CUTSCENE_CATALOG` (zukunftssicher).
 */
export class CutsceneLab {
  private host: CutsceneLabHost;
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  private toggleBtn: HTMLButtonElement;
  private open = true;
  private minaPreview = true;
  private chapterPreview = 1;
  private hideTimer: number | null = null;

  constructor(host: CutsceneLabHost) {
    this.host = host;
    this.host.state.saveLocked = true;

    this.root = document.createElement('div');
    this.root.id = 'cutscene-lab-root';
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:9000;font-family:var(--font-ui,system-ui,sans-serif);color:#f1f5f9;';

    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = 'btn-cutscene-lab-toggle';
    this.toggleBtn.textContent = '🎬 Cutscene-Studio';
    this.toggleBtn.style.cssText =
      'position:fixed;top:10px;right:10px;pointer-events:auto;padding:6px 11px;border:1px solid #38e8d4;background:rgba(7,13,26,0.94);color:#38e8d4;font-family:var(--font-pixel,monospace);font-size:10px;cursor:pointer;border-radius:4px;box-shadow:0 4px 16px rgba(0,0,0,0.55);';
    this.toggleBtn.addEventListener('click', () => {
      this.open = !this.open;
      this.syncVisibility();
    });

    this.panel = document.createElement('div');
    this.panel.id = 'cutscene-lab-panel';
    this.panel.style.cssText =
      'position:fixed;top:46px;right:10px;width:min(440px,calc(100vw - 20px));max-height:calc(100vh - 60px);overflow-y:auto;pointer-events:auto;background:rgba(8,14,28,0.96);border:1px solid rgba(56,232,212,0.55);border-radius:8px;padding:12px 14px;box-shadow:0 12px 36px rgba(0,0,0,0.72);display:flex;flex-direction:column;gap:10px;';

    this.root.appendChild(this.toggleBtn);
    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);

    this.renderPanel();
    this.syncVisibility();

    // Panel beim Abspielen automatisch ausblenden und danach wieder einblenden
    this.hideTimer = window.setInterval(() => {
      const playing = this.host.isCutsceneActive();
      this.panel.style.display = this.open && !playing ? 'flex' : 'none';
      this.toggleBtn.style.opacity = playing ? '0.38' : '1';
    }, 120);
  }

  public dispose(): void {
    if (this.hideTimer !== null) window.clearInterval(this.hideTimer);
    this.root.remove();
  }

  private syncVisibility(): void {
    const playing = this.host.isCutsceneActive();
    this.panel.style.display = this.open && !playing ? 'flex' : 'none';
    this.toggleBtn.textContent = this.open ? '🎬 Studio ausblenden' : '🎬 Cutscene-Studio';
  }

  private renderPanel(): void {
    const btnStyle =
      'padding:5px 8px;border:1px solid rgba(148,163,184,0.35);background:rgba(15,23,42,0.9);color:#f8fafc;font-size:11px;border-radius:4px;cursor:pointer;text-align:left;';

    this.panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid rgba(56,232,212,0.28);padding-bottom:6px">
        <div>
          <div style="font-family:var(--font-pixel,monospace);font-size:11px;color:#38e8d4">🎬 CUTSCENE-TESTSTUDIO</div>
          <div style="font-size:11px;color:#94a3b8">Spielstand geschützt (saveLocked) · [ESC] bricht jede Szene ab</div>
        </div>
      </div>

      <div>
        <div style="font-family:var(--font-pixel,monospace);font-size:9.5px;color:#fbbf24;margin-bottom:5px">STORY, INTRO, FEIERN &amp; MINA (${CUTSCENE_CATALOG.length})</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          ${CUTSCENE_CATALOG.map(
            (e) =>
              `<button data-lab-story="${e.id}" style="${btnStyle}">${e.icon} ${e.title}</button>`,
          ).join('')}
        </div>
      </div>

      <div>
        <div style="font-family:var(--font-pixel,monospace);font-size:9.5px;color:#fb923c;margin-bottom:5px">UPGRADE-CUTSCENES</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <button data-lab-upg="weapon_kael" style="${btnStyle}">⚔ Waffe (nur Kael)</button>
          <button data-lab-upg="weapon_mina" style="${btnStyle}">🔨 Waffe (Kael &amp; Mina)</button>
          <button data-lab-upg="shop" style="${btnStyle}">🏪 Laden-Ausbau (Stufe II)</button>
          <button data-lab-upg="quarters" style="${btnStyle}">🛏 Quartier-Ausbau (Stufe II)</button>
          <button data-lab-upg="med_step" style="${btnStyle}">⚕ Med-Bay-Umbau</button>
          <button data-lab-upg="ship" style="${btnStyle}">🚀 Schiff-Enthüllung</button>
          <button data-lab-upg="forge_step" style="${btnStyle}">✨ Schmiede-Stufe (+1)</button>
          <button data-lab-upg="tech_step" style="${btnStyle}">🔬 Tech-Modul (+1)</button>
        </div>
      </div>

      <div>
        <div style="font-family:var(--font-pixel,monospace);font-size:9.5px;color:#38bdf8;margin-bottom:5px">EXPEDITIONS-FLUG &amp; RETTUNG</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <button data-lab-flight="approach_1" style="${btnStyle}">🚀 Anflug Sektor I</button>
          <button data-lab-flight="approach_2" style="${btnStyle}">💎 Anflug Sektor II</button>
          <button data-lab-flight="approach_3" style="${btnStyle}">🔥 Anflug Sektor III</button>
          <button data-lab-flight="approach_4" style="${btnStyle}">✨ Anflug Sektor IV</button>
          <button data-lab-flight="return_extract" style="${btnStyle}">🛸 Rückflug (Extraktion)</button>
          <button data-lab-flight="return_rescue" style="${btnStyle}">🚨 Not-Rückflug (Med-Evac)</button>
          <button data-lab-flight="wakeup" style="${btnStyle}">🛏 Aufwachen in der Koje</button>
        </div>
      </div>

      <div>
        <div style="font-family:var(--font-pixel,monospace);font-size:9.5px;color:#4ade80;margin-bottom:5px">LADEN: ROLLTOR ÖFFNEN &amp; SCHLIESSEN</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <button data-lab-shift="open" style="${btnStyle}">🟢 Laden öffnen</button>
          <button data-lab-shift="close" style="${btnStyle}">🔴 Ladenschluss</button>
        </div>
      </div>

      <div>
        <div style="font-family:var(--font-pixel,monospace);font-size:9.5px;color:#fb7185;margin-bottom:5px">DUNGEON-SZENEN (KÄFIG-KAMMER · BEFREIUNG · HEILQUELLE)</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          <button data-lab-dng="rescue_mina" style="${btnStyle}">🔓 Befreiung Mina (S1)</button>
          <button data-lab-dng="rescue_pip" style="${btnStyle}">🔓 Befreiung Pip (S2)</button>
          <button data-lab-dng="rescue_ping" style="${btnStyle}">🔓 Befreiung Ping (S3)</button>
          <button data-lab-dng="rescue_midnight" style="${btnStyle}">🔓 Befreiung Mitternacht (S4)</button>
          <button data-lab-dng="cell_mina" style="${btnStyle}">🔒 Käfig-Kammer S1 ansehen</button>
          <button data-lab-dng="spring_1" style="${btnStyle}">💧 Heilquelle S1</button>
          <button data-lab-dng="spring_2" style="${btnStyle}">💧 Heilquelle S2</button>
          <button data-lab-dng="spring_3" style="${btnStyle}">💧 Heilquelle S3</button>
          <button data-lab-dng="spring_4" style="${btnStyle}">💧 Heilquelle S4</button>
          <button data-lab-dng-back style="${btnStyle};border-color:#fb7185">↩ Zurück zum Hub</button>
        </div>
      </div>

      <div>
        <div style="font-family:var(--font-pixel,monospace);font-size:9.5px;color:#34d399;margin-bottom:5px">PORT SOLARIS VORSCHAU (KAPITEL &amp; MINA)</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">
          ${[0, 1, 2, 3, 4, 5, 6]
            .map(
              (ch) =>
                `<button data-lab-chapter="${ch}" style="padding:4px 8px;border:1px solid ${this.chapterPreview === ch ? '#34d399' : 'rgba(148,163,184,0.35)'};background:${this.chapterPreview === ch ? 'rgba(16,185,129,0.22)' : 'rgba(15,23,42,0.9)'};color:#f8fafc;font-size:10.5px;border-radius:4px;cursor:pointer">Kap. ${ch}</button>`,
            )
            .join('')}
        </div>
        <button data-lab-mina-toggle style="${btnStyle};width:100%">
          🔨 Mina an der 2. Werkbank: <strong>${this.minaPreview ? 'AN (sichtbar)' : 'AUS'}</strong>
        </button>
      </div>
    `;

    this.panel.querySelectorAll<HTMLElement>('[data-lab-shift]').forEach((btn) => {
      btn.addEventListener('click', () => this.host.playShift(btn.dataset.labShift === 'close' ? 'close' : 'open'));
    });
    this.panel.querySelectorAll<HTMLElement>('[data-lab-dng]').forEach((btn) => {
      btn.addEventListener('click', () => this.host.playDungeonPreview(btn.dataset.labDng ?? ''));
    });
    this.panel.querySelector('[data-lab-dng-back]')?.addEventListener('click', () => this.host.leaveDungeonPreview());

    this.panel.querySelectorAll<HTMLElement>('[data-lab-story]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.labStory as ReplayableCutsceneId;
        this.host.replayCutscene(id);
      });
    });

    this.panel.querySelectorAll<HTMLElement>('[data-lab-upg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.labUpg;
        if (kind === 'weapon_kael') {
          this.host.playUpgradeCutscene({
            kind: 'weapon',
            title: 'PLASMA-KLINGE',
            subtitle: 'Neu geschmiedet · Wechsle jederzeit mit [C]',
            accent: '#38e8d4',
            major: true,
            minaPresent: false,
            building: 'forge',
            fromTier: 0,
            toTier: 1,
          });
        } else if (kind === 'weapon_mina') {
          this.host.playUpgradeCutscene({
            kind: 'weapon',
            title: 'SONNEN-HAMMER',
            subtitle: 'Gemeinsam geschmiedet · Wechsle jederzeit mit [C]',
            accent: '#fb923c',
            major: true,
            minaPresent: true,
            building: 'forge',
            fromTier: 1,
            toTier: 2,
          });
        } else if (kind === 'shop') {
          this.host.playUpgradeCutscene({
            kind: 'shop',
            title: 'ASTRO-BARTER AUSBAU',
            subtitle: 'Stufe II · 6 Podeste & Sale-Box freigeschaltet',
            accent: '#fbbf24',
            major: true,
            room: 'shop',
            fromTier: 0,
            toTier: 1,
          });
        } else if (kind === 'quarters') {
          this.host.playUpgradeCutscene({
            kind: 'quarters',
            title: 'QUARTIER-AUSBAU',
            subtitle: 'Stufe II · Drohnen-Dock & Jukebox installiert',
            accent: '#fbbf24',
            major: true,
            room: 'backroom',
            fromTier: 0,
            toTier: 1,
          });
        } else if (kind === 'med_step') {
          this.host.playUpgradeCutscene({
            kind: 'tech_step',
            title: 'BIO-REGENERATION',
            subtitle: 'Stufe 1 → Stufe 2',
            accent: '#34d399',
            major: true,
            building: 'med',
            fromTier: 0,
            toTier: 1,
          });
        } else if (kind === 'ship') {
          this.host.playUpgradeCutscene({
            kind: 'ship',
            title: 'KRISTALL-GLEITER',
            subtitle: 'Neues Forschungsschiff im Raumhafen bereit',
            accent: '#c084fc',
            major: true,
            shipKey: 'shipCrystal',
          });
        } else if (kind === 'forge_step') {
          this.host.playUpgradeCutscene({
            kind: 'forge_step',
            title: 'EXO-PANZERUNG',
            subtitle: 'Stufe 2 → Stufe 3',
            accent: '#fb923c',
            major: false,
            building: 'forge',
            fromTier: 1,
            toTier: 1,
          });
        } else if (kind === 'tech_step') {
          this.host.playUpgradeCutscene({
            kind: 'tech_step',
            title: 'FRACHT-RUCKSACK',
            subtitle: 'Stufe 1 → Stufe 2',
            accent: '#38bdf8',
            major: false,
          });
        }
      });
    });

    this.panel.querySelectorAll<HTMLElement>('[data-lab-flight]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.labFlight ?? '';
        if (mode.startsWith('approach_')) {
          const sec = Number(mode.split('_')[1]) as SectorId;
          this.host.playApproach(sec);
        } else if (mode === 'return_extract') {
          this.host.playReturn('extract', 1);
        } else if (mode === 'return_rescue') {
          this.host.playReturn('rescue', 1);
        } else if (mode === 'wakeup') {
          this.host.playBackroomWakeup();
        }
      });
    });

    this.panel.querySelectorAll<HTMLElement>('[data-lab-chapter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.chapterPreview = Number(btn.dataset.labChapter ?? 1);
        this.host.showPromenade(this.chapterPreview, this.minaPreview);
        this.renderPanel();
      });
    });

    this.panel.querySelector('[data-lab-mina-toggle]')?.addEventListener('click', () => {
      this.minaPreview = !this.minaPreview;
      this.host.showPromenade(this.chapterPreview, this.minaPreview);
      this.renderPanel();
    });
  }
}
