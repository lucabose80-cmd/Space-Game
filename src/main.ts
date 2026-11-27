import './style.css';
import { preloadHDArt } from './assets/artLoader';
import { getAtlas } from './assets/sprites';
import { MARKET_EVENT_META } from './data/companions';
import { NPC_META, TRUST_PERKS } from './data/story/storyChapters';
import { STORY_SCENES } from './data/story/storyScenes';
import { sound } from './engine/audio';
import { InputManager, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './engine/input';
import { BackroomScene } from './scenes/BackroomScene';
import type { DungeonScene } from './scenes/DungeonScene';
import { HangarScene } from './scenes/HangarScene';
import { HubScene } from './scenes/HubScene';
import { MarketTerraceScene } from './scenes/MarketTerraceScene';
import { ShopScene } from './scenes/ShopScene';
import { firebaseService } from './services/firebaseService';
import { galacticNetwork } from './services/galacticNetwork';
import { GameState } from './systems/gameState';
import type { BossLab } from './dev/bossLab';
import type { StoryResult } from './ui/StoryModals';
import type { MusicTrack, RunSummary, SceneId, SectorId, StoryNpcId, WeeklyTrialInfo } from './types';
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
  private backroomScene: BackroomScene;
  private hubScene: HubScene;
  private hangarScene: HangarScene;
  private marketTerraceScene: MarketTerraceScene;
  /** Perf Teil 3: Dungeon-Code (eigener Chunk) lädt nach dem Start nach; bis dahin `null`. */
  private dungeonScene: DungeonScene | null = null;
  /** Wird fertig, sobald die Dungeon-Szene geladen und erzeugt ist (Tests: `await __game.dungeonReady`). */
  public dungeonReady: Promise<DungeonScene>;
  /** Behelfsmäßiges Boss-Labor (nur mit ?bosslab in der Adresse) */
  private bossLab: BossLab | null = null;

  private activeScene: SceneId = 'shop';
  private pendingDungeonSector: SectorId = 1;
  private pendingEndlessRift = false;
  private pendingWeeklyTrial: WeeklyTrialInfo | null = null;
  private lastReturnedSector: SectorId = 1;
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
      sound.setMusicMuted(this.state.musicMuted);
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
          this.ui.openInventoryModal(
            this.activeScene === 'shop' || this.activeScene === 'backroom',
            'bag',
          );
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
        this.shopScene.onEnter('default');
        this.ui.shopIsOpen = false;
        this.syncMusic();
        this.ui.renderHud();
        this.syncTouch();
        this.ui.toast(
          'Willkommen in Astro-Barter! Hinten links: Kapitäns-Quartier (Bett, Truhen, Drohnen & Logbuch), rechts: Port Solaris!',
          'good',
        );
      },
      onContinueGame: () => {
        this.state.load();
        sound.setMuted(this.state.muted);
        sound.setMusicMuted(this.state.musicMuted);
        this.activeScene = 'shop';
        this.ui.currentScene = 'shop';
        this.shopScene.onEnter('default');
        this.ui.shopIsOpen = false;
        this.syncMusic();
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
      onMusicToggle: () => {
        const musicMuted = sound.toggleMusicMute();
        this.state.musicMuted = musicMuted;
        this.state.save();
        this.ui.renderHud();
      },
    });

    this.shopScene = new ShopScene(this.state, {
      onOpenPedestal: (ped) => this.ui.openPedestalModal(ped),
      onOpenWorkbench: () => this.ui.openShopUpgradeModal(),
      onEnterBackroom: () => this.transitionTo('backroom', 'shop'),
      onOpenBounties: () => this.ui.openBountiesModal(),
      onOpenSaleBox: () => this.ui.openSaleBoxModal(),
      onOpenHaggle: (payload) =>
        this.ui.openHaggleModal(payload, (res) => {
          this.shopScene.resolveHaggleCheckout(
            payload.customerId,
            res.accepted,
            res.finalPrice,
            res.bonusCredits,
          );
        }),
      onOpenShiftSummary: (summary) => this.ui.openShiftSummaryModal(summary),
      onEnterDungeon: () => this.transitionTo('hub', 'shop'),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
      onHudDirty: () => {
        this.ui.shopIsOpen = this.shopScene.shopOpen;
        this.ui.renderHud();
        this.syncTouch();
      },
    });

    this.backroomScene = new BackroomScene(this.state, {
      onReturnToShop: () => this.transitionTo('shop', 'backroom'),
      onOpenChest: () => this.ui.openInventoryModal(true, 'bag'),
      onOpenLogbook: () => this.ui.openLogbookModal(),
      onOpenWeaponRack: () => this.ui.openLoadoutModal(),
      onOpenCompanionDock: () => this.ui.openCompanionDockModal(),
      onOpenJukebox: () => this.ui.openJukeboxModal(),
      onAdvanceTime: () => this.handleAdvanceTime(),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
    });

    this.hubScene = new HubScene(this.state, {
      onEnterShop: () => this.transitionTo('shop', 'hub'),
      onOpenForge: () => this.withNpcScene('kael', () => this.ui.openForgeModal()),
      onOpenMedBay: () => this.withNpcScene('lyra', () => this.ui.openMedBayModal()),
      onOpenTechLab: () => this.withNpcScene('vex', () => this.ui.openTechLabModal()),
      onOpenBlackMarket: () => this.withNpcScene('nyx', () => this.ui.openBlackMarketModal()),
      onFestivalDue: () => this.startFestival(),
      onOpenGuildBoard: () => this.ui.openGuildBoardModal(),
      onEnterMarketTerrace: () => this.transitionTo('market_terrace', 'hub'),
      onEnterDungeon: () => this.transitionTo('hangar', 'hub'),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
    });

    this.marketTerraceScene = new MarketTerraceScene(this.state, {
      onReturnToHub: () => this.transitionTo('hub', 'market_terrace'),
      onOpenAlchemyBar: () => this.ui.openAlchemyBarModal(),
      onOpenPatrons: () => this.ui.openPatronsModal(false),
      onOpenTradeBank: () => this.ui.openTradeBankModal(),
      onToast: (msg, tone) => this.ui.toast(msg, tone),
    });

    // Seamless Firebase Cloud-Save & Captain Profile Sync on Login (Handy <-> PC)
    firebaseService.onAuthChange((user) => {
      if (!user) return;
      if (!this.state.captainName || this.state.captainName === 'Sternen-Kapitän') {
        this.state.captainName = user.displayName;
      }
      galacticNetwork.prefetchGhostCaptains();
      void firebaseService.downloadCloudSave().then((res) => {
        if (res.ok && res.saveJson && firebaseService.isCloudSaveAhead(this.state, res.saveJson)) {
          const imp = this.state.importSaveJson(res.saveJson);
          if (imp.ok) {
            this.ui.renderHud();
            this.ui.toast(`☁ Cloud-Spielstand von ${user.displayName} geladen (Tag ${this.state.day})!`, 'good');
            this.ui.refreshGuildBoardIfOpen();
          }
        } else {
          void firebaseService.syncAllToCloud(this.state).then((syncRes) => {
            if (syncRes.ok) {
              this.ui.toast('☁ Spielstand automatisch mit der Cloud synchronisiert!', 'good');
            }
            this.ui.refreshGuildBoardIfOpen();
          });
        }
      });
    });

    this.hangarScene = new HangarScene(this.state, {
      onReturnToHub: () => this.transitionTo('hub', 'hangar'),
      onLaunchSector1: () => {
        this.pendingDungeonSector = 1;
        this.pendingEndlessRift = false;
        this.pendingWeeklyTrial = null;
        this.transitionTo('dungeon', 'hangar');
      },
      onLaunchSector2: () => {
        this.pendingDungeonSector = 2;
        this.pendingEndlessRift = false;
        this.pendingWeeklyTrial = null;
        this.transitionTo('dungeon', 'hangar');
      },
      onLaunchSector3: () => {
        this.pendingDungeonSector = 3;
        this.pendingEndlessRift = false;
        this.pendingWeeklyTrial = null;
        this.transitionTo('dungeon', 'hangar');
      },
      onLaunchSector4: () => {
        this.pendingDungeonSector = 4;
        this.pendingEndlessRift = false;
        this.pendingWeeklyTrial = null;
        this.transitionTo('dungeon', 'hangar');
      },
      onLaunchOmegaGate: () => {
        this.ui.openOmegaGateModal(
          () => {
            this.pendingDungeonSector = 5;
            this.pendingEndlessRift = false;
            this.pendingWeeklyTrial = null;
            this.transitionTo('dungeon', 'hangar');
          },
          () => {
            this.pendingDungeonSector = 5;
            this.pendingEndlessRift = true;
            this.pendingWeeklyTrial = null;
            this.transitionTo('dungeon', 'hangar');
          },
          (info) => {
            this.pendingDungeonSector = info.sector;
            this.pendingEndlessRift = false;
            this.pendingWeeklyTrial = info;
            this.transitionTo('dungeon', 'hangar');
          },
        );
      },
      onToast: (msg, tone) => this.ui.toast(msg, tone),
    });

    this.dungeonReady = this.loadDungeon();

    this.shopScene.onEnter('default');
    this.syncMusic();
    this.ui.showTitle();
    this.syncTouch();
    if ([...new URLSearchParams(window.location.search).keys()].some((k) => k.toLowerCase() === 'bosslab')) this.startBossLab();

    this.canvas.addEventListener('pointerdown', () => {
      sound.unlock();
      window.focus();
      this.canvas.focus({ preventScroll: true });
    });
    window.addEventListener('pointerdown', () => sound.unlock(), { once: true });
    // App/Tab im Hintergrund: Musik anhalten, speichern, ausstehenden Cloud-Sync sofort senden
    const onHidden = (): void => {
      sound.suspendForBackground();
      if (!this.ui.titleVisible) this.state.save(); // am Titelbild nichts überschreiben
      firebaseService.flushAutoSync(this.state);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHidden();
      else sound.resumeFromBackground();
    });
    window.addEventListener('pagehide', onHidden);
    window.addEventListener('keydown', () => sound.unlock(), { once: true });

    // Nur im Vite-Dev-Server (Headless-Tests): Spielinstanz erreichbar machen. Im Produktions-Build entfällt das.
    if (import.meta.env.DEV) {
      (window as unknown as { __game?: StarlighterGame }).__game = this;
    }

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ==================== DUNGEON-CODE NACHLADEN (Perf Teil 3) ====================
  private get dng(): DungeonScene {
    if (!this.dungeonScene) throw new Error('Dungeon-Szene noch nicht geladen (dungeonReady abwarten)');
    return this.dungeonScene;
  }

  private loadDungeon(): Promise<DungeonScene> {
    return import('./scenes/DungeonScene').then(({ DungeonScene }) => {
      const d = new DungeonScene(this.state, {
        onReturnToHub: (summary) => this.handleReturnFromDungeon(summary),
        onOpenDungeonChest: (chest) => this.ui.openDungeonChestModal(chest),
        onToast: (msg, tone) => this.ui.toast(msg, tone),
        onHudDirty: () => {
          this.ui.dungeonSector = this.dng.currentSector;
          this.ui.dungeonFloor = this.dng.currentFloor;
          this.ui.dungeonEndlessRift = this.dng.isEndlessRift;
          this.ui.dungeonWeeklyTrial = this.dng.isWeeklyTrial;
          this.ui.dungeonRiftDepth = this.dng.riftDepth;
          this.ui.renderHud();
          this.syncTouch();
        },
      });
      this.dungeonScene = d;
      return d;
    });
  }

  // ==================== BEHELF: BOSS-LABOR (?bosslab) ====================
  private startBossLab(): void {
    this.ui.hideTitle();
    this.ui.currentScene = 'dungeon';
    this.ui.shopIsOpen = false;
    void Promise.all([this.dungeonReady, import('./dev/bossLab')]).then(([d, { BossLab }]) => {
      this.activeScene = 'dungeon';
      this.bossLab = new BossLab(d, this.state, {
        onSceneChange: () => {
          this.ui.dungeonSector = d.currentSector;
          this.ui.dungeonFloor = d.currentFloor;
          this.ui.dungeonEndlessRift = false;
          this.ui.dungeonWeeklyTrial = false;
          this.ui.renderHud();
          this.syncTouch();
          this.syncMusic();
        },
      });
      this.bossLab.enter();
    });
  }

  // ==================== MEILENSTEIN 10-A: STORY ====================
  /** Offenes Angebot statt Zwang: „Später“ öffnet sofort die gewohnte Station. */
  private withNpcScene(npc: StoryNpcId, open: () => void): void {
    const scene = this.state.getPendingScene(npc);
    if (!scene) {
      open();
      return;
    }
    this.ui.openStoryScene(scene, {
      laterLabel: `Später ▸ ${NPC_META[npc].station}`,
      onLater: () => {
        this.state.markSceneSkipped(scene.id);
        open();
      },
      onFinish: (res) => {
        this.announceStoryResult(res);
        open();
      },
      // ESC / ✕ / Hintergrund: wie „Später“, aber ohne die Station zu öffnen
      onClose: () => this.state.markSceneSkipped(scene.id),
    });
  }

  private announceStoryResult(res: StoryResult): void {
    for (const npc of res.newPerks) {
      const perk = TRUST_PERKS[npc];
      this.ui.toast(`🤝 ${NPC_META[npc].name} vertraut dir: ${perk.name} freigeschaltet — ${perk.description}`, 'good');
    }
    this.ui.renderHud();
  }

  /** Omega-Fest: einmalig, auf der ersten Box überspringbar, in der Chronik wiederholbar. */
  private startFestival(): void {
    if (this.ui.modalOpen || this.ui.titleVisible || this.activeScene !== 'hub') return;
    if (this.state.story.flags.includes('festival_seen')) return;
    const scene = STORY_SCENES.find((x) => x.id === 'event_festival');
    if (!scene) return;
    const done = (): void => {
      this.state.setStoryFlag('festival_seen');
      this.state.markSceneSeen(scene.id);
    };
    this.ui.openStoryScene(scene, {
      laterLabel: 'Überspringen',
      onLater: done,
      onFinish: (res) => {
        done();
        this.announceStoryResult(res);
      },
      onClose: done,
    });
  }

  /** Letzter Stand der Boss-Phase-2 (für den einmaligen Sting pro Wechsel). */
  private lastBossPhase2 = false;

  private syncMusic(): void {
    let desired: MusicTrack;
    if (this.activeScene === 'dungeon') {
      desired = this.dng.isInBossFight()
        ? 'boss'
        : this.dng.currentSector >= 4
          ? 'dungeon_s4'
          : this.dng.currentSector === 3
            ? 'dungeon_s3'
            : this.dng.currentSector === 2
              ? 'dungeon_s2'
              : 'dungeon';
    } else if (
      this.activeScene === 'hub' ||
      this.activeScene === 'hangar' ||
      this.activeScene === 'market_terrace'
    ) {
      desired = 'hub';
    } else if (this.activeScene === 'backroom') {
      desired = 'shop_night';
    } else {
      desired = this.state.timeOfDay === 'night' ? 'shop_night' : 'shop_day';
    }
    sound.setMusicTrack(desired);

    // Milestone 10-A: Boss-Phase-2 → Musik-Intensität + einmaliger Sting pro Wechsel
    const phase2 = this.activeScene === 'dungeon' && this.dng.isBossPhase2Active();
    if (phase2 && !this.lastBossPhase2) sound.playPhaseShiftSting();
    this.lastBossPhase2 = phase2;
    sound.setMusicIntensity(phase2 ? 1 : 0);
  }

  /** Koje: nur nachts nutzbar → „Schicht überspringen“ (Nacht → nächster Tag). */
  private handleAdvanceTime(): void {
    if (this.transitionDir !== 0) return;
    if (this.state.timeOfDay !== 'night') return;
    sound.playDayTransition();
    this.transitionDir = 1;
    this.pendingTransition = () => {
      const res = this.state.startDay();
      this.syncMusic();
      this.ui.renderHud();
      this.syncTouch();
      this.announceTimeChange(res, 'skip');
    };
  }

  /** Toasts nach einem Zeitwechsel (Schicht übersprungen / Nacht-Run beendet / Tag-Run beendet). */
  private announceTimeChange(
    res: ReturnType<GameState['startDay']>,
    reason: 'skip' | 'night_run' | 'day_run',
  ): void {
    if (res.newDay) {
      const ev = MARKET_EVENT_META[res.marketEvent];
      const evNote = res.marketEvent !== 'normal' ? ` · ★ Event: ${ev.name}!` : '';
      this.ui.toast(
        reason === 'night_run'
          ? `☀ Der Morgen graut — die Ladenschicht ist ausgefallen. Tag ${res.day} beginnt mit frischen Aufträgen & Nyx-Ware!${evNote}`
          : `☀ Guten Morgen! Tag ${res.day} beginnt — frische Aufträge & Nyx-Ware!${evNote}`,
        'good',
      );
    } else {
      this.ui.toast(
        `🌙 Die Nacht bricht an (Tag ${res.day}) — Zeit, den Laden zu öffnen! Ein Nacht-Run gäbe +35 % seltene Beute, kostet aber die Ladenschicht.`,
        'info',
      );
    }
    if (res.maturedBankCount > 0) {
      this.ui.toast(
        `🏦 ${res.maturedBankCount} Handelsroute(n) abgeschlossen! Auszahlung auf der Marktplatz-Terrasse abholen!`,
        'good',
      );
    }
  }

  private handleSwapWeapon(): void {
    if (this.activeScene === 'dungeon') {
      this.dng.swapWeapon();
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
    // Perf Teil 3: Dungeon-Code evtl. noch nicht geladen (Normalfall: längst da) → erst abwarten, dann Übergang starten
    if (scene === 'dungeon' && !this.dungeonScene) {
      void this.dungeonReady.then(() => this.transitionTo(scene, from, afterSwitch));
      return;
    }
    this.transitionDir = 1;
    this.pendingTransition = () => {
      this.activeScene = scene;
      this.ui.currentScene = scene;
      if (scene === 'dungeon') {
        this.ui.shopIsOpen = false;
        if (this.pendingWeeklyTrial) {
          this.dng.startWeeklyTrial(this.pendingWeeklyTrial);
          this.pendingWeeklyTrial = null;
        } else if (this.pendingEndlessRift) {
          this.dng.startEndlessRift();
        } else {
          this.dng.startRun(this.pendingDungeonSector);
        }
        this.ui.dungeonSector = this.dng.currentSector;
        this.ui.dungeonFloor = this.dng.currentFloor;
        this.ui.dungeonEndlessRift = this.dng.isEndlessRift;
        this.ui.dungeonWeeklyTrial = this.dng.isWeeklyTrial;
        this.ui.dungeonRiftDepth = this.dng.riftDepth;
      } else if (scene === 'hangar') {
        this.ui.shopIsOpen = false;
        this.hangarScene.onEnter(from === 'dungeon' ? 'dungeon' : 'hub', this.lastReturnedSector);
      } else if (scene === 'market_terrace') {
        this.ui.shopIsOpen = false;
        this.marketTerraceScene.onEnter();
      } else if (scene === 'hub') {
        this.ui.shopIsOpen = false;
        this.hubScene.onEnter(
          from === 'hangar' || from === 'dungeon'
            ? 'dungeon'
            : from === 'market_terrace'
              ? 'market_terrace'
              : 'shop',
        );
      } else if (scene === 'backroom') {
        this.ui.shopIsOpen = false;
        this.backroomScene.onEnter();
      } else {
        this.shopScene.onEnter(from === 'hub' ? 'hub' : from === 'backroom' ? 'backroom' : 'default');
        this.ui.shopIsOpen = false;
      }
      this.syncMusic();
      this.ui.renderHud();
      this.syncTouch();
      if (afterSwitch) afterSwitch();
    };
  }

  private handleReturnFromDungeon(summary: RunSummary): void {
    if (this.bossLab) {
      this.bossLab.onReturnAttempt(); // Boss-Labor: nie wirklich zurückkehren
      return;
    }
    const newChapter = this.state.refreshStoryChapter();
    if (newChapter !== null) {
      this.ui.toast(`📜 ${this.state.getStoryChapterTitle()} — auf Port Solaris gibt es Neuigkeiten!`, 'info');
    }
    if (summary.isWeeklyTrial) {
      // Prüfung startet am 5. Tor → Rückkehr ebenfalls dort; Ergebnis sofort, Upload im Hintergrund
      this.lastReturnedSector = 5;
      this.ui.dungeonWeeklyTrial = false;
      this.transitionTo('hangar', 'dungeon', () => {
        const setStatus = this.ui.openWeeklyTrialResultModal(summary);
        void galacticNetwork.submitWeeklyTrial(this.state).then((res) => {
          if (res.ok) {
            this.state.save();
            setStatus('☁ Ergebnis an die Kapitäns-Tafel gemeldet!', 'good');
          } else if (res.reason === 'not_logged_in' || res.reason === 'offline') {
            setStatus('Lokal gespeichert — melde dich an der Kapitäns-Tafel an, um an der Wochen-Rangliste teilzunehmen.', 'warn');
          } else {
            setStatus('Wochen-Rangliste gerade nicht erreichbar — Ergebnis lokal gespeichert, Upload folgt automatisch.', 'warn');
          }
        });
      });
      return;
    }
    // M10-C Tag/Nacht-Schleife: Tag-Run → danach Nacht · Nacht-Run → danach Tag (Ladenschicht fällt aus)
    const wasNightRun = this.state.timeOfDay === 'night';
    const timeRes = wasNightRun ? this.state.startDay() : this.state.startNight();
    this.announceTimeChange(timeRes, wasNightRun ? 'night_run' : 'day_run');
    this.lastReturnedSector = summary.sector ?? 1;
    this.transitionTo('hangar', 'dungeon', () => {
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
        this.ui.openInventoryModal(
          this.activeScene === 'shop' || this.activeScene === 'backroom',
          'bag',
        );
      }
      return;
    }

    if (this.input.wasPressed('KeyC', false) && this.activeScene !== 'dungeon') {
      this.handleSwapWeapon();
      return;
    }

    if (this.input.wasPressed('KeyM', false)) {
      const musicMuted = sound.toggleMusicMute();
      this.state.musicMuted = musicMuted;
      this.state.save();
      this.ui.renderHud();
    }
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.input.pollGamepad();
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
      if (!this.ui.modalOpen && !this.ui.titleVisible) this.shopScene.update(dt, this.input);
    } else if (this.activeScene === 'backroom') {
      if (!this.ui.modalOpen && !this.ui.titleVisible) this.backroomScene.update(dt, this.input);
    } else if (this.activeScene === 'hub') {
      if (!this.ui.modalOpen && !this.ui.titleVisible) this.hubScene.update(dt, this.input);
    } else if (this.activeScene === 'market_terrace') {
      if (!this.ui.modalOpen && !this.ui.titleVisible) this.marketTerraceScene.update(dt, this.input);
    } else if (this.activeScene === 'hangar') {
      if (!this.ui.modalOpen && !this.ui.titleVisible) this.hangarScene.update(dt, this.input);
    } else if (!this.ui.modalOpen && !this.ui.titleVisible) {
      this.dng.update(this.bossLab ? this.bossLab.scaleDt(dt) : dt, this.input);
      this.bossLab?.afterUpdate(dt);
    }

    // Keep retro-synth zone & boss music dynamically synced!
    this.syncMusic();

    this.ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    if (this.activeScene === 'shop') {
      this.shopScene.render(this.ctx);
    } else if (this.activeScene === 'backroom') {
      this.backroomScene.render(this.ctx);
    } else if (this.activeScene === 'hub') {
      this.hubScene.render(this.ctx);
    } else if (this.activeScene === 'market_terrace') {
      this.marketTerraceScene.render(this.ctx);
    } else if (this.activeScene === 'hangar') {
      this.hangarScene.render(this.ctx);
    } else {
      this.dng.render(this.ctx, this.input);
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
