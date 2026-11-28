// LEGO SPIKE Prime HubOS 3 wire format, shared by USB serial and BLE.
// Reference: https://github.com/LEGO/spike-prime-docs
//
// Framing: COBS-encode (escaping 0x00-0x02), XOR every byte with 0x03,
// then append the 0x02 message delimiter.

const DELIMITER = 0x02;
const NO_DELIMITER = 0xff;
const COBS_OFFSET = 0x02;
const MAX_BLOCK_SIZE = 84;
const XOR = 0x03;

export function encode(data) {
  const buffer = [];
  let codeIndex = 0;
  let block = 0;

  const beginBlock = () => {
    codeIndex = buffer.length;
    buffer.push(NO_DELIMITER);
    block = 1;
  };

  beginBlock();
  for (const byte of data) {
    if (byte > DELIMITER) {
      buffer.push(byte);
      block++;
    }
    if (byte <= DELIMITER || block > MAX_BLOCK_SIZE) {
      if (byte <= DELIMITER) buffer[codeIndex] = byte * MAX_BLOCK_SIZE + block + COBS_OFFSET;
      beginBlock();
    }
  }
  buffer[codeIndex] = block + COBS_OFFSET;
  return Uint8Array.from(buffer);
}

function unescape(code) {
  if (code === NO_DELIMITER) return [null, MAX_BLOCK_SIZE + 1];
  let value = Math.floor((code - COBS_OFFSET) / MAX_BLOCK_SIZE);
  let block = (code - COBS_OFFSET) % MAX_BLOCK_SIZE;
  if (block === 0) {
    block = MAX_BLOCK_SIZE;
    value -= 1;
  }
  return [value, block];
}

export function decode(data) {
  if (!data.length) return new Uint8Array(0);
  const buffer = [];
  let [value, block] = unescape(data[0]);
  for (let index = 1; index < data.length; index++) {
    block--;
    if (block > 0) {
      buffer.push(data[index]);
    } else {
      if (value !== null) buffer.push(value);
      [value, block] = unescape(data[index]);
    }
  }
  return Uint8Array.from(buffer);
}

export function pack(data) {
  const buffer = encode(data);
  for (let index = 0; index < buffer.length; index++) buffer[index] ^= XOR;
  const result = new Uint8Array(buffer.length + 1);
  result.set(buffer);
  result[buffer.length] = DELIMITER;
  return result;
}

export function unpack(frame) {
  const start = frame[0] === 0x01 ? 1 : 0;
  const end = frame[frame.length - 1] === DELIMITER ? -1 : frame.length;
  const unframed = frame.slice(start, end).map(byte => byte ^ XOR);
  return decode(unframed);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

// Standard CRC-32 (IEEE 802.3), matching binascii.crc32 / zlib.crc32.
// The seed is the previous CRC so chunks can be chained.
export function crc32(data, seed = 0) {
  let crc = (seed ^ 0xffffffff) >>> 0;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

// The protocol requires CRCs over a multiple of 4 bytes; pad with zeros.
export function crc32Aligned(data, seed = 0) {
  const remainder = data.length % 4;
  if (!remainder) return crc32(data, seed);
  const aligned = new Uint8Array(data.length + 4 - remainder);
  aligned.set(data);
  return crc32(aligned, seed);
}
