const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
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
    Wirecloud.ui = {};

    // Mock Wirecloud globals
    Wirecloud.contextManager = { get: () => 'testuser' };
    Wirecloud.workspacesByUserAndName = {};

    // Load StyledElements dependencies needed by WorkspaceListItems
    loadLegacyScripts([
        'src/wirecloud/commons/static/js/StyledElements/DynamicMenuItems.js',
        'src/wirecloud/commons/static/js/StyledElements/MenuItem.js',
    ]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WorkspaceListItems.js');
});

test('WorkspaceListItems empty list returns disabled empty item', () => {
    const items = new Wirecloud.ui.WorkspaceListItems(() => {});
    const built = items.build();

    assert.equal(built.length, 1);
    assert.ok(built[0] instanceof StyledElements.MenuItem);
});

test('WorkspaceListItems with workspaces returns menu items', () => {
    Wirecloud.workspacesByUserAndName = {
        testuser: {
            dash1: { title: 'Dashboard 1' },
            dash2: { title: 'Dashboard 2' }
        }
    };

    const items = new Wirecloud.ui.WorkspaceListItems(() => {});
    const built = items.build();

    assert.equal(built.length, 2);
    assert.ok(built[0] instanceof StyledElements.MenuItem);
    assert.ok(built[1] instanceof StyledElements.MenuItem);
});
