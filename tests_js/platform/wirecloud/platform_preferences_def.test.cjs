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

    // Load PlatformPref and Preferences first (needed by PlatformPreferences)
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PreferencesDef.js',
        'src/wirecloud/platform/static/js/wirecloud/PlatformPref.js',
        'src/wirecloud/platform/static/js/wirecloud/Preferences.js',
        'src/wirecloud/platform/static/js/wirecloud/PlatformPreferences.js',
        'src/wirecloud/platform/static/js/wirecloud/PlatformPreferencesDef.js',
    ]);
});

test('PlatformPreferencesDef creates definition', () => {
    const definitions = { theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false } };
    const def = new Wirecloud.PlatformPreferencesDef(definitions);

    assert.ok(def.preferences);
    assert.equal(def.preferences, definitions);
});

test('PlatformPreferencesDef buildPreferences creates PlatformPreferences', () => {
    const definitions = {
        theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
    };
    const def = new Wirecloud.PlatformPreferencesDef(definitions);
    const prefs = def.buildPreferences({});

    assert.ok(prefs instanceof Wirecloud.PlatformPreferences);
    assert.ok(prefs.preferences.theme);
});
