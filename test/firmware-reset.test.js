import test from 'node:test';
import assert from 'node:assert/strict';
import { ClassicReset } from 'esptool-js';
import { createClassicReset, resetEsp32 } from '../src/firmware/esp32.js';

test('FTDI reset initializes both lines and releases GPIO0 after EN before final DTR write', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const calls=[];
  const transport={getVid:()=>0x0403,setSignals:async(...v)=>calls.push(['signals',...v]),setDTR:async v=>calls.push(['dtr',v])};
  const done=createClassicReset(transport,50).reset();
  // Let each awaited signal operation settle before advancing its timed phase.
  for(let i=0;i<5;i++) await Promise.resolve();
  assert.deepEqual(calls,[['signals',false,false],['signals',true,true],['signals',false,true]]);
  t.mock.timers.tick(100);
  for(let i=0;i<5;i++) await Promise.resolve();
  assert.deepEqual(calls.at(-1),['signals',true,false]);
  t.mock.timers.tick(50);
  for(let i=0;i<5;i++) await Promise.resolve();
  t.mock.timers.tick(100);await done;
  assert.deepEqual(calls.slice(-2),[['signals',false,false],['dtr',false]]);
});

test('non-FTDI adapters retain the loader classic strategy', () => {
  const transport={getVid:()=>0x10c4};
  assert.ok(createClassicReset(transport,550) instanceof ClassicReset);
});

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

test('FTDI failed sync waits before another attempt, preserving the original error', async t => {
  const { ESPLoader } = await import('esptool-js');
  const { FirmwareESPLoader } = await import('../src/firmware/esp32.js');
  t.mock.timers.enable({apis:['setTimeout']});
  const error=new Error('partial boot text');
  t.mock.method(ESPLoader.prototype,'sync',async()=>{throw error;});
  const loader=Object.create(FirmwareESPLoader.prototype);
  loader.transport={getVid:()=>0x0403};
  let settled=false;
  const done=assert.rejects(loader.sync().finally(()=>{settled=true;}),e=>e===error);
  for(let i=0;i<5;i++) await Promise.resolve();
  t.mock.timers.tick(49);await Promise.resolve();assert.equal(settled,false);
  t.mock.timers.tick(1);await done;
});
