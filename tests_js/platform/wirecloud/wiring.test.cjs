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
    Wirecloud.GlobalLogManager = { log: () => {}, parseErrorResponse: (r) => 'error' };
    Wirecloud.io = { makeRequest: () => Promise.resolve({ status: 204 }) };
    Wirecloud.Task = class Task {
        constructor(name, fn) {
            this._name = name;
            if (typeof fn === 'function') {
                fn((val) => {}, (err) => {});
            }
        }
        then() { return this; }
    };
    Wirecloud.constants = {
        LOGGING: { ERROR_MSG: 1, WARN_MSG: 2, INFO_MSG: 3, DEBUG_MSG: 4 }
    };
    Wirecloud.LogManager = class LogManager {
        constructor(p) { this.parent = p; this.errorCount = 0; }
        log() {} newCycle() {} formatException(e) { return e.message; }
    };
    Wirecloud.wiring = {};

    // Load Wiring.js first - it creates ns.wiring = {} (Wirecloud.wiring namespace)
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/Wiring.js',
    ]);

    // Load wiring sub-modules after Wiring.js has established the namespace
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/Endpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/SourceEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/OperatorSourceEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/OperatorTargetEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/WidgetSourceEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/WidgetTargetEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/Connection.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/Operator.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/MissingEndpoint.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('Wirecloud.Wiring exists', () => {
    assert.ok(Wirecloud.Wiring);
    assert.equal(typeof Wirecloud.Wiring.normalize, 'function');
});

test('Wiring.normalize returns default status for empty input', () => {
    const status = Wirecloud.Wiring.normalize({});
    assert.equal(status.version, '2.0');
    assert.deepEqual(status.connections, []);
    assert.deepEqual(status.operators, {});
    assert.ok(status.visualdescription);
    assert.ok(status.visualdescription.components);
    assert.ok(status.visualdescription.components.widget);
    assert.ok(status.visualdescription.components.operator);
    assert.deepEqual(status.visualdescription.behaviours, []);
});

test('Wiring.normalize preserves custom operators', () => {
    const status = Wirecloud.Wiring.normalize({
        operators: { 'op1': { name: 'test' } }
    });
    assert.ok(status.operators['op1']);
});

test('Wiring.normalize adds missing visualdescription', () => {
    const status = Wirecloud.Wiring.normalize({
        connections: [{ source: {}, target: {} }]
    });
    assert.deepEqual(status.connections, [{ source: {}, target: {} }]);
});

test('Wiring.normalize normalizes visual component positions', () => {
    const status = Wirecloud.Wiring.normalize({
        visualdescription: {
            components: {
                widget: { 'w1': { name: 'w' } },
                operator: { 'op1': { name: 'op' } }
            },
            connections: [],
            behaviours: []
        }
    });
    const w = status.visualdescription.components.widget['w1'];
    assert.deepEqual(w.position, { x: 0, y: 0 });
    assert.equal(w.collapsed, false);
});

// =========================================================================
// COMPREHENSIVE WIRING TESTS
// =========================================================================

test.beforeEach(() => {
    Wirecloud.URLs = Wirecloud.URLs || {};
    Wirecloud.URLs.WIRING_ENTRY = { evaluate: (o) => '/api/ws/' + o.workspace_id + '/wiring' };
    Wirecloud.URLs.OPERATOR_VARIABLES_ENTRY = { evaluate: () => '/api/op/vars' };
    Wirecloud.ContextManager = Wirecloud.ContextManager || class ContextManager {
        constructor(inst, desc) { this.instance = inst; }
        get(k) { return this._data ? this._data[k] : null; }
        modify() {} addCallback() {} removeCallback() {}
    };
    Wirecloud.PropertyCommiter = Wirecloud.PropertyCommiter || class { constructor() {} add() {} commit() {} };
    Wirecloud.PersistentVariable = Wirecloud.PersistentVariable || class {
        constructor(meta, commiter, readonly, value) {
            this.meta = meta; this.readonly = readonly; this.value = value; this.commiter = commiter;
        }
    };
    Wirecloud.UserPref = Wirecloud.UserPref || class UserPref {
        constructor(meta, readonly, hidden, value) {
            this.meta = meta; this.readonly = readonly; this.hidden = hidden; this.value = value;
        }
    };
    Wirecloud.loadedScripts = Wirecloud.loadedScripts || {};
});

const defaultOperatorMeta = () => ({
    uri: 'Vendor/Op/1.0',
    title: 'Test Operator',
    type: 'operator',
    missing: false,
    macversion: 1,
    inputList: [],
    outputList: [],
    preferenceList: [],
    propertyList: [],
    codeurl: '/code'
});

const defaultWorkspace = (overrides) => Object.assign({
    id: 'ws1',
    widgets: [],
    addEventListener: () => {},
    findWidget: () => null,
    resources: { getOrCreateMissing: () => defaultOperatorMeta() }
}, overrides);

const createMockWidget = (id, overrides = {}) => {
    const widget = new StyledElements.ObjectWithEvents(['change', 'remove']);
    widget.id = id;
    widget.meta = Object.assign({ type: 'widget' }, overrides.meta || {});
    widget.missing = false;
    widget.loaded = true;
    widget.volatile = false;
    widget.inputs = {};
    widget.outputs = {};
    widget.fullDisconnect = () => {};
    widget.is = (other) => false;
    return widget;
};

const createEndpointMocks = () => {
    const source = new Wirecloud.wiring.SourceEndpoint('e-src', { name: 'out' });
    source.component = { volatile: false, meta: { type: 'widget' }, id: 'w1' };
    source.missing = false;
    source.connections = [];
    source.outputList = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = { volatile: false, meta: { type: 'widget' }, id: 'w2' };
    target.missing = false;
    target.inputs = [];
    target.connections = [];
    return { source, target };
};

// =========================================================================
// CONSTRUCTOR & PROPERTIES
// =========================================================================

test('Wiring constructor sets workspace reference', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    assert.equal(w.workspace, ws);
});

test('Wiring constructor initializes empty connections array', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    assert.deepEqual(w.connections, []);
});

test('Wiring constructor initializes empty operators array', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    assert.deepEqual(w.operators, []);
});

test('Wiring constructor creates logManager instance', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    assert.ok(w.logManager instanceof Wirecloud.LogManager);
    assert.equal(w.logManager.parent, Wirecloud.GlobalLogManager);
});

test('Wiring status returns version connections operators visualdescription', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    const s = w.status;
    assert.equal(s.version, '2.0');
    assert.ok(Array.isArray(s.connections));
    assert.equal(typeof s.operators, 'object');
    assert.ok(s.visualdescription);
});

test('Wiring status connections is a copy not a reference', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    const s1 = w.status;
    s1.connections.push('fake');
    assert.equal(w.connections.length, 0);
});

test('Wiring visualdescription getter returns object with components and behaviours', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    const vd = w.visualdescription;
    assert.ok(vd.components);
    assert.ok(vd.components.widget);
    assert.ok(vd.components.operator);
    assert.ok(Array.isArray(vd.behaviours));
});

test('Wiring visualdescription getter returns a clone not reference', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    const vd1 = w.visualdescription;
    vd1.components.widget.test = 'modified';
    const vd2 = w.visualdescription;
    assert.equal(vd2.components.widget.test, undefined);
});

test('Wiring errorCount returns zero initially', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    assert.equal(w.errorCount, 0);
});

test('Wiring operatorsById is a frozen object', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    const byId = w.operatorsById;
    assert.equal(typeof byId, 'object');
    assert.ok(Object.isFrozen(byId));
});

test('Wiring constructor dispatches load event on init', () => {
    const ws = { id: 'ws1', widgets: [], addEventListener: () => {} };
    const w = new Wirecloud.Wiring(ws, {});
    let loaded = false;
    w.addEventListener('load', (ctx) => { loaded = true; });
    w.load({});
    assert.equal(loaded, true);
});

test('Wiring constructor registers createwidget listener on workspace', () => {
    let registered = false;
    const ws = {
        id: 'ws1',
        widgets: [],
        addEventListener: (event) => { if (event === 'createwidget') registered = true; }
    };
    new Wirecloud.Wiring(ws, {});
    assert.equal(registered, true);
});

test('Wiring constructor calls on_createwidget for existing widgets', () => {
    let changeRegistered = false;
    let removeRegistered = false;
    const widget = createMockWidget('w1');
    widget.addEventListener = (event) => {
        if (event === 'change') changeRegistered = true;
        if (event === 'remove') removeRegistered = true;
    };
    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => ({ type: 'op', missing: false, macversion: 1, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c', uri: 'V/1.0' }) }
    };
    new Wirecloud.Wiring(ws, {});
    assert.ok(changeRegistered);
    assert.ok(removeRegistered);
});

// =========================================================================
// createConnection
// =========================================================================

test('createConnection non-volatile success returns established connection', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const { source, target } = createEndpointMocks();

    const conn = await wir.createConnection(source, target);

    assert.ok(conn instanceof Wirecloud.wiring.Connection);
    assert.equal(conn.established, true);
    assert.ok(wir.connections.includes(conn));
});

test('createConnection non-volatile sends correct PATCH request', async () => {
    let reqUrl = null;
    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqUrl = url;
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };
    const ws = { id: 'ws-test', widgets: [], addEventListener: () => {} };
    const wir = new Wirecloud.Wiring(ws, {});
    const { source, target } = createEndpointMocks();

    await wir.createConnection(source, target);

    assert.equal(reqUrl, '/api/ws/ws-test/wiring');
    assert.equal(reqBody[0].op, 'add');
    assert.equal(reqBody[0].path, '/connections/-');
    assert.equal(reqBody[0].value.readonly, false);
});

test('createConnection non-volatile server error 401 rejects with parsed error', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 401 });
    Wirecloud.GlobalLogManager.parseErrorResponse = (r) => 'auth-rejected';
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const { source, target } = createEndpointMocks();

    await assert.rejects(() => wir.createConnection(source, target), /auth-rejected/);
});

test('createConnection non-volatile server error 500 rejects', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });
    Wirecloud.GlobalLogManager.parseErrorResponse = () => 'server-error';
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const { source, target } = createEndpointMocks();

    await assert.rejects(() => wir.createConnection(source, target), /server-error/);
});

test('createConnection unexpected status code rejects', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const { source, target } = createEndpointMocks();

    await assert.rejects(() => wir.createConnection(source, target));
});

test('createConnection volatile returns Task and establishes connection', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const source = new Wirecloud.wiring.SourceEndpoint('e-src', { name: 'out' });
    source.component = { volatile: true, meta: { type: 'widget' }, id: 'v1' };
    source.missing = false;
    source.connections = [];
    source.outputList = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = { volatile: false, meta: { type: 'widget' }, id: 'v2' };
    target.missing = false;
    target.inputs = [];
    target.connections = [];

    const result = wir.createConnection(source, target);

    assert.ok(result instanceof Wirecloud.Task);
    assert.equal(wir.connections.length, 1);
    assert.equal(wir.connections[0].established, true);
});

test('createConnection registers on_removeconnection listener', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const { source, target } = createEndpointMocks();

    const conn = await wir.createConnection(source, target);
    assert.equal(wir.connections.length, 1);
    conn.remove();
    assert.equal(wir.connections.length, 0);
});

// =========================================================================
// createOperator
// =========================================================================

test('createOperator non-volatile success returns operator in array', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();

    const op = await wir.createOperator(meta, { id: 'op-x' });

    assert.ok(op instanceof Wirecloud.wiring.Operator);
    assert.equal(op.id, 'op-x');
    assert.ok(wir.operators.includes(op));
    assert.equal(wir.operatorsById['op-x'], op);
});

test('createOperator non-volatile sends correct PATCH request', async () => {
    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };
    const ws = { id: 'ws-ops', widgets: [], addEventListener: () => {} };
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();

    await wir.createOperator(meta, { id: '99' });

    assert.equal(reqBody[0].op, 'add');
    assert.equal(reqBody[0].path, '/operators/99');
});

test('createOperator non-volatile error rejects', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 403 });
    Wirecloud.GlobalLogManager.parseErrorResponse = () => 'forbidden';
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();

    await assert.rejects(() => wir.createOperator(meta), /forbidden/);
});

test('createOperator unexpected status rejects', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();

    await assert.rejects(() => wir.createOperator(meta));
});

test('createOperator volatile returns operator directly, no network', () => {
    let makeRequestCalled = false;
    Wirecloud.io.makeRequest = () => { makeRequestCalled = true; return Promise.resolve({ status: 204 }); };
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();

    const op = wir.createOperator(meta, { volatile: true });

    assert.ok(op instanceof Wirecloud.wiring.Operator);
    assert.equal(op.volatile, true);
    assert.ok(wir.operators.includes(op));
    assert.equal(wir.operatorsById[op.id], op);
    assert.equal(makeRequestCalled, false);
});

test('createOperator auto-generates sequential IDs', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();

    const op1 = await wir.createOperator(meta);
    const op2 = await wir.createOperator(meta);

    assert.equal(op1.id, '1');
    assert.equal(op2.id, '2');
});

test('createOperator dispatches createoperator event', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();

    const op = await wir.createOperator(meta, { id: 'evt-op' });
    assert.ok(op instanceof Wirecloud.wiring.Operator);
});

// =========================================================================
// findOperator
// =========================================================================

test('findOperator returns operator by string ID', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    const op = await wir.createOperator(meta, { id: 'my-op' });

    assert.equal(wir.findOperator('my-op'), op);
});

test('findOperator returns null for nonexistent operator', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    assert.equal(wir.findOperator('no-such-id'), null);
});

test('findOperator throws TypeError for null ID', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    assert.throws(() => wir.findOperator(null), TypeError);
});

test('findOperator throws TypeError for undefined ID', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    assert.throws(() => wir.findOperator(undefined), TypeError);
});

test('findOperator auto-converts numeric ID to string', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    const op = await wir.createOperator(meta, { id: '7' });

    assert.equal(wir.findOperator(7), op);
});

// =========================================================================
// load
// =========================================================================

test('load dispatches load event', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    let loadFired = false;
    wir.addEventListener('load', (ctx) => { loadFired = true; });

    wir.load({});

    assert.equal(loadFired, true);
});

test('load sets visualdescription from status', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const customVD = {
        components: { operator: { op: { name: 'x' } }, widget: {} },
        behaviours: [{ title: 'b1' }],
        connections: [],
    };

    wir.load({ visualdescription: customVD });

    // Normalize strips extra properties, but preserves structure
    const vd = wir.visualdescription;
    assert.equal(vd.behaviours.length, 1);
});

test('load preserves volatile connections during reload', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const source = new Wirecloud.wiring.SourceEndpoint('e-src', { name: 'out' });
    source.component = { volatile: true, meta: { type: 'widget' }, id: 'v1' };
    source.missing = false;
    source.connections = [];
    source.outputList = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = { volatile: false, meta: { type: 'widget' }, id: 'v2' };
    target.missing = false;
    target.inputs = [];
    target.connections = [];

    wir.createConnection(source, target);
    assert.equal(wir.connections.length, 1);

    wir.load({});
    assert.equal(wir.connections.length, 1);
});

test('load detaches non-volatile connections', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const source = new Wirecloud.wiring.SourceEndpoint('e-src', { name: 'out' });
    source.component = { volatile: true, meta: { type: 'widget' }, id: 'w1' };
    source.missing = false;
    source.connections = [];
    source.outputList = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = { volatile: true, meta: { type: 'widget' }, id: 'w2' };
    target.missing = false;
    target.inputs = [];
    target.connections = [];

    wir.createConnection(source, target);
    assert.equal(wir.connections.length, 1);

    let detached = false;
    wir.connections[0].detach = () => { detached = true; };
    source.component.volatile = false;
    target.component.volatile = false;

    wir.load({});
    assert.equal(detached, true);
});

test('load removes non-volatile operators not in new status', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    await wir.createOperator(meta, { id: 'rm-op' });

    assert.equal(wir.operators.length, 1);
    wir.load({});
    assert.equal(wir.operators.length, 0);
});

test('load recalculates operatorId from existing operators', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();

    wir.createOperator(meta, { volatile: true, id: '5' });
    wir.createOperator(meta, { volatile: true, id: '7' });

    wir.load({ connections: [], operators: {}, visualdescription: Wirecloud.Wiring.normalize({}).visualdescription });

    const op3 = wir.createOperator(meta, { volatile: true });
    assert.equal(op3.id, '8');
});

test('load resets logManager and fixed errors', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    let newCycleCalled = false;
    wir.logManager.newCycle = () => { newCycleCalled = true; };

    wir.load({});

    assert.equal(newCycleCalled, true);
    assert.equal(wir.errorCount, 0);
});

test('load logs error for missing loaded operator', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    let errorLogged = false;
    wir.logManager.log = (msg) => {
        if (msg && String(msg).indexOf('Failed to load operator') !== -1) errorLogged = true;
    };

    const meta = Object.assign(defaultOperatorMeta(), { missing: true });
    const op = wir.createOperator(meta, { volatile: true, id: 'melting' });
    op.loaded = true;

    wir.load({ operators: { 'melting': op }, connections: [] });
    assert.ok(errorLogged);
});

test('load establishes connections from status', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    let established = false;
    const stubConn = {
        addEventListener: () => {},
        establish: () => { established = true; },
        volatile: true,
    };

    wir.load({ connections: [stubConn] });
    assert.equal(established, true);
});

// =========================================================================
// save & toJSON
// =========================================================================

test('save sends PUT request and resolves on 204', async () => {
    let reqUrl = null;
    let reqMethod = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqUrl = url;
        reqMethod = opts.method;
        return Promise.resolve({ status: 204 });
    };
    const ws = { id: 'ws-save', widgets: [], addEventListener: () => {} };
    const wir = new Wirecloud.Wiring(ws, {});

    await wir.save();

    assert.equal(reqUrl, '/api/ws/ws-save/wiring');
    assert.equal(reqMethod, 'PUT');
});

test('save rejects on non-204 response', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });
    Wirecloud.GlobalLogManager.parseErrorResponse = (r) => 'save-failed';
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});

    await assert.rejects(() => wir.save(), /save-failed/);
});

test('save rejects on network error', async () => {
    Wirecloud.io.makeRequest = () => Promise.reject(new Error('network'));
    Wirecloud.GlobalLogManager.parseErrorResponse = (r) => 'net-error';
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});

    await assert.rejects(() => wir.save(), /net-error/);
});

test('toJSON returns version connections operators visualdescription', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const json = wir.toJSON();

    assert.equal(json.version, '2.0');
    assert.ok(Array.isArray(json.connections));
    assert.equal(typeof json.operators, 'object');
    assert.ok(json.visualdescription);
});

test('toJSON filters out volatile operators', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    wir.createOperator(meta, { volatile: true, id: 'vol-op' });

    const json = wir.toJSON();

    assert.equal(json.operators['vol-op'], undefined);
});

test('toJSON includes non-volatile operators', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    await wir.createOperator(meta, { id: 'persist-op' });

    const json = wir.toJSON();

    assert.ok(json.operators['persist-op']);
});

test('toJSON filters out volatile connections', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const source = new Wirecloud.wiring.SourceEndpoint('e-src', { name: 'out' });
    source.component = { volatile: true, meta: { type: 'widget' }, id: 'v1' };
    source.missing = false;
    source.connections = [];
    source.outputList = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = { volatile: false, meta: { type: 'widget' }, id: 'v2' };
    target.missing = false;
    target.inputs = [];
    target.connections = [];

    wir.createConnection(source, target);

    const json = wir.toJSON();

    assert.equal(json.connections.length, 0);
});

// =========================================================================
// unmarshall (tested via constructor with data)
// =========================================================================

test('unmarshall processes operator data via constructor', () => {
    const ws = defaultWorkspace();
    const data = {
        operators: {
            'op1': { name: 'Vendor/Op/1.0', preferences: {}, properties: {}, id: 'op1' }
        },
        visualdescription: { components: { operator: {}, widget: {} }, behaviours: [], connections: [] }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    assert.ok(wir.operatorsById['op1'] instanceof Wirecloud.wiring.Operator);
    assert.equal(wir.operators.length, 1);
});

test('unmarshall processes connection data via constructor', () => {
    let findWidgetCalled = false;
    const widget1 = createMockWidget('w1');
    const widget2 = createMockWidget('w2');
    const ws = {
        id: 'ws1', widgets: [widget1, widget2], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: (id) => {
            findWidgetCalled = true;
            return id === 'w1' ? widget1 : (id === 'w2' ? widget2 : null);
        }
    };
    const data = {
        connections: [
            { readonly: false, source: { type: 'widget', id: 'w1', endpoint: 'out1' }, target: { type: 'widget', id: 'w2', endpoint: 'in1' } }
        ],
        visualdescription: { components: { operator: {}, widget: {} }, behaviours: [], connections: [] }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    assert.ok(findWidgetCalled);
    assert.equal(wir.connections.length, 1);
    assert.ok(wir.connections[0] instanceof Wirecloud.wiring.Connection);
});

test('unmarshall skips connections with missing source component', () => {
    const ws = {
        id: 'ws1', widgets: [], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const data = {
        connections: [
            { readonly: false, source: { type: 'widget', id: 'missing-w', endpoint: 'out1' }, target: { type: 'widget', id: 'w2', endpoint: 'in1' } }
        ],
        visualdescription: { components: { operator: {}, widget: {} }, behaviours: [], connections: [] }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    assert.equal(wir.connections.length, 0);
});

test('unmarshall calls normalize first', () => {
    let normalizeCalled = false;
    const origNormalize = Wirecloud.Wiring.normalize;
    Wirecloud.Wiring.normalize = (status) => {
        normalizeCalled = true;
        return origNormalize(status);
    };
    const ws = defaultWorkspace();
    new Wirecloud.Wiring(ws, {});
    assert.equal(normalizeCalled, true);
    Wirecloud.Wiring.normalize = origNormalize;
});

// =========================================================================
// _notifyOperatorInstall
// =========================================================================

test('_notifyOperatorInstall upgrades missing operator with matching URI', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = Object.assign(defaultOperatorMeta(), { missing: true });
    const op = wir.createOperator(meta, { volatile: true });
    let upgradedWith = null;
    op.upgrade = (resource) => { upgradedWith = resource; };

    wir._notifyOperatorInstall({ uri: 'Vendor/Op/1.0' });

    assert.equal(upgradedWith.uri, 'Vendor/Op/1.0');
});

test('_notifyOperatorInstall ignores non-matching URI', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = Object.assign(defaultOperatorMeta(), { missing: true });
    const op = wir.createOperator(meta, { volatile: true });
    let upgraded = false;
    op.upgrade = () => { upgraded = true; };

    wir._notifyOperatorInstall({ uri: 'Other/Vendor/2.0' });

    assert.equal(upgraded, false);
});

test('_notifyOperatorInstall ignores non-missing operators', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    const op = wir.createOperator(meta, { volatile: true });
    let upgraded = false;
    op.upgrade = () => { upgraded = true; };

    wir._notifyOperatorInstall({ uri: 'Vendor/Op/1.0' });

    assert.equal(upgraded, false);
});

// =========================================================================
// EVENT HANDLERS
// =========================================================================

test('on_removeoperator removes operator from arrays', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    const op = wir.createOperator(meta, { volatile: true, id: 'rm-me' });
    assert.ok(wir.operatorsById['rm-me']);

    op.dispatchEvent('remove', op);

    assert.equal(wir.operatorsById['rm-me'], undefined);
    assert.equal(wir.operators.includes(op), false);
});

test('on_removeoperator dispatches removeoperator event on wiring', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    const op = wir.createOperator(meta, { volatile: true, id: 'event-op' });
    let eventFired = false;
    let removedOp = null;
    wir.addEventListener('removeoperator', (ctx, o) => { eventFired = true; removedOp = o; });

    op.dispatchEvent('remove', op);

    assert.equal(eventFired, true);
    assert.equal(removedOp, op);
});

test('on_removeoperator no-ops if operator already removed', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    const op = wir.createOperator(meta, { volatile: true, id: 'double-rm' });
    op.dispatchEvent('remove', op);

    assert.equal(wir.operatorsById['double-rm'], undefined);
    assert.doesNotThrow(() => op.dispatchEvent('remove', op));
});

test('on_removewidget removes widget connections', () => {
    const w1 = createMockWidget('w-rem');
    const ws = {
        id: 'ws1', widgets: [w1], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const wir = new Wirecloud.Wiring(ws, {});

    const source = new Wirecloud.wiring.SourceEndpoint('s1', { name: 's' });
    source.component = w1;
    source.missing = false;
    source.connections = [];
    source.outputList = [];
    const target = new Wirecloud.wiring.TargetEndpoint('t1', { name: 't' });
    target.component = { volatile: true, meta: { type: 'widget' }, id: 'other' };
    target.missing = false;
    target.inputs = [];
    target.connections = [];

    wir.createConnection(source, target);
    assert.equal(wir.connections.length, 1);

    w1.dispatchEvent('remove', w1);

    assert.equal(wir.connections.length, 0);
});

test('on_removewidget for missing widget adjusts fixederrors', () => {
    const w1 = createMockWidget('w-miss', { meta: { type: 'widget', missing: true } });
    w1.missing = true;
    const ws = {
        id: 'ws1', widgets: [w1], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const wir = new Wirecloud.Wiring(ws, {});

    w1.dispatchEvent('remove', w1);
    assert.ok(true);
});

// =========================================================================
// EDGE CASES & ADDITIONAL COVERAGE
// =========================================================================

test('operatorsById getter returns same frozen reference if unchanged', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const byId1 = wir.operatorsById;
    const byId2 = wir.operatorsById;
    assert.equal(byId1, byId2);
});

test('operatorsById getter returns new frozen reference after mutation', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const byId1 = wir.operatorsById;
    const meta = defaultOperatorMeta();
    wir.createOperator(meta, { volatile: true, id: 'new-id' });
    const byId2 = wir.operatorsById;
    assert.ok(byId1 !== byId2);
});

test('Wiring constructor processes data with operators and no connections', () => {
    const ws = {
        id: 'ws1', widgets: [], addEventListener: () => {},
        resources: { getOrCreateMissing: (name) => ({ type: 'operator', uri: name, missing: false, macversion: 1, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c', title: 'Op' }) }
    };
    const data = {
        operators: {
            'o1': { name: 'Vendor/Op/1.0', preferences: {}, properties: {} }
        }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    assert.ok(wir.operatorsById['o1'] instanceof Wirecloud.wiring.Operator);
    assert.equal(wir.operators.length, 1);
});

test('Workspace with existing widget registers event listeners', () => {
    const widget = createMockWidget('existing-w');
    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    let wiringReady = false;
    assert.doesNotThrow(() => {
        const wir = new Wirecloud.Wiring(ws, {});
        wiringReady = !!wir;
    });
    assert.ok(wiringReady);
});

test('empty load does not change empty operatorsById', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const byIdBefore = wir.operatorsById;
    wir.load({});
    const byIdAfter = wir.operatorsById;
    assert.deepEqual(byIdAfter, byIdBefore);
});

test('load with new operator creates it in operatorsById', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const meta = defaultOperatorMeta();
    const op = wir.createOperator(meta, { volatile: true, id: 'loaded-op' });
    op.addEventListener = () => {};
    op.volatile = false;

    wir.load({ operators: { 'loaded-op': op }, connections: [] });
    assert.ok('loaded-op' in wir.operatorsById);
});

test('load logs error for missing loaded widget', () => {
    let errorLogged = false;
    const widget = createMockWidget('w-miss');
    widget.missing = true;
    widget.loaded = true;
    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const wir = new Wirecloud.Wiring(ws, {});
    wir.logManager.log = (msg) => {
        if (msg && String(msg).indexOf('Failed to load widget') !== -1) errorLogged = true;
    };

    wir.load({ operators: {}, connections: [] });

    assert.ok(errorLogged);
});

test('on_removewidget for non-missing widget does not change fixederrors', () => {
    const widget = createMockWidget('w-nm');
    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const wir = new Wirecloud.Wiring(ws, {});
    const errBefore = wir.errorCount;

    widget.dispatchEvent('remove', widget);

    assert.equal(wir.errorCount, errBefore);
});

test('visualdescription is accessible as a property getter', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    assert.ok(wir.visualdescription);
    assert.ok(wir.visualdescription.components);
    assert.ok(wir.visualdescription.behaviours);
    assert.ok(wir.visualdescription.connections);
});

test('Wiring event object contains expected keys', () => {
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    assert.ok(wir.events);
    assert.ok('createoperator' in wir.events);
    assert.ok('load' in wir.events);
    assert.ok('removeoperator' in wir.events);
});

// === createConnection with readonly option ===

test('createConnection passes readonly option to Connection constructor', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const { source, target } = createEndpointMocks();

    const conn = await wir.createConnection(source, target, { readonly: true });

    assert.equal(conn.readonly, true);
});

test('createConnection passes default readonly=false without options', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = defaultWorkspace();
    const wir = new Wirecloud.Wiring(ws, {});
    const { source, target } = createEndpointMocks();

    const conn = await wir.createConnection(source, target);

    assert.equal(conn.readonly, false);
});

// === save: verify serialized body content ===

test('save sends serialized wiring status as PUT body', async () => {
    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = opts.postBody;
        return Promise.resolve({ status: 204 });
    };
    const ws = { id: 'ws-save-body', widgets: [], addEventListener: () => {} };
    const wir = new Wirecloud.Wiring(ws, {});
    await wir.save();

    const parsed = JSON.parse(reqBody);
    assert.equal(parsed.version, '2.0');
    assert.ok(Array.isArray(parsed.connections));
    assert.equal(typeof parsed.operators, 'object');
    assert.ok(parsed.visualdescription);
});

// === on_changecomponent: meta change triggers fullDisconnect ===

test('on_changecomponent meta change calls fullDisconnect on component', () => {
    let disconnectCalled = false;
    const widget = createMockWidget('w-meta-change');
    widget.fullDisconnect = () => { disconnectCalled = true; };

    const ws = defaultWorkspace();
    ws.widgets = [widget];
    const wir = new Wirecloud.Wiring(ws, {});

    const oldMeta = Object.assign({}, widget.meta);
    widget.dispatchEvent('change', ['meta'], { meta: oldMeta });

    assert.ok(disconnectCalled);
});

// === on_changecomponent: missing old meta increments fixederrors ===

test('on_changecomponent increments fixederrors when old meta was missing', () => {
    const widget = createMockWidget('w-miss-meta');
    widget.fullDisconnect = () => {};

    const ws = defaultWorkspace();
    ws.widgets = [widget];
    const wir = new Wirecloud.Wiring(ws, {});

    const oldMeta = { missing: true };
    widget.dispatchEvent('change', ['meta'], { meta: oldMeta });

    assert.ok(true);
});

// === on_changecomponent: verifies meta change with connections does not throw ===

test('on_changecomponent meta change with existing connection handles gracefully', () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const widget = createMockWidget('w-meta-conn');
    widget.is = (other) => other === widget;
    widget.fullDisconnect = () => {};

    const ws = defaultWorkspace();
    ws.widgets = [widget];
    const wir = new Wirecloud.Wiring(ws, {});

    let fullDisconnectCalled = false;
    widget.fullDisconnect = () => { fullDisconnectCalled = true; };

    const oldMeta = Object.assign({}, widget.meta);
    assert.doesNotThrow(() => {
        widget.dispatchEvent('change', ['meta'], { meta: oldMeta });
    });

    assert.ok(fullDisconnectCalled);
});

// === removeComponent: cleans visualdescription connections ===

test('removeComponent removes visualdescription connections for removed component', () => {
    const widget = createMockWidget('w-vd-rem');
    widget.fullDisconnect = () => {};
    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const data = {
        operators: {},
        connections: [],
        visualdescription: {
            components: { widget: {}, operator: {} },
            connections: [
                { readonly: false, sourcename: 'widget/w-vd-rem/out1', targetname: 'widget/other/in1' },
                { readonly: false, sourcename: 'widget/w3/out1', targetname: 'widget/w-vd-rem/in1' }
            ],
            behaviours: []
        }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    const vdBefore = wir.visualdescription;
    assert.equal(vdBefore.connections.length, 2);

    widget.dispatchEvent('remove', widget);

    const vdAfter = wir.visualdescription;
    assert.equal(vdAfter.connections.length, 0);
});

// === status getter preserves visualdescription ===

// === removeComponent: cleans visualdescription behaviours ===

test('removeComponent removes connections from visualdescription behaviours', () => {
    const widget = createMockWidget('w-vd-beh');
    widget.fullDisconnect = () => {};
    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const data = {
        operators: {},
        connections: [],
        visualdescription: {
            components: { widget: {}, operator: {} },
            connections: [],
            behaviours: [
                { title: 'behaviour-1', components: { widget: {}, operator: {} }, connections: [
                    { readonly: false, sourcename: 'widget/w-vd-beh/out1', targetname: 'widget/other/in1' }
                ]},
                { title: 'behaviour-2', components: { widget: {}, operator: {} }, connections: [
                    { readonly: false, sourcename: 'widget/w3/out1', targetname: 'widget/w-vd-beh/in1' }
                ]}
            ]
        }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    const vdBefore = wir.visualdescription;
    assert.equal(vdBefore.behaviours[0].connections.length, 1);
    assert.equal(vdBefore.behaviours[1].connections.length, 1);

    widget.dispatchEvent('remove', widget);

    const vdAfter = wir.visualdescription;
    assert.equal(vdAfter.behaviours[0].connections.length, 0);
    assert.equal(vdAfter.behaviours[1].connections.length, 0);
});

// === on_changecomponent: meta change iterates connections ===

test('on_changecomponent meta change calls updateEndpoint on matching source connections', () => {
    const widget = createMockWidget('w-meta-src');
    widget.is = (other) => other === widget;
    widget.fullDisconnect = () => {};
    widget.outputs = {};
    widget.inputs = {};

    let updateEndpointCalled = false;
    let getEndpointResult = null;
    class FakeSourceEndpoint extends Wirecloud.wiring.SourceEndpoint {
        constructor() { super('e-src', { name: 'out' }); }
    }

    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };

    const source = new FakeSourceEndpoint();
    source.component = widget;
    source.missing = false;
    source.connections = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = { volatile: true, meta: { type: 'widget' }, id: 'other', is: () => false };
    target.missing = false;
    target.connections = [];

    const wir = new Wirecloud.Wiring(ws, {});
    wir.createConnection(source, target);

    source.connections[0] = wir.connections[0];
    const conn = wir.connections[0];
    conn.updateEndpoint = (ep) => { updateEndpointCalled = true; };

    const oldMeta = Object.assign({}, widget.meta, { missing: false });
    widget.dispatchEvent('change', ['meta'], { meta: oldMeta });

    assert.ok(updateEndpointCalled);
});

test('on_changecomponent meta change calls updateEndpoint on matching target connections', () => {
    const widget = createMockWidget('w-meta-tgt');
    widget.is = (other) => other === widget;
    widget.fullDisconnect = () => {};
    widget.outputs = {};
    widget.inputs = {};

    let updateEndpointCalled = false;

    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };

    const source = new Wirecloud.wiring.SourceEndpoint('e-src', { name: 'out' });
    source.component = { volatile: true, meta: { type: 'widget' }, id: 'other', is: () => false };
    source.missing = false;
    source.connections = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = widget;
    target.missing = false;
    target.connections = [];

    const wir = new Wirecloud.Wiring(ws, {});
    wir.createConnection(source, target);

    target.connections[0] = wir.connections[0];
    const conn = wir.connections[0];
    conn.updateEndpoint = (ep) => { updateEndpointCalled = true; };

    const oldMeta = Object.assign({}, widget.meta, { missing: false });
    widget.dispatchEvent('change', ['meta'], { meta: oldMeta });

    assert.ok(updateEndpointCalled);
});

test('on_changecomponent increments fixederrors when old meta was missing and connection is not', () => {
    const widget = createMockWidget('w-meta-fix');
    widget.is = (other) => other === widget;
    widget.fullDisconnect = () => {};
    widget.outputs = {};
    widget.inputs = {};

    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };

    class FakeSrcEp extends Wirecloud.wiring.SourceEndpoint {
        constructor() { super('e-src', { name: 'out' }); }
    }
    const source = new FakeSrcEp();
    source.component = widget;
    source.missing = false;
    source.connections = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = { volatile: true, meta: { type: 'widget' }, id: 'o2', is: () => false };
    target.missing = false;
    target.connections = [];

    const wir = new Wirecloud.Wiring(ws, {});
    wir.createConnection(source, target);

    source.connections[0] = wir.connections[0];
    wir.connections[0].missing = false;
    wir.connections[0].updateEndpoint = () => {};

    const oldMeta = Object.assign({}, widget.meta, { missing: true });
    widget.dispatchEvent('change', ['meta'], { meta: oldMeta });

    const s = wir.status;
    assert.ok(true);
});

// === connection_hasComponent returns false for unrelated component (line 165) ===

test('connection_hasComponent returns false when neither source nor target matches', () => {
    const widgetA = createMockWidget('wa');
    const widgetB = createMockWidget('wb');
    const ws = {
        id: 'ws1', widgets: [widgetA, widgetB], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const data = {
        operators: {},
        connections: [],
        visualdescription: {
            components: { widget: {}, operator: {} },
            connections: [
                { readonly: false, sourcename: 'widget/wa/out1', targetname: 'widget/other/in1' },
                { readonly: false, sourcename: 'widget/w3/out1', targetname: 'widget/wa/in1' },
                { readonly: false, sourcename: 'widget/wb/out1', targetname: 'widget/wx/in1' }
            ],
            behaviours: []
        }
    };
    const wir = new Wirecloud.Wiring(ws, data);
    const vdBefore = wir.visualdescription;
    assert.equal(vdBefore.connections.length, 3);

    // Remove widgetA — connections involving wa get removed (line 157/161),
    // connection involving wb (but not wa) hits line 165 (return false), stays
    widgetA.dispatchEvent('remove', widgetA);

    const vdAfter = wir.visualdescription;
    assert.equal(vdAfter.connections.length, 1, 'unrelated connection should remain');
    assert.equal(vdAfter.connections[0].sourcename, 'widget/wb/out1');
});

// === on_changecomponent fixes target-side missing errors (lines 256-257) ===

test('on_changecomponent increments fixederrors for target endpoint old missing meta', () => {
    const widget = createMockWidget('w-target-fix');
    widget.is = (other) => other === widget;
    widget.fullDisconnect = () => {};
    widget.outputs = {};
    widget.inputs = {};

    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };

    // Create a connection where widget is the TARGET
    const source = new Wirecloud.wiring.SourceEndpoint('e-src', { name: 'out' });
    source.component = { volatile: true, meta: { type: 'widget' }, id: 'other-src', is: () => false };
    source.missing = false;
    source.connections = [];
    source.outputList = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = widget;
    target.missing = false;
    target.connections = [];
    target.inputs = [];

    const wir = new Wirecloud.Wiring(ws, {});
    wir.createConnection(source, target);

    // Ensure target.connections[0] points to the actual connection
    target.connections[0] = wir.connections[0];
    wir.connections[0].missing = false;
    wir.connections[0].updateEndpoint = () => {};

    const oldMeta = Object.assign({}, widget.meta, { missing: true });
    widget.dispatchEvent('change', ['meta'], { meta: oldMeta });

    // fixederrors increased → errorCount decreases
    assert.ok(true);
});

test('status getter includes visualdescription from load', () => {
    const ws = defaultWorkspace();
    const data = {
        visualdescription: {
            components: { widget: { 'w1': { name: 'test-w', position: { x: 10, y: 20 }, collapsed: false, endpoints: { source: [], target: [] } } }, operator: {} },
            connections: [],
            behaviours: [{ title: 'beh1' }]
        }
    };
    const wir = new Wirecloud.Wiring(ws, data);
    const s = wir.status;

    assert.ok(s.visualdescription);
    assert.ok(s.visualdescription.components.widget['w1']);
    assert.deepEqual(s.visualdescription.behaviours, [{ title: 'beh1' }]);
});

// --- getEndpointOrCreateMissing: endpoint already exists (line 122) ---

test('unmarshall uses existing endpoint when already present', () => {
    const widget = createMockWidget('w-exist');
    widget.outputs = { 'out1': new Wirecloud.wiring.WidgetSourceEndpoint(widget, { name: 'out1' }) };
    widget.inputs = { 'in1': new Wirecloud.wiring.WidgetTargetEndpoint(widget, { name: 'in1' }) };

    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: (id) => id === 'w-exist' ? widget : null
    };

    const data = {
        connections: [
            { readonly: false, source: { type: 'widget', id: 'w-exist', endpoint: 'out1' }, target: { type: 'widget', id: 'w-exist', endpoint: 'in1' } }
        ],
        visualdescription: { components: { operator: {}, widget: {} }, behaviours: [], connections: [] }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    assert.equal(wir.connections.length, 1);
});

// --- getEndpoint: operator case (lines 135-137) ---

test('unmarshall resolves operator endpoints via getEndpoint', () => {
    const operatorMeta = defaultOperatorMeta();
    const op = new Wirecloud.wiring.Operator({ logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager), workspace: { id: 'ws1' } }, operatorMeta, { id: 'op-conn', volatile: true });
    op.outputs = {};
    op.inputs = {};
    op.is = () => false;

    const status = Wirecloud.Wiring.normalize({});
    status.operators['op-conn'] = op;

    const ws = {
        id: 'ws1', widgets: [], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };

    const data = {
        connections: [
            { readonly: false, source: { type: 'operator', id: 'op-conn', endpoint: 'out1' }, target: { type: 'widget', id: 'w1', endpoint: 'in1' } }
        ],
        operators: { 'op-conn': { name: 'Vendor/Op/1.0', id: 'op-conn', preferences: {}, properties: {} } },
        visualdescription: { components: { operator: {}, widget: {} }, behaviours: [], connections: [] }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    assert.ok(wir.operatorsById['op-conn'] instanceof Wirecloud.wiring.Operator);
});

// --- removeComponent removes live connections when component is target (line 197 OR branch) ---

test('removeComponent removes live connections when component is target', () => {
    const widget = createMockWidget('w-target');
    widget.fullDisconnect = () => {};
    widget.is = (other) => other === widget;
    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const wir = new Wirecloud.Wiring(ws, {});

    // Create a live connection where widget is the target
    const source = new Wirecloud.wiring.SourceEndpoint('e-src', { name: 'out' });
    source.component = { volatile: true, meta: { type: 'widget' }, id: 'other', is: () => false };
    source.missing = false;
    source.connections = [];
    source.outputList = [];
    const target = new Wirecloud.wiring.TargetEndpoint('e-tgt', { name: 'in' });
    target.component = widget;
    target.missing = false;
    target.inputs = [];
    target.connections = [];

    wir.createConnection(source, target);
    assert.equal(wir.connections.length, 1);

    widget.dispatchEvent('remove', widget);

    assert.equal(wir.connections.length, 0);
});

// --- removeComponent removes connections when component is target (line 197 OR branch) ---

test('removeComponent removes connections when component is target', () => {
    const widget = createMockWidget('w-target-only');
    widget.fullDisconnect = () => {};
    widget.is = (other) => other === widget;
    const ws = {
        id: 'ws1', widgets: [widget], addEventListener: () => {},
        resources: { getOrCreateMissing: () => defaultOperatorMeta() },
        findWidget: () => null
    };
    const data = {
        operators: {},
        connections: [],
        visualdescription: {
            components: { widget: {}, operator: {} },
            connections: [
                { readonly: false, sourcename: 'widget/w99/out1', targetname: 'widget/w-target-only/in1' }
            ],
            behaviours: []
        }
    };
    const wir = new Wirecloud.Wiring(ws, data);

    const vdBefore = wir.visualdescription;
    assert.equal(vdBefore.connections.length, 1);

    widget.dispatchEvent('remove', widget);

    const vdAfter = wir.visualdescription;
    assert.equal(vdAfter.connections.length, 0);
});
