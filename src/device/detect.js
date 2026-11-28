// USB IDs are routing hints, not a unique identity or proof of runtime.
export function portProtocol(port) {
  const { usbVendorId, usbProductId } = port.getInfo?.() ?? {};
  if (usbVendorId === 0x0694) return usbProductId === 0x0009 ? 'spike' : 'unsupported-lego';
  return 'repl-candidate';
}

export function requireReplCandidate(port) {
  if (portProtocol(port) !== 'repl-candidate') {
    const error = new Error('This LEGO device does not support MicroPython raw REPL deployment.');
    error.code = 'legoNotRepl';
    throw error;
  }
}
