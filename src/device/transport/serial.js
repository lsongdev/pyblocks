const encoder = new TextEncoder();

export async function writeSerialText(writer, text) {
  const bytes = encoder.encode(text);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    if (offset) await new Promise(resolve => setTimeout(resolve, 10));
    await writer.write(bytes.subarray(offset, offset + 64));
  }
}

export function streamOutput(port, reader, decoder, onOutput, pending = '') {
  let closing = false;
  let writes = Promise.resolve();
  const done = (async () => {
    try {
      if (pending) onOutput(pending);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (text) onOutput(text);
      }
      const tail = decoder.decode();
      if (tail) onOutput(tail);
    } finally {
      closing = true;
      reader.releaseLock();
      await writes.catch(() => {});
      await port.close();
    }
  })();

  return {
    port,
    done,
    write(text) {
      if (closing) return Promise.reject(new Error('Serial session is closed'));
      const operation = writes.catch(() => {}).then(async () => {
        const writer = port.writable.getWriter();
        try { await writeSerialText(writer, text); } finally { writer.releaseLock(); }
      });
      writes = operation;
      return operation;
    },
    async close() {
      closing = true;
      await reader.cancel().catch(() => {});
      await done.catch(() => {});
    },
  };
}

export async function monitorPort(port, onOutput) {
  await port.open({ baudRate: 115200 });
  try {
    return streamOutput(port, port.readable.getReader(), new TextDecoder(), onOutput);
  } catch (error) {
    await port.close().catch(() => {});
    throw error;
  }
}

