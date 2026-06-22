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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/PreferencesDef.js');
});

test('PreferencesDef stores definitions', () => {
    const definitions = { theme: {}, lang: {} };
    const def = new Wirecloud.PreferencesDef(definitions);

    assert.ok(def.preferences);
    assert.equal(def.preferences, definitions);
});

test('PreferencesDef with no arguments returns without preferences', () => {
    const def = new Wirecloud.PreferencesDef();
    assert.equal(def.preferences, undefined);
});
