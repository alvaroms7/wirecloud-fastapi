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
        'src/wirecloud/platform/static/js/wirecloud/wiring/SourceEndpoint.js',
        'src/wirecloud/platform/static/js/wirecloud/wiring/OperatorSourceEndpoint.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('OperatorSourceEndpoint constructor with valid meta', () => {
    const fakeOperator = {
        id: 'op1',
        meta: { type: 'operator' }
    };
    const meta = { name: 'output1', label: 'Out' };

    const ep = new Wirecloud.wiring.OperatorSourceEndpoint(fakeOperator, meta);

    assert.equal(ep.id, 'operator/op1/output1');
    assert.equal(ep.name, 'output1');
    assert.equal(ep.component, fakeOperator);
    assert.equal(ep.meta, meta);
    assert.equal(ep.missing, false);
});

test('OperatorSourceEndpoint with null meta', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' } };
    const ep = new Wirecloud.wiring.OperatorSourceEndpoint(fakeOperator, null);

    assert.equal(ep.id, null);
});

test('OperatorSourceEndpoint toString returns id', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' } };
    const ep = new Wirecloud.wiring.OperatorSourceEndpoint(fakeOperator, { name: 'out' });

    assert.equal(ep.toString(), 'operator/op1/out');
});

test('OperatorSourceEndpoint toJSON returns correct shape', () => {
    const fakeOperator = { id: 'op1', meta: { type: 'operator' } };
    const ep = new Wirecloud.wiring.OperatorSourceEndpoint(fakeOperator, { name: 'out' });

    const json = ep.toJSON();
    assert.deepEqual(json, { type: 'operator', id: 'op1', endpoint: 'out' });
});
