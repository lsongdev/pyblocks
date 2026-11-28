import * as Blockly from 'blockly/core';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { pythonGenerator } from 'blockly/python';
import { createToolbox, EditorToolbox } from './toolbox.js';
import { applyLanguage, getSavedLanguage, normalizeLanguage, saveLanguage, t } from '../i18n/index.js';
import { PythonBlockError } from '../python/errors.js';
import { targetsSpikeApp } from '../python/targets.js';
import { selectSpikeSerialPort, uploadSpikeProgram } from '../device/spike/index.js';
import { setupPanelResize } from './resize.js';
import { setupDialogs } from './dialogs.js';
import { createLibraryPanel } from './libraries.js';
import { setupSerialInput } from './serial-input.js';
import { example } from './example.js';
import { createProject, parseProject, ProjectError, readAutosave, writeAutosave } from '../project/storage.js';
import { downloadProgram, manageDeviceFiles, MicroPythonError, monitorPort } from '../device/micropython.js';

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
const localDeviceFile = document.querySelector('#local-device-file');
const refreshFiles = document.querySelector('#refresh-files');
const addFile = document.querySelector('#add-file');
const filesParent = document.querySelector('#files-parent');
const filesPath = document.querySelector('#files-path');
const fileList = document.querySelector('#device-file-list');
const filesStatus = document.querySelector('#device-files-status');
let deviceListing;
let filesMessage;
let filesBusy = false;

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
let serialBusy = false;
let serialSession;
let serialMessage = ['serialDisconnected'];
const serialInput = setupSerialInput({
  getSession: () => serialSession,
  isBusy: () => serialBusy,
  onError: error => setSerialStatus('serialSendFailed', error),
});
let generatedCode = null;
let manuallyEdited = false;
let spikeHub;
const SPIKE_SLOT = 0;
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

function attachSerial(session) {
  serialSession = session;
  setSerialStatus('serialConnected');
  const ended = (error) => {
    if (serialSession !== session) return;
    serialSession = undefined;
    setSerialStatus(error ? 'serialFailed' : 'serialDisconnected', error);
    updateButtons();
  };
  session.done.then(() => ended(), ended);
}

async function detachSerial() {
  const session = serialSession;
  serialSession = undefined;
  const hub = spikeHub;
  spikeHub = undefined;
  await session?.close();
  await hub?.close();
}

function renderDeviceFiles() {
  const listing = deviceListing?.port === serialSession?.port ? deviceListing : undefined;
  refreshFiles.disabled = serialBusy || !navigator.serial;
  refreshFiles.textContent = t(serialSession ? 'filesRefresh' : 'filesConnect');
  addFile.disabled = serialBusy || !listing;
  filesParent.hidden = !listing || listing.path === '/';
  filesParent.disabled = serialBusy;
  filesPath.textContent = listing?.path ?? '';
  filesStatus.textContent = filesBusy ? t('filesBusy')
    : filesMessage ? t(...filesMessage)
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
      name.disabled = serialBusy;
      name.addEventListener('click', () => accessDeviceFiles(path));
    } else {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.disabled = serialBusy;
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
  if (serialBusy || !navigator.serial) return;
  filesBusy = serialBusy = true;
  filesMessage = undefined;
  updateButtons();
  try {
    const port = serialSession?.port ?? await navigator.serial.requestPort();
    const command = action?.type === 'upload'
      ? { type: 'upload', name: action.file.name, bytes: new Uint8Array(await action.file.arrayBuffer()) }
      : action;
    await detachSerial();
    setSerialStatus('serialConnecting');
    const { session, result } = await manageDeviceFiles(port, path, command, appendSerialOutput);
    attachSerial(session);
    if (result.error) throw result.error;
    deviceListing = {
      port, path,
      entries: result.entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name)),
    };
  } catch (error) {
    if (!serialSession) {
      deviceListing = undefined;
      setSerialStatus('serialDisconnected');
    }
    if (error.name === 'NotFoundError') filesMessage = ['portCanceled'];
    else filesMessage = ['filesFailed', error instanceof MicroPythonError ? t(error.code) : error.message];
  } finally {
    filesBusy = serialBusy = false;
    updateButtons();
  }
}

refreshFiles.addEventListener('click', () => {
  const path = deviceListing?.port === serialSession?.port ? deviceListing?.path : undefined;
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
  if (file && deviceListing && deviceListing.port === serialSession?.port) {
    void accessDeviceFiles(deviceListing.path, { type: 'upload', file });
  }
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
  renderDeviceFiles();
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
  upload.disabled = download.disabled || serialBusy || !navigator.serial;
  document.querySelector('#open-firmware').disabled = serialBusy;
  serialConnect.disabled = serialBusy || !navigator.serial;
  serialConnect.textContent = t(serialSession || spikeHub ? 'serialDisconnect' : 'serialConnect');
  codeSync.hidden = !manuallyEdited;
  useBlockCode.disabled = generatedCode === null;
  renderDeviceFiles();
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
  void spikeHub?.close();
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

serialConnect.addEventListener('click', async () => {
  serialBusy = true;
  updateButtons();
  try {
    if (serialSession || spikeHub) {
      const wasSpikeConnected = Boolean(spikeHub);
      await detachSerial();
      setSerialStatus('serialDisconnected');
      if (wasSpikeConnected) setUploadStatus('spikeDisconnected');
    } else {
      setSerialStatus('selectPort');
      const port = await navigator.serial.requestPort();
      attachSerial(await monitorPort(port, appendSerialOutput));
    }
  } catch (error) {
    setSerialStatus(error.name === 'NotFoundError' ? 'portCanceled' : 'serialFailed', error);
  } finally {
    serialBusy = false;
    updateButtons();
  }
});

async function runSpikeUpload(source) {
  serialBusy = true;
  updateButtons();
  try {
    const onProgress = value => setUploadStatus('spikeWriting', `${Math.round(value * 100)}%`);
    if (spikeHub && !spikeHub.closed) {
      setUploadStatus('spikeWriting', '0%');
      await spikeHub.upload(source, SPIKE_SLOT, onProgress);
      await spikeHub.start(SPIKE_SLOT);
      setUploadStatus('spikeRunning', String(SPIKE_SLOT));
      return;
    }
    const port = await selectSpikeSerialPort(() => setUploadStatus('selectPort'));
    await detachSerial();
    setSerialStatus('serialConnecting');
    setUploadStatus('spikeDetecting');
    const hub = await uploadSpikeProgram(port, source, {
      slot: SPIKE_SLOT,
      onProgress,
      onConsole: appendSerialOutput,
    });
    if (hub.closed) {
      await hub.close();
      throw new Error(t('spikeDisconnected'));
    }
    spikeHub = hub;
    setSerialStatus('serialConnected');
    setUploadStatus('spikeRunning', String(SPIKE_SLOT));
    hub.onClose(error => {
      if (spikeHub !== hub) return;
      void hub.close().finally(() => {
        if (spikeHub !== hub) return;
        spikeHub = undefined;
        setSerialStatus(error ? 'serialFailed' : 'serialDisconnected', error);
        setUploadStatus('spikeDisconnected');
        updateButtons();
      });
    });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      setUploadStatus('portCanceled');
    } else {
      if (!spikeHub || spikeHub.closed) setSerialStatus('serialDisconnected');
      setUploadStatus(error.code === 'unsupported' ? 'spikeFirmwareUnsupported' : 'flashFailed', error);
    }
  } finally {
    serialBusy = false;
    updateButtons();
  }
}

upload.addEventListener('click', async () => {
  const source = code.value;
  if (targetsSpikeApp(source)) {
    await runSpikeUpload(source);
    return;
  }
  const projectLibraries = libraryPanel.files;
  serialBusy = true;
  updateButtons();
  try {
    let port = serialSession?.port;
    if (!port) {
      setUploadStatus('selectPort');
      port = await navigator.serial.requestPort();
    }
    await detachSerial();
    setSerialStatus('serialConnecting');
    setUploadStatus('writingCode');
    attachSerial(await downloadProgram(port, source, appendSerialOutput, projectLibraries));
    setUploadStatus('flashComplete');
  } catch (error) {
    setSerialStatus('serialDisconnected');
    if (error.name === 'NotFoundError') setUploadStatus('portCanceled');
    else setUploadStatus('flashFailed', error);
  } finally {
    serialBusy = false;
    updateButtons();
  }
});

setupDialogs({
  getLanguage: () => language,
  setLanguage: value => window.setLanguage(value),
  async acquireDevice() {
    if (serialBusy) throw new Error(t('filesBusy'));
    serialBusy = true;
    updateButtons();
    try {
      await detachSerial();
      deviceListing = undefined;
      setSerialStatus('serialDisconnected');
      updateButtons();
    } catch (error) {
      serialBusy = false;
      updateButtons();
      throw error;
    }
  },
  releaseDevice() { serialBusy = false; updateButtons(); },
});

setupPanelResize().catch(error => console.warn('Panel resize unavailable:', error));
