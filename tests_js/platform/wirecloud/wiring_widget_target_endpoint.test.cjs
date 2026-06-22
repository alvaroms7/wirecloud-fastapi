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
        'src/wirecloud/platform/static/js/wirecloud/wiring/WidgetTargetEndpoint.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('WidgetTargetEndpoint constructor with valid meta', () => {
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'My Widget',
        loaded: false,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const meta = { name: 'input1', label: 'In', description: 'Input ep' };

    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, meta);

    assert.equal(ep.id, 'widget/w1/input1');
    assert.equal(ep.name, 'input1');
    assert.equal(ep.component, fakeWidget);
    assert.equal(ep.meta, meta);
    assert.equal(ep.missing, false);
    assert.equal(ep.callback, null);
});

test('WidgetTargetEndpoint toString returns id', () => {
    const fakeWidget = { id: 'w1', meta: { type: 'widget' }, title: 'W', loaded: false, pending_events: [] };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });

    assert.equal(ep.toString(), 'widget/w1/in');
});

test('WidgetTargetEndpoint toJSON returns correct shape', () => {
    const fakeWidget = { id: 'w1', meta: { type: 'widget' }, title: 'W', loaded: false, pending_events: [] };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });

    const json = ep.toJSON();
    assert.deepEqual(json, { type: 'widget', id: 'w1', endpoint: 'in' });
});

test('WidgetTargetEndpoint getReachableEndpoints with actionlabel', () => {
    const fakeWidget = { id: 'w1', meta: { type: 'widget' }, title: 'W', loaded: false, pending_events: [] };
    const meta = { name: 'in', label: 'Input', actionlabel: 'Custom action', description: '' };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, meta);

    const endpoints = ep.getReachableEndpoints();
    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].actionlabel, 'Custom action');
    assert.equal(endpoints[0].iWidgetName, 'W');
});

test('WidgetTargetEndpoint getReachableEndpoints without actionlabel', () => {
    const fakeWidget = { id: 'w1', meta: { type: 'widget' }, title: 'W', loaded: false, pending_events: [] };
    const meta = { name: 'in', label: 'Input', description: '' };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, meta);

    const endpoints = ep.getReachableEndpoints();
    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].iWidgetName, 'W');
});

test('WidgetTargetEndpoint propagate pushes to pending_events when not loaded', () => {
    const pendingEvents = [];
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: false,
        pending_events: pendingEvents,
        tab: { workspace: { view: { findWidget: () => ({ load: () => {} }) } } }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });

    ep.propagate('data');
    assert.equal(pendingEvents.length, 1);
    assert.equal(pendingEvents[0].endpoint, 'in');
    assert.equal(pendingEvents[0].value, 'data');
});

test('WidgetTargetEndpoint propagate calls callback when loaded', () => {
    let callbackCalledValue = null;
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });
    ep.callback = function (value) { callbackCalledValue = value; };

    ep.propagate('data');
    assert.equal(callbackCalledValue, 'data');
});

test('WidgetTargetEndpoint propagate with no callback logs error', () => {
    const logs = [];
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: { log: (msg, opts) => { logs.push({ msg, opts }); } }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });

    ep.propagate('data');
    assert.ok(logs.length >= 1);
});

test('WidgetTargetEndpoint propagate with callback error logs details', () => {
    const logs = [];
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: {
            log: (msg, opts) => { logs.push({ msg, opts }); },
            formatException: (e) => e.message
        }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });
    ep.callback = function () { throw new Error('callback fail'); };

    ep.propagate('data');
    assert.ok(logs.length >= 1);
});

test('WidgetTargetEndpoint propagate re-throws EndpointTypeError', () => {
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: { log: () => {}, formatException: (e) => e.message }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });
    ep.callback = function () { throw new Wirecloud.wiring.EndpointTypeError('type err'); };

    assert.throws(() => ep.propagate('data'), Wirecloud.wiring.EndpointTypeError);
});

test('WidgetTargetEndpoint propagate re-throws EndpointValueError', () => {
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: { log: () => {}, formatException: (e) => e.message }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });
    ep.callback = function () { throw new Wirecloud.wiring.EndpointValueError('value err'); };

    assert.throws(() => ep.propagate('data'), Wirecloud.wiring.EndpointValueError);
});

test('WidgetTargetEndpoint propagate with null options bypasses target check', () => {
    let callbackCalled = false;
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });
    ep.callback = function () { callbackCalled = true; };

    ep.propagate('data', null);
    assert.equal(callbackCalled, true);
});

test('WidgetTargetEndpoint propagate with matching targetEndpoints calls callback', () => {
    let callbackCalled = false;
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });
    ep.callback = function () { callbackCalled = true; };

    ep.propagate('data', { targetEndpoints: [{ type: 'widget', id: 'w1', endpoint: 'in' }] });
    assert.equal(callbackCalled, true);
});

test('WidgetTargetEndpoint propagate with null targetEndpoints bypasses filter', () => {
    let callbackCalled = false;
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });
    ep.callback = function () { callbackCalled = true; };

    ep.propagate('data', { targetEndpoints: null });
    assert.equal(callbackCalled, true);
});

// --- propagate with non-matching targetEndpoints filter (line 37) ---

test('WidgetTargetEndpoint propagate with non-matching targetEndpoints returns early', () => {
    let callbackCalled = false;
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: true,
        pending_events: [],
        logManager: { log: () => {} }
    };
    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, { name: 'in' });
    ep.callback = function () { callbackCalled = true; };

    // Different widget id, should not match
    ep.propagate('data', { targetEndpoints: [{ type: 'widget', id: 'w99', endpoint: 'other' }] });
    assert.equal(callbackCalled, false);
});

// --- constructor with null meta (line 43) ---

test('WidgetTargetEndpoint constructor with null meta', () => {
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' },
        title: 'W',
        loaded: false,
        pending_events: [],
        logManager: { log: () => {} }
    };

    const ep = new Wirecloud.wiring.WidgetTargetEndpoint(fakeWidget, null);

    assert.equal(ep.id, null);
    assert.equal(ep.callback, null);
});
