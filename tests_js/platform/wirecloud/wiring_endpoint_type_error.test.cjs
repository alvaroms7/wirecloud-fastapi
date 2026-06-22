const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.wiring = {};
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/wiring/EndpointTypeError.js');
});

test('EndpointTypeError creates error with message', () => {
    const error = new Wirecloud.wiring.EndpointTypeError('Type mismatch');

    assert.ok(error instanceof Error);
    assert.equal(error.name, 'EndpointTypeError');
    assert.equal(error.message, 'Type mismatch');
});

test('EndpointTypeError with no message', () => {
    const error = new Wirecloud.wiring.EndpointTypeError();

    assert.equal(error.name, 'EndpointTypeError');
    assert.equal(error.message, '');
});
