// An acknowledgment is not proof that a program is still running.
// Only merge messages that describe the current connection and selected slot.
export function inlineDeviceResult(device, message) {
  const [key, detail] = message ?? [];
  if (device.spike && !device.spike.closed && String(device.slot) === detail) {
    if (key === 'spikeRunning') return 'deploymentStarted';
    if (key === 'spikeStopped') return 'deploymentStopRequested';
  }
  if (device.serial && device.protocol === 'micropython' && key === 'flashComplete') {
    return 'deploymentRestarted';
  }
  return undefined;
}
