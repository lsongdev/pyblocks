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
  const grid = document.querySelector('#spike-device-slot');
  const version = document.querySelector('#spike-device-version');
  const protocol = document.querySelector('#spike-device-protocol');
  const confirm = document.querySelector('#spike-device-confirm');
  const cancel = document.querySelector('#spike-device-cancel');
  const warning = document.querySelector('#spike-device-warning');
  const radios = [];
  let selected = 0;
  function select(value) {
    selected = value;
    for (const [index, radio] of radios.entries()) radio.checked = index === value;
    warning.textContent = t('spikeSlotWarning', String(value));
  }
  for (let i = 0; i < SPIKE_SLOT_COUNT; i++) {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    const number = document.createElement('span');
    radio.type = 'radio';
    radio.name = 'spike-program-slot';
    radio.value = String(i);
    number.textContent = String(i);
    radio.addEventListener('change', () => { if (radio.checked) select(i); });
    radios.push(radio);
    label.append(radio, number);
    grid.append(label);
  }
  return function choose(hub, { initial = readPreferredSlot(), uploading = false } = {}) {
    if (hub.closed) return Promise.resolve(null);
    select(isSpikeSlot(initial) ? initial : 0);
    const { firmware, rpcMajor, rpcMinor, rpcBuild } = hub.info;
    version.textContent = `HubOS ${firmware}`;
    protocol.textContent = `USB Serial · RPC ${rpcMajor}.${rpcMinor}.${rpcBuild}`;
    confirm.textContent = t(uploading ? 'spikeConfirmUpload' : 'spikeConfirmDevice');
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
        if (!hub.closed && isSpikeSlot(selected)) choice = selected;
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
