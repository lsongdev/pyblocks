// LEGO SPIKE Prime storage positions are 0–19 (LEGO Education support).
export const SPIKE_SLOT_COUNT = 20;
export function isSpikeSlot(slot) {
  return Number.isInteger(slot) && slot >= 0 && slot < SPIKE_SLOT_COUNT;
}
export function requireSpikeSlot(slot) {
  if (!isSpikeSlot(slot)) throw new RangeError('SPIKE program slot must be 0–19.');
}
