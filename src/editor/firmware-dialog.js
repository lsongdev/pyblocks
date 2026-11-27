import { t } from '../i18n/index.js';
import { getFirmwareFamily } from '../firmware/catalog.js';
import { updateProgress } from './progress.js';

export function setupFirmwareDialog({ connectFirmware, acquireDevice, releaseDevice, document = globalThis.document, navigator = globalThis.navigator }) {
  const $ = id => document.getElementById(id);
  const dialog = $('firmware-dialog');
  const family = $('firmware-family');
  const model = $('firmware-model');
  const capacity = $('firmware-capacity-choice');
  const status = $('firmware-status');
  const progress = $('firmware-progress');
  const connect = $('firmware-connect');
  const install = $('firmware-install');
  const close = $('firmware-close');
  const reselect = $('firmware-reselect');
  const suggestion = $('firmware-suggestion');
  let session, device, result;
  let busy = false, leased = false, complete = false;
  const remembered = new Map();
  const familyId = () => family.querySelector('input:checked').value;
  const selection = () => ({family:familyId(),model:model.value,capacity:capacity.value || undefined});
  const modelName = m => m ? (m.key ? t(m.key) : m.label) : t('firmwareUnknownModel');

  function renderModels() {
    const descriptor = getFirmwareFamily(familyId());
    model.replaceChildren(...descriptor.models.map(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = modelName(m) + (m.unavailable ? ` · ${t('firmwareNotSupported')}` : '');
      option.disabled = !!m.unavailable;
      return option;
    }));
    model.value = remembered.get(descriptor.id) ?? descriptor.models[0].id;
    capacity.replaceChildren();
    capacity.dataset.choices = '';
    $('firmware-model-hint').textContent = t({
      raspberry: 'firmwarePicoHint', m5stack: 'firmwareM5Hint', microbit: 'firmwareMicrobitHint',
    }[descriptor.id] ?? 'firmwareESP32Hint');
    const more = $('firmware-more');
    more.href = {
      m5stack: 'https://docs.m5stack.com/en/uiflow2/uiflow_web',
      microbit: 'https://python.microbit.org/',
    }[descriptor.id] ?? 'https://micropython.org/download/';
    more.querySelector('span').textContent = t({
      m5stack: 'firmwareMoreM5', microbit: 'firmwareMoreMicrobit',
    }[descriptor.id] ?? 'firmwareMore');
  }
  function render() {
    $('firmware-select-step').hidden = !!device;
    $('firmware-review').hidden = !device;
    connect.hidden = !!device;
    reselect.hidden = !device;
    family.disabled = model.disabled = busy || !!session;
    connect.disabled = close.disabled = reselect.disabled = capacity.disabled = suggestion.disabled = busy;
    dialog.setAttribute('aria-busy', String(busy));
    if (session) result = session.match(selection());
    install.hidden = $('firmware-warning').hidden = !session || !result?.supported || complete;
    install.disabled = busy || !result?.supported;
    if (!device) return;
    $('firmware-chip').textContent = device.chip;
    $('firmware-capacity').textContent = device.flashSize ? `${device.flashSize} · ${t('firmwareAutomatic')}` : t(device.transport === 'rp2040' ? 'firmwarePicoCapacity' : device.transport === 'microbit' ? 'firmwareMicrobitCapacity' : 'firmwareCapacityUnknown');
    $('firmware-resolved-model').textContent = modelName(result?.model);
    const capacities = !device.flashSize && device.transport === 'serial' ? result?.model?.capacities ?? [] : [];
    $('firmware-manual-capacity').hidden = !capacities.length || !session;
    if (capacities.join(',') !== capacity.dataset.choices) {
      const options = ['', ...capacities].map(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value || t('firmwareChooseCapacity');
        return option;
      });
      capacity.replaceChildren(...options);
      capacity.dataset.choices = capacities.join(',');
    }
    const target = result?.target;
    $('firmware-image').textContent = target ? `${target.uiflow ? 'UIFlow2' : 'MicroPython'} v${target.image.version}\n${target.image.file}` : t('firmwareNoImage');
    $('firmware-match').textContent = result?.supported ? t('firmwareMatched') : `${t('firmwareNoMatch')} ${result?.reason ? t(result.reason.key, ...result.reason.args) : ''}`;
    $('firmware-match').className = result?.supported ? 'firmware-match-ok' : 'dialog-warning';
    $('firmware-capabilities').textContent = result?.supported ? t(result.capabilities) : '';
    suggestion.hidden = !result?.suggestion || !session;
    suggestion.textContent = t(result?.suggestion?.family === familyId() ? 'firmwareUseAuto' : 'firmwareSwitchESP32');
  }
  function setBusy(value) { busy = value; render(); }
  async function cleanup() {
    const current = session;
    session = undefined;
    try { await current?.close(); }
    finally { if (leased) { leased = false; releaseDevice(); } }
  }
  function clearDetection() {
    device = result = undefined;
    complete = false;
    status.textContent = '';
    progress.hidden = true;
    capacity.dataset.choices = '';
    capacity.replaceChildren();
  }
  family.addEventListener('change', () => { renderModels(); clearDetection(); render(); });
  model.addEventListener('change', () => { remembered.set(familyId(), model.value); status.textContent = ''; render(); });
  capacity.addEventListener('change', render);
  $('open-firmware').addEventListener('click', () => {
    if (dialog.open || busy) return;
    clearDetection(); renderModels(); render(); dialog.showModal();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) close.click(); });
  close.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { await cleanup(); }
    finally { clearDetection(); dialog.close(); setBusy(false); }
  });
  reselect.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { await cleanup(); }
    finally { clearDetection(); renderModels(); setBusy(false); connect.focus(); }
  });
  suggestion.addEventListener('click', () => {
    if (busy || !result?.suggestion) return;
    const next = result.suggestion;
    family.querySelector(`input[value="${next.family}"]`).checked = true;
    remembered.set(next.family, next.model);
    renderModels(); render();
  });
  connect.addEventListener('click', async () => {
    if (busy || session) return;
    status.textContent = '';
    setBusy(true);
    try {
      const transport = getFirmwareFamily(familyId()).transport;
      if (!(transport === 'serial' ? navigator.serial : navigator.usb)) throw new Error(t('firmwareUnsupported'));
      await acquireDevice(); leased = true;
      session = await connectFirmware(familyId(), key => { status.textContent = t(key); });
      device = session.device;
      status.textContent = t('firmwareDetected');
    } catch (error) {
      await cleanup();
      status.textContent = error.name === 'NotFoundError' || error.code === 'no-device-selected' ? t('firmwareCanceled') : t('firmwareDetectionFailed', error.message);
    } finally { setBusy(false); }
  });
  install.addEventListener('click', async () => {
    if (busy || !session || !session.match(selection()).supported) return;
    setBusy(true);
    progress.hidden = false;
    updateProgress(progress);
    try {
      await session.install(selection(), value => updateProgress(progress, value));
      updateProgress(progress, 1);
      status.textContent = t('firmwareComplete');
      complete = true;
    } catch (error) {
      progress.hidden = true;
      status.textContent = t('firmwareFailed', error.message);
    } finally { await cleanup(); setBusy(false); }
  });
  renderModels(); render();
}
