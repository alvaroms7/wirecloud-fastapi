const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.ui = {};
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MultiValuedSize.js');
});

test('MultiValuedSize constructor stores values', () => {
    const size = new Wirecloud.ui.MultiValuedSize(100, 5);
    assert.equal(size.inPixels, 100);
    assert.equal(size.inLU, 5);
});

test('MultiValuedSize with zero values', () => {
    const size = new Wirecloud.ui.MultiValuedSize(0, 0);
    assert.equal(size.inPixels, 0);
    assert.equal(size.inLU, 0);
});
