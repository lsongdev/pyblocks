import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorPort } from '../src/device/micropython.js';
import { openSerialPort, SerialOpenError } from '../src/device/transport/serial.js';

function mockPort(write = async () => {}) {
  let controller;
  const chunks = [];
  const port = {
    readable: new ReadableStream({ start(value) { controller = value; } }),
    writable: new WritableStream({ async write(chunk) { chunks.push(new Uint8Array(chunk)); await write(chunk); } }),
    async open(options) { assert.deepEqual(options, { baudRate: 115200 }); },
    async close() {
      assert.equal(port.readable.locked, false);
      assert.equal(port.writable.locked, false);
      port.closed = true;
    },
  };
  return { port, chunks, get controller() { return controller; } };
}

test('monitor reads UTF-8 while writes serialize and preserve control bytes and line endings', async () => {
  const device = mockPort();
  let output = '';
  const session = await monitorPort(device.port, text => { output += text; });
  const bytes = new TextEncoder().encode('你好');
  device.controller.enqueue(bytes.slice(0, 2));
  device.controller.enqueue(bytes.slice(2));
  await Promise.all([session.write('x'.repeat(130)), session.write('你好\r\n'), session.write('\x03'), session.write('\x04')]);
  const written = new TextDecoder().decode(Uint8Array.from(device.chunks.flatMap(chunk => [...chunk])));
  assert.equal(written, 'x'.repeat(130) + '你好\r\n\x03\x04');
  assert.ok(device.chunks.every(chunk => chunk.length <= 64));
  assert.equal(output, '你好');
  await session.close();
  assert.ok(device.port.closed);
  await assert.rejects(session.write('after close'), /closed/);
});

test('close waits for accepted writes and rejects new writes before releasing the port', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const device = mockPort(() => gate);
  const session = await monitorPort(device.port, () => {});
  const writing = session.write('pending');
  const closing = session.close();
  await assert.rejects(session.write('late'), /closed/);
  assert.ok(!device.port.closed);
  release();
  await Promise.all([writing, closing]);
  assert.ok(device.port.closed);
});

test('write errors release locks, and disconnection closes the session', async () => {
  const device = mockPort(async () => { throw new Error('device write failed'); });
  const session = await monitorPort(device.port, () => {});
  await assert.rejects(session.write('x'), /device write failed/);
  assert.equal(device.port.writable.locked, false);
  const ended = assert.rejects(session.done, /device disconnected/);
  device.controller.error(new Error('device disconnected'));
  await ended;
  assert.ok(device.port.closed);
  await assert.rejects(session.write('x'), /closed/);
});

test('executeProgram runs setup through raw REPL without replacing files and returns a closable session', async () => {
  const { executeProgram } = await import('../src/device/micropython.js');
  let device;
  let command = '';
  let commands = [];
  let raw = false;
  device = mockPort(async chunk => {
    const text = new TextDecoder().decode(chunk);
    const respond = value => device.controller.enqueue(new TextEncoder().encode(value));
    if (text === '\r\x03\x03\x02') respond('>>>');
    else if (text === '\x01') { raw = true; respond('raw REPL; CTRL-B to exit\r\n>'); }
    else if (text === '\x02') { raw = false; respond('>>>'); }
    else if (text === '\x04' && !raw) respond('MPY: soft reboot\r\n');
    else {
      command += text;
      if (command.endsWith('\x04')) {
        commands.push(command.slice(0, -1));
        command = '';
        respond('OKconfigured\r\n\x04\x04>');
      }
    }
  });
  const source = 'print("' + 'setup'.repeat(30) + '")';
  let output = '';
  const session = await executeProgram(device.port, source, text => { output += text; });
  assert.deepEqual(commands, [source]);
  assert.ok(!commands.some(command => /open\(|main.py/.test(command)));
  assert.match(output, /MPY: soft reboot/);
  await session.close();
  assert.ok(device.port.closed);
});

test('raw REPL reopens and pulses reset signals after a first-handshake timeout', async () => {
  const { executeProgram } = await import('../src/device/micropython.js');
  let opens = 0;
  let raw = false;
  let controller;
  let readable;
  let writable;
  let command = '';
  const commands = [];
  const signals = [];
  const port = {
    get readable() { return readable; },
    get writable() { return writable; },
    async open() {
      opens++;
      readable = new ReadableStream({ start(value) { controller = value; } });
      writable = new WritableStream({
        async write(chunk) {
          const text = new TextDecoder().decode(chunk);
          const respond = value => controller.enqueue(new TextEncoder().encode(value));
          if (opens === 1 && text === '\r\x03\x03\x02') { controller.close(); return; }
          if (text === '\r\x03\x03\x02') respond('>>>');
          else if (text === '\x01') { raw = true; respond('raw REPL; CTRL-B to exit\r\n>'); }
          else if (text === '\x02') { raw = false; respond('>>>'); }
          else if (text === '\x04' && !raw) respond('MPY: soft reboot\r\n');
          else {
            command += text;
            if (command.endsWith('\x04')) {
              commands.push(command.slice(0, -1));
              command = '';
              respond('OKconfigured\r\n\x04\x04>');
            }
          }
        },
      });
    },
    async close() { readable = writable = undefined; },
    async setSignals(value) { signals.push(value); },
  };
  const session = await executeProgram(port, 'print("retry")');
  assert.equal(opens, 2);
  assert.deepEqual(commands, ['print("retry")']);
  assert.deepEqual(signals, [
    { dataTerminalReady: false, requestToSend: true },
    { dataTerminalReady: false, requestToSend: false },
  ]);
  await session.close();
});

test('raw REPL handles fragmented acknowledgements and frame boundaries', async () => {
  const { executeProgram } = await import('../src/device/micropython.js');
  let device;
  let raw = false;
  device = mockPort(async chunk => {
    const text = new TextDecoder().decode(chunk);
    const respond = (...parts) => parts.forEach(part => device.controller.enqueue(new TextEncoder().encode(part)));
    if (text === '\r\x03\x03\x02') respond('>', '>>');
    else if (text === '\x01') { raw = true; respond('raw REPL; CTRL-B to exit\r\n', '>'); }
    else if (text === '\x02') { raw = false; respond('>>>'); }
    else if (text === '\x04' && !raw) respond('MPY: soft reboot', '\r\n');
    else if (text.endsWith('\x04')) respond('O', 'Koutput', '\x04', '\x04', '>');
  });
  const session = await executeProgram(device.port, 'print(1)');
  await session.close();
  assert.ok(device.port.closed);
});

test('raw REPL rejects malformed acknowledgement and closes the port', async () => {
  const { executeProgram, MicroPythonError } = await import('../src/device/micropython.js');
  let device;
  device = mockPort(async chunk => {
    const text = new TextDecoder().decode(chunk);
    const respond = value => device.controller.enqueue(new TextEncoder().encode(value));
    if (text === '\r\x03\x03\x02') respond('>>>');
    else if (text === '\x01') respond('raw REPL; CTRL-B to exit\r\n>');
    else if (text.endsWith('\x04')) respond('NO');
  });
  await assert.rejects(executeProgram(device.port, 'print(1)'), error =>
    error instanceof MicroPythonError && error.code === 'unexpectedResponse');
  assert.ok(device.port.closed);
});

test('transient serial open failures retry the same port; permission errors do not retry', async () => {
  let opens=0;
  const port={async open(options) {
    assert.deepEqual(options,{baudRate:115200});
    if (++opens===1) throw new DOMException('temporarily busy','NetworkError');
  }};
  await openSerialPort(port,{retryDelays:[0]});
  assert.equal(opens,2);
  opens=0;
  port.open=async()=>{opens++;throw new DOMException('denied','SecurityError');};
  await assert.rejects(openSerialPort(port,{retryDelays:[0]}),SerialOpenError);
  assert.equal(opens,1);
});
test('failed REPL open does not close an unowned port', async () => {
  const { executeProgram }=await import('../src/device/micropython.js');
  let closed=0;
  const port={async open(){throw new DOMException('already open','InvalidStateError');},async close(){closed++;}};
  await assert.rejects(executeProgram(port,'print(1)'),SerialOpenError);
  assert.equal(closed,0);
});
test('explicit disconnect retries a failed monitor close', async () => {
  const {port}=mockPort();
  let closes=0;
  port.close=async()=>{if(++closes===1)throw new Error('still closing');};
  const session=await monitorPort(port,()=>{});
  const ended=assert.rejects(session.done,/still closing/);
  await session.close();
  await ended;
  assert.equal(closes,2);
});
