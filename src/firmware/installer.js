import { ESPLoader, Transport } from 'esptool-js';
import SparkMD5 from 'spark-md5';
import { createUSBConnection } from '@microbit/microbit-connection/usb';
import { ProgressStage } from '@microbit/microbit-connection';
import '../styles/firmware.css';

const matrixbitImage = {
  file: 'ESP32_GENERIC-20260824-v1.29.0.bin',
  sha256: 'e67ad6015a0a504c1fec9aa9bbf589d0432ed28e62546f4f8dd8a147f8bd95f6',
};
const microbitImages = {
  V1: {
    file: 'microbit-v1.hex',
    sha256: 'd3686e669677d456ece9d206a44b8acbe73ddf73e1a3211ff89b93972b953152',
  },
  V2: {
    file: 'microbit-v2.hex',
    sha256: '66fae07b71777e9e3a6b5122a27930b24cc0be5002ab9a67e92494c54a1645ef',
  },
};

async function fetchImage({ file, sha256 }) {
  const response = await fetch(`./firmware/${file}`);
  if (!response.ok) throw new Error(`Firmware download failed (HTTP ${response.status})`);
  const bytes = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256) throw new Error('Firmware checksum mismatch.');
  return bytes;
}

function installer(board, supported, unsupported, install) {
  const button = document.querySelector(`#${board}-install`);
  const status = document.querySelector(`#${board}-status`);
  const progress = document.querySelector(`#${board}-progress`);
  button.disabled = !supported;
  if (!supported) status.textContent = unsupported;

  button.addEventListener('click', async () => {
    button.disabled = true;
    progress.hidden = true;
    const show = message => { status.textContent = message; };
    const update = (value) => {
      progress.hidden = false;
      if (value === undefined) progress.removeAttribute('value');
      else progress.value = value;
    };

    try {
      await install(show, update);
    } catch (error) {
      progress.hidden = true;
      show(error.code === 'no-device-selected' || error.name === 'NotFoundError'
        ? 'No device selected.'
        : `Installation failed: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });
}

installer('matrixbit', navigator.serial,
  'For USB installation, open this page in Chrome or Edge over HTTPS.',
  async (show, update) => {
    show('Choose your Matrix:bit serial port.');
    const port = await navigator.serial.requestPort();
    const transport = new Transport(port);
    const loader = new ESPLoader({ transport, baudrate: 460800 });
    let connected = false;

    try {
      show('Detecting the ESP32 and its flash size…');
      await loader.main();
      connected = true;
      if (loader.chip.CHIP_NAME !== 'ESP32' || await loader.detectFlashSize() !== '8MB') {
        throw new Error('This installer requires a classic ESP32 with 8 MB flash.');
      }
      if (!window.confirm('Erase this Matrix:bit and install MicroPython v1.29.0?')) {
        show('Installation canceled.');
        return;
      }
      show('Checking the firmware image…');
      const data = new Uint8Array(await fetchImage(matrixbitImage));
      show('Erasing flash and installing MicroPython…');
      update();
      await loader.writeFlash({
        fileArray: [{ data, address: 0x1000 }],
        flashSize: '8MB',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: true,
        compress: true,
        reportProgress: (_file, written, total) => {
          if (total > 0) update(written / total);
        },
        calculateMD5Hash: image => SparkMD5.ArrayBuffer.hash(image.slice().buffer),
      });
      await loader.after();
      connected = false;
      update(1);
      show('MicroPython v1.29.0 installed on Matrix:bit.');
    } finally {
      if (connected) await loader.after().catch(() => {});
      await transport.disconnect().catch(() => {});
    }
  },
);

installer('microbit', navigator.usb,
  'For USB installation, open this page in Chrome or Edge over HTTPS. You can also download the HEX below.',
  async (show, update) => {
    show('Choose your Micro:bit in the browser dialog.');
    const connection = createUSBConnection();
    try {
      await connection.connect();
      const version = connection.getBoardVersion();
      if (!window.confirm(`Replace the program on this Micro:bit ${version} with MicroPython?`)) {
        show('Installation canceled.');
        return;
      }
      await connection.flash(async (boardVersion) => {
        const image = microbitImages[boardVersion];
        if (!image) throw new Error('Unsupported Micro:bit version.');
        show(`Checking Micro:bit ${boardVersion} firmware…`);
        return new TextDecoder().decode(await fetchImage(image));
      }, {
        partial: false,
        progress(stage, value) {
          if (stage !== ProgressStage.FullFlashing) return;
          show(`Installing MicroPython on Micro:bit ${version}…`);
          update(value);
        },
      });
      update(1);
      show(`MicroPython installed on Micro:bit ${version}.`);
    } finally {
      await connection.disconnect().catch(() => {});
      connection.dispose();
    }
  },
);
