const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupBootstrap = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    if (!global.StyledElements) {
        global.StyledElements = {
            Utils: {},
            ObjectWithEvents: class { addEventListener() {} dispatchEvent() {} },
            Event: class {},
            GUIBuilder: class { constructor() {} }
        };
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.Utils.gettext = (s) => s;
    Wirecloud.Utils.interpolate = (t, v) => t.replace(/%\((\w+)\)s/g, (_, k) => v[k]);
    Wirecloud.UserInterfaceManager = {
        workspaceviews: {},
        init: () => {},
        monitorTask: () => {},
        changeCurrentView: () => {},
        onHistoryChange: () => {}
    };
    Wirecloud.activeWorkspace = {
        view: { model: { wiring: { createConnection: () => ({ remove: () => {} }) } }, findWidget: () => null }
    };

    global._privs = {};
    global.document = global.document || {};
    global.document.location = global.document.location || { hash: '', href: 'http://localhost/' };
    global.location = global.location || global.document.location;
    global.decodeURIComponent = decodeURIComponent;
};

test('_APIBootstrap creates MashupPlatform and sets priv', () => {
    setupBootstrap();
    const parent = {};
    const fn = function _APIBootstrap(Wirecloud, utils, parent, id, viewid) {
        let tmp, i, current;
        tmp = document.location.hash.substr(1);
        tmp = tmp.split("&");
        for (i = 0; i < tmp.length; i++) {
            current = tmp[i];
            current = current.split("=", 2);
            if (current[0] === "id" && id === undefined) {
                id = decodeURIComponent(current[1]);
            } else if (current[0] === "workspaceview" && viewid === undefined) {
                viewid = decodeURIComponent(current[1]);
            }
        }
        Object.defineProperty(parent, 'MashupPlatform', {value: {}});
        parent.MashupPlatform.priv = { id, workspaceview: viewid };
    };
    fn(Wirecloud, Wirecloud.Utils, parent);
    assert.ok('MashupPlatform' in parent);
    assert.ok('priv' in parent.MashupPlatform);
});

test('_APIBootstrap extracts id and workspaceview from hash', () => {
    setupBootstrap();
    global.document.location.hash = '#id=widget123&workspaceview=wv456&other=val';
    const parent = {};
    const fn = function _APIBootstrap(Wirecloud, utils, parent, id, viewid) {
        let tmp, i, current;
        tmp = document.location.hash.substr(1);
        tmp = tmp.split("&");
        for (i = 0; i < tmp.length; i++) {
            current = tmp[i];
            current = current.split("=", 2);
            if (current[0] === "id" && id === undefined) {
                id = decodeURIComponent(current[1]);
            } else if (current[0] === "workspaceview" && viewid === undefined) {
                viewid = decodeURIComponent(current[1]);
            }
        }
        Object.defineProperty(parent, 'MashupPlatform', {value: {}});
        parent.MashupPlatform.priv = { id, workspaceview: viewid };
    };
    fn(Wirecloud, Wirecloud.Utils, parent, undefined, undefined);
    assert.equal(parent.MashupPlatform.priv.id, 'widget123');
    assert.equal(parent.MashupPlatform.priv.workspaceview, 'wv456');
});

test('_APIBootstrap InputEndpoint connected property', () => {
    const privates = new WeakMap();
    const InputEndpoint = function InputEndpoint(real_endpoint, dynamic) {
        privates.set(this, { dynamic, real_endpoint });
        Object.defineProperty(this, "connected", {
            get: function get_connected() { return privates.get(this).real_endpoint.inputs.length !== 0; }
        });
    };
    const ep = { inputs: [] };
    const ie = new InputEndpoint(ep, true);
    assert.equal(ie.connected, false);
    ep.inputs.push({});
    assert.equal(ie.connected, true);
});

test('_APIBootstrap InputEndpoint connect/disconnect', () => {
    const privates = new WeakMap();
    const OutputEndpoint = function OutputEndpoint(real_endpoint, dynamic) {
        privates.set(this, { dynamic, real_endpoint });
    };
    const InputEndpoint = function InputEndpoint(real_endpoint, dynamic) {
        privates.set(this, { dynamic, real_endpoint });
    };

    const connections = [];
    const create_connection = (output, input) => {
        if (output.component === input.component) {
            throw new TypeError("connections between endpoints of the same component are not allowed");
        }
        const conn = { source: output, target: input, remove: () => { connections.splice(connections.indexOf(conn), 1); } };
        connections.push(conn);
        output.outputList = output.outputList || [];
        output.connections = output.connections || [];
        output.outputList.push(input);
        output.connections.push(conn);
        input.connections = input.connections || [];
        return conn;
    };
    const remove_connection = (conn) => { conn.remove(); };

    InputEndpoint.prototype.connect = function connect(outputendpoint) {
        if (outputendpoint == null || !(outputendpoint instanceof OutputEndpoint)) {
            throw new TypeError("outputendpoint must be an output endpoint instance");
        }
        const real_outputendpoint = privates.get(outputendpoint).real_endpoint;
        const real_inputendpoint = privates.get(this).real_endpoint;
        create_connection(real_outputendpoint, real_inputendpoint);
    };
    InputEndpoint.prototype.disconnect = function disconnect(outputendpoint) {
        if (outputendpoint != null && !(outputendpoint instanceof OutputEndpoint)) {
            throw new TypeError("outputendpoint must be null or an output endpoint instance");
        }
        const real_inputendpoint = privates.get(this).real_endpoint;
        if (outputendpoint != null) {
            const real_outputendpoint = privates.get(outputendpoint).real_endpoint;
            const index = real_outputendpoint.outputList.indexOf(real_inputendpoint);
            if (index !== -1) {
                const connection = real_outputendpoint.connections[index];
                remove_connection(connection);
            }
        } else {
            (real_inputendpoint.connections || []).filter(function (connection) {
                return connection.source.component.volatile || connection.target.component.volatile;
            }).forEach(remove_connection);
        }
    };

    const compA = { volatile: true };
    const compB = { volatile: false };
    const out = { component: compA, outputList: [], connections: [], propagate: () => {} };
    const inp = { component: compB, connections: [] };
    const oe = new OutputEndpoint(out, true);
    const ie = new InputEndpoint(inp, true);

    ie.connect(oe);
    assert.equal(connections.length, 1);
    ie.disconnect(oe);
    assert.equal(connections.length, 0);
});

test('_APIBootstrap InputEndpoint connect fails with null', () => {
    const privates = new WeakMap();
    const OutputEndpoint = function OutputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    const InputEndpoint = function InputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    InputEndpoint.prototype.connect = function connect(outputendpoint) {
        if (outputendpoint == null || !(outputendpoint instanceof OutputEndpoint)) {
            throw new TypeError("outputendpoint must be an output endpoint instance");
        }
    };
    const ie = new InputEndpoint({}, true);
    assert.throws(() => ie.connect(null), /outputendpoint must be an output endpoint instance/);
    assert.throws(() => ie.connect({}), /outputendpoint must be an output endpoint instance/);
});

test('_APIBootstrap InputEndpoint disconnect fails with invalid type', () => {
    const privates = new WeakMap();
    const OutputEndpoint = function OutputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    const InputEndpoint = function InputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    InputEndpoint.prototype.disconnect = function disconnect(outputendpoint) {
        if (outputendpoint != null && !(outputendpoint instanceof OutputEndpoint)) {
            throw new TypeError("outputendpoint must be null or an output endpoint instance");
        }
    };
    const ie = new InputEndpoint({ connections: [], inputs: [] }, true);
    assert.throws(() => ie.disconnect({}), /outputendpoint must be null or an output endpoint instance/);
});

test('_APIBootstrap OutputEndpoint connected property', () => {
    const privates = new WeakMap();
    const OutputEndpoint = function OutputEndpoint(real_endpoint, dynamic) {
        privates.set(this, { dynamic, real_endpoint });
        Object.defineProperty(this, "connected", {
            get: function get_connected() { return privates.get(this).real_endpoint.outputList.length !== 0; }
        });
    };
    const ep = { outputList: [] };
    const oe = new OutputEndpoint(ep, true);
    assert.equal(oe.connected, false);
    ep.outputList.push({});
    assert.equal(oe.connected, true);
});

test('_APIBootstrap OutputEndpoint connect/disconnect', () => {
    const privates = new WeakMap();
    const connections = [];
    const create_connection = (output, input) => {
        if (output.component === input.component) throw new TypeError();
        const conn = { source: output, target: input, remove: () => { connections.splice(connections.indexOf(conn), 1); } };
        connections.push(conn);
        output.outputList = output.outputList || [];
        output.connections = output.connections || [];
        output.outputList.push(input);
        output.connections.push(conn);
        return conn;
    };
    const remove_connection = (conn) => { conn.remove(); };

    const InputEndpoint = function InputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    const OutputEndpoint = function OutputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    OutputEndpoint.prototype.connect = function connect(inputendpoint) {
        if (inputendpoint == null || !(inputendpoint instanceof InputEndpoint)) {
            throw new TypeError("inputendpoint must be an input endpoint instance");
        }
        const real_inputendpoint = privates.get(inputendpoint).real_endpoint;
        const real_outputendpoint = privates.get(this).real_endpoint;
        create_connection(real_outputendpoint, real_inputendpoint);
    };
    OutputEndpoint.prototype.disconnect = function disconnect(inputendpoint) {
        if (inputendpoint != null && !(inputendpoint instanceof InputEndpoint)) {
            throw new TypeError("inputendpoint must be null or an input endpoint instance");
        }
        const real_outputendpoint = privates.get(this).real_endpoint;
        if (inputendpoint != null) {
            const real_inputendpoint = privates.get(inputendpoint).real_endpoint;
            const index = real_outputendpoint.outputList.indexOf(real_inputendpoint);
            if (index !== -1) {
                const connection = real_outputendpoint.connections[index];
                remove_connection(connection);
            }
        } else {
            (real_outputendpoint.connections || []).filter(function (connection) {
                return connection.source.component.volatile || connection.target.component.volatile;
            }).forEach(remove_connection);
        }
    };
    OutputEndpoint.prototype.pushEvent = function pushEvent(data) {
        privates.get(this).real_endpoint.propagate(data);
    };

    const compA = { volatile: true };
    const compB = { volatile: false };
    const out = { component: compA, outputList: [], connections: [], propagate: function(d) { this._data = d; } };
    const inp = { component: compB, connections: [] };
    const oe = new OutputEndpoint(out, true);
    const ie = new InputEndpoint(inp, true);

    oe.connect(ie);
    assert.equal(connections.length, 1);
    oe.disconnect(ie);
    assert.equal(connections.length, 0);
});

test('_APIBootstrap OutputEndpoint pushEvent', () => {
    const privates = new WeakMap();
    const OutputEndpoint = function OutputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    OutputEndpoint.prototype.pushEvent = function pushEvent(data) {
        privates.get(this).real_endpoint.propagate(data);
    };
    const out = { outputList: [], propagate: function(d) { this._data = d; } };
    const oe = new OutputEndpoint(out, true);
    oe.pushEvent('hello');
    assert.equal(out._data, 'hello');
});

test('_APIBootstrap OutputEndpoint connect fails with null', () => {
    const privates = new WeakMap();
    const InputEndpoint = function InputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    const OutputEndpoint = function OutputEndpoint(real_endpoint, dynamic) { privates.set(this, { dynamic, real_endpoint }); };
    OutputEndpoint.prototype.connect = function connect(inputendpoint) {
        if (inputendpoint == null || !(inputendpoint instanceof InputEndpoint)) {
            throw new TypeError("inputendpoint must be an input endpoint instance");
        }
    };
    const oe = new OutputEndpoint({}, true);
    assert.throws(() => oe.connect(null), /inputendpoint must be an input endpoint instance/);
    assert.throws(() => oe.connect({}), /inputendpoint must be an input endpoint instance/);
});

test('_APIBootstrap create_connection throws on same component', () => {
    const create_connection = (output, input) => {
        if (output.component === input.component) throw new TypeError("same component");
    };
    const comp = {};
    assert.throws(() => create_connection({ component: comp }, { component: comp }), /same component/);
});

test('_APIBootstrap get id from hash when not provided', () => {
    setupBootstrap();
    global.document.location.hash = '#id=hello';
    const parent = {};
    const fn = function _APIBootstrap(Wirecloud, utils, parent, id, viewid) {
        let tmp, i, current;
        tmp = document.location.hash.substr(1);
        tmp = tmp.split("&");
        for (i = 0; i < tmp.length; i++) {
            current = tmp[i];
            current = current.split("=", 2);
            if (current[0] === "id" && id === undefined) {
                id = decodeURIComponent(current[1]);
            }
        }
        Object.defineProperty(parent, 'MashupPlatform', {value: {}});
        parent.MashupPlatform.priv = { id, workspaceview: Wirecloud.activeWorkspace.view };
    };
    fn(Wirecloud, Wirecloud.Utils, parent);
    assert.equal(parent.MashupPlatform.priv.id, 'hello');
});

test('_APIBootstrap production implementation covers endpoint facades', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.window.parent = global.window;
    global.document.location = { hash: '', href: 'http://localhost/' };
    global.document.location.hash = '#id=hash-widget&workspaceview=view-1';

    const calls = {
        created: [],
        removed: [],
        propagated: [],
    };
    const workspaceview = {
        model: {
            wiring: {
                createConnection(output, input, options) {
                    const connection = {
                        source: output,
                        target: input,
                        options,
                        remove() {
                            calls.removed.push(connection);
                            output.outputList = output.outputList.filter((endpoint) => endpoint !== input);
                            output.connections = output.connections.filter((entry) => entry !== connection);
                            input.inputs = input.inputs.filter((endpoint) => endpoint !== output);
                            input.connections = input.connections.filter((entry) => entry !== connection);
                        }
                    };
                    calls.created.push(connection);
                    output.outputList.push(input);
                    output.connections.push(connection);
                    input.inputs.push(output);
                    input.connections.push(connection);
                    return connection;
                }
            }
        }
    };
    global.Wirecloud = {
        Utils: {},
        UserInterfaceManager: { workspaceviews: { 'view-1': workspaceview } },
        activeWorkspace: { view: { model: { wiring: workspaceview.model.wiring } } },
    };

    const parent = {};
    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudAPIBootstrap.js');
    window._privs._APIBootstrap(global.Wirecloud, global.Wirecloud.Utils, parent);

    assert.equal(parent.MashupPlatform.priv.id, 'hash-widget');
    assert.equal(parent.MashupPlatform.priv.workspaceview, workspaceview);

    const componentA = { volatile: true };
    const componentB = { volatile: false };
    const output = {
        component: componentA,
        outputList: [],
        connections: [],
        propagate(data) {
            calls.propagated.push(data);
        }
    };
    const input = {
        component: componentB,
        inputs: [],
        connections: [],
    };
    const InputEndpoint = parent.MashupPlatform.priv.InputEndpoint;
    const OutputEndpoint = parent.MashupPlatform.priv.OutputEndpoint;
    const inputFacade = new InputEndpoint(input, true);
    const outputFacade = new OutputEndpoint(output, true);

    assert.equal(inputFacade.connected, false);
    assert.equal(outputFacade.connected, false);
    inputFacade.connect(outputFacade);
    assert.equal(inputFacade.connected, true);
    assert.equal(outputFacade.connected, true);
    assert.deepEqual(calls.created[0].options, { commit: true });
    inputFacade.disconnect(outputFacade);
    assert.equal(calls.removed.length, 1);

    outputFacade.connect(inputFacade);
    outputFacade.disconnect(inputFacade);
    assert.equal(calls.removed.length, 2);

    outputFacade.connect(inputFacade);
    outputFacade.disconnect();
    assert.equal(calls.removed.length, 3);

    outputFacade.connect(inputFacade);
    inputFacade.disconnect();
    assert.equal(calls.removed.length, 4);

    const componentC = { volatile: false };
    const componentD = { volatile: true };
    const outputNV = { component: componentC, outputList: [], connections: [], propagate() { } };
    const inputV = { component: componentD, inputs: [], connections: [] };
    const outputNVFacade = new OutputEndpoint(outputNV, true);
    const inputVFacade = new InputEndpoint(inputV, true);
    outputNVFacade.connect(inputVFacade);
    assert.equal(inputVFacade.connected, true);
    inputVFacade.disconnect();
    assert.equal(calls.removed.length, 5);

    outputNVFacade.connect(inputVFacade);
    assert.equal(outputNVFacade.connected, true);
    outputNVFacade.disconnect();
    assert.equal(calls.removed.length, 6);

    const componentE = { volatile: false };
    const componentF = { volatile: false };
    const outputNV2 = { component: componentE, outputList: [], connections: [], propagate() { } };
    const inputNV = { component: componentF, inputs: [], connections: [] };
    const outputNV2Facade = new OutputEndpoint(outputNV2, true);
    const inputNVFacade = new InputEndpoint(inputNV, true);
    outputNV2Facade.connect(inputNVFacade);
    assert.equal(inputNVFacade.connected, true);
    inputNVFacade.disconnect();
    assert.equal(inputNVFacade.connected, true);
    assert.equal(calls.removed.length, 6);

    outputNV2Facade.disconnect();
    assert.equal(outputNV2Facade.connected, true);
    assert.equal(calls.removed.length, 6);

    outputFacade.pushEvent('payload');
    assert.deepEqual(calls.propagated, ['payload']);

    assert.throws(() => inputFacade.connect(null), /outputendpoint must be an output endpoint instance/);
    assert.throws(() => inputFacade.disconnect({}), /outputendpoint must be null or an output endpoint instance/);
    assert.throws(() => outputFacade.connect(null), /inputendpoint must be an input endpoint instance/);
    assert.throws(() => outputFacade.disconnect({}), /inputendpoint must be null or an input endpoint instance/);

    const sameComponentInput = new InputEndpoint({ component: componentA, inputs: [], connections: [] }, true);
    assert.throws(() => outputFacade.connect(sameComponentInput), /same component/);
});

test('_APIBootstrap production implementation uses explicit ids and auto-initializes iframe branch', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.window.parent = global.window;
    global.document.location = { hash: '', href: 'http://localhost/' };
    global.document.location.hash = '';
    const activeView = { model: { wiring: { createConnection: () => ({ remove() {} }) } } };
    global.Wirecloud = {
        Utils: {},
        UserInterfaceManager: { workspaceviews: {} },
        activeWorkspace: { view: activeView },
    };

    const parent = {};
    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudAPIBootstrap.js');
    window._privs._APIBootstrap(global.Wirecloud, global.Wirecloud.Utils, parent, 'explicit-id');
    assert.equal(parent.MashupPlatform.priv.id, 'explicit-id');
    assert.equal(parent.MashupPlatform.priv.workspaceview, activeView);

    resetLegacyRuntime();
    global._privs = {};
    global.window.parent = {
        Wirecloud: {
            Utils: {},
            UserInterfaceManager: { workspaceviews: {} },
            activeWorkspace: { view: activeView },
        }
    };
    global.document.location = { hash: '#id=iframe-id', href: 'http://localhost/' };
    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudAPIBootstrap.js');
    assert.equal(global.MashupPlatform.priv.id, 'iframe-id');
});
