// Weapons: each has a combo chain (light attacks in order), a charged heavy, and numbers that shape the feel.
// dur = seconds per swing, dmg = base damage, poise = stagger damage, knock = shove, len = reach of the hit
// segment from the hand, hitT = [start, end] of the active window (fraction of the swing).
import { T } from '../world/tiles.js';

export const WEAPONS = {
  w_blade: {
    name: 'Blade', desc: 'Balanced cuts. Three-step chain, a rising cleave when charged.',
    len: 30, dmg: 10, poise: 10, knock: 1, speed: 1, mine: 1,
    chain: [{ k: 'side', dur: 0.28 }, { k: 'side2', dur: 0.28 }, { k: 'sweep', dur: 0.42, mult: 1.5, ender: true }],
    heavy: { k: 'cleave', dur: 0.5, mult: 2.4, poise: 3 },
  },
  w_spear: {
    name: 'Spear', desc: 'Long reach. Quick thrusts, a wide sweep, a lunging charge.',
    len: 54, back: 16, dmg: 9, poise: 8, knock: 1.2, speed: 1,
    chain: [{ k: 'thrust', dur: 0.26 }, { k: 'thrust2', dur: 0.26 }, { k: 'sweep', dur: 0.46, mult: 1.6, ender: true }],
    heavy: { k: 'lunge', dur: 0.48, mult: 2.3, poise: 2.5, dash: 620 },
  },
  w_hammer: {
    name: 'Greathammer', desc: 'Slow, crushing. Breaks guards and blocks; the charged slam shakes the ground.',
    len: 34, dmg: 22, poise: 30, knock: 1.8, speed: 0.62, mine: 1.8,
    chain: [{ k: 'hsmash', dur: 0.5 }, { k: 'hsmash2', dur: 0.5 }, { k: 'slam', dur: 0.62, mult: 1.6, ender: true, quake: true }],
    heavy: { k: 'slam', dur: 0.7, mult: 2.6, poise: 3, quake: true, breaks: true },
  },
  w_daggers: {
    name: 'Twin daggers', desc: 'Very fast. Five-step chain that makes Hollows bleed; a whirling charge.',
    len: 19, dmg: 6, poise: 5, knock: 0.5, speed: 1.5, bleed: true,
    chain: [{ k: 'dag1', dur: 0.17 }, { k: 'dag2', dur: 0.17 }, { k: 'dag1', dur: 0.17 }, { k: 'dag2', dur: 0.17 }, { k: 'flurry', dur: 0.5, mult: 2, ender: true, multi: 3 }],
    heavy: { k: 'flurry', dur: 0.55, mult: 2.2, poise: 2, multi: 4 },
  },
  w_sling: {
    name: 'Sling', desc: 'Ranged. Hurls stone from your satchel (crystal shot pierces). Knocks floating Hollows down.',
    len: 14, dmg: 8, poise: 6, knock: 0.8, speed: 1, ranged: true, ammo: [T.CRYSTAL, T.STONE, T.DIRT, T.SAND, T.DEEP],
    chain: [{ k: 'sling', dur: 0.36 }],
    heavy: { k: 'sling', dur: 0.5, mult: 2, poise: 2, power: 1.5 },
  },
};
export const weaponOf = (sv) => WEAPONS[(sv.equip && sv.equip.weapon) || 'w_blade'] || WEAPONS.w_blade;
export const weaponId = (sv) => (sv.equip && sv.equip.weapon && WEAPONS[sv.equip.weapon]) ? sv.equip.weapon : 'w_blade';
// infusions (forge) add an element to the weapon you're holding
export const INFUSE = { ember: { name: 'Ember', col: '#ff9b4a', desc: 'Hits set Hollows burning.' }, frost: { name: 'Frost', col: '#bfe9ff', desc: 'Hits slow Hollows down.' } };
