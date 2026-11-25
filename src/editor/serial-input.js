// Input history belongs to this session only; it is never persisted with projects.
export function setupSerialInput({ getSession, isBusy, onError }) {
  const form = document.querySelector('#serial-input-form');
  const input = document.querySelector('#serial-input');
  const ending = document.querySelector('#serial-line-ending');
  const send = document.querySelector('#serial-send');
  const interrupt = document.querySelector('#serial-interrupt');
  const reset = document.querySelector('#serial-reset');
  const controls = [input, ending, send, interrupt, reset];
  const history = [];
  let position = 0;
  let draft = '';
  let sending = false;
  let composing = false;

  function update() {
    const disabled = !getSession() || isBusy() || sending;
    for (const control of controls) control.disabled = disabled;
  }
  async function transmit(text) {
    const session = getSession();
    if (!session || isBusy() || sending) return false;
    sending = true;
    update();
    try {
      await session.write(text);
      return true;
    } catch (error) {
      if (getSession() === session) onError(error);
      return false;
    } finally {
      sending = false;
      update();
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (composing) return;
    const text = input.value;
    const suffix = { CR: '\r', LF: '\n', CRLF: '\r\n', NONE: '' }[ending.value];
    if (!text && !suffix) return;
    if (await transmit(text + suffix)) {
      if (text && history.at(-1) !== text) {
        history.push(text);
        if (history.length > 50) history.shift();
      }
      position = history.length;
      draft = '';
      if (input.value === text) input.value = '';
      if (!input.disabled) input.focus();
    }
  });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; });
  input.addEventListener('keydown', event => {
    if (event.isComposing || composing) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !history.length) return;
    event.preventDefault();
    if (position === history.length) draft = input.value;
    position = Math.max(0, Math.min(history.length, position + (event.key === 'ArrowUp' ? -1 : 1)));
    input.value = position === history.length ? draft : history[position];
  });
  input.addEventListener('input', () => { position = history.length; });
  interrupt.addEventListener('click', () => void transmit('\x03'));
  reset.addEventListener('click', () => void transmit('\x04'));
  update();
  return { update };
}
