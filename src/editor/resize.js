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
    minBefore: 240,
    minAfter: 110,
    initialRatio: .60,
    storageKey: 'pyblocks.device-height',
  });
  return () => { disposePanels(); disposeOutput(); };
}
