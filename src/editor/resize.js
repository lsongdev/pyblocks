export async function setupPanelResize() {
  const { bindSplitter } = await import('https://lsong.org/scripts/dom/resizable.js');
  const disposePanels = bindSplitter(document.querySelector('#panel-resizer'), {
    minBefore: 320,
    minAfter: 270,
    media: '(min-width: 761px)',
    storageKey: 'blockly-demo.panel-width',
  });
  const disposeOutput = bindSplitter(document.querySelector('#output-resizer'), {
    axis: 'vertical',
    minBefore: 80,
    minAfter: 100,
    initialRatio: .65,
    storageKey: 'blockly-demo.code-height',
  });
  return () => { disposePanels(); disposeOutput(); };
}
