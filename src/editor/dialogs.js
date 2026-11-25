import { updateProgress } from './progress.js';
import { t } from '../i18n/index.js';
import { connectFirmware } from '../firmware/install.js';

export function setupDialogs({ getLanguage, setLanguage, acquireDevice, releaseDevice }) {
  const settings = document.querySelector('#settings-dialog');
  const language = document.querySelector('#setting-language');
  document.querySelector('#open-settings').addEventListener('click', () => {
    language.value = getLanguage();
    settings.showModal();
  });
  language.addEventListener('change', () => setLanguage(language.value));
  const dialog = document.querySelector('#firmware-dialog');
  const board = document.querySelector('#firmware-board');
  const picoHint = document.querySelector('#firmware-pico-hint');
  const showBoardHint = () => { picoHint.hidden = board.querySelector('input:checked').value !== 'pico'; };
  board.addEventListener('change', showBoardHint);
  const connect = document.querySelector('#firmware-connect');
  const install = document.querySelector('#firmware-install');
  const close = document.querySelector('#firmware-close');
  const status = document.querySelector('#firmware-status');
  const detected = document.querySelector('#firmware-detected');
  const warning = document.querySelector('#firmware-warning');
  const progress = document.querySelector('#firmware-progress');
  let session;
  let busy = false;
  let leased = false;
  function setBusy(value) {
    busy = value;
    board.disabled = value || !!session;
    connect.disabled = value || !!session;
    close.disabled = install.disabled = value;
    dialog.setAttribute('aria-busy', String(value));
  }
  async function cleanup() {
    const current = session;
    session = undefined;
    try { await current?.close(); }
    finally { if (leased) { leased = false; releaseDevice(); } }
  }
  document.querySelector('#open-firmware').addEventListener('click', () => {
    status.textContent = detected.textContent = '';
    warning.hidden = install.hidden = progress.hidden = true;
    setBusy(false);
    showBoardHint();
    dialog.showModal();
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (!busy) close.click();
  });
  close.addEventListener('click', async () => {
    setBusy(true);
    await cleanup();
    dialog.close();
    setBusy(false);
  });
  connect.addEventListener('click', async () => {
    setBusy(true);
    status.textContent = '';
    try {
      const selectedBoard = board.querySelector('input:checked').value;
      if (!(selectedBoard === 'matrixbit' ? navigator.serial : navigator.usb)) throw new Error(t('firmwareUnsupported'));
      await acquireDevice();
      leased = true;
      session = await connectFirmware(selectedBoard, key => { status.textContent = t(key); });
      detected.textContent = session.label;
      status.textContent = t('firmwareReady');
      warning.hidden = install.hidden = false;
    } catch (error) {
      await cleanup();
      status.textContent = error.name === 'NotFoundError' || error.code === 'no-device-selected'
        ? t('firmwareCanceled') : t('firmwareFailed', error.message);
    } finally { setBusy(false); }
  });
  install.addEventListener('click', async () => {
    if (!session || busy) return;
    setBusy(true);
    progress.hidden = false;
    updateProgress(progress);
    let success = false;
    try {
      await session.install(value => updateProgress(progress, value));
      updateProgress(progress, 1);
      status.textContent = t('firmwareComplete');
      success = true;
    } catch (error) {
      progress.hidden = true;
      status.textContent = t('firmwareFailed', error.message);
    } finally {
      await cleanup();
      install.hidden = warning.hidden = true;
      setBusy(false);
      if (success) connect.disabled = true;
    }
  });
}
