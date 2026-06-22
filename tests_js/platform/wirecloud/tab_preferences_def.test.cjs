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
    Wirecloud.GlobalLogManager = { log: () => {}, parseErrorResponse: (r) => r };
    Wirecloud.ui = { InputInterfaceFactory: { parse: (t,v) => v, stringify: (t,v) => v } };
    Wirecloud.io = { makeRequest: () => Promise.resolve({ status: 204 }) };
    Wirecloud.URLs = {
        TAB_PREFERENCES: { evaluate: () => '/api/tab/prefs' },
        WORKSPACE_PREFERENCES: { evaluate: () => '/api/ws/prefs' }
    };
    Wirecloud.preferences = { addEventListener: () => {}, removeEventListener: () => {} };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PreferencesDef.js',
        'src/wirecloud/platform/static/js/wirecloud/PlatformPref.js',
        'src/wirecloud/platform/static/js/wirecloud/Preferences.js',
        'src/wirecloud/platform/static/js/wirecloud/WorkspacePreferences.js',
        'src/wirecloud/platform/static/js/wirecloud/TabPreferences.js',
        'src/wirecloud/platform/static/js/wirecloud/TabPreferencesDef.js',
    ]);
});

test('TabPreferencesDef inherits from PreferencesDef', () => {
    const def = new Wirecloud.TabPreferencesDef({});
    assert.ok(def instanceof Wirecloud.PreferencesDef);
});

test('TabPreferencesDef buildPreferences creates TabPreferences', () => {
    const definitions = {
        theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
    };
    const def = new Wirecloud.TabPreferencesDef(definitions);
    const tab = { id: 'tab1', workspace: { id: 'ws1', preferences: { addEventListener: () => {}, removeEventListener: () => {} } } };
    const prefs = def.buildPreferences({}, tab);

    assert.ok(prefs instanceof Wirecloud.TabPreferences);
});
