const name = (NAME) => ({ type: 'python_name', fields: { NAME } });
const text = (TEXT) => ({ type: 'text', fields: { TEXT } });

const ticks = {
  type: 'python_call',
  inputs: {
    CALLABLE: { block: {
      type: 'python_member',
      fields: { NAME: 'ticks_ms' },
      inputs: { OBJECT: { block: name('time') } },
    } },
  },
};

const argumentsList = {
  type: 'python_argument',
  inputs: { VALUE: { block: text('MicroPython') } },
  next: { block: {
    type: 'python_argument',
    inputs: { VALUE: { block: ticks } },
    next: { block: {
      type: 'python_keyword_argument',
      fields: { NAME: 'sep' },
      inputs: { VALUE: { block: text(' · ') } },
    } },
  } },
};

export const example = {
  blocks: {
    languageVersion: 0,
    blocks: [{
      type: 'python_import', x: 24, y: 24,
      fields: { MODULE: 'time' },
      next: { block: {
        type: 'python_call_statement',
        inputs: { CALLABLE: { block: name('print') }, ARGS: { block: argumentsList } },
      } },
    }],
  },
};
