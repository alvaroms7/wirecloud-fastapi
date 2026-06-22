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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/PreferenceDoesNotExistError.js');
});

test('PreferenceDoesNotExistError creates error with message', () => {
    const error = new Wirecloud.PreferenceDoesNotExistError('Preference not found');

    assert.ok(error instanceof Error);
    assert.equal(error.name, 'PreferenceDoesNotExistError');
    assert.equal(error.message, 'Preference not found');
});

test('PreferenceDoesNotExistError with no message', () => {
    const error = new Wirecloud.PreferenceDoesNotExistError();

    assert.equal(error.name, 'PreferenceDoesNotExistError');
    assert.equal(error.message, '');
});
