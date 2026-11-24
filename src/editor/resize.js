const storageKey = 'blockly-demo.panel-sizes';
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export async function setupPanelResize() {
  const main = document.querySelector('#editor-panels');
  const blocks = document.querySelector('#blocks-panel');
  const output = document.querySelector('#output-panels');
  const code = document.querySelector('#python');
  const panelHandle = document.querySelector('#panel-resizer');
  const outputHandle = document.querySelector('#output-resizer');
  const narrow = matchMedia('(max-width: 760px)');
  let ratios = { blocks: null, code: .65 };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    for (const key of ['blocks', 'code']) {
      if (Number.isFinite(saved?.[key]) && saved[key] > 0 && saved[key] < 1) ratios[key] = saved[key];
    }
  } catch { /* Resizing also works without storage. */ }
  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(ratios)); } catch { /* Optional persistence. */ }
  };
  const updateAria = (handle, value, total, min, max) => {
    handle.setAttribute('aria-valuemin', String(Math.round(min / total * 100)));
    handle.setAttribute('aria-valuemax', String(Math.round(max / total * 100)));
    handle.setAttribute('aria-valuenow', String(Math.round(value / total * 100)));
  };
  const panelBounds = () => {
    const total = main.clientWidth - panelHandle.offsetWidth;
    return { total, min: 320, max: Math.max(320, total - 270) };
  };
  const outputBounds = () => {
    const total = output.clientHeight - outputHandle.offsetHeight;
    return { total, min: Math.min(80, total / 2), max: Math.max(total / 2, total - 100) };
  };
  function setPanels(width, remember = false) {
    if (narrow.matches) return;
    const { total, min, max } = panelBounds();
    width = clamp(width, min, max);
    main.style.gridTemplateColumns = `${width}px 12px minmax(0, 1fr)`;
    blocks.style.removeProperty('width');
    if (remember) ratios.blocks = width / total;
    updateAria(panelHandle, width, total, min, max);
  }
  function setOutput(height, remember = false) {
    const { total, min, max } = outputBounds();
    if (total <= 0) return;
    height = clamp(height, min, max);
    code.style.height = `${height}px`;
    if (remember) ratios.code = height / total;
    updateAria(outputHandle, height, total, min, max);
  }
  function layout() {
    if (narrow.matches) {
      main.style.removeProperty('grid-template-columns');
      blocks.style.removeProperty('width');
    } else {
      const { total } = panelBounds();
      setPanels(ratios.blocks === null ? total - 340 : total * ratios.blocks);
    }
    setOutput(outputBounds().total * ratios.code);
  }
  // Layout and keyboard resizing remain usable if the shared pointer module is offline.
  function keyboard(handle, bounds, current, apply, negative, positive) {
    handle.addEventListener('keydown', event => {
      const { min, max } = bounds();
      let value = current();
      if (event.key === negative) value -= event.shiftKey ? 50 : 10;
      else if (event.key === positive) value += event.shiftKey ? 50 : 10;
      else if (event.key === 'Home') value = min;
      else if (event.key === 'End') value = max;
      else return;
      event.preventDefault();
      apply(value, true);
      save();
    });
  }
  keyboard(panelHandle, panelBounds, () => blocks.getBoundingClientRect().width, setPanels, 'ArrowLeft', 'ArrowRight');
  keyboard(outputHandle, outputBounds, () => code.getBoundingClientRect().height, setOutput, 'ArrowUp', 'ArrowDown');
  panelHandle.addEventListener('resize', event => setPanels(event.detail.width, true));
  outputHandle.addEventListener('resize', event => setOutput(event.detail.height, true));
  for (const handle of [panelHandle, outputHandle]) {
    handle.addEventListener('resizeend', save);
    handle.addEventListener('dblclick', () => {
      if (handle === panelHandle) ratios.blocks = null;
      else ratios.code = .65;
      layout();
      save();
    });
  }
  layout();
  let dragging = false;
  for (const handle of [panelHandle, outputHandle]) {
    handle.addEventListener('resizestart', () => { dragging = true; });
    handle.addEventListener('resizeend', () => { dragging = false; bind(); });
  }
  let bindResizable;
  let disposePanel;
  let disposeOutput;
  function bind() {
    if (dragging) return;
    disposePanel?.();
    disposeOutput?.();
    if (!bindResizable) return;
    if (!narrow.matches) {
      const { min, max } = panelBounds();
      disposePanel = bindResizable(panelHandle, { target: blocks, axes: 'horizontal', minWidth: min, maxWidth: max });
    }
    const { min, max } = outputBounds();
    disposeOutput = bindResizable(outputHandle, { target: code, axes: 'vertical', minHeight: min, maxHeight: max });
  }
  const observer = new ResizeObserver(() => { layout(); bind(); });
  observer.observe(main);
  observer.observe(output);
  narrow.addEventListener('change', () => { layout(); bind(); });
  ({ bindResizable } = await import(/* @vite-ignore */ 'https://lsong.org/scripts/dom/resizable.js'));
  bind();
}
