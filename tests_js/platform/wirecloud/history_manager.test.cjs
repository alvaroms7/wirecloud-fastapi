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

    // Mock user interface manager
    Wirecloud.UserInterfaceManager = {
        onHistoryChange: () => {},
        header: null
    };

    // Mock URLs
    Wirecloud.URLs = {
        WORKSPACE_VIEW: { evaluate: (opts) => '/workspace/' + opts.owner + '/' + opts.name }
    };

    // Mock location
    Wirecloud.location = { base: 'http://localhost/' };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/HistoryManager.js',
    ]);
});

test('HistoryManager exists on Wirecloud', () => {
    assert.ok(Wirecloud.HistoryManager);
    assert.equal(typeof Wirecloud.HistoryManager.init, 'function');
});

test('HistoryManager._parseStateFromHash parses hash', () => {
    const state = Wirecloud.HistoryManager._parseStateFromHash('#tab=dashboard&view=workspace');
    assert.deepEqual(state, { tab: 'dashboard', view: 'workspace' });
});

test('HistoryManager._parseStateFromHash returns empty for empty hash', () => {
    const state = Wirecloud.HistoryManager._parseStateFromHash('');
    assert.deepEqual(state, {});
});

test('HistoryManager._parseStateFromHash returns empty for just #', () => {
    const state = Wirecloud.HistoryManager._parseStateFromHash('#');
    assert.deepEqual(state, {});
});

test('HistoryManager._parseStateFromHash strips # prefix', () => {
    const state = Wirecloud.HistoryManager._parseStateFromHash('#key=value');
    assert.deepEqual(state, { key: 'value' });
});

test('HistoryManager._parseWorkspaceFromPathName parses workspace path', () => {
    const state = {};
    Wirecloud.HistoryManager._parseWorkspaceFromPathName('/workspace/user1/dashboard1', state);
    assert.equal(state.workspace_owner, 'user1');
    assert.equal(state.workspace_name, 'dashboard1');
});

test('HistoryManager._parseWorkspaceFromPathName root path uses defaults', () => {
    const state = {};
    Wirecloud.HistoryManager._parseWorkspaceFromPathName('/', state);
    assert.equal(state.workspace_owner, 'wirecloud');
    assert.equal(state.workspace_name, 'landing');
});

test('HistoryManager.getCurrentState returns cloned state', () => {
    const state = Wirecloud.HistoryManager.getCurrentState();
    assert.deepEqual(state, {});
});

test('HistoryManager.pushState is a function', () => {
    assert.equal(typeof Wirecloud.HistoryManager.pushState, 'function');
});

test('HistoryManager.replaceState is a function', () => {
    assert.equal(typeof Wirecloud.HistoryManager.replaceState, 'function');
});

test('HistoryManager.init is a function', () => {
    assert.equal(typeof Wirecloud.HistoryManager.init, 'function');
});

// ============================================================
// ADDITIONAL TESTS: pushState, replaceState, buildURL
// ============================================================

const setupHistoryMocks = () => {
    global.history = {
        pushStateCalls: [],
        pushState(data, title, url) {
            this.pushStateCalls.push({ data, title, url });
        },
        replaceStateCalls: [],
        replaceState(data, title, url) {
            this.replaceStateCalls.push({ data, title, url });
        }
    };
    global.document.title = 'Test Title';
    global.location = { hash: '', pathname: '/', search: '?q=1' };
    Wirecloud.UserInterfaceManager.header = {
        currentView: { getTitle() { return 'Test View Title'; } }
    };
};

test.beforeEach(setupHistoryMocks);

test('pushState calls history.pushState when state changes', () => {
    Wirecloud.HistoryManager.pushState({ key: 'value' });
    assert.equal(global.history.pushStateCalls.length, 1);
    assert.equal(global.document.title, 'Test View Title');
});

test('pushState returns early when state is equal', () => {
    Wirecloud.HistoryManager.pushState({ key: 'value' });
    assert.equal(global.history.pushStateCalls.length, 1);
    Wirecloud.HistoryManager.pushState({ key: 'value' });
    assert.equal(global.history.pushStateCalls.length, 1);
});

test('pushState updates currentState via getCurrentState', () => {
    Wirecloud.HistoryManager.pushState({ key: 'value' });
    const state = Wirecloud.HistoryManager.getCurrentState();
    assert.equal(state.key, 'value');
    assert.equal(state.view, 'workspace');
});

test('replaceState calls history.replaceState when state changes', () => {
    Wirecloud.HistoryManager.replaceState({ key: 'value' });
    assert.equal(global.history.replaceStateCalls.length, 1);
});

test('replaceState returns early when state is equal', () => {
    Wirecloud.HistoryManager.replaceState({ key: 'value' });
    assert.equal(global.history.replaceStateCalls.length, 1);
    Wirecloud.HistoryManager.replaceState({ key: 'value' });
    assert.equal(global.history.replaceStateCalls.length, 1);
});

test('replaceState updates document.title', () => {
    Wirecloud.HistoryManager.replaceState({ key: 'value' });
    assert.equal(global.document.title, 'Test View Title');
});

test('buildURL creates workspace URL for custom workspace', () => {
    Wirecloud.HistoryManager.pushState({
        workspace_owner: 'user1',
        workspace_name: 'dash1',
        key: 'val'
    });
    const call = global.history.pushStateCalls[0];
    assert.ok(call.url.href.includes('/workspace/user1/dash1'));
});

test('buildURL creates root URL for landing workspace', () => {
    Wirecloud.HistoryManager.pushState({
        workspace_owner: 'wirecloud',
        workspace_name: 'landing',
        key: 'val'
    });
    const call = global.history.pushStateCalls[0];
    assert.ok(!call.url.href.includes('/workspace/'));
});

test('buildURL includes hash with data keys', () => {
    Wirecloud.HistoryManager.pushState({
        workspace_owner: 'user1',
        workspace_name: 'dash1',
        tab: 'dashboard'
    });
    const call = global.history.pushStateCalls[0];
    assert.ok(call.url.hash.includes('tab=dashboard'));
});

test('buildURL includes params in hash', () => {
    Wirecloud.HistoryManager.pushState({
        workspace_owner: 'user1',
        workspace_name: 'dash1',
        params: { p1: 'v1', p2: 'v2' }
    });
    const call = global.history.pushStateCalls[0];
    assert.ok(call.url.hash.includes('p1=v1'));
    assert.ok(call.url.hash.includes('p2=v2'));
});

test('buildURL preserves window.location.search', () => {
    Wirecloud.HistoryManager.pushState({ key: 'value' });
    const call = global.history.pushStateCalls[0];
    assert.ok(call.url.search.includes('q=1'));
});

test('buildURL excludes reserved keys from hash', () => {
    Wirecloud.HistoryManager.pushState({
        workspace_owner: 'user1',
        workspace_name: 'dash1',
        workspace_title: 'My Workspace',
        tab_id: 'tab1',
        title: 'The Title',
        foo: 'bar'
    });
    const call = global.history.pushStateCalls[0];
    assert.ok(!call.url.hash.includes('workspace_owner='), 'should not include workspace_owner');
    assert.ok(!call.url.hash.includes('workspace_name='), 'should not include workspace_name');
    assert.ok(!call.url.hash.includes('workspace_title='), 'should not include workspace_title');
    assert.ok(!call.url.hash.includes('tab_id='), 'should not include tab_id');
    assert.ok(!call.url.hash.includes('title='), 'should not include title');
    assert.ok(call.url.hash.includes('foo=bar'), 'should include foo');
});

test('prepareData uses document.title when header.currentView is null', () => {
    Wirecloud.UserInterfaceManager.header = null;
    global.document.title = 'Fallback Title';

    Wirecloud.HistoryManager.pushState({ key: 'val' });

    const state = Wirecloud.HistoryManager.getCurrentState();
    assert.equal(state.title, 'Fallback Title');
});

test('HistoryManager.init parses hash and pathname', () => {
    global.addEventListener = () => {};
    global.location.hash = '#tab=dashboard&view=workspace';
    global.location.pathname = '/workspace/user123/project1';
    global.location.search = '?lang=en';
    global.document.title = 'Original Title';
    global.history.replaceStateCalls = [];
    global.history.pushStateCalls = [];

    Wirecloud.HistoryManager.init();

    // init should have called history.replaceState
    assert.equal(global.history.replaceStateCalls.length, 1);

    const state = Wirecloud.HistoryManager.getCurrentState();
    assert.equal(state.tab, 'dashboard');
    assert.equal(state.view, 'workspace');
    assert.equal(state.workspace_owner, 'user123');
    assert.equal(state.workspace_name, 'project1');

    delete global.addEventListener;
});

// === onpopstate: null state returns early ===
test('onpopstate with null state returns early', () => {
    let popstateHandler = null;
    global.addEventListener = (type, handler) => {
        if (type === 'popstate') popstateHandler = handler;
    };
    global.location.hash = '';
    global.location.pathname = '/';
    global.location.search = '';
    global.document.title = 'Test';

    Wirecloud.HistoryManager.init();

    const result = popstateHandler({ state: null });
    assert.equal(result, undefined);
    delete global.addEventListener;
});

// === onpopstate: non-null state updates title and calls onHistoryChange ===
test('onpopstate with state updates document.title and calls onHistoryChange', () => {
    let popstateHandler = null;
    let historyChanged = null;
    Wirecloud.UserInterfaceManager.onHistoryChange = (state) => { historyChanged = state; };
    global.addEventListener = (type, handler) => {
        if (type === 'popstate') popstateHandler = handler;
    };
    global.location.hash = '';
    global.location.pathname = '/';
    global.location.search = '';
    global.document.title = 'Old Title';
    global.history.replaceStateCalls = [];
    global.history.pushStateCalls = [];

    Wirecloud.HistoryManager.init();

    popstateHandler({ state: { title: 'New Title', view: 'dashboard' } });
    assert.equal(global.document.title, 'New Title');
    assert.equal(historyChanged.view, 'dashboard');
    delete global.addEventListener;
});
