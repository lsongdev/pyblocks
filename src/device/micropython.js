export { MicroPythonError } from './micropython/errors.js';
export { monitorPort } from './transport/serial.js';
import { BoardCommandError } from './micropython/errors.js';
import { runOnBoard } from './micropython/repl.js';
import { boardFilesystem, writeBoardFile, boardPath, decodeHex } from './micropython/filesystem.js';

const encoder = new TextEncoder();

// Execute setup code without replacing user files, then restart and return a monitor session.
export async function executeProgram(port, source, onOutput = () => {}) {
  const { session } = await runOnBoard(port, onOutput, execute => execute(source));
  return session;
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
