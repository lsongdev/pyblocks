import { t } from '../i18n/index.js';
import { portProtocol } from '../device/detect.js';
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
  const serialStatus = document.querySelector('#serial-status');
  const serialOutput = document.querySelector('#serial-output');
  const serialOutputLimit = 32_768;
  const device = new DeviceController({
    onDisconnect(kind, error) {
      setSerialStatus(error ? 'serialFailed' : 'serialDisconnected', error);
      if (kind === 'spike') setUploadStatus('spikeDisconnected');
      render();
    },
  });
  let serialMessage = ['serialDisconnected'];
  const serialInput = setupSerialInput({
    getSession: () => device.serial,
    isBusy: () => device.busy,
    onError: error => setSerialStatus('serialSendFailed', error),
  });
  const chooseSpike = createSpikeDialog();
  const changeDevice = document.querySelector('#change-device');
  const changeSlot = document.querySelector('#change-slot');
  const deviceName = document.querySelector('#deployment-device');
  let uploadMessage;

  const serialInterrupt = document.querySelector('#serial-interrupt');
  const serialReset = document.querySelector('#serial-reset');
  const serialForm = document.querySelector('#serial-input-form');
  const spikeStop = document.querySelector('#spike-stop');

  function renderStatus(element, message) {
    if (!message) return;
    const [key, detail] = message;
    const text = detail instanceof MicroPythonError ? t(detail.code)
      : typeof detail === 'string' ? detail
      : detail?.message;
    element.textContent = t(key, text);
  }

  function setUploadStatus(key, error) {
    uploadMessage = [key, error];
    renderStatus(uploadStatus, uploadMessage);
  }

  function setSerialStatus(key, error) {
    serialMessage = [key, error];
    renderStatus(serialStatus, serialMessage);
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
    upload.disabled = !getSource().trim() || device.busy || !navigator.serial;
    document.querySelector('#open-firmware').disabled = device.busy;
    serialConnect.disabled = device.busy || !navigator.serial;
    serialConnect.textContent = t(device.serial || device.spike ? 'serialDisconnect' : 'serialConnect');
    changeDevice.disabled = device.busy || !navigator.serial;
    changeSlot.hidden = !device.spike;
    changeSlot.disabled = device.busy;
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
    setUploadStatus('selectPort');
    return navigator.serial.requestPort();
  }

  async function connectSelected(port, { uploading = false } = {}) {
    const protocol = portProtocol(port);
    if (protocol === 'unsupported-lego') {
      setUploadStatus('spikeFirmwareUnsupported');
      return false;
    }
    if (port === device.port) {
      if (device.serial || (device.spike && !device.spike.closed)) return true;
      await device.detach();
    }
    if (protocol === 'spike') {
      setUploadStatus('spikeDetecting');
      // Inspect and confirm the candidate before releasing the previous target.
      const hub = await connectSpike(port, { onConsole: appendSerialOutput });
      let attached = false;
      try {
        const slot = await chooseSpike(hub, { uploading });
        if (slot === null || hub.closed) {
          setUploadStatus(hub.closed ? 'spikeDisconnected' : 'portCanceled');
          return false;
        }
        await device.detach();
        if (hub.closed) throw new Error(t('spikeDisconnected'));
        device.attachSpike(hub, port, slot);
        attached = true;
        rememberSlot(slot);
        deviceFiles.clear();
        setSerialStatus('serialConnected');
        setUploadStatus('deploymentReady');
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
    const session = await monitorPort(port, appendSerialOutput);
    try {
      await device.detach();
      attachSerial(session, 'serial');
    } catch (error) {
      await session.close();
      throw error;
    }
    deviceFiles.clear();
    setUploadStatus('deploymentReady');
    return true;
  }

  function reportDeviceError(error) {
    if (!device.serial && !device.spike) setSerialStatus('serialDisconnected');
    setUploadStatus(error.name === 'NotFoundError' ? 'portCanceled'
      : error.code === 'unsupported' ? 'spikeFirmwareUnsupported' : 'flashFailed', error);
  }

  async function changeConnection(disconnect = false) {
    if (!device.begin('connection')) return;
    render();
    try {
      if (disconnect && (device.serial || device.spike)) {
        await device.detach();
        deviceFiles.clear();
        setSerialStatus('serialDisconnected');
        setUploadStatus('deploymentNone');
      } else {
        await connectSelected(await selectPort());
      }
    } catch (error) {
      reportDeviceError(error);
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
      }
    } catch (error) {
      reportDeviceError(error);
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
          setUploadStatus('spikeLibrariesUnsupported');
          return;
        }
        const onProgress = value => setUploadStatus('spikeWriting', `${Math.round(value * 100)}%`);
        setUploadStatus('spikeWriting', '0%');
        await hub.upload(source, slot, onProgress);
        await hub.start(slot);
        if (device.spike === hub && !hub.closed) device.markStarted(slot);
        setUploadStatus('spikeRunning', String(slot));
        return;
      }
      await device.detach();
      setSerialStatus('serialConnecting');
      setUploadStatus('writingCode');
      attachSerial(await downloadProgram(port, source, appendSerialOutput, projectLibraries));
      setUploadStatus('flashComplete');
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
      setUploadStatus('spikeStopped', String(slot));
    } catch (error) {
      reportDeviceError(error);
    } finally {
      device.end();
      render();
    }
  });

  function renderLanguage() {
    document.querySelector('#serial-input').placeholder = t('serialInputPlaceholder');
    renderStatus(uploadStatus, uploadMessage);
    renderStatus(serialStatus, serialMessage);
    render();
  }

  return {
    render, renderLanguage,
    close() { return device.detach(); },
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
