const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLegacyScript, resetLegacyRuntime } = require('../../support/legacy-runtime.cjs');

const setupDashboardManagement = () => {
    if (global.Wirecloud == null) global.Wirecloud = {};
    global._privs = {};
    Wirecloud.Utils = {
        merge: (a, b) => Object.assign({}, a, b),
        gettext: (s) => s,
        interpolate: (t, v) => t.replace(/%\((\w+)\)s/g, (_, k) => v[k])
    };
    Wirecloud.ui = {};
    Wirecloud.io = {};
    Wirecloud.wiring = {
        WidgetTargetEndpoint: class { constructor(res) { this.resource = res; } },
        WidgetSourceEndpoint: class { constructor(res) { this.resource = res; } },
        OperatorTargetEndpoint: class { constructor(res) { this.resource = res; } },
        OperatorSourceEndpoint: class { constructor(res) { this.resource = res; } }
    };
};

test('_DashboardManagementAPI mashup.addWidget throws on null/invalid ref', () => {
    setupDashboardManagement();
    Wirecloud.LocalCatalogue = { getResourceId: () => null };
    const fn = function _DashboardManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const addWidget = function addWidget(ref) {
            if (ref == null) throw new TypeError('missing widget_ref parameter');
            const widget_def = Wirecloud.LocalCatalogue.getResourceId(ref);
            if (widget_def == null || widget_def.type !== 'widget') throw new TypeError('invalid widget ref');
        };
        Object.defineProperties(parent.MashupPlatform.mashup, { addWidget: {value: addWidget} });
    };
    const parent = { MashupPlatform: { mashup: {}, priv: { workspaceview: { activeTab: {} }, resource: { id: 'w1' } } } };
    fn(parent, { Wirecloud });
    assert.throws(() => parent.MashupPlatform.mashup.addWidget(null), /missing widget_ref/);
    assert.throws(() => parent.MashupPlatform.mashup.addWidget('bad'), /invalid widget ref/);
});

test('_DashboardManagementAPI mashup.addWidget with valid ref', () => {
    setupDashboardManagement();
    let createdOptions = null;
    Wirecloud.LocalCatalogue = { getResourceId: () => ({ type: 'widget' }) };
    const fn = function _DashboardManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const resource = parent.MashupPlatform.priv.resource;
        const workspaceview = parent.MashupPlatform.priv.workspaceview;
        let counter = 1;
        const addWidget = function addWidget(ref, options) {
            if (ref == null) throw new TypeError('missing widget_ref parameter');
            const widget_def = Wirecloud.LocalCatalogue.getResourceId(ref);
            if (widget_def == null || widget_def.type !== 'widget') throw new TypeError('invalid widget ref');
            options = options != null ? options : {};
            options.permissions = { viewer: Wirecloud.Utils.merge({ close: true, rename: false, move: true }, options.permissions) };
            options.permissions.editor = options.permissions.viewer;
            const tab = workspaceview.activeTab;
            options = Wirecloud.Utils.merge(options, {
                id: resource.id + '/' + counter++, commit: false, layout: 1, volatile: true, refiframe: resource_element
            });
            const widget = tab.createWidget(widget_def, options);
            resource.addEventListener('unload', widget.remove.bind(widget));
            return {};
        };
        Object.defineProperties(parent.MashupPlatform.mashup, { addWidget: {value: addWidget} });
    };
    const resource = { id: 'w1', addEventListener: () => {} };
    const resource_element = {};
    const tab = { createWidget: (def, opts) => { createdOptions = opts; return { model: {}, remove: () => {} }; } };
    const parent = { MashupPlatform: { mashup: {}, priv: { workspaceview: { activeTab: tab }, resource } } };
    fn(parent, { Wirecloud });
    parent.MashupPlatform.mashup.addWidget('valid-ref');
    assert.ok(createdOptions);
    assert.equal(createdOptions.volatile, true);
});

test('_DashboardManagementAPI mashup.addOperator', () => {
    setupDashboardManagement();
    let operatorCreated = null;
    Wirecloud.LocalCatalogue = { getResourceId: () => ({ type: 'operator' }) };
    const wiring = { createOperator: (def, opts) => { operatorCreated = opts; return { destroy: () => {} }; } };
    const fn = function _DashboardManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const resource = parent.MashupPlatform.priv.resource;
        let counter = 1;
        const addOperator = function addOperator(ref, options) {
            const operator_def = Wirecloud.LocalCatalogue.getResourceId(ref);
            if (operator_def == null || operator_def.type !== 'operator') throw new TypeError('invalid operator ref');
            options = Wirecloud.Utils.merge({ permissions: null, preferences: {}, properties: {} }, options);
            options.permissions = Wirecloud.Utils.merge({ close: true }, options.permissions);
            options = { id: resource.id + '/' + counter++, volatile: true, permissions: options.permissions, properties: options.properties, preferences: options.preferences };
            const operator = resource.tab.workspace.wiring.createOperator(operator_def, options);
            resource.addEventListener('unload', operator.destroy.bind(operator));
            return {};
        };
        Object.defineProperties(parent.MashupPlatform.mashup, { addOperator: {value: addOperator} });
    };
    const resource = { id: 'w1', addEventListener: () => {}, tab: { workspace: { wiring } } };
    const parent = { MashupPlatform: { mashup: {}, priv: { workspaceview: {}, resource } } };
    fn(parent, { Wirecloud });
    parent.MashupPlatform.mashup.addOperator('valid-ref');
    assert.ok(operatorCreated);
    assert.equal(operatorCreated.volatile, true);
});

test('_DashboardManagementAPI mashup.createWorkspace onSuccess/onFailure', () => {
    setupDashboardManagement();
    let activeCreateWs = null;
    Wirecloud.createWorkspace = (opts) => { activeCreateWs = opts; return { then: (s, f) => { s({ id: 'new' }); } }; };
    const fn = function _DashboardManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const Workspace = function Workspace(ws) { Object.defineProperties(this, { id: {value: ws.id} }); };
        const createWorkspace = function createWorkspace(options) {
            Wirecloud.createWorkspace(options).then((ws) => {
                if (options != null && typeof options.onSuccess === 'function') {
                    try { options.onSuccess(new Workspace(ws)); } catch (e) {}
                }
            }, (error) => {
                if (options != null && typeof options.onFailure === 'function') {
                    try { options.onFailure("" + error); } catch (e) {}
                }
            });
        };
        Object.defineProperties(parent.MashupPlatform.mashup, { createWorkspace: {value: createWorkspace} });
    };
    const parent = { MashupPlatform: { mashup: {}, priv: { resource: {} } } };
    fn(parent, { Wirecloud });
    let successCalled = false;
    parent.MashupPlatform.mashup.createWorkspace({ onSuccess: (ws) => { successCalled = true; assert.equal(ws.id, 'new'); } });
    assert.equal(successCalled, true);
});

test('_DashboardManagementAPI openWorkspace', () => {
    setupDashboardManagement();
    let capturedOpts = null;
    Wirecloud.changeActiveWorkspace = (ws, opts) => { capturedOpts = opts; return { then: (cb) => { if (typeof cb === 'function') cb(); } }; };
    const fn = function _DashboardManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const openWorkspace = function openWorkspace(workspace, options) {
            if (options == null) options = {};
            options.history = "push";
            const task = Wirecloud.changeActiveWorkspace(workspace, options);
            task.then(options.onSuccess, options.onFailure);
            return task;
        };
        Object.defineProperties(parent.MashupPlatform.mashup, { openWorkspace: {value: openWorkspace} });
    };
    const parent = { MashupPlatform: { mashup: {}, priv: { resource: {} } } };
    fn(parent, { Wirecloud });
    parent.MashupPlatform.mashup.openWorkspace({ id: 'ws1' });
    assert.equal(capturedOpts.history, 'push');
});

test('_DashboardManagementAPI Widget/Operator facades', () => {
    const privates = new WeakMap();
    const Widget = function Widget(real_widget) {
        Object.defineProperties(this, { 'inputs': {value: {}}, 'outputs': {value: {}} });
        privates.set(this, real_widget);
    };
    Widget.prototype.addEventListener = function addEventListener() {
        privates.get(this).addEventListener.apply(null, arguments);
    };
    Widget.prototype.remove = function remove() { privates.get(this).remove(); };

    const Operator = function Operator(real_operator) {
        Object.defineProperties(this, { 'inputs': {value: {}}, 'outputs': {value: {}} });
        privates.set(this, real_operator);
    };
    Operator.prototype.remove = function remove() { privates.get(this).remove(); };

    let removed = false;
    const real = { remove: () => { removed = true; } };
    const w = new Widget(real);
    w.remove();
    assert.equal(removed, true);
});

test('_DashboardManagementAPI removeWorkspace shows dialog', () => {
    setupDashboardManagement();
    let dialogShown = false;
    Wirecloud.ui.AlertWindowMenu = class { constructor() {} setHandler(h) { return this; } show() { dialogShown = true; } };
    Wirecloud.removeWorkspace = () => ({ then: (cb) => cb() });
    const fn = function _DashboardManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const removeWorkspace = function removeWorkspace(workspace, options) {
            if (options == null) options = {};
            const dialog = new Wirecloud.ui.AlertWindowMenu('msg');
            dialog.setHandler(() => { Wirecloud.removeWorkspace(workspace).then(options.onSuccess, options.onFailure); }).show();
        };
        Object.defineProperties(parent.MashupPlatform.mashup, { removeWorkspace: {value: removeWorkspace} });
    };
    const parent = { MashupPlatform: { mashup: {}, priv: { resource: {} } } };
    fn(parent, { Wirecloud });
    parent.MashupPlatform.mashup.removeWorkspace({ owner: 'u', name: 'n' });
    assert.equal(dialogShown, true);
});

test('_DashboardManagementAPI createInputEndpoint/createOutputEndpoint for widget/operator', () => {
    setupDashboardManagement();
    const resource = { id: 'w1' };
    const parent = { MashupPlatform: { widget: {}, operator: {}, priv: { resource } } };
    const InputEndpoint = class InputEndpoint {};
    const OutputEndpoint = class OutputEndpoint {};

    const fn = function _DashboardManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const resource = parent.MashupPlatform.priv.resource;
        Object.defineProperties(parent.MashupPlatform.widget, {
            createInputEndpoint: {value: function createInputEndpoint(callback) {
                const endpoint = new Wirecloud.wiring.WidgetTargetEndpoint(resource);
                endpoint.callback = callback;
                return new InputEndpoint(endpoint, true);
            }},
            createOutputEndpoint: {value: function createOutputEndpoint() {
                return new OutputEndpoint(new Wirecloud.wiring.WidgetSourceEndpoint(resource), true);
            }}
        });
        Object.defineProperties(parent.MashupPlatform.operator, {
            createInputEndpoint: {value: function createInputEndpoint(callback) {
                const endpoint = new Wirecloud.wiring.OperatorTargetEndpoint(resource);
                endpoint.callback = callback;
                return new InputEndpoint(endpoint, true);
            }},
            createOutputEndpoint: {value: function createOutputEndpoint() {
                return new OutputEndpoint(new Wirecloud.wiring.OperatorSourceEndpoint(resource), true);
            }}
        });
    };

    parent.MashupPlatform.priv.InputEndpoint = InputEndpoint;
    parent.MashupPlatform.priv.OutputEndpoint = OutputEndpoint;

    fn(parent, { Wirecloud });
    const winp = parent.MashupPlatform.widget.createInputEndpoint(() => {});
    assert.ok(winp instanceof InputEndpoint);
    const wout = parent.MashupPlatform.widget.createOutputEndpoint();
    assert.ok(wout instanceof OutputEndpoint);
    const oinp = parent.MashupPlatform.operator.createInputEndpoint(() => {});
    assert.ok(oinp instanceof InputEndpoint);
    const oout = parent.MashupPlatform.operator.createOutputEndpoint();
    assert.ok(oout instanceof OutputEndpoint);
});

test('_DashboardManagementAPI Workspace facade', () => {
    const Workspace = function Workspace(ws) {
        Object.defineProperties(this, { 'id': {value: ws.id}, 'owner': {value: ws.owner}, 'name': {value: ws.name}, 'url': {value: ws.url} });
    };
    const ws = new Workspace({ id: '1', owner: 'u', name: 'n', url: '/ws/1' });
    assert.equal(ws.id, '1');
    assert.equal(ws.owner, 'u');
});

const setupRealDashboardManagement = (mode = 'widget') => {
    resetLegacyRuntime();
    global._privs = {};
    global.window.parent = global.window;
    global.Wirecloud = {};
    const Wirecloud = global.Wirecloud;
    const calls = {
        activeWorkspace: [],
        createdOperators: [],
        createdWidgets: [],
        createdWorkspaces: [],
        endpointArgs: [],
        eventListeners: [],
        removedWorkspaces: [],
    };

    class InputEndpoint {
        constructor(endpoint, volatile) {
            this.endpoint = endpoint;
            this.volatile = volatile;
            calls.endpointArgs.push({ type: 'input', endpoint, volatile });
        }
    }
    class OutputEndpoint {
        constructor(endpoint, volatile) {
            this.endpoint = endpoint;
            this.volatile = volatile;
            calls.endpointArgs.push({ type: 'output', endpoint, volatile });
        }
    }

    Wirecloud.Utils = {
        gettext: (text) => text,
        interpolate: (text, values) => text.replace(/%\((\w+)\)s/g, (_, key) => values[key]),
        merge: (target, source) => Object.assign({}, target, source || {}),
    };
    Wirecloud.LocalCatalogue = {
        getResourceId(ref) {
            if (ref === 'widget-ref') {
                return { type: 'widget', id: ref };
            }
            if (ref === 'operator-ref') {
                return { type: 'operator', id: ref };
            }
            return null;
        }
    };
    Wirecloud.wiring = {
        WidgetTargetEndpoint: class WidgetTargetEndpoint {
            constructor(resource) {
                this.resource = resource;
            }
        },
        WidgetSourceEndpoint: class WidgetSourceEndpoint {
            constructor(resource) {
                this.resource = resource;
            }
        },
        OperatorTargetEndpoint: class OperatorTargetEndpoint {
            constructor(resource) {
                this.resource = resource;
            }
        },
        OperatorSourceEndpoint: class OperatorSourceEndpoint {
            constructor(resource) {
                this.resource = resource;
            }
        },
    };
    Wirecloud.ui = {
        AlertWindowMenu: class AlertWindowMenu {
            constructor(message) {
                this.message = message;
            }

            setHandler(handler) {
                calls.alertHandler = handler;
                return this;
            }

            show() {
                calls.alertShown = true;
                return this;
            }
        }
    };
    Wirecloud.changeActiveWorkspace = (workspace, options) => {
        calls.activeWorkspace.push({ workspace, options });
        return Promise.resolve('opened');
    };
    Wirecloud.removeWorkspace = (workspace) => {
        calls.removedWorkspaces.push(workspace);
        return Promise.resolve('removed');
    };
    Wirecloud.createWorkspace = (options) => {
        calls.createdWorkspaces.push(options);
        return options && options.fail ? Promise.reject(new Error('failed')) : Promise.resolve({
            id: 'new-ws',
            owner: 'owner',
            name: 'name',
            url: '/owner/name',
        });
    };

    const realWidget = {
        inputs: { in1: {} },
        outputs: { out1: {} },
        addEventListener(name, callback) {
            calls.widgetListener = { name, callback };
        },
        remove() {
            calls.widgetRemoved = true;
        },
    };
    const activeTab = {
        createWidget(widgetDef, options) {
            calls.createdWidgets.push({ widgetDef, options });
            return {
                model: realWidget,
                remove() {
                    calls.createdWidgetRemoved = true;
                }
            };
        }
    };
    const realOperator = {
        inputs: { in1: {} },
        outputs: { out1: {} },
        addEventListener(name, callback) {
            calls.operatorListener = { name, callback };
        },
        destroy() {
            calls.operatorDestroyed = true;
        },
        remove() {
            calls.operatorRemoved = true;
        },
    };
    const workspace = {
        id: 'workspace-1',
        owner: 'owner',
        name: 'workspace',
        url: '/workspace',
        wiring: {
            createOperator(operatorDef, options) {
                calls.createdOperators.push({ operatorDef, options });
                return realOperator;
            }
        }
    };
    const resource = {
        id: 'resource-1',
        wrapperElement: { id: 'iframe' },
        tab: { workspace },
        wiring: { workspace },
        addEventListener(name, callback) {
            calls.eventListeners.push({ name, callback });
        }
    };
    const parent = {
        MashupPlatform: {
            mashup: {},
            priv: {
                InputEndpoint,
                OutputEndpoint,
                resource,
                workspaceview: { activeTab },
            },
        }
    };
    if (mode === 'widget') {
        parent.MashupPlatform.widget = {};
    } else {
        parent.MashupPlatform.operator = {};
    }

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/DashboardManagementAPI.js');
    window._privs._DashboardManagementAPI(parent, { Wirecloud });
    return { calls, parent, realOperator, realWidget, resource };
};

test('_DashboardManagementAPI production implementation covers widget mashup operations', async () => {
    const { calls, parent } = setupRealDashboardManagement('widget');
    const api = parent.MashupPlatform;

    assert.throws(() => api.mashup.addWidget(null), /missing widget_ref parameter/);
    assert.throws(() => api.mashup.addWidget('operator-ref'), /invalid widget ref/);
    const widget = api.mashup.addWidget('widget-ref', { permissions: { rename: true } });
    assert.equal(calls.createdWidgets[0].options.id, 'resource-1/1');
    assert.equal(calls.createdWidgets[0].options.commit, false);
    assert.equal(calls.createdWidgets[0].options.permissions.viewer.rename, true);
    api.mashup.addWidget('widget-ref', null);
    assert.equal(calls.createdWidgets[1].options.id, 'resource-1/2');
    widget.addEventListener('remove', () => {});
    widget.remove();
    assert.equal(calls.widgetRemoved, true);

    assert.throws(() => api.mashup.addOperator('widget-ref'), /invalid operator ref/);
    const operator = api.mashup.addOperator('operator-ref', { properties: { p: 1 } });
    assert.equal(calls.createdOperators[0].options.id, 'resource-1/3');
    assert.equal(calls.createdOperators[0].options.volatile, true);
    operator.addEventListener('remove', () => {});
    operator.remove();
    assert.equal(calls.operatorRemoved, true);

    let successWorkspace;
    api.mashup.createWorkspace({ onSuccess: (workspace) => { successWorkspace = workspace; } });
    await Promise.resolve();
    assert.equal(successWorkspace.id, 'new-ws');
    await successWorkspace.open();
    assert.equal(calls.activeWorkspace[0].options.history, 'push');
    successWorkspace.remove({ onSuccess() {} });
    assert.equal(calls.alertShown, true);
    calls.alertHandler();
    await Promise.resolve();
    assert.equal(calls.removedWorkspaces[0].id, 'new-ws');
    api.mashup.removeWorkspace({ owner: 'owner', name: 'plain' });
    assert.equal(calls.alertShown, true);

    let failureMessage;
    api.mashup.createWorkspace({ fail: true, onFailure: (message) => { failureMessage = message; } });
    await Promise.resolve();
    assert.match(failureMessage, /failed/);

    api.mashup.createWorkspace({ onSuccess: () => { throw new Error('swallowed in catch'); } });
    await Promise.resolve();
    api.mashup.createWorkspace({ fail: true, onFailure: () => { throw new Error('swallowed in failure catch'); } });
    await Promise.resolve();

    const input = api.widget.createInputEndpoint(() => {});
    const output = api.widget.createOutputEndpoint();
    assert.equal(input.volatile, true);
    assert.equal(output.volatile, true);
});

test('_DashboardManagementAPI production implementation covers operator endpoint branch', () => {
    const { parent } = setupRealDashboardManagement('operator');
    const input = parent.MashupPlatform.operator.createInputEndpoint(() => {});
    const output = parent.MashupPlatform.operator.createOutputEndpoint();

    assert.equal(input.volatile, true);
    assert.equal(output.volatile, true);
    assert.equal(input.endpoint.constructor.name, 'OperatorTargetEndpoint');
    assert.equal(output.endpoint.constructor.name, 'OperatorSourceEndpoint');
});

test('_DashboardManagementAPI auto-initializes when loaded inside an iframe', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.MashupPlatform = {
        mashup: {},
        widget: {},
        priv: {
            InputEndpoint: class InputEndpoint {},
            OutputEndpoint: class OutputEndpoint {},
            resource: {
                id: 'resource-1',
                wrapperElement: {},
                tab: { workspace: { wiring: {} } },
                addEventListener() {},
            },
            workspaceview: { activeTab: {} },
        }
    };
    global.window.parent = {
        Wirecloud: {
            Utils: {
                gettext: (text) => text,
                interpolate: (text, values) => text.replace(/%\((\w+)\)s/g, (_, key) => values[key]),
                merge: (target, source) => Object.assign({}, target, source || {}),
            },
            LocalCatalogue: { getResourceId: () => null },
            ui: { AlertWindowMenu: class AlertWindowMenu {} },
            wiring: {
                WidgetTargetEndpoint: class WidgetTargetEndpoint {},
                WidgetSourceEndpoint: class WidgetSourceEndpoint {},
                OperatorTargetEndpoint: class OperatorTargetEndpoint {},
                OperatorSourceEndpoint: class OperatorSourceEndpoint {},
            },
        }
    };

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/DashboardManagementAPI.js');
    assert.equal(typeof global.MashupPlatform.mashup.addWidget, 'function');
});
