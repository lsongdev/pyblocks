// Device feedback lives outside the panel layout. Replace in-flight feedback,
// dismiss short acknowledgments, and keep errors visible until dismissed.
const errors = new Set([
  'serialFailed', 'serialSendFailed', 'serialOpenFailed', 'serialConnectionFailed',
  'flashFailed', 'spikeFirmwareUnsupported', 'spikeLibrariesUnsupported', 'spikeDisconnected',
]);
const progress = new Set(['selectPort', 'serialConnecting', 'spikeDetecting', 'spikeWriting', 'writingCode']);

export function createDeviceToast({ element, message, dismiss, translate, schedule = setTimeout, cancel = clearTimeout }) {
  let current;
  let timer;
  function clear() {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
    current = undefined;
    render();
  }
  function render() {
    element.hidden = !current;
    message.textContent = current ? translate(...current) : '';
    element.classList.toggle('error', Boolean(current && errors.has(current[0])));
  }
  function show(key, detail) {
    clear();
    if (!key) return;
    current = [key, detail];
    render();
    if (!errors.has(key) && !progress.has(key)) timer = schedule(clear, 3000);
  }
  dismiss.addEventListener('click', clear);
  return { show, render, clear };
}
