import { Names } from 'blockly/core';
import { pythonGenerator } from 'blockly/python';

const identifier = /^[\p{XID_Start}_][\p{XID_Continue}_]*$/u;
const invalidCharacters = /[^\p{XID_Continue}_]+/gu;
const identifierStart = /^[\p{XID_Start}_]/u;
const keywords = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '),
);

export function isPythonIdentifier(name) {
  return identifier.test(name) && !keywords.has(name.normalize('NFKC'));
}

export function readablePythonName(name) {
  // Preserve valid spelling in every script. Normalize only collision keys,
  // since CPython normalizes identifiers while MicroPython keeps UTF-8 bytes.
  const original = String(name);
  if (identifier.test(original)) return original;
  let result = original.replace(invalidCharacters, '_');
  if (!/[\p{XID_Continue}_]/u.test(original)) result = 'variable';
  if (!identifierStart.test(result)) result = `var_${result}`;
  return result;
}

export class PythonNames extends Names {
  constructor(reservedWords) {
    super(reservedWords);
    this.reserved = new Set([...keywords, ...reservedWords.split(',')].map(name => name.normalize('NFKC')));
    this.allocated = new Set();
  }

  reset() {
    super.reset();
    this.allocated.clear();
  }

  // getName/populateVariables/populateProcedures retain Blockly's ID-based
  // reference handling; only allocation changes. No private safeName override.
  getDistinctName(name, _type) {
    const base = readablePythonName(name);
    let candidate = base;
    for (let suffix = 2; this.reserved.has(candidate.normalize('NFKC')) || this.allocated.has(candidate.normalize('NFKC')); suffix++) {
      candidate = `${base}_${suffix}`;
    }
    this.allocated.add(candidate.normalize('NFKC'));
    return candidate;
  }
}

function importedNames(workspace) {
  const names = [];
  for (const block of workspace.getAllBlocks(false)) {
    if (!block.isEnabled()) continue;
    if (block.type === 'python_import') {
      names.push(block.getFieldValue('ALIAS')?.trim() || block.getFieldValue('MODULE')?.trim().split('.')[0]);
    } else if (block.type === 'python_from_import') {
      names.push(block.getFieldValue('ALIAS')?.trim() || block.getFieldValue('NAME')?.trim());
    }
  }
  return names.filter(name => name && isPythonIdentifier(name));
}

const init = pythonGenerator.init;
pythonGenerator.init = function (workspace) {
  // Take a fresh snapshot: other block modules add internal reserved names.
  this.nameDB_ = new PythonNames([this.RESERVED_WORDS_, ...importedNames(workspace)].join(','));
  return init.call(this, workspace);
};
