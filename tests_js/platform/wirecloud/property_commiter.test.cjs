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
    Wirecloud.Utils = StyledElements.Utils;

    // Mock URLs and io
    Wirecloud.URLs = {
        IWIDGET_PROPERTIES: { evaluate: () => '/api/widget/props' },
        WIRING_ENTRY: { evaluate: () => '/api/wiring' }
    };
    Wirecloud.io = { makeRequest: () => {} };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PropertyCommiter.js',
    ]);
});

test('PropertyCommiter constructor initializes with component', () => {
    const component = { id: 'c1', meta: { type: 'widget' } };
    const pc = new Wirecloud.PropertyCommiter(component);

    assert.equal(pc.component, component);
    assert.deepEqual(pc.values, {});
    assert.equal(pc.pending_values, null);
    assert.equal(pc.timeout, null);
});

test('PropertyCommiter.add clears existing timeout', () => {
    const component = { id: 'c1', meta: { type: 'widget' } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.commit = function() {};

    let cleared = false;
    const origClearTimeout = global.clearTimeout;
    global.clearTimeout = (t) => { cleared = true; origClearTimeout(t); };

    try {
        pc.add('prop1', 'val1');
        const firstTimeout = pc.timeout;
        assert.ok(firstTimeout !== null);

        pc.add('prop2', 'val2');
        assert.ok(cleared);
        assert.ok(pc.timeout !== firstTimeout);
    } finally {
        global.clearTimeout = origClearTimeout;
    }
});

test('PropertyCommiter.add stores value when no pending', () => {
    const component = { id: 'c1', meta: { type: 'widget' } };
    const pc = new Wirecloud.PropertyCommiter(component);

    // Clear any pending by making commit a no-op
    pc.commit = function() {};

    pc.add('prop1', 'val1');

    assert.equal(pc.values['prop1'], 'val1');
    assert.ok(pc.timeout !== null);
});

test('PropertyCommiter.add stores to pending when pending_values exists', () => {
    const component = { id: 'c1', meta: { type: 'widget' } };
    const pc = new Wirecloud.PropertyCommiter(component);

    pc.pending_values = { existing: 'old' };
    pc.add('prop1', 'val1');

    assert.equal(pc.pending_values['prop1'], 'val1');
    assert.equal(pc.values['prop1'], undefined);
});

test('PropertyCommiter.commit with no values clears timeout but does not set to null', () => {
    const component = { id: 'c1', meta: { type: 'widget' } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.timeout = setTimeout(() => {}, 10000);

    pc.commit();

    // clearTimeout is called but timeout is not set to null when returning early
    // The Timeout object still references the cleared timeout
    assert.ok(pc.timeout !== null);
    clearTimeout(pc.timeout);
    assert.deepEqual(pc.values, {});
});

test('PropertyCommiter.commit sends widget properties via makeRequest', () => {
    const component = { id: 'c1', meta: { type: 'widget' }, tab: { workspace: { id: 'ws1' }, id: 'tab1' } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.values = { prop1: 'val1' };
    pc.timeout = null;

    let capturedUrl, capturedOpts;
    Wirecloud.io.makeRequest = function (url, options) {
        capturedUrl = url;
        capturedOpts = options;
    };

    pc.commit();

    assert.ok(capturedUrl.includes('/api/widget/props'));
    assert.equal(capturedOpts.contentType, 'application/json');
    assert.equal(capturedOpts.postBody, '{"prop1":"val1"}');
    assert.equal(typeof capturedOpts.onSuccess, 'function');
    assert.equal(typeof capturedOpts.onFailure, 'function');
});

test('commitWidgetProperties onSuccess replaces values with pending_values', () => {
    const component = { id: 'c1', meta: { type: 'widget' }, tab: { workspace: { id: 'ws1' }, id: 'tab1' } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.values = { prop1: 'val1' };
    pc.timeout = null;

    let onSuccess;
    Wirecloud.io.makeRequest = function (url, options) {
        onSuccess = options.onSuccess;
    };

    pc.commit();

    pc.pending_values = { prop2: 'val2' };
    onSuccess();

    assert.deepEqual(pc.values, { prop2: 'val2' });
    assert.equal(pc.pending_values, null);
});

test('commitWidgetProperties onSuccess sets timeout when pending values are non-empty', () => {
    const component = { id: 'c1', meta: { type: 'widget' }, tab: { workspace: { id: 'ws1' }, id: 'tab1' } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.values = { prop1: 'val1' };
    pc.timeout = null;

    let onSuccess;
    Wirecloud.io.makeRequest = function (url, options) {
        onSuccess = options.onSuccess;
    };

    pc.commit();

    pc.pending_values = { prop2: 'val2' };
    onSuccess();

    assert.ok(pc.timeout !== null);
    clearTimeout(pc.timeout);
});

test('commitWidgetProperties onFailure merges values and schedules retry', () => {
    const component = { id: 'c1', meta: { type: 'widget' }, tab: { workspace: { id: 'ws1' }, id: 'tab1' } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.values = { prop1: 'val1' };
    pc.timeout = null;

    let onFailure;
    Wirecloud.io.makeRequest = function (url, options) {
        onFailure = options.onFailure;
    };

    pc.commit();

    pc.pending_values = { prop2: 'val2' };
    onFailure();

    assert.deepEqual(pc.values, { prop1: 'val1', prop2: 'val2' });
    assert.ok(pc.timeout !== null);
    clearTimeout(pc.timeout);
});

test('PropertyCommiter.commit sends operator properties via PATCH request', () => {
    const component = { id: 'op1', meta: { type: 'operator' }, wiring: { workspace: { id: 'ws1' } } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.values = { p1: 'v1', p2: 'v2' };
    pc.timeout = null;

    let capturedUrl, capturedOpts;
    Wirecloud.io.makeRequest = function (url, options) {
        capturedUrl = url;
        capturedOpts = options;
    };

    pc.commit();

    assert.equal(capturedUrl, '/api/wiring');
    assert.equal(capturedOpts.method, 'PATCH');
    assert.equal(capturedOpts.contentType, 'application/json-patch+json');

    const body = JSON.parse(capturedOpts.postBody);
    assert.equal(body.length, 2);
    assert.deepEqual(body[0], { op: 'replace', path: '/operators/op1/properties/p1/value', value: 'v1' });
    assert.deepEqual(body[1], { op: 'replace', path: '/operators/op1/properties/p2/value', value: 'v2' });
});

test('commitOperatorProperties onSuccess replaces values with pending_values', () => {
    const component = { id: 'op1', meta: { type: 'operator' }, wiring: { workspace: { id: 'ws1' } } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.values = { p1: 'v1' };
    pc.timeout = null;

    let onSuccess;
    Wirecloud.io.makeRequest = function (url, options) {
        onSuccess = options.onSuccess;
    };

    pc.commit();

    pc.pending_values = { p2: 'v2' };
    onSuccess();

    assert.deepEqual(pc.values, { p2: 'v2' });
    assert.equal(pc.pending_values, null);
});

test('commitOperatorProperties onFailure merges values and schedules retry', () => {
    const component = { id: 'op1', meta: { type: 'operator' }, wiring: { workspace: { id: 'ws1' } } };
    const pc = new Wirecloud.PropertyCommiter(component);
    pc.values = { p1: 'v1' };
    pc.timeout = null;

    let onFailure;
    Wirecloud.io.makeRequest = function (url, options) {
        onFailure = options.onFailure;
    };

    pc.commit();

    pc.pending_values = { p2: 'v2' };
    onFailure();

    assert.deepEqual(pc.values, { p1: 'v1', p2: 'v2' });
    assert.ok(pc.timeout !== null);
    clearTimeout(pc.timeout);
});
