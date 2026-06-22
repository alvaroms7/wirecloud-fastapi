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
    Wirecloud.ui = { WiringEditor: {} };

    // Mock dependencies needed by ComponentPrefs
    Wirecloud.LocalCatalogue = {
        hasAlternativeVersion: () => false
    };

    // Load StyledElements dependencies needed by WiringEditor pref classes
    loadLegacyScripts([
        'src/wirecloud/commons/static/js/StyledElements/DynamicMenuItems.js',
        'src/wirecloud/commons/static/js/StyledElements/MenuItem.js',
    ]);
});

test('BehaviourPrefs constructor and build', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/BehaviourPrefs.js',
    ]);

    const behaviour = {
        showLogs: () => {},
        showSettings: () => {}
    };
    const prefs = new Wirecloud.ui.WiringEditor.BehaviourPrefs(behaviour);
    assert.equal(prefs.behaviour, behaviour);

    const items = prefs.build();
    assert.equal(items.length, 2);
    assert.ok(items[0] instanceof StyledElements.MenuItem);
});

test('ConnectionPrefs constructor and build', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ConnectionPrefs.js',
    ]);

    const connection = {
        readonly: false,
        background: false,
        editable: false,
        restoreDefaults: () => {}
    };
    const prefs = new Wirecloud.ui.WiringEditor.ConnectionPrefs(connection);
    assert.equal(prefs.connection, connection);

    const items = prefs.build();
    assert.equal(items.length, 2);
});

test('ComponentPrefs constructor and build', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentPrefs.js',
    ]);

    const component = {
        type: 'widget',
        title: 'Test',
        _component: {
            volatile: false,
            meta: {},
            isAllowed: () => true,
            rename: () => {}
        },
        hasSettings: () => false,
        showLogs: () => {},
        showSettings: () => {}
    };
    const prefs = new Wirecloud.ui.WiringEditor.ComponentPrefs(component);
    assert.equal(prefs.component, component);

    const items = prefs.build();
    assert.ok(items.length > 0);
});

test('BehaviourPrefs._createMenuItem with isEnabled function', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/BehaviourPrefs.js',
    ]);

    let wasCalled = false;
    const isEnabledFn = function () { wasCalled = true; return false; };
    const prefs = new Wirecloud.ui.WiringEditor.BehaviourPrefs({});
    const item = prefs._createMenuItem("Test", "fa-test", () => {}, isEnabledFn);

    assert.ok(item instanceof StyledElements.MenuItem);
    assert.equal(item.enabled, false);
    assert.ok(wasCalled);
});

test('BehaviourPrefs build onclick handlers', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/BehaviourPrefs.js',
    ]);

    let logsCalled = false;
    let settingsCalled = false;
    const behaviour = {
        showLogs: () => { logsCalled = true; },
        showSettings: () => { settingsCalled = true; }
    };
    const prefs = new Wirecloud.ui.WiringEditor.BehaviourPrefs(behaviour);
    const items = prefs.build();

    items[0].run();
    assert.ok(logsCalled);
    assert.ok(!settingsCalled);

    items[1].run();
    assert.ok(settingsCalled);
});

test('ComponentPrefs build onclick handlers (Logs & Settings)', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentPrefs.js',
    ]);

    let logsCalled = false;
    let settingsCalled = false;
    const component = {
        type: 'widget',
        title: 'Test',
        _component: {
            volatile: false,
            meta: {},
            isAllowed: () => true,
            rename: () => {}
        },
        hasSettings: () => false,
        showLogs: () => { logsCalled = true; },
        showSettings: () => { settingsCalled = true; }
    };
    const prefs = new Wirecloud.ui.WiringEditor.ComponentPrefs(component);
    const items = prefs.build();

    items[2].run();
    assert.ok(logsCalled);

    items[3].run();
    assert.ok(settingsCalled);
});

test('ComponentPrefs build onclick handlers (Rename & Upgrade)', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentPrefs.js',
    ]);

    let dialogInstance = null;
    let renameCalled = null;
    Wirecloud.ui.FormWindowMenu = function () {
        dialogInstance = this;
        this.show = () => {};
        this.setValue = () => {};
    };

    let upgradeCalled = false;
    Wirecloud.ui.UpgradeWindowMenu = function () {
        upgradeCalled = true;
        this.show = () => {};
    };

    const component = {
        type: 'widget',
        title: 'Test',
        _component: {
            volatile: false,
            meta: {},
            isAllowed: () => true,
            rename: (title) => { renameCalled = title; }
        },
        hasSettings: () => false,
        showLogs: () => {},
        showSettings: () => {}
    };
    const prefs = new Wirecloud.ui.WiringEditor.ComponentPrefs(component);
    const items = prefs.build();

    items[0].run();
    assert.ok(dialogInstance != null, 'should have created dialog');
    dialogInstance.executeOperation({ title: 'NewName' });
    assert.ok(renameCalled === 'NewName', 'should have called rename with title');

    items[1].run();
    assert.ok(upgradeCalled);
});

test('ComponentPrefs build with hasSettings true covers canShowSettings branch', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentPrefs.js',
    ]);

    const component = {
        type: 'widget',
        title: 'Test',
        _component: {
            volatile: false,
            meta: {},
            isAllowed: (perm, ctx) => {
                if (perm === 'configure' && ctx === 'editor') return true;
                return true;
            },
            rename: () => {}
        },
        hasSettings: () => true,
        showLogs: () => {},
        showSettings: () => {}
    };
    const prefs = new Wirecloud.ui.WiringEditor.ComponentPrefs(component);
    const items = prefs.build();

    assert.equal(items.length, 4);
    assert.equal(items[3].title, "Settings");
});

test('ComponentPrefs Rename with empty title does not trigger rename', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentPrefs.js',
    ]);

    let dialogInstance = null;
    let renameCalled = false;
    Wirecloud.ui.FormWindowMenu = function () {
        dialogInstance = this;
        this.show = () => {};
        this.setValue = () => {};
    };

    Wirecloud.ui.UpgradeWindowMenu = function () {
        this.show = () => {};
    };

    const component = {
        type: 'widget',
        title: '',
        _component: {
            volatile: false,
            meta: {},
            isAllowed: () => true,
            rename: () => { renameCalled = true; }
        },
        hasSettings: () => false,
        showLogs: () => {},
        showSettings: () => {}
    };
    const prefs = new Wirecloud.ui.WiringEditor.ComponentPrefs(component);
    const items = prefs.build();

    items[0].run();
    dialogInstance.executeOperation({ title: '' });
    assert.equal(renameCalled, false);
});

test('Wirecloud.ui.WiringEditor.KeywordSuggestion hideSuggestions when disabled', () => {
    if (!Wirecloud.wiring) {
        Wirecloud.wiring = {};
    }
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/KeywordSuggestion.js',
    ]);
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/KeywordSuggestion.js',
    ]);

    const ks = new Wirecloud.ui.WiringEditor.KeywordSuggestion();
    ks.disable();

    let activated = 0;
    const endpoint = { deactivate: () => { activated++; } };

    const result = ks.hideSuggestions(endpoint);
    assert.equal(result, ks);
    assert.equal(ks.enabled, false);
    assert.equal(activated, 0);
});

test('Wirecloud.ui.WiringEditor.KeywordSuggestion hideSuggestions when enabled', () => {
    if (!Wirecloud.wiring) {
        Wirecloud.wiring = {};
    }
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/wiring/KeywordSuggestion.js',
    ]);
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/KeywordSuggestion.js',
    ]);

    const ks = new Wirecloud.ui.WiringEditor.KeywordSuggestion();

    const component1 = { id: 'c1', equals: () => false };
    let matchingDeactivated = false;
    const matchingEndpoint = {
        missing: false,
        friendcodeList: ['test_fc'],
        type: 'target',
        component: component1,
        deactivate: () => { matchingDeactivated = true; }
    };
    ks.appendEndpoint(matchingEndpoint);

    let endpointDeactivated = false;
    const endpoint = {
        missing: false,
        friendcodeList: ['test_fc'],
        type: 'source',
        component: { id: 'c2', equals: () => false },
        deactivate: () => { endpointDeactivated = true; }
    };

    const result = ks.hideSuggestions(endpoint);
    assert.equal(result, ks);
    assert.ok(endpointDeactivated);
    assert.ok(matchingDeactivated);
});

test('ConnectionPrefs getCustomizeTitle with editable=true', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ConnectionPrefs.js',
    ]);

    const connection = {
        readonly: false,
        background: false,
        editable: true,
        restoreDefaults: () => {}
    };
    const prefs = new Wirecloud.ui.WiringEditor.ConnectionPrefs(connection);
    const items = prefs.build();

    assert.equal(items.length, 2);
    assert.equal(items[0].title, "Stop customizing");
});

test('ConnectionPrefs build onclick handlers', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ConnectionPrefs.js',
    ]);

    let restoreCalled = false;
    const connection = {
        readonly: false,
        background: false,
        editable: false,
        restoreDefaults: () => { restoreCalled = true; }
    };
    const prefs = new Wirecloud.ui.WiringEditor.ConnectionPrefs(connection);
    const items = prefs.build();

    items[0].run();
    assert.equal(connection.editable, true);

    items[1].run();
    assert.ok(restoreCalled);
});
