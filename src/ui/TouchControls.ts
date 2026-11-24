import { WEAPON_META } from '../data/upgrades';
import { sound } from '../engine/audio';
import type { InputManager } from '../engine/input';
import type { SceneId, WeaponId } from '../types';

export interface TouchHooks {
  onToggleShop: () => void;
  onOpenBag: () => void;
  onSwapWeapon: () => void;
}

export class TouchControls {
  private container: HTMLElement;
  private input: InputManager;
  private hooks: TouchHooks;

  private enabled = false;
  private visible = false;
  private scene: SceneId = 'shop';
  private shopOpen = false;
  private equippedWeapon: WeaponId = 'blade';
  private hasSecondary = false;
  private joyPointerId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private readonly joyMaxRadius = 38;

  constructor(input: InputManager, hooks: TouchHooks) {
    this.container = document.getElementById('touch-deck')!;
    this.input = input;
    this.hooks = hooks;

    const coarse =
      window.matchMedia?.('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    if (coarse) {
      this.enableTouch();
    } else {
      window.addEventListener(
        'touchstart',
        () => {
          this.enableTouch();
        },
        { once: true, passive: true },
      );
    }
  }

  private enableTouch(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.input.setTouchMode(true);
    document.body.classList.add('touch-device');
    this.render();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setState(
    scene: SceneId,
    shopOpen: boolean,
    modalOrTitleOpen: boolean,
    equippedWeapon: WeaponId = 'blade',
    hasSecondary = false,
  ): void {
    const changed =
      this.scene !== scene ||
      this.shopOpen !== shopOpen ||
      this.visible !== !modalOrTitleOpen ||
      this.equippedWeapon !== equippedWeapon ||
      this.hasSecondary !== hasSecondary;

    this.scene = scene;
    this.shopOpen = shopOpen;
    this.visible = !modalOrTitleOpen;
    this.equippedWeapon = equippedWeapon;
    this.hasSecondary = hasSecondary;

    if (!this.visible) {
      this.joyPointerId = null;
      this.input.clearTouchState();
    }

    if (changed && this.enabled) {
      this.render();
    }
  }

  private render(): void {
    if (!this.enabled || !this.visible) {
      this.container.classList.add('hidden');
      this.container.innerHTML = '';
      return;
    }

    this.container.classList.remove('hidden');

    const wMeta = WEAPON_META[this.equippedWeapon];
    const secLabel =
      this.equippedWeapon === 'blade'
        ? 'SCHILD'
        : this.equippedWeapon === 'blaster'
          ? 'LASER'
          : 'SCHOCK';
    const secSub = this.equippedWeapon === 'blade' ? 'HALTEN' : 'SPEZIAL';

    let buttonsHtml = '';
    if (this.scene === 'shop') {
      buttonsHtml = `
        <div class="touch-pad-grid shop-pad">
          <button class="tbtn tbtn-util" data-cb="bag">FRACHT</button>
          <button class="tbtn ${this.shopOpen ? 'tbtn-emerald' : 'tbtn-amber'}" data-cb="shop">
            ${this.shopOpen ? 'ZU' : 'ÖFFNEN'}
          </button>
          <button class="tbtn tbtn-amber" data-code="Space">DASH</button>
          <button class="tbtn tbtn-primary tbtn-big" data-code="KeyE">AKTION<small>[E]</small></button>
        </div>
      `;
    } else if (this.scene === 'hub') {
      buttonsHtml = `
        <div class="touch-pad-grid shop-pad">
          <button class="tbtn tbtn-util" data-cb="bag">FRACHT</button>
          ${
            this.hasSecondary
              ? `<button class="tbtn tbtn-cyan" data-cb="swap">WAFFE<small>WECHSEL</small></button>`
              : `<button class="tbtn tbtn-util" data-cb="bag">CODEX</button>`
          }
          <button class="tbtn tbtn-amber" data-code="Space">DASH</button>
          <button class="tbtn tbtn-primary tbtn-big" data-code="KeyE">AKTION<small>[E]</small></button>
        </div>
      `;
    } else {
      const swapStrip = this.hasSecondary
        ? `<button class="tbtn tbtn-swap-strip" data-cb="swap">⇄ WAFFE WECHSELN [C]</button>`
        : '';
      buttonsHtml = `
        <div class="touch-right-stack">
          ${swapStrip}
          <div class="touch-pad-grid dungeon-pad">
            <button class="tbtn tbtn-util" data-code="KeyR">WARP<small>HALTEN</small></button>
            <button class="tbtn tbtn-emerald" data-code="KeyQ">HEIL<small>[Q]</small></button>
            <button class="tbtn tbtn-util" data-code="KeyE">INTER<small>[E]</small></button>
            <button class="tbtn tbtn-amber" data-code="Space">DASH</button>
            <button class="tbtn tbtn-cyan" data-code="KeyK">${secLabel}<small>${secSub}</small></button>
            <button class="tbtn tbtn-primary tbtn-big" data-code="KeyJ">${wMeta.shortName}</button>
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="touch-left">
        <div class="joy-base" id="joy-base">
          <div class="joy-ring"></div>
          <div class="joy-knob" id="joy-knob"></div>
        </div>
      </div>
      <div class="touch-right">
        ${buttonsHtml}
      </div>
    `;

    this.bindJoystick();
    this.bindButtons();
  }

  private bindJoystick(): void {
    const base = this.container.querySelector<HTMLElement>('#joy-base');
    const knob = this.container.querySelector<HTMLElement>('#joy-knob');
    if (!base || !knob) return;

    const resetKnob = () => {
      this.joyPointerId = null;
      knob.style.transform = 'translate(-50%, -50%)';
      base.classList.remove('active');
      this.input.setTouchMove(0, 0);
    };

    const updateStick = (clientX: number, clientY: number) => {
      const dx = clientX - this.joyCenter.x;
      const dy = clientY - this.joyCenter.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(this.joyMaxRadius, dist);
      const angle = Math.atan2(dy, dx);
      const ox = Math.cos(angle) * clamped;
      const oy = Math.sin(angle) * clamped;
      knob.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;

      const norm = clamped / this.joyMaxRadius;
      if (norm < 0.16) {
        this.input.setTouchMove(0, 0);
      } else {
        this.input.setTouchMove(Math.cos(angle) * norm, Math.sin(angle) * norm);
      }
    };

    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sound.unlock();
      if (this.joyPointerId !== null) return;
      this.joyPointerId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      const rect = base.getBoundingClientRect();
      this.joyCenter.x = rect.left + rect.width / 2;
      this.joyCenter.y = rect.top + rect.height / 2;
      base.classList.add('active');
      updateStick(e.clientX, e.clientY);
    });

    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      e.preventDefault();
      updateStick(e.clientX, e.clientY);
    });

    base.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      e.preventDefault();
      resetKnob();
    });

    base.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      resetKnob();
    });
  }

  private bindButtons(): void {
    this.container.querySelectorAll<HTMLElement>('.tbtn').forEach((btn) => {
      const code = btn.dataset.code;
      const cb = btn.dataset.cb;

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        sound.unlock();
        btn.classList.add('pressed');
        btn.setPointerCapture(e.pointerId);
        if (code) {
          this.input.setTouchAction(code, true);
        } else if (cb === 'shop') {
          this.hooks.onToggleShop();
        } else if (cb === 'bag') {
          sound.playUiClick();
          this.hooks.onOpenBag();
        } else if (cb === 'swap') {
          this.hooks.onSwapWeapon();
        }
      });

      const release = (e: PointerEvent) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        if (code) {
          this.input.setTouchAction(code, false);
        }
      };

      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    });
  }
}
