// STM32 ROM USB DfuSe, ST AN3156. Only internal flash, no option bytes,
// read unprotect, mass erase or guessed chip identity.
const BASE = 0x08000000;
const LIMIT = BASE + 16 * 1024 * 1024;
const invalid = () => new Error('Invalid or unsupported STM32 DfuSe image.');
const ascii = (bytes, start, count) => String.fromCharCode(...bytes.subarray(start, start + count));

export function dfuCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return crc >>> 0;
}

export function decodeStm32Dfu(buffer) {
  const bytes = new Uint8Array(buffer);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 16;
  if (bytes.length < 11 + 274 + 8 + 16 || bytes.length > 17 * 1024 * 1024 ||
      ascii(bytes,0,5) !== 'DfuSe' || bytes[5] !== 1 || bytes[10] !== 1 ||
      v.getUint32(6,true) !== end || ascii(bytes,11,6) !== 'Target' ||
      bytes[17] !== 0 || ascii(bytes,end+8,3) !== 'UFD' || bytes[end+11] !== 16 ||
      v.getUint16(end+4,true) !== 0x0483 || v.getUint16(end+2,true) !== 0xdf11 ||
      v.getUint16(end+6,true) !== 0x011a ||
      dfuCrc(bytes.subarray(0,bytes.length-4)) !== v.getUint32(bytes.length-4,true)) throw invalid();
  const size = v.getUint32(277,true), count = v.getUint32(281,true);
  if (size !== end-285 || !count || count > 256) throw invalid();
  let offset=285;
  const elements=[];
  for(let i=0;i<count;i++) {
    if(offset+8>end) throw invalid();
    const address=v.getUint32(offset,true), length=v.getUint32(offset+4,true);
    offset+=8;
    if(!length || offset+length>end || address<BASE || address+length>LIMIT) throw invalid();
    elements.push({address,data:bytes.slice(offset,offset+length)});
    offset+=length;
  }
  elements.sort((a,b)=>a.address-b.address);
  if(offset!==end || elements[0].address!==BASE || elements[0].data.length<8 ||
     elements.some((e,i)=>i && elements[i-1].address+elements[i-1].data.length>e.address)) throw invalid();
  return elements;
}

// DfuSe interface string describes sector size and access flags (g = R/E/W).
export function parseStm32Flash(name) {
  const parts=name?.split('/') ?? [];
  if(parts.length!==3 || !/^@Internal Flash\s*$/i.test(parts[0]) || !/^0x08000000$/i.test(parts[1].trim())) throw new Error('Unsupported internal flash descriptor.');
  let address=BASE;
  const sectors=[];
  for(const group of parts[2].split(',')) {
    const m=group.trim().match(/^(\d+)\*(\d+)\s*([BKM])([a-g])$/i);
    if(!m) throw new Error('Invalid DFU flash geometry.');
    const count=Number(m[1]), size=Number(m[2])*({B:1,K:1024,M:1048576}[m[3].toUpperCase()]);
    if(!count || !size || address+count*size>LIMIT || sectors.length+count>16384) throw new Error('Invalid DFU flash geometry.');
    for(let i=0;i<count;i++,address+=size) sectors.push({address,size,writable:m[4].toLowerCase()==='g'});
  }
  if(!sectors.length) throw new Error('No internal flash sectors.');
  return {sectors,capacity:address-BASE};
}

export function planStm32Dfu(elements, flash) {
  if (!Array.isArray(elements) || !elements.length || elements[0].address !== BASE) throw invalid();
  const pages=new Map();
  let previousEnd=BASE;
  for(const {address,data} of elements) {
    if (!Number.isInteger(address) || address<previousEnd || !(data instanceof Uint8Array) || !data.length || address+data.length>LIMIT) throw invalid();
    previousEnd=address+data.length;
    let cursor=address;
    const end=address+data.length;
    for(const sector of flash.sectors) {
      if(sector.address+sector.size<=cursor) continue;
      if(cursor>=end) break;
      if(sector.address>cursor || !sector.writable) throw new Error('Image touches inaccessible flash.');
      pages.set(sector.address,sector);
      cursor=Math.min(end,sector.address+sector.size);
    }
    if(cursor!==end) throw new Error('Image exceeds internal flash.');
  }
  return [...pages.values()].sort((a,b)=>a.address-b.address);
}

export function dfuTransferSize(bytes, iface, alt) {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let current=false, matchingAlt=false;
  for(let p=0;p<bytes.length;) {
    const len=bytes[p],type=bytes[p+1];
    if(len<2 || p+len>bytes.length) break;
    if(type===4 && len>=9) {
      current=bytes[p+2]===iface;
      if(current && bytes[p+3]===alt) matchingAlt=true;
    }
    // STM32 ROM may place the shared functional descriptor after its last alternate.
    if(current && matchingAlt && type===0x21 && len>=9) {
      const size=v.getUint16(p+5,true);
      // Require download + upload capability so every written byte can be verified.
      if((bytes[p+2]&3)===3 && v.getUint16(p+7,true)===0x011a && size>=8 && size<=4096 && size%8===0) return size;
      break;
    }
    p+=len;
  }
  throw new Error('Unsupported DFU functional descriptor.');
}

export async function connectStm32Dfu(usb=globalThis.navigator.usb) {
  const device=await usb.requestDevice({filters:[{vendorId:0x0483,productId:0xdf11}]});
  let iface, claimed=false;
  const close=async()=>{
    if(!device.opened) return;
    if(claimed) await device.releaseInterface(iface).catch(()=>{});
    await device.close();
  };
  async function transfer(operation, length, output=false) {
    let timer;
    try {
      const result=await Promise.race([operation,new Promise((_,reject)=>{
        timer=setTimeout(()=>{void device.close().catch(()=>{});reject(new Error('DFU USB transfer timed out. Reconnect the board in DFU mode.'));},15000);
      })]);
      if(result.status!=='ok' || (output?result.bytesWritten:result.data?.byteLength)!==length) throw new Error('Incomplete DFU USB transfer.');
      if(!output) return new Uint8Array(result.data.buffer,result.data.byteOffset,length);
    } finally {clearTimeout(timer);}
  }
  const request=(request,value=0)=>({requestType:'class',recipient:'interface',request,value,index:iface});
  const out=(req,value,data=new Uint8Array())=>transfer(device.controlTransferOut(request(req,value),data),data.length,true);
  const input=(req,value,length)=>transfer(device.controlTransferIn(request(req,value),length),length);
  async function idle() {
    const [state]=await input(5,0,1);
    if(state===10) await out(4,0); // CLRSTATUS, never read-unprotect.
    else if(state===5 || state===9) await out(6,0);
    else if(state!==2) throw new Error('DFU not idle; reset into bootloader.');
    if((await input(5,0,1))[0]!==2) throw new Error('Could not enter DFU idle.');
  }
  async function download(block,data) {
    await out(1,block,data);
    const deadline=Date.now()+60000;
    for(;;) {
      const s=await input(3,0,6);
      if(s[0]!==0) throw new Error('DFU status error '+s[0]);
      if(s[4]===5) return;
      const delay=s[1]+s[2]*256+s[3]*65536;
      if(![3,4].includes(s[4]) || Date.now()+delay>deadline) throw new Error('DFU command did not complete.');
      await new Promise(resolve=>setTimeout(resolve,Math.max(1,delay)));
    }
  }
  async function command(code,address) {
    const data=new Uint8Array(5);
    data[0]=code;
    new DataView(data.buffer).setUint32(1,address,true);
    await download(0,data);
  }
  try {
    await device.open();
    if(!device.configuration) await device.selectConfiguration(1);
    const matches=[];
    for(const item of device.configuration.interfaces) for(const alt of item.alternates) {
      if(alt.interfaceClass===0xfe && alt.interfaceSubclass===1 && alt.interfaceProtocol===2 &&
         alt.alternateSetting===0 && /^@Internal Flash\s*\//i.test(alt.interfaceName??'')) matches.push({item,alt});
    }
    if(matches.length!==1) throw new Error('STM32 internal-flash DFU interface not found.');
    const {item,alt}=matches[0];
    iface=item.interfaceNumber;
    const flash=parseStm32Flash(alt.interfaceName);
    const cfg=device.configurations.findIndex(c=>c.configurationValue===device.configuration.configurationValue);
    if(cfg<0) throw new Error('DFU configuration not found.');
    const descriptor={requestType:'standard',recipient:'device',request:6,value:0x0200|cfg,index:0};
    const head=await transfer(device.controlTransferIn(descriptor,9),9);
    const length=head[2]+head[3]*256;
    if(length<9 || length>4096) throw new Error('Invalid DFU configuration length.');
    const size=dfuTransferSize(await transfer(device.controlTransferIn(descriptor,length),length),iface,alt.alternateSetting);
    await device.claimInterface(iface);claimed=true;
    await device.selectAlternateInterface(iface,alt.alternateSetting);
    await idle();
    return {flash,close,async install(elements,report,progress) {
      const sectors=planStm32Dfu(elements,flash);
      const total=elements.reduce((sum,e)=>sum+e.data.length,0);
      await idle();
      report('firmwareWriting');
      for(const sector of sectors) await command(0x41,sector.address);
      let written=0;
      for(const {address,data} of elements) for(let offset=0;offset<data.length;offset+=size) {
        const chunk=data.subarray(offset,offset+size);
        await command(0x21,address+offset);
        await download(2,chunk);
        written+=chunk.length;progress(.8*written/total);
      }
      report('firmwareVerifying');
      let verified=0;
      for(const {address,data} of elements) for(let offset=0;offset<data.length;offset+=size) {
        const chunk=data.subarray(offset,offset+size);
        await command(0x21,address+offset);
        await idle(); // abort download-idle without changing the address pointer
        const actual=await input(2,2,chunk.length);
        if(actual.some((byte,i)=>byte!==chunk[i])) throw new Error('STM32 flash readback mismatch.');
        await idle();
        verified+=chunk.length;progress(.8+.2*verified/total);
      }
      // Leave the ROM bootloader active. User must release BOOT0 and reset.
    }};
  } catch(error) {await close().catch(()=>{});throw error;}
}
