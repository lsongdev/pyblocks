import { PythonBlockError } from '../python/errors.js';
import { t } from '../i18n/index.js';

// The source editor owns generated/manual code, independently of device state.
export function createCodePanel({ generate, onChange, downloadFile, document = globalThis.document }) {
  const code = document.querySelector('#python');
  const codeError = document.querySelector('#code-error');
  const codeSync = document.querySelector('#code-sync');
  const useBlockCode = document.querySelector('#use-block-code');
  const download = document.querySelector('#download');
  const toggle = document.querySelector('#toggle-code');
  const panel = document.querySelector('#code-panel');
  const body = document.querySelector('#code-body');
  const splitter = document.querySelector('#output-resizer');
  let generatedCode = null;
  let manuallyEdited = false;

  function render() {
    download.disabled = !code.value.trim();
    codeSync.hidden = !manuallyEdited;
    useBlockCode.disabled = generatedCode === null;
    toggle.textContent = t(body.hidden ? 'expandCode' : 'collapseCode');
    toggle.setAttribute('aria-expanded', String(!body.hidden));
  }

  function refresh() {
    try {
      generatedCode = generate();
      codeError.textContent = '';
    } catch (error) {
      if (!(error instanceof PythonBlockError)) throw error;
      generatedCode = null;
      codeError.textContent = error.message;
      // Do not hide generation errors in the collapsed code panel.
      setExpanded(true);
    }
    if (!manuallyEdited) {
      const nextCode = generatedCode ?? '';
      if (code.value !== nextCode) code.value = nextCode;
    } else if (code.value === generatedCode) {
      manuallyEdited = false;
    }
    render();
  }

  function setExpanded(expanded) {
    body.hidden = !expanded;
    splitter.hidden = !expanded;
    panel.classList.toggle('collapsed', !expanded);
    render();
  }

  toggle.addEventListener('click', () => setExpanded(body.hidden));
  code.addEventListener('input', () => {
    manuallyEdited = code.value !== (generatedCode ?? '');
    render();
    onChange();
  });
  useBlockCode.addEventListener('click', () => {
    if (generatedCode === null) return;
    code.value = generatedCode;
    manuallyEdited = false;
    render();
    onChange();
    code.focus();
  });
  download.addEventListener('click', () => downloadFile(code.value, 'text/x-python', 'main.py'));
  return {
    get source() { return code.value; },
    get manualCode() { return manuallyEdited ? code.value : null; },
    load(manualCode) {
      manuallyEdited = manualCode !== null;
      code.value = manualCode ?? '';
      refresh();
    },
    refresh, render, setExpanded,
  };
}
