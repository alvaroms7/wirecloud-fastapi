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
    Wirecloud.constants = {
        LOGGING: {
            ERROR_MSG: 1,
            WARN_MSG: 2,
            INFO_MSG: 3,
            DEBUG_MSG: 4
        }
    };

    // Wirecloud.LogManager mock
    Wirecloud.LogManager = class LogManager {
        constructor(parent) {
            this.parent = parent;
            this.errorCount = 0;
        }
        log() {}
        newCycle() {}
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/Endpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/TargetEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/SourceEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/Connection.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('Connection constructor creates connection', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });

    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    assert.equal(conn.established, false);
    assert.equal(conn.source, se);
    assert.equal(conn.target, te);
    assert.equal(conn.readonly, false);
    assert.equal(conn.wiring, fakeWiring);
    assert.equal(conn.id, 'se//te');
});

test('Connection toJSON returns correct shape', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, { readonly: true });

    const json = conn.toJSON();
    assert.equal(json.readonly, true);
    assert.equal(typeof json.source, 'object');
    assert.equal(typeof json.target, 'object');
});

test('Connection showLogs creates and shows log window', () => {
    let shown = false;
    Wirecloud.ui = { LogWindowMenu: class { constructor(lm, opts) { this.lm = lm; } show() { shown = true; } } };
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    const result = conn.showLogs();
    assert.equal(shown, true);
    assert.equal(result, conn);
});

test('Connection constructor with readonly option', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });

    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, { readonly: true });

    assert.equal(conn.readonly, true);
});

test('Connection volatile property when source is volatile', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    se.component = { volatile: true };
    te.component = { volatile: false };

    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    assert.equal(conn.volatile, true);
});

test('Connection establish connects source to target', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    conn.establish();

    assert.equal(conn.established, true);
    assert.ok(se.outputList.includes(te));
});

test('Connection establish is idempotent', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    conn.establish();
    conn.establish();

    assert.equal(conn.established, true);
});

test('Connection establish with missing source logs error', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    se.missing = true;
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    conn.establish();

    // Should not be established when missing
    assert.equal(conn.established, false);
});

test('Connection detach disconnects source from target', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    conn.establish();
    conn.detach();

    assert.equal(conn.established, false);
});

test('Connection detach is idempotent', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    conn.detach(); // Should not throw when not established

    assert.equal(conn.established, false);
});

test('Connection equals checks id', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se1 = new Wirecloud.wiring.SourceEndpoint('se1', { name: 'out' });
    const te1 = new Wirecloud.wiring.TargetEndpoint('te1', { name: 'in' });
    const se2 = new Wirecloud.wiring.SourceEndpoint('se2', { name: 'out' });
    const te2 = new Wirecloud.wiring.TargetEndpoint('te2', { name: 'in' });

    const conn1 = new Wirecloud.wiring.Connection(fakeWiring, se1, te1, {});
    const conn2 = new Wirecloud.wiring.Connection(fakeWiring, se1, te1, {});
    const conn3 = new Wirecloud.wiring.Connection(fakeWiring, se2, te2, {});

    assert.equal(conn1.equals(conn2), true);
    assert.equal(conn1.equals(conn3), false);
    assert.equal(conn1.equals({}), false);
});

test('Connection updateEndpoint updates source', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});
    conn.establish();

    const newSe = new Wirecloud.wiring.SourceEndpoint('newSe', { name: 'newOut' });
    conn.updateEndpoint(newSe);

    assert.equal(conn.source, newSe);
    assert.equal(conn.established, true);
});

test('Connection updateEndpoint updates target', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});
    conn.establish();

    const newTe = new Wirecloud.wiring.TargetEndpoint('newTe', { name: 'newIn' });
    conn.updateEndpoint(newTe);

    assert.equal(conn.target, newTe);
    assert.equal(conn.established, true);
});

test('Connection updateEndpoint throws with invalid endpoint', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    assert.throws(
        () => conn.updateEndpoint({}),
        /endpoint must be a Wirecloud.wiring.Endpoint instance/
    );
});

test('Connection remove dispatches remove event', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});
    conn.establish();

    let removed = false;
    conn.addEventListener('remove', () => { removed = true; });

    conn.remove();
    assert.equal(removed, true);
    assert.equal(conn.established, false);
});

// ---- Additional connection tests ---- //

test('toJSON returns deserializable plain object', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    const json = conn.toJSON();
    assert.equal(json.readonly, false);
    assert.equal(typeof json.source, 'object');
    assert.equal(typeof json.target, 'object');
    assert.ok(!(json.source instanceof Wirecloud.wiring.SourceEndpoint));
});

test('toJSON with readonly connection preserves readonly', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, { readonly: true });

    const json = conn.toJSON();
    assert.equal(json.readonly, true);
});

test('showLogs returns this', () => {
    Wirecloud.ui = { LogWindowMenu: class { constructor() {} show() {} } };
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    const result = conn.showLogs();
    assert.equal(result, conn);
});

test('showLogs passes logManager and title to LogWindowMenu', () => {
    let capturedLM = null, capturedOpts = null;
    Wirecloud.ui = { LogWindowMenu: class { constructor(lm, opts) { capturedLM = lm; capturedOpts = opts; } show() {} } };
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});

    conn.showLogs();
    assert.equal(capturedLM, conn.logManager);
    assert.ok(capturedOpts.title.includes('Connection'));
});

test('Connection volatile is true when target is volatile', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    se.component = { volatile: false };
    te.component = { volatile: true };

    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});
    assert.equal(conn.volatile, true);
});

test('Connection volatile is false when both stable', () => {
    const fakeWiring = { logManager: new Wirecloud.LogManager(Wirecloud.GlobalLogManager) };
    const se = new Wirecloud.wiring.SourceEndpoint('se', { name: 'out' });
    const te = new Wirecloud.wiring.TargetEndpoint('te', { name: 'in' });
    se.component = { volatile: false };
    te.component = { volatile: false };

    const conn = new Wirecloud.wiring.Connection(fakeWiring, se, te, {});
    assert.equal(conn.volatile, false);
});
