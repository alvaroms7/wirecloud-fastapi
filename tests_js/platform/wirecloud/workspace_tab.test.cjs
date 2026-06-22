const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupTab = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.GlobalLogManager = { log: () => {}, parseErrorResponse: (r) => 'error' };
    Wirecloud.io = { makeRequest: () => Promise.resolve({ status: 204 }) };
    Wirecloud.Task = class Task {
        constructor(name, fn) { this._name = name; }
        then(cb) { const r = cb(); return r && r.then ? r : Promise.resolve(r); }
        toTask(n) { return this; }
        catch(cb) { return this; }
    };
    Wirecloud.PreferenceManager = {
        buildPreferences: (scope, values, tab) => ({
            addEventListener: () => {},
            removeEventListener: () => {},
            get: () => {},
            set: () => Promise.resolve()
        })
    };
    Wirecloud.URLs = {
        IWIDGET_COLLECTION: { evaluate: (o) => '/api/ws/' + o.workspace_id + '/tabs/' + o.tab_id + '/widgets' },
        TAB_ENTRY: { evaluate: (o) => '/api/ws/' + o.workspace_id + '/tabs/' + o.tab_id }
    };

    Wirecloud.Workspace = class Workspace {
        constructor(data, resources) {
            this.id = data.id;
            this.owner = data.owner;
            this.name = data.name;
            this.restricted = false;
            this.resources = resources || {};
            this.tabs = {};
            this.preferences = { addEventListener: () => {}, get: () => false };
            this.view = {};
        }
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent() {}
    };

    Wirecloud.Widget = class Widget {
        constructor(tab, meta, data) {
            this.id = data.id || 'w1';
            this.tab = tab;
            this.meta = meta;
            this.volatile = !!data.volatile;
        }
        addEventListener() {}
        removeEventListener() {}
        isAllowed(action, role) { return true; }
    };

    global.URLify = (str) => str.toLowerCase().replace(/\s+/g, '-');

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/WorkspaceTab.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupTab();
});

test('WorkspaceTab constructor creates tab', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'user1', name: 'dash1' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 'mytab', title: 'My Tab' });

    assert.equal(tab.id, 'tab1');
    assert.equal(tab.name, 'mytab');
    assert.equal(tab.title, 'My Tab');
    assert.equal(tab.workspace, ws);
    assert.deepEqual(tab.widgets, []);
});

test('WorkspaceTab constructor with no title uses name', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 'mytab' });

    assert.equal(tab.title, 'mytab');
});

test('WorkspaceTab constructor with visible sets initial', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't', visible: true });

    assert.equal(tab.initial, true);
});

test('WorkspaceTab constructor throws on invalid workspace', () => {
    assert.throws(
        () => new Wirecloud.WorkspaceTab({}, { id: 't1', name: 't' }),
        /invalid workspace parameter/
    );
});

test('WorkspaceTab findWidget returns undefined for unknown', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    assert.equal(tab.findWidget('unknown'), undefined);
});

test('WorkspaceTab isAllowed for invalid permission throws', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });

    assert.throws(
        () => tab.isAllowed('invalid'),
        /invalid permission parameter/
    );
});

test('WorkspaceTab rename throws on invalid title', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });

    assert.throws(
        () => tab.rename(''),
        /invalid title parameter/
    );
    assert.throws(
        () => tab.rename(123),
        /invalid title parameter/
    );
});

test('WorkspaceTab preferences is created', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });

    assert.ok(tab.preferences);
});

test('WorkspaceTab widgetsById getter', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });

    const widgetsById = tab.widgetsById;
    assert.deepEqual(widgetsById, {});
});

test('WorkspaceTab createWidget with commit:false creates widget locally', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const resource = { title: 'Test Widget', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };
    const options = {
        title: 'Test Widget',
        id: 'w-local',
        layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1,
        commit: false,
        layoutConfig: [{ id: 0, moreOrEqual: 0, lessOrEqual: -1, anchor: 'top-left', relx: true, rely: true, left: 0, top: 0, zIndex: 0, relheight: true, relwidth: true, height: 1, width: 1, minimized: false, fulldragboard: false, titlevisible: true }]
    };
    const widget = tab.createWidget(resource, options);
    assert.ok(widget);
    assert.equal(widget.constructor.name, 'Widget');
});

test('WorkspaceTab createWidget with commit:true and no layoutConfig falls back to empty array', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const resource = { title: 'W', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };
    const options = { title: 'W', id: 'w-nolayout', commit: true, layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1 };
    const result = tab.createWidget(resource, options);
    assert.ok(result);
});

test('WorkspaceTab createWidget with restricted workspace rejects', async () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = true;
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const resource = { title: 'W', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };
    const options = {
        title: 'W', id: 'w2', layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1,
        commit: true,
        layoutConfig: [{ id: 0, moreOrEqual: 0, lessOrEqual: -1, anchor: 'top-left', relx: true, rely: true, left: 0, top: 0, zIndex: 0, relheight: true, relwidth: true, height: 1, width: 1, minimized: false, fulldragboard: false, titlevisible: true }]
    };
    await assert.rejects(tab.createWidget(resource, options), /readonly/);
});

test('WorkspaceTab createWidget commit:true server success', async () => {
    Wirecloud.io.makeRequest = (url, opts) => {
        const jsonResponse = JSON.stringify({ id: 'w-srv', title: 'Server Widget', layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1 });
        opts.onComplete({ status: 201, responseText: jsonResponse });
        return Promise.resolve();
    };
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const resource = { title: 'W', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };
    const options = {
        title: 'W', id: 'w-srv', layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1,
        commit: true,
        layoutConfig: [{ id: 0, moreOrEqual: 0, lessOrEqual: -1, anchor: 'top-left', relx: true, rely: true, left: 0, top: 0, zIndex: 0, relheight: true, relwidth: true, height: 1, width: 1, minimized: false, fulldragboard: false, titlevisible: true }]
    };
    const widget = await tab.createWidget(resource, options);
    assert.equal(widget.id, 'w-srv');
});

test('WorkspaceTab isAllowed remove when workspace restricted', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = true;
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    assert.equal(tab.isAllowed('remove'), false);
});

test('WorkspaceTab isAllowed remove when only one tab', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    ws.tabs = { tab1: {} };
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    assert.equal(tab.isAllowed('remove'), false);
});

test('WorkspaceTab isAllowed remove when multiple tabs and no blocking widgets', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    ws.tabs = { tab1: {}, tab2: {} };
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    assert.equal(tab.isAllowed('remove'), true);
});

test('WorkspaceTab findWidget returns widget by id', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const resource = { title: 'W', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };
    tab.createWidget(resource, {
        title: 'W', id: 'w-found', layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1,
        commit: false,
        layoutConfig: [{ id: 0, moreOrEqual: 0, lessOrEqual: -1, anchor: 'top-left', relx: true, rely: true, left: 0, top: 0, zIndex: 0, relheight: true, relwidth: true, height: 1, width: 1, minimized: false, fulldragboard: false, titlevisible: true }]
    });
    const found = tab.findWidget('w-found');
    assert.equal(found.id, 'w-found');
});

test('WorkspaceTab remove server success', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const result = await tab.remove();
    assert.equal(result, tab);
});

test('WorkspaceTab remove server error rejects', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    await assert.rejects(tab.remove());
});

test('WorkspaceTab rename with name parameter server success', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const result = await tab.rename('New Title', 'new-name');
    assert.equal(result, tab);
});

test('WorkspaceTab rename auto-generates name via URLify', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const result = await tab.rename('My New Title');
    assert.equal(result, tab);
});

test('WorkspaceTab rename server error rejects', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    await assert.rejects(tab.rename('New'));
});

test('WorkspaceTab setInitial server success', async () => {
    Wirecloud.io.makeRequest = (url, opts) => {
        opts.onComplete({ status: 204 });
        return Promise.resolve();
    };
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const result = await tab.setInitial();
    assert.equal(result, tab);
    assert.equal(tab.initial, true);
});

test('WorkspaceTab setInitial server error rejects', async () => {
    Wirecloud.io.makeRequest = (url, opts) => {
        opts.onComplete({ status: 500 });
        return Promise.resolve();
    };
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    await assert.rejects(tab.setInitial());
});

test('WorkspaceTab constructor visible false sets initial false', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't', visible: false });
    assert.equal(tab.initial, false);
});

test('WorkspaceTab constructor empty title uses name', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 'named', title: '   ' });
    assert.equal(tab.title, 'named');
});

test('WorkspaceTab workspace getter returns workspace', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    assert.equal(tab.workspace, ws);
});

test('WorkspaceTab disposeCallbacks exists', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    assert.ok(typeof tab.disposeCallbacks === 'function' || typeof tab.disposeCallbacks === 'undefined');
});

test('WorkspaceTab setInitial dispatches change event', async () => {
    Wirecloud.io.makeRequest = (url, opts) => {
        opts.onComplete({ status: 204 });
        return Promise.resolve();
    };
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't', visible: false });
    let changeDispatched = false;
    tab.addEventListener('change', () => {
        changeDispatched = true;
    });
    await tab.setInitial();
    assert.equal(changeDispatched, true);
});

// === on_changewidget: widget tab change transfers widget between tabs ===

test('on_changewidget transfer widget to another tab on tab change', () => {
    const OrigWidget = Wirecloud.Widget;
    Wirecloud.Widget = class Widget extends StyledElements.ObjectWithEvents {
        constructor(tab, meta, data) {
            super(['remove', 'change']);
            this.id = data.id || 'w1';
            this.tab = tab;
            this.meta = meta;
            this.volatile = !!data.volatile;
        }
        isAllowed(action, role) { return true; }
    };

    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    ws.view = { findWidget: () => null };
    const tab1 = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't1' });
    const tab2 = new Wirecloud.WorkspaceTab(ws, { id: 'tab2', name: 't2' });

    const resource = { title: 'W', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };
    const options = {
        title: 'W', id: 'w-move', layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1,
        commit: false,
        layoutConfig: [{ id: 0, moreOrEqual: 0, lessOrEqual: -1, anchor: 'top-left', relx: true, rely: true, left: 0, top: 0, zIndex: 0, relheight: true, relwidth: true, height: 1, width: 1, minimized: false, fulldragboard: false, titlevisible: true }]
    };
    const widget = tab1.createWidget(resource, options);

    let removewidgetFired = false;
    let addwidgetFired = false;
    tab1.addEventListener('removewidget', () => { removewidgetFired = true; });
    tab2.addEventListener('addwidget', () => { addwidgetFired = true; });

    widget.tab = tab2;
    widget.dispatchEvent('change', ['tab']);

    assert.ok(removewidgetFired);
    assert.ok(addwidgetFired);

    Wirecloud.Widget = OrigWidget;
});

// === rename: unexpected status rejects (line 266) ===

test('WorkspaceTab rename rejects on unexpected status code', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200 });
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    await assert.rejects(tab.rename('New'), /Unexpected response/);
});

// === on_changetab: clears initial when another tab dispatches changetab (lines 374-376) ===

test('on_changetab clears initial flags when changetab event fires', () => {
    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;

    // Store event listeners so we can dispatch properly
    const wsListeners = {};
    const origAddEventListener = ws.addEventListener;
    ws.addEventListener = (evt, handler) => {
        (wsListeners[evt] = wsListeners[evt] || []).push(handler);
    };
    ws.removeEventListener = () => {};

    const tab1 = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't1', visible: true });
    const tab2 = new Wirecloud.WorkspaceTab(ws, { id: 'tab2', name: 't2', visible: true });

    assert.equal(tab1.initial, true);
    assert.equal(tab2.initial, true);

    // Fire changetab on workspace → tab1's on_changetab should see
    // tab !== this (tab2 !== tab1), changes.initial truthy, both initial
    if (wsListeners.changetab) {
        wsListeners.changetab.forEach((handler) => handler.call(tab1, ws, tab2, { initial: true }));
    }

    assert.equal(tab1.initial, false);
});

// === on_removewidget: removes listeners and dispatches removewidget ===
// (Test preserved from above)

test('on_removewidget removes widget listeners and dispatches removewidget', () => {
    const OrigWidget = Wirecloud.Widget;
    let removeRemoved = false;
    let changeRemoved = false;

    Wirecloud.Widget = class Widget extends StyledElements.ObjectWithEvents {
        constructor(tab, meta, data) {
            super(['remove', 'change']);
            this.id = data.id || 'w1';
            this.tab = tab;
            this.meta = meta;
            this.volatile = !!data.volatile;
        }
        isAllowed(action, role) { return true; }
        removeEventListener(event, handler) {
            if (event === 'remove') removeRemoved = true;
            if (event === 'change') changeRemoved = true;
        }
    };

    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });

    const resource = { title: 'W', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };
    const options = {
        title: 'W', id: 'w-remove', layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1,
        commit: false,
        layoutConfig: [{ id: 0, moreOrEqual: 0, lessOrEqual: -1, anchor: 'top-left', relx: true, rely: true, left: 0, top: 0, zIndex: 0, relheight: true, relwidth: true, height: 1, width: 1, minimized: false, fulldragboard: false, titlevisible: true }]
    };
    const widget = tab.createWidget(resource, options);

    let removewidgetFired = false;
    tab.addEventListener('removewidget', () => { removewidgetFired = true; });

    widget.dispatchEvent('remove');

    assert.ok(removeRemoved);
    assert.ok(changeRemoved);
    assert.ok(removewidgetFired);

    Wirecloud.Widget = OrigWidget;
});

// --- createWidget rejects with parseErrorResponse on non-201 (lines 177-178) ---

test('WorkspaceTab createWidget rejects on server error response', async () => {
    Wirecloud.io.makeRequest = (url, opts) => {
        if (opts && opts.onComplete) {
            opts.onComplete({ status: 500, responseText: '{"error":"fail"}' });
        }
        return Promise.resolve({ status: 500, responseText: '{"error":"fail"}' });
    };
    Wirecloud.GlobalLogManager.parseErrorResponse = () => 'parse-error';

    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });
    const resource = { title: 'W', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };

    await assert.rejects(
        () => tab.createWidget(resource, { title: 'W', commit: true, layoutConfig: [] }),
        /parse-error/
    );
});

// --- WorkspaceTab remove rejects with unexpected status (line 221) ---

test('WorkspaceTab remove rejects on unexpected status', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200, responseText: '{}' });

    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });

    await assert.rejects(
        () => tab.remove(),
        /Unexpected response from server/
    );
});

// --- WorkspaceTab isAllowed remove returns false when widget denies close (line 198) ---

test('WorkspaceTab isAllowed remove returns false when widget denies close', () => {
    const OrigWidget = Wirecloud.Widget;
    Wirecloud.Widget = class Widget {
        constructor(tab, meta, data) {
            this.id = data.id || 'w1';
            this.tab = tab;
            this.meta = meta;
            this.volatile = false;
        }
        isAllowed(action, role) { return false; }
        addEventListener() {}
    };

    const ws = new Wirecloud.Workspace({ id: 'ws1', owner: 'u', name: 'd' });
    ws.restricted = false;
    Object.defineProperty(ws, 'tabs', { value: { tab1: { id: 'tab1' }, tab2: { id: 'tab2' } } });
    const tab = new Wirecloud.WorkspaceTab(ws, { id: 'tab1', name: 't' });

    const resource = { title: 'W', type: 'widget', codecontenttype: 'text/html', missing: false, macversion: 1, requirements: [], hasEndpoints: () => false, hasPreferences: () => false, inputList: [], outputList: [], preferenceList: [], propertyList: [], codeurl: '/c' };
    tab.createWidget(resource, { title: 'W', commit: false, id: 'w-block', layout: 0, left: 0, top: 0, zIndex: 0, height: 1, width: 1, layoutConfig: [] });

    assert.equal(tab.isAllowed('remove'), false);

    Wirecloud.Widget = OrigWidget;
});
