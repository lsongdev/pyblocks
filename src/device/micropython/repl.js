import { writeSerialText, streamOutput } from '../transport/serial.js';
import { MicroPythonError, BoardCommandError } from './errors.js';

const handshakeTimeout = 4000;
const commandTimeout = 15000;
const responseLimit = 1024 * 1024;

async function resetSerialBoard(port) {
  if (typeof port.setSignals !== 'function') return;
  try {
    await port.setSignals({ dataTerminalReady: false, requestToSend: true });
    await new Promise(resolve => setTimeout(resolve, 100));
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  } catch {
    // Some USB bridges do not expose DTR/RTS; the raw-REPL retry still applies.
  }
}

export async function runOnBoard(port, onOutput, operation) {
  let decoder;
  let reader;
  let writer;
  let pending = '';

  const write = text => writeSerialText(writer, text);

  // A deadline applies to the entire frame, not each incoming chunk.
  async function readFrame(ready, timeoutMs) {
    const timeout = setTimeout(() => void reader.cancel().catch(() => {}), timeoutMs);
    try {
      while (!ready()) {
        const { value, done } = await reader.read();
        if (done) throw new MicroPythonError('serialTimeout', 'Board response timed out or the serial port disconnected');
        pending += decoder.decode(value, { stream: true });
        if (pending.length > responseLimit) {
          throw new MicroPythonError('unexpectedResponse', 'MicroPython response exceeds the buffer limit');
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async function readUntil(marker, timeoutMs = handshakeTimeout) {
    await readFrame(() => pending.includes(marker), timeoutMs);
    const end = pending.indexOf(marker);
    const result = pending.slice(0, end);
    pending = pending.slice(end + marker.length);
    return result;
  }

  async function expect(marker, timeoutMs = handshakeTimeout) {
    await readFrame(() => pending.length >= marker.length, timeoutMs);
    if (!pending.startsWith(marker)) {
      throw new MicroPythonError('unexpectedResponse', 'Unexpected response from MicroPython');
    }
    pending = pending.slice(marker.length);
  }

  async function open() {
    await port.open({ baudRate: 115200 });
    decoder = new TextDecoder();
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
    pending = '';
  }

  async function close() {
    try { writer?.releaseLock(); } catch {}
    try { reader?.releaseLock(); } catch {}
    writer = reader = undefined;
    await port.close().catch(() => {});
  }

  async function enterRawRepl() {
    await write('\r\x03\x03\x02');
    await readUntil('>>>');
    await write('\x01');
    await readUntil('raw REPL; CTRL-B to exit\r\n>');
  }

  async function execute(command) {
    await write(command + '\x04');
    await expect('OK');
    const output = await readUntil('\x04', commandTimeout);
    const error = await readUntil('\x04', commandTimeout);
    await expect('>');
    if (error.trim()) throw new BoardCommandError(error.trim());
    return output;
  }

  try {
    await open();
    try {
      await enterRawRepl();
    } catch (error) {
      if (!(error instanceof MicroPythonError) || error.code !== 'serialTimeout') throw error;
      // XiaoMiao's GD32 bridge and similar USB-UART adapters can be left in
      // download mode after the previous session closes. Reopen, pulse reset,
      // release the signals, and retry the raw-REPL handshake once.
      await close();
      await open();
      await resetSerialBoard(port);
      await new Promise(resolve => setTimeout(resolve, 200));
      await enterRawRepl();
    }
    const result = await operation(execute);
    await write('\x02');
    await readUntil('>>>');
    await write('\x04');
    await readUntil('MPY: soft reboot');
    writer.releaseLock();
    const session = streamOutput(port, reader, decoder, onOutput, 'MPY: soft reboot' + pending);
    writer = reader = undefined;
    return { session, result };
  } catch (error) {
    await close();
    throw error;
  }
}

