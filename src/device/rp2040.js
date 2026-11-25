// RP2040 ROM PICOBOOT protocol:
// https://github.com/raspberrypi/pico-sdk/blob/master/src/common/boot_picoboot_headers/include/boot/picoboot.h
const flashBase = 0x10000000;
const flashEnd = flashBase + 2 * 1024 * 1024;

export function decodePicoUF2(buffer) {
  const view = new DataView(buffer);
  if (!buffer.byteLength || buffer.byteLength % 512) throw new Error('Invalid UF2 length.');
  const blocks = buffer.byteLength / 512;
  const pages = new Map();
  const numbers = new Set();
  let end = flashBase;
  for (let offset = 0; offset < buffer.byteLength; offset += 512) {
    const word = n => view.getUint32(offset + n, true);
    const address = word(12);
    const number = word(20);
    if (word(0) !== 0x0a324655 || word(4) !== 0x9e5d5157 || word(508) !== 0x0ab16f30 ||
        word(8) !== 0x2000 || word(16) !== 256 || word(28) !== 0xe48bff56 || word(24) !== blocks ||
        number >= blocks || numbers.has(number) || pages.has(address) || address % 256 ||
        address < flashBase || address + 256 > flashEnd) throw new Error('Invalid Raspberry Pi Pico UF2 firmware.');
    pages.set(address, new Uint8Array(buffer, offset + 32, 256));
    numbers.add(number);
    end = Math.max(end, address + 256);
  }
  if (!pages.has(flashBase)) throw new Error('UF2 firmware is missing its boot image.');
  const data = new Uint8Array(end - flashBase).fill(0xff);
  for (const [address, page] of pages) data.set(page, address - flashBase);
  return data;
}

export async function connectPicoBoot() {
  const device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x2e8a, productId: 0x0003 }] });
  let iface;
  let input;
  let output;
  let token = 0;
  let exclusive = false;
  let rebooted = false;
  async function transfer(operation) {
    let timer;
    try {
      const result = await Promise.race([
        operation,
        new Promise((_, reject) => { timer = setTimeout(() => {
          void device.close().catch(() => {});
          reject(new Error('Pico USB transfer timed out. Reconnect in BOOTSEL mode.'));
        }, 15000); }),
      ]);
      if (result.status !== 'ok') throw new Error(`Pico USB transfer failed: ${result.status}`);
      return result;
    } finally { clearTimeout(timer); }
  }
  async function write(data) {
    const result = await transfer(device.transferOut(output, data));
    if (result.bytesWritten !== data.byteLength) throw new Error('Incomplete Pico USB write.');
  }
  async function reset() {
    await transfer(device.controlTransferOut({ requestType: 'vendor', recipient: 'interface', request: 0x41, value: 0, index: iface }));
  }
  async function command(id, args = new Uint8Array(), data, readLength = 0) {
    const packet = new Uint8Array(32);
    const view = new DataView(packet.buffer);
    view.setUint32(0, 0x431fd10b, true);
    view.setUint32(4, ++token, true);
    packet[8] = id;
    packet[9] = args.byteLength;
    view.setUint32(12, data?.byteLength ?? readLength, true);
    packet.set(args, 16);
    await write(packet);
    let result;
    if (id & 0x80) {
      const response = await transfer(device.transferIn(input, readLength));
      if (response.data?.byteLength !== readLength) throw new Error('Incomplete Pico USB read.');
      result = new Uint8Array(response.data.buffer, response.data.byteOffset, readLength);
      await write(new Uint8Array([0]));
    } else {
      if (data) await write(data);
      const ack = await transfer(device.transferIn(input, 64));
      if (ack.data?.byteLength) throw new Error('Invalid Pico command acknowledgement.');
    }
    return result;
  }
  const words = (...values) => {
    const args = new Uint8Array(values.length * 4);
    values.forEach((value, i) => new DataView(args.buffer).setUint32(i * 4, value, true));
    return args;
  };
  const close = async () => {
    if (!device.opened) return;
    if (exclusive && !rebooted) {
      try { await reset(); await command(7); await command(1, new Uint8Array([0])); } catch { /* Preserve original failure. */ }
    }
    if (iface !== undefined) await device.releaseInterface(iface).catch(() => {});
    await device.close().catch(() => {});
  };
  try {
    await device.open();
    if (!device.configuration) await device.selectConfiguration(1);
    for (const item of device.configuration.interfaces) {
      const alternate = item.alternate;
      const incoming = alternate.endpoints.find(ep => ep.type === 'bulk' && ep.direction === 'in');
      const outgoing = alternate.endpoints.find(ep => ep.type === 'bulk' && ep.direction === 'out');
      if (alternate.interfaceClass === 255 && incoming && outgoing) {
        iface = item.interfaceNumber; input = incoming.endpointNumber; output = outgoing.endpointNumber;
        break;
      }
    }
    if (iface === undefined) throw new Error('RP2040 PICOBOOT interface not found.');
    await device.claimInterface(iface);
    await reset();
    return {
      close,
      async install(buffer, report, progress) {
        // Validate every UF2 block before any flash operation.
        const data = decodePicoUF2(buffer);
        await command(1, new Uint8Array([1]));
        exclusive = true;
        await command(6);
        report('firmwareWriting');
        const eraseSize = Math.ceil(data.length / 4096) * 4096;
        for (let offset = 0; offset < eraseSize; offset += 4096) {
          await command(3, words(flashBase + offset, 4096));
        }
        for (let offset = 0; offset < data.length; offset += 4096) {
          const chunk = data.subarray(offset, offset + 4096);
          await command(5, words(flashBase + offset, chunk.length), chunk);
          progress(.8 * (offset + chunk.length) / data.length);
        }
        report('firmwareVerifying');
        await command(7);
        for (let offset = 0; offset < data.length; offset += 4096) {
          const length = Math.min(4096, data.length - offset);
          const actual = await command(0x84, words(flashBase + offset, length), undefined, length);
          if (actual.some((byte, i) => byte !== data[offset + i])) throw new Error('Pico flash verification failed.');
          progress(.8 + .2 * (offset + length) / data.length);
        }
        await command(1, new Uint8Array([0]));
        exclusive = false;
        await command(2, words(0, 0, 500));
        rebooted = true;
      },
    };
  } catch (error) { await close(); throw error; }
}
