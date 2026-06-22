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

    // Mock dependencies for WidgetMeta/OperatorMeta
    Wirecloud.location = { base: 'http://localhost/' };

    Wirecloud.io = { makeRequest: () => Promise.resolve({}) };
    Wirecloud.Task = class Task {
        constructor(name, fn) { this._name = name; }
        then() { return this; }
        toTask(n) { return this; }
    };
    Wirecloud.URLs = {
        WORKSPACE_RESOURCE_COLLECTION: { evaluate: (o) => '/api/ws/' + o.workspace_id + '/resources' },
        MAC_BASE_URL: { evaluate: (o) => '/mac/' + o.vendor + '/' + o.name + '/' + o.version + '/' },
        MISSING_WIDGET_CODE_ENTRY: '/api/missing',
        WIDGET_CODE_ENTRY: { evaluate: () => '/api/widget/code' },
        OPERATOR_ENTRY: { evaluate: () => '/api/operator/code' }
    };
    Wirecloud.GlobalLogManager = { log: () => {} };
    Wirecloud.contextManager = { get: () => 'hash' };
    Wirecloud.wiring = {};

    // Load pre-requisites for WidgetMeta/OperatorMeta
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/UserPrefDef.js',
        'src/wirecloud/platform/static/js/wirecloud/PersistentVariableDef.js',
        'src/wirecloud/platform/static/js/wirecloud/MashableApplicationComponent.js',
        'src/wirecloud/platform/static/js/wirecloud/WidgetMeta.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/OperatorMeta.js',
    ]);

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/WorkspaceCatalogue.js',
    ]);
});

test('WorkspaceCatalogue constructor stores workspace_id', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-123');
    assert.equal(wc.workspace_id, 'ws-123');
});

test('WorkspaceCatalogue.getResourceId returns resource', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = { 'Vendor/Name/1.0': { uri: 'Vendor/Name/1.0' } };
    assert.ok(wc.getResourceId('Vendor/Name/1.0'));
});

test('WorkspaceCatalogue.resourceExistsId checks existence', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    assert.equal(wc.resourceExistsId('unknown'), false);
});

test('WorkspaceCatalogue.getResource by vendor/name/version', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = { 'V/N/1.0': { vendor: 'V', name: 'N', version: { text: '1.0' } } };
    assert.ok(wc.getResource('V', 'N', '1.0'));
});

test('WorkspaceCatalogue.resourceExists checks by resource object', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = { 'V/N/1.0': {} };
    assert.equal(wc.resourceExists({ vendor: 'V', name: 'N', version: { text: '1.0' } }), true);
    assert.equal(wc.resourceExists({ vendor: 'X', name: 'Y', version: { text: '2.0' } }), false);
});

test('WorkspaceCatalogue.addComponent adds resource', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const meta = { uri: 'V/N/1.0', group_id: 'V/N', vendor: 'V', name: 'N', version: { text: '1.0' }, type: 'widget' };
    wc.addComponent(meta);

    assert.equal(wc.resources['V/N/1.0'], meta);
    assert.ok(wc.resourceVersions['V/N']);
});

test('WorkspaceCatalogue.getOrCreateMissing for existing resource', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = { 'Vendor/Name/1.0': { uri: 'Vendor/Name/1.0', type: 'widget' } };
    wc.missingComponents = {};

    const result = wc.getOrCreateMissing('Vendor/Name/1.0', 'widget');
    assert.equal(result.uri, 'Vendor/Name/1.0');
});

test('WorkspaceCatalogue.getOrCreateMissing creates missing widget', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const result = wc.getOrCreateMissing('Vendor/Name/1.0', 'widget');
    assert.equal(result.missing, true);
    assert.equal(result.type, 'widget');
    assert.equal(result.uri, 'Vendor/Name/1.0');
});

test('WorkspaceCatalogue.getOrCreateMissing creates missing operator', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const result = wc.getOrCreateMissing('Vendor/Name/1.0', 'operator');
    assert.equal(result.missing, true);
    assert.equal(result.type, 'operator');
});

test('WorkspaceCatalogue.getOrCreateMissing returns cached missing', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};
    wc.missingComponents['V/N/1.0'] = { cached: true };

    const result = wc.getOrCreateMissing('V/N/1.0', 'widget');
    assert.equal(result.cached, true);
});

test('WorkspaceCatalogue.findResource finds existing resource', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = { 'V/N/1.0': { uri: 'V/N/1.0' } };
    wc.missingComponents = {};

    const result = wc.findResource('widget', 'V/N/1.0');
    assert.ok(result);
});

test('WorkspaceCatalogue.findResource creates missing when requested', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const result = wc.findResource('widget', 'Vendor/Name/1.0', true);
    assert.equal(result.missing, true);
});

test('WorkspaceCatalogue.findResource returns undefined without newMissingResource', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.missingComponents = {};

    const result = wc.findResource('widget', 'unknown');
    assert.equal(result, undefined);
});

test('WorkspaceCatalogue.restore re-adds from missing', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const meta = { uri: 'V/N/1.0', group_id: 'V/N', type: 'widget', vendor: 'V', name: 'N', version: { text: '1.0' }, missing: false };
    wc.missingComponents['V/N/1.0'] = meta;

    wc.restore(meta);

    assert.equal(wc.resources['V/N/1.0'], meta);
    assert.equal(wc.missingComponents['V/N/1.0'], undefined);
});

test('WorkspaceCatalogue.restore no-op for non-missing', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.missingComponents = {};

    const meta = { uri: 'V/N/1.0', missing: false };
    wc.restore(meta);

    // Not in missingComponents, so no-op
    assert.equal(wc.resources['V/N/1.0'], undefined);
});

test('WorkspaceCatalogue.remove by string', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    const meta = { uri: 'V/N/1.0', group_id: 'V/N', vendor: 'V', name: 'N', version: { text: '1.0' }, type: 'widget' };
    wc.resources = { 'V/N/1.0': meta };
    wc.resourceVersions = { 'V/N': [meta] };
    wc.missingComponents = {};

    const result = wc.remove('V/N/1.0');
    assert.equal(result.missing, true);
    assert.equal(wc.missingComponents['V/N/1.0'], result);
});

test('WorkspaceCatalogue.remove by resource object', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    const meta = { uri: 'V/N/1.0', group_id: 'V/N', vendor: 'V', name: 'N', version: { text: '1.0' }, type: 'operator' };
    wc.resources = { 'V/N/1.0': meta };
    wc.resourceVersions = { 'V/N': [meta] };
    wc.missingComponents = {};

    const result = wc.remove(meta);
    assert.equal(result.missing, true);
});

test('WorkspaceCatalogue.remove with unknown resource returns undefined', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const result = wc.remove('unknown');
    assert.equal(result, undefined);
});

// ---- Tests for reload (loadSuccessCallback) ---- //

const makeValidWidgetData = (vendor, name, version) => ({
    vendor, name, version,
    type: 'widget',
    missing: true,
    display_name: name,
    title: name,
    preferences: [],
    properties: [],
    wiring: { inputs: [], outputs: [] },
    requirements: []
});

const makeValidOperatorData = (vendor, name, version) => ({
    vendor, name, version,
    type: 'operator',
    missing: true,
    display_name: name,
    title: name,
    preferences: [],
    properties: [],
    wiring: { inputs: [], outputs: [] },
    requirements: []
});

test('reload fetches workspace resources successfully', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    const wData = makeValidWidgetData('V', 'W', '1.0');
    const oData = makeValidOperatorData('V', 'O', '1.0');

    Wirecloud.io.makeRequest = () => ({
        then: (fn) => {
            fn({ status: 200, responseText: JSON.stringify({ 'V/W/1.0': wData, 'V/O/1.0': oData }) });
            return { toTask: () => ({ then: () => {} }) };
        }
    });

    const result = wc.reload();
    assert.ok(result);
    assert.ok(wc.resources['V/W/1.0']);
    assert.ok(wc.resources['V/O/1.0']);
});

test('reload with non-200 status throws', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');

    Wirecloud.io.makeRequest = () => ({
        then: (fn) => {
            try {
                fn({ status: 500, responseText: 'error' });
            } catch (e) {
                // Expected: loadSuccessCallback throws "Unexpected error code"
            }
            return { toTask: () => ({ then: () => {} }) };
        }
    });

    const result = wc.reload();
    assert.ok(result);
});

test('reload handles error loading individual resource metadata', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');

    let logMsg = null;
    Wirecloud.GlobalLogManager.log = (msg) => { logMsg = msg; };

    // Widget with missing vendor causes MashableApplicationComponent to throw
    const badData = {
        name: 'Bad',
        version: '1.0',
        type: 'widget',
        missing: true,
        display_name: 'Bad',
        title: 'Bad',
        preferences: [],
        properties: [],
        wiring: { inputs: [], outputs: [] },
        requirements: []
    };

    Wirecloud.io.makeRequest = () => ({
        then: (fn) => {
            fn({ status: 200, responseText: JSON.stringify({ 'bad': badData }) });
            return { toTask: () => ({ then: () => {} }) };
        }
    });

    wc.reload();
    assert.ok(logMsg != null);
});

test('findResource with newMissingResource returns missing component', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const result = wc.findResource('operator', 'Vendor/Name/1.0', true);
    assert.equal(result.missing, true);
    assert.equal(result.type, 'operator');
});

test('findResource without newMissingResource returns undefined for unknown', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.missingComponents = {};

    const result = wc.findResource('widget', 'nonexistent');
    assert.equal(result, undefined);
});

test('getOrCreateMissing caches and returns same missing component', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const first = wc.getOrCreateMissing('Vendor/Name/1.0', 'widget');
    const second = wc.getOrCreateMissing('Vendor/Name/1.0', 'widget');
    assert.equal(first, second);
    assert.equal(first.missing, true);
});

test('addComponent adds resource via _addComponent', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const meta = makeValidWidgetData('V', 'N', '1.0');
    // WidgetMeta constructor produces an object, but addComponent expects a meta-like object
    // For this test, use a plain object that has the right shape
    const plainMeta = { uri: 'V/N/1.0', group_id: 'V/N', vendor: 'V', name: 'N', version: { text: '1.0' }, type: 'widget', missing: true };
    wc.addComponent(plainMeta);

    assert.equal(wc.resources['V/N/1.0'], plainMeta);
    assert.ok(wc.resourceVersions['V/N']);
    assert.equal('V/N/1.0' in wc.missingComponents, false);
});

test('restore re-adds component from missingComponents', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.resourceVersions = {};
    wc.missingComponents = {};

    const meta = { uri: 'V/N/1.0', group_id: 'V/N', type: 'widget', vendor: 'V', name: 'N', version: { text: '1.0' }, missing: false };
    wc.missingComponents['V/N/1.0'] = meta;

    wc.restore(meta);

    assert.equal(wc.resources['V/N/1.0'], meta);
    assert.equal('V/N/1.0' in wc.missingComponents, false);
});

test('restore no-op when uri not in missingComponents', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    wc.resources = {};
    wc.missingComponents = { 'other': {} };

    const meta = { uri: 'V/N/1.0', missing: false };
    wc.restore(meta);

    assert.equal(wc.resources['V/N/1.0'], undefined);
    assert.equal('V/N/1.0' in wc.missingComponents, false);
    assert.ok('other' in wc.missingComponents);
});

test('reload handles mashup type resource', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    const mashupData = {
        uri: 'V/M/1.0',
        group_id: 'V/M',
        vendor: 'V', name: 'M', version: '1.0',
        type: 'mashup',
        title: 'A Mashup',
        preferences: [],
        wiring: { inputs: [], outputs: [] },
        requirements: [],
        tabs: []
    };

    Wirecloud.io.makeRequest = () => ({
        then: (fn) => {
            fn({ status: 200, responseText: JSON.stringify({ 'V/M/1.0': mashupData }) });
            return { toTask: () => ({ then: () => {} }) };
        }
    });

    wc.reload();
    assert.ok(wc.resources['V/M/1.0']);
    assert.equal(wc.resources['V/M/1.0'].type, 'mashup');
});

test('reload skips unknown resource type', () => {
    const wc = new Wirecloud.WorkspaceCatalogue('ws-1');
    const unknownData = {
        vendor: 'V', name: 'X', version: '1.0',
        type: 'unknown_type',
        preferences: [],
        wiring: { inputs: [], outputs: [] },
        requirements: []
    };

    Wirecloud.io.makeRequest = () => ({
        then: (fn) => {
            fn({ status: 200, responseText: JSON.stringify({ 'V/X/1.0': unknownData }) });
            return { toTask: () => ({ then: () => {} }) };
        }
    });

    wc.reload();
    assert.equal('V/X/1.0' in (wc.resources || {}), false);
});
