// USB transport for SPIKE Prime HubOS 3. The hub exposes a CDC serial port
// (LEGO vendor 0x0694) that carries the same binary RPC protocol as BLE.
// It is not a MicroPython REPL.

const LEGO_VENDOR_ID = 0x0694;
const SPIKE_PRIME_PRODUCT_ID = 0x0009;
import { openSerialPort } from '../transport/serial.js';
const STARTUP_DELAY = 250;

export async function selectSpikeSerialPort(onSelect) {
  if (!globalThis.navigator?.serial) throw new Error('Web Serial is not available.');
  const ports = await navigator.serial.getPorts();
  const candidates = ports.filter(port => {
    const { usbVendorId, usbProductId } = port.getInfo();
    return usbVendorId === LEGO_VENDOR_ID && usbProductId === SPIKE_PRIME_PRODUCT_ID;
  });
  if (candidates.length === 1) return candidates[0];
  onSelect?.();
  return navigator.serial.requestPort({ filters: [{ usbVendorId: LEGO_VENDOR_ID }] });
}

export async function openSpikeSerial(port, { onData, onClose }) {
  await openSerialPort(port);
  let reader, writer;
  try {
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
  } catch (error) {
    reader?.releaseLock();
    writer?.releaseLock();
    await port.close();
    throw error;
  }
  let active = true;
  let closing;
  const reading = (async () => {
    try {
      while (active) {
        const { value, done } = await reader.read();
        if (done) {
          if (active) onClose?.();
          break;
        }
        onData(value);
      }
    } catch (error) {
      if (active) onClose?.(error);
    } finally {
      reader.releaseLock();
    }
  })();

  // Give the hub a moment after the port opens before sending a request.
  await new Promise(resolve => setTimeout(resolve, STARTUP_DELAY));

  return {
    write: bytes => writer.write(bytes),
    close() {
      active = false;
      closing ??= (async () => {
        await reader.cancel().catch(() => {});
        await reading;
        writer.releaseLock();
        await port.close();
      })();
      return closing;
    },
  };
}
