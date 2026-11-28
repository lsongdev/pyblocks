import { t } from '../i18n/index.js';
import { portProtocol } from '../device/detect.js';
import { SerialOpenError } from '../device/transport/serial.js';
import { connectSpike } from '../device/spike/index.js';
import { createSpikeDialog, rememberSlot } from './spike-dialog.js';
import { setupSerialInput } from './serial-input.js';
import { DeviceController } from './device-controller.js';
import { createDeviceFilesPanel } from './device-files.js';
import { downloadProgram, MicroPythonError, monitorPort } from '../device/micropython.js';

export function createDevicePanel({ getSource, getLibraries }) {
  const upload = document.querySelector('#upload');
  const uploadStatus = document.querySelector('#upload-status');
  const serialConnect = document.querySelector('#serial-connect');
  const serialClear = document.querySelector('#serial-clear');
  const serialOutput = document.querySelector('#serial-output');
  const serialOutputLimit = 32_768;
  const device = new DeviceController({
    onDisconnect(_kind, error) {
      setStatus(error ? 'serialFailed' : undefined, error);
      render();
    },
  });
  const serialInput = setupSerialInput({
    getSession: () => device.serial,
    isBusy: () => device.busy,
    onError: error => setStatus('serialSendFailed', error),
  });
  const chooseSpike = createSpikeDialog();
  const changeDevice = document.querySelector('#change-device');
  const changeSlot = document.querySelector('#change-slot');
  const deviceName = document.querySelector('#deployment-device');
  let statusMessage;

  const serialInterrupt = document.querySelector('#serial-interrupt');
  const serialReset = document.querySelector('#serial-reset');
  const serialForm = document.querySelector('#serial-input-form');
  const spikeStop = document.querySelector('#spike-stop');

  // Connection identity is rendered separately; there is only one transient
  // operation/error message, so older success text cannot compete with it.
  function renderStatus() {
    if (!statusMessage) {
      uploadStatus.textContent = '';
      uploadStatus.classList.remove('error');
      return;
    }
    const [key, detail] = statusMessage;
    const text = detail instanceof MicroPythonError ? t(detail.code)
      : typeof detail === 'string' ? detail
      : detail?.message;
    uploadStatus.textContent = t(key, text);
    uploadStatus.classList.toggle('error', [
      'serialFailed', 'serialSendFailed', 'serialOpenFailed', 'serialConnectionFailed',
      'flashFailed', 'spikeFirmwareUnsupported', 'spikeLibrariesUnsupported', 'spikeDisconnected',
    ].includes(key));
  }

  function setStatus(key, detail) {
    statusMessage = key ? [key, detail] : undefined;
    renderStatus();
  }

  // File operations use the same progress area; stable connection state
  // belongs to the device identity, not a second status message.
  function setSerialStatus(key, detail) {
    setStatus(key === 'serialConnected' || key === 'serialDisconnected' ? undefined : key, detail);
  }

  function appendSerialOutput(text) {
    const atBottom = serialOutput.scrollHeight - serialOutput.clientHeight - serialOutput.scrollTop <= 2;
    serialOutput.textContent = (serialOutput.textContent + text).slice(-serialOutputLimit);
    if (atBottom) serialOutput.scrollTop = serialOutput.scrollHeight;
    serialClear.disabled = false;
  }

  function attachSerial(session, protocol = 'micropython') {
    device.attachSerial(session, protocol);
    setSerialStatus('serialConnected');
  }

  const deviceFiles = createDeviceFilesPanel({
    device, onChange: render, attachSerial, setSerialStatus, appendSerialOutput,
  });

  function render() {
    serialInput.update();
    const hasSource = Boolean(getSource().trim());
    upload.disabled = !hasSource || device.busy || !navigator.serial;
    upload.title = !navigator.serial ? t('uploadSerialUnavailable')
      : device.busy ? t('uploadSerialBusy')
      : !hasSource ? t('uploadCodeRequired')
      : t('flashButton');
    document.querySelector('#open-firmware').disabled = device.busy;
    serialConnect.disabled = device.busy || !navigator.serial;
    const connectLabel = t(device.serial || device.spike ? 'serialDisconnect' : 'serialConnect');
    serialConnect.title = connectLabel;
    serialConnect.setAttribute('aria-label', connectLabel);
    serialConnect.dataset.connected = String(Boolean(device.serial || device.spike));
    changeDevice.disabled = device.busy || !navigator.serial;
    changeSlot.hidden = !device.spike;
    changeSlot.disabled = device.busy;
    const connected = Boolean(device.serial || (device.spike && !device.spike.closed));
    deviceName.dataset.connected = String(connected);
    deviceName.title = connected ? t('serialConnected') : t('serialDisconnected');
    deviceName.textContent = device.spike ? t('deploymentSpike', String(device.slot))
      : device.serial ? t(device.protocol === 'micropython' ? 'deploymentMicroPython' : 'deploymentSerial')
      : t('deploymentNone');
    changeDevice.hidden = !device.serial && !device.spike;
    serialInterrupt.hidden = !device.serial;
    serialReset.hidden = !device.serial;
    serialForm.hidden = !device.serial;
    spikeStop.hidden = !device.spike;
    spikeStop.disabled = device.busy || device.runningSlot === undefined || Boolean(device.spike?.closed);
    deviceFiles.render();
  }

  serialClear.addEventListener('click', () => {
    serialOutput.textContent = '';
    serialClear.disabled = true;
  });

  // The browser-selected port, never the source code, determines the protocol.
  async function selectPort() {
    setStatus('selectPort');
    return navigator.serial.requestPort();
  }

  async function connectSelected(port, { uploading = false } = {}) {
    const protocol = portProtocol(port);
    if (protocol === 'unsupported-lego') {
      setStatus('spikeFirmwareUnsupported');
      return false;
    }
    if (port === device.port) {
      if (device.serial || (device.spike && !device.spike.closed)) {
        if (!uploading) setStatus();
        return true;
      }
      await device.detach();
    }
    if (protocol === 'spike') {
      setStatus('spikeDetecting');
      // Inspect and confirm the candidate before releasing the previous target.
      const hub = await connectSpike(port, { onConsole: appendSerialOutput });
      let attached = false;
      try {
        const slot = await chooseSpike(hub, { uploading });
        if (slot === null || hub.closed) {
          setStatus(hub.closed ? 'spikeDisconnected' : 'portCanceled');
          return false;
        }
        await device.detach();
        if (hub.closed) throw new Error(t('spikeDisconnected'));
        device.attachSpike(hub, port, slot);
        attached = true;
        rememberSlot(slot);
        deviceFiles.clear();
        setSerialStatus('serialConnected');
        return true;
      } finally {
        if (!attached) await hub.close();
      }
    }
    // Generic serial monitoring does not claim a verified MicroPython runtime.
    // The upload path verifies Raw REPL before writing anything.
    if (uploading) {
      await device.detach();
      deviceFiles.clear();
      return true;
    }
    setSerialStatus('serialConnecting');
    const session = await monitorPort(port, appendSerialOutput);
    try {
      await device.detach();
      attachSerial(session, 'serial');
    } catch (error) {
      await session.close();
      throw error;
    }
    deviceFiles.clear();
    return true;
  }

  function reportDeviceError(error, action = 'upload') {
    setStatus(error.name === 'NotFoundError' ? 'portCanceled'
      : error.code === 'unsupported' ? 'spikeFirmwareUnsupported'
      : error instanceof SerialOpenError ? 'serialOpenFailed'
      : action === 'connection' ? 'serialConnectionFailed' : 'flashFailed', error);
  }

  async function changeConnection(disconnect = false) {
    if (!device.begin('connection')) return;
    render();
    try {
      if (disconnect && (device.serial || device.spike)) {
        await device.detach();
        deviceFiles.clear();
        setSerialStatus('serialDisconnected');
      } else {
        await connectSelected(await selectPort());
      }
    } catch (error) {
      reportDeviceError(error, 'connection');
    } finally {
      device.end();
      render();
    }
  }

  serialConnect.addEventListener('click', () => void changeConnection(true));
  changeDevice.addEventListener('click', () => void changeConnection());
  changeSlot.addEventListener('click', async () => {
    if (!device.spike || !device.begin('slot')) return;
    render();
    try {
      const hub = device.spike;
      const slot = await chooseSpike(hub, { initial: device.slot });
      if (slot !== null && device.spike === hub && !hub.closed) {
        device.setSlot(slot);
        rememberSlot(slot);
        setStatus();
      }
    } catch (error) {
      reportDeviceError(error, 'connection');
    } finally {
      device.end();
      render();
    }
  });

  upload.addEventListener('click', async () => {
    const source = getSource();
    const projectLibraries = getLibraries();
    if (!source.trim() || !navigator.serial || !device.begin('upload')) return;
    render();
    try {
      const port = device.port ?? await selectPort();
      if (!await connectSelected(port, { uploading: true })) return;
      if (device.spike) {
        const hub = device.spike;
        const slot = device.slot;
        if (projectLibraries.length) {
          setStatus('spikeLibrariesUnsupported');
          return;
        }
        const onProgress = value => setStatus('spikeWriting', `${Math.round(value * 100)}%`);
        setStatus('spikeWriting', '0%');
        await hub.upload(source, slot, onProgress);
        await hub.start(slot);
        if (device.spike === hub && !hub.closed) device.markStarted(slot);
        setStatus('spikeRunning', String(slot));
        return;
      }
      await device.detach();
      setSerialStatus('serialConnecting');
      setStatus('writingCode');
      attachSerial(await downloadProgram(port, source, appendSerialOutput, projectLibraries));
      setStatus('flashComplete');
    } catch (error) {
      reportDeviceError(error);
    } finally {
      device.end();
      render();
    }
  });

  spikeStop.addEventListener('click', async () => {
    const hub = device.spike;
    const slot = device.runningSlot;
    if (!hub || hub.closed || slot === undefined || !device.begin('stop')) return;
    render();
    try {
      await hub.stop(slot);
      if (device.spike === hub) device.markStopped();
      setStatus('spikeStopped', String(slot));
    } catch (error) {
      reportDeviceError(error);
    } finally {
      device.end();
      render();
    }
  });

  function renderLanguage() {
    document.querySelector('#serial-input').placeholder = t('serialInputPlaceholder');
    renderStatus();
    render();
  }

  return {
    render, renderLanguage,
    close() { return device.detach().finally(render); },
    async acquireDevice() {
      if (!device.begin('firmware')) throw new Error(t('filesBusy'));
      render();
      try {
        await device.detach();
        deviceFiles.clear();
        setSerialStatus('serialDisconnected');
        render();
      } catch (error) {
        device.end();
        render();
        throw error;
      }
    },
    releaseDevice() { device.end(); render(); },
  };
}
