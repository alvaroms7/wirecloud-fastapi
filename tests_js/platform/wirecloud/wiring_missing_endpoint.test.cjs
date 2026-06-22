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
        'src/wirecloud/platform/static/js/wirecloud/wiring/MissingEndpoint.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('GhostSourceEndpoint constructor creates missing source', () => {
    const entity = {
        id: 'e1',
        meta: { type: 'widget' }
    };
    const ep = new Wirecloud.wiring.GhostSourceEndpoint(entity, 'missingOut');

    assert.equal(ep.id, 'widget/e1/missingOut');
    assert.equal(ep.name, 'missingOut');
    assert.equal(ep.label, 'missingOut');
    assert.equal(ep.component, entity);
    assert.equal(ep.meta, null);
    assert.equal(ep.missing, true);
});

test('GhostSourceEndpoint propagate is no-op', () => {
    const entity = { id: 'e1', meta: { type: 'widget' } };
    const ep = new Wirecloud.wiring.GhostSourceEndpoint(entity, 'ep');

    assert.doesNotThrow(() => ep.propagate('data'));
});

test('GhostSourceEndpoint toString returns id', () => {
    const entity = { id: 'e1', meta: { type: 'widget' } };
    const ep = new Wirecloud.wiring.GhostSourceEndpoint(entity, 'ep');

    assert.equal(ep.toString(), 'widget/e1/ep');
});

test('GhostSourceEndpoint toJSON returns correct shape', () => {
    const entity = { id: 'e1', meta: { type: 'widget' } };
    const ep = new Wirecloud.wiring.GhostSourceEndpoint(entity, 'ep');

    const json = ep.toJSON();
    assert.deepEqual(json, { type: 'widget', id: 'e1', endpoint: 'ep' });
});

test('GhostTargetEndpoint constructor creates missing target', () => {
    const entity = {
        id: 'e1',
        meta: { type: 'operator' }
    };
    const ep = new Wirecloud.wiring.GhostTargetEndpoint(entity, 'missingIn');

    assert.equal(ep.id, 'operator/e1/missingIn');
    assert.equal(ep.name, 'missingIn');
    assert.equal(ep.label, 'missingIn');
    assert.equal(ep.component, entity);
    assert.equal(ep.meta, null);
    assert.equal(ep.missing, true);
});

test('GhostTargetEndpoint propagate is no-op', () => {
    const entity = { id: 'e1', meta: { type: 'operator' } };
    const ep = new Wirecloud.wiring.GhostTargetEndpoint(entity, 'ep');

    assert.doesNotThrow(() => ep.propagate('data'));
});

test('GhostTargetEndpoint toString returns id', () => {
    const entity = { id: 'e1', meta: { type: 'operator' } };
    const ep = new Wirecloud.wiring.GhostTargetEndpoint(entity, 'ep');

    assert.equal(ep.toString(), 'operator/e1/ep');
});

test('GhostTargetEndpoint toJSON returns correct shape', () => {
    const entity = { id: 'e1', meta: { type: 'operator' } };
    const ep = new Wirecloud.wiring.GhostTargetEndpoint(entity, 'ep');

    const json = ep.toJSON();
    assert.deepEqual(json, { type: 'operator', id: 'e1', endpoint: 'ep' });
});
