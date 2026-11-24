import { connectFirmware } from './install.js';
import { t } from '../i18n/index.js';
import '../styles/firmware.css';

for (const board of ['matrixbit', 'microbit']) {
  const button = document.querySelector(`#${board}-install`);
  const status = document.querySelector(`#${board}-status`);
  const progress = document.querySelector(`#${board}-progress`);
  const supported = board === 'matrixbit' ? navigator.serial : navigator.usb;
  button.disabled = !supported;
  if (!supported) status.textContent = t('firmwareUnsupported');
  button.addEventListener('click', async () => {
    const buttons = [...document.querySelectorAll('button')];
    const disabled = buttons.map(item => item.disabled);
    buttons.forEach(item => { item.disabled = true; });
    progress.hidden = true;
    let session;
    try {
      session = await connectFirmware(board, key => { status.textContent = t(key); });
      if (!window.confirm(`${session.label}\n\n${t('firmwareWarning')}`)) {
        status.textContent = 'Installation canceled.';
        return;
      }
      progress.hidden = false;
      progress.removeAttribute('value');
      await session.install(value => { progress.value = value; });
      progress.value = 1;
      status.textContent = t('firmwareComplete');
    } catch (error) {
      progress.hidden = true;
      status.textContent = error.name === 'NotFoundError' || error.code === 'no-device-selected'
        ? t('firmwareCanceled') : t('firmwareFailed', error.message);
    } finally {
      await session?.close();
      buttons.forEach((item, index) => { item.disabled = disabled[index]; });
    }
  });
}
