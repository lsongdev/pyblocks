import { t } from '../i18n/index.js';
import { requireReplCandidate } from '../device/detect.js';
import { manageDeviceFiles, MicroPythonError } from '../device/micropython.js';

export function createDeviceFilesPanel({ device, onChange, attachSerial, setSerialStatus, appendSerialOutput }) {
  const localDeviceFile = document.querySelector('#local-device-file');
  const refreshFiles = document.querySelector('#refresh-files');
  const addFile = document.querySelector('#add-file');
  const filesParent = document.querySelector('#files-parent');
  const filesPath = document.querySelector('#files-path');
  const fileList = document.querySelector('#device-file-list');
  const filesStatus = document.querySelector('#device-files-status');
  let deviceListing;
  let filesMessage;

  function renderDeviceFiles() {
    const listing = deviceListing?.port === device.serial?.port ? deviceListing : undefined;
    refreshFiles.disabled = device.busy || !navigator.serial || Boolean(device.spike);
    refreshFiles.textContent = t(device.serial ? 'filesRefresh' : 'filesConnect');
    addFile.disabled = device.busy || !listing;
    filesParent.hidden = !listing || listing.path === '/';
    filesParent.disabled = device.busy;
    filesPath.textContent = listing?.path ?? '';
    filesStatus.textContent = device.operation === 'files' ? t('filesBusy')
      : filesMessage ? t(...filesMessage)
      : device.spike ? t('spikeFilesUnsupported')
      : !navigator.serial ? t('filesUnsupported')
      : listing?.entries.length === 0 ? t('filesEmpty') : '';
    fileList.replaceChildren();

    for (const entry of listing?.entries ?? []) {
      const row = document.createElement('li');
      const path = `${listing.path.replace(/\/$/, '')}/${entry.name}`;
      const name = document.createElement(entry.directory ? 'button' : 'span');
      name.textContent = entry.directory ? `${entry.name}/` : entry.name;
      row.append(name);
      if (entry.directory) {
        name.type = 'button';
        name.disabled = device.busy;
        name.addEventListener('click', () => accessDeviceFiles(path));
      } else {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.disabled = device.busy;
        remove.textContent = t('filesDelete');
        remove.setAttribute('aria-label', t('filesDeleteConfirm', path));
        remove.addEventListener('click', () => {
          if (window.confirm(t('filesDeleteConfirm', path))) {
            void accessDeviceFiles(listing.path, { type: 'delete', path });
          }
        });
        row.append(remove);
      }
      fileList.append(row);
    }
  }

  async function accessDeviceFiles(path, action) {
    if (!navigator.serial || device.spike || !device.begin('files')) return;
    filesMessage = undefined;
    onChange();
    try {
      const port = device.serial?.port ?? await navigator.serial.requestPort();
      requireReplCandidate(port);
      const command = action?.type === 'upload'
        ? { type: 'upload', name: action.file.name, bytes: new Uint8Array(await action.file.arrayBuffer()) }
        : action;
      await device.detach();
      setSerialStatus('serialConnecting');
      const { session, result } = await manageDeviceFiles(port, path, command, appendSerialOutput);
      attachSerial(session);
      if (result.error) throw result.error;
      deviceListing = {
        port, path,
        entries: result.entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name)),
      };
    } catch (error) {
      if (!device.serial) {
        deviceListing = undefined;
        setSerialStatus('serialDisconnected');
      }
      if (error.name === 'NotFoundError') filesMessage = ['portCanceled'];
      else filesMessage = ['filesFailed', error instanceof MicroPythonError ? t(error.code) : error.message];
    } finally {
      device.end();
      onChange();
    }
  }

  refreshFiles.addEventListener('click', () => {
    const path = deviceListing?.port === device.serial?.port ? deviceListing?.path : undefined;
    void accessDeviceFiles(path ?? '/');
  });
  filesParent.addEventListener('click', () => {
    if (!deviceListing) return;
    const parent = deviceListing.path.slice(0, deviceListing.path.lastIndexOf('/')) || '/';
    void accessDeviceFiles(parent);
  });
  addFile.addEventListener('click', () => localDeviceFile.click());
  localDeviceFile.addEventListener('change', () => {
    const file = localDeviceFile.files[0];
    localDeviceFile.value = '';
    if (file && deviceListing && deviceListing.port === device.serial?.port) {
      void accessDeviceFiles(deviceListing.path, { type: 'upload', file });
    }
  });


  return {
    render: renderDeviceFiles,
    clear() { deviceListing = undefined; filesMessage = undefined; },
  };
}
