const format = 'pyblocks';
const version = 1;
const storageKey = 'pyblocks.project';

export class ProjectError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function isLibraryFilename(name) {
  return typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]*\.py$/.test(name);
}

export function createProject(workspace, manualCode = null, libraries = []) {
  return { format, version, workspace, manualCode, libraries };
}

export function parseProject(text) {
  let project;
  try {
    project = JSON.parse(text);
  } catch {
    throw new ProjectError('projectInvalid');
  }
  if (project?.format !== format) throw new ProjectError('projectInvalid');
  if (project.version !== version) throw new ProjectError('projectUnsupported');
  const { workspace, manualCode, libraries = [] } = project;
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace) ||
      (manualCode !== null && typeof manualCode !== 'string')) {
    throw new ProjectError('projectInvalid');
  }
  if ('blocks' in workspace && (!workspace.blocks || !Array.isArray(workspace.blocks.blocks))) {
    throw new ProjectError('projectInvalid');
  }
  if (!Array.isArray(libraries) ||
      libraries.some(file => !isLibraryFilename(file?.name) || typeof file.source !== 'string') ||
      new Set(libraries.map(file => file.name.toLowerCase())).size !== libraries.length) {
    throw new ProjectError('projectInvalid');
  }
  return createProject(workspace, manualCode, libraries);
}

export function readAutosave() {
  const text = localStorage.getItem(storageKey);
  return text === null ? null : parseProject(text);
}

export function writeAutosave(project) {
  localStorage.setItem(storageKey, JSON.stringify(project));
}
