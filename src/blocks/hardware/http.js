import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';

const colour = 200;
const statement = { previousStatement: null, nextStatement: null };
const input = (name, check) => ({ type: 'input_value', name, check });
const response = () => input('RESPONSE', 'HTTPResponse');
const headerType = 'HTTPHeader';

common.defineBlocksWithJsonArray([
  {
    type: 'http_request', message0: blockMessage('httpRequest'), args0: [
      { type: 'field_dropdown', name: 'METHOD', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(method => [method, method]) },
      input('URL', 'String'), input('TIMEOUT', 'Number'),
    ],
    message1: blockMessage('httpRequestBody'), args1: [
      { type: 'field_dropdown', name: 'BODY_MODE', options: [
        [blockMessage('httpNoBody'), 'NONE'], [blockMessage('httpDataBody'), 'DATA'], ['JSON', 'JSON'],
      ] }, input('BODY'),
    ],
    message2: blockMessage('httpRequestHeaders'), args2: [{ type: 'input_statement', name: 'HEADERS', check: headerType }],
    output: 'HTTPResponse', colour, tooltip: blockMessage('httpRequestHint'),
  },
  { type: 'http_header', message0: blockMessage('httpHeader'), args0: [
    { type: 'field_input', name: 'NAME', text: 'Content-Type' }, input('VALUE', 'String'),
  ], previousStatement: headerType, nextStatement: headerType, colour, tooltip: blockMessage('httpHeaderHint') },
  ...[
    ['http_status_code', 'httpStatusCode', 'Number'],
    ['http_response_text', 'httpResponseText', 'String'],
    ['http_response_content', 'httpResponseContent', 'Bytes'],
    ['http_response_json', 'httpResponseJson', null],
  ].map(([type, message, output]) => ({ type, message0: blockMessage(message), args0: [response()],
    output, colour, tooltip: blockMessage('httpReadHint') })),
  { type: 'http_response_header', message0: blockMessage('httpResponseHeader'),
    args0: [response(), input('NAME', 'String')], output: 'String', colour, tooltip: blockMessage('httpResponseHeaderHint') },
  { type: 'http_close', message0: blockMessage('httpClose'), args0: [response()], ...statement, colour,
    tooltip: blockMessage('httpCloseHint') },
  { type: 'http_with_response', message0: blockMessage('httpWithResponse'), args0: [response(),
    { type: 'field_variable', name: 'VAR', variable: 'response' },
  ], message1: blockMessage('buttonEventBody'), args1: [{ type: 'input_statement', name: 'DO' }],
  ...statement, colour, tooltip: blockMessage('httpWithResponseHint') },
]);

pythonGenerator.addReservedWords('_http_requests');

function required(block, generator, name, label, order = Order.NONE) {
  const code = generator.valueToCode(block, name, order);
  if (!code) throw new PythonBlockError(t('requiredExpression', t(label)));
  return code;
}
const receiver = (block, generator) => required(block, generator, 'RESPONSE', 'httpResponse', Order.MEMBER);

Object.assign(pythonGenerator.forBlock, {
  http_request(block, generator) {
    const url = required(block, generator, 'URL', 'httpUrl');
    const timeout = generator.valueToCode(block, 'TIMEOUT', Order.NONE) || '10';
    const literal = block.getInputTargetBlock('TIMEOUT');
    if (literal?.type === 'math_number' && !(Number(literal.getFieldValue('NUM')) > 0)) {
      throw new PythonBlockError(t('httpTimeoutInvalid'));
    }
    const headers = [];
    for (let header = block.getInputTargetBlock('HEADERS'); header; header = header.getNextBlock()) {
      if (!header.isEnabled()) continue;
      const name = header.getFieldValue('NAME');
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) throw new PythonBlockError(t('httpHeaderInvalid'));
      headers.push(`${generator.quote_(name)}: ${required(header, generator, 'VALUE', 'httpHeaderValue')}`);
    }
    const args = [generator.quote_(block.getFieldValue('METHOD')), url, `timeout=${timeout}`];
    if (headers.length) args.push(`headers={${headers.join(', ')}}`);
    const mode = block.getFieldValue('BODY_MODE');
    if (mode !== 'NONE') {
      const body = required(block, generator, 'BODY', 'httpBody');
      args.push(`${mode === 'JSON' ? 'json' : 'data'}=${body}`);
    }
    generator.definitions_.import_http = 'import requests as _http_requests';
    return [`_http_requests.request(${args.join(', ')})`, Order.FUNCTION_CALL];
  },
  http_header: () => '',
  http_status_code: (block, generator) => [`${receiver(block, generator)}.status_code`, Order.MEMBER],
  http_response_text: (block, generator) => [`${receiver(block, generator)}.text`, Order.MEMBER],
  http_response_content: (block, generator) => [`${receiver(block, generator)}.content`, Order.MEMBER],
  http_response_json: (block, generator) => [`${receiver(block, generator)}.json()`, Order.FUNCTION_CALL],
  http_response_header: (block, generator) => {
    const target = receiver(block, generator);
    const name = required(block, generator, 'NAME', 'httpHeaderName');
    return [`${target}.headers.get(${name}, '')`, Order.FUNCTION_CALL];
  },
  http_close: (block, generator) => `${receiver(block, generator)}.close()\n`,
  http_with_response: (block, generator) => {
    const expression = required(block, generator, 'RESPONSE', 'httpResponse');
    const name = generator.getVariableName(block.getFieldValue('VAR'));
    const body = generator.statementToCode(block, 'DO') || `${generator.INDENT}pass\n`;
    return `with ${expression} as ${name}:\n${body}`;
  },
});
