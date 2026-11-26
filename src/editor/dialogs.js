import { setupFirmwareDialog } from './firmware-dialog.js';
import { connectFirmware } from '../firmware/install.js';

export function setupDialogs({ getLanguage, setLanguage, acquireDevice, releaseDevice }) {
  setupFirmwareDialog({ connectFirmware, acquireDevice, releaseDevice });
}
