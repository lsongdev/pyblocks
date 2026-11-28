import { ESPLoader, Transport } from 'esptool-js';
import SparkMD5 from 'spark-md5';
import { createUSBConnection } from '@microbit/microbit-connection/usb';
import { ProgressStage } from '@microbit/microbit-connection';

import images from './images.json';
import { connectPicoBoot } from '../device/rp2040.js';
import { connectStm32Dfu } from '../device/stm32.js';

import { resetEsp32 } from './esp32.js';
import { getFirmwareFamily, matchFirmware } from './catalog.js';
import { uiflowBootSetup } from './uiflow.js';
import { executeProgram } from '../device/micropython.js';
import { requireReplCandidate } from '../device/detect.js';

async function fetchImage({ file, sha256 }) {
  const response = await fetch(new URL(`firmware/${file}`, document.baseURI));
  if (!response.ok) throw new Error(`Firmware download failed (HTTP ${response.status})`);
  const bytes = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256) throw new Error('Firmware checksum mismatch.');
  return bytes;
}

export async function connectFirmware(familyId, report = () => {}) {
  const family = getFirmwareFamily(familyId);
  if (!family) throw new Error('Unsupported device family.');
  const resolve = (selection, device) => matchFirmware(selection, device, images);
  const requireTarget = (selection, device) => {
    const match = resolve(selection, device);
    if (!match.supported) throw new Error('No compatible firmware for this selection and device.');
    return match.target;
  };
  if (family.transport === 'serial') {
    const port = await navigator.serial.requestPort();
    requireReplCandidate(port);
    const transport = new Transport(port);
    const loader = new ESPLoader({ transport, baudrate: 115200 });
    let connected = true;

    const close = async () => {
      if (connected) { connected = false; await resetEsp32(transport).catch(() => {}); }
      await transport.disconnect().catch(() => {});
    };
    try {
      report('firmwareDetecting');
      await loader.main();
      connected = true;
      const detectedSize = await loader.detectFlashSize();
      const device = { transport: 'serial', chip: loader.chip.CHIP_NAME,
        flashSize: /^\d+(KB|MB)$/.test(detectedSize) ? detectedSize : null };
      return { device, match: selection => resolve(selection, device), close, async install(selection, update) {
        const target = requireTarget(selection, device);
        report('firmwareChecking');
        const data = new Uint8Array(await fetchImage(target.image));
        report('firmwareWriting');
        await loader.writeFlash({
          fileArray: [{ data, address: target.address }],
          flashSize: target.flashSize,
          flashMode: 'keep',
          flashFreq: 'keep',
          eraseAll: true,
          compress: true,
          reportProgress: (_file, written, total) => {
            if (total > 0) { update(written / total); if (written === total) report('firmwareVerifying'); }
          },
          calculateMD5Hash: image => SparkMD5.ArrayBuffer.hash(image.slice().buffer),
        });
        await resetEsp32(transport);
        connected = false;
        if (target.uiflow) {
          report('firmwareConfiguring');
          await transport.disconnect();
          // Allow the freshly installed firmware to reach its startup/REPL.
          await new Promise(resolve => setTimeout(resolve, 2000));
          const session = await executeProgram(port, uiflowBootSetup);
          await session.close();
        }
      } };
    } catch (error) { await close(); throw error; }
  }
  if (family.transport === 'stm32-dfu') {
    report('firmwareDetecting');
    const dfu = await connectStm32Dfu();
    const device = { transport: 'stm32-dfu', chip: 'STM32 USB DFU', flash: dfu.flash, flashSize: `${dfu.flash.capacity / 1024}KB` };
    return { device, match: selection => resolve(selection, device), close: dfu.close,
      async install(selection, progress) {
        const target = requireTarget(selection, device);
        await dfu.install(target.elements, report, progress);
      },
    };
  }
  if (family.transport === 'rp2040') {
    report('firmwareDetecting');
    const pico = await connectPicoBoot();
    const device = { transport: 'rp2040', chip: 'RP2040', flashSize: null };
    return {
      device, match: selection => resolve(selection, device),
      close: pico.close,
      async install(selection, progress) {
        const target = requireTarget(selection, device);
        report('firmwareChecking');
        const bytes = await fetchImage(target.image);
        await pico.install(bytes, report, progress);
      },
    };
  }
  const connection = createUSBConnection();
  const close = async () => {
    await connection.disconnect().catch(() => {});
    connection.dispose();
  };
  try {
    report('firmwareDetecting');
    await connection.connect();
    const version = connection.getBoardVersion();
    const device = { transport: 'microbit', version, chip: version === 'V1' ? 'nRF51822' : version === 'V2' ? 'nRF52833' : '?', flashSize: null };
    return {
      device, match: selection => resolve(selection, device), close,
      async install(selection, update) {
        requireTarget(selection, device);
        await connection.flash(async boardVersion => {
          const image = requireTarget(selection, { ...device, version: boardVersion }).image;
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
