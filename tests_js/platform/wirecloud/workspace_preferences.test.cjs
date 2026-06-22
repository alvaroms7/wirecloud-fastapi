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
        WORKSPACE_PREFERENCES: { evaluate: (o) => '/api/ws/' + o.workspace_id + '/prefs' },
        PLATFORM_PREFERENCES: '/api/platform/prefs'
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PlatformPref.js',
        'src/wirecloud/platform/static/js/wirecloud/PreferencesDef.js',
        'src/wirecloud/platform/static/js/wirecloud/Preferences.js',
        'src/wirecloud/platform/static/js/wirecloud/PlatformPreferences.js',
    ]);

    // Create platform prefs after dependencies are loaded
    Wirecloud.preferences = new Wirecloud.Preferences(new Wirecloud.PreferencesDef({}));

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/WorkspacePreferences.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setup();
});

test('WorkspacePreferences extends Preferences', () => {
    const ws = { id: 'ws1' };
    const wp = new Wirecloud.WorkspacePreferences({ preferences: {} }, ws);
    assert.ok(wp instanceof Wirecloud.Preferences);
});

test('WorkspacePreferences buildTitle returns string', () => {
    const ws = { id: 'ws1' };
    const wp = new Wirecloud.WorkspacePreferences({ preferences: {} }, ws);
    assert.equal(typeof wp.buildTitle(), 'string');
});

test('WorkspacePreferences getParentValue returns platform prefs value', () => {
    const ws = { id: 'ws1' };
    const wp = new Wirecloud.WorkspacePreferences({ preferences: {} }, ws);
    // platform prefs has no theme value initially
    assert.equal(wp.getParentValue('theme'), undefined);
});

test('WorkspacePreferences _build_save_url returns URL', () => {
    const ws = { id: 'ws1' };
    const wp = new Wirecloud.WorkspacePreferences({ preferences: {} }, ws);
    assert.ok(wp._build_save_url().includes('/api/ws/ws1/prefs'));
});

test('WorkspacePreferences destroy cleans up', () => {
    const ws = { id: 'ws1' };
    const wp = new Wirecloud.WorkspacePreferences({ preferences: {} }, ws);
    wp.destroy();
    assert.equal(wp._workspace, null);
});

test('WorkspacePreferencesDef constructor with empty_params', () => {
    Wirecloud.PreferenceManager = {
        processDefinitions: function (prefs) {
            const result = {};
            for (const key in prefs) {
                result[key] = { name: key, label: prefs[key].label || key };
            }
            return result;
        }
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/WorkspacePreferencesDef.js',
    ]);

    const defObj = { existing: { name: 'existing', label: 'Existing' } };
    const extraPrefs = { extra1: { label: 'Extra 1' }, extra2: { label: 'Extra 2' } };
    const emptyParams = ['extra1', 'extra2'];

    const def = new Wirecloud.WorkspacePreferencesDef(defObj, [{}, null, extraPrefs, emptyParams]);

    assert.ok(def.preferences.extra1);
    assert.ok(def.preferences.extra2);
    assert.equal(def.preferences.extra1.name, 'extra1');
    assert.equal('existing' in def.preferences, false);
});

test('WorkspacePreferencesDef buildPreferences returns WorkspacePreferences', () => {
    Wirecloud.PreferenceManager = {
        processDefinitions: function (prefs) { return prefs; }
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/WorkspacePreferencesDef.js',
    ]);

    const defObj = { theme: { name: 'theme', label: 'Theme' } };
    const def = new Wirecloud.WorkspacePreferencesDef(defObj, [{}, null]);
    const ws = { id: 'ws1' };
    const prefs = def.buildPreferences({}, ws);

    assert.ok(prefs instanceof Wirecloud.WorkspacePreferences);
    assert.equal(prefs._workspace, ws);
});
