import * as Blockly from 'blockly/core';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { pythonGenerator } from 'blockly/python';
import { createToolbox, EditorToolbox } from './toolbox.js';
import { applyLanguage, getSavedLanguage, normalizeLanguage, saveLanguage, t } from '../i18n/index.js';
import { createCodePanel } from './code-panel.js';
import { procedureFlyout } from '../blocks/shared/async-procedures.js';
import { createDevicePanel } from './device-panel.js';
import { setupPanelResize } from './resize.js';
import { setupDialogs } from './dialogs.js';
import { createLibraryPanel } from './libraries.js';
import { example } from './example.js';
import { createProject, parseProject, ProjectError, readAutosave, writeAutosave } from '../project/storage.js';

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
workspace.registerToolboxCategoryCallback('PYBLOCKS_PROCEDURE', procedureFlyout);

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
const codePanel = createCodePanel({
  generate: () => pythonGenerator.workspaceToCode(workspace),
  onChange() { devicePanel.render(); queueAutosave(); },
  downloadFile,
});
const devicePanel = createDevicePanel({
  getSource: () => codePanel.source,
  getLibraries: () => libraryPanel.files,
});
let projectMessage;
let autosaveTimer;

function setProjectStatus(key) {
  projectMessage = key;
  projectStatus.textContent = key ? t(key) : '';
}

function captureProject() {
  return createProject(
    Blockly.serialization.workspaces.save(workspace),
    codePanel.manualCode,
    libraryPanel.files,
  );
}

function applyProject(project, validate = true) {
  const previous = captureProject();
  const load = (candidate) => {
    Blockly.serialization.workspaces.load(candidate.workspace, workspace);
    libraryPanel.setFiles(candidate.libraries);
    codePanel.load(candidate.manualCode);
    devicePanel.render();
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
  setProjectStatus(projectMessage);
  libraryPanel.render();
  codePanel.render();
  devicePanel.renderLanguage();
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

unction updateCode() {
  codePanel.refresh();
  devicePanel.render();
}

restoreProject();
workspace.addChangeListener(event => {
  if (event.isUiEvent) return;
  updateCode();
  queueAutosave();
});
window.addEventListener('pagehide', () => {
  if (autosaveTimer !== undefined) saveLocally();
  void devicePanel.close().catch(() => {});
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

setupDialogs({
  getLanguage: () => language,
  setLanguage: value => window.setLanguage(value),
  acquireDevice: devicePanel.acquireDevice,
  releaseDevice: devicePanel.releaseDevice,
});

setupPanelResize().catch(error => console.warn('Panel resize unavailable:', error));
