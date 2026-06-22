const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
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
        'src/wirecloud/platform/static/js/wirecloud/PersistentVariableDef.js',
        'src/wirecloud/platform/static/js/wirecloud/PersistentVariable.js',
    ]);
});

test('PersistentVariableDef creates definition', () => {
    const def = new Wirecloud.PersistentVariableDef({
        name: 'prop1',
        type: 'text',
        label: 'Prop 1',
        description: 'A property',
        multiuser: false,
        secure: false,
        default: 'default-value'
    });

    assert.equal(def.name, 'prop1');
    assert.equal(def.type, 'text');
    assert.equal(def.label, 'Prop 1');
    assert.equal(def.description, 'A property');
    assert.equal(def.multiuser, false);
    assert.equal(def.secure, false);
    assert.equal(def.default, 'default-value');
});

test('PersistentVariableDef rejects invalid options', () => {
    assert.throws(() => new Wirecloud.PersistentVariableDef(null), /Invalid options parameter/);
    assert.throws(() => new Wirecloud.PersistentVariableDef('string'), /Invalid options parameter/);
});

test('PersistentVariableDef rejects invalid default', () => {
    assert.throws(() => new Wirecloud.PersistentVariableDef({
        name: 'x', type: 'text', label: 'X', description: 'X', default: 123
    }), /Invalid default option/);
});

test('PersistentVariable constructor creates variable', () => {
    const def = new Wirecloud.PersistentVariableDef({
        name: 'prop1', type: 'text', label: 'P', description: 'P'
    });
    const commiter = { add: () => {} };
    const pv = new Wirecloud.PersistentVariable(def, commiter, false, 'value1');

    assert.equal(pv.meta, def);
    assert.equal(pv.readonly, false);
    assert.equal(pv.commiter, commiter);
    assert.equal(pv.value, 'value1');
});

test('PersistentVariable get returns value', () => {
    const def = new Wirecloud.PersistentVariableDef({
        name: 'p', type: 'text', label: 'P', description: 'P'
    });
    const pv = new Wirecloud.PersistentVariable(def, { add: () => {} }, false, 'val');

    assert.equal(pv.get(), 'val');
});

test('PersistentVariable set updates value and notifies commiter', () => {
    const def = new Wirecloud.PersistentVariableDef({
        name: 'p', type: 'text', label: 'P', description: 'P'
    });
    const commits = [];
    const commiter = { add: (name, val) => commits.push({ name, val }) };

    const pv = new Wirecloud.PersistentVariable(def, commiter, false, 'old');
    pv.set('new');

    assert.equal(pv.value, 'new');
    assert.equal(commits.length, 1);
    assert.equal(commits[0].name, 'p');
    assert.equal(commits[0].val, 'new');
});

test('PersistentVariable set throws when readonly', () => {
    const def = new Wirecloud.PersistentVariableDef({
        name: 'p', type: 'text', label: 'P', description: 'P'
    });
    const pv = new Wirecloud.PersistentVariable(def, { add: () => {} }, true, 'val');

    assert.throws(() => pv.set('new'), /Read only properties cannot be modified/);
});

test('PersistentVariable rejects invalid meta', () => {
    assert.throws(() => new Wirecloud.PersistentVariable(null, {}, false, 'v'), /invalid meta parameter/);
    assert.throws(() => new Wirecloud.PersistentVariable({}, {}, false, 'v'), /invalid meta parameter/);
});
