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
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('SourceEndpoint constructor initializes outputList and connections', () => {
    const se = new Wirecloud.wiring.SourceEndpoint('se1', { name: 'out' });

    assert.deepEqual(se.outputList, []);
    assert.deepEqual(se.connections, []);
    assert.equal(se.name, 'out');
});

test('SourceEndpoint connect throws on invalid target', () => {
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    assert.throws(
        () => se.connect({}, {}),
        /Invalid target endpoint/
    );
});

test('SourceEndpoint connect adds valid target endpoint', () => {
    // Need TargetEndpoint
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const fakeConnection = { _connect: () => {}, _disconnect: () => {} };

    se.connect(te, fakeConnection);

    assert.ok(se.outputList.includes(te));
    assert.ok(se.connections.includes(fakeConnection));
    assert.ok(te.inputs.includes(se));
});

test('SourceEndpoint disconnect removes target endpoint', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const fakeConnection = { _connect: () => {}, _disconnect: () => {} };

    se.connect(te, fakeConnection);
    se.disconnect(te);

    assert.equal(se.outputList.length, 0);
    assert.equal(se.connections.length, 0);
    assert.equal(te.inputs.length, 0);
});

test('SourceEndpoint disconnect with invalid target throws', () => {
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    assert.throws(
        () => se.disconnect({}),
        /Invalid target endpoint/
    );
});

test('SourceEndpoint disconnect with unconnected target is no-op', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    se.disconnect(te); // No-op, not connected

    assert.equal(se.outputList.length, 0);
});

test('SourceEndpoint fullDisconnect removes all connections', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te1 = new Wirecloud.wiring.TargetEndpoint('te1', { name: 'in1' });
    const te2 = new Wirecloud.wiring.TargetEndpoint('te2', { name: 'in2' });
    const c1 = { _connect: () => {}, _disconnect: () => {} };
    const c2 = { _connect: () => {}, _disconnect: () => {} };

    se.connect(te1, c1);
    se.connect(te2, c2);
    se.fullDisconnect();

    assert.equal(se.outputList.length, 0);
});

test('SourceEndpoint formatException returns exception string', () => {
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const err = new Error('test error');
    assert.equal(se.formatException(err), err.toString());
});

test('SourceEndpoint propagate sends value to all targets', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    let propagatedValue = null;
    te.propagate = (value) => { propagatedValue = value; };

    const fakeConnection = { _connect: () => {}, logManager: { log: () => {} } };
    se.connect(te, fakeConnection);
    se.propagate('hello');

    assert.equal(propagatedValue, 'hello');
});

test('SourceEndpoint propagate with object value clones it', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    let propagatedValue = null;
    te.propagate = (value) => { propagatedValue = value; };

    const fakeConnection = { _connect: () => {}, logManager: { log: () => {} } };
    se.connect(te, fakeConnection);
    const obj = { a: 1 };
    se.propagate(obj);

    assert.deepEqual(propagatedValue, { a: 1 });
    assert.notStrictEqual(propagatedValue, obj);
});

test('SourceEndpoint propagate with null is not cloned', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    let propagatedValue = undefined;
    te.propagate = (value) => { propagatedValue = value; };

    const fakeConnection = { _connect: () => {}, logManager: { log: () => {} } };
    se.connect(te, fakeConnection);
    se.propagate(null);
    assert.equal(propagatedValue, null);
});

test('SourceEndpoint propagate handles errors in target propagation', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    te.propagate = () => { throw new Error('prop fail'); };

    let logMsg = null;
    const fakeConnection = { _connect: () => {}, logManager: { log: (msg) => { logMsg = msg; } } };
    se.connect(te, fakeConnection);
    se.propagate('hello');

    assert.ok(logMsg != null);
});

test('SourceEndpoint getReachableEndpoints aggregates target endpoints', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
    ]);

    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    te.getReachableEndpoints = () => [{ id: 'reachable' }];

    const fakeConnection = { _connect: () => {}, _disconnect: () => {} };
    se.connect(te, fakeConnection);

    const reachable = se.getReachableEndpoints();
    assert.deepEqual(reachable, [{ id: 'reachable' }]);
});
