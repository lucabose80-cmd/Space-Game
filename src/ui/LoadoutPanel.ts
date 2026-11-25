// M10-C (U3): Waffen-Loadout-Panel — zwei große Slots ①/② plus Waffenliste mit „→ ①“ / „→ ②“.
// Eine Quelle für Waffenschrank (Hinterzimmer), Fracht-Modal und Schmiede.
import { WEAPON_META } from '../data/upgrades';
import type { GameState } from '../systems/gameState';
import type { WeaponId } from '../types';

const ALL_WEAPONS: WeaponId[] = ['blade', 'spear', 'fists', 'discus', 'blaster', 'hammer'];

function slotHtml(state: GameState, slot: 1 | 2): string {
  const wid = slot === 1 ? state.equippedWeapon : state.secondaryWeapon;
  const label = slot === 1 ? '① HAUPTWAFFE' : '② ZWEITWAFFE [C]';
  if (!wid) {
    return `<div class="lo-slot empty"><div class="lo-slot-label">${label}</div><div class="lo-slot-empty">— leer —</div></div>`;
  }
  const m = WEAPON_META[wid];
  const lvl = (state.upgrades as unknown as Record<string, number>)[wid] ?? 0;
  return `
    <div class="lo-slot ${slot === 1 ? 'main' : 'sec'}" style="--lo-accent:${m.accentColor}">
      <div class="lo-slot-label">${label}</div>
      <div class="lo-slot-body">
        <img src="${m.iconUrl}" alt="${m.name}" class="lo-icon" />
        <div>
          <div class="lo-name">${m.name}</div>
          <div class="lo-sub">Stufe ${lvl} · ${m.shortName}</div>
        </div>
      </div>
      ${slot === 2 ? '<button class="btn lo-clear" data-lo-clear2="1" title="Zweitwaffe entfernen">② leeren</button>' : ''}
    </div>`;
}

export function renderLoadoutHtml(state: GameState, opts?: { compact?: boolean }): string {
  const compact = opts?.compact === true;
  const hasSec = state.secondaryWeapon !== null;
  const cards = ALL_WEAPONS.filter((id) => state.unlockedWeapons[id])
    .map((wid) => {
      const m = WEAPON_META[wid];
      const isMain = state.equippedWeapon === wid;
      const isSec = state.secondaryWeapon === wid;
      const lvl = (state.upgrades as unknown as Record<string, number>)[wid] ?? 0;
      const to1Off = isMain;
      // Hauptwaffe → ② ist nur ein Tausch und braucht eine vorhandene Zweitwaffe
      const to2Off = isSec || (isMain && !hasSec);
      return `
        <div class="lo-card ${isMain ? 'is-main' : isSec ? 'is-sec' : ''}" style="--lo-accent:${m.accentColor}">
          <img src="${m.iconUrl}" alt="${m.name}" class="lo-icon small" />
          <div class="lo-card-text">
            <span class="lo-name">${m.name}</span>
            <span class="lo-sub">Stufe ${lvl}${isMain ? ' · ① aktiv' : isSec ? ' · ② [C]' : ''}</span>
          </div>
          <div class="lo-card-btns">
            <button class="btn lo-assign" data-lo-assign="${wid}:1" ${to1Off ? 'disabled' : ''}>→ ①</button>
            <button class="btn lo-assign" data-lo-assign="${wid}:2" ${to2Off ? 'disabled' : ''}>→ ②</button>
          </div>
        </div>`;
    })
    .join('');
  return `
    <div class="loadout ${compact ? 'compact' : ''}">
      <div class="lo-slots">
        ${slotHtml(state, 1)}
        <button class="btn lo-swap" data-lo-swap="1" ${hasSec ? '' : 'disabled'} title="Haupt- und Zweitwaffe tauschen [C im Dungeon]">⇄ Tauschen</button>
        ${slotHtml(state, 2)}
      </div>
      <div class="lo-list">${cards}</div>
    </div>`;
}

export function bindLoadout(root: HTMLElement, state: GameState, onChange: () => void): void {
  root.querySelector('[data-lo-swap]')?.addEventListener('click', () => {
    if (state.swapEquippedWeapons()) onChange();
  });
  root.querySelector('[data-lo-clear2]')?.addEventListener('click', () => {
    state.clearSecondaryWeapon();
    onChange();
  });
  root.querySelectorAll<HTMLElement>('[data-lo-assign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [wid, slot] = (btn.dataset.loAssign ?? '').split(':');
      state.equipWeapon(wid as WeaponId, slot === '2' ? 'secondary' : 'primary');
      onChange();
    });
  });
}
