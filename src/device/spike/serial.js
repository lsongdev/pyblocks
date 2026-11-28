// USB transport for SPIKE Prime HubOS 3. The hub exposes a CDC serial port
// (LEGO vendor 0x0694) that carries the same binary RPC protocol as BLE.
// It is not a MicroPython REPL.

const LEGO_VENDOR_ID = 0x0694;
const BAUD_RATE = 115200;
const STARTUP_DELAY = 250;

export function selectSpikeSerialPort() {
  if (!globalThis.navigator?.serial) throw new Error('Web Serial is not available.');
  return navigator.serial.requestPort({ filters: [{ usbVendorId: LEGO_VENDOR_ID }] });
}

export async function openSpikeSerial(port, { onData, onClose }) {
  await port.open({ baudRate: BAUD_RATE });

  const reader = port.readable.getReader();
  const writer = port.writable.getWriter();
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
