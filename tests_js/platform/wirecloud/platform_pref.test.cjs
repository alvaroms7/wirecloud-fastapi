const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupPrefs = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;

    // Mock InputInterfaceFactory
    Wirecloud.ui = { InputInterfaceFactory: {
        parse: (type, value) => value,
        stringify: (type, value) => value
    }};

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PlatformPref.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupPrefs();
});

test('PlatformPref constructor with value', () => {
    const prefDef = { name: 'theme', options: { type: 'text' }, default: 'default' };
    const manager = { getParentValue: () => {} };

    const pref = new Wirecloud.PlatformPref(manager, prefDef, false, 'dark');

    assert.equal(pref.meta, prefDef);
    assert.equal(pref.manager, manager);
    assert.equal(pref.inherit, false);
    assert.equal(pref.value, 'dark');
    assert.deepEqual(pref.handlers, []);
});

test('PlatformPref constructor with null value uses default', () => {
    const prefDef = { name: 'theme', options: { type: 'text' }, default: 'light' };
    const manager = {};

    const pref = new Wirecloud.PlatformPref(manager, prefDef, false, null);

    assert.equal(pref.value, 'light');
});

test('PlatformPref getEffectiveValue returns own value when not inheriting', () => {
    const prefDef = { name: 'theme', options: { type: 'text' }, default: 'light' };
    const manager = {};
    const pref = new Wirecloud.PlatformPref(manager, prefDef, false, 'dark');

    assert.equal(pref.getEffectiveValue(), 'dark');
});

test('PlatformPref getEffectiveValue returns parent value when inheriting', () => {
    const prefDef = { name: 'theme', options: { type: 'text' }, default: 'light' };
    const manager = { getParentValue: () => 'parent-value' };
    const pref = new Wirecloud.PlatformPref(manager, prefDef, true, 'dark');

    assert.equal(pref.getEffectiveValue(), 'parent-value');
});

test('PlatformPref addHandler adds handler', () => {
    const prefDef = { name: 't', options: { type: 'text' }, default: 'x' };
    const pref = new Wirecloud.PlatformPref({}, prefDef, false, 'v');
    const handler = () => {};

    pref.addHandler(handler);

    assert.deepEqual(pref.handlers, [handler]);
});

test('PlatformPref _propagate calls handlers', () => {
    const prefDef = { name: 't', options: { type: 'text' }, default: 'x' };
    const pref = new Wirecloud.PlatformPref({}, prefDef, false, 'v');
    const calls = [];
    pref.scope = 'workspace';
    pref.name = 'theme';

    pref.addHandler((scope, name, value) => { calls.push({ scope, name, value }); });
    pref.addHandler((scope, name, value) => { calls.push({ scope, name, value }); });

    pref._propagate();

    assert.equal(calls.length, 2);
    assert.equal(calls[0].scope, 'workspace');
    assert.equal(calls[1].name, 'theme');
});

test('PlatformPref _propagate swallows handler errors', () => {
    const prefDef = { name: 't', options: { type: 'text' }, default: 'x' };
    const pref = new Wirecloud.PlatformPref({}, prefDef, false, 'v');
    let secondCalled = false;

    pref.addHandler(() => { throw new Error('fail'); });
    pref.addHandler(() => { secondCalled = true; });

    pref._propagate();

    assert.equal(secondCalled, true);
});

test('PlatformPref setDefaultValue calls definition inputInterface', () => {
    const prefDef = { name: 't', options: { type: 'text' }, default: 'x' };
    const pref = new Wirecloud.PlatformPref({}, prefDef, false, 'v');
    let setValueCalled = null;

    pref.definition = {
        inputInterface: {
            getDefaultValue: () => 'default-from-def'
        }
    };
    pref.setValue = (val) => { setValueCalled = val; };

    pref.setDefaultValue();
    assert.equal(setValueCalled, 'default-from-def');
});
