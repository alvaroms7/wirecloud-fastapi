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
    Wirecloud.constants = {
        PLATFORM_PREFERENCES: [],
        WORKSPACE_PREFERENCES: [],
        TAB_PREFERENCES: []
    };

    // Load dependencies in order
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PreferenceDef.js',
        'src/wirecloud/platform/static/js/wirecloud/PreferencesDef.js',
    ]);

    // Mock PrefDef classes (using PreferencesDef, not PreferenceDef)
    Wirecloud.PlatformPreferencesDef = function(defs, args) {
        Wirecloud.PreferencesDef.call(this, defs);
        this._args = args;
    };
    Wirecloud.PlatformPreferencesDef.prototype = new Wirecloud.PreferencesDef();
    Wirecloud.PlatformPreferencesDef.prototype.buildPreferences = function(values) {
        return { scope: 'platform', values };
    };

    Wirecloud.WorkspacePreferencesDef = function(defs, args) {
        Wirecloud.PreferencesDef.call(this, defs);
        this._args = args;
    };
    Wirecloud.WorkspacePreferencesDef.prototype = new Wirecloud.PreferencesDef();
    Wirecloud.WorkspacePreferencesDef.prototype.buildPreferences = function(values) {
        return { scope: 'workspace', values };
    };

    Wirecloud.TabPreferencesDef = function(defs) {
        Wirecloud.PreferencesDef.call(this, defs);
    };
    Wirecloud.TabPreferencesDef.prototype = new Wirecloud.PreferencesDef();
    Wirecloud.TabPreferencesDef.prototype.buildPreferences = function(values) {
        return { scope: 'tab', values };
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PreferenceManager.js',
    ]);
});

test('PreferenceManager is a singleton', () => {
    assert.ok(Wirecloud.PreferenceManager instanceof Object);
    assert.ok(Wirecloud.PreferenceManager.preferencesDef);
});

test('PreferenceManager processDefinitions creates PreferenceDef instances', () => {
    const prefs = [
        { name: 'theme', inheritable: true, inheritByDefault: false, hidden: false, label: 'Theme', description: 'UI theme', defaultValue: 'light' }
    ];
    const defs = Wirecloud.PreferenceManager.processDefinitions(prefs);

    assert.ok(defs.theme);
    assert.ok(defs.theme instanceof Wirecloud.PreferenceDef);
    assert.equal(defs.theme.name, 'theme');
});

test('PreferenceManager buildPreferences returns for platform scope', () => {
    Wirecloud.constants.PLATFORM_PREFERENCES = [{ name: 'x', inheritable: false, inheritByDefault: false, hidden: false, label: 'X', description: 'X', defaultValue: 'v' }];

    // Reset and rebuild with proper constants
    Wirecloud.PreferenceManager.preferencesDef.platform = [
        Wirecloud.PlatformPreferencesDef,
        Wirecloud.PreferenceManager.processDefinitions(Wirecloud.constants.PLATFORM_PREFERENCES)
    ];

    const result = Wirecloud.PreferenceManager.buildPreferences('platform', {});
    assert.equal(result.scope, 'platform');
});

test('PreferenceManager buildPreferences throws for invalid scope', () => {
    assert.throws(
        () => Wirecloud.PreferenceManager.buildPreferences('invalid'),
        /TypeError/
    );
});
