import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setupFirmwareDialog } from '../src/editor/firmware-dialog.js';
import { firmwareFamilies, matchFirmware } from '../src/firmware/catalog.js';
import { applyLanguage } from '../src/i18n/index.js';
const { JSDOM } = createRequire(import.meta.url)('jsdom');
const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const images = JSON.parse(readFileSync(new URL('../src/firmware/images.json',import.meta.url)));
const flush = () => new Promise(resolve => setImmediate(resolve));
const serial = (chip='ESP32',flashSize='8MB') => ({transport:'serial',chip,flashSize});

function setup(t,{device=serial(),failDetect,failInstall,gate,language='en'}={}) {
  applyLanguage(language);
  const dom = new JSDOM(html);
  t.after(()=>dom.window.close());
  const document = dom.window.document;
  const $ = id => document.getElementById(id);
  $('firmware-dialog').showModal = () => { $('firmware-dialog').open = true; };
  $('firmware-dialog').close = () => { $('firmware-dialog').open = false; };
  const calls = {connect:[],install:[],close:0,acquire:0,release:0};
  setupFirmwareDialog({document,navigator:{serial:{},usb:{}},
    acquireDevice:async()=>{calls.acquire++;},releaseDevice:()=>{calls.release++;},
    connectFirmware:async family=>{
      calls.connect.push(family);
      if(gate) await gate;
      if(failDetect) throw failDetect;
      return {device,match:selection=>matchFirmware(selection,device,images),close:async()=>{calls.close++;},
        install:async(selection,progress)=>{calls.install.push(selection);progress(undefined);progress(.5);if(failInstall) throw failInstall;progress(1);}};
    },
  });
  $('open-firmware').click();
  const change = id => $(id).dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  return { $,calls,dom,change,
    family(id){document.querySelector(`input[name="firmware-family"][value="${id}"]`).checked=true;change('firmware-family');},
    model(id){$('firmware-model').value=id;change('firmware-model');},
    async connect(){ $('firmware-connect').click();await flush(); },
  };
}

test('family/model catalog blocks unsupported recipes and does not trust capacity overrides over detection',()=>{
  const choose = (family,model,device,capacity)=>matchFirmware({family,model,capacity},device,images);
  assert.equal(firmwareFamilies.length,4);
  for(const chip of ['ESP32-S2','ESP32-C3','ESP32-C6']) {
    const result=choose('esp32','auto',serial(chip));
    assert.equal(result.supported,false);
    assert.equal(result.reason.key,'firmwareChipUnavailable');
  }
  const mismatch=choose('esp32','classic',serial('ESP32-S3'));
  assert.equal(mismatch.reason.key,'firmwareChipMismatch');
  assert.deepEqual(mismatch.suggestion,{family:'esp32',model:'auto'});
  assert.equal(choose('esp32','auto',serial('ESP32','4MB'),'8MB').supported,false);
  assert.equal(choose('esp32','auto',serial('ESP32',null)).reason.key,'firmwareCapacityRequired');
  assert.equal(choose('esp32','auto',serial('ESP32',null),'8MB').supported,true);
  assert.equal(choose('m5stack','basic',serial('ESP32',null),'16MB').target.image,images.m5basic16);
  assert.equal(choose('m5stack','stickc',serial('ESP32','16MB')).supported,false);
  assert.equal(choose('m5stack','cores3',serial('ESP32-S3')).supported,false);
  assert.equal(choose('raspberry','pico',serial()).supported,false);
  assert.equal(choose('microbit','V1',{transport:'microbit',version:'V2'}).reason.key,'firmwareVersionMismatch');
  assert.equal(choose('microbit','auto',{transport:'microbit',version:'V2'}).target.image,images.V2);
  assert.equal(choose('microbit','auto',{transport:'microbit',version:'unknown'}).supported,false);
  assert.equal(choose('raspberry','pico',{transport:'rp2040'}).target.image,images.pico);
  assert.equal(choose('raspberry','picow',{transport:'rp2040'}).supported,false);
});

test('detection never installs; matching device requires a second explicit click, then releases its session',async t=>{
  const p=setup(t);
  assert.equal(p.$('firmware-model').value,'auto');
  assert.equal(p.$('firmware-review').hidden,true);
  await p.connect();
  assert.deepEqual(p.calls.connect,['esp32']);
  assert.equal(p.calls.install.length,0);
  assert.equal(p.$('firmware-review').hidden,false);
  assert.match(p.$('firmware-chip').textContent,/ESP32/);
  assert.match(p.$('firmware-capacity').textContent,/8MB.*automatically/);
  assert.equal(p.$('firmware-install').hidden,false);
  assert.equal(p.$('firmware-manual-capacity').hidden,true);
  p.$('firmware-install').click();await flush();
  assert.equal(p.calls.install.length,1);
  assert.equal(p.calls.close,1);assert.equal(p.calls.release,1);
  assert.match(p.$('firmware-status').textContent,/installed/);
  assert.equal(p.$('firmware-progress').value,1);
  assert.equal(p.$('firmware-install').hidden,true);
  p.$('firmware-reselect').click();await flush();
  assert.equal(p.$('firmware-review').hidden,true);
  assert.equal(p.$('firmware-select-step').hidden,false);
  assert.equal(p.$('firmware-connect').disabled,false);
});

test('detected S3 mismatch offers auto matching before explicit installation',async t=>{
  for(const language of ['en','zh-CN']) {
    const p=setup(t,{device:serial('ESP32-S3'),language});
    p.model('classic');await p.connect();
    assert.equal(p.$('firmware-chip').textContent,'ESP32-S3');
    assert.equal(p.$('firmware-install').hidden,true);
    assert.equal(p.$('firmware-suggestion').hidden,false);
    assert.doesNotMatch(p.$('firmware-status').textContent,/failed|失败/);
    p.$('firmware-install').click();await flush();
    assert.equal(p.calls.install.length,0);
    p.$('firmware-suggestion').click();
    assert.equal(p.$('firmware-model').value,'auto');
    assert.match(p.$('firmware-image').textContent,/ESP32_GENERIC_S3-/);
    assert.equal(p.$('firmware-install').hidden,false);
    p.$('firmware-close').click();await flush();
    assert.equal(p.calls.release,1);
  }
});

test('M5 chip mismatch suggests the generic family without claiming its product identity',async t=>{
  const p=setup(t,{device:serial('ESP32-S3')});
  p.family('m5stack');
  assert.equal(p.$('firmware-model').value,'basic');
  assert.equal(p.$('firmware-model').querySelector('option[value="cores3"]').disabled,true);
  await p.connect();
  assert.match(p.$('firmware-match').textContent,/requires ESP32/);
  p.$('firmware-suggestion').click();
  assert.equal(p.dom.window.document.querySelector('input[name="firmware-family"]:checked').value,'esp32');
  assert.equal(p.$('firmware-model').value,'auto');
  assert.equal(p.calls.connect.length,1);
  assert.equal(p.$('firmware-install').hidden,false);
});

test('manual capacity is exposed only when unknown and cannot install before confirmation',async t=>{
  const p=setup(t,{device:serial('ESP32',null)});
  p.family('m5stack');await p.connect();
  assert.equal(p.$('firmware-manual-capacity').hidden,false);
  assert.equal(p.$('firmware-install').hidden,true);
  p.$('firmware-capacity-choice').value='16MB';p.change('firmware-capacity-choice');
  assert.equal(p.$('firmware-install').hidden,false);
  p.$('firmware-install').click();await flush();
  assert.equal(p.calls.install[0].capacity,'16MB');
});

test('USB version mismatch can switch to auto and Pico capacity is explicitly not measured',async t=>{
  const p=setup(t,{device:{transport:'microbit',chip:'nRF52833',version:'V2',flashSize:null}});
  p.family('microbit');p.model('V1');await p.connect();
  assert.equal(p.$('firmware-install').hidden,true);
  p.$('firmware-suggestion').click();
  assert.equal(p.$('firmware-install').hidden,false);
  assert.match(p.$('firmware-resolved-model').textContent,/V2/);
  const q=setup(t,{device:{transport:'rp2040',chip:'RP2040',flashSize:null}});
  q.family('raspberry');await q.connect();
  assert.match(q.$('firmware-capacity').textContent,/not measured/);
  assert.match(q.$('firmware-model-hint').textContent,/BOOTSEL/);
});

test('selection cancellation, detection errors and install errors are distinct and release leases',async t=>{
  const canceled=setup(t,{failDetect:new DOMException('Canceled','NotFoundError')});await canceled.connect();
  assert.match(canceled.$('firmware-status').textContent,/canceled/);
  assert.equal(canceled.calls.release,1);
  const failed=setup(t,{failDetect:new Error('Serial handshake failed')});await failed.connect();
  assert.match(failed.$('firmware-status').textContent,/Could not detect/);
  assert.doesNotMatch(failed.$('firmware-status').textContent,/Installation failed/);
  assert.equal(failed.calls.release,1);
  const writing=setup(t,{failInstall:new Error('Readback mismatch')});await writing.connect();
  writing.$('firmware-install').click();await flush();
  assert.match(writing.$('firmware-status').textContent,/Installation failed.*Readback/);
  assert.equal(writing.calls.close,1);assert.equal(writing.calls.release,1);
  assert.equal(writing.$('firmware-close').disabled,false);
  assert.equal(writing.$('firmware-install').hidden,true);
});

test('busy detection prevents cancellation, and returning closes the connection before another choice',async t=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const p=setup(t,{gate});
  p.$('firmware-connect').click();await flush();
  assert.equal(p.$('firmware-family').disabled,true);
  assert.equal(p.$('firmware-close').disabled,true);
  p.$('firmware-dialog').dispatchEvent(new p.dom.window.Event('cancel',{cancelable:true}));
  assert.equal(p.$('firmware-dialog').open,true);
  release();await flush();
  p.$('firmware-reselect').click();await flush();
  assert.equal(p.calls.close,1);assert.equal(p.calls.release,1);
  p.family('m5stack');p.model('stickc');
  assert.equal(p.$('firmware-model').value,'stickc');
  p.$('firmware-close').click();await flush();
  p.$('open-firmware').click();
  assert.equal(p.$('firmware-model').value,'stickc');
  assert.equal(p.$('firmware-install').hidden,true);
});

test('S3 standard and Octal images use address zero with capacity and chip guards', () => {
  for (const capacity of ['4MB','8MB','16MB','32MB']) {
    const standard = matchFirmware({family:'esp32',model:'auto'},serial('ESP32-S3',capacity),images);
    assert.equal(standard.target.address,0);
    assert.equal(standard.target.image,images.esp32s3);
    assert.equal(standard.target.flashSize,capacity);
    const octal = matchFirmware({family:'esp32',model:'s3oct'},serial('ESP32-S3',capacity),images);
    assert.equal(octal.target.address,0);
    assert.equal(octal.target.image,images.esp32s3oct);
  }
  assert.equal(matchFirmware({family:'esp32',model:'s3oct'},serial('ESP32','8MB'),images).supported,false);
  assert.equal(matchFirmware({family:'esp32',model:'auto'},serial('ESP32-S3','2MB'),images).supported,false);
  assert.equal(matchFirmware({family:'esp32',model:'ESP32-S3'},serial('ESP32-S3',null),images).reason.key,'firmwareCapacityRequired');
});
