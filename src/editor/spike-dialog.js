import { t } from '../i18n/index.js';
import { SPIKE_SLOT_COUNT, isSpikeSlot } from '../device/spike/slots.js';

const storageKey = 'pyblocks.spike.slot';
export function readPreferredSlot(storage) {
  try {
    const value = (storage ?? globalThis.localStorage).getItem(storageKey);
    const slot = value === null || value === '' ? 0 : Number(value);
    return isSpikeSlot(slot) ? slot : 0;
  } catch { return 0; }
}
export function rememberSlot(slot, storage) {
  if (!isSpikeSlot(slot)) return;
  try { (storage ?? globalThis.localStorage).setItem(storageKey, String(slot)); } catch {}
}

export function createSpikeDialog(document = globalThis.document) {
  const dialog = document.querySelector('#spike-device-dialog');
  const slot = document.querySelector('#spike-device-slot');
  const version = document.querySelector('#spike-device-version');
  const confirm = document.querySelector('#spike-device-confirm');
  const cancel = document.querySelector('#spike-device-cancel');
  const warning = document.querySelector('#spike-device-warning');
  for (let i = 0; i < SPIKE_SLOT_COUNT; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = String(i);
    slot.append(option);
  }
  const update = () => { warning.textContent = t('spikeSlotWarning', slot.value); };
  slot.addEventListener('change', update);
  return function choose(hub, { initial = readPreferredSlot(), uploading = false } = {}) {
    if (hub.closed) return Promise.resolve(null);
    slot.value = String(isSpikeSlot(initial) ? initial : 0);
    const { firmware, rpcMajor, rpcMinor, rpcBuild } = hub.info;
    version.textContent = `HubOS ${firmware} · RPC ${rpcMajor}.${rpcMinor}.${rpcBuild}`;
    confirm.textContent = t(uploading ? 'spikeConfirmUpload' : 'spikeConfirmDevice');
    update();
    return new Promise((resolve, reject) => {
      let choice = null;
      let unsubscribe;
      const cleanup = () => {
        confirm.removeEventListener('click', accept);
        cancel.removeEventListener('click', dismiss);
        dialog.removeEventListener('close', closed);
        unsubscribe?.();
      };
      const closed = () => { cleanup(); resolve(choice); };
      const accept = () => {
        const value = Number(slot.value);
        if (!hub.closed && isSpikeSlot(value)) choice = value;
        dialog.close();
      };
      const dismiss = () => dialog.close();
      confirm.addEventListener('click', accept);
      cancel.addEventListener('click', dismiss);
      dialog.addEventListener('close', closed, { once: true });
      unsubscribe = hub.onClose(() => { if (dialog.open) dialog.close(); });
      try { dialog.showModal(); } catch (error) { cleanup(); reject(error); }
    });
  };
}
