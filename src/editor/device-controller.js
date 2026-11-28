// Own the active device and exclusive editor operation independently of the DOM.
export class DeviceController {
  #connection = null;
  #operation = null;

  constructor({ onDisconnect = () => {} } = {}) {
    this.onDisconnect = onDisconnect;
  }

  get operation() { return this.#operation; }
  get busy() { return this.#operation !== null; }
  get serial() { return this.#connection?.kind === 'serial' ? this.#connection.value : undefined; }
  get spike() { return this.#connection?.kind === 'spike' ? this.#connection.value : undefined; }

  begin(operation) {
    if (this.busy) return false;
    this.#operation = operation;
    return true;
  }

  end() { this.#operation = null; }

  #attach(kind, value) {
    if (this.#connection) throw new Error('Detach the active device first');
    const connection = { kind, value };
    this.#connection = connection;
    return connection;
  }

  #ended(connection, error) {
    if (this.#connection !== connection) return;
    this.#connection = null;
    this.onDisconnect(connection.kind, error);
  }

  attachSerial(session) {
    const connection = this.#attach('serial', session);
    session.done.then(() => this.#ended(connection), error => this.#ended(connection, error));
  }

  attachSpike(hub) {
    const connection = this.#attach('spike', hub);
    hub.onClose(error => {
      if (this.#connection !== connection) return;
      // A SPIKE disconnect must finish releasing the transport before notifying UI.
      void Promise.resolve().then(() => hub.close()).then(
        () => this.#ended(connection, error),
        closeError => this.#ended(connection, error ?? closeError),
      );
    });
  }

  async detach() {
    const connection = this.#connection;
    this.#connection = null; // Ignore late events from the previous connection.
    await connection?.value.close();
  }
}
