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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/wiring/EndpointValueError.js');
});

test('EndpointValueError creates error with message', () => {
    const error = new Wirecloud.wiring.EndpointValueError('Bad value');

    assert.ok(error instanceof Error);
    assert.equal(error.name, 'EndpointValueError');
    assert.equal(error.message, 'Bad value');
});

test('EndpointValueError with no message', () => {
    const error = new Wirecloud.wiring.EndpointValueError();

    assert.equal(error.name, 'EndpointValueError');
    assert.equal(error.message, '');
});
