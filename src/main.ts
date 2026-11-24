import './style.css';
import { preloadHDArt } from './assets/artLoader';
import { getAtlas } from './assets/sprites';
import { sound } from './engine/audio';
import { InputManager, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './engine/input';
import { DungeonScene } from './scenes/DungeonScene';
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

    // Warm up fallback pixel atlas & preload HD Moonlighter art assets
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
        this.ui.toast('Willkommen in Astro-Barter! Lege Relikte aus oder starte rechts eine Expedition!', 'good');
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
      onOpenWorkbench: () => this.ui.openWorkbenchModal(),
      onOpenChest: () => this.ui.openInventoryModal(true, 'bag'),
      onEnterDungeon: () => this.transitionTo('dungeon'),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
      onHudDirty: () => {
        this.ui.shopIsOpen = this.shopScene.shopOpen;
        this.ui.renderHud();
        this.syncTouch();
      },
    });

    this.dungeonScene = new DungeonScene(this.state, {
      onReturnToShop: (summary) => this.handleReturnToShop(summary),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
      onHudDirty: () => this.ui.renderHud(),
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

  private syncTouch(): void {
    if (!this.touch || !this.ui) return;
    this.touch.setState(
      this.activeScene,
      this.activeScene === 'shop' && this.shopScene?.shopOpen,
      this.ui.modalOpen || this.ui.titleVisible,
    );
  }

  private transitionTo(scene: SceneId, afterSwitch?: () => void): void {
    if (this.transitionDir !== 0) return;
    this.transitionDir = 1;
    this.pendingTransition = () => {
      this.activeScene = scene;
      this.ui.currentScene = scene;
      if (scene === 'dungeon') {
        this.ui.shopIsOpen = false;
        this.dungeonScene.startRun();
      } else {
        this.shopScene.onEnter(true);
        this.ui.shopIsOpen = false;
      }
      this.ui.renderHud();
      this.syncTouch();
      if (afterSwitch) afterSwitch();
    };
  }

  private handleReturnToShop(summary: RunSummary): void {
    this.transitionTo('shop', () => {
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

    // Scene transition fade logic
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

    // Update active scene (keep shop animations softly alive behind title!)
    if (this.activeScene === 'shop') {
      if (!this.ui.modalOpen) {
        this.shopScene.update(dt, this.input);
      }
    } else if (!this.ui.modalOpen && !this.ui.titleVisible) {
      this.dungeonScene.update(dt, this.input);
    }

    // Render 2x HD pixel-art world
    this.ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    if (this.activeScene === 'shop') {
      this.shopScene.render(this.ctx);
    } else {
      this.dungeonScene.render(this.ctx, this.input);
    }

    // Scene warp fade overlay
    if (this.transitionAlpha > 0) {
      this.ctx.fillStyle = `rgba(10, 18, 30, ${this.transitionAlpha})`;
      this.ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
}

new StarlighterGame();
