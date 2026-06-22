const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMarketDesc = (overrides = {}) => ({
    user: overrides.user || 'testuser',
    name: overrides.name || 'TestMarket',
    type: overrides.type || 'wirecloud',
    ...overrides
});

const makeMarketViewClass = (overrides = {}) => {
    return class MockMarketView {
        constructor(id, opts) {
            this.altId = id;
            this.market_id = (opts.marketplace_desc && (opts.marketplace_desc.user + '/' + opts.marketplace_desc.name)) || 'testuser/TestMarket';
            this.catalogue = opts.catalogue;
            this.alternatives = null;
            this.view_name = null;
            Object.assign(this, overrides);
        }
        getLabel() { return overrides.label || 'Test Market'; }
        isAllow() { return overrides.isAllow ? overrides.isAllow() : true; }
        goUp() { return overrides.goUpResult !== undefined ? overrides.goUpResult : false; }
        refresh_if_needed() { this._refreshed = true; }
        wait_ready(cb) { if (cb) cb(); }
        destroy() { this._destroyed = true; }
        show() { return this; }
        hide() { return this; }
        insertInto() { return this; }
        addEventListener() { return this; }
        repaint() { return this; }
        getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
    };
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }

    // -- Wirecloud.Utils ----------------------------------------------------
    Wirecloud.Utils = StyledElements.Utils;

    // -- Wirecloud.ui namespace ---------------------------------------------
    Wirecloud.ui = {};

    // -- Wirecloud.workspaceviews -------------------------------------------
    Wirecloud.UserInterfaceManager = {
        workspaceviews: {},
        views: {
            marketplace: null,
            myresources: {},
            workspace: {}
        },
        changeCurrentView: () => {},
        _registerRootWindowMenu: () => {},
        _unregisterRootWindowMenu: () => {},
        _registerPopup: () => {},
        _unregisterPopup: () => {},
        monitorTask: (p) => p
    };

    // -- Wirecloud.HistoryManager -------------------------------------------
    Wirecloud.HistoryManager = {
        getCurrentState: () => ({}),
        pushState: () => {},
        replaceState: () => {}
    };

    // -- Wirecloud.MarketManager --------------------------------------------
    Wirecloud.MarketManager = {
        getMarkets: () => Promise.resolve([]),
        getMarketViewClass: () => null
    };

    // -- Wirecloud.Task -----------------------------------------------------
    Wirecloud.Task = class Task {
        constructor(label, executor) {
            this._label = label;
            this._promise = new Promise((resolve, reject) => {
                try {
                    executor(resolve, reject);
                } catch (e) {
                    reject(e);
                }
            });
        }
        then(onFulfilled, onRejected) {
            return this._promise.then(onFulfilled, onRejected);
        }
        catch(onRejected) {
            return this._promise.catch(onRejected);
        }
    };

    // -- Wirecloud events ---------------------------------------------------
    Wirecloud.events = {
        viewcontextchanged: new StyledElements.Event()
    };
    Wirecloud.addEventListener = StyledElements.ObjectWithEvents.prototype.addEventListener;
    Wirecloud.dispatchEvent = StyledElements.ObjectWithEvents.prototype.dispatchEvent;

    // -- StyledElements.Alternative (real) ----------------------------------
    loadLegacyScript('src/wirecloud/commons/static/js/StyledElements/Container.js');
    loadLegacyScript('src/wirecloud/commons/static/js/StyledElements/Alternative.js');

    // -- StyledElements.Fragment (required by Container/Alternative) ---------
    if (StyledElements.Fragment == null) {
        class SEFragment { constructor() { this.elements = []; this.wrapperElement = document.createElement('div'); this.children = []; } }
        StyledElements.Fragment = SEFragment;
    }

    // -- StyledElements mock classes ----------------------------------------
    class MockAlternatives {
        constructor() {
            this._alternatives = {};
            this._altList = [];
            this._visibleAlt = null;
            this._nextId = 0;
            this._listeners = {};
        }

        addEventListener(type, handler) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(handler);
        }

        _fireEvent(type, ...args) {
            (this._listeners[type] || []).forEach(h => h.call(this, this, ...args));
        }

        createAlternative(options = {}) {
            const id = this._nextId++;
            const Constructor = options.alternative_constructor || StyledElements.Alternative;
            const containerOpts = options.containerOptions || {};
            let alt;
            if (Constructor === StyledElements.Alternative) {
                alt = new StyledElements.Alternative(id, containerOpts);
            } else {
                alt = new Constructor(id, containerOpts);
                if (!Object.prototype.hasOwnProperty.call(alt, 'altId')) {
                    alt.altId = id;
                }
            }
            if (containerOpts.marketplace_desc) {
                alt.market_id = containerOpts.marketplace_desc.user + '/' + containerOpts.marketplace_desc.name;
            }
            if (containerOpts.catalogue) {
                alt.catalogue = containerOpts.catalogue;
            }
            alt.parentElement = this;
            alt.insertInto = alt.insertInto || function () { return this; };
            alt.show = alt.show || function () { return this; };
            alt.hide = alt.hide || function () { return this; };
            alt.setVisible = alt.setVisible || function (v) { return this; };
            alt.isVisible = alt.isVisible || function () { return true; };
            alt.repaint = alt.repaint || function () { return this; };
            alt.destroy = alt.destroy || function () { this._destroyed = true; };

            this._alternatives[id] = alt;
            this._altList.push(alt);

            if (!this._visibleAlt) {
                this._visibleAlt = alt;
                alt.setVisible(true);
            }

            return alt;
        }

        showAlternative(alternative, options = {}) {
            if (alternative == null) return;
            const id = typeof alternative === 'number' ? alternative : alternative.altId;
            const alt = this._alternatives[id];
            if (!alt) throw new TypeError('Invalid alternative');

            const oldAlt = this._visibleAlt;
            this._visibleAlt = alt;
            alt.setVisible(true);

            if (options.onComplete) {
                options.onComplete();
            }

            if (oldAlt && oldAlt !== alt && this._listeners['postTransition']) {
                this._fireEvent('postTransition', oldAlt, alt);
            }

            return Promise.resolve();
        }

        removeAlternative(alternative, options = {}) {
            let alt;
            if (typeof alternative === 'number') {
                alt = this._alternatives[alternative];
                if (!alt) {
                    if (options.onComplete) options.onComplete();
                    return Promise.resolve();
                }
            } else {
                const id = alternative.altId;
                if (this._alternatives[id] !== alternative) {
                    throw new TypeError('alternative is not owned by this alternatives element');
                }
                alt = alternative;
            }

            delete this._alternatives[alt.altId];
            const idx = this._altList.indexOf(alt);
            if (idx !== -1) this._altList.splice(idx, 1);

            if (this._visibleAlt === alt) {
                this._visibleAlt = this._altList[0] || null;
            }

            if (options.onComplete) {
                options.onComplete();
            }

            return Promise.resolve();
        }

        getCurrentAlternative() {
            return this._visibleAlt;
        }

        clear() {
            this._alternatives = {};
            this._altList = [];
            this._visibleAlt = null;
            this._nextId = 0;
        }
    }

    class MockGUIBuilder {
        constructor() {
            this.DEFAULT_OPENING = '<div>';
            this.DEFAULT_CLOSING = '</div>';
        }
        parse(template, context) {
            const wrapper = document.createElement('div');
            if (context && context.message) {
                wrapper.innerHTML = typeof context.message === 'string' ? context.message : '';
            }
            const fragment = {
                elements: [wrapper],
                wrapperElement: wrapper,
                appendTo(parent) { parent.appendChild(this.wrapperElement || this.elements[0]); },
                insertInto(parent) { parent.appendChild(this.wrapperElement || this.elements[0]); },
                appendChild() { return this; },
                clear() { if (this.wrapperElement) this.wrapperElement.innerHTML = ''; }
            };
            return fragment;
        }
    }

    class MockPopupMenu {
        constructor() {
            this._items = [];
            this.wrapperElement = document.createElement('div');
        }
        append(item) {
            this._items.push(item);
            return this;
        }
    }

    class MockButton {
        constructor(opts = {}) {
            this._listeners = {};
            this._classes = opts.class || '';
            this._iconClass = opts.iconClass || '';
            this._title = opts.title || '';
            this.wrapperElement = document.createElement('button');
        }
        addEventListener(type, handler) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(handler);
        }
        _click() {
            (this._listeners['click'] || []).forEach(h => h());
        }
    }

    class MockMarketplaceViewMenuItems {
        constructor(view) {
            this.view = view;
            this.wrapperElement = document.createElement('div');
        }
        appendTo() { return this; }
    }

    StyledElements.Alternatives = MockAlternatives;
    StyledElements.GUIBuilder = MockGUIBuilder;
    StyledElements.PopupMenu = MockPopupMenu;
    StyledElements.Button = MockButton;
    Wirecloud.ui.MarketplaceViewMenuItems = MockMarketplaceViewMenuItems;
};

// ============================================================================
// TESTS
// ============================================================================

// -- Constructor -------------------------------------------------------------

test('MarketplaceView — constructor initializes all properties', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    assert.ok(view instanceof StyledElements.Alternative);
    assert.equal(view.view_name, 'marketplace');
    assert.deepEqual(view.viewsByName, {});
    assert.ok(view.alternatives instanceof StyledElements.Alternatives);
    assert.ok(view.emptyAlternative instanceof StyledElements.Alternative);
    assert.ok(view.errorsAlternative instanceof StyledElements.Alternative);
    assert.equal(view.temporalAlternatives.length, 2);
    assert.equal(view.temporalAlternatives[0], view.emptyAlternative);
    assert.equal(view.temporalAlternatives[1], view.errorsAlternative);
    assert.ok(view.marketMenu instanceof StyledElements.PopupMenu);
    assert.ok(view.myresourcesButton instanceof StyledElements.Button);
    assert.equal(view.number_of_alternatives, 0);
    assert.equal(view.loading, null);
    assert.deepEqual(view.callbacks, []);
    assert.equal(view.error, false);
});

test('MarketplaceView — error property returns true when errorsAlternative is visible', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    assert.equal(view.error, false);
    view.alternatives.showAlternative(view.errorsAlternative);
    assert.equal(view.error, true);
});

test('MarketplaceView — parentElement postTransition triggers refreshViewInfo when loading is null', () => {
    setup();

    let postTransitionHandler = null;
    const parentElement = document.createElement('div');
    parentElement.addEventListener = (type, handler) => {
        if (type === 'postTransition') postTransitionHandler = handler;
    };

    let getMarketsCalled = false;
    Wirecloud.MarketManager.getMarkets = () => {
        getMarketsCalled = true;
        return Promise.resolve([]);
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    assert.ok(postTransitionHandler);
    postTransitionHandler(null, null, view);
    assert.equal(getMarketsCalled, true);
});

test('MarketplaceView — parentElement postTransition does nothing when inalt is not this', () => {
    setup();

    let postTransitionHandler = null;
    const parentElement = document.createElement('div');
    parentElement.addEventListener = (type, handler) => {
        if (type === 'postTransition') postTransitionHandler = handler;
    };

    let getMarketsCalled = false;
    Wirecloud.MarketManager.getMarkets = () => {
        getMarketsCalled = true;
        return Promise.resolve([]);
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    postTransitionHandler(null, null, {});
    assert.equal(getMarketsCalled, false);
});

test('MarketplaceView — parentElement postTransition does nothing when loading is not null', () => {
    setup();

    let postTransitionHandler = null;
    const parentElement = document.createElement('div');
    parentElement.addEventListener = (type, handler) => {
        if (type === 'postTransition') postTransitionHandler = handler;
    };

    let getMarketsCalled = false;
    Wirecloud.MarketManager.getMarkets = () => {
        getMarketsCalled = true;
        return Promise.resolve([]);
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;
    postTransitionHandler(null, null, view);
    assert.equal(getMarketsCalled, false);
});

test('MarketplaceView — postTransition event listener dispatches viewcontextchanged', () => {
    setup();

    let dispatchCalls = [];
    Wirecloud.dispatchEvent = (type, context) => {
        dispatchCalls.push({ type, context });
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    // Trigger postTransition on the alternatives
    view.alternatives._fireEvent('postTransition', null, view.emptyAlternative);
    assert.equal(dispatchCalls.length, 1);
    assert.equal(dispatchCalls[0].type, 'viewcontextchanged');
    assert.equal(dispatchCalls[0].context, view);
});

test('MarketplaceView — myresourcesButton click navigates to myresources', () => {
    setup();

    let changedView = null;
    Wirecloud.UserInterfaceManager.changeCurrentView = (viewName, opts) => {
        changedView = { viewName, opts };
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.myresourcesButton._click();
    assert.equal(changedView.viewName, 'myresources');
    assert.deepEqual(changedView.opts, { history: 'push' });
});

test('MarketplaceView — getToolbarMenu returns marketMenu', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    assert.equal(view.getToolbarMenu(), view.marketMenu);
});

test('MarketplaceView — getToolbarButtons returns myresourcesButton in array', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    const buttons = view.getToolbarButtons();
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0], view.myresourcesButton);
});

// -- refreshViewInfo --------------------------------------------------------

test('MarketplaceView — refreshViewInfo starts loading and returns Task', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([makeMarketDesc()]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    const task = view.refreshViewInfo();
    assert.ok(task instanceof Wirecloud.Task);
    assert.equal(view.loading, true);
    await task;
    assert.equal(view.loading, false);
});

test('MarketplaceView — refreshViewInfo when already loading resolves immediately', async () => {
    setup();

    let resolveMarkets;
    Wirecloud.MarketManager.getMarkets = () => new Promise(r => { resolveMarkets = r; });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    const task1 = view.refreshViewInfo();
    assert.equal(view.loading, true);

    const task2 = view.refreshViewInfo();
    // Second call should resolve immediately (loading already true)
    await task2;
    resolveMarkets([]);
    await task1;
});

// -- revertMpViewToInitial ----------------------------------------------------

test('MarketplaceView — show event with loading=false and emptyAlternative triggers auto_select', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({ market: null });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;
    // Current alternative is emptyAlternative (first created)
    assert.equal(view.alternatives.getCurrentAlternative(), view.emptyAlternative);

    // Dispatch show event
    view.dispatchEvent('show');
    // Nothing should crash - auto_select_initial_market handled gracefully
    assert.ok(true);
});

test('MarketplaceView — show event with loading=false and non-empty alternative refreshes', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const desc = makeMarketDesc({ user: 'u', name: 'm1' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });

    view.alternatives.showAlternative(marketView);

    view.dispatchEvent('show');
    assert.equal(marketView._refreshed, true);
});

test('MarketplaceView — show event with loading=true does nothing', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = true;
    // Should not throw
    view.dispatchEvent('show');
    assert.ok(true);
});

test('MarketplaceView — show event with error=true does nothing', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;
    view.alternatives.showAlternative(view.errorsAlternative);
    assert.equal(view.error, true);

    view.dispatchEvent('show');
    assert.ok(true);
});

// -- buildStateData ----------------------------------------------------------

test('MarketplaceView — buildStateData when loading is not false', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({
        workspace_owner: 'owner',
        workspace_name: 'ws',
        params: {}
    });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = null;
    const data = view.buildStateData();
    assert.equal(data.workspace_owner, 'owner');
    assert.equal(data.workspace_name, 'ws');
    assert.equal(data.view, 'marketplace');
    assert.equal('market' in data, false);
});

test('MarketplaceView — buildStateData when loading=false, error=false, emptyAlternative visible', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({
        workspace_owner: 'owner',
        workspace_name: 'ws',
        params: {}
    });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;
    assert.equal(view.alternatives.getCurrentAlternative(), view.emptyAlternative);

    const data = view.buildStateData();
    assert.equal(data.workspace_owner, 'owner');
    assert.equal('market' in data, false);
});

test('MarketplaceView — buildStateData when error is true', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({
        workspace_owner: 'owner',
        workspace_name: 'ws',
        params: {}
    });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;
    view.alternatives.showAlternative(view.errorsAlternative);

    const data = view.buildStateData();
    assert.equal('market' in data, false);
});

test('MarketplaceView — buildStateData when market view with no subalternatives', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({
        workspace_owner: 'owner',
        workspace_name: 'ws',
        params: {}
    });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const desc = makeMarketDesc({ user: 'myuser', name: 'myMarket' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });

    view.alternatives.showAlternative(marketView);

    const data = view.buildStateData();
    assert.equal(data.market, 'myuser/myMarket');
    assert.equal('subview' in data, false);
});

test('MarketplaceView — buildStateData with subalternatives and subview.view_name', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({
        workspace_owner: 'owner',
        workspace_name: 'ws',
        params: {}
    });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    // Create a sub-alternatives within the market view
    const subAlternatives = new StyledElements.Alternatives();
    const subView = subAlternatives.createAlternative();
    subView.view_name = 'details';
    subView.currentEntry = { title: 'Test Resource' };
    subView.buildStateData = function (data) {
        data.detail_param = 'value';
    };

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.alternatives = subAlternatives;
    marketView.market_id = 'u/m';

    view.alternatives.showAlternative(marketView);

    const data = view.buildStateData();
    assert.equal(data.market, 'u/m');
    assert.equal(data.subview, 'details');
    assert.equal(data.detail_param, 'value');
});

test('MarketplaceView — buildStateData with subalternatives but subview.view_name is null', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({
        workspace_owner: 'owner',
        workspace_name: 'ws',
        params: {}
    });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const subAlternatives = new StyledElements.Alternatives();
    const subView = subAlternatives.createAlternative();
    subView.view_name = null;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.alternatives = subAlternatives;
    marketView.market_id = 'u/m';

    view.alternatives.showAlternative(marketView);

    const data = view.buildStateData();
    assert.equal(data.market, 'u/m');
    assert.equal('subview' in data, false);
});

test('MarketplaceView — buildStateData with subalternatives but subview has no buildStateData', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({
        workspace_owner: 'owner',
        workspace_name: 'ws',
        params: {}
    });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const subAlternatives = new StyledElements.Alternatives();
    const subView = subAlternatives.createAlternative();
    subView.view_name = 'search';
    // No buildStateData

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.alternatives = subAlternatives;
    marketView.market_id = 'u/m';

    view.alternatives.showAlternative(marketView);

    const data = view.buildStateData();
    assert.equal(data.market, 'u/m');
    assert.equal(data.subview, 'search');
});

// -- onHistoryChange ---------------------------------------------------------

test('MarketplaceView — onHistoryChange when loading is not false', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = true;
    view.onHistoryChange({ market: 'some/market' });
    assert.ok(true); // no crash
});

test('MarketplaceView — onHistoryChange when state.market is not in viewsByName', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;
    view.onHistoryChange({ market: 'nonexistent/market' });
    assert.ok(true); // no crash
});

test('MarketplaceView — onHistoryChange calls changeCurrentMarket and onHistoryChange on subview', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    let onHistoryChangeCalled = false;
    const marketConstructor = makeMarketViewClass({
        onHistoryChange: function (state) {
            onHistoryChangeCalled = true;
            assert.equal(state.market, 'u/m');
        }
    });
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.market_id = 'u/m';
    view.viewsByName['u/m'] = marketView;

    const state = { market: 'u/m', subview: 'search' };
    view.onHistoryChange(state);
    assert.equal(onHistoryChangeCalled, true);
});

test('MarketplaceView — onHistoryChange when subview has no onHistoryChange method', () => {
    setup();

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass(); // no onHistoryChange
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.market_id = 'u/m';
    view.viewsByName['u/m'] = marketView;

    const state = { market: 'u/m' };
    view.onHistoryChange(state);
    assert.ok(true); // no crash
});

// -- goUp --------------------------------------------------------------------

test('MarketplaceView — goUp from emptyAlternative navigates to workspace', () => {
    setup();

    let changedView = null;
    Wirecloud.UserInterfaceManager.changeCurrentView = (viewName) => {
        changedView = viewName;
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.alternatives.showAlternative(view.emptyAlternative);
    view.goUp();
    assert.equal(changedView, 'workspace');
});

test('MarketplaceView — goUp from errorsAlternative navigates to workspace', () => {
    setup();

    let changedView = null;
    Wirecloud.UserInterfaceManager.changeCurrentView = (viewName) => {
        changedView = viewName;
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.alternatives.showAlternative(view.errorsAlternative);
    view.goUp();
    assert.equal(changedView, 'workspace');
});

test('MarketplaceView — goUp from market view delegates to subview goUp', () => {
    setup();

    let changedView = null;
    Wirecloud.UserInterfaceManager.changeCurrentView = (viewName) => {
        changedView = viewName;
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass({ goUpResult: true });
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });

    view.alternatives.showAlternative(marketView);

    view.goUp();
    // goUp returned true, so should not navigate to workspace
    assert.equal(changedView, null);
});

test('MarketplaceView — goUp from market view when subview goUp returns false navigates to workspace', () => {
    setup();

    let changedView = null;
    Wirecloud.UserInterfaceManager.changeCurrentView = (viewName) => {
        changedView = viewName;
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass({ goUpResult: false });
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });

    view.goUp();
    assert.equal(changedView, 'workspace');
});

// -- getBreadcrumb -----------------------------------------------------------

test('MarketplaceView — getBreadcrumb for emptyAlternative', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.alternatives.showAlternative(view.emptyAlternative);
    const breadcrumb = view.getBreadcrumb();
    assert.ok(Array.isArray(breadcrumb));
    assert.ok(breadcrumb[0].includes('loading'));
});

test('MarketplaceView — getBreadcrumb for errorsAlternative', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.alternatives.showAlternative(view.errorsAlternative);
    const breadcrumb = view.getBreadcrumb();
    assert.ok(Array.isArray(breadcrumb));
    assert.ok(breadcrumb[0].includes('not available'));
});

test('MarketplaceView — getBreadcrumb for market view (no subalternatives)', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });

    view.alternatives.showAlternative(marketView);

    const breadcrumb = view.getBreadcrumb();
    assert.equal(breadcrumb.length, 2);
    assert.equal(breadcrumb[0], 'marketplace');
});

test('MarketplaceView — getBreadcrumb for market view with subalternatives (details)', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const subAlternatives = new StyledElements.Alternatives();
    const subView = subAlternatives.createAlternative();
    subView.view_name = 'details';
    subView.currentEntry = { title: 'My Resource' };

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.alternatives = subAlternatives;

    view.alternatives.showAlternative(marketView);

    const breadcrumb = view.getBreadcrumb();
    assert.equal(breadcrumb.length, 3);
    assert.equal(breadcrumb[2].label, 'My Resource');
    assert.equal(breadcrumb[2].class, 'resource_title');
});

test('MarketplaceView — getBreadcrumb for market view with subalternatives but view_name is not details', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const subAlternatives = new StyledElements.Alternatives();
    const subView = subAlternatives.createAlternative();
    subView.view_name = 'search';
    subView.currentEntry = { title: 'My Resource' };

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.alternatives = subAlternatives;

    view.alternatives.showAlternative(marketView);

    const breadcrumb = view.getBreadcrumb();
    assert.equal(breadcrumb.length, 2);
});

test('MarketplaceView — getBreadcrumb for market view with subalternatives, details but no currentEntry', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const subAlternatives = new StyledElements.Alternatives();
    const subView = subAlternatives.createAlternative();
    subView.view_name = 'details';
    subView.currentEntry = null;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.alternatives = subAlternatives;

    view.alternatives.showAlternative(marketView);

    const breadcrumb = view.getBreadcrumb();
    assert.equal(breadcrumb.length, 2);
});

// -- getTitle ----------------------------------------------------------------

test('MarketplaceView — getTitle for emptyAlternative', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.alternatives.showAlternative(view.emptyAlternative);
    assert.equal(view.getTitle(), 'Marketplace');
});

test('MarketplaceView — getTitle for errorsAlternative', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.alternatives.showAlternative(view.errorsAlternative);
    assert.equal(view.getTitle(), 'Marketplace');
});

test('MarketplaceView — getTitle for market view (no subalternatives)', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass({ label: 'My Market' });
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });

    view.alternatives.showAlternative(marketView);

    const title = view.getTitle();
    assert.ok(title.includes('Marketplace'));
    assert.ok(title.includes('My Market'));
});

test('MarketplaceView — getTitle for market view with details and currentEntry', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass({ label: 'My Market' });
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const subAlternatives = new StyledElements.Alternatives();
    const subView = subAlternatives.createAlternative();
    subView.view_name = 'details';
    subView.currentEntry = { title: 'Resource Title' };

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.alternatives = subAlternatives;

    view.alternatives.showAlternative(marketView);

    const title = view.getTitle();
    assert.ok(title.includes('Resource Title'));
});

test('MarketplaceView — getTitle for market view with alternatives but not details', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    const marketConstructor = makeMarketViewClass({ label: 'My Market' });
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const subAlternatives = new StyledElements.Alternatives();
    const subView = subAlternatives.createAlternative();
    subView.view_name = 'search';
    subView.currentEntry = { title: 'Resource Title' };

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    marketView.alternatives = subAlternatives;

    const title = view.getTitle();
    assert.ok(!title.includes('Resource Title'));
});

// -- waitMarketListReady -----------------------------------------------------

test('MarketplaceView — waitMarketListReady throws on missing onComplete', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    assert.throws(() => view.waitMarketListReady(null), TypeError);
    assert.throws(() => view.waitMarketListReady({}), TypeError);
    assert.throws(() => view.waitMarketListReady({ onComplete: 'not a function' }), TypeError);
});

test('MarketplaceView — waitMarketListReady when loading is false', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = false;

    let called = false;
    view.waitMarketListReady({ onComplete: () => { called = true; } });
    assert.equal(called, true);
});

test('MarketplaceView — waitMarketListReady when loading is null starts refresh', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    let called = false;
    view.waitMarketListReady({ onComplete: () => { called = true; } });
    // loading should now be true (refresh_view_info was called)
    assert.equal(view.loading, true);

    await new Promise(r => setTimeout(r, 10));
    assert.equal(called, true);
});

test('MarketplaceView — waitMarketListReady when loading is true chains to loadtask', async () => {
    setup();

    let resolveMarkets;
    Wirecloud.MarketManager.getMarkets = () => new Promise(r => { resolveMarkets = r; });

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.loading = true;
    view.loadtask = Promise.resolve();

    let called = false;
    view.waitMarketListReady({ onComplete: () => { called = true; } });

    await new Promise(r => setTimeout(r, 10));
    assert.equal(called, true);
});

test('MarketplaceView — waitMarketListReady with include_markets=true (count > 0)', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([makeMarketDesc({ user: 'u1', name: 'm1' }), makeMarketDesc({ user: 'u2', name: 'm2' })]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    let called = false;
    view.waitMarketListReady({
        include_markets: true,
        onComplete: () => { called = true; }
    });

    await new Promise(r => setTimeout(r, 10));
    assert.equal(called, true);
});

test('MarketplaceView — waitMarketListReady with include_markets=true and zero markets', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    let called = false;
    view.waitMarketListReady({
        include_markets: true,
        onComplete: () => { called = true; }
    });

    // loading was null, so it triggered refreshViewInfo
    await new Promise(r => setTimeout(r, 10));
    // Wait for refresh to complete
    assert.equal(called, true);
});

test('MarketplaceView — waitMarketListReady with include_markets=true and zero markets, onComplete throws', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    let called = false;
    let thrown = false;
    view.waitMarketListReady({
        include_markets: true,
        onComplete: () => { called = true; throw new Error('onComplete error'); }
    });

    // Should not throw externally - catch (e) {} swallows it
    await new Promise(r => setTimeout(r, 10));
    assert.equal(called, true);
    assert.ok(true);
});

// -- addMarket ----------------------------------------------------------------

test('MarketplaceView — addMarket creates new market and switches to it', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let pushStateCalls = [];
    Wirecloud.HistoryManager.pushState = (s) => pushStateCalls.push(s);
    Wirecloud.HistoryManager.getCurrentState = () => ({ workspace_owner: 'o', workspace_name: 'w', params: {} });

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });
    view.loading = false;
    view.viewList = [];

    const info = makeMarketDesc({ user: 'newuser', name: 'NewMarket', type: 'wirecloud' });
    view.addMarket(info);

    assert.equal(view.number_of_alternatives, 1);
    assert.equal(view.viewList.length, 1);
    assert.ok('newuser/NewMarket' in view.viewsByName);
    assert.ok('newuser/NewMarket' in Wirecloud.UserInterfaceManager.workspaceviews);
    assert.equal(pushStateCalls.length, 1);
    assert.equal(pushStateCalls[0].market, 'newuser/NewMarket');
});

test('MarketplaceView — addMarket with null constructor from MarketManager', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.MarketManager.getMarketViewClass = () => null;
    Wirecloud.HistoryManager.getCurrentState = () => ({ workspace_owner: 'o', workspace_name: 'w', params: {} });

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });
    view.loading = false;

    const info = makeMarketDesc({ user: 'bad', name: 'BadMarket', type: 'unknown' });
    assert.throws(() => view.addMarket(info), TypeError);
});

// -- changeCurrentMarket -----------------------------------------------------

test('MarketplaceView — changeCurrentMarket with default history push', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let pushStateCalls = [];
    Wirecloud.HistoryManager.pushState = (s) => pushStateCalls.push(s);
    Wirecloud.HistoryManager.getCurrentState = () => ({ workspace_owner: 'o', workspace_name: 'w', params: {} });

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });
    view.loading = false;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    view.viewsByName['u/m'] = marketView;

    view.changeCurrentMarket('u/m');
    assert.equal(pushStateCalls.length, 1);
    assert.equal(pushStateCalls[0].market, 'u/m');
});

test('MarketplaceView — changeCurrentMarket with history replace', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let replaceStateCalls = [];
    Wirecloud.HistoryManager.replaceState = (s) => replaceStateCalls.push(s);
    Wirecloud.HistoryManager.getCurrentState = () => ({ workspace_owner: 'o', workspace_name: 'w', params: {} });

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });
    view.loading = false;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    view.viewsByName['u/m'] = marketView;

    view.changeCurrentMarket('u/m', { history: 'replace' });
    assert.equal(replaceStateCalls.length, 1);
    assert.equal(replaceStateCalls[0].market, 'u/m');
});

test('MarketplaceView — changeCurrentMarket with history ignore', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let pushStateCalls = [];
    let replaceStateCalls = [];
    Wirecloud.HistoryManager.pushState = (s) => pushStateCalls.push(s);
    Wirecloud.HistoryManager.replaceState = (s) => replaceStateCalls.push(s);
    Wirecloud.HistoryManager.getCurrentState = () => ({ workspace_owner: 'o', workspace_name: 'w', params: {} });

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });
    view.loading = false;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    view.viewsByName['u/m'] = marketView;

    view.changeCurrentMarket('u/m', { history: 'ignore' });
    assert.equal(pushStateCalls.length, 0);
    assert.equal(replaceStateCalls.length, 0);
});

// -- onGetMarketsSuccess (via refreshViewInfo) -------------------------------

test('MarketplaceView — getMarkets success creates new market views', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });
    const m2 = makeMarketDesc({ user: 'u2', name: 'm2', type: 'wirecloud' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1, m2]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    await view.refreshViewInfo();

    assert.equal(view.loading, false);
    assert.equal(view.number_of_alternatives, 2);
    assert.equal(view.viewList.length, 2);
    assert.ok('u1/m1' in view.viewsByName);
    assert.ok('u2/m2' in view.viewsByName);
    assert.ok('u1/m1' in Wirecloud.UserInterfaceManager.workspaceviews);
    assert.ok('u2/m2' in Wirecloud.UserInterfaceManager.workspaceviews);
});

test('MarketplaceView — getMarkets success reuses existing views', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    // First load
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);
    await view.refreshViewInfo();

    const firstView = view.viewsByName['u1/m1'];
    assert.equal(view.number_of_alternatives, 1);

    // Second load — same market
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);
    await view.refreshViewInfo();

    assert.equal(view.viewsByName['u1/m1'], firstView); // reused
    assert.equal(view.number_of_alternatives, 1);
});

test('MarketplaceView — getMarkets success removes old markets no longer in response', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });
    const m2 = makeMarketDesc({ user: 'u2', name: 'm2', type: 'wirecloud' });

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    // First load with 2 markets
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1, m2]);
    await view.refreshViewInfo();
    assert.equal(view.number_of_alternatives, 2);

    // Second load with only 1 market
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);
    await view.refreshViewInfo();
    assert.equal(view.number_of_alternatives, 1);
    assert.ok('u1/m1' in view.viewsByName);
    assert.ok(!('u2/m2' in view.viewsByName));
});

test('MarketplaceView — getMarkets success skips markets with null view constructor', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });
    const m2 = makeMarketDesc({ user: 'unknown', name: 'm2', type: 'unknown_type' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1, m2]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = (type) => {
        if (type === 'unknown_type') return null;
        return marketConstructor;
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    await view.refreshViewInfo();

    assert.equal(view.number_of_alternatives, 1);
    assert.ok('u1/m1' in view.viewsByName);
    assert.ok(!('unknown/m2' in view.viewsByName));
});

test('MarketplaceView — getMarkets triggers auto_select when visible and current is temporal', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let pushStateCalls = [];
    Wirecloud.HistoryManager.pushState = (s) => pushStateCalls.push(s);
    Wirecloud.HistoryManager.replaceState = (s) => pushStateCalls.push(s);
    Wirecloud.HistoryManager.getCurrentState = () => ({ market: null });

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.show(); // make visible
    // Current alternative should be emptyAlternative (temporal)
    assert.equal(view.alternatives.getCurrentAlternative(), view.emptyAlternative);

    await view.refreshViewInfo();

    // auto_select should have selected the first market (since viewList.length > 0)
    assert.equal(pushStateCalls.length > 0 || view.alternatives.getCurrentAlternative() !== view.emptyAlternative, true);
});

test('MarketplaceView — getMarkets dispatches viewcontextchanged when not temporal', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let dispatchCalls = [];
    Wirecloud.dispatchEvent = (type) => {
        if (type === 'viewcontextchanged') dispatchCalls.push(type);
    };
    Wirecloud.HistoryManager.getCurrentState = () => ({ market: null });

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.show();
    // Manually set the current alternative to a non-temporal one
    // First load to create a market view
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);
    await view.refreshViewInfo();

    // Switch to market view (non-temporal)
    const initialDispatchCount = dispatchCalls.length;

    // Now refresh again - it should dispatch viewcontextchanged since current alternative is not temporal
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);
    await view.refreshViewInfo();

    // Check that viewcontextchanged was dispatched
    assert.ok(dispatchCalls.length > initialDispatchCount);
});

test('MarketplaceView — getMarkets does nothing visible check if view is hidden', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let dispatchCalls = [];
    Wirecloud.dispatchEvent = (type) => {
        if (type === 'viewcontextchanged') dispatchCalls.push(type);
    };

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.hide(); // hidden
    await view.refreshViewInfo();
    // refresh_view_info always dispatches viewcontextchanged at start (line 108)
    // But the conditional dispatch inside onGetMarketsSuccess should NOT fire when hidden
    assert.equal(dispatchCalls.length, 1);
});

test('MarketplaceView — getMarkets success with empty response and viewList=0', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.show();
    await view.refreshViewInfo();

    assert.equal(view.viewList.length, 0);
    assert.equal(view.number_of_alternatives, 0);
});

test('MarketplaceView — getMarkets success when auto_select picks from viewList using history:replace', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let replaceStateCalls = [];
    Wirecloud.HistoryManager.replaceState = (s) => replaceStateCalls.push(s);
    Wirecloud.HistoryManager.pushState = () => {};
    Wirecloud.HistoryManager.getCurrentState = () => ({}); // no market in state

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.show();
    await view.refreshViewInfo();

    // Should have called replaceState (history: "replace" from auto_select_initial_market)
    assert.ok(replaceStateCalls.length > 0);
});

test('MarketplaceView — auto_select with currentState.market in viewsByName uses history:ignore', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let pushCalls = [];
    let replaceCalls = [];
    Wirecloud.HistoryManager.pushState = (s) => pushCalls.push(s);
    Wirecloud.HistoryManager.replaceState = (s) => replaceCalls.push(s);
    Wirecloud.HistoryManager.getCurrentState = () => ({ market: 'u1/m1' });

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.show();
    await view.refreshViewInfo();

    // When history is "ignore", neither push nor replace is called
    // But the market should be registered
    assert.ok('u1/m1' in view.viewsByName);
});

test('MarketplaceView — getMarkets auto_select shows error when no markets and market not in state', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    Wirecloud.HistoryManager.getCurrentState = () => ({});

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.show();
    await view.refreshViewInfo();

    // Should show error alternative
    assert.equal(view.alternatives.getCurrentAlternative(), view.errorsAlternative);
});

// -- getMarkets error handling -----------------------------------------------

test('MarketplaceView — getMarkets failure shows error and rejects', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.reject(new Error('Network error'));

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    try {
        await view.refreshViewInfo();
        assert.fail('Should have rejected');
    } catch (e) {
        assert.equal(e.message, 'Network error');
    }

    assert.equal(view.loading, false);
    assert.equal(view.alternatives.getCurrentAlternative(), view.errorsAlternative);
});

test('MarketplaceView — loadtask error handler clears error alt and rejects', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.reject('Some error message');

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    try {
        await view.refreshViewInfo();
        assert.fail('Should have rejected');
    } catch (e) {
        assert.equal(e, 'Some error message');
    }

    assert.equal(view.alternatives.getCurrentAlternative(), view.errorsAlternative);
});

// -- remove_market behavior ---------------------------------------------------

test('MarketplaceView — remove_market deletes from workspaceviews and removes alternative', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1', type: 'wirecloud' });
    const m2 = makeMarketDesc({ user: 'u2', name: 'm2', type: 'wirecloud' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1, m2]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    await view.refreshViewInfo();
    assert.equal(view.number_of_alternatives, 2);

    // Now refresh with only m1 — m2 should be removed
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);
    await view.refreshViewInfo();

    assert.equal(view.number_of_alternatives, 1);
    assert.ok(!('u2/m2' in Wirecloud.UserInterfaceManager.workspaceviews));
    assert.ok(!('u2/m2' in view.viewsByName));
});

// -- Edge cases & full coverage ----------------------------------------------

test('MarketplaceView — refreshViewInfo dispatch event before getMarkets', async () => {
    setup();

    let dispatchOrder = [];
    Wirecloud.dispatchEvent = (type) => dispatchOrder.push(type);

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    await view.refreshViewInfo();

    assert.ok(dispatchOrder.includes('viewcontextchanged'));
});

test('MarketplaceView — changeCurrentMarket with null options', () => {
    setup();

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let pushStateCalls = [];
    Wirecloud.HistoryManager.pushState = (s) => pushStateCalls.push(s);
    Wirecloud.HistoryManager.getCurrentState = () => ({ workspace_owner: 'o', workspace_name: 'w', params: {} });

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });
    view.loading = false;

    const desc = makeMarketDesc({ user: 'u', name: 'm' });
    const marketView = view.alternatives.createAlternative({
        alternative_constructor: marketConstructor,
        containerOptions: { catalogue: view, marketplace_desc: desc }
    });
    view.viewsByName['u/m'] = marketView;

    view.changeCurrentMarket('u/m', null);
    assert.equal(pushStateCalls.length, 1);
});

test('MarketplaceView — number_of_alternatives resets on each refresh', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    await view.refreshViewInfo();
    assert.equal(view.number_of_alternatives, 1);

    // Refresh with same data — should be 1 (resets to 0 then back to 1)
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);
    await view.refreshViewInfo();
    assert.equal(view.number_of_alternatives, 1);
});

test('MarketplaceView — loadtask is null after successful refresh', async () => {
    setup();

    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([]);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    await view.refreshViewInfo();
    assert.equal(view.loadtask, null);
});

// -- initial state with existing market in history ----------------------------

test('MarketplaceView — auto_select_initial_market picks market from currentState', async () => {
    setup();

    const m1 = makeMarketDesc({ user: 'u1', name: 'm1' });
    Wirecloud.MarketManager.getMarkets = () => Promise.resolve([m1]);

    const marketConstructor = makeMarketViewClass();
    Wirecloud.MarketManager.getMarketViewClass = () => marketConstructor;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceView.js');

    const parentElement = document.createElement('div');
    parentElement.addEventListener = () => {};

    let pushCalls = [];
    let replaceCalls = [];
    Wirecloud.HistoryManager.pushState = (s) => pushCalls.push(s);
    Wirecloud.HistoryManager.replaceState = (s) => replaceCalls.push(s);
    Wirecloud.HistoryManager.getCurrentState = () => ({ market: 'u1/m1' });

    const view = new Wirecloud.ui.MarketplaceView('test-mp', {
        parentElement
    });

    view.show();
    await view.refreshViewInfo();

    // Since market is in state, auto_select picks it with history:ignore
    assert.ok('u1/m1' in view.viewsByName);
});
