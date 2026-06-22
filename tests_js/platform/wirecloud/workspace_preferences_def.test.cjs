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

    // Mock PreferenceManager.processDefinitions
    Wirecloud.PreferenceManager = {
        processDefinitions: (prefs) => prefs.reduce((acc, p) => { acc[p.name] = p; return acc; }, {})
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PreferencesDef.js',
        'src/wirecloud/platform/static/js/wirecloud/WorkspacePreferencesDef.js',
    ]);
});

test('WorkspacePreferencesDef inherits from PreferencesDef', () => {
    const def = new Wirecloud.WorkspacePreferencesDef({ theme: {} }, [null, null, []]);
    assert.ok(def instanceof Wirecloud.PreferencesDef);
});

test('WorkspacePreferencesDef buildPreferences method exists', () => {
    const def = new Wirecloud.WorkspacePreferencesDef({ theme: {} }, [null, null, []]);
    assert.equal(typeof def.buildPreferences, 'function');
});
