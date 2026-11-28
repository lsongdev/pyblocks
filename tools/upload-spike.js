#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { closeSync, constants, openSync, readFileSync, readdirSync, readSync, writeSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { SpikeHub, supportsSpikeProtocol } from '../src/device/spike/hub.js';

const usage = 'Usage: node tools/upload-spike.js --slot 0 [--port /dev/ttyACM1] program.py\nThe selected slot (0–19) is overwritten.';

function findPort() {
  const directory = '/dev/serial/by-id';
  const devices = readdirSync(directory).filter(name => /^usb-LEGO_.*SPIKE_Prime_VCP_/.test(name));
  if (devices.length !== 1) throw new Error('Specify --port when exactly one SPIKE Prime USB port cannot be identified.');
  return `${directory}/${devices[0]}`;
}

async function upload(port, slot, source) {
  execFileSync('stty', ['-F', port, '115200', 'raw', '-echo', '-hupcl']);
  const fd = openSync(port, constants.O_RDWR | constants.O_NOCTTY | constants.O_NONBLOCK);
  const hub = new SpikeHub();
  const bytes = Buffer.alloc(4096);
  const reader = setInterval(() => {
    try {
      const length = readSync(fd, bytes);
      if (length === 0) throw new Error('Serial port reached EOF.');
      hub.receive(bytes.subarray(0, length));
    } catch (error) {
      if (error.code !== 'EAGAIN') hub.handleClose(error);
    }
  }, 10);

  let pendingWrite = Promise.resolve();
  hub.attach({
    write(data) {
      pendingWrite = pendingWrite.then(async () => {
        const deadline = Date.now() + hub.timeout;
        for (let offset = 0; offset < data.length;) {
          if (hub.closed) throw new Error('Serial port closed during write.');
          try {
            const length = writeSync(fd, data, offset, data.length - offset);
            if (length > 0) {
              offset += length;
              continue;
            }
          } catch (error) {
            if (error.code !== 'EAGAIN') throw error;
          }
          if (Date.now() >= deadline) throw new Error('Serial write timed out.');
          await delay(10);
        }
      });
      return pendingWrite;
    },
    async close() {
      clearInterval(reader);
      closeSync(fd);
    },
  });

  try {
    await delay(250);
    const info = await hub.initialize();
    console.error(`SPIKE Prime firmware ${info.firmware} (RPC ${info.rpcMajor}.${info.rpcMinor}.${info.rpcBuild})`);
    if (!supportsSpikeProtocol(info)) throw new Error('Unsupported SPIKE communication protocol.');
    hub.onConsole(message => process.stdout.write(message));
    await hub.upload(source, slot, progress => console.error(`Upload ${Math.round(progress * 100)}%`));
    const finished = new Promise(resolve => {
      hub.onFlow(({ action }) => {
        if (action === 1) resolve();
      });
      hub.onClose(error => resolve(error ?? new Error('Hub disconnected.')));
    });
    await hub.start(slot);
    console.error(`Running slot ${slot}. Press Ctrl+C to disconnect.`);
    const error = await finished;
    if (error) throw error;
  } finally {
    await hub.close();
  }
}

try {
  const { values, positionals } = parseArgs({
    options: { slot: { type: 'string' }, port: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
    allowPositionals: true,
  });
  if (values.help) {
    console.log(usage);
  } else {
    if (positionals.length !== 1 || !/^(?:[0-9]|1[0-9])$/.test(values.slot ?? '')) throw new Error(usage);
    const source = readFileSync(positionals[0], 'utf8');
    if (!source.trim()) throw new Error('The Python file is empty.');
    await upload(values.port ?? findPort(), Number(values.slot), source);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
