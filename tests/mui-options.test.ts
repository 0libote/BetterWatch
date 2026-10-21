import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { NumericTextFieldOption, TextFieldOption } from '../src/components/TextFieldOption';

test('numeric options retain native input limits through the MUI htmlInput slot', () => {
  const markup = renderToStaticMarkup(createElement(NumericTextFieldOption, {
    id: 'progress', label: 'Progress', value: 75, isDisabled: false,
    minValue: 0, maxValue: 100, step: 5, handleChange() {},
  }));
  const dom = new JSDOM(markup);
  try {
    const input = dom.window.document.querySelector('input')!;
    assert.equal(input.type, 'number');
    assert.equal(input.min, '0');
    assert.equal(input.max, '100');
    assert.equal(input.step, '5');
    assert.equal(input.value, '75');
  } finally { dom.window.close(); }
});

test('text options render a valid text input and preserve their value and disabled state', () => {
  const markup = renderToStaticMarkup(createElement(TextFieldOption, {
    id: 'label', label: 'Label', value: 'Watch list', isDisabled: true, handleChange() {},
  }));
  const dom = new JSDOM(markup);
  try {
    const input = dom.window.document.querySelector('input')!;
    assert.equal(input.getAttribute('type'), 'text');
    assert.equal(input.value, 'Watch list');
    assert.equal(input.disabled, true);
  } finally { dom.window.close(); }
});
