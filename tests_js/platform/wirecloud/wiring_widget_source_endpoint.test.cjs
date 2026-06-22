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
        'src/wirecloud/platform/static/js/wirecloud/wiring/WidgetSourceEndpoint.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('WidgetSourceEndpoint constructor with valid meta', () => {
    const fakeWidget = {
        id: 'w1',
        meta: { type: 'widget' }
    };
    const meta = { name: 'output1', friendcode: 'fc', label: 'Out', description: 'Output ep' };

    const ep = new Wirecloud.wiring.WidgetSourceEndpoint(fakeWidget, meta);

    assert.equal(ep.id, 'widget/w1/output1');
    assert.equal(ep.name, 'output1');
    assert.equal(ep.component, fakeWidget);
    assert.equal(ep.meta, meta);
    assert.equal(ep.missing, false);
});

test('WidgetSourceEndpoint with null meta', () => {
    const fakeWidget = { id: 'w1', meta: { type: 'widget' } };
    const ep = new Wirecloud.wiring.WidgetSourceEndpoint(fakeWidget, null);

    assert.equal(ep.id, null);
});

test('WidgetSourceEndpoint toString returns id', () => {
    const fakeWidget = { id: 'w1', meta: { type: 'widget' } };
    const ep = new Wirecloud.wiring.WidgetSourceEndpoint(fakeWidget, { name: 'out' });

    assert.equal(ep.toString(), 'widget/w1/out');
});

test('WidgetSourceEndpoint toJSON returns correct shape', () => {
    const fakeWidget = { id: 'w1', meta: { type: 'widget' } };
    const ep = new Wirecloud.wiring.WidgetSourceEndpoint(fakeWidget, { name: 'out' });

    const json = ep.toJSON();
    assert.deepEqual(json, { type: 'widget', id: 'w1', endpoint: 'out' });
});
