import { t } from '../i18n/index.js';
import { getFirmwareFamily } from '../firmware/catalog.js';
import { updateProgress } from './progress.js';
import { decodeStm32Dfu } from '../device/stm32.js';

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
  const dfuInput = $('firmware-dfu-image');
  const dfuConfirm = $('firmware-dfu-confirm');
  let dfu, fileEpoch = 0;
  let session, device, result;
  let busy = false, leased = false, complete = false;
  const remembered = new Map();
  const familyId = () => family.querySelector('input:checked').value;
  const selection = () => ({family:familyId(),model:model.value,capacity:capacity.value || undefined, ...(familyId() === 'stm32' ? { dfu, confirmed: dfuConfirm.checked } : {})});
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
      stm32: 'firmwareSTM32Hint', raspberry: 'firmwarePicoHint', m5stack: 'firmwareM5Hint', microbit: 'firmwareMicrobitHint',
    }[descriptor.id] ?? 'firmwareESP32Hint');
    renderMore();
  }
  function renderMore() {
    const descriptor = getFirmwareFamily(familyId());
    const more = $('firmware-more');
    more.href = descriptor.models.find(m => m.id === model.value)?.download ?? ({
      m5stack: 'https://docs.m5stack.com/en/uiflow2/uiflow_web',
      microbit: 'https://python.microbit.org/',
    }[descriptor.id] ?? 'https://micropython.org/download/');
    more.querySelector('span').textContent = t({
      stm32: 'firmwareMoreSTM32', m5stack: 'firmwareMoreM5', microbit: 'firmwareMoreMicrobit',
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
    $('firmware-stm32-file').hidden = device?.transport !== 'stm32-dfu' || complete;
    dfuInput.disabled = dfuConfirm.disabled = busy || !session;
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
    $('firmware-image').textContent = device.transport === 'stm32-dfu' ? (dfu?.name ?? t('firmwareNoImage')) : target ? `${target.uiflow ? 'UIFlow2' : 'MicroPython'} v${target.image.version}\n${target.image.file}` : t('firmwareNoImage');
    $('firmware-match').textContent = result?.supported ? t(device.transport === 'stm32-dfu' ? 'firmwareSTM32Matched' : 'firmwareMatched') : `${t('firmwareNoMatch')} ${result?.reason ? t(result.reason.key, ...result.reason.args) : ''}`;
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
    fileEpoch++; dfu = undefined; dfuInput.value = ''; dfuConfirm.checked = false;
    complete = false;
    status.textContent = '';
    progress.hidden = true;
    capacity.dataset.choices = '';
    capacity.replaceChildren();
  }
  family.addEventListener('change', () => { renderModels(); clearDetection(); render(); });
  model.addEventListener('change', () => { remembered.set(familyId(), model.value); dfuConfirm.checked = false; renderMore(); status.textContent = ''; render(); });
  capacity.addEventListener('change', render);
  dfuConfirm.addEventListener('change', render);
  dfuInput.addEventListener('change', async () => {
    const epoch = ++fileEpoch;
    dfu = undefined; dfuConfirm.checked = false; status.textContent = ''; render();
    const file = dfuInput.files[0];
    if (!file) return;
    try {
      if (file.size > 17 * 1024 * 1024) throw new Error('DFU file too large.');
      const elements = decodeStm32Dfu(await file.arrayBuffer());
      if (epoch !== fileEpoch) return;
      dfu = {name:file.name,elements};
    } catch(error) {
      if (epoch !== fileEpoch) return;
      status.textContent = t('firmwareSTM32InvalidFile', error.message);
    }
    render();
  });
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
      status.textContent = t(device.transport === 'stm32-dfu' ? 'firmwareSTM32Complete' : 'firmwareComplete');
      complete = true;
    } catch (error) {
      progress.hidden = true;
      status.textContent = t('firmwareFailed', error.message);
    } finally { await cleanup(); setBusy(false); }
  });
  renderModels(); render();
}
