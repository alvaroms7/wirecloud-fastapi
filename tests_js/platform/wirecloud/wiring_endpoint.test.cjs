const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.wiring = {};
    Wirecloud.GlobalLogManager = { log: () => {} };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/Endpoint.js',
    ]);
});

test('Endpoint constructor with meta object', () => {
    const ep = new Wirecloud.wiring.Endpoint('ep1', {
        name: 'myEndpoint',
        friendcode: 'abc def',
        label: 'My Ep',
        description: 'An endpoint'
    });

    assert.equal(ep.id, 'ep1');
    assert.equal(ep.name, 'myEndpoint');
    assert.equal(ep.friendcode, 'abc def');
    assert.equal(ep.label, 'My Ep');
    assert.equal(ep.description, 'An endpoint');
    assert.deepEqual(ep.friendcodeList, ['abc', 'def']);
});

test('Endpoint constructor with empty meta', () => {
    const ep = new Wirecloud.wiring.Endpoint('ep2');

    assert.equal(ep.id, 'ep2');
    assert.equal(ep.name, undefined);
    assert.equal(ep.friendcode, '');
    assert.equal(ep.label, '');
    assert.equal(ep.description, '');
    assert.deepEqual(ep.friendcodeList, []);
});

test('Endpoint constructor with null meta', () => {
    const ep = new Wirecloud.wiring.Endpoint('ep3', null);

    assert.equal(ep.id, 'ep3');
    assert.equal(ep.friendcode, '');
    assert.deepEqual(ep.friendcodeList, []);
});

test('Endpoint getReachableEndpoints returns empty array', () => {
    const ep = new Wirecloud.wiring.Endpoint('ep', { name: 'e' });
    assert.deepEqual(ep.getReachableEndpoints(), []);
});

test('Endpoint fullDisconnect calls GlobalLogManager', () => {
    let logged = false;
    Wirecloud.GlobalLogManager.log = () => { logged = true; };

    const ep = new Wirecloud.wiring.Endpoint('ep', { name: 'e' });
    ep.fullDisconnect();
    assert.equal(logged, true);
});
