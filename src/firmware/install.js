import { ESPLoader, Transport } from 'esptool-js';
import SparkMD5 from 'spark-md5';
import { createUSBConnection } from '@microbit/microbit-connection/usb';
import { ProgressStage } from '@microbit/microbit-connection';

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
  const response = await fetch(new URL(`firmware/${file}`, document.baseURI));
  if (!response.ok) throw new Error(`Firmware download failed (HTTP ${response.status})`);
  const bytes = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256) throw new Error('Firmware checksum mismatch.');
  return bytes;
}

export async function connectFirmware(board, report = () => {}) {
  if (board === 'matrixbit') {
    const port = await navigator.serial.requestPort();
    const transport = new Transport(port);
    const loader = new ESPLoader({ transport, baudrate: 115200 });
    let connected = false;

    const close = async () => {
      if (connected) { connected = false; await loader.after().catch(() => {}); }
      await transport.disconnect().catch(() => {});
    };
    try {
      report('firmwareDetecting');
      await loader.main();
      connected = true;
      if (loader.chip.CHIP_NAME !== 'ESP32' || await loader.detectFlashSize() !== '8MB') {
        throw new Error('This installer requires a classic ESP32 with 8 MB flash.');
      }
      return { label: 'Matrix:bit · ESP32 · 8 MB · MicroPython v1.29.0', close, async install(update) {
        report('firmwareChecking');
        const data = new Uint8Array(await fetchImage(matrixbitImage));
        report('firmwareWriting');
        await loader.writeFlash({
          fileArray: [{ data, address: 0x1000 }],
          flashSize: '8MB',
          flashMode: 'keep',
          flashFreq: 'keep',
          eraseAll: true,
          compress: true,
          reportProgress: (_file, written, total) => {
            if (total > 0) { update(written / total); if (written === total) report('firmwareVerifying'); }
          },
          calculateMD5Hash: image => SparkMD5.ArrayBuffer.hash(image.slice().buffer),
        });
        await loader.after();
        connected = false;
      } };
    } catch (error) { await close(); throw error; }
  }
  if (board !== 'microbit') throw new Error('Unsupported board.');
  const connection = createUSBConnection();
  const close = async () => {
    await connection.disconnect().catch(() => {});
    connection.dispose();
  };
  try {
    report('firmwareDetecting');
    await connection.connect();
    const version = connection.getBoardVersion();
    if (!microbitImages[version]) throw new Error('Unsupported Micro:bit version.');
    return {
      label: `Micro:bit ${version} · MicroPython`, close,
      async install(update) {
        await connection.flash(async boardVersion => {
          const image = microbitImages[boardVersion];
          if (!image) throw new Error('Unsupported Micro:bit version.');
          report('firmwareChecking');
          const bytes = await fetchImage(image);
          report('firmwareWriting');
          return new TextDecoder().decode(bytes);
        }, {
          partial: false,
          progress(stage, value) { if (stage === ProgressStage.FullFlashing) update(value); },
        });
      },
    };
  } catch (error) { await close(); throw error; }
}
