import './style.css';
import { preloadHDArt } from './assets/artLoader';
import { getAtlas } from './assets/sprites';
import { sound } from './engine/audio';
import { InputManager, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './engine/input';
import { DungeonScene } from './scenes/DungeonScene';
import { HubScene } from './scenes/HubScene';
import { ShopScene } from './scenes/ShopScene';
import { GameState } from './systems/gameState';
import type { RunSummary, SceneId } from './types';
import { TouchControls } from './ui/TouchControls';
import { UIManager } from './ui/UIManager';

const RENDER_SCALE = 2; // 960x540 native HD pixel-art backing buffer (2x logical 480x270)

class StarlighterGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputManager;
  private state: GameState;
  private ui: UIManager;
  private touch: TouchControls;
  private shopScene: ShopScene;
  private hubScene: HubScene;
  private dungeonScene: DungeonScene;

  private activeScene: SceneId = 'shop';
  private transitionAlpha = 0;
  private transitionDir: -1 | 0 | 1 = 0;
  private pendingTransition: (() => void) | null = null;
  private lastTime = 0;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('Missing #game-canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to acquire 2D canvas context');

    this.canvas = canvas;
    this.canvas.width = VIRTUAL_WIDTH * RENDER_SCALE;
    this.canvas.height = VIRTUAL_HEIGHT * RENDER_SCALE;
    this.canvas.tabIndex = 0;
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    getAtlas();
    void preloadHDArt().then(() => {
      this.ui.renderHud();
    });

    this.input = new InputManager(this.canvas);
    this.state = new GameState();
    if (this.state.hasSave()) {
      this.state.load();
      sound.setMuted(this.state.muted);
    }

    this.touch = new TouchControls(this.input, {
      onToggleShop: () => {
        if (this.activeScene === 'shop') {
          this.shopScene.toggleShopOpen();
          this.ui.shopIsOpen = this.shopScene.shopOpen;
          this.ui.renderHud();
          this.syncTouch();
        }
      },
      onOpenBag: () => {
        if (!this.ui.modalOpen && !this.ui.titleVisible) {
          this.ui.openInventoryModal(this.activeScene === 'shop', 'bag');
        }
      },
      onSwapWeapon: () => {
        this.handleSwapWeapon();
      },
    });

    this.ui = new UIManager(this.state, {
      onStartNewGame: () => {
        this.state.resetSave();
        this.activeScene = 'shop';
        this.ui.currentScene = 'shop';
        this.shopScene.onEnter(false);
        this.ui.shopIsOpen = false;
        this.ui.renderHud();
        this.syncTouch();
        this.ui.toast(
          'Willkommen in Astro-Barter! Verkaufe Relikte oder geh rechts auf die Promenade Port Solaris!',
          'good',
        );
      },
      onContinueGame: () => {
        this.state.load();
        sound.setMuted(this.state.muted);
        this.activeScene = 'shop';
        this.ui.currentScene = 'shop';
        this.shopScene.onEnter(false);
        this.ui.shopIsOpen = false;
        this.ui.renderHud();
        this.syncTouch();
      },
      onToggleShopOpen: () => {
        if (this.activeScene === 'shop') {
          this.shopScene.toggleShopOpen();
          this.ui.shopIsOpen = this.shopScene.shopOpen;
          this.ui.renderHud();
          this.syncTouch();
        }
      },
      onSwapWeapon: () => {
        this.handleSwapWeapon();
      },
      onModalStateChange: (open) => {
        this.input.locked = open;
        this.syncTouch();
        if (!open) {
          window.focus();
          this.canvas.focus({ preventScroll: true });
        }
      },
      onMuteToggle: () => {
        const muted = sound.toggleMute();
        this.state.muted = muted;
        this.state.save();
        this.ui.renderHud();
      },
    });

    this.shopScene = new ShopScene(this.state, {
      onOpenPedestal: (ped) => this.ui.openPedestalModal(ped),
      onOpenWorkbench: () => this.ui.openInventoryModal(true, 'codex'),
      onOpenChest: () => this.ui.openInventoryModal(true, 'bag'),
      onEnterDungeon: () => this.transitionTo('hub', 'shop'),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
      onHudDirty: () => {
        this.ui.shopIsOpen = this.shopScene.shopOpen;
        this.ui.renderHud();
        this.syncTouch();
      },
    });

    this.hubScene = new HubScene(this.state, {
      onEnterShop: () => this.transitionTo('shop', 'hub'),
      onOpenForge: () => this.ui.openForgeModal(),
      onOpenMedBay: () => this.ui.openMedBayModal(),
      onEnterDungeon: () => this.transitionTo('dungeon', 'hub'),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
    });

    this.dungeonScene = new DungeonScene(this.state, {
      onReturnToHub: (summary) => this.handleReturnFromDungeon(summary),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
      onHudDirty: () => {
        this.ui.renderHud();
        this.syncTouch();
      },
    });

    this.shopScene.onEnter(false);
    this.ui.showTitle();
    this.syncTouch();

    this.canvas.addEventListener('pointerdown', () => {
      sound.unlock();
      window.focus();
      this.canvas.focus({ preventScroll: true });
    });
    window.addEventListener('pointerdown', () => sound.unlock(), { once: true });
    window.addEventListener('keydown', () => sound.unlock(), { once: true });

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private handleSwapWeapon(): void {
    if (this.activeScene === 'dungeon') {
      this.dungeonScene.swapWeapon();
      this.syncTouch();
      return;
    }
    if (this.state.swapEquippedWeapons()) {
      sound.playWeaponSwap();
      this.ui.renderHud();
      this.syncTouch();
    } else {
      this.ui.toast('Schmiede eine 2. Waffe bei Kael auf Port Solaris zum Wechseln!', 'info');
    }
  }

  private syncTouch(): void {
    if (!this.touch || !this.ui) return;
    this.touch.setState(
      this.activeScene,
      this.activeScene === 'shop' && this.shopScene?.shopOpen,
      this.ui.modalOpen || this.ui.titleVisible,
      this.state.equippedWeapon,
      this.state.secondaryWeapon !== null,
    );
  }

  private transitionTo(
    scene: SceneId,
    from: SceneId,
    afterSwitch?: () => void,
  ): void {
    if (this.transitionDir !== 0) return;
    this.transitionDir = 1;
    this.pendingTransition = () => {
      this.activeScene = scene;
      this.ui.currentScene = scene;
      if (scene === 'dungeon') {
        this.ui.shopIsOpen = false;
        this.dungeonScene.startRun();
      } else if (scene === 'hub') {
        this.ui.shopIsOpen = false;
        this.hubScene.onEnter(from === 'dungeon' ? 'dungeon' : 'shop');
      } else {
        this.shopScene.onEnter(from === 'hub');
        this.ui.shopIsOpen = false;
      }
      this.ui.renderHud();
      this.syncTouch();
      if (afterSwitch) afterSwitch();
    };
  }

  private handleReturnFromDungeon(summary: RunSummary): void {
    this.transitionTo('hub', 'dungeon', () => {
      this.ui.openRunSummaryModal(summary);
    });
  }

  private handleGlobalShortcuts(): void {
    if (this.ui.titleVisible) return;

    if (this.input.wasPressed('Escape', true)) {
      if (this.ui.modalOpen) {
        sound.playUiClick();
        this.ui.closeModal();
      }
      return;
    }

    if (this.input.wasPressed('KeyI', true) || this.input.wasPressed('Tab', true)) {
      sound.playUiClick();
      if (this.ui.modalOpen) {
        this.ui.closeModal();
      } else {
        this.ui.openInventoryModal(this.activeScene === 'shop', 'bag');
      }
      return;
    }

    if (this.input.wasPressed('KeyC', false) && this.activeScene !== 'dungeon') {
      this.handleSwapWeapon();
      return;
    }

    if (this.input.wasPressed('KeyM', false)) {
      const muted = sound.toggleMute();
      this.state.muted = muted;
      this.state.save();
      this.ui.renderHud();
    }
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.handleGlobalShortcuts();

    if (this.transitionDir === 1) {
      this.transitionAlpha += dt * 3.8;
      if (this.transitionAlpha >= 1) {
        this.transitionAlpha = 1;
        this.transitionDir = -1;
        if (this.pendingTransition) {
          const fn = this.pendingTransition;
          this.pendingTransition = null;
          fn();
        }
      }
    } else if (this.transitionDir === -1) {
      this.transitionAlpha -= dt * 3.2;
      if (this.transitionAlpha <= 0) {
        this.transitionAlpha = 0;
        this.transitionDir = 0;
      }
    }

    if (this.activeScene === 'shop') {
      if (!this.ui.modalOpen) this.shopScene.update(dt, this.input);
    } else if (this.activeScene === 'hub') {
      if (!this.ui.modalOpen && !this.ui.titleVisible) this.hubScene.update(dt, this.input);
    } else if (!this.ui.modalOpen && !this.ui.titleVisible) {
      this.dungeonScene.update(dt, this.input);
    }

    this.ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    if (this.activeScene === 'shop') {
      this.shopScene.render(this.ctx);
    } else if (this.activeScene === 'hub') {
      this.hubScene.render(this.ctx);
    } else {
      this.dungeonScene.render(this.ctx, this.input);
    }

    if (this.transitionAlpha > 0) {
      this.ctx.fillStyle = `rgba(10, 18, 30, ${this.transitionAlpha})`;
      this.ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
}

new StarlighterGame();
