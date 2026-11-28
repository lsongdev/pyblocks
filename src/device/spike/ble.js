// BLE transport for SPIKE Prime HubOS 3.
// Service 0xFD02; RX (write) and TX (notify) characteristics.

const SERVICE_UUID = 0xfd02;
const RX_CHARACTERISTIC = '0000fd02-0001-1000-8000-00805f9b34fb';
const TX_CHARACTERISTIC = '0000fd02-0002-1000-8000-00805f9b34fb';
const STARTUP_DELAY = 250;

export async function openSpikeBle({ onData, onClose }) {
  if (!globalThis.navigator?.bluetooth) throw new Error('Web Bluetooth is not available.');
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
  const server = await device.gatt.connect();
  try {
    const service = await server.getPrimaryService(SERVICE_UUID);
    const rx = await service.getCharacteristic(RX_CHARACTERISTIC);
    const tx = await service.getCharacteristic(TX_CHARACTERISTIC);
    await tx.startNotifications();

    const handleValue = event => {
      const value = event.target.value;
      onData(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    };
    const handleDisconnect = () => onClose?.();
    tx.addEventListener('characteristicvaluechanged', handleValue);
    device.addEventListener('gattserverdisconnected', handleDisconnect);

    // Some BLE stacks need a moment after notifications are enabled.
    await new Promise(resolve => setTimeout(resolve, STARTUP_DELAY));

    return {
      async write(bytes) {
        if (typeof rx.writeValueWithoutResponse === 'function') await rx.writeValueWithoutResponse(bytes);
        else await rx.writeValue(bytes);
      },
      async close() {
        tx.removeEventListener('characteristicvaluechanged', handleValue);
        device.removeEventListener('gattserverdisconnected', handleDisconnect);
        try { await tx.stopNotifications(); } catch {}
        try { server.disconnect(); } catch {}
      },
    };
  } catch (error) {
    try { server.disconnect(); } catch {}
    throw error;
  }
}
