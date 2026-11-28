import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import { pack, unpack, crc32, crc32Aligned } from '../src/device/spike/codec.js';
import {
  MessageId,
  infoRequest,
  clearSlotRequest,
  startFileUploadRequest,
  transferChunkRequest,
  programFlowRequest,
  parseMessage,
} from '../src/device/spike/messages.js';
import { SpikeHub, supportsSpikeProtocol } from '../src/device/spike/hub.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function infoResponseBytes({
  rpcMajor = 1,
  rpcMinor = 0,
  rpcBuild = 0,
  firmwareMajor = 3,
  firmwareMinor = 2,
  firmwareBuild = 26,
  maxPacketSize = 4096,
  maxMessageSize = 4096,
  maxChunkSize = 8,
  productGroupDevice = 0,
} = {}) {
  const bytes = new Uint8Array(17);
  const view = new DataView(bytes.buffer);
  bytes[0] = MessageId.infoResponse;
  view.setUint8(1, rpcMajor);
  view.setUint8(2, rpcMinor);
  view.setUint16(3, rpcBuild, true);
  view.setUint8(5, firmwareMajor);
  view.setUint8(6, firmwareMinor);
  view.setUint16(7, firmwareBuild, true);
  view.setUint16(9, maxPacketSize, true);
  view.setUint16(11, maxMessageSize, true);
  view.setUint16(13, maxChunkSize, true);
  view.setUint16(15, productGroupDevice, true);
  return bytes;
}

test('COBS packing round-trips delimiter bytes and long blocks', () => {
  const cases = [
    new Uint8Array(0),
    Uint8Array.of(0x00),
    Uint8Array.of(0x00, 0x01, 0x02, 0x03),
    Uint8Array.from({ length: 300 }, (_, index) => index % 4),
    Uint8Array.from({ length: 400 }, (_, index) => (index * 37) % 256),
  ];
  for (const data of cases) {
    const frame = pack(data);
    assert.equal(frame.at(-1), 0x02);
    assert.deepEqual(unpack(frame), data);
    assert.deepEqual(unpack(Uint8Array.of(0x01, ...frame)), data);
  }
});

test('CRC-32 matches zlib and chains across aligned chunks', () => {
  const sample = encoder.encode('123456789');
  assert.equal(crc32(sample), zlib.crc32(Buffer.from(sample)));
  const padded = encoder.encode('123456789\0\0\0');
  assert.equal(crc32Aligned(sample), zlib.crc32(Buffer.from(padded)));

  const source = encoder.encode('a'.repeat(37));
  let running = 0;
  for (let offset = 0; offset < source.length; offset += 8) {
    running = crc32Aligned(source.subarray(offset, offset + 8), running);
  }
  assert.equal(running, crc32Aligned(source));
});

test('message serialization matches the HubOS 3 layout', () => {
  assert.deepEqual(infoRequest(), Uint8Array.of(0x00));
  assert.deepEqual(clearSlotRequest(7), Uint8Array.of(0x46, 7));

  const name = 'program.py';
  const start = startFileUploadRequest(name, 5, 0x12345678);
  assert.equal(start.length, 7 + name.length);
  assert.equal(start[0], MessageId.startFileUploadRequest);
  assert.equal(decoder.decode(start.subarray(1, 1 + name.length)), name);
  assert.equal(start[1 + name.length], 0x00);
  assert.equal(start[2 + name.length], 5);
  assert.equal(new DataView(start.buffer).getUint32(3 + name.length, true), 0x12345678);
  assert.throws(() => startFileUploadRequest('x'.repeat(32), 0, 0), RangeError);

  const chunk = Uint8Array.of(1, 2, 3);
  const transfer = transferChunkRequest(0xdeadbeef, chunk);
  const transferView = new DataView(transfer.buffer);
  assert.equal(transfer[0], MessageId.transferChunkRequest);
  assert.equal(transferView.getUint32(1, true), 0xdeadbeef);
  assert.equal(transferView.getUint16(5, true), chunk.length);
  assert.deepEqual(transfer.subarray(7), chunk);

  assert.deepEqual(programFlowRequest(3, false), Uint8Array.of(0x1e, 0, 3));
  assert.deepEqual(programFlowRequest(3, true), Uint8Array.of(0x1e, 1, 3));
});

test('InfoResponse exposes firmware and transport limits', () => {
  const info = parseMessage(infoResponseBytes());
  assert.equal(info.firmware, '3.2.26');
  assert.equal(info.maxPacketSize, 4096);
  assert.equal(info.maxChunkSize, 8);
  assert.equal(info.productGroupDevice, 0);
  assert.equal(supportsSpikeProtocol(info), true);

  const actualHub = parseMessage(infoResponseBytes({ firmwareMajor: 1, firmwareMinor: 8, firmwareBuild: 149 }));
  assert.equal(actualHub.firmware, '1.8.149');
  assert.equal(supportsSpikeProtocol(actualHub), true);
  assert.equal(supportsSpikeProtocol(parseMessage(infoResponseBytes({ rpcMajor: 2 }))), false);
});

test('ConsoleNotification decodes null-terminated text', () => {
  const message = parseMessage(Uint8Array.of(MessageId.consoleNotification, ...encoder.encode('Hello from hub'), 0));
  assert.equal(message.type, 'console');
  assert.equal(message.message, 'Hello from hub');
});

function mockTransport(hub, infoBytes) {
  const state = { chunks: [], flows: [], name: undefined, slot: undefined, fileCrc: undefined, runningCrc: undefined };
  state.transport = {
    async write(packet) {
      const bytes = unpack(packet);
      const id = bytes[0];
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const respond = value => hub.receive(pack(value));
      if (id === MessageId.infoRequest) {
        respond(infoBytes);
      } else if (id === MessageId.clearSlotRequest) {
        respond(Uint8Array.of(MessageId.clearSlotResponse, 0x01));
      } else if (id === MessageId.startFileUploadRequest) {
        const end = bytes.indexOf(0, 1);
        state.name = decoder.decode(bytes.subarray(1, end));
        state.slot = bytes[end + 1];
        state.fileCrc = view.getUint32(end + 2, true);
        respond(Uint8Array.of(MessageId.startFileUploadResponse, 0x00));
      } else if (id === MessageId.transferChunkRequest) {
        state.runningCrc = view.getUint32(1, true);
        const size = view.getUint16(5, true);
        state.chunks.push(bytes.slice(7, 7 + size));
        respond(Uint8Array.of(MessageId.transferChunkResponse, 0x00));
      } else if (id === MessageId.programFlowRequest) {
        state.flows.push({ action: bytes[1], slot: bytes[2] });
        respond(Uint8Array.of(MessageId.programFlowResponse, 0x00));
      }
    },
    async close() {},
  };
  return state;
}

test('hub upload transfers chunks, starts the program and streams console output', async () => {
  const source = `print("hello")\n# ${'x'.repeat(30)}`;
  const data = encoder.encode(source);
  const hub = new SpikeHub({ timeout: 1000 });
  const state = mockTransport(hub, infoResponseBytes({ maxChunkSize: 6 }));
  hub.attach(state.transport);
  const info = await hub.initialize();
  assert.equal(supportsSpikeProtocol(info), true);

  const consoleMessages = [];
  hub.onConsole(text => consoleMessages.push(text));
  const progress = [];
  await hub.upload(source, 4, value => progress.push(value));
  await hub.start(4);

  assert.equal(state.name, 'program.py');
  assert.equal(state.slot, 4);
  assert.equal(state.fileCrc, crc32Aligned(data));
  assert.equal(state.runningCrc, crc32Aligned(data));
  assert.ok(state.chunks.every(chunk => chunk.length <= 4));
  assert.equal(decoder.decode(Uint8Array.from(state.chunks.flatMap(chunk => [...chunk]))), source);
  assert.deepEqual(state.flows, [{ action: 0, slot: 4 }]);
  assert.equal(progress.at(-1), 1);

  hub.receive(pack(Uint8Array.of(MessageId.consoleNotification, ...encoder.encode('Hello from hub'), 0)));
  assert.deepEqual(consoleMessages, ['Hello from hub']);
});

test('hub reports a timeout when the port never answers', async () => {
  const hub = new SpikeHub({ timeout: 20 });
  hub.attach({ async write() {}, async close() {} });
  await assert.rejects(hub.initialize(), error => error.code === 'timeout');
});
