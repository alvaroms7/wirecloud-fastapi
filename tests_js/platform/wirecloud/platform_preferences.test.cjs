const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setup = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.GlobalLogManager = { log: () => {}, parseErrorResponse: (r) => r };
    Wirecloud.ui = { InputInterfaceFactory: {
        parse: (t, v) => v,
        stringify: (t, v) => v
    }};
    Wirecloud.io = { makeRequest: () => Promise.resolve({ status: 204 }) };
    Wirecloud.URLs = {};

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PlatformPref.js',
        'src/wirecloud/platform/static/js/wirecloud/Preferences.js',
        'src/wirecloud/platform/static/js/wirecloud/PlatformPreferences.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setup();
});

test('PlatformPreferences extends Preferences', () => {
    const pp = new Wirecloud.PlatformPreferences({ preferences: {} });
    assert.ok(pp instanceof Wirecloud.Preferences);
});

test('PlatformPreferences buildTitle returns string', () => {
    const pp = new Wirecloud.PlatformPreferences({ preferences: {} });
    assert.equal(typeof pp.buildTitle(), 'string');
});

test('PlatformPreferences _build_save_url returns URL', () => {
    Wirecloud.URLs.PLATFORM_PREFERENCES = '/api/platform/prefs';
    const pp = new Wirecloud.PlatformPreferences({ preferences: {} });
    assert.equal(pp._build_save_url(), '/api/platform/prefs');
});
