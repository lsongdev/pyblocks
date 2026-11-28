import * as Blockly from 'blockly/core';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { pythonGenerator } from 'blockly/python';
import { createToolbox, EditorToolbox } from './toolbox.js';
import { applyLanguage, getSavedLanguage, normalizeLanguage, saveLanguage, t } from '../i18n/index.js';
import { PythonBlockError } from '../python/errors.js';
import { portProtocol } from '../device/detect.js';
import { connectSpike } from '../device/spike/index.js';
import { createSpikeDialog, rememberSlot } from './spike-dialog.js';
import { setupPanelResize } from './resize.js';
import { setupDialogs } from './dialogs.js';
import { createLibraryPanel } from './libraries.js';
import { setupSerialInput } from './serial-input.js';
import { DeviceController } from './device-controller.js';
import { createDeviceFilesPanel } from './device-files.js';
import { example } from './example.js';
import { createProject, parseProject, ProjectError, readAutosave, writeAutosave } from '../project/storage.js';
import { downloadProgram, MicroPythonError, monitorPort } from '../device/micropython.js';

let language = getSavedLanguage();
applyLanguage(language);
const themeKey = 'pyblocks.theme';
let themePreference = localStorage.getItem(themeKey) || 'system';
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const theme = () => themePreference === 'system' ? (systemDark.matches ? 'dark' : 'light') : themePreference;
const lightTheme = Blockly.Theme.defineTheme('pyblocks-light', {
  base: Blockly.Themes.Classic,
  componentStyles: { workspaceBackgroundColour: '#ffffff', toolboxBackgroundColour: '#f7f6fb', toolboxForegroundColour: '#29213e', flyoutBackgroundColour: '#f2f1fa', flyoutForegroundColour: '#29213e', flyoutOpacity: 1, scrollbarColour: '#c9c2da', scrollbarOpacity: 0.7, insertionMarkerColour: '#55448c', insertionMarkerOpacity: 0.3, cursorColour: '#55448c' },
});
const darkTheme = Blockly.Theme.defineTheme('pyblocks-dark', {
  base: Blockly.Themes.Classic,
  componentStyles: { workspaceBackgroundColour: '#191822', toolboxBackgroundColour: '#211f2c', toolboxForegroundColour: '#e7e5f2', flyoutBackgroundColour: '#2b2838', flyoutForegroundColour: '#e7e5f2', flyoutOpacity: 1, scrollbarColour: '#514d60', scrollbarOpacity: 0.8, insertionMarkerColour: '#b9a9ff', insertionMarkerOpacity: 0.4, cursorColour: '#e7e5f2' },
});
const faSvg = definition => `<svg aria-hidden="true" viewBox="0 0 ${definition.icon[0]} ${definition.icon[1]}"><path fill="currentColor" d="${definition.icon[4]}"/></svg>`;

const workspace = Blockly.inject('workspace', {
  media: import.meta.env.PROD ? `${import.meta.env.BASE_URL}blockly-media/` : undefined,
  toolbox: createToolbox(),
  plugins: { toolbox: EditorToolbox },
  trashcan: true,
  scrollbars: true,
  grid: { spacing: 24, length: 2, colour: '#b8bcd2' },
  theme: theme() === 'dark' ? darkTheme : lightTheme,
});
function applyTheme() {
  const resolved = theme();
  document.documentElement.dataset.theme = resolved;
  workspace.setTheme(resolved === 'dark' ? darkTheme : lightTheme);
  const toggle = document.querySelector('#toggle-theme');
  toggle.innerHTML = faSvg(resolved === 'dark' ? faSun : faMoon);
  toggle.title = t(resolved === 'dark' ? 'themeSwitchLight' : 'themeSwitchDark');
  toggle.setAttribute('aria-label', toggle.title);
  document.querySelector('#language-icon').textContent = language === 'zh-CN' ? 'EN' : '中';
  document.querySelector('#toggle-language').title = t('languageSwitch');
  document.querySelector('#toggle-language').setAttribute('aria-label', t('languageSwitch'));
  document.querySelector('meta[name="theme-color"]').content = resolved === 'dark' ? '#171622' : '#55448c';
}
document.querySelector('#toggle-theme').addEventListener('click', () => {
  themePreference = theme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(themeKey, themePreference);
  applyTheme();
});
document.querySelector('#toggle-language').addEventListener('click', () => window.setLanguage(language === 'en' ? 'zh-CN' : 'en'));
systemDark.addEventListener('change', () => { if (themePreference === 'system') applyTheme(); });
applyTheme();

const filesPanel = document.querySelector('#files-panel');
const librariesPanel = document.querySelector('#libraries-panel');
const libraryPanel = createLibraryPanel({ onChange: saveLocally });
function syncToolboxPanels() {
  const toolbox = workspace.getToolbox();
  const selected = toolbox.getSelectedItem()?.getId();
  filesPanel.hidden = selected !== 'files';
  librariesPanel.hidden = selected !== 'libraries';
  const container = filesPanel.parentElement;
  container.style.setProperty('--toolbox-width', `${toolbox.getWidth()}px`);
  const flyoutBackground = workspace.getInjectionDiv().querySelector('.blocklyFlyoutBackground');
  if (flyoutBackground) {
    const { fill, fillOpacity } = getComputedStyle(flyoutBackground);
    container.style.setProperty('--flyout-fill', fill);
    container.style.setProperty('--flyout-opacity', fillOpacity);
  }
  filesPanel.setAttribute('aria-label', t('files'));
}

workspace.addChangeListener(event => {
  if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) syncToolboxPanels();
});
const openProject = document.querySelector('#open-project');
const saveProject = document.querySelector('#save-project');
const projectFile = document.querySelector('#project-file');
const projectStatus = document.querySelector('#project-status');
const code = document.querySelector('#python');
const codeError = document.querySelector('#code-error');
const codeSync = document.querySelector('#code-sync');
const useBlockCode = document.querySelector('#use-block-code');
const download = document.querySelector('#download');
const upload = document.querySelector('#upload');
const uploadStatus = document.querySelector('#upload-status');
const serialConnect = document.querySelector('#serial-connect');
const serialClear = document.querySelector('#serial-clear');
const serialStatus = document.querySelector('#serial-status');
const serialOutput = document.querySelector('#serial-output');
const serialOutputLimit = 32_768;
const device = new DeviceController({
  onDisconnect(kind, error) {
    setSerialStatus(error ? 'serialFailed' : 'serialDisconnected', error);
    if (kind === 'spike') setUploadStatus('spikeDisconnected');
    updateButtons();
  },
});
let serialMessage = ['serialDisconnected'];
const serialInput = setupSerialInput({
  getSession: () => device.serial,
  isBusy: () => device.busy,
  onError: error => setSerialStatus('serialSendFailed', error),
});
let generatedCode = null;
let manuallyEdited = false;
const chooseSpike = createSpikeDialog();
const changeDevice = document.querySelector('#change-device');
const changeSlot = document.querySelector('#change-slot');
const deviceName = document.querySelector('#deployment-device');
let uploadMessage;
let projectMessage;
let autosaveTimer;

function renderStatus(element, message) {
  if (!message) return;
  const [key, detail] = message;
  const text = detail instanceof MicroPythonError ? t(detail.code)
    : typeof detail === 'string' ? detail
    : detail?.message;
  element.textContent = t(key, text);
}

function setProjectStatus(key) {
  projectMessage = key;
  projectStatus.textContent = key ? t(key) : '';
}

function captureProject() {
  return createProject(
    Blockly.serialization.workspaces.save(workspace),
    manuallyEdited ? code.value : null,
    libraryPanel.files,
  );
}

function applyProject(project, validate = true) {
  const previous = captureProject();
  const load = (candidate) => {
    Blockly.serialization.workspaces.load(candidate.workspace, workspace);
    manuallyEdited = candidate.manualCode !== null;
    code.value = candidate.manualCode ?? '';
    libraryPanel.setFiles(candidate.libraries);
    updateCode();
  };

  Blockly.Events.disable();
  try {
    if (validate) {
      const serializers = Blockly.registry.getAllItems(Blockly.registry.Type.SERIALIZER);
      if (Object.keys(project.workspace).some(key => !Object.hasOwn(serializers, key))) {
        throw new ProjectError('projectInvalid');
      }
      const testWorkspace = new Blockly.Workspace();
      try {
        Blockly.serialization.workspaces.load(project.workspace, testWorkspace);
      } finally {
        testWorkspace.dispose();
      }
    }
    try {
      load(project);
    } catch (error) {
      load(previous);
      throw error;
    }
    workspace.clearUndo();
  } finally {
    Blockly.Events.enable();
  }
}

function saveLocally() {
  clearTimeout(autosaveTimer);
  autosaveTimer = undefined;
  try {
    writeAutosave(captureProject());
    if (projectMessage === 'projectAutosaveFailed') setProjectStatus();
  } catch {
    setProjectStatus('projectAutosaveFailed');
  }
}

function queueAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveLocally, 200);
}

function restoreProject() {
  try {
    const saved = readAutosave();
    if (saved) {
      applyProject(saved);
      return;
    }
  } catch (error) {
    setProjectStatus(error.name === 'SecurityError' ? 'projectAutosaveFailed' : 'projectRestoreFailed');
  }
  applyProject(createProject(example), false);
}

function setUploadStatus(key, error) {
  uploadMessage = [key, error];
  renderStatus(uploadStatus, uploadMessage);
}

function setSerialStatus(key, error) {
  serialMessage = [key, error];
  renderStatus(serialStatus, serialMessage);
}

function appendSerialOutput(text) {
  const atBottom = serialOutput.scrollHeight - serialOutput.clientHeight - serialOutput.scrollTop <= 2;
  serialOutput.textContent = (serialOutput.textContent + text).slice(-serialOutputLimit);
  if (atBottom) serialOutput.scrollTop = serialOutput.scrollHeight;
  serialClear.disabled = false;
}

function attachSerial(session, protocol = 'micropython') {
  device.attachSerial(session, protocol);
  setSerialStatus('serialConnected');
}

const deviceFiles = createDeviceFilesPanel({
  device, onChange: updateButtons, attachSerial, setSerialStatus, appendSerialOutput,
});

function renderLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(element => {
    element.setAttribute('aria-label', t(element.dataset.i18nAria));
  });
  document.querySelector('#firmware-progress').setAttribute('aria-label', t('firmwareProgress'));
  document.querySelector('#serial-input').placeholder = t('serialInputPlaceholder');
  renderStatus(uploadStatus, uploadMessage);
  renderStatus(serialStatus, serialMessage);
  setProjectStatus(projectMessage);
  libraryPanel.render();
  deviceFiles.render();
}

window.setLanguage = (requested, { persist = true } = {}) => {
  const nextLanguage = normalizeLanguage(requested);
  if (!nextLanguage) throw new RangeError('Supported languages: en, zh-CN.');
  if (nextLanguage !== language) {
    const state = Blockly.serialization.workspaces.save(workspace);
    language = nextLanguage;
    applyLanguage(language);
    workspace.updateToolbox(createToolbox());
    syncToolboxPanels();
    Blockly.serialization.workspaces.load(state, workspace);
    renderLanguage();
    applyTheme();
    updateCode();
  }
  if (persist) saveLanguage(language);
  return language;
};

function updateButtons() {
  serialInput.update();
  download.disabled = !code.value.trim();
  upload.disabled = download.disabled || device.busy || !navigator.serial;
  document.querySelector('#open-firmware').disabled = device.busy;
  serialConnect.disabled = device.busy || !navigator.serial;
  serialConnect.textContent = t(device.serial || device.spike ? 'serialDisconnect' : 'serialConnect');
  changeDevice.disabled = device.busy || !navigator.serial;
  changeSlot.hidden = !device.spike;
  changeSlot.disabled = device.busy;
  deviceName.textContent = device.spike ? t('deploymentSpike', String(device.slot))
    : device.serial ? t(device.protocol === 'micropython' ? 'deploymentMicroPython' : 'deploymentSerial')
    : t('deploymentNone');
  codeSync.hidden = !manuallyEdited;
  useBlockCode.disabled = generatedCode === null;
  deviceFiles.render();
}

function updateCode() {
  try {
    generatedCode = pythonGenerator.workspaceToCode(workspace);
    codeError.textContent = '';
  } catch (error) {
    if (!(error instanceof PythonBlockError)) throw error;
    generatedCode = null;
    codeError.textContent = error.message;
  }
  if (!manuallyEdited) {
    const nextCode = generatedCode ?? '';
    if (code.value !== nextCode) code.value = nextCode;
  } else if (code.value === generatedCode) {
    manuallyEdited = false;
  }
  updateButtons();
}

code.addEventListener('input', () => {
  manuallyEdited = code.value !== (generatedCode ?? '');
  updateButtons();
  queueAutosave();
});

useBlockCode.addEventListener('click', () => {
  if (generatedCode === null) return;
  code.value = generatedCode;
  manuallyEdited = false;
  updateButtons();
  queueAutosave();
  code.focus();
});

restoreProject();
workspace.addChangeListener(event => {
  if (event.isUiEvent) return;
  updateCode();
  queueAutosave();
});
window.addEventListener('pagehide', () => {
  if (autosaveTimer !== undefined) saveLocally();
  void device.spike?.close();
});
new ResizeObserver(() => {
  Blockly.svgResize(workspace);
  syncToolboxPanels();
}).observe(document.querySelector('#workspace'));
renderLanguage();

function downloadFile(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

download.addEventListener('click', () => downloadFile(code.value, 'text/x-python', 'main.py'));

saveProject.addEventListener('click', () => {
  downloadFile(JSON.stringify(captureProject(), null, 2), 'application/json', 'project.blockly.json');
});

openProject.addEventListener('click', () => projectFile.click());
projectFile.addEventListener('change', async () => {
  const file = projectFile.files[0];
  projectFile.value = '';
  if (!file) return;
  openProject.disabled = true;
  try {
    const project = parseProject(await file.text());
    applyProject(project);
    setProjectStatus('projectOpened');
    saveLocally();
  } catch (error) {
    setProjectStatus(error instanceof ProjectError ? error.code : 'projectInvalid');
  } finally {
    openProject.disabled = false;
  }
});

serialClear.addEventListener('click', () => {
  serialOutput.textContent = '';
  serialClear.disabled = true;
});

// The browser-selected port, never the source code, determines the protocol.
async function selectPort() {
  setUploadStatus('selectPort');
  return navigator.serial.requestPort();
}

async function connectSelected(port, { uploading = false } = {}) {
  const protocol = portProtocol(port);
  if (protocol === 'unsupported-lego') {
    setUploadStatus('spikeFirmwareUnsupported');
    return false;
  }
  if (port === device.port) {
    if (device.serial || (device.spike && !device.spike.closed)) return true;
    await device.detach();
  }
  if (protocol === 'spike') {
    setUploadStatus('spikeDetecting');
    // Inspect and confirm the candidate before releasing the previous target.
    const hub = await connectSpike(port, { onConsole: appendSerialOutput });
    let attached = false;
    try {
      const slot = await chooseSpike(hub, { uploading });
      if (slot === null || hub.closed) {
        setUploadStatus(hub.closed ? 'spikeDisconnected' : 'portCanceled');
        return false;
      }
      await device.detach();
      if (hub.closed) throw new Error(t('spikeDisconnected'));
      device.attachSpike(hub, port, slot);
      attached = true;
      rememberSlot(slot);
      deviceFiles.clear();
      setSerialStatus('serialConnected');
      setUploadStatus('deploymentReady');
      return true;
    } finally {
      if (!attached) await hub.close();
    }
  }
  // Generic serial monitoring does not claim a verified MicroPython runtime.
  // The upload path verifies Raw REPL before writing anything.
  if (uploading) {
    await device.detach();
    deviceFiles.clear();
    return true;
  }
  const session = await monitorPort(port, appendSerialOutput);
  try {
    await device.detach();
    attachSerial(session, 'serial');
  } catch (error) {
    await session.close();
    throw error;
  }
  deviceFiles.clear();
  setUploadStatus('deploymentReady');
  return true;
}

function reportDeviceError(error) {
  if (!device.serial && !device.spike) setSerialStatus('serialDisconnected');
  setUploadStatus(error.name === 'NotFoundError' ? 'portCanceled'
    : error.code === 'unsupported' ? 'spikeFirmwareUnsupported' : 'flashFailed', error);
}

async function changeConnection(disconnect = false) {
  if (!device.begin('connection')) return;
  updateButtons();
  try {
    if (disconnect && (device.serial || device.spike)) {
      await device.detach();
      deviceFiles.clear();
      setSerialStatus('serialDisconnected');
      setUploadStatus('deploymentNone');
    } else {
      await connectSelected(await selectPort());
    }
  } catch (error) {
    reportDeviceError(error);
  } finally {
    device.end();
    updateButtons();
  }
}

serialConnect.addEventListener('click', () => void changeConnection(true));
changeDevice.addEventListener('click', () => void changeConnection());
changeSlot.addEventListener('click', async () => {
  if (!device.spike || !device.begin('slot')) return;
  updateButtons();
  try {
    const hub = device.spike;
    const slot = await chooseSpike(hub, { initial: device.slot });
    if (slot !== null && device.spike === hub && !hub.closed) {
      device.setSlot(slot);
      rememberSlot(slot);
    }
  } catch (error) {
    reportDeviceError(error);
  } finally {
    device.end();
    updateButtons();
  }
});

upload.addEventListener('click', async () => {
  const source = code.value;
  const projectLibraries = libraryPanel.files;
  if (!device.begin('upload')) return;
  updateButtons();
  try {
    const port = device.port ?? await selectPort();
    if (!await connectSelected(port, { uploading: true })) return;
    if (device.spike) {
      const hub = device.spike;
      const slot = device.slot;
      if (projectLibraries.length) {
        setUploadStatus('spikeLibrariesUnsupported');
        return;
      }
      const onProgress = value => setUploadStatus('spikeWriting', `${Math.round(value * 100)}%`);
      setUploadStatus('spikeWriting', '0%');
      await hub.upload(source, slot, onProgress);
      await hub.start(slot);
      setUploadStatus('spikeRunning', String(slot));
      return;
    }
    await device.detach();
    setSerialStatus('serialConnecting');
    setUploadStatus('writingCode');
    attachSerial(await downloadProgram(port, source, appendSerialOutput, projectLibraries));
    setUploadStatus('flashComplete');
  } catch (error) {
    reportDeviceError(error);
  } finally {
    device.end();
    updateButtons();
  }
});

setupDialogs({
  getLanguage: () => language,
  setLanguage: value => window.setLanguage(value),
  async acquireDevice() {
    if (!device.begin('firmware')) throw new Error(t('filesBusy'));
    updateButtons();
    try {
      await device.detach();
      deviceFiles.clear();
      setSerialStatus('serialDisconnected');
      updateButtons();
    } catch (error) {
      device.end();
      updateButtons();
      throw error;
    }
  },
  releaseDevice() { device.end(); updateButtons(); },
});

setupPanelResize().catch(error => console.warn('Panel resize unavailable:', error));
