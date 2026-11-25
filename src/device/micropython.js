export class MicroPythonError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const encoder = new TextEncoder();

async function writeSerialText(writer, text) {
  const bytes = encoder.encode(text);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    if (offset) await new Promise(resolve => setTimeout(resolve, 10));
    await writer.write(bytes.subarray(offset, offset + 64));
  }
}

function streamOutput(port, reader, decoder, onOutput, pending = '') {
  let closing = false;
  let writes = Promise.resolve();
  const done = (async () => {
    try {
      if (pending) onOutput(pending);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (text) onOutput(text);
      }
      const tail = decoder.decode();
      if (tail) onOutput(tail);
    } finally {
      closing = true;
      reader.releaseLock();
      await writes.catch(() => {});
      await port.close();
    }
  })();

  return {
    port,
    done,
    write(text) {
      if (closing) return Promise.reject(new Error('Serial session is closed'));
      const operation = writes.catch(() => {}).then(async () => {
        const writer = port.writable.getWriter();
        try { await writeSerialText(writer, text); } finally { writer.releaseLock(); }
      });
      writes = operation;
      return operation;
    },
    async close() {
      closing = true;
      await reader.cancel().catch(() => {});
      await done.catch(() => {});
    },
  };
}

export async function monitorPort(port, onOutput) {
  await port.open({ baudRate: 115200 });
  try {
    return streamOutput(port, port.readable.getReader(), new TextDecoder(), onOutput);
  } catch (error) {
    await port.close().catch(() => {});
    throw error;
  }
}

async function runOnBoard(port, onOutput, operation) {
  await port.open({ baudRate: 115200 });
  const decoder = new TextDecoder();
  let reader;
  let writer;
  try {
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
    let pending = '';

    const write = text => writeSerialText(writer, text);

    async function readUntil(marker) {
      const timeout = setTimeout(() => void reader.cancel().catch(() => {}), 4000);
      try {
        while (!pending.includes(marker)) {
          const { value, done } = await reader.read();
          if (done) throw new MicroPythonError('serialTimeout', 'Board response timed out or the serial port disconnected');
          pending += decoder.decode(value, { stream: true });
        }
        const end = pending.indexOf(marker);
        const result = pending.slice(0, end);
        pending = pending.slice(end + marker.length);
        return result;
      } finally {
        clearTimeout(timeout);
      }
    }

    async function execute(command) {
      await write(command + '\x04');
      const prefix = await readUntil('OK');
      if (prefix) throw new MicroPythonError('unexpectedResponse', 'Unexpected response from MicroPython');
      const output = await readUntil('\x04');
      const error = await readUntil('\x04>');
      if (error.trim()) throw new BoardCommandError(error.trim());
      return output;
    }

    await write('\r\x03\x03\x02');
    await readUntil('>>>');
    await write('\x01');
    await readUntil('raw REPL; CTRL-B to exit\r\n>');
    const result = await operation(execute);
    await write('\x02');
    await readUntil('>>>');
    await write('\x04');
    await readUntil('MPY: soft reboot');
    writer.releaseLock();
    const session = streamOutput(port, reader, decoder, onOutput, 'MPY: soft reboot' + pending);
    return { session, result };
  } catch (error) {
    writer?.releaseLock();
    reader?.releaseLock();
    await port.close().catch(() => {});
    throw error;
  }
}

class BoardCommandError extends Error {}

function pythonBytes(bytes) {
  return `b'${Array.from(bytes, byte => `\\x${byte.toString(16).padStart(2, '0')}`).join('')}'`;
}

function boardPath(path) {
  return `${pythonBytes(encoder.encode(path))}.decode()`;
}

function decodeHex(text) {
  return new TextDecoder().decode(Uint8Array.from(text.match(/../g) ?? [], byte => parseInt(byte, 16)));
}

async function boardFilesystem(execute) {
  const capabilities = await execute(`import os, sys
print(int(hasattr(os, 'mkdir')), int(hasattr(os, 'rename')))`);
  const [directories, rename] = capabilities.trim().split(' ').map(Number);
  return {
    directories: Boolean(directories),
    rename: Boolean(rename),
    path: path => directories ? path : path.replace(/^\//, ''),
    list: directory => directories ? `os.listdir(${boardPath(directory)})` : 'os.listdir()',
  };
}

async function writeBoardFile(execute, filesystem, path, bytes, { replace = false } = {}) {
  path = filesystem.path(path);
  const separator = path.lastIndexOf('/') + 1;
  const prefix = path.slice(0, separator);
  const directory = prefix || '.';
  const name = path.slice(separator);
  const temporary = `${prefix}.blockly-${crypto.randomUUID()}.tmp`;
  if (!replace) {
    await execute(`assert ${boardPath(name)} not in ${filesystem.list(directory)}, 'File already exists'`);
  }
  let stage = 'open temporary file';
  let opened = false;
  try {
    await execute(`f = open(${boardPath(temporary)}, 'wb')`);
    opened = true;
    stage = 'write temporary file';
    // Keep each raw-REPL command small, including escaped binary data.
    for (let offset = 0; offset < bytes.length; offset += 48) {
      const chunk = bytes.subarray(offset, offset + 48);
      await execute(`assert f.write(${pythonBytes(chunk)}) == ${chunk.length}`);
    }
    await execute('f.close()');
    stage = 'replace destination file';
    if (filesystem.rename) {
      await execute(`os.rename(${boardPath(temporary)}, ${boardPath(path)})`);
    } else {
      // Flat filesystems can lack rename. Stage the complete upload before copying.
      await execute(`with open(${boardPath(temporary)}, 'rb') as src:
    with open(${boardPath(path)}, 'wb') as dst:
        while True:
            chunk = src.read(64)
            if not chunk:
                break
            assert dst.write(chunk) == len(chunk)
os.remove(${boardPath(temporary)})`);
    }
  } catch (error) {
    if (error instanceof BoardCommandError) {
      if (opened) {
        await execute(`f.close()\nos.remove(${boardPath(temporary)})`).catch(() => {});
      }
      throw new BoardCommandError(`${path} (${stage}): ${error.message}`);
    }
    throw error;
  }
}

export async function downloadProgram(port, source, onOutput, libraries = []) {
  const { session } = await runOnBoard(port, onOutput, async execute => {
    const filesystem = await boardFilesystem(execute);
    if (libraries.length) {
      let directory = '';
      if (filesystem.directories) {
        const output = await execute(`paths = [p for p in sys.path if p.endswith('/lib') and not p.startswith('/rom')]
assert paths, 'No writable library directory in sys.path'
library_dir = paths[0]
try:
    os.stat(library_dir)
except OSError:
    os.mkdir(library_dir)
print(''.join('%02x' % b for b in library_dir.encode()))`);
        directory = decodeHex(output.trim()) + '/';
      }
      for (const { name, source } of libraries) {
        await writeBoardFile(execute, filesystem, `${directory}${name}`, encoder.encode(source), { replace: true });
      }
    }
    await writeBoardFile(execute, filesystem, 'main.py', encoder.encode(source), { replace: true });
  });
  return session;
}

export function manageDeviceFiles(port, directory, action, onOutput) {
  return runOnBoard(port, onOutput, async execute => {
    try {
      const filesystem = await boardFilesystem(execute);
      if (!filesystem.directories && directory !== '/') {
        throw new BoardCommandError('This filesystem has no directories');
      }
      if (action?.type === 'upload') {
        if (!action.name || /[/\\\x00-\x1f]/.test(action.name) || ['.', '..'].includes(action.name)) {
          throw new BoardCommandError('Invalid file name');
        }
        const path = `${directory.replace(/\/$/, '')}/${action.name}`;
        await writeBoardFile(execute, filesystem, path, action.bytes);
      } else if (action?.type === 'delete') {
        await execute(`os.remove(${boardPath(filesystem.path(action.path))})`);
      }
      const entries = filesystem.directories ? `os.ilistdir(${boardPath(directory)})` : 'os.ilistdir()';
      const output = await execute(`for entry in ${entries}:
    print('%x' % entry[1] + ':' + ''.join('%02x' % b for b in entry[0].encode()))`);
      return { entries: output.trim().split(/\r?\n/).filter(Boolean).map(line => {
        const [mode, name] = line.split(':');
        return { name: decodeHex(name), directory: (parseInt(mode, 16) & 0xf000) === 0x4000 };
      }) };
    } catch (error) {
      if (!(error instanceof BoardCommandError)) throw error;
      return { error };
    }
  });
}
