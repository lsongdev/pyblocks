import test from 'node:test';
import assert from 'node:assert/strict';
import { dfuCrc, decodeStm32Dfu, parseStm32Flash, planStm32Dfu, dfuTransferSize, connectStm32Dfu } from '../src/device/stm32.js';
const BASE=0x08000000;
function image(elements) {
  const end=285+elements.reduce((n,e)=>n+8+e.data.length,0);
  const b=new Uint8Array(end+16),v=new DataView(b.buffer);
  const text=(at,s)=>b.set(new TextEncoder().encode(s),at);
  text(0,'DfuSe'); b[5]=1;v.setUint32(6,end,true);b[10]=1;
  text(11,'Target');v.setUint32(18,1,true);v.setUint32(277,end-285,true);v.setUint32(281,elements.length,true);
  let p=285;
  for(const e of elements){v.setUint32(p,e.address,true);v.setUint32(p+4,e.data.length,true);b.set(e.data,p+8);p+=8+e.data.length;}
  v.setUint16(end+2,0xdf11,true);v.setUint16(end+4,0x0483,true);v.setUint16(end+6,0x011a,true);
  text(end+8,'UFD');b[end+11]=16;v.setUint32(end+12,dfuCrc(b.subarray(0,end+12)),true);
  return b.buffer;
}
const geometry='@Internal Flash  /0x08000000/04*016Kg,01*064Kg,03*128Kg';
const flash=parseStm32Flash(geometry);
const data=Uint8Array.from({length:16},(_,i)=>i+1);
test('DfuSe CRC, discontiguous elements, and sector planning',()=>{
  assert.equal(dfuCrc(new TextEncoder().encode('123456789')),0x340bc6d9);
  const elements=decodeStm32Dfu(image([{address:BASE,data},{address:BASE+0x20000,data}]));
  assert.deepEqual(elements,[{address:BASE,data},{address:BASE+0x20000,data}]);
  assert.equal(flash.capacity,512*1024);
  assert.deepEqual(planStm32Dfu(elements,flash).map(s=>s.address),[BASE,BASE+0x20000]);
  const bad=image([{address:BASE,data}]);new Uint8Array(bad)[293]^=1;
  assert.throws(()=>decodeStm32Dfu(bad),/Invalid/);
  assert.throws(()=>decodeStm32Dfu(image([{address:BASE,data},{address:BASE+8,data}])),/Invalid/);
  assert.throws(()=>decodeStm32Dfu(image([{address:0x1fff0000,data}])),/Invalid/);
  assert.throws(()=>planStm32Dfu([{address:BASE,data},{address:BASE+flash.capacity,data}],flash),/exceeds/);
  assert.throws(()=>planStm32Dfu([{address:BASE,data}],parseStm32Flash('@Internal Flash /0x08000000/01*016Ka')),/inaccessible/);
  assert.throws(()=>parseStm32Flash('@Option Bytes /0x1fffc000/01*016Bg'),/Unsupported/);
  assert.throws(()=>planStm32Dfu([],flash),/Invalid/);
});
const descriptor=Uint8Array.from([9,2,36,0,1,1,0,0x80,50,9,4,0,0,0,0xfe,1,2,1,9,4,0,1,0,0xfe,1,2,2,9,0x21,0x0b,0,0,0,8,0x1a,1]);
test('DFU reads the shared functional descriptor after alternate interfaces',()=>{
  assert.equal(dfuTransferSize(descriptor,0,0),2048);
  assert.throws(()=>dfuTransferSize(descriptor,1,0),/Unsupported/);
  const noRead=descriptor.slice();noRead[29]=1;
  assert.throws(()=>dfuTransferSize(noRead,0,0),/Unsupported/);
});
function usbMock({corrupt=false}={}) {
  const alt={interfaceClass:0xfe,interfaceSubclass:1,interfaceProtocol:2,alternateSetting:0,interfaceName:geometry};
  const config={configurationValue:1,interfaces:[{interfaceNumber:0,alternates:[alt]}]};
  const memory=new Uint8Array(flash.capacity).fill(0xff),erases=[],writes=[],reads=[];
  let state=2,address=BASE,pending;
  const result=bytes=>({status:'ok',data:new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)});
  const device={opened:false,configuration:config,configurations:[config],
    async open(){this.opened=true;},async close(){this.opened=false;},
    async claimInterface(n){assert.equal(n,0);},async selectAlternateInterface(n,a){assert.equal(a,0);},async releaseInterface(){},
    async controlTransferOut(r,bytes){
      if(r.request===6 || r.request===4){state=2;}
      else if(r.request===1){
        assert.ok([2,5].includes(state));state=3;
        pending=()=>{
          if(r.value===0){
            const a=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(1,true);
            if(bytes[0]===0x21)address=a;
            else if(bytes[0]===0x41){erases.push(a);const sector=flash.sectors.find(s=>s.address===a);memory.fill(0xff,a-BASE,a-BASE+sector.size);}
            else assert.fail('unexpected DFU command');
          }else{assert.equal(r.value,2);memory.set(bytes,address-BASE);writes.push(address);}
        };
      }else assert.fail('unexpected request');
      return {status:'ok',bytesWritten:bytes.length};
    },
    async controlTransferIn(r,length){
      if(r.requestType==='standard')return result(descriptor.slice(0,length));
      if(r.request===5)return result(Uint8Array.of(state));
      if(r.request===3){
        if(state===3){pending();state=4;return result(Uint8Array.of(0,0,0,0,4,0));}
        state=5;return result(Uint8Array.of(0,0,0,0,5,0));
      }
      if(r.request===2){assert.equal(state,2);assert.equal(r.value,2);state=9;reads.push(address);const chunk=memory.slice(address-BASE,address-BASE+length);if(corrupt)chunk[0]^=1;return result(chunk);}
      assert.fail('unexpected request');
    },
  };
  return {device,erases,writes,reads,usb:{async requestDevice({filters}){assert.deepEqual(filters,[{vendorId:0x0483,productId:0xdf11}]);return device;}}};
}
test('STM32 DFU detection never writes; explicit install erases only touched sectors and verifies bytes',async()=>{
  const m=usbMock(),session=await connectStm32Dfu(m.usb);
  assert.deepEqual(m.erases,[]);assert.deepEqual(m.writes,[]);
  const stages=[],progress=[];
  const elements=decodeStm32Dfu(image([{address:BASE,data},{address:BASE+0x20000,data}]));
  await assert.rejects(session.install([{address:BASE,data},{address:BASE+flash.capacity,data}],()=>{},()=>{}),/exceeds/);
  assert.deepEqual(m.erases,[]);
  await session.install(elements,k=>stages.push(k),p=>progress.push(p));
  assert.deepEqual(m.erases,[BASE,BASE+0x20000]);
  assert.deepEqual(m.writes,m.erases);assert.deepEqual(m.reads,m.writes);
  assert.deepEqual(stages,['firmwareWriting','firmwareVerifying']);
  assert.equal(progress.at(-1),1);
  await session.close();assert.equal(m.device.opened,false);
});
test('readback mismatch is an installation failure',async()=>{
  const m=usbMock({corrupt:true}),session=await connectStm32Dfu(m.usb);
  await assert.rejects(session.install([{address:BASE,data}],()=>{},()=>{}),/readback mismatch/);
  await session.close();assert.equal(m.device.opened,false);
});
