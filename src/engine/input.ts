export const VIRTUAL_WIDTH = 480;
export const VIRTUAL_HEIGHT = 270;

export class InputManager {
  private keysHeld = new Set<string>();
  private keysPressed = new Set<string>();
  private touchHeld = new Set<string>();
  private touchPressed = new Set<string>();
  private touchMove = { x: 0, y: 0 };
  private mouseLeftHeld = false;
  private mouseLeftPressed = false;
  private mouseRightHeld = false;
  private mouseRightPressed = false;
  private mousePos = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
  private mouseActive = false;
  private touchActive = false;
  private gamepadHeld = new Set<string>();
  private gamepadPressed = new Set<string>();
  private gamepadMove = { x: 0, y: 0 };
  public gamepadConnected = false;
  private canvas: HTMLCanvasElement;
  public locked = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  public pollGamepad(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let activePad: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i]!.connected) {
        activePad = pads[i];
        break;
      }
    }
    this.gamepadConnected = activePad !== null;
    if (!activePad) {
      this.gamepadMove.x = 0;
      this.gamepadMove.y = 0;
      this.gamepadHeld.clear();
      return;
    }

    // Left stick + D-Pad movement with deadzone 0.22
    let gx = Math.abs(activePad.axes[0] ?? 0) > 0.22 ? (activePad.axes[0] ?? 0) : 0;
    let gy = Math.abs(activePad.axes[1] ?? 0) > 0.22 ? (activePad.axes[1] ?? 0) : 0;
    if (activePad.buttons[12]?.pressed) gy = -1;
    if (activePad.buttons[13]?.pressed) gy = 1;
    if (activePad.buttons[14]?.pressed) gx = -1;
    if (activePad.buttons[15]?.pressed) gx = 1;
    const len = Math.hypot(gx, gy);
    if (len > 1) {
      gx /= len;
      gy /= len;
    }
    this.gamepadMove.x = gx;
    this.gamepadMove.y = gy;
    if (len > 0.25) this.mouseActive = false;

    // Standard Gamepad Mapping (Xbox / DualSense / Switch Pro):
    // A(0)=Attack, B(1)=Secondary/Shield, X(2)=Dash, Y(3)=Interact, LB(4)=Heal, RB(5)=Swap, LT(6)=Warp, RT(7)=Attack, Select(8)=Bag, Start(9)=ESC
    const btnMap: Array<[number, string]> = [
      [0, 'KeyJ'],
      [7, 'KeyJ'],
      [1, 'KeyK'],
      [2, 'Space'],
      [3, 'KeyE'],
      [4, 'KeyQ'],
      [5, 'KeyC'],
      [6, 'KeyR'],
      [8, 'KeyI'],
      [9, 'Escape'],
    ];
    const nextHeld = new Set<string>();
    for (const [idx, code] of btnMap) {
      if (activePad.buttons[idx]?.pressed) {
        nextHeld.add(code);
        if (!this.gamepadHeld.has(code)) {
          this.gamepadPressed.add(code);
          this.mouseActive = false;
        }
      }
    }
    this.gamepadHeld = nextHeld;
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) {
        if (!this.locked || code === 'Tab') {
          e.preventDefault();
        }
      }
      if (!this.keysHeld.has(code)) {
        this.keysPressed.add(code);
      }
      this.keysHeld.add(code);
    });

    window.addEventListener('keyup', (e) => {
      this.keysHeld.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysHeld.clear();
      this.touchHeld.clear();
      this.gamepadHeld.clear();
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      this.gamepadMove.x = 0;
      this.gamepadMove.y = 0;
      this.mouseLeftHeld = false;
      this.mouseRightHeld = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.touchActive) return;
      this.updateMousePosition(e);
      this.mouseActive = true;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.touchActive) return;
      this.updateMousePosition(e);
      this.mouseActive = true;
      if (this.locked) return;
      if (e.button === 0) {
        if (!this.mouseLeftHeld) this.mouseLeftPressed = true;
        this.mouseLeftHeld = true;
      } else if (e.button === 2) {
        if (!this.mouseRightHeld) this.mouseRightPressed = true;
        this.mouseRightHeld = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeftHeld = false;
      if (e.button === 2) this.mouseRightHeld = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private updateMousePosition(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * VIRTUAL_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT;
    this.mousePos.x = Math.max(0, Math.min(VIRTUAL_WIDTH, x));
    this.mousePos.y = Math.max(0, Math.min(VIRTUAL_HEIGHT, y));
  }

  public setTouchMode(active: boolean): void {
    this.touchActive = active;
    if (active) this.mouseActive = false;
  }

  public isTouchMode(): boolean {
    return this.touchActive;
  }

  public setTouchMove(x: number, y: number): void {
    this.touchActive = true;
    this.mouseActive = false;
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  public setTouchAction(code: string, down: boolean): void {
    this.touchActive = true;
    this.mouseActive = false;
    if (down) {
      if (!this.touchHeld.has(code)) {
        this.touchPressed.add(code);
      }
      this.touchHeld.add(code);
    } else {
      this.touchHeld.delete(code);
    }
  }

  public clearTouchState(): void {
    this.touchHeld.clear();
    this.touchMove.x = 0;
    this.touchMove.y = 0;
  }

  public isDown(code: string): boolean {
    if (this.locked) return false;
    return this.keysHeld.has(code) || this.touchHeld.has(code) || this.gamepadHeld.has(code);
  }

  public wasPressed(code: string, ignoreLock = false): boolean {
    if (this.locked && !ignoreLock) return false;
    return this.keysPressed.has(code) || this.touchPressed.has(code) || this.gamepadPressed.has(code);
  }

  public getMoveVector(): { x: number; y: number } {
    if (this.locked) return { x: 0, y: 0 };
    let x = this.touchMove.x + this.gamepadMove.x;
    let y = this.touchMove.y + this.gamepadMove.y;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) y -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) y += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) x -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  public primaryPressed(): boolean {
    if (this.locked) return false;
    return (
      this.mouseLeftPressed ||
      this.keysPressed.has('KeyJ') ||
      this.touchPressed.has('KeyJ') ||
      this.gamepadPressed.has('KeyJ')
    );
  }

  public secondaryHeld(): boolean {
    if (this.locked) return false;
    return (
      this.mouseRightHeld ||
      this.keysHeld.has('KeyK') ||
      this.touchHeld.has('KeyK') ||
      this.gamepadHeld.has('KeyK')
    );
  }

  public secondaryPressed(): boolean {
    if (this.locked) return false;
    return (
      this.mouseRightPressed ||
      this.keysPressed.has('KeyK') ||
      this.touchPressed.has('KeyK') ||
      this.gamepadPressed.has('KeyK')
    );
  }

  public dashPressed(): boolean {
    if (this.locked) return false;
    return (
      this.keysPressed.has('Space') ||
      this.keysPressed.has('ShiftLeft') ||
      this.touchPressed.has('Space') ||
      this.gamepadPressed.has('Space')
    );
  }

  public interactPressed(): boolean {
    if (this.locked) return false;
    return (
      this.keysPressed.has('KeyE') ||
      this.keysPressed.has('Enter') ||
      this.touchPressed.has('KeyE') ||
      this.gamepadPressed.has('KeyE')
    );
  }

  public healPressed(): boolean {
    if (this.locked) return false;
    return this.keysPressed.has('KeyQ') || this.touchPressed.has('KeyQ') || this.gamepadPressed.has('KeyQ');
  }

  public warpHeld(): boolean {
    if (this.locked) return false;
    return this.keysHeld.has('KeyR') || this.touchHeld.has('KeyR') || this.gamepadHeld.has('KeyR');
  }

  public getMousePos(): { x: number; y: number } {
    return { ...this.mousePos };
  }

  public isMouseActive(): boolean {
    return this.mouseActive;
  }

  public endFrame(): void {
    this.keysPressed.clear();
    this.touchPressed.clear();
    this.gamepadPressed.clear();
    this.mouseLeftPressed = false;
    this.mouseRightPressed = false;
  }
}
