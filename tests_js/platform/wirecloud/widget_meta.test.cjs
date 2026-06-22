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

    Wirecloud.URLs = {
        MAC_BASE_URL: {
            evaluate: (opts) => '/mac/' + opts.vendor + '/' + opts.name + '/' + opts.version + '/'
        },
        MISSING_WIDGET_CODE_ENTRY: '/api/missing',
        WIDGET_CODE_ENTRY: {
            evaluate: (opts) => '/api/widget/' + opts.vendor + '/' + opts.name + '/' + opts.version
        }
    };
    Wirecloud.location = { base: 'http://localhost/' };
    Wirecloud.contextManager = { get: (key) => key === 'version_hash' ? 'abc123' : 'default' };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/UserPrefDef.js',
        'src/wirecloud/platform/static/js/wirecloud/PersistentVariableDef.js',
        'src/wirecloud/platform/static/js/wirecloud/MashableApplicationComponent.js',
        'src/wirecloud/platform/static/js/wirecloud/WidgetMeta.js',
    ]);
});

test('WidgetMeta constructor creates widget meta', () => {
    const meta = new Wirecloud.WidgetMeta({
        type: 'widget',
        macversion: 2,
        vendor: 'TestVendor',
        name: 'TestWidget',
        version: '1.0.0',
        title: 'Test Widget',
        preferences: [],
        properties: [],
        requirements: [],
        wiring: {},
        entrypoint: 'TestWidget',
        js_files: ['test.js'],
        contents: { src: '/src/', contenttype: 'text/html' }
    });

    assert.equal(meta.vendor, 'TestVendor');
    assert.equal(meta.name, 'TestWidget');
    assert.equal(meta.type, 'widget');
    assert.equal(meta.macversion, 2);
    assert.ok(meta.codeurl.includes('/api/widget/'));
});

test('WidgetMeta throws on non-widget type', () => {
    assert.throws(
        () => new Wirecloud.WidgetMeta({
            type: 'operator',
            vendor: 'V',
            name: 'N',
            version: '1.0',
            preferences: [],
            properties: [],
            requirements: [],
            wiring: {}
        }),
        /Invalid component type for a widget/
    );
});

test('WidgetMeta with missing=true creates missing widget', () => {
    const meta = new Wirecloud.WidgetMeta({
        vendor: 'V',
        name: 'N',
        version: '1.0',
        missing: true,
        type: 'widget',
        preferences: [],
        properties: [],
        requirements: [],
        wiring: {}
    });

    assert.equal(meta.missing, true);
    assert.ok(meta.codeurl.includes('/api/missing'));
});

test('WidgetMeta throws on missing js_files with macversion > 1', () => {
    assert.throws(
        () => new Wirecloud.WidgetMeta({
            type: 'widget',
            macversion: 2,
            vendor: 'V',
            name: 'N',
            version: '1.0',
            preferences: [],
            properties: [],
            requirements: [],
            wiring: {},
            entrypoint: 'TestWidget',
            contents: { src: '/src/' }
        }),
        /missing js_files attribute in widget description/
    );
});

test('WidgetMeta constructor processes properties', () => {
    const meta = new Wirecloud.WidgetMeta({
        type: 'widget',
        macversion: 1,
        vendor: 'V',
        name: 'N',
        version: '1.0',
        preferences: [],
        properties: [
            { name: 'prop1', type: 'text', label: 'Prop 1' },
            { name: 'prop2', type: 'number', label: 'Prop 2' }
        ],
        requirements: [],
        wiring: {},
        contents: { src: '/src/' }
    });

    assert.equal(meta.propertyList.length, 2);
    assert.equal(meta.properties.prop1.name, 'prop1');
    assert.equal(meta.properties.prop2.name, 'prop2');
    assert.ok(Object.isFrozen(meta.properties));
    assert.ok(Object.isFrozen(meta.propertyList));
});

test('WidgetMeta defaults type to widget when not specified', () => {
    const meta = new Wirecloud.WidgetMeta({
        macversion: 1,
        vendor: 'V',
        name: 'N',
        version: '1.0',
        preferences: [],
        properties: [],
        requirements: [],
        wiring: {},
        contents: { src: '/src/' }
    });
    assert.equal(meta.type, 'widget');
});

test('WidgetMeta getInfoString returns formatted string', () => {
    const meta = new Wirecloud.WidgetMeta({
        type: 'widget',
        macversion: 1,
        vendor: 'TestVendor',
        name: 'TestWidget',
        version: '2.0.0',
        preferences: [],
        properties: [],
        requirements: [],
        wiring: {},
        contents: { src: '/src/' }
    });

    const info = meta.getInfoString();
    assert.ok(info.includes('TestVendor'));
    assert.ok(info.includes('TestWidget'));
    assert.ok(info.includes('2.0.0'));
});
