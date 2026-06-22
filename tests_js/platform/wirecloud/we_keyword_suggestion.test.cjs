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

    // Load the base KeywordSuggestion from wiring
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/KeywordSuggestion.js',
    ]);

    Wirecloud.ui = { WiringEditor: {} };
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/KeywordSuggestion.js',
    ]);
});

test('KeywordSuggestion constructor initializes enabled', () => {
    const ks = new Wirecloud.ui.WiringEditor.KeywordSuggestion();
    assert.equal(ks.enabled, true);
    assert.ok(ks instanceof Wirecloud.wiring.KeywordSuggestion);
});

test('KeywordSuggestion disable sets enabled to false', () => {
    const ks = new Wirecloud.ui.WiringEditor.KeywordSuggestion();
    const result = ks.disable();
    assert.equal(ks.enabled, false);
    assert.equal(result, ks); // returns this
});

test('KeywordSuggestion enable sets enabled to true', () => {
    const ks = new Wirecloud.ui.WiringEditor.KeywordSuggestion();
    ks.disable();
    const result = ks.enable();
    assert.equal(ks.enabled, true);
    assert.equal(result, ks);
});

test('KeywordSuggestion showSuggestions with disabled does nothing', () => {
    const ks = new Wirecloud.ui.WiringEditor.KeywordSuggestion();
    ks.disable();
    let activated = false;
    const ep = { activate: () => { activated = true; } };
    ks.showSuggestions(ep);
    assert.equal(activated, false);
});

test('KeywordSuggestion showSuggestions activates endpoint and suggestions', () => {
    const ks = new Wirecloud.ui.WiringEditor.KeywordSuggestion();
    let endpointActivated = false;
    let suggestionActivated = false;

    const ep = {
        missing: false,
        friendcodeList: ['event'],
        type: 'source',
        component: { id: 'c1', equals: () => true },
        activate: () => { endpointActivated = true; }
    };

    const suggestion = {
        missing: false,
        friendcodeList: ['event'],
        type: 'target',
        component: { id: 'c2', equals: () => false },
        activate: () => { suggestionActivated = true; }
    };

    ks.appendEndpoint(suggestion);
    ks.showSuggestions(ep);
    assert.equal(endpointActivated, true);
    assert.equal(suggestionActivated, true);
});

test('KeywordSuggestion hideSuggestions deactivates endpoints', () => {
    const ks = new Wirecloud.ui.WiringEditor.KeywordSuggestion();
    let deactivated = false;
    const ep = { missing: false, friendcodeList: [], type: 'source', component: { equals: () => true }, deactivate: () => { deactivated = true; } };
    ks.hideSuggestions(ep);
    assert.equal(deactivated, true);
});
