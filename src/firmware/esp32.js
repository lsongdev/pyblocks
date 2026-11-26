export async function resetEsp32(transport) {
  // esptool-js 0.7.1 HardReset only deasserts RTS; after writing that can
  // leave the flasher stub running. Explicitly pulse EN with GPIO0 released.
  await transport.setDTR(false);
  await transport.setRTS(true);
  await new Promise(resolve => setTimeout(resolve, 100));
  await transport.setRTS(false);
}
