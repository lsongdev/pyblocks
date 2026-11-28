import { SpikeHub, SpikeError, supportsSpikeProtocol } from './hub.js';
import { openSpikeSerial } from './serial.js';

export { selectSpikeSerialPort } from './serial.js';

export async function uploadSpikeProgram(port, source, { slot, onProgress, onConsole }) {
  const hub = new SpikeHub();
  hub.attach(await openSpikeSerial(port, {
    onData: chunk => hub.receive(chunk),
    onClose: error => hub.handleClose(error),
  }));
  try {
    const info = await hub.initialize();
    if (!supportsSpikeProtocol(info)) {
      throw new SpikeError('unsupported', 'Unsupported SPIKE communication protocol.');
    }
    if (onConsole) hub.onConsole(onConsole);
    await hub.upload(source, slot, onProgress);
    await hub.start(slot);
    return hub;
  } catch (error) {
    await hub.close();
    throw error;
  }
}
