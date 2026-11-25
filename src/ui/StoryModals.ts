/**
 * Meilenstein 10-A — Story-UI: Dialog-Controller (Schreibmaschine, Antworten, „Später“) und Chronik.
 * Story-Text wird ausschließlich per textContent gesetzt (kein innerHTML → kein XSS durch Namen).
 */
import { getHDArt } from '../assets/artLoader';
import {
  NPC_META,
  STORY_CHAPTERS,
  STORY_NPCS,
  TONE_ICON,
  TRUST_MAX,
  TRUST_PERK_THRESHOLD,
  TRUST_PERKS,
} from '../data/story/storyChapters';
import { STORY_SCENES } from '../data/story/storyScenes';
import type { StoryChoice, StoryNode, StoryScene, StorySpeaker } from '../data/story/storyTypes';
import { sound } from '../engine/audio';
import { getDeviceSettings } from '../systems/deviceSettings';
import type { GameState } from '../systems/gameState';
import {
  formatStoryText,
  getVisibleChoices,
  isSceneSeen,
  prepareScene,
  resolveNext,
  resolveNodeText,
} from '../systems/storyEngine';
import type { StoryNpcId, StoryProgress, TextSpeed } from '../types';
import { escapeHtml } from './NetworkModals';

export interface StoryHost {
  state: GameState;
  modalEl: HTMLElement;
  showModalHtml: (html: string) => void;
  closeModal: () => void;
  /** Wird von closeModal() aufgerufen (ESC, ✕, Hintergrund) — nicht beim regulären Abschluss. */
  setModalCloseHook: (cb: (() => void) | null) => void;
}

export interface StoryResult {
  sceneId: string;
  newPerks: StoryNpcId[];
  replay: boolean;
}

export interface StoryDialogOptions {
  /** Beschriftung des „Später“-Buttons auf der ersten Box, z. B. „Später ▸ Exo-Schmiede“. */
  laterLabel?: string;
  /** Wiedergabe aus der Chronik: keine Auswirkungen auf Vertrauen/Flags/Gelesen-Status. */
  replay?: boolean;
  onLater?: () => void;
  onFinish?: (res: StoryResult) => void;
  /** ESC / ✕ / Hintergrund-Klick (oder „Schließen“ im Replay). */
  onClose?: () => void;
}

/** Zeichen pro Sekunde; Infinity = sofort. */
export const TEXT_SPEED_CPS: Record<TextSpeed, number> = { normal: 40, fast: 90, instant: Number.POSITIVE_INFINITY };

const portraitCache = new Map<StoryNpcId, string>();

function getPortraitUrl(npc: StoryNpcId): string {
  const hit = portraitCache.get(npc);
  if (hit !== undefined) return hit;
  const art = getHDArt();
  const canvas =
    npc === 'kael' ? art.npcKael : npc === 'lyra' ? art.npcLyra : npc === 'nyx' ? art.npcNyx : art.npcVex;
  let url = '';
  try {
    url = canvas ? canvas.toDataURL() : '';
  } catch {
    url = '';
  }
  if (url) portraitCache.set(npc, url);
  return url;
}

export class StoryDialogController {
  private host: StoryHost;
  private scene: StoryScene;
  private opts: StoryDialogOptions;

  private nodeId = '';
  private node: StoryNode | null = null;
  private fullText = '';
  private typing = false;
  private rafId: number | null = null;
  private typeStartMs = 0;
  private visibleChoices: StoryChoice[] = [];
  private awaitingChoice = false;
  private finished = false;
  private started = false;
  private newPerks: StoryNpcId[] = [];
  private keyHandler: ((ev: KeyboardEvent) => void) | null = null;

  constructor(host: StoryHost, scene: StoryScene, opts: StoryDialogOptions = {}) {
    this.host = host;
    this.scene = scene;
    this.opts = opts;
  }

  // ---------- Lebenszyklus ----------
  public start(): void {
    if (this.started) return;
    this.started = true;
    const story = this.host.state.story;
    if (!this.opts.replay) prepareScene(story, this.scene);

    const chapter = STORY_CHAPTERS[Math.max(0, Math.min(STORY_CHAPTERS.length - 1, this.scene.chapter))];
    const title = `📜 ${chapter.title.split(' · ')[0]} · ${this.scene.title}`;
    this.host.showModalHtml(`
      <div class="modal-window m10-story" style="max-width:640px">
        <div class="modal-header">
          <span class="modal-title m10-story-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
          <button id="modal-close-btn" class="modal-close" style="white-space:nowrap">ESC ✕</button>
        </div>
        <div class="modal-body m10-story-body">
          ${this.opts.replay ? '<div class="m9-file-sub" style="text-align:center">↻ Wiederholung — ohne Auswirkungen auf Vertrauen &amp; Entscheidungen</div>' : ''}
          <div class="m10-story-main">
            <div class="m10-portrait" id="m10-portrait"></div>
            <div class="m10-textbox" id="m10-textbox">
              <div class="m10-speaker" id="m10-speaker"></div>
              <div class="m10-text" id="m10-text"></div>
              <span class="m10-caret" id="m10-caret">▾</span>
            </div>
          </div>
          <div class="m10-choices" id="m10-choices"></div>
          <div class="m10-story-foot">
            <button id="m10-later" class="btn m10-later" tabindex="-1" style="white-space:nowrap"></button>
            <span class="m10-hint">[Enter] Weiter · [1–3] Antwort</span>
            <button id="m10-next" class="btn btn-primary" tabindex="-1" style="white-space:nowrap">Weiter ▸</button>
          </div>
        </div>
      </div>
    `);
    this.host.setModalCloseHook(() => this.handleModalClosed());

    const later = this.host.modalEl.querySelector<HTMLButtonElement>('#m10-later');
    if (later) {
      later.textContent = this.opts.replay ? 'Schließen' : (this.opts.laterLabel ?? 'Später');
      later.addEventListener('click', () => this.skipLater());
    }
    this.host.modalEl.querySelector('#m10-next')?.addEventListener('click', () => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.advance();
    });
    this.host.modalEl.querySelector('#m10-textbox')?.addEventListener('click', () => this.advance());

    this.keyHandler = (ev: KeyboardEvent) => this.onKey(ev);
    document.addEventListener('keydown', this.keyHandler, true);

    this.goTo(this.scene.start);
  }

  /** Räumt Timer & Tastatur-Listener auf (idempotent). */
  public destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.typing = false;
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler, true);
    this.keyHandler = null;
  }

  private handleModalClosed(): void {
    if (this.finished) return;
    this.finished = true;
    this.destroy();
    this.opts.onClose?.();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.destroy();
    this.host.setModalCloseHook(null);
    this.host.closeModal();
    if (!this.opts.replay) this.host.state.markSceneSeen(this.scene.id);
    this.opts.onFinish?.({ sceneId: this.scene.id, newPerks: this.newPerks, replay: Boolean(this.opts.replay) });
  }

  /** „Später ▸ Station“ bzw. „Schließen“ im Replay. */
  public skipLater(): void {
    if (this.finished) return;
    sound.playUiClick();
    if (this.opts.replay) {
      this.finished = true;
      this.destroy();
      this.host.setModalCloseHook(null);
      this.host.closeModal();
      this.opts.onClose?.();
      return;
    }
    this.finished = true;
    this.destroy();
    this.host.setModalCloseHook(null);
    this.host.closeModal();
    this.opts.onLater?.();
  }

  // ---------- Ablauf ----------
  private goTo(rawId: string): void {
    const id = resolveNext(rawId, this.host.state.story);
    if (id === 'end') {
      this.finish();
      return;
    }
    const node = this.scene.nodes[id];
    if (!node) {
      this.finish();
      return;
    }
    this.nodeId = id;
    this.node = node;
    this.awaitingChoice = false;
    this.visibleChoices = [];
    const choicesEl = this.host.modalEl.querySelector<HTMLElement>('#m10-choices');
    if (choicesEl) choicesEl.replaceChildren();

    this.renderSpeaker(node.speaker);
    const text = formatStoryText(resolveNodeText(node, this.host.state.story), this.host.state.captainName);
    this.updateFootButtons();
    this.startTyping(text);
  }

  private renderSpeaker(speaker: StorySpeaker): void {
    const portrait = this.host.modalEl.querySelector<HTMLElement>('#m10-portrait');
    const label = this.host.modalEl.querySelector<HTMLElement>('#m10-speaker');
    const textbox = this.host.modalEl.querySelector<HTMLElement>('#m10-textbox');
    if (!portrait || !label || !textbox) return;
    portrait.replaceChildren();
    const isNpc = (STORY_NPCS as string[]).includes(speaker);
    textbox.classList.toggle('narrator', speaker === 'narrator');
    if (isNpc) {
      const meta = NPC_META[speaker as StoryNpcId];
      portrait.style.display = '';
      portrait.style.borderColor = meta.color;
      const url = getPortraitUrl(meta.id);
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = meta.name;
        img.className = 'm10-portrait-img';
        portrait.appendChild(img);
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'm10-portrait-fallback';
        fallback.textContent = meta.name.charAt(0);
        fallback.style.color = meta.color;
        portrait.appendChild(fallback);
      }
      label.textContent = `${meta.name} · ${meta.role}`;
      label.style.color = meta.color;
    } else {
      portrait.style.display = 'none';
      label.textContent = speaker === 'captain' ? this.host.state.captainName : 'ERZÄHLER';
      label.style.color = speaker === 'captain' ? '#38e8d4' : '#94a3b8';
    }
  }

  private startTyping(text: string): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.fullText = text;
    const textEl = this.host.modalEl.querySelector<HTMLElement>('#m10-text');
    if (!textEl) return;
    const cps = TEXT_SPEED_CPS[getDeviceSettings().textSpeed];
    if (!Number.isFinite(cps)) {
      textEl.textContent = text;
      this.typing = false;
      this.onTypingDone();
      return;
    }
    this.typing = true;
    textEl.textContent = '';
    this.typeStartMs = performance.now();
    const tick = (): void => {
      if (!this.typing) return;
      const n = Math.min(text.length, Math.floor(((performance.now() - this.typeStartMs) / 1000) * cps));
      textEl.textContent = text.slice(0, n);
      if (n >= text.length) {
        this.typing = false;
        this.rafId = null;
        this.onTypingDone();
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private completeTyping(): void {
    if (!this.typing) return;
    this.typing = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    const textEl = this.host.modalEl.querySelector<HTMLElement>('#m10-text');
    if (textEl) textEl.textContent = this.fullText;
    this.onTypingDone();
  }

  private onTypingDone(): void {
    const node = this.node;
    if (!node) return;
    const vis = getVisibleChoices(node, this.host.state.story);
    if (vis.length > 0) {
      this.showChoices(vis);
    } else if (node.choices && node.choices.length > 0) {
      // Defensiv: alle Antworten ausgeblendet → Szene sauber beenden
      this.goTo('end');
      return;
    }
    this.updateFootButtons();
  }

  private showChoices(vis: StoryChoice[]): void {
    this.visibleChoices = vis;
    this.awaitingChoice = true;
    const el = this.host.modalEl.querySelector<HTMLElement>('#m10-choices');
    if (!el) return;
    el.replaceChildren();
    vis.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn m10-choice';
      btn.tabIndex = -1;
      const key = document.createElement('span');
      key.className = 'm10-key';
      key.textContent = String(i + 1);
      const tone = document.createElement('span');
      tone.className = 'm10-tone';
      tone.textContent = TONE_ICON[c.tone];
      tone.title = c.tone;
      const label = document.createElement('span');
      label.className = 'm10-choice-label';
      label.textContent = formatStoryText(c.label, this.host.state.captainName);
      btn.append(key, tone, label);
      btn.addEventListener('click', () => {
        (document.activeElement as HTMLElement | null)?.blur?.();
        this.choose(i);
      });
      el.appendChild(btn);
    });
    this.updateFootButtons();
  }

  private updateFootButtons(): void {
    const next = this.host.modalEl.querySelector<HTMLElement>('#m10-next');
    const later = this.host.modalEl.querySelector<HTMLElement>('#m10-later');
    const caret = this.host.modalEl.querySelector<HTMLElement>('#m10-caret');
    if (next) {
      next.style.visibility = this.awaitingChoice ? 'hidden' : 'visible';
      next.textContent = this.typing ? 'Überspringen ▸' : 'Weiter ▸';
    }
    // „Später“ nur auf der allerersten Box (oder im Replay als „Schließen“)
    if (later) later.style.visibility = this.nodeId === this.scene.start || this.opts.replay ? 'visible' : 'hidden';
    if (caret) caret.style.visibility = !this.typing && !this.awaitingChoice ? 'visible' : 'hidden';
  }

  // ---------- Eingabe ----------
  /** Zeigt zuerst den ganzen Text, dann geht es weiter (Antworten bleiben stehen). */
  public advance(): void {
    if (this.finished || !this.node) return;
    if (this.typing) {
      this.completeTyping();
      return;
    }
    if (this.awaitingChoice) return;
    sound.playUiClick();
    this.goTo(this.node.next ?? 'end');
  }

  public choose(index: number): void {
    if (this.finished || !this.awaitingChoice || this.typing) return;
    const c = this.visibleChoices[index];
    if (!c) return;
    sound.playUiClick();
    if (!this.opts.replay) {
      const res = this.host.state.recordStoryChoice(this.scene.id, c);
      this.newPerks.push(...res.newPerks);
    }
    this.awaitingChoice = false;
    this.goTo(c.next);
  }

  private onKey(ev: KeyboardEvent): void {
    if (this.finished) return;
    const code = ev.code;
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'KeyE' || code === 'Space' || code === 'ArrowRight') {
      ev.preventDefault();
      ev.stopPropagation();
      if (!ev.repeat) this.advance();
      return;
    }
    const m = /^(?:Digit|Numpad)([1-3])$/.exec(code);
    if (m) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!ev.repeat) this.choose(Number(m[1]) - 1);
    }
  }

  /** Test-Hook. */
  public getState(): { nodeId: string; typing: boolean; awaitingChoice: boolean; finished: boolean; text: string; choices: number } {
    return {
      nodeId: this.nodeId,
      typing: this.typing,
      awaitingChoice: this.awaitingChoice,
      finished: this.finished,
      text: this.fullText,
      choices: this.visibleChoices.length,
    };
  }
}

// ==================== CHRONIK (Logbuch-Abschnitt) ====================
function trustBarHtml(npc: StoryNpcId, story: StoryProgress): string {
  const meta = NPC_META[npc];
  const v = story.trust[npc] ?? 0;
  const perk = TRUST_PERKS[npc];
  const unlocked = v >= TRUST_PERK_THRESHOLD;
  const pct = Math.round((v / TRUST_MAX) * 100);
  const markPct = Math.round((TRUST_PERK_THRESHOLD / TRUST_MAX) * 100);
  return `
    <div class="m10-trust-row" title="${escapeHtml(perk.description)}">
      <span class="m10-trust-name" style="color:${meta.color}">${escapeHtml(meta.name)}</span>
      <div class="m10-trust-track">
        <div class="m10-trust-fill" style="width:${pct}%;background:${meta.color}"></div>
        <div class="m10-trust-mark" style="left:${markPct}%"></div>
      </div>
      <span class="m10-trust-val">${v}/${TRUST_MAX}</span>
      <span class="m10-perk ${unlocked ? 'on' : ''}">${unlocked ? '✔' : '🔒'} ${escapeHtml(perk.name)}</span>
    </div>`;
}

export function renderChronicleHtml(story: StoryProgress): string {
  const sceneTitleOf = (s: StoryScene): string => (s.npc === 'event' ? 'Fest' : NPC_META[s.npc].name);
  const cards = STORY_CHAPTERS.map((chap) => {
    if (chap.id > story.chapter) {
      return `<div class="m10-chap locked"><div class="m10-chap-title">🔒 ???</div></div>`;
    }
    const scenes = STORY_SCENES.filter((s) => s.chapter === chap.id);
    const rows = scenes
      .map((s) => {
        const seen = isSceneSeen(story, s.id);
        const festivalLocked = s.id === 'event_festival' && !story.flags.includes('festival_seen');
        if (festivalLocked) return '';
        const color = s.npc === 'event' ? '#fde047' : NPC_META[s.npc].color;
        if (!seen) {
          return `<div class="m10-scene-row"><span style="color:${color}">${escapeHtml(sceneTitleOf(s))}</span> <span class="m9-file-sub">— noch nicht besprochen</span></div>`;
        }
        const picks = story.choiceLog
          .filter((e) => e.sceneId === s.id)
          .map((e) => {
            for (const n of Object.values(s.nodes)) {
              const c = (n.choices ?? []).find((x) => x.id === e.choiceId);
              if (c) return c.chronicle;
            }
            return '';
          })
          .filter(Boolean);
        return `
          <div class="m10-scene-row">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
              <span><strong style="color:${color}">${escapeHtml(sceneTitleOf(s))}</strong> · ${escapeHtml(s.title)}</span>
              <button class="btn m10-replay-btn" data-story-replay="${escapeHtml(s.id)}" style="padding:2px 7px;font-size:9px;white-space:nowrap">▶ Erneut ansehen</button>
            </div>
            ${picks.map((p) => `<div class="m9-file-sub">• ${escapeHtml(p)}</div>`).join('')}
          </div>`;
      })
      .join('');
    return `
      <details class="m10-chap" ${chap.id === story.chapter ? 'open' : ''}>
        <summary class="m10-chap-title">${escapeHtml(chap.title)}</summary>
        <div class="m9-file-sub">${escapeHtml(chap.trigger)}</div>
        <div class="m9-file-sub" style="color:#7dd3fc">🏙 ${escapeHtml(chap.stationChange)}</div>
        ${rows}
      </details>`;
  }).join('');

  return `
    <div class="inspector-box" style="gap:8px">
      <div style="font-family:var(--font-pixel);font-size:10.5px;color:#fde047">📜 CHRONIK VON PORT SOLARIS</div>
      <div class="m9-file-sub">Vertrauen zu deinen Freunden — ab ${TRUST_PERK_THRESHOLD} gibt es einen dauerhaften Bonus (nicht in der Galaktischen Prüfung).</div>
      <div class="m10-trust">${STORY_NPCS.map((n) => trustBarHtml(n, story)).join('')}</div>
      <div class="m10-chronicle">${cards}</div>
    </div>`;
}
