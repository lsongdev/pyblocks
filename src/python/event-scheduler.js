import { pythonGenerator } from 'blockly/python';
import { PythonBlockError } from './errors.js';
import { t } from '../i18n/index.js';
import { conditionEventRuntime, asyncConditionRuntime } from './condition-events.js';

const states = new WeakMap();
function state(g) {
  if (!states.has(g.definitions_)) states.set(g.definitions_, { entries: [], calls: [] });
  return states.get(g.definitions_);
}
export function registerCondition(g, entry) {
  const s = state(g);
  s.entries.push(entry);
}
// Resolve only generated call markers, never rewrite user code or Python literals.
export function asyncioEntry(g, invocation) {
  const s = state(g);
  const marker = `\0pyblocks_async_entry_${s.calls.length}\0`;
  s.calls.push({ marker, invocation });
  return marker + '\n';
}
pythonGenerator.addReservedWords('_asyncio,_condition_time,_condition_sample,_watch_condition,_condition_main,_condition_specs,_condition_interval');
const finish = pythonGenerator.finish;
pythonGenerator.finish = function (code) {
  const s = states.get(this.definitions_);
  if (!s) return finish.call(this, code);
  const active = s.entries.length > 0;
  if (active) {
    if (s.calls.length > 1) throw new PythonBlockError(t('eventsEntryConflict'));
    this.definitions_.import_condition_time = 'import utime as _condition_time';
    this.definitions_.condition_edges = conditionEventRuntime;
    this.definitions_.condition_runner = asyncConditionRuntime;
    const entries = s.entries.join(',\n' + this.INDENT);
    this.definitions_.import_asyncio = 'import asyncio as _asyncio';
    this.definitions_.condition_specs = `_condition_interval = 10\n_condition_specs = [\n${this.INDENT}${entries}\n]`;
    if (!s.calls.length) code += '\n_asyncio.run(_condition_main())\n';
  }
  for (const { marker, invocation } of s.calls) {
    code = code.replace(marker, `_asyncio.run(${active ? `_condition_main(${invocation})` : invocation})`);
  }
  return finish.call(this, code);
};
