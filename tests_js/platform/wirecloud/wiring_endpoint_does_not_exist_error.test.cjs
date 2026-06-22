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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/wiring/EndpointDoesNotExistError.js');
});

test('EndpointDoesNotExistError creates error with message', () => {
    const error = new Wirecloud.wiring.EndpointDoesNotExistError('Endpoint gone');

    assert.ok(error instanceof Error);
    assert.equal(error.name, 'EndpointDoesNotExistError');
    assert.equal(error.message, 'Endpoint gone');
});

test('EndpointDoesNotExistError with no message', () => {
    const error = new Wirecloud.wiring.EndpointDoesNotExistError();

    assert.equal(error.name, 'EndpointDoesNotExistError');
    assert.equal(error.message, '');
});
