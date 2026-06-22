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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/UserPrefDef.js');
});

test('UserPrefDef creates definition with string type', () => {
    const def = new Wirecloud.UserPrefDef({
        name: 'title',
        type: 'text',
        label: 'Title',
        description: 'Widget title',
        required: false,
        secure: false,
        default: 'My Widget'
    });

    assert.equal(def.name, 'title');
    assert.equal(def.type, 'text');
    assert.equal(def.label, 'Title');
    assert.equal(def.description, 'Widget title');
    assert.equal(def.required, false);
    assert.equal(def.secure, false);
    assert.equal(def.default, 'My Widget');
});

test('UserPrefDef coerces boolean default', () => {
    const defTrue = new Wirecloud.UserPrefDef({
        name: 'flag',
        type: 'boolean',
        label: 'Flag',
        description: 'A flag',
        default: 'true'
    });
    assert.equal(defTrue.default, true);

    const defFalse = new Wirecloud.UserPrefDef({
        name: 'flag',
        type: 'boolean',
        label: 'Flag',
        description: 'A flag',
        default: 'false'
    });
    assert.equal(defFalse.default, false);
});

test('UserPrefDef coerces number default', () => {
    const def = new Wirecloud.UserPrefDef({
        name: 'count',
        type: 'number',
        label: 'Count',
        description: 'Count value',
        default: '42'
    });
    assert.equal(def.default, 42);
});

test('UserPrefDef with list type maps to select', () => {
    const def = new Wirecloud.UserPrefDef({
        name: 'options',
        type: 'list',
        label: 'Options',
        description: 'Options list',
        default: 'a'
    });
    assert.equal(def.type, 'select');
});

test('UserPrefDef with no default', () => {
    const def = new Wirecloud.UserPrefDef({
        name: 'opt',
        type: 'text',
        label: 'Opt',
        description: 'Option'
    });
    assert.equal(def.default, '');
});

test('UserPrefDef rejects invalid options parameter', () => {
    assert.throws(() => new Wirecloud.UserPrefDef(null), /Invalid options parameter/);
    assert.throws(() => new Wirecloud.UserPrefDef('string'), /Invalid options parameter/);
    assert.throws(() => new Wirecloud.UserPrefDef(42), /Invalid options parameter/);
});

test('UserPrefDef rejects invalid default option type', () => {
    assert.throws(() => new Wirecloud.UserPrefDef({
        name: 'x',
        type: 'text',
        label: 'X',
        description: 'X',
        default: 42
    }), /Invalid default option/);
});
