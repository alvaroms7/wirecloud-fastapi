const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLegacyScript, resetLegacyRuntime } = require('../../support/legacy-runtime.cjs');

const setupWidgetAPI = () => {
    if (global.Wirecloud == null) global.Wirecloud = {};
    global._privs = {};
};

test('_WidgetAPI sets up widget module with id, drawAttention, close, log, context', () => {
    setupWidgetAPI();
    let closed = false;
    let drawn = false;
    let logged = null;
    const model = {
        id: 'w1',
        volatile: true,
        remove: () => { closed = true; },
        logManager: { log: (msg, level) => { logged = { msg, level }; } },
        properties: {},
        inputs: {},
        outputs: {},
        contextManager: { getAvailableContext: () => ({}), get: () => null },
        meta: { preferences: {} }
    };
    const view = {
        model,
        findWidget: () => view,
        tab: { workspace: { drawAttention: (id) => { drawn = true; } } }
    };
    const workspaceview = { findWidget: () => view, model: {} };
    const parent = { MashupPlatform: { priv: { workspaceview, id: 'w1' } } };

    const fn = function _WidgetAPI(parent) {
        const view = parent.MashupPlatform.priv.workspaceview.findWidget(parent.MashupPlatform.priv.id);
        const model = view.model;
        parent.MashupPlatform.priv.view = view;
        parent.MashupPlatform.priv.resource = model;
        Object.defineProperty(parent.MashupPlatform, 'widget', {value: {}});
        Object.defineProperties(parent.MashupPlatform.widget, {
            id: { value: parent.MashupPlatform.priv.id },
            drawAttention: { value: function drawAttention() { view.tab.workspace.drawAttention(model.id); } },
            close: { value: function close() {
                if (!model.volatile) throw new TypeError('Only volatile widgets can be closed');
                model.remove();
            }},
            log: { value: function log(msg, level) { model.logManager.log(msg, level); } }
        });
    };
    fn(parent);
    assert.equal(parent.MashupPlatform.widget.id, 'w1');
    parent.MashupPlatform.widget.drawAttention();
    assert.equal(drawn, true);
    parent.MashupPlatform.widget.close();
    assert.equal(closed, true);
    parent.MashupPlatform.widget.log('msg', 2);
    assert.deepEqual(logged, { msg: 'msg', level: 2 });
});

test('_WidgetAPI close throws for non-volatile widget', () => {
    setupWidgetAPI();
    const model = {
        id: 'w1',
        volatile: false,
        remove: () => {},
        logManager: { log: () => {} },
        properties: {},
        inputs: {},
        outputs: {},
        contextManager: { getAvailableContext: () => ({}), get: () => null }
    };
    const view = { model, tab: { workspace: { drawAttention: () => {} } } };
    const workspaceview = { findWidget: () => view };
    const parent = { MashupPlatform: { priv: { workspaceview, id: 'w1' } } };

    const fn = function _WidgetAPI(parent) {
        const view = parent.MashupPlatform.priv.workspaceview.findWidget(parent.MashupPlatform.priv.id);
        const model = view.model;
        parent.MashupPlatform.priv.resource = model;
        Object.defineProperty(parent.MashupPlatform, 'widget', {value: {}});
        Object.defineProperties(parent.MashupPlatform.widget, {
            close: { value: function close() {
                if (!model.volatile) throw new TypeError('Only volatile widgets can be closed');
                model.remove();
            }}
        });
    };
    fn(parent);
    assert.throws(() => parent.MashupPlatform.widget.close(), /Only volatile widgets can be closed/);
});

test('_WidgetAPI IWidgetVariable get/set and freeze', () => {
    let val = 0;
    const variable = { get: () => val, set: (v) => { val = v; } };
    const IWidgetVariable = function IWidgetVariable(variable) {
        this.set = function set(value) { variable.set(value); };
        this.get = function get() { return variable.get(); };
        Object.freeze(this);
    };
    const iv = new IWidgetVariable(variable);
    assert.equal(iv.get(), 0);
    iv.set(5);
    assert.equal(val, 5);
    assert.ok(Object.isFrozen(iv));
});

test('_WidgetAPI getVariable returns IWidgetVariable for existing property', () => {
    setupWidgetAPI();
    let pVal = 10;
    const model = {
        id: 'w1',
        volatile: true,
        remove: () => {},
        logManager: { log: () => {} },
        properties: { p1: { get: () => pVal, set: (v) => { pVal = v; } } },
        inputs: {},
        outputs: {},
        contextManager: { getAvailableContext: () => ({}), get: () => null }
    };
    const view = { model, tab: { workspace: { drawAttention: () => {} } } };
    const workspaceview = { findWidget: () => view };
    const parent = { MashupPlatform: { priv: { workspaceview, id: 'w1' } } };

    const IWidgetVariable = function IWidgetVariable(variable) {
        this.set = function set(value) { variable.set(value); };
        this.get = function get() { return variable.get(); };
        Object.freeze(this);
    };
    const fn = function _WidgetAPI(parent) {
        const view = parent.MashupPlatform.priv.workspaceview.findWidget(parent.MashupPlatform.priv.id);
        const model = view.model;
        parent.MashupPlatform.priv.resource = model;
        Object.defineProperty(parent.MashupPlatform, 'widget', {value: {}});
        Object.defineProperties(parent.MashupPlatform.widget, {
            getVariable: { value: function getVariable(name) {
                const variable = model.properties[name];
                if (variable != null) return new IWidgetVariable(variable);
            }}
        });
    };
    fn(parent);
    const v = parent.MashupPlatform.widget.getVariable('p1');
    assert.equal(v.get(), 10);
    assert.equal(parent.MashupPlatform.widget.getVariable('nonexistent'), undefined);
});

test('_WidgetAPI widget context module', () => {
    setupWidgetAPI();
    const ctx = { scope1: 'val1' };
    let cbScope = null;
    const model = {
        id: 'w1',
        volatile: true,
        remove: () => {},
        logManager: { log: () => {} },
        properties: {},
        inputs: {},
        outputs: {},
        contextManager: {
            getAvailableContext: () => ctx,
            get: (k) => ctx[k]
        },
        registerContextAPICallback: (scope, cb) => { cbScope = scope; }
    };
    const view = { model, tab: { workspace: { drawAttention: () => {} } } };
    const workspaceview = { findWidget: () => view };
    const parent = { MashupPlatform: { priv: { workspaceview, id: 'w1' } } };

    const fn = function _WidgetAPI(parent) {
        const view = parent.MashupPlatform.priv.workspaceview.findWidget(parent.MashupPlatform.priv.id);
        const model = view.model;
        parent.MashupPlatform.priv.resource = model;
        Object.defineProperty(parent.MashupPlatform, 'widget', {value: {}});
        Object.defineProperty(parent.MashupPlatform.widget, 'context', {value: {}});
        Object.defineProperty(parent.MashupPlatform.widget.context, 'getAvailableContext', {
            value: function getAvailableContext() { return model.contextManager.getAvailableContext(); }
        });
        Object.defineProperty(parent.MashupPlatform.widget.context, 'get', {
            value: function get(name) { return model.contextManager.get(name); }
        });
        Object.defineProperty(parent.MashupPlatform.widget.context, 'registerCallback', {
            value: function registerCallback(callback) {
                if (typeof callback !== "function") throw new TypeError('callback must be a function');
                model.registerContextAPICallback('iwidget', callback);
            }
        });
        Object.preventExtensions(parent.MashupPlatform.widget.context);
    };
    fn(parent);
    assert.equal(parent.MashupPlatform.widget.context.get('scope1'), 'val1');
    assert.throws(() => parent.MashupPlatform.widget.context.registerCallback('notfn'), /callback must be a function/);
});

test('_WidgetAPI creates InputEndpoint/OutputEndpoint facades from model', () => {
    setupWidgetAPI();
    const InputEndpoint = function InputEndpoint(real_endpoint) { this.real = real_endpoint; };
    const OutputEndpoint = function OutputEndpoint(real_endpoint) { this.real = real_endpoint; };
    const model = {
        id: 'w1',
        volatile: true,
        remove: () => {},
        logManager: { log: () => {} },
        properties: {},
        inputs: { in1: {} },
        outputs: { out1: {} },
        contextManager: { getAvailableContext: () => ({}), get: () => null }
    };
    const view = { model, tab: { workspace: { drawAttention: () => {} } } };
    const workspaceview = { findWidget: () => view };
    const parent = { MashupPlatform: { priv: { workspaceview, id: 'w1', InputEndpoint, OutputEndpoint } } };

    const fn = function _WidgetAPI(parent) {
        const view = parent.MashupPlatform.priv.workspaceview.findWidget(parent.MashupPlatform.priv.id);
        const model = view.model;
        parent.MashupPlatform.priv.resource = model;
        Object.defineProperty(parent.MashupPlatform, 'widget', {value: {}});
        const inputs = {};
        for (const endpoint_name in model.inputs) {
            inputs[endpoint_name] = new parent.MashupPlatform.priv.InputEndpoint(model.inputs[endpoint_name], true);
        }
        Object.defineProperty(parent.MashupPlatform.widget, 'inputs', {value: inputs});
        const outputs = {};
        for (const endpoint_name in model.outputs) {
            outputs[endpoint_name] = new parent.MashupPlatform.priv.OutputEndpoint(model.outputs[endpoint_name], true);
        }
        Object.defineProperty(parent.MashupPlatform.widget, 'outputs', {value: outputs});
    };
    fn(parent);
    assert.ok('in1' in parent.MashupPlatform.widget.inputs);
    assert.ok('out1' in parent.MashupPlatform.widget.outputs);
    assert.ok(parent.MashupPlatform.widget.inputs.in1 instanceof InputEndpoint);
    assert.ok(parent.MashupPlatform.widget.outputs.out1 instanceof OutputEndpoint);
});

const setupRealWidgetAPI = (volatile = true) => {
    resetLegacyRuntime();
    global._privs = {};
    global.window.parent = global.window;
    const calls = {
        callbacks: [],
        drawn: [],
        endpointArgs: [],
        logs: [],
        removed: 0,
    };
    class InputEndpoint {
        constructor(endpoint, dynamic) {
            this.endpoint = endpoint;
            this.dynamic = dynamic;
            calls.endpointArgs.push({ type: 'input', endpoint, dynamic });
        }
    }
    class OutputEndpoint {
        constructor(endpoint, dynamic) {
            this.endpoint = endpoint;
            this.dynamic = dynamic;
            calls.endpointArgs.push({ type: 'output', endpoint, dynamic });
        }
    }
    let propertyValue = 10;
    const model = {
        id: 'widget-1',
        volatile,
        inputs: { in1: { id: 'in1' } },
        outputs: { out1: { id: 'out1' } },
        properties: {
            prop1: {
                get: () => propertyValue,
                set: (value) => { propertyValue = value; },
            }
        },
        contextManager: {
            getAvailableContext: () => ({ widget: true }),
            get: (name) => `context:${name}`,
        },
        registerContextAPICallback(scope, callback) {
            calls.callbacks.push({ scope, callback });
        },
        remove() {
            calls.removed += 1;
        },
        logManager: {
            log(message, level) {
                calls.logs.push({ message, level });
            }
        }
    };
    const view = {
        model,
        tab: {
            workspace: {
                drawAttention(id) {
                    calls.drawn.push(id);
                }
            }
        }
    };
    const parent = {
        MashupPlatform: {
            priv: {
                id: 'widget-1',
                InputEndpoint,
                OutputEndpoint,
                workspaceview: {
                    findWidget(id) {
                        assert.equal(id, 'widget-1');
                        return view;
                    }
                }
            }
        }
    };

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudWidgetAPI.js');
    window._privs._WidgetAPI(parent);
    return { calls, model, parent, view };
};

test('_WidgetAPI production implementation builds widget facade', () => {
    const { calls, model, parent, view } = setupRealWidgetAPI(true);
    const api = parent.MashupPlatform.widget;

    assert.equal(parent.MashupPlatform.priv.view, view);
    assert.equal(parent.MashupPlatform.priv.resource, model);
    assert.equal(api.id, 'widget-1');

    const variable = api.getVariable('prop1');
    assert.equal(variable.get(), 10);
    variable.set(11);
    assert.equal(variable.get(), 11);
    assert.equal(Object.isFrozen(variable), true);
    assert.equal(api.getVariable('missing'), undefined);

    api.drawAttention();
    assert.deepEqual(calls.drawn, ['widget-1']);
    api.close();
    assert.equal(calls.removed, 1);
    api.log('message', 2);
    assert.deepEqual(calls.logs, [{ message: 'message', level: 2 }]);

    assert.deepEqual(api.context.getAvailableContext(), { widget: true });
    assert.equal(api.context.get('name'), 'context:name');
    const callback = () => {};
    api.context.registerCallback(callback);
    assert.deepEqual(calls.callbacks, [{ scope: 'iwidget', callback }]);
    assert.throws(() => api.context.registerCallback(null), TypeError);
    assert.equal(Object.isExtensible(api.context), false);

    assert.equal(api.inputs.in1.dynamic, true);
    assert.equal(api.outputs.out1.dynamic, true);
    assert.deepEqual(calls.endpointArgs.map((entry) => entry.type), ['input', 'output']);
});

test('_WidgetAPI production implementation rejects closing stable widgets', () => {
    const { parent } = setupRealWidgetAPI(false);
    assert.throws(() => parent.MashupPlatform.widget.close(), /Only volatile widgets can be closed/);
});

test('_WidgetAPI auto-initializes when loaded inside an iframe', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.MashupPlatform = {
        priv: {
            id: 'widget-1',
            InputEndpoint: class InputEndpoint {},
            OutputEndpoint: class OutputEndpoint {},
            workspaceview: {
                findWidget: () => ({
                    model: {
                        id: 'widget-1',
                        volatile: true,
                        inputs: {},
                        outputs: {},
                        properties: {},
                        contextManager: { getAvailableContext: () => ({}), get: () => null },
                        logManager: { log() {} },
                    },
                    tab: { workspace: { drawAttention() {} } },
                })
            }
        }
    };
    global.window.parent = {};

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudWidgetAPI.js');
    assert.equal(global.MashupPlatform.widget.id, 'widget-1');
});
