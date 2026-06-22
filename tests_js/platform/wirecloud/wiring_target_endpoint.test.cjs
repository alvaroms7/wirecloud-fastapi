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

test('TargetEndpoint constructor initializes inputs and connections', () => {
    const te = new Wirecloud.wiring.TargetEndpoint('te1', { name: 'in' });

    assert.deepEqual(te.inputs, []);
    assert.deepEqual(te.connections, []);
    assert.equal(te.name, 'in');
});

test('TargetEndpoint connect delegates to source endpoint', () => {
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });

    let connected = false;
    se.connect = (target, conn) => { connected = true; };

    const fakeConnection = {};
    te.connect(se, fakeConnection);
    assert.equal(connected, true);
});

test('TargetEndpoint connect throws on invalid source', () => {
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    assert.throws(
        () => te.connect({}),
        /Invalid source endpoint/
    );
});

test('TargetEndpoint disconnect throws on invalid source', () => {
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    assert.throws(
        () => te.disconnect({}),
        /Invalid source endpoint/
    );
});

test('TargetEndpoint propagate is no-op by default', () => {
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    assert.doesNotThrow(() => te.propagate('data'));
});

test('TargetEndpoint _addInput adds source endpoint', () => {
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = {};

    te._addInput(se, conn);
    assert.deepEqual(te.inputs, [se]);
    assert.deepEqual(te.connections, [conn]);
});

test('TargetEndpoint _removeInput removes source endpoint', () => {
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = {};

    te._addInput(se, conn);
    te._removeInput(se, conn);

    assert.deepEqual(te.inputs, []);
    assert.deepEqual(te.connections, []);
});

test('TargetEndpoint fullDisconnect removes all inputs', () => {
    const se1 = new Wirecloud.wiring.SourceEndpoint('se1', { name: 'out1' });
    const se2 = new Wirecloud.wiring.SourceEndpoint('se2', { name: 'out2' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });

    let disconnectCalls = 0;
    se1.disconnect = () => { disconnectCalls++; };
    se2.disconnect = () => { disconnectCalls++; };

    te._addInput(se1, {});
    te._addInput(se2, {});

    te.fullDisconnect();
    assert.equal(disconnectCalls, 2);
});

test('TargetEndpoint disconnect delegates to source endpoint', () => {
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });

    let disconnected = false;
    se.disconnect = (target) => { disconnected = true; };

    te.disconnect(se);
    assert.equal(disconnected, true);
});
