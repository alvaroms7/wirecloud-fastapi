const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/UserPrefDef.js',
        'src/wirecloud/platform/static/js/wirecloud/UserPref.js',
    ]);
});

test('UserPref creates with string value', () => {
    const meta = new Wirecloud.UserPrefDef({
        name: 'title', type: 'text', label: 'Title',
        description: 'Widget title', default: 'Default'
    });
    const pref = new Wirecloud.UserPref(meta, false, false, 'Custom Title');

    assert.equal(pref.meta, meta);
    assert.equal(pref.readonly, false);
    assert.equal(pref.hidden, false);
    assert.equal(pref.value, 'Custom Title');
});

test('UserPref uses default when no value provided', () => {
    const meta = new Wirecloud.UserPrefDef({
        name: 'x', type: 'text', label: 'X', description: 'X',
        default: 'hello'
    });
    const pref = new Wirecloud.UserPref(meta, false, false, meta.default);

    assert.equal(pref.value, 'hello');
});

test('UserPref coerces boolean from string', () => {
    const meta = new Wirecloud.UserPrefDef({
        name: 'flag', type: 'boolean', label: 'Flag',
        description: 'Flag', default: 'false'
    });
    const prefTrue = new Wirecloud.UserPref(meta, false, false, 'true');
    assert.equal(prefTrue.value, true);

    const prefFalse = new Wirecloud.UserPref(meta, false, false, 'false');
    assert.equal(prefFalse.value, false);
});

test('UserPref coerces number from string', () => {
    const meta = new Wirecloud.UserPrefDef({
        name: 'num', type: 'number', label: 'Num',
        description: 'Num', default: '0'
    });
    const pref = new Wirecloud.UserPref(meta, false, false, '42');
    assert.equal(pref.value, 42);
});

test('UserPref readonly and hidden flags', () => {
    const meta = new Wirecloud.UserPrefDef({
        name: 'secret', type: 'text', label: 'Secret',
        description: 'Secret', default: ''
    });
    const pref = new Wirecloud.UserPref(meta, true, true, 'hidden');
    assert.equal(pref.readonly, true);
    assert.equal(pref.hidden, true);
});

test('UserPref rejects invalid meta parameter', () => {
    assert.throws(
        () => new Wirecloud.UserPref(null, false, false, 'val'),
        /invalid meta parameter/
    );
    assert.throws(
        () => new Wirecloud.UserPref({}, false, false, 'val'),
        /invalid meta parameter/
    );
});

test('getInterfaceDescription returns correct description for text type', () => {
    const meta = new Wirecloud.UserPrefDef({
        name: 'title', type: 'text', label: 'Title',
        description: 'Widget title', default: 'Default'
    });
    const pref = new Wirecloud.UserPref(meta, false, false, 'Custom');

    const desc = pref.getInterfaceDescription();
    assert.equal(desc.type, 'text');
    assert.equal(desc.label, 'Title');
    assert.equal(desc.description, 'Widget title');
    assert.equal(desc.defaultValue, 'Default');
    assert.equal(desc.initiallyDisabled, false);
    assert.equal(desc.initialValue, 'Custom');
});

test('getInterfaceDescription for select type includes options', () => {
    const meta = new Wirecloud.UserPrefDef({
        name: 'color', type: 'select', label: 'Color',
        description: 'Color', options: [{value: 'red', label: 'Red'}]
    });
    const pref = new Wirecloud.UserPref(meta, false, false, 'red');

    const desc = pref.getInterfaceDescription();
    assert.equal(desc.type, 'select');
    assert.equal(desc.required, true);
    assert.ok(desc.initialEntries);
});
