const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

let defaultComponent;
let FormWindowMenuMock;
let UpgradeWindowMenuMock;
let lastFormWindowMenu;

function createDefaultComponent(overrides) {
    return Object.assign({
        type: 'widget',
        title: 'TestComponent',
        background: false,
        missing: false,
        collapsed: false,
        orderingEndpoints: false,
        removeCascadeAllowed: false,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        },
        hasEndpoints: () => true,
        hasOrderableEndpoints: () => true,
        hasSettings: () => true,
        isRemovable: () => true,
        showLogs: () => {},
        showSettings: () => {},
        startOrderingEndpoints: () => {},
        stopOrderingEndpoints: () => {},
        dispatchEvent: () => {}
    }, overrides);
}

function loadSource() {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentDraggablePrefs.js',
    ]);
}

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = { WiringEditor: {} };

    Wirecloud.LocalCatalogue = {
        hasAlternativeVersion: () => false
    };

    FormWindowMenuMock = function (fields, title, cssClass) {
        lastFormWindowMenu = this;
        this.fields = fields;
        this.title = title;
        this.cssClass = cssClass;
        this.showCalled = false;
        this.setValueCalled = false;
        this.setValueData = null;
        this.executeOperation = null;
        this._boundComponent = null;

        this.show = () => { this.showCalled = true; };
        this.setValue = (data) => {
            this.setValueCalled = true;
            this.setValueData = data;
        };
    };

    UpgradeWindowMenuMock = function (component) {
        this.component = component;
        this.showCalled = false;
        this.show = () => { this.showCalled = true; };
    };

    Wirecloud.ui.FormWindowMenu = FormWindowMenuMock;
    Wirecloud.ui.UpgradeWindowMenu = UpgradeWindowMenuMock;

    loadLegacyScripts([
        'src/wirecloud/commons/static/js/StyledElements/DynamicMenuItems.js',
        'src/wirecloud/commons/static/js/StyledElements/MenuItem.js',
    ]);

    lastFormWindowMenu = null;
});

test('constructor stores component reference', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);
    assert.equal(prefs.component, defaultComponent);
});

test('extends DynamicMenuItems', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);
    assert.ok(prefs instanceof StyledElements.DynamicMenuItems);
});

test('build returns array', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);
    const items = prefs.build();
    assert.ok(Array.isArray(items));
});

test('build returns MenuItem instances', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);
    const items = prefs.build();
    assert.ok(items.length >= 6);
    items.forEach((item) => {
        assert.ok(item instanceof StyledElements.MenuItem);
    });
});

test('_createMenuItem sets title and onClick', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);

    let clicked = false;
    const item = prefs._createMenuItem("TestTitle", "fa-test", () => { clicked = true; });

    assert.ok(item instanceof StyledElements.MenuItem);
    assert.equal(item.title, "TestTitle");
    item.run();
    assert.ok(clicked);
});

test('_createMenuItem adds iconClass', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);

    const item = prefs._createMenuItem("Test", "fa-custom-icon", () => {});
    const thumbnails = item.wrapperElement.childNodes.filter(
        (child) => child.className === 'se-popup-menu-item-thumbnail'
    );
    assert.ok(thumbnails.length > 0);
    const icon = thumbnails[0].childNodes.find(
        (child) => child.className === 'se-icon fa-custom-icon'
    );
    assert.ok(icon != null);
});

test('_createMenuItem with isEnabled = null does not set enabled', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);

    const item = prefs._createMenuItem("Test", "fa-test", () => {}, null);
    assert.equal(item.enabled, true);
});

test('_createMenuItem with undefined isEnabled does not set enabled', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);

    const item = prefs._createMenuItem("Test", "fa-test", () => {});
    assert.equal(item.enabled, true);
});

test('_createMenuItem with isEnabled function calls it with component context', () => {
    loadSource();
    const component = createDefaultComponent();
    let capturedContext = null;
    const isEnabled = function () { capturedContext = this; return true; };
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);

    prefs._createMenuItem("Test", "fa-test", () => {}, isEnabled);
    assert.equal(capturedContext, component);
});

test('_createMenuItem with isEnabled function sets enabled to its return value', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);

    const itemTrue = prefs._createMenuItem("A", "fa-a", () => {}, () => true);
    assert.equal(itemTrue.enabled, true);

    const itemFalse = prefs._createMenuItem("B", "fa-b", () => {}, () => false);
    assert.equal(itemFalse.enabled, false);
});

// -----------------------------------------------------------------------
// canRename
// -----------------------------------------------------------------------

test('canRename: true when widget type and rename allowed', () => {
    loadSource();
    const component = createDefaultComponent({
        type: 'widget',
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: (perm) => perm === 'rename',
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[0].enabled, true);
});

test('canRename: false when not widget type', () => {
    loadSource();
    const component = createDefaultComponent({
        type: 'operator',
        _component: {
            meta: { vendor: 'test', name: 'TestOp', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[0].enabled, false);
});

test('canRename: false when rename not allowed', () => {
    loadSource();
    const component = createDefaultComponent({
        type: 'widget',
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: (perm, scope) => perm !== 'rename',
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[0].enabled, false);
});

// -----------------------------------------------------------------------
// canCollapseEndpoints
// -----------------------------------------------------------------------

test('canCollapseEndpoints: true when hasEndpoints, not background, not orderingEndpoints', () => {
    loadSource();
    const component = createDefaultComponent({
        hasEndpoints: () => true,
        background: false,
        orderingEndpoints: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[1].enabled, true);
});

test('canCollapseEndpoints: false when no endpoints', () => {
    loadSource();
    const component = createDefaultComponent({
        hasEndpoints: () => false,
        background: false,
        orderingEndpoints: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[1].enabled, false);
});

test('canCollapseEndpoints: false when background', () => {
    loadSource();
    const component = createDefaultComponent({
        hasEndpoints: () => true,
        background: true,
        orderingEndpoints: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[1].enabled, false);
});

test('canCollapseEndpoints: false when orderingEndpoints', () => {
    loadSource();
    const component = createDefaultComponent({
        hasEndpoints: () => true,
        background: false,
        orderingEndpoints: true
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[1].enabled, false);
});

// -----------------------------------------------------------------------
// canOrderEndpoints
// -----------------------------------------------------------------------

test('canOrderEndpoints: true when hasOrderableEndpoints, not background, not missing, not collapsed', () => {
    loadSource();
    const component = createDefaultComponent({
        hasOrderableEndpoints: () => true,
        background: false,
        missing: false,
        collapsed: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[2].enabled, true);
});

test('canOrderEndpoints: false when no orderable endpoints', () => {
    loadSource();
    const component = createDefaultComponent({
        hasOrderableEndpoints: () => false,
        background: false,
        missing: false,
        collapsed: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[2].enabled, false);
});

test('canOrderEndpoints: false when background', () => {
    loadSource();
    const component = createDefaultComponent({
        hasOrderableEndpoints: () => true,
        background: true,
        missing: false,
        collapsed: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[2].enabled, false);
});

test('canOrderEndpoints: false when missing', () => {
    loadSource();
    const component = createDefaultComponent({
        hasOrderableEndpoints: () => true,
        background: false,
        missing: true,
        collapsed: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[2].enabled, false);
});

test('canOrderEndpoints: false when collapsed', () => {
    loadSource();
    const component = createDefaultComponent({
        hasOrderableEndpoints: () => true,
        background: false,
        missing: false,
        collapsed: true
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[2].enabled, false);
});

// -----------------------------------------------------------------------
// canUpgrade
// -----------------------------------------------------------------------

test('canUpgrade: true when not background, upgrade allowed, has alternative version', () => {
    loadSource();
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => true;
    const component = createDefaultComponent({
        background: false,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: (perm) => perm === 'upgrade',
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[3].enabled, true);
});

test('canUpgrade: false when background', () => {
    loadSource();
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => true;
    const component = createDefaultComponent({
        background: true,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[3].enabled, false);
});

test('canUpgrade: false when upgrade not allowed', () => {
    loadSource();
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => true;
    const component = createDefaultComponent({
        background: false,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: (perm) => perm !== 'upgrade',
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[3].enabled, false);
});

test('canUpgrade: false when no alternative version', () => {
    loadSource();
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => false;
    const component = createDefaultComponent({
        background: false,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[3].enabled, false);
});

// -----------------------------------------------------------------------
// canShowSettings
// -----------------------------------------------------------------------

test('canShowSettings: true when hasSettings and configure allowed', () => {
    loadSource();
    const component = createDefaultComponent({
        hasSettings: () => true,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: (perm) => perm === 'configure',
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    const settingsItem = items[5];
    assert.equal(settingsItem.enabled, true);
});

test('canShowSettings: false when no settings', () => {
    loadSource();
    const component = createDefaultComponent({
        hasSettings: () => false,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[5].enabled, false);
});

test('canShowSettings: false when configure not allowed', () => {
    loadSource();
    const component = createDefaultComponent({
        hasSettings: () => true,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: (perm) => perm !== 'configure',
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[5].enabled, false);
});

// -----------------------------------------------------------------------
// canDeleteCascade
// -----------------------------------------------------------------------

test('canDeleteCascade: true when isRemovable', () => {
    loadSource();
    const component = createDefaultComponent({
        removeCascadeAllowed: true,
        isRemovable: () => true
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    const deleteItem = items[items.length - 1];
    assert.equal(deleteItem.title, "Delete cascade");
    assert.equal(deleteItem.enabled, true);
});

test('canDeleteCascade: false when not removable', () => {
    loadSource();
    const component = createDefaultComponent({
        removeCascadeAllowed: true,
        isRemovable: () => false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    const deleteItem = items[items.length - 1];
    assert.equal(deleteItem.enabled, false);
});

test('canDeleteCascade: item absent when removeCascadeAllowed is falsy', () => {
    loadSource();
    const component = createDefaultComponent({
        removeCascadeAllowed: false,
        isRemovable: () => true
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    const titles = items.map((item) => item.title);
    assert.equal(titles.indexOf("Delete cascade"), -1);
});

test('canDeleteCascade: item absent when removeCascadeAllowed is undefined', () => {
    loadSource();
    const component = createDefaultComponent({});
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    const titles = items.map((item) => item.title);
    assert.equal(titles.indexOf("Delete cascade"), -1);
});

test('canDeleteCascade: item present when removeCascadeAllowed is truthy', () => {
    loadSource();
    const component = createDefaultComponent({
        removeCascadeAllowed: 1,
        isRemovable: () => true
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    const titles = items.map((item) => item.title);
    assert.ok(titles.indexOf("Delete cascade") !== -1);
});

// -----------------------------------------------------------------------
// getItemCollapse
// -----------------------------------------------------------------------

test('getItemCollapse: shows Expand when collapsed', () => {
    loadSource();
    const component = createDefaultComponent({
        collapsed: true,
        hasEndpoints: () => true,
        background: false,
        orderingEndpoints: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[1].title, "Expand");
});

test('getItemCollapse: shows Collapse when not collapsed', () => {
    loadSource();
    const component = createDefaultComponent({
        collapsed: false,
        hasEndpoints: () => true,
        background: false,
        orderingEndpoints: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[1].title, "Collapse");
});

// -----------------------------------------------------------------------
// getItemOrderEndpoints
// -----------------------------------------------------------------------

test('getItemOrderEndpoints: shows Stop ordering when orderingEndpoints is true', () => {
    loadSource();
    const component = createDefaultComponent({
        orderingEndpoints: true,
        hasOrderableEndpoints: () => true,
        background: false,
        missing: false,
        collapsed: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[2].title, "Stop ordering");
});

test('getItemOrderEndpoints: shows Order endpoints when orderingEndpoints is false', () => {
    loadSource();
    const component = createDefaultComponent({
        orderingEndpoints: false,
        hasOrderableEndpoints: () => true,
        background: false,
        missing: false,
        collapsed: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    assert.equal(items[2].title, "Order endpoints");
});

// -----------------------------------------------------------------------
// Logs and Settings items always enabled
// -----------------------------------------------------------------------

test('Logs item is always enabled (no isEnabled check)', () => {
    loadSource();
    defaultComponent = createDefaultComponent();
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(defaultComponent);
    const items = prefs.build();
    assert.equal(items[4].enabled, true);
    assert.equal(items[4].title, "Logs");
});

// -----------------------------------------------------------------------
// Onclick: Collapse toggles
// -----------------------------------------------------------------------

test('Collapse onclick toggles collapsed state', () => {
    loadSource();
    const component = createDefaultComponent({
        collapsed: false,
        hasEndpoints: () => true,
        background: false,
        orderingEndpoints: false
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    assert.equal(component.collapsed, false);
    items[1].run();
    assert.equal(component.collapsed, true);
    items[1].run();
    assert.equal(component.collapsed, false);
});

// -----------------------------------------------------------------------
// Onclick: Order endpoints
// -----------------------------------------------------------------------

test('Order endpoints onclick calls startOrderingEndpoints when not ordering', () => {
    loadSource();
    let started = false;
    let stopped = false;
    const component = createDefaultComponent({
        orderingEndpoints: false,
        hasOrderableEndpoints: () => true,
        background: false,
        missing: false,
        collapsed: false,
        startOrderingEndpoints: () => { started = true; },
        stopOrderingEndpoints: () => { stopped = true; }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[2].run();
    assert.ok(started);
    assert.ok(!stopped);
});

test('Order endpoints onclick calls stopOrderingEndpoints when ordering', () => {
    loadSource();
    let started = false;
    let stopped = false;
    const component = createDefaultComponent({
        orderingEndpoints: true,
        hasOrderableEndpoints: () => true,
        background: false,
        missing: false,
        collapsed: false,
        startOrderingEndpoints: () => { started = true; },
        stopOrderingEndpoints: () => { stopped = true; }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[2].run();
    assert.ok(!started);
    assert.ok(stopped);
});

// -----------------------------------------------------------------------
// Onclick: Rename
// -----------------------------------------------------------------------

test('Rename onclick creates FormWindowMenu and calls show/setValue', () => {
    loadSource();
    const component = createDefaultComponent({
        type: 'widget',
        title: 'MyWidget',
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[0].run();

    assert.ok(lastFormWindowMenu != null, 'FormWindowMenu should have been created');
    assert.ok(lastFormWindowMenu.showCalled);
    assert.ok(lastFormWindowMenu.setValueCalled);
    assert.equal(lastFormWindowMenu.setValueData.title, 'MyWidget');
    assert.equal(lastFormWindowMenu.cssClass, 'wc-component-rename-modal');
    assert.ok(lastFormWindowMenu.fields[0].name === 'title');
    assert.ok(lastFormWindowMenu.executeOperation != null);
});

test('Rename executeOperation with title calls rename', () => {
    loadSource();
    let renameCalled = null;
    const component = createDefaultComponent({
        type: 'widget',
        title: 'OldTitle',
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: (title) => { renameCalled = title; }
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[0].run();
    assert.ok(lastFormWindowMenu != null);

    lastFormWindowMenu.executeOperation({ title: 'NewTitle' });
    assert.equal(renameCalled, 'NewTitle');
});

test('Rename executeOperation with empty title does not call rename', () => {
    loadSource();
    let renameCalled = false;
    const component = createDefaultComponent({
        type: 'widget',
        title: 'OldTitle',
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => { renameCalled = true; }
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[0].run();
    lastFormWindowMenu.executeOperation({ title: '' });
    assert.equal(renameCalled, false);
});

test('Rename executeOperation with no title key does not call rename', () => {
    loadSource();
    let renameCalled = false;
    const component = createDefaultComponent({
        type: 'widget',
        title: 'OldTitle',
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => { renameCalled = true; }
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[0].run();
    lastFormWindowMenu.executeOperation({});
    assert.equal(renameCalled, false);
});

test('Rename executeOperation with falsy title (null) does not call rename', () => {
    loadSource();
    let renameCalled = false;
    const component = createDefaultComponent({
        type: 'widget',
        title: 'OldTitle',
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => { renameCalled = true; }
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[0].run();
    lastFormWindowMenu.executeOperation({ title: null });
    assert.equal(renameCalled, false);
});

// -----------------------------------------------------------------------
// Onclick: Upgrade
// -----------------------------------------------------------------------

test('Upgrade onclick creates UpgradeWindowMenu and calls show', () => {
    loadSource();
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => true;
    const component = createDefaultComponent({
        background: false,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    let upgradeInstance = null;
    Wirecloud.ui.UpgradeWindowMenu = function (comp) {
        upgradeInstance = this;
        this.component = comp;
        this.show = () => {};
    };

    items[3].run();
    assert.ok(upgradeInstance != null);
    assert.equal(upgradeInstance.component, component._component);
});

// -----------------------------------------------------------------------
// Onclick: Logs
// -----------------------------------------------------------------------

test('Logs onclick calls showLogs on component', () => {
    loadSource();
    let logsCalled = false;
    const component = createDefaultComponent({
        showLogs: () => { logsCalled = true; }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[4].run();
    assert.ok(logsCalled);
});

// -----------------------------------------------------------------------
// Onclick: Settings
// -----------------------------------------------------------------------

test('Settings onclick calls showSettings on component', () => {
    loadSource();
    let settingsCalled = false;
    const component = createDefaultComponent({
        hasSettings: () => true,
        showSettings: () => { settingsCalled = true; }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    items[5].run();
    assert.ok(settingsCalled);
});

// -----------------------------------------------------------------------
// Onclick: Delete cascade
// -----------------------------------------------------------------------

test('Delete cascade onclick dispatches optremovecascade event', () => {
    loadSource();
    let dispatched = null;
    const component = createDefaultComponent({
        removeCascadeAllowed: true,
        isRemovable: () => true,
        dispatchEvent: (event) => { dispatched = event; }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    const deleteItem = items[items.length - 1];

    deleteItem.run();
    assert.equal(dispatched, "optremovecascade");
});

// -----------------------------------------------------------------------
// Build item count
// -----------------------------------------------------------------------

test('build includes only Delete cascade when removeCascadeAllowed', () => {
    loadSource();
    const componentWithout = createDefaultComponent({
        removeCascadeAllowed: false,
        isRemovable: () => true
    });
    const prefsWithout = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(componentWithout);
    assert.equal(prefsWithout.build().length, 6);

    const componentWith = createDefaultComponent({
        removeCascadeAllowed: true,
        isRemovable: () => true
    });
    const prefsWith = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(componentWith);
    assert.equal(prefsWith.build().length, 7);
});

test('build Delete cascade item uses trash icon', () => {
    loadSource();
    const component = createDefaultComponent({
        removeCascadeAllowed: true,
        isRemovable: () => true
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();
    const deleteItem = items[items.length - 1];
    const thumbnails = deleteItem.wrapperElement.childNodes.filter(
        (child) => child.className === 'se-popup-menu-item-thumbnail'
    );
    assert.ok(thumbnails.length > 0);
    const iconSpan = thumbnails[0].childNodes.find(
        (child) => child.className === 'se-icon trash'
    );
    assert.ok(iconSpan != null);
});

// -----------------------------------------------------------------------
// Full integration: all items with all conditions met
// -----------------------------------------------------------------------

test('full build with all conditions met (widget, allowed, removable, removeCascade)', () => {
    loadSource();
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => true;
    const component = createDefaultComponent({
        type: 'widget',
        background: false,
        collapsed: false,
        missing: false,
        orderingEndpoints: false,
        removeCascadeAllowed: true,
        hasEndpoints: () => true,
        hasOrderableEndpoints: () => true,
        hasSettings: () => true,
        isRemovable: () => true,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    assert.equal(items.length, 7);
    const titles = items.map((i) => i.title);
    assert.deepEqual(titles, [
        "Rename",
        "Collapse",
        "Order endpoints",
        "Upgrade/Downgrade",
        "Logs",
        "Settings",
        "Delete cascade"
    ]);

    items.forEach((item) => {
        assert.equal(item.enabled, true, `item "${item.title}" should be enabled`);
    });
});

// -----------------------------------------------------------------------
// Full integration: operator type (limits rename + shows collapse labels)
// -----------------------------------------------------------------------

test('operator type: rename disabled, remaining items work', () => {
    loadSource();
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => true;
    const component = createDefaultComponent({
        type: 'operator',
        background: false,
        collapsed: true,
        missing: false,
        orderingEndpoints: true,
        removeCascadeAllowed: true,
        hasEndpoints: () => true,
        hasOrderableEndpoints: () => true,
        hasSettings: () => false,
        isRemovable: () => false,
        _component: {
            meta: { vendor: 'test', name: 'TestOp', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    assert.equal(items.length, 7);

    assert.equal(items[0].enabled, false);
    assert.equal(items[0].title, "Rename");

    assert.equal(items[1].title, "Expand");
    assert.equal(items[2].title, "Stop ordering");

    assert.equal(items[5].enabled, false);

    const deleteItem = items[items.length - 1];
    assert.equal(deleteItem.enabled, false);
});

// -----------------------------------------------------------------------
// Background component: all background-sensitive items disabled
// -----------------------------------------------------------------------

test('background component disables upgrade, collapse, and order endpoints', () => {
    loadSource();
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => true;
    const component = createDefaultComponent({
        type: 'widget',
        background: true,
        collapsed: false,
        missing: false,
        orderingEndpoints: false,
        removeCascadeAllowed: false,
        hasEndpoints: () => true,
        hasOrderableEndpoints: () => true,
        hasSettings: () => true,
        isRemovable: () => true,
        _component: {
            meta: { vendor: 'test', name: 'TestWidget', version: '1.0' },
            isAllowed: () => true,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    assert.equal(items.length, 6);

    assert.equal(items[0].enabled, true);
    assert.equal(items[1].enabled, false);
    assert.equal(items[2].enabled, false);
    assert.equal(items[3].enabled, false);
    assert.equal(items[4].enabled, true);
    assert.equal(items[5].enabled, true);
});

// -----------------------------------------------------------------------
// DispatchEvent on disabled menu items does not fire
// -----------------------------------------------------------------------

test('click on disabled MenuItem does not dispatch click event', () => {
    loadSource();
    let dispatched = false;
    const component = createDefaultComponent({
        type: 'operator',
        _component: {
            meta: { vendor: 'test', name: 'TestOp', version: '1.0' },
            isAllowed: () => false,
            rename: () => {}
        }
    });
    const prefs = new Wirecloud.ui.WiringEditor.ComponentDraggablePrefs(component);
    const items = prefs.build();

    assert.equal(items[0].enabled, false);

    items[0].addEventListener('click', () => { dispatched = true; });
    items[0].click();
    assert.equal(dispatched, false);
});
