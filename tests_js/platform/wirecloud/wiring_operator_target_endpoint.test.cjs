const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupWiring = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.wiring = {};
    Wirecloud.GlobalLogManager = { log: () => {} };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/Endpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/SourceEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/EndpointTypeError.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/EndpointValueError.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/OperatorTargetEndpoint.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('OperatorTargetEndpoint constructor with valid meta', () => {
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: false,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const meta = { name: 'input1', label: 'In' };

    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, meta);

    assert.equal(ep.id, 'operator/op1/input1');
    assert.equal(ep.name, 'input1');
    assert.equal(ep.component, fakeOperator);
    assert.equal(ep.meta, meta);
    assert.equal(ep.missing, false);
    assert.equal(ep.callback, null);
});

test('OperatorTargetEndpoint toString returns id', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' }, loaded: false, pending_events: [] };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });

    assert.equal(ep.toString(), 'operator/op1/in');
});

test('OperatorTargetEndpoint toJSON returns correct shape', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' }, loaded: false, pending_events: [] };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });

    const json = ep.toJSON();
    assert.deepEqual(json, { type: 'operator', id: 'op1', endpoint: 'in' });
});

test('OperatorTargetEndpoint getReachableEndpoints', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' }, loaded: false, pending_events: [] };
    const meta = { name: 'in', label: 'Input', description: '' };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, meta);

    const endpoints = ep.getReachableEndpoints();
    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].type, 'operator');
});

test('OperatorTargetEndpoint propagate pushes to pending_events when not loaded', () => {
    const pendingEvents = [];
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: false,
        pending_events: pendingEvents
    };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });

    ep.propagate('data');
    assert.equal(pendingEvents.length, 1);
    assert.equal(pendingEvents[0].endpoint, 'in');
    assert.equal(pendingEvents[0].value, 'data');
});

test('OperatorTargetEndpoint propagate calls callback when loaded', () => {
    let callbackCalledValue = null;
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });
    ep.callback = function (value) { callbackCalledValue = value; };

    ep.propagate('data');
    assert.equal(callbackCalledValue, 'data');
});

test('OperatorTargetEndpoint propagate with no callback logs error', () => {
    const logs = [];
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: true,
        pending_events: [],
        logManager: { log: (msg, opts) => { logs.push(msg); } }
    };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });

    ep.propagate('data');
    assert.ok(logs.length >= 1);
});

test('OperatorTargetEndpoint propagate re-throws EndpointTypeError', () => {
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: true,
        pending_events: [],
        logManager: { log: () => {}, formatException: (e) => e.message }
    };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });
    ep.callback = function () { throw new Wirecloud.wiring.EndpointTypeError('type err'); };

    assert.throws(() => ep.propagate('data'), Wirecloud.wiring.EndpointTypeError);
});

test('OperatorTargetEndpoint propagate with targetEndpoints filter', () => {
    let callbackCalled = false;
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });
    ep.callback = function () { callbackCalled = true; };

    // Matches target
    ep.propagate('data', { targetEndpoints: [{ type: 'operator', id: 'op1', endpoint: 'in' }] });
    assert.equal(callbackCalled, true);
});

test('OperatorTargetEndpoint propagate with non-matching targetEndpoints filter', () => {
    let callbackCalled = false;
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });
    ep.callback = function () { callbackCalled = true; };

    // Does not match target
    ep.propagate('data', { targetEndpoints: [{ type: 'widget', id: 'w99', endpoint: 'other' }] });
    assert.equal(callbackCalled, false);
});

test('OperatorTargetEndpoint propagate with null targetEndpoints bypasses filter', () => {
    let callbackCalled = false;
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });
    ep.callback = function () { callbackCalled = true; };

    ep.propagate('data', { targetEndpoints: null });
    assert.equal(callbackCalled, true);
});

test('OperatorTargetEndpoint propagate with callback throwing generic error logs details', () => {
    const logs = [];
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: true,
        pending_events: [],
        logManager: {
            log: (msg, opts) => { logs.push({ msg, opts }); },
            formatException: (e) => e.message
        }
    };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, { name: 'in' });
    ep.callback = function () { throw new Error('generic error'); };

    ep.propagate('data');
    assert.ok(logs.length >= 1);
});

// --- constructor with null meta (line 43) ---

test('OperatorTargetEndpoint constructor with null meta', () => {
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' },
        loaded: false,
        pending_events: [],
        logManager: { log: () => {} }
    };

    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, null);

    assert.equal(ep.id, null);
    assert.equal(ep.callback, null);
});

// --- getReachableEndpoints with empty actionlabel (line 70) ---

test('OperatorTargetEndpoint getReachableEndpoints uses default label when actionlabel is empty', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' }, loaded: false, pending_events: [] };
    const meta = { name: 'in', label: 'InputLabel', actionlabel: '' };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, meta);

    const endpoints = ep.getReachableEndpoints();
    assert.equal(endpoints.length, 1);
    assert.ok(endpoints[0].actionlabel.includes('InputLabel'), 'should use interpolated default action label');
});

test('OperatorTargetEndpoint getReachableEndpoints with falsy actionlabel uses default', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' }, loaded: false, pending_events: [] };
    const meta = { name: 'in', label: 'InputLabel', actionlabel: null };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, meta);

    const endpoints = ep.getReachableEndpoints();
    assert.equal(endpoints.length, 1);
    assert.ok(endpoints[0].actionlabel.includes('InputLabel'), 'should use interpolated default action label');
});

// --- getReachableEndpoints with non-empty actionlabel (line 70 false branch) ---

test('OperatorTargetEndpoint getReachableEndpoints with non-empty actionlabel preserves it', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' }, loaded: false, pending_events: [] };
    const meta = { name: 'in', label: 'Input', actionlabel: 'Custom Label' };
    const ep = new Wirecloud.wiring.OperatorTargetEndpoint(fakeOperator, meta);

    const endpoints = ep.getReachableEndpoints();
    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].actionlabel, 'Custom Label');
});
