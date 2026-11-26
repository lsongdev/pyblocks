import { ClassicReset, ESPLoader } from 'esptool-js';

// FTDI bridges need the full idle/assert initialization from esptool's
// UnixTightReset, including a final DTR write. Merely increasing the GPIO0
// hold time does not reliably enter the ROM bootloader on original Stick-C.
export function createClassicReset(transport, resetDelay) {
  if (transport.getVid() !== 0x0403) return new ClassicReset(transport, resetDelay);
  return { async reset() {
    await transport.setSignals(false, false);
    await transport.setSignals(true, true);
    await transport.setSignals(false, true);
    await new Promise(resolve => setTimeout(resolve, 100));
    await transport.setSignals(true, false);
    await new Promise(resolve => setTimeout(resolve, resetDelay));
    await transport.setSignals(false, false);
    await transport.setDTR(false);
    // Let the ROM boot log and FTDI buffered bytes settle before sync.
    // Without this, the loader consumes all retries on partial boot text.
    await new Promise(resolve => setTimeout(resolve, 100));
  } };
}

// ROM autobaud may ignore the first sync. Unlike esptool.py, esptool-js
// retries immediately after malformed boot text, exhausting its attempts
// before FTDI/ROM buffers settle. Preserve esptool.py's 50 ms retry gap.
export class FirmwareESPLoader extends ESPLoader {
  async sync() {
    try { return await super.sync(); }
    catch (error) {
      if (this.transport.getVid() === 0x0403) await new Promise(resolve => setTimeout(resolve, 50));
      throw error;
    }
  }
}

export async function resetEsp32(transport) {
  // esptool-js 0.7.1 HardReset only deasserts RTS; after writing that can
  // leave the flasher stub running. Explicitly pulse EN with GPIO0 released.
  await transport.setDTR(false);
  await transport.setRTS(true);
  await new Promise(resolve => setTimeout(resolve, 100));
  await transport.setRTS(false);
}
