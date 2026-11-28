export class MicroPythonError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export class BoardCommandError extends Error {}
