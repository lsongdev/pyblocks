export async function setupPanelResize() {
  const { bindSplitter } = await import('shared-panel-resizable');
  const disposePanels = bindSplitter(document.querySelector('#panel-resizer'), {
    minBefore: 320,
    minAfter: 270,
    media: '(min-width: 761px)',
    storageKey: 'pyblocks.panel-width',
  });
  const disposeOutput = bindSplitter(document.querySelector('#output-resizer'), {
    axis: 'vertical',
    minBefore: 80,
    minAfter: 100,
    initialRatio: .65,
    storageKey: 'pyblocks.code-height',
  });
  return () => { disposePanels(); disposeOutput(); };
}
