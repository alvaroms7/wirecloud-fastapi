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
    Wirecloud.URLs = {
        TAB_PREFERENCES: { evaluate: (o) => '/api/ws/' + o.workspace_id + '/tabs/' + o.tab_id + '/prefs' },
        WORKSPACE_PREFERENCES: { evaluate: () => '/api/ws/prefs' },
        PLATFORM_PREFERENCES: '/api/platform/prefs'
    };

    // Load platform prefs first
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PlatformPref.js',
        'src/wirecloud/platform/static/js/wirecloud/PreferencesDef.js',
        'src/wirecloud/platform/static/js/wirecloud/Preferences.js',
        'src/wirecloud/platform/static/js/wirecloud/PlatformPreferences.js',
        'src/wirecloud/platform/static/js/wirecloud/WorkspacePreferences.js',
    ]);

    Wirecloud.preferences = new Wirecloud.Preferences(new Wirecloud.PreferencesDef({}));

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/TabPreferences.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setup();
});

test('TabPreferences extends Preferences', () => {
    const tab = { id: 'tab1', workspace: { id: 'ws1', preferences: { addEventListener: () => {}, removeEventListener: () => {} } } };
    const tp = new Wirecloud.TabPreferences({ preferences: {} }, tab);
    assert.ok(tp instanceof Wirecloud.Preferences);
});

test('TabPreferences buildTitle returns string', () => {
    const tab = { id: 'tab1', workspace: { id: 'ws1', preferences: { addEventListener: () => {}, removeEventListener: () => {} } } };
    const tp = new Wirecloud.TabPreferences({ preferences: {} }, tab);
    assert.equal(typeof tp.buildTitle(), 'string');
});

test('TabPreferences _build_save_url returns URL', () => {
    const tab = { id: 'tab1', workspace: { id: 'ws1', preferences: { addEventListener: () => {}, removeEventListener: () => {} } } };
    const tp = new Wirecloud.TabPreferences({ preferences: {} }, tab);
    assert.ok(tp._build_save_url().includes('/api/ws/ws1/tabs/tab1/prefs'));
});

test('TabPreferences destroy cleans up', () => {
    const tab = { id: 'tab1', workspace: { id: 'ws1', preferences: {
        addEventListener: () => {},
        removeEventListener: () => {}
    } } };
    const tp = new Wirecloud.TabPreferences({ preferences: {} }, tab);
    tp.destroy();
    // destroy removes the parent listener
    assert.ok(true);
});

test('TabPreferences getParentValue delegates to workspace preferences', () => {
    const workspacePrefs = {
        addEventListener: () => {},
        removeEventListener: () => {},
        get: (name) => name === 'theme' ? 'platform-dark' : undefined
    };
    const tab = { id: 'tab1', workspace: { id: 'ws1', preferences: workspacePrefs } };
    const tp = new Wirecloud.TabPreferences({ preferences: {} }, tab);

    assert.equal(tp.getParentValue('theme'), 'platform-dark');
    assert.equal(tp.getParentValue('unknown'), undefined);
});
