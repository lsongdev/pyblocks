import { BoardCommandError, MicroPythonError } from './errors.js';

const encoder = new TextEncoder();

function pythonBytes(bytes) {
  return `b'${Array.from(bytes, byte => `\\x${byte.toString(16).padStart(2, '0')}`).join('')}'`;
}

export function boardPath(path) {
  return `${pythonBytes(encoder.encode(path))}.decode()`;
}

export function decodeHex(text) {
  return new TextDecoder().decode(Uint8Array.from(text.match(/../g) ?? [], byte => parseInt(byte, 16)));
}

export async function boardFilesystem(execute) {
  const capabilities = await execute(`import os, sys
print(int(hasattr(os, 'mkdir')), int(hasattr(os, 'rename')))`);
  if (!/^[01] [01]$/.test(capabilities.trim())) {
    throw new MicroPythonError('unexpectedResponse', 'Invalid filesystem capability response');
  }
  const [directories, rename] = capabilities.trim().split(' ').map(Number);
  return {
    directories: Boolean(directories),
    rename: Boolean(rename),
    path: path => directories ? path : path.replace(/^\//, ''),
    list: directory => directories ? `os.listdir(${boardPath(directory)})` : 'os.listdir()',
  };
}

export async function writeBoardFile(execute, filesystem, path, bytes, { replace = false } = {}) {
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

