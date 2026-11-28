// Message serialization for the LEGO SPIKE Prime HubOS 3 RPC protocol.
// Reference: https://github.com/LEGO/spike-prime-docs/blob/main/docs/source/messages.rst

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const MessageId = Object.freeze({
  infoRequest: 0x00,
  infoResponse: 0x01,
  startFileUploadRequest: 0x0c,
  startFileUploadResponse: 0x0d,
  transferChunkRequest: 0x10,
  transferChunkResponse: 0x11,
  programFlowRequest: 0x1e,
  programFlowResponse: 0x1f,
  programFlowNotification: 0x20,
  consoleNotification: 0x21,
  clearSlotRequest: 0x46,
  clearSlotResponse: 0x47,
});

export function infoRequest() {
  return Uint8Array.of(MessageId.infoRequest);
}

export function clearSlotRequest(slot) {
  return Uint8Array.of(MessageId.clearSlotRequest, slot & 0xff);
}

export function startFileUploadRequest(name, slot, crc) {
  const nameBytes = encoder.encode(name);
  if (nameBytes.length > 31) throw new RangeError('SPIKE program names are limited to 31 bytes.');
  const bytes = new Uint8Array(7 + nameBytes.length);
  bytes[0] = MessageId.startFileUploadRequest;
  bytes.set(nameBytes, 1);
  bytes[1 + nameBytes.length] = 0x00;
  bytes[2 + nameBytes.length] = slot & 0xff;
  new DataView(bytes.buffer).setUint32(3 + nameBytes.length, crc >>> 0, true);
  return bytes;
}

export function transferChunkRequest(runningCrc, chunk) {
  const bytes = new Uint8Array(7 + chunk.length);
  bytes[0] = MessageId.transferChunkRequest;
  const view = new DataView(bytes.buffer);
  view.setUint32(1, runningCrc >>> 0, true);
  view.setUint16(5, chunk.length, true);
  bytes.set(chunk, 7);
  return bytes;
}

export function programFlowRequest(slot, stop = false) {
  return Uint8Array.of(MessageId.programFlowRequest, stop ? 1 : 0, slot & 0xff);
}

function stringUntilNul(bytes) {
  const end = bytes.indexOf(0);
  return decoder.decode(end === -1 ? bytes : bytes.subarray(0, end));
}

export function parseMessage(bytes) {
  if (!bytes.length) return null;
  const id = bytes[0];
  switch (id) {
    case MessageId.infoResponse:
      return parseInfoResponse(bytes);
    case MessageId.startFileUploadResponse:
    case MessageId.transferChunkResponse:
    case MessageId.programFlowResponse:
    case MessageId.clearSlotResponse:
      return { type: 'status', id, success: bytes[1] === 0x00 };
    case MessageId.programFlowNotification:
      return { type: 'programFlow', id, action: bytes[1] };
    case MessageId.consoleNotification:
      return { type: 'console', id, message: stringUntilNul(bytes.subarray(1)) };
    default:
      return { type: 'unknown', id };
  }
}

function parseInfoResponse(bytes) {
  if (bytes.length < 17) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const info = {
    type: 'info',
    id: MessageId.infoResponse,
    rpcMajor: view.getUint8(1),
    rpcMinor: view.getUint8(2),
    rpcBuild: view.getUint16(3, true),
    firmwareMajor: view.getUint8(5),
    firmwareMinor: view.getUint8(6),
    firmwareBuild: view.getUint16(7, true),
    maxPacketSize: view.getUint16(9, true),
    maxMessageSize: view.getUint16(11, true),
    maxChunkSize: view.getUint16(13, true),
    productGroupDevice: view.getUint16(15, true),
  };
  info.firmware = `${info.firmwareMajor}.${info.firmwareMinor}.${info.firmwareBuild}`;
  return info;
}
