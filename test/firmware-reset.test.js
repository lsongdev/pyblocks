import test from 'node:test';
import assert from 'node:assert/strict';
import { resetEsp32 } from '../src/firmware/esp32.js';

test('reset on close pulses EN with GPIO0 released', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const calls=[];
  const transport={setDTR:async v=>calls.push(['dtr',v]),setRTS:async v=>calls.push(['rts',v])};
  const done=resetEsp32(transport);
  for(let i=0;i<4;i++) await Promise.resolve();
  assert.deepEqual(calls,[['dtr',false],['rts',true]]);
  t.mock.timers.tick(100);await done;
  assert.deepEqual(calls.at(-1),['rts',false]);
});
