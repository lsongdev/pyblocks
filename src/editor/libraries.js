import { t } from '../i18n/index.js';
import { isLibraryFilename } from '../project/storage.js';

export function createLibraryPanel({ onChange }) {
  const input = document.querySelector('#library-file');
  const list = document.querySelector('#library-list');
  const status = document.querySelector('#libraries-status');
  let files = [];
  let message;

  function render() {
    status.textContent = message ? t(message) : files.length === 0 ? t('librariesEmpty') : '';
    list.replaceChildren();
    for (const file of files) {
      const row = document.createElement('li');
      const filename = document.createElement('code');
      filename.textContent = file.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = t('libraryRemove');
      remove.addEventListener('click', () => {
        files = files.filter(item => item !== file);
        message = undefined;
        render();
        onChange();
      });
      row.append(filename, remove);
      list.append(row);
    }
  }

  document.querySelector('#add-library').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    message = undefined;
    if (!isLibraryFilename(file.name)) {
      message = 'libraryInvalidName';
      render();
      return;
    }
    const previous = files;
    try {
      const source = await file.text();
      if (previous !== files) return;
      const existing = files.find(item => item.name.toLowerCase() === file.name.toLowerCase());
      if (existing && !window.confirm(t('libraryReplace', existing.name))) return;
      const library = { name: existing?.name ?? file.name, source };
      files = existing ? files.map(item => item === existing ? library : item) : [...files, library];
      onChange();
    } catch {
      if (previous !== files) return;
      message = 'libraryReadFailed';
    }
    render();
  });

  return {
    get files() { return files; },
    setFiles(nextFiles) {
      files = nextFiles;
      message = undefined;
      render();
    },
    render,
  };
}
