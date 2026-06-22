const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    bootstrapWirecloudVersion,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    bootstrapWirecloudVersion();
    Wirecloud.Utils = StyledElements.Utils;

    global.location = { origin: 'http://localhost' };

    Wirecloud.wiring = {};
    Wirecloud.contextManager = { get: () => 'hash' };
    Wirecloud.URLs = {
        MAC_BASE_URL: {
            evaluate: (opts) => '/mac/' + opts.vendor + '/' + opts.name + '/' + opts.version + '/'
        },
        MISSING_WIDGET_CODE_ENTRY: '/api/missing',
        OPERATOR_ENTRY: {
            evaluate: (opts) => '/api/operator/' + opts.vendor + '/' + opts.name + '/' + opts.version
        }
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/UserPrefDef.js',
        'src/wirecloud/platform/static/js/wirecloud/PersistentVariableDef.js',
        'src/wirecloud/platform/static/js/wirecloud/MashableApplicationComponent.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/OperatorMeta.js',
    ]);
});

test('OperatorMeta constructor creates operator meta', () => {
    const meta = new Wirecloud.wiring.OperatorMeta({
        type: 'operator',
        macversion: 2,
        vendor: 'TestVendor',
        name: 'TestOp',
        version: '1.0.0',
        title: 'Test Operator',
        preferences: [],
        properties: [],
        requirements: [],
        wiring: {},
        entrypoint: 'TestOp',
        js_files: ['test.js']
    });

    assert.equal(meta.vendor, 'TestVendor');
    assert.equal(meta.name, 'TestOp');
    assert.equal(meta.type, 'operator');
    assert.equal(meta.macversion, 2);
    assert.ok(meta.codeurl.includes('/api/operator/'));
});

test('OperatorMeta throws on non-operator type', () => {
    assert.throws(
        () => new Wirecloud.wiring.OperatorMeta({
            type: 'widget',
            vendor: 'V',
            name: 'N',
            version: '1.0',
            preferences: [],
            properties: [],
            requirements: [],
            wiring: {}
        }),
        /Invalid component type for a operator/
    );
});

test('OperatorMeta with missing=true', () => {
    const meta = new Wirecloud.wiring.OperatorMeta({
        vendor: 'V',
        name: 'N',
        version: '1.0',
        type: 'operator',
        missing: true,
        preferences: [],
        properties: [],
        requirements: [],
        wiring: {}
    });

    assert.equal(meta.missing, true);
    assert.equal(meta.macversion, undefined);
});

test('OperatorMeta default type is operator', () => {
    const meta = new Wirecloud.wiring.OperatorMeta({
        vendor: 'V',
        name: 'N',
        version: '1.0',
        macversion: 2,
        preferences: [],
        properties: [],
        requirements: [],
        wiring: {},
        entrypoint: 'Op',
        js_files: ['a.js']
    });

    assert.equal(meta.type, 'operator');
});

test('OperatorMeta throws when missing js_files for macversion > 1', () => {
    assert.throws(
        () => new Wirecloud.wiring.OperatorMeta({
            type: 'operator',
            vendor: 'V',
            name: 'N',
            version: '1.0',
            macversion: 2,
            preferences: [],
            properties: [],
            requirements: [],
            wiring: {},
            entrypoint: 'Op'
        }),
        /missing js_files attribute/
    );
});

test('OperatorMeta constructor processes properties', () => {
    const meta = new Wirecloud.wiring.OperatorMeta({
        type: 'operator',
        vendor: 'TestVendor',
        name: 'TestOp',
        version: '1.0',
        macversion: 2,
        preferences: [],
        properties: [{ name: 'prop1', type: 'text', label: 'Prop1', description: 'desc', default: 'default' }],
        requirements: [],
        wiring: {},
        entrypoint: 'Op',
        js_files: ['a.js']
    });

    assert.ok(meta.properties.prop1);
    assert.equal(meta.propertyList.length, 1);
    assert.equal(meta.propertyList[0].name, 'prop1');
});
