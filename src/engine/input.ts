export const VIRTUAL_WIDTH = 480;
export const VIRTUAL_HEIGHT = 270;

export class InputManager {
  private keysHeld = new Set<string>();
  private keysPressed = new Set<string>();
  private mouseLeftHeld = false;
  private mouseLeftPressed = false;
  private mouseRightHeld = false;
  private mouseRightPressed = false;
  private mousePos = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
  private mouseActive = false;
  private canvas: HTMLCanvasElement;
  public locked = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
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
      this.mouseLeftHeld = false;
      this.mouseRightHeld = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.updateMousePosition(e);
      this.mouseActive = true;
    });

    this.canvas.addEventListener('mousedown', (e) => {
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

  public isDown(code: string): boolean {
    if (this.locked) return false;
    return this.keysHeld.has(code);
  }

  public wasPressed(code: string, ignoreLock = false): boolean {
    if (this.locked && !ignoreLock) return false;
    return this.keysPressed.has(code);
  }

  public getMoveVector(): { x: number; y: number } {
    if (this.locked) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) y -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) y += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) x -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) x += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  public primaryPressed(): boolean {
    if (this.locked) return false;
    return this.mouseLeftPressed || this.keysPressed.has('KeyJ');
  }

  public secondaryHeld(): boolean {
    if (this.locked) return false;
    return this.mouseRightHeld || this.keysHeld.has('KeyK');
  }

  public secondaryPressed(): boolean {
    if (this.locked) return false;
    return this.mouseRightPressed || this.keysPressed.has('KeyK');
  }

  public dashPressed(): boolean {
    if (this.locked) return false;
    return this.keysPressed.has('Space') || this.keysPressed.has('ShiftLeft');
  }

  public interactPressed(): boolean {
    if (this.locked) return false;
    return this.keysPressed.has('KeyE') || this.keysPressed.has('Enter');
  }

  public healPressed(): boolean {
    if (this.locked) return false;
    return this.keysPressed.has('KeyQ');
  }

  public warpHeld(): boolean {
    if (this.locked) return false;
    return this.keysHeld.has('KeyR');
  }

  public getMousePos(): { x: number; y: number } {
    return { ...this.mousePos };
  }

  public isMouseActive(): boolean {
    return this.mouseActive;
  }

  public endFrame(): void {
    this.keysPressed.clear();
    this.mouseLeftPressed = false;
    this.mouseRightPressed = false;
  }
}
