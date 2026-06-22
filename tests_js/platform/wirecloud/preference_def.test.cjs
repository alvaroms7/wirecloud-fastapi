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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/PreferenceDef.js');
});

test('PreferenceDef constructor creates frozen definition', () => {
    const options = {
        label: 'Test Label',
        description: 'Test description',
        defaultValue: 'default-val',
        type: 'text'
    };
    const def = new Wirecloud.PreferenceDef('testPref', true, true, false, options);

    assert.equal(def.name, 'testPref');
    assert.equal(def.label, 'Test Label');
    assert.equal(def.description, 'Test description');
    assert.equal(def.inheritable, true);
    assert.equal(def.inheritByDefault, true);
    assert.equal(def.hidden, false);
    assert.equal(def.default, 'default-val');
    assert.equal(def.options, options);
});

test('PreferenceDef with inheritable=false has inheritByDefault=false', () => {
    const options = {
        label: 'Label',
        description: 'Desc',
        defaultValue: 'x',
        type: 'text'
    };
    const def = new Wirecloud.PreferenceDef('pref', false, true, false, options);

    assert.equal(def.inheritable, false);
    assert.equal(def.inheritByDefault, false);
});

test('PreferenceDef hidden flag works', () => {
    const options = { label: 'L', description: 'D', defaultValue: 'v', type: 'text' };
    const def = new Wirecloud.PreferenceDef('p', false, false, true, options);
    assert.equal(def.hidden, true);
});
