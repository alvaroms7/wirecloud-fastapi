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
    Wirecloud.wiring = {};
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/KeywordSuggestion.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWiring();
});

test('KeywordSuggestion initializes with empty endpoints', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    assert.deepEqual(ks.endpoints, { source: {}, target: {} });
});

test('KeywordSuggestion appendEndpoint adds endpoint', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const ep = {
        missing: false,
        friendcodeList: ['event'],
        type: 'source',
        component: { equals: () => false }
    };

    ks.appendEndpoint(ep);

    assert.ok(ks.endpoints.source['event']);
    assert.ok(ks.endpoints.source['event'].includes(ep));
});

test('KeywordSuggestion appendEndpoint with missing endpoint is no-op', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const ep = { missing: true, friendcodeList: ['event'] };

    ks.appendEndpoint(ep);

    assert.deepEqual(ks.endpoints, { source: {}, target: {} });
});

test('KeywordSuggestion appendEndpoint with multiple friendcodes', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const ep = {
        missing: false,
        friendcodeList: ['fc1', 'fc2'],
        type: 'target',
        component: { equals: () => false }
    };

    ks.appendEndpoint(ep);

    assert.ok(ks.endpoints.target['fc1']);
    assert.ok(ks.endpoints.target['fc2']);
});

test('KeywordSuggestion forEachSuggestion finds matching endpoints', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const component1 = { id: 'c1', equals: (c) => c === component1 };
    const component2 = { id: 'c2', equals: (c) => c === component2 };

    const ep1 = {
        missing: false,
        friendcodeList: ['event'],
        type: 'source',
        component: component1
    };
    const ep2 = {
        missing: false,
        friendcodeList: ['event'],
        type: 'target',
        component: component2
    };

    ks.appendEndpoint(ep1);

    const suggestions = [];
    ks.forEachSuggestion(ep2, (endpoint) => suggestions.push(endpoint));

    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0], ep1);
});

test('KeywordSuggestion forEachSuggestion skips same component', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const component1 = { id: 'c1', equals: (c) => c === component1 };

    const ep1 = {
        missing: false,
        friendcodeList: ['event'],
        type: 'source',
        component: component1
    };
    const ep2 = {
        missing: false,
        friendcodeList: ['event'],
        type: 'target',
        component: component1
    };

    ks.appendEndpoint(ep1);

    const suggestions = [];
    ks.forEachSuggestion(ep2, (endpoint) => suggestions.push(endpoint));

    // Same component should be skipped
    assert.equal(suggestions.length, 0);
});

test('KeywordSuggestion forEachSuggestion with missing endpoint is no-op', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const ep = { missing: true, friendcodeList: ['event'] };

    const suggestions = [];
    ks.forEachSuggestion(ep, (endpoint) => suggestions.push(endpoint));

    assert.equal(suggestions.length, 0);
});

test('KeywordSuggestion removeEndpoint removes endpoint', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const ep = {
        missing: false,
        friendcodeList: ['event'],
        type: 'source',
        component: { equals: () => false }
    };

    ks.appendEndpoint(ep);
    ks.removeEndpoint(ep);

    assert.deepEqual(ks.endpoints.source, {});
});

test('KeywordSuggestion removeEndpoint with missing endpoint is no-op', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const ep = { missing: true, friendcodeList: ['event'] };

    ks.removeEndpoint(ep);

    assert.deepEqual(ks.endpoints, { source: {}, target: {} });
});

test('KeywordSuggestion empty clears all endpoints', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const ep = {
        missing: false,
        friendcodeList: ['event'],
        type: 'source',
        component: { equals: () => false }
    };

    ks.appendEndpoint(ep);
    ks.empty();

    assert.deepEqual(ks.endpoints, { source: {}, target: {} });
});

test('KeywordSuggestion forEachSuggestion with unmatched friendcode returns early', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const component = { id: 'c1', equals: (c) => c === component };

    const ep1 = {
        missing: false,
        friendcodeList: ['other_event'],
        type: 'source',
        component: component
    };
    ks.appendEndpoint(ep1);

    const ep2 = {
        missing: false,
        friendcodeList: ['no_match'],
        type: 'target',
        component: { id: 'c2', equals: (c) => false }
    };

    const suggestions = [];
    ks.forEachSuggestion(ep2, (endpoint) => suggestions.push(endpoint));

    assert.equal(suggestions.length, 0);
});

test('KeywordSuggestion chaining works', () => {
    const ks = new Wirecloud.wiring.KeywordSuggestion();
    const ep = {
        missing: false,
        friendcodeList: ['event'],
        type: 'source',
        component: { equals: () => false }
    };

    const result = ks.appendEndpoint(ep).empty();
    assert.equal(result, ks);
});
