import { pack, unpack, crc32Aligned } from './codec.js';
import { requireSpikeSlot } from './slots.js';
import {
  MessageId,
  infoRequest,
  clearSlotRequest,
  startFileUploadRequest,
  transferChunkRequest,
  programFlowRequest,
  parseMessage,
} from './messages.js';

const FRAME_DELIMITER = 0x02;
const DEFAULT_TIMEOUT = 5000;

export class SpikeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SpikeError';
    this.code = code;
  }
}

export function supportsSpikeProtocol(info) {
  return info?.type === 'info' && info.rpcMajor === 1;
}

// HubOS 3 session over an abstract transport: { write(bytes), close() }.
export class SpikeHub {
  constructor({ timeout = DEFAULT_TIMEOUT } = {}) {
    this.timeout = timeout;
    this.transport = undefined;
    this.info = undefined;
    this.buffer = new Uint8Array(0);
    this.pending = new Map();
    this.consoleListeners = new Set();
    this.flowListeners = new Set();
    this.closeListeners = new Set();
    this.closed = false;
  }

  attach(transport) {
    this.transport = transport;
  }

  async initialize() {
    this.info = await this.request(infoRequest(), MessageId.infoResponse);
    return this.info;
  }

  async upload(source, slot, onProgress = () => {}) {
    requireSpikeSlot(slot);
    if (!this.info) throw new SpikeError('uninitialized', 'The SPIKE hub is not initialized.');
    const data = new TextEncoder().encode(source);
    const fileCrc = crc32Aligned(data);
    // An empty slot may report "not acknowledged"; continue with the upload.
    await this.request(clearSlotRequest(slot), MessageId.clearSlotResponse).catch(() => {});

    const started = await this.request(
      startFileUploadRequest('program.py', slot, fileCrc),
      MessageId.startFileUploadResponse,
    );
    if (!started.success) throw new SpikeError('rejected', 'The SPIKE hub rejected the program upload.');

    const maxChunkSize = Math.max(1, this.info.maxChunkSize);
    // Round down to a multiple of 4 so each chunk CRC keeps the alignment the
    // protocol requires and the final running CRC equals the file CRC.
    const chunkSize = maxChunkSize >= 4 ? maxChunkSize - (maxChunkSize % 4) : maxChunkSize;
    let runningCrc = 0;
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.subarray(offset, offset + chunkSize);
      runningCrc = crc32Aligned(chunk, runningCrc);
      const response = await this.request(
        transferChunkRequest(runningCrc, chunk),
        MessageId.transferChunkResponse,
      );
      if (!response.success) throw new SpikeError('rejected', 'The SPIKE hub rejected a program chunk.');
      onProgress(Math.min(1, (offset + chunk.length) / data.length));
    }
    if (!data.length) onProgress(1);
  }

  async start(slot) {
    requireSpikeSlot(slot);
    const response = await this.request(
      programFlowRequest(slot, false),
      MessageId.programFlowResponse,
    );
    if (!response.success) throw new SpikeError('rejected', 'The SPIKE hub did not start the program.');
  }

  async stop(slot) {
    requireSpikeSlot(slot);
    const response = await this.request(
      programFlowRequest(slot, true),
      MessageId.programFlowResponse,
    );
    if (!response.success) throw new SpikeError('rejected', 'The SPIKE hub did not stop the program.');
  }

  onConsole(listener) {
    this.consoleListeners.add(listener);
    return () => this.consoleListeners.delete(listener);
  }

  onFlow(listener) {
    this.flowListeners.add(listener);
    return () => this.flowListeners.delete(listener);
  }

  onClose(listener) {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  async send(message) {
    if (this.closed || !this.transport) {
      throw new SpikeError('closed', 'The SPIKE hub connection is closed.');
    }
    const frame = pack(message);
    const packetSize = this.info?.maxPacketSize || frame.length;
    const writes = [];
    for (let offset = 0; offset < frame.length; offset += packetSize) {
      writes.push(this.transport.write(frame.subarray(offset, offset + packetSize)));
    }
    await Promise.all(writes);
  }

  request(message, expectedId) {
    if (this.closed) return Promise.reject(new SpikeError('closed', 'The SPIKE hub connection is closed.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(expectedId);
        reject(new SpikeError('timeout', 'The SPIKE hub did not respond.'));
      }, this.timeout);
      this.pending.set(expectedId, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      this.send(message).catch(error => {
        const waiter = this.pending.get(expectedId);
        this.pending.delete(expectedId);
        waiter?.reject(error);
      });
    });
  }

  receive(chunk) {
    if (this.closed) return;
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;
    let end;
    while ((end = this.buffer.indexOf(FRAME_DELIMITER)) !== -1) {
      const frame = this.buffer.slice(0, end + 1);
      this.buffer = this.buffer.slice(end + 1);
      this.process(frame);
    }
  }

  process(frame) {
    let message;
    try {
      message = parseMessage(unpack(frame));
    } catch {
      return;
    }
    if (!message) return;
    if (message.type === 'console') {
      for (const listener of this.consoleListeners) listener(message.message);
      return;
    }
    if (message.type === 'programFlow') {
      for (const listener of this.flowListeners) listener(message);
      return;
    }
    const waiter = this.pending.get(message.id);
    if (waiter) {
      this.pending.delete(message.id);
      waiter.resolve(message);
    }
  }

  handleClose(error) {
    if (this.closed) return;
    this.closed = true;
    for (const [id, waiter] of this.pending) {
      this.pending.delete(id);
      waiter.reject(error ?? new SpikeError('closed', 'The SPIKE hub disconnected.'));
    }
    for (const listener of this.closeListeners) listener(error);
  }

  async close() {
    if (!this.closed) this.handleClose();
    await this.transport?.close?.().catch(() => {});
  }
}
