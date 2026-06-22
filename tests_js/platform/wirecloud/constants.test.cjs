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
    Wirecloud.constants = {};
    Wirecloud.Utils = StyledElements.Utils;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/constants.js');
});

test('LOGGING constants are defined', () => {
    assert.ok(Wirecloud.constants.LOGGING);
    assert.equal(Wirecloud.constants.LOGGING.ERROR_MSG, 1);
    assert.equal(Wirecloud.constants.LOGGING.WARN_MSG, 2);
    assert.equal(Wirecloud.constants.LOGGING.INFO_MSG, 3);
    assert.equal(Wirecloud.constants.LOGGING.DEBUG_MSG, 4);
});

test('HTTP_STATUS_DESCRIPTIONS are defined with translations', () => {
    const desc = Wirecloud.constants.HTTP_STATUS_DESCRIPTIONS;
    assert.equal(Object.keys(desc).length > 0, true);
    assert.equal(desc['0'], 'Connection Refused');
    assert.equal(desc['400'], 'Bad Request');
    assert.equal(desc['401'], 'Unauthorized');
    assert.equal(desc['404'], 'Not Found');
    assert.equal(desc['500'], 'Internal Server Error');
});

test('UNKNOWN_STATUS_CODE_DESCRIPTION is defined', () => {
    assert.equal(Wirecloud.constants.UNKNOWN_STATUS_CODE_DESCRIPTION, 'Unknown status code');
});
