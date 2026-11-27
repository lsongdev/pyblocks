// Product identity is a user choice; chip/flash detection alone cannot identify a board product.
export const firmwareFamilies = [
  { id: 'esp32', label: 'ESP32', transport: 'serial', models: [
    { id: 'auto', key: 'firmwareAutoChip' },
    { id: 'classic', key: 'firmwareClassic', chip: 'ESP32', capacities: ['8MB'] },
    { id: 'xiaomiao', key: 'firmwareXiaomiaoModel', chip: 'ESP32', capacities: ['4MB'] },
    { id: 'ESP32-S3', key: 'firmwareS3Standard', chip: 'ESP32-S3', capacities: ['4MB', '8MB', '16MB', '32MB'] },
    { id: 's3oct', key: 'firmwareS3Octal', chip: 'ESP32-S3', capacities: ['4MB', '8MB', '16MB', '32MB'] },
    ...['ESP32-S2', 'ESP32-C3'].map(chip => ({ id: chip, label: chip, chip, unavailable: true })),
  ] },
  { id: 'm5stack', label: 'M5Stack', transport: 'serial', models: [
    { id: 'basic', label: 'Core / Basic', chip: 'ESP32', capacities: ['4MB', '16MB'] },
    { id: 'stickc', key: 'firmwareOriginalStick', chip: 'ESP32', capacities: ['4MB'] },
    { id: 'core2', label: 'Core2', unavailable: true },
    { id: 'cores3', label: 'CoreS3', unavailable: true },
    { id: 'stickplus', label: 'M5StickC Plus / Plus2', unavailable: true },
  ] },
  { id: 'microbit', label: 'Micro:bit', transport: 'microbit', models: [
    { id: 'auto', key: 'firmwareAutoVersion' },
    { id: 'V1', label: 'Micro:bit V1' }, { id: 'V2', label: 'Micro:bit V2' },
  ] },
  { id: 'raspberry', label: 'Raspberry Pi', transport: 'rp2040', models: [
    { id: 'pico', key: 'firmwareOriginalPico' },
    { id: 'picow', label: 'Pico W', unavailable: true },
    { id: 'pico2', label: 'Pico 2 / Pico 2 W', unavailable: true },
  ] },
];
export const getFirmwareFamily = id => firmwareFamilies.find(f => f.id === id);
export function matchFirmware(selection, device, images) {
  const family = getFirmwareFamily(selection.family);
  let model = family?.models.find(m => m.id === selection.model);
  const no = (key, args = [], suggestion) => ({ supported: false, model, reason: { key, args }, suggestion });
  if (!model || device.transport !== family.transport) return no('firmwareNoTarget');
  if (model.unavailable) return no('firmwareTargetUnavailable');
  let imageKey, address = 0, label, flashSize = device.flashSize, uiflow = false;
  if (device.transport === 'serial') {
    if (family.id === 'esp32' && model.id === 'auto') {
      model = family.models.find(m => m.chip === device.chip);
      if (!model || model.unavailable) return no('firmwareChipUnavailable', [device.chip]);
    }
    if (device.chip !== model.chip) return no('firmwareChipMismatch', [device.chip, model.chip], { family: 'esp32', model: 'auto' });
    if (!flashSize) {
      if (!selection.capacity) return no('firmwareCapacityRequired');
      flashSize = selection.capacity;
    }
    if (!model.capacities.includes(flashSize)) return no('firmwareCapacityMismatch', [flashSize, model.capacities.join(' / ')]);
    if (family.id === 'esp32') {
      const s3 = model.chip === 'ESP32-S3';
      if (model.id === 'xiaomiao') {
        imageKey = 'xiaomiao';
        address = 0x1000;
        label = 'XiaoMiao';
      } else {
        imageKey = s3 ? (model.id === 's3oct' ? 'esp32s3oct' : 'esp32s3') : 'esp32';
        address = s3 ? 0 : 0x1000;
        label = model.chip;
      }
    }
    else {
      uiflow = true;
      imageKey = model.id === 'basic' ? (flashSize === '4MB' ? 'm5basic4' : 'm5basic16') : 'm5stickc';
      label = model.id === 'basic' ? 'M5Stack Core/Basic' : 'M5Stick-C';
    }
  } else if (device.transport === 'microbit') {
    if (!['V1', 'V2'].includes(device.version)) return no('firmwareVersionUnavailable', [device.version ?? '?']);
    if (model.id !== 'auto' && model.id !== device.version) return no('firmwareVersionMismatch', [device.version, model.id], {family: 'microbit', model: 'auto'});
    model = family.models.find(m => m.id === device.version);
    imageKey = device.version;
    label = `Micro:bit ${device.version}`;
  } else {
    imageKey = 'pico'; label = 'Raspberry Pi Pico';
  }
  const image = images[imageKey];
  if (!image) return no('firmwareTargetUnavailable');
  return { supported: true, model, target: { image, address, flashSize, label, uiflow },
    capabilities: uiflow ? 'firmwareCapabilitiesM5' : family.id === 'microbit' ? 'firmwareCapabilitiesMicrobit' : model.id === 'xiaomiao' ? 'firmwareCapabilitiesXiaomiao' : 'firmwareCapabilitiesGeneric' };
}
