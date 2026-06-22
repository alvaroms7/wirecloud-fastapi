const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupWorkspace = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.GlobalLogManager = { log: () => {}, parseErrorResponse: (r) => 'error' };
    Wirecloud.io = { makeRequest: () => Promise.resolve({ status: 204 }) };
    Wirecloud.Task = class Task {
        constructor(name, fn) { this._name = name; }
        then() { return this; }
        toTask(n) { return this; }
    };
    Wirecloud.PreferenceManager = {
        buildPreferences: (scope, values, arg) => ({
            addEventListener: () => {},
            removeEventListener: () => {},
            get: () => {},
            destroy: () => {}
        })
    };
    Wirecloud.ContextManager = class ContextManager {
        constructor(instance, desc) {
            this.instance = instance;
            this._desc = desc || {};
        }
        get(key) { return (this._desc[key] && this._desc[key].value) || this._desc[key] || null; }
        modify() {}
        addCallback() {}
        removeCallback() {}
    };
    Wirecloud.Widget = class Widget {
        constructor(data) { Object.assign(this, data); }
    };
    Wirecloud.PolicyManager = { evaluate: () => true };
    Wirecloud.WorkspaceTab = class WorkspaceTab extends StyledElements.ObjectWithEvents {
        constructor(ws, data) {
            super(['change', 'remove', 'addwidget', 'removewidget', 'preremove']);
            this.id = data.id;
            this.name = data.name;
            this.title = data.title || data.name;
            this.initial = !!data.visible;
            this.workspace = ws;
            this.widgets = [];
            this.widgetsById = {};
            this.preferences = {};
        }
        createWidget(resource, data) {
            const widget = new Wirecloud.Widget(data);
            widget.id = data.id || 'widget-' + (this.widgets.length + 1);
            this.widgets.push(widget);
            this.widgetsById[widget.id] = widget;
            return widget;
        }
    };
    Wirecloud.wiring = {};
    Wirecloud.Wiring = class Wiring extends StyledElements.ObjectWithEvents {
        constructor(ws, data) {
            super(['createoperator', 'removeoperator']);
            this.workspace = ws;
            this.operators = [];
            this.operatorsById = {};
        }
    };
    Wirecloud.constants = {
        WORKSPACE_CONTEXT: {
            owner: { label: 'Owner', description: 'Owner', value: 'user1' },
            name: { label: 'Name', description: 'Name', value: 'dash1' },
            title: { label: 'Title', description: 'Title', value: 'My Dashboard' },
            description: { label: 'Desc', description: 'Desc', value: '' },
            longdescription: { label: 'Long', description: 'Long', value: '' },
            creator: { label: 'Creator', description: 'Creator', value: '' },
            readonly: { label: 'R', description: 'R', value: '' },
            widget_permissions: { label: 'WP', description: 'WP', value: '' }
        },
        LOGGING: { ERROR_MSG: 1, WARN_MSG: 2, INFO_MSG: 3, DEBUG_MSG: 4 }
    };
    Wirecloud.URLs = {
        WORKSPACE_VIEW: { evaluate: (o) => '/workspace/' + o.owner + '/' + o.name },
        WORKSPACE_RESOURCE_COLLECTION: { evaluate: (o) => '/api/ws/' + o.workspace_id + '/resources' },
        WORKSPACE_TAB_COLLECTION: { evaluate: (o) => '/api/ws/' + o.workspace_id + '/tabs' },
        WIRING_ENTRY: { evaluate: (o) => '/api/ws/' + o.workspace_id + '/wiring' }
    };
    Wirecloud.location = { base: 'http://localhost/' };
    Wirecloud.URLs.WORKSPACE_ENTRY = { evaluate: (o) => '/api/ws/' + o.workspace_id };
    Wirecloud.URLs.TAB_COLLECTION = { evaluate: (o) => '/api/ws/' + o.workspace_id + '/tabs' };
    Wirecloud.URLs.WORKSPACE_PUBLISH = { evaluate: (o) => '/api/publish/' + o.workspace_id };
    Wirecloud.LocalCatalogue = { _includeResource: () => {} };
    Wirecloud.removeWorkspace = () => Promise.resolve();
    Wirecloud.mergeWorkspace = () => Promise.resolve();
    Wirecloud.live = null;
    Wirecloud.contextManager = { get: () => 'hash' };

    global.URLify = (str) => String(str).toLowerCase().replace(/\s+/g, '-');

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/Workspace.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupWorkspace();
});

test('Workspace constructor creates workspace', () => {
    const data = {
        id: 'ws1',
        owner: 'user1',
        name: 'dash1',
        title: 'My Dashboard',
        tabs: [],
        wiring: { connections: [], operators: {} },
        empty_params: [],
        extra_prefs: {},
        groups: []
    };
    const resources = {};

    const ws = new Wirecloud.Workspace(data, resources);

    assert.equal(ws.id, 'ws1');
    assert.equal(ws.owner, 'user1');
    assert.equal(ws.name, 'dash1');
    assert.equal(ws.title, 'My Dashboard');
    assert.deepEqual(ws.tabs, []);
});

test('Workspace restricted property exists', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    // restricted is a getter; the value depends on contextManager mock
    assert.ok(ws.restricted !== undefined);
});

test('Workspace operators getter', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.deepEqual(ws.operators, []);
});

test('Workspace widgets getter', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.deepEqual(ws.widgets, []);
});

test('Workspace initialtab returns null when no tabs', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.initialtab, null);
});

test('Workspace with tabs has initialtab', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 'tab1', visible: true, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    // initialtab picks the tab with initial=true
    assert.ok(ws.initialtab); // or we can check it
});

// --- Constructor: shared flag ---

test('Workspace shared flag', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', shared: true,
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.shared, true);
});

// --- Constructor: non-shared default ---

test('Workspace shared defaults to false', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.shared, false);
});

// --- Context-based getters ---




// --- tabsById / widgetsById / operatorsById ---

test('Workspace tabsById getter', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 't1', visible: false, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    const byId = ws.tabsById;
    assert.ok(byId.tab1);
});

test('Workspace widgetsById getter', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 't1', visible: false, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    const byId = ws.widgetsById;
    assert.deepEqual(byId, {});
});

// --- updateDate / users ---

test('Workspace updateDate', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', lastmodified: '2024-01-01T00:00:00Z',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.ok(ws.updateDate instanceof Date);
});

test('Workspace users', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', users: [{ name: 'user1' }],
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.deepEqual(ws.users, [{ name: 'user1' }]);
});

// --- removable ---

test('Workspace removable on non-removable', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', removable: false,
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.removable, false);
});

// --- url getter ---


// --- createTab ---



// --- findTab ---

test('Workspace findTab returns tab by id', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 't1', visible: false, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.findTab('tab1').id, 'tab1');
});

test('Workspace findTab returns null for unknown id', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.findTab('unknown'), null);
});

test('Workspace findTab throws on null id', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.throws(() => ws.findTab(null), /Missing id parameter/);
});

// --- findWidget ---


test('Workspace findWidget returns null for unknown id', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.findWidget('unknown'), null);
});

test('Workspace findWidget throws on null id', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.throws(() => ws.findWidget(null), /Missing id parameter/);
});

// --- findOperator ---


// --- isAllowed ---


test('Workspace isAllowed remove on removable', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', removable: true, tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.isAllowed('remove'), true);
});

test('Workspace isAllowed rename on removable', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', removable: true, tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.isAllowed('rename'), true);
});

test('Workspace isAllowed edit on removable', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', removable: true, tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.isAllowed('edit'), true);
});

test('Workspace isAllowed merge_workspaces', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', removable: true, tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.isAllowed('merge_workspaces'), true);
});

test('Workspace isAllowed merge_workspaces when add_remove_iwidgets denied', () => {
    const origEvaluate = Wirecloud.PolicyManager.evaluate;
    Wirecloud.PolicyManager.evaluate = (permission) => permission !== 'add_remove_iwidgets';
    const data = { id: 'ws1', owner: 'u', name: 'd', removable: true, tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.isAllowed('merge_workspaces'), true);
    Wirecloud.PolicyManager.evaluate = origEvaluate;
});

test('Workspace isAllowed update_preferences', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', removable: true, tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.isAllowed('update_preferences'), true);
});

test('Workspace isAllowed default delegates to PolicyManager', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', removable: true, tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.isAllowed('add_remove_iwidgets'), true);
});

// --- rename ---

test('Workspace rename throws on invalid title', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.throws(() => ws.rename(''), /invalid title parameter/);
    assert.throws(() => ws.rename('  '), /invalid title parameter/);
});

test('Workspace rename server success', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const data = { id: 'ws1', owner: 'u', name: 'd', title: 'Old', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    const result = await ws.rename('New');
    assert.equal(result, ws);
});

// --- publish ---

test('Workspace publish throws on missing options', () => {
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.throws(() => ws.publish(), /missing options/);
});

test('Workspace publish with options', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 201, responseText: '{"uri":"V/N/1.0","vendor":"V","name":"N","version":{"text":"1.0"}}' });
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    const result = await ws.publish({ name: 'MyMashup', vendor: 'MyVendor', version: '1.0' });
    assert.equal(result, undefined);
});

// --- publish with image ---

test('Workspace publish with image', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 201, responseText: '{"uri":"V/N/2.0","vendor":"V","name":"N","version":{"text":"2.0"}}' });
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    const result = await ws.publish({ name: 'M', vendor: 'V', version: '2.0', image: 'fakeblob' });
    assert.equal(result, undefined);
});

// --- remove ---

test('Workspace remove calls Wirecloud.removeWorkspace', async () => {
    let removeCalled = false;
    Wirecloud.removeWorkspace = () => {
        removeCalled = true;
        return Promise.resolve();
    };
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    try { await ws.remove(); } catch (e) {}
    assert.equal(removeCalled, true);
});

// --- merge ---

test('Workspace merge delegates to Wirecloud.mergeWorkspace', () => {
    let mergeCalled = false;
    Wirecloud.mergeWorkspace = () => {
        mergeCalled = true;
        return Promise.resolve();
    };
    const data = { id: 'ws1', owner: 'u', name: 'd', tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    ws.merge({});
    assert.equal(mergeCalled, true);
});

// --- unload ---


// ============================================================
// description / longdescription / url getters
// ============================================================

test('Workspace description getter delegates to contextManager', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', description: 'A test workspace', longdescription: 'Longer description',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    let getCalls = [];
    Wirecloud.ContextManager = class ContextManager {
        constructor(inst, desc) { this.instance = inst; this._desc = desc || {}; }
        get(key) { getCalls.push(key); return 'custom-' + key; }
        modify() {} addCallback() {} removeCallback() {}
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.description, 'custom-description');
    assert.ok(getCalls.includes('description'));
});

test('Workspace longdescription getter delegates to contextManager', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', description: 'desc', longdescription: 'long desc',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    let getCalls = [];
    Wirecloud.ContextManager = class ContextManager {
        constructor(inst, desc) { this.instance = inst; this._desc = desc || {}; }
        get(key) { getCalls.push(key); return 'custom-' + key; }
        modify() {} addCallback() {} removeCallback() {}
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.longdescription, 'custom-longdescription');
    assert.ok(getCalls.includes('longdescription'));
});

test('Workspace url getter builds correct URL', () => {
    const data = {
        id: 'ws1', owner: 'user1', name: 'dash1',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    const url = ws.url;
    assert.ok(url.href.includes('/workspace/user1/dash1'));
});

test('Workspace emptyparams and extraprefs', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: ['pref1'], extra_prefs: { custom: true },
        groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.deepEqual(ws.emptyparams, ['pref1']);
    assert.deepEqual(ws.extraprefs, { custom: true });
});

// --- groups ---

test('Workspace groups', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: [{ name: 'g1' }]
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.deepEqual(ws.groups, [{ name: 'g1' }]);
});

// === createTab ===

test('createTab sends POST and returns created tab', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({
        status: 201,
        responseText: JSON.stringify({ id: 'new-tab', name: 'new-tab', title: 'New Tab', visible: false, widgets: [], preferences: {} })
    });
    const data = {
        id: 'ws1', owner: 'u', name: 'd', title: 'Dashboard',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    const tab = await ws.createTab({ title: 'New Tab' });

    assert.ok(tab);
    assert.equal(tab.id, 'new-tab');
    assert.equal(ws.tabs.length, 1);
});

test('createTab auto-generates title when not provided', async () => {
    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({
            status: 201,
            responseText: JSON.stringify({ id: 'auto-tab', name: reqBody.name, title: reqBody.title, visible: false, widgets: [], preferences: {} })
        });
    };
    const data = {
        id: 'ws1', owner: 'u', name: 'd', title: 'Dashboard',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    const tab = await ws.createTab();

    assert.ok(tab);
    assert.ok(reqBody.title.includes('Tab'));
    assert.ok(reqBody.name.length > 0);
});

test('createTab rejects on server error status', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });
    Wirecloud.GlobalLogManager.parseErrorResponse = () => 'server-error';
    const data = {
        id: 'ws1', owner: 'u', name: 'd', title: 'Dashboard',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    await assert.rejects(() => ws.createTab({ title: 'New Tab' }), /server-error/);
});

test('createTab rejects on unexpected status', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200 });
    const data = {
        id: 'ws1', owner: 'u', name: 'd', title: 'Dashboard',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    await assert.rejects(() => ws.createTab({}));
});

test('createTab creates widgets from server response (lines 56-59)', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({
        status: 201,
        responseText: JSON.stringify({
            id: 'tab-with-widgets',
            name: 'tab-with-widgets',
            title: 'Tab With Widgets',
            visible: false,
            widgets: [
                { id: 'w1', widget: 'V/W/1.0', title: 'Widget 1' },
                { id: 'w2', widget: 'V/W/1.0', title: 'Widget 2' }
            ],
            preferences: {}
        })
    });
    const resources = {
        findResource: () => ({ id: 'V/W/1.0', meta: { type: 'widget' } })
    };
    const data = {
        id: 'ws1', owner: 'u', name: 'd', title: 'Dashboard',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, resources);
    const tab = await ws.createTab({ title: 'Tab With Widgets' });

    assert.equal(tab.id, 'tab-with-widgets');
    assert.equal(tab.widgets.length, 2);
    assert.equal(tab.widgets[0].id, 'w1');
    assert.equal(tab.widgets[1].id, 'w2');
});

test('createTab auto-generates title with duplicate detection (lines 68, 77-82)', async () => {
    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({
            status: 201,
            responseText: JSON.stringify({
                id: 'auto-tab2', name: reqBody.name, title: reqBody.title,
                visible: false, widgets: [], preferences: {}
            })
        });
    };
    const data = {
        id: 'ws1', owner: 'u', name: 'd', title: 'Dashboard',
        tabs: [
            { id: 'tab1', name: 'tab-2', title: 'Tab 2', visible: false, widgets: [], preferences: {} }
        ],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    const tab = await ws.createTab();

    assert.equal(tab.id, 'auto-tab2');
    assert.equal(reqBody.title, 'Tab 2 (2)');
    assert.ok(ws.tabs.length, 2);
});

// === findWidget with match ===

test('findWidget returns widget by ID from tabs', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 't1', visible: false, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    const mockWidget = { id: 'w-find-me', name: 'FoundWidget' };
    ws.tabs[0].widgets.push(mockWidget);

    assert.equal(ws.findWidget('w-find-me'), mockWidget);
    assert.equal(ws.findWidget('nonexistent'), null);
});

// === findOperator delegation ===

test('findOperator delegates to wiring.findOperator', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    let called = false;
    ws.wiring.findOperator = () => { called = true; return null; };

    ws.findOperator('op1');
    assert.ok(called);
});

// === unload ===

test('unload dispatches unload event', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    let unloaded = false;
    ws.addEventListener('unload', () => { unloaded = true; });
    ws.wiring.removeEventListener = () => {};

    ws.unload();

    assert.ok(unloaded);
});

test('unload returns this for chaining', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    ws.wiring.removeEventListener = () => {};

    assert.equal(ws.unload(), ws);
});

test('unload removes wiring event listeners', () => {
    let createOpRemoved = false;
    let removeOpRemoved = false;
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    ws.wiring.removeEventListener = (event) => {
        if (event === 'createoperator') createOpRemoved = true;
        if (event === 'removeoperator') removeOpRemoved = true;
    };

    ws.unload();

    assert.ok(createOpRemoved);
    assert.ok(removeOpRemoved);
});

test('unload removes live workspace listener when Wirecloud.live exists', () => {
    let liveRemoved = false;
    Wirecloud.live = {
        addEventListener: () => {},
        removeEventListener: (event) => { if (event === 'workspace') liveRemoved = true; }
    };

    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    ws.wiring.removeEventListener = () => {};
    ws.unload();

    assert.ok(liveRemoved);
});

// === constructor with Wirecloud.live ===

test('constructor registers live workspace listener when Wirecloud.live exists', () => {
    let liveRegistered = false;
    Wirecloud.live = {
        addEventListener: (event, handler) => { if (event === 'workspace') liveRegistered = true; },
        removeEventListener: () => {}
    };

    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    new Wirecloud.Workspace(data, {});

    assert.ok(liveRegistered);
});

// === isAllowed: restricted path ===

test('isAllowed returns false when restricted (embedded mode)', () => {
    Wirecloud.contextManager.get = (key) => key === 'mode' ? 'embedded' : 'hash';
    Wirecloud.PolicyManager.evaluate = () => true;

    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    assert.equal(ws.isAllowed('remove'), false);
    assert.equal(ws.isAllowed('edit'), false);
    assert.equal(ws.isAllowed('add_remove_iwidgets'), false);
});

test('isAllowed returns false when restricted (non-removable)', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', removable: false,
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    assert.equal(ws.isAllowed('remove'), false);
    assert.equal(ws.isAllowed('edit'), false);
    assert.equal(ws.isAllowed('rename'), false);
});

test('isAllowed remove on non-removable workspace returns false', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', removable: false,
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    assert.equal(ws.isAllowed('remove'), false);
});

test('isAllowed update_preferences denied when not removable', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', removable: false,
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    assert.equal(ws.isAllowed('update_preferences'), false);
});

test('isAllowed rename denied when not removable', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd', removable: false,
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    assert.equal(ws.isAllowed('rename'), false);
});

test('isAllowed merge_workspaces when both add_remove_iwidgets and merge_workspaces denied', () => {
    const origEvaluate = Wirecloud.PolicyManager.evaluate;
    Wirecloud.PolicyManager.evaluate = () => false;
    const data = { id: 'ws1', owner: 'u', name: 'd', removable: true, tabs: [], wiring: { connections: [], operators: {} }, empty_params: [], extra_prefs: {}, groups: [] };
    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.isAllowed('merge_workspaces'), false);
    Wirecloud.PolicyManager.evaluate = origEvaluate;
});

// === rename ===

test('rename accepts custom name parameter', async () => {
    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };
    const data = {
        id: 'ws1', owner: 'u', name: 'old-name', title: 'Old Title',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    await ws.rename('New Title', 'custom-name');

    assert.equal(reqBody.name, 'custom-name');
    assert.equal(reqBody.title, 'New Title');
});

test('rename rejects on server error response', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });
    Wirecloud.GlobalLogManager.parseErrorResponse = () => 'rename-failed';
    const data = {
        id: 'ws1', owner: 'u', name: 'd', title: 'Old',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    await assert.rejects(() => ws.rename('New'), /rename-failed/);
});

test('rename rejects on unexpected status code', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200 });
    const data = {
        id: 'ws1', owner: 'u', name: 'd', title: 'Old',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    await assert.rejects(() => ws.rename('New'));
});

test('rename auto-generates name from title when name omitted', async () => {
    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };
    const data = {
        id: 'ws1', owner: 'u', name: 'old-name', title: 'Old Title',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    await ws.rename('My New Title');

    assert.equal(reqBody.name, 'my-new-title');
});

// === publish error paths ===

test('publish rejects on server error', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });
    Wirecloud.GlobalLogManager.parseErrorResponse = () => 'publish-failed';
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    await assert.rejects(() => ws.publish({ name: 'M', vendor: 'V', version: '1.0' }), /publish-failed/);
});

test('publish rejects on unexpected status', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 302 });
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    await assert.rejects(() => ws.publish({ name: 'M', vendor: 'V', version: '1.0' }));
});

// === constructor: creates tabs ===

test('constructor creates tabs from data', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [
            { id: 'tab-alpha', name: 'alpha', visible: true, widgets: [], preferences: {} },
            { id: 'tab-beta', name: 'beta', visible: false, widgets: [], preferences: {} }
        ],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };

    const ws = new Wirecloud.Workspace(data, {});
    assert.equal(ws.tabs.length, 2);
    assert.equal(ws.tabs[0].id, 'tab-alpha');
    assert.equal(ws.tabs[1].id, 'tab-beta');
});

// === constructor: resources property ===

test('constructor stores resources reference', () => {
    const resources = { findResource: () => {} };
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, resources);
    assert.equal(ws.resources, resources);
});

// === on_removetab dispatches removetab event (lines 171-180) ===

test('Workspace dispatches removetab event when tab fires remove', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 't1', visible: false, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    let removetabFired = false;
    let removedTab = null;
    ws.addEventListener('removetab', (ctx, tab) => { removetabFired = true; removedTab = tab; });

    const tab = ws.tabs[0];
    tab.dispatchEvent('remove', tab);

    assert.ok(removetabFired);
    assert.equal(removedTab, tab);
    assert.equal(ws.tabs.length, 0);
});

// === on_removeoperator dispatches removeoperator event (line 184) ===

test('Workspace dispatches removeoperator event when wiring fires removeoperator', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    let removeOperatorFired = false;
    let removedOp = null;
    ws.addEventListener('removeoperator', (ctx, op) => { removeOperatorFired = true; removedOp = op; });

    const fakeOp = { id: 'op-rm', meta: { type: 'operator' } };
    ws.wiring.dispatchEvent('removeoperator', fakeOp);

    assert.ok(removeOperatorFired);
    assert.equal(removedOp, fakeOp);
});

// === on_removewidget dispatches removewidget event (line 188) ===

test('Workspace dispatches removewidget event when tab fires removewidget', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 't1', visible: false, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    let removeWidgetFired = false;
    let removedWidget = null;
    ws.addEventListener('removewidget', (ctx, w) => { removeWidgetFired = true; removedWidget = w; });

    const fakeWidget = { id: 'w-rm' };
    const tab = ws.tabs[0];
    tab.dispatchEvent('removewidget', fakeWidget);

    assert.ok(removeWidgetFired);
    assert.equal(removedWidget, fakeWidget);
});

// === on_addwidget with null view dispatches createwidget (lines 150-155) ===

test('Workspace dispatches createwidget on addwidget with null view', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 't1', visible: false, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const resources = { addComponent: () => {}, findResource: () => null, getOrCreateMissing: () => {} };
    const ws = new Wirecloud.Workspace(data, resources);
    let createWidgetFired = false;
    let createdWidget = null;
    ws.addEventListener('createwidget', (ctx, w) => { createWidgetFired = true; createdWidget = w; });

    const fakeWidget = { id: 'w-new', meta: { type: 'widget', vendor: 'V', name: 'N', version: { text: '1.0' } } };
    const tab = ws.tabs[0];
    tab.dispatchEvent('addwidget', fakeWidget, null);

    assert.ok(createWidgetFired);
    assert.equal(createdWidget, fakeWidget);
});

// === constructor registers on_livemessage when Wirecloud.live exists (line 421-423) ===

test('Workspace constructor registers live message listener when Wirecloud.live exists', () => {
    let liveEventRegistered = false;
    const origLive = Wirecloud.live;
    Wirecloud.live = {
        addEventListener: (event, handler) => {
            if (event === 'workspace') liveEventRegistered = true;
        }
    };

    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});

    assert.ok(liveEventRegistered, 'live workspace listener should be registered');
    assert.ok(ws);

    Wirecloud.live = origLive;
});

// === on_livemessage dispatches change event when workspace matches (lines 158-167) ===

test('Workspace on_livemessage dispatches change on matching workspace id', () => {
    const origLive = Wirecloud.live;
    let liveHandler = null;
    Wirecloud.live = {
        addEventListener: (event, handler) => {
            if (event === 'workspace') liveHandler = handler;
        }
    };

    const data = {
        id: 'ws-live', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    ws.contextManager = new Wirecloud.ContextManager(ws, { name: { value: 'old-name' } });
    ws.contextManager.modify = (updates) => { ws._modifiedName = updates.name; };

    let changeFired = false;
    let changedProps = null;
    ws.addEventListener('change', (ctx, props) => { changeFired = true; changedProps = props; });

    // Trigger the live message handler (first arg is the event source, second is the data)
    liveHandler(null, { workspace: 'ws-live', name: 'new-name' });

    assert.ok(changeFired, 'change event should fire');
    assert.ok(changedProps.includes('name'));
    assert.equal(ws._modifiedName, 'new-name');

    Wirecloud.live = origLive;
});

// --- operatorsById getter (line 104) ---

test('Workspace operatorsById getter returns wiring operatorsById', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const ws = new Wirecloud.Workspace(data, {});
    assert.deepEqual(ws.operatorsById, {});
});

// --- on_createoperator dispatches createoperator event (lines 146-147) ---

test('Workspace on_createoperator dispatches createoperator event', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [], wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const resources = { addComponent: () => {}, findResource: () => null, getOrCreateMissing: () => {} };
    const ws = new Wirecloud.Workspace(data, resources);

    let createOpFired = false;
    ws.addEventListener('createoperator', () => { createOpFired = true; });

    const fakeOp = { id: 'op-new', meta: { type: 'operator', uri: 'V/O/1.0' } };
    ws.wiring.dispatchEvent('createoperator', fakeOp);

    assert.ok(createOpFired);
});

// --- on_changetab dispatches changetab event (line 142) ---

test('Workspace on_changetab dispatches changetab event', () => {
    const data = {
        id: 'ws1', owner: 'u', name: 'd',
        tabs: [{ id: 'tab1', name: 't1', visible: false, widgets: [], preferences: {} }],
        wiring: { connections: [], operators: {} },
        empty_params: [], extra_prefs: {}, groups: []
    };
    const resources = { addComponent: () => {}, findResource: () => null, getOrCreateMissing: () => {} };
    const ws = new Wirecloud.Workspace(data, resources);

    let changetabFired = false;
    ws.addEventListener('changetab', () => { changetabFired = true; });

    const tab = ws.tabs[0];
    tab.dispatchEvent('change', ['name']);

    assert.ok(changetabFired, 'changetab event should fire when tab changes');
});
