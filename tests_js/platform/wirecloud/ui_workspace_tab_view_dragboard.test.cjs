const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// ===========================================================================
// MOCK HELPERS
// ===========================================================================

const createWidgetMock = (overrides = {}) => {
    const id = overrides.id || 'widget-' + Math.random().toString(36).substr(2, 9);
    const wrapperElement = document.createElement('section');
    const posZ = overrides.z !== undefined ? overrides.z : 0;

    const widget = {
        id,
        wrapperElement,
        model: {
            id,
            volatile: overrides.volatile !== undefined ? overrides.volatile : false,
            layoutConfig: overrides.layoutConfig || [],
        },
        position: { x: 0, y: 0, z: posZ },
        setPosition: (pos, flag) => {
            if (pos.z !== undefined) widget.position.z = pos.z;
            if (pos.x !== undefined) widget.position.x = pos.x;
            if (pos.y !== undefined) widget.position.y = pos.y;
        },
        updateWindowSize: () => {},
        toJSON: (action, allLayoutConfigurations) => ({ id, action }),
        persist: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        repaint: () => {},
    };

    // Apply overrides that don't conflict with internal properties
    if (overrides.updateWindowSize !== undefined) widget.updateWindowSize = overrides.updateWindowSize;
    if (overrides.setPosition !== undefined) widget.setPosition = overrides.setPosition;
    if (overrides.toJSON !== undefined) widget.toJSON = overrides.toJSON;
    if (overrides.persist !== undefined) widget.persist = overrides.persist;
    if (overrides.model !== undefined) Object.assign(widget.model, overrides.model);

    return widget;
};

const createBasePreferences = () => ({
    _values: {
        screenSizes: [
            { id: 'phone', name: 'phone', moreOrEqual: 0, lessOrEqual: 480 },
            { id: 'tablet', name: 'tablet', moreOrEqual: 481, lessOrEqual: 1024 },
            { id: 'desktop', name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
        ],
        baselayout: { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 },
    },
    get(key) { return this._values[key]; },
    addEventListener() {},
});

// ===========================================================================
// SETUP
// ===========================================================================

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = Wirecloud.ui || {};

    // Mock dependency classes
    Wirecloud.ui.FullDragboardLayout = class FullDragboardLayout {
        constructor(dragboard) {
            this.dragboard = dragboard;
            this.initialized = false;
            this._resizeEventCalls = [];
        }
        initialize() { this.initialized = true; }
        _notifyWindowResizeEvent(w, h) {
            this._resizeEventCalls.push({ w, h });
        }
    };

    Wirecloud.ui.FreeLayout = class FreeLayout {
        constructor(dragboard) {
            this.dragboard = dragboard;
            this.initialized = false;
            this._resizeEventCalls = [];
        }
        initialize() { this.initialized = true; }
        _notifyWindowResizeEvent(w, h) {
            this._resizeEventCalls.push({ w, h });
        }
    };

    Wirecloud.ui.SidebarLayout = class SidebarLayout {
        constructor(dragboard, opts = {}) {
            this.dragboard = dragboard;
            this.initialized = false;
            this.position = opts.position || 'left';
            this._active = opts.active !== undefined ? opts.active : false;
            this._resizeEventCalls = [];
        }
        initialize() { this.initialized = true; }
        isActive() { return this._active; }
        _notifyWindowResizeEvent(w, h) {
            this._resizeEventCalls.push({ w, h });
        }
    };

    Wirecloud.ui.ColumnLayout = class ColumnLayout {
        constructor(dragboard, columns, cellheight, verticalmargin, horizontalmargin) {
            this.dragboard = dragboard;
            this.columns = columns;
            this.cellheight = cellheight;
            this.verticalmargin = verticalmargin;
            this.horizontalmargin = horizontalmargin;
            this.initialized = false;
            this._resizeEventCalls = [];
            this._moveToArg = null;
        }
        initialize() { this.initialized = true; }
        _notifyWindowResizeEvent(w, h) {
            this._resizeEventCalls.push({ w, h });
        }
        moveTo(target) { this._moveToArg = target; }
    };

    Wirecloud.ui.SmartColumnLayout = class SmartColumnLayout {
        constructor(dragboard, columns, cellheight, verticalmargin, horizontalmargin) {
            this.dragboard = dragboard;
            this.columns = columns;
            this.cellheight = cellheight;
            this.verticalmargin = verticalmargin;
            this.horizontalmargin = horizontalmargin;
            this.initialized = false;
            this._resizeEventCalls = [];
            this._moveToArg = null;
        }
        initialize() { this.initialized = true; }
        _notifyWindowResizeEvent(w, h) {
            this._resizeEventCalls.push({ w, h });
        }
        moveTo(target) { this._moveToArg = target; }
    };

    Wirecloud.ui.GridLayout = class GridLayout {
        constructor(dragboard, columns, rows, verticalmargin, horizontalmargin) {
            this.dragboard = dragboard;
            this.columns = columns;
            this.rows = rows;
            this.verticalmargin = verticalmargin;
            this.horizontalmargin = horizontalmargin;
            this.initialized = false;
            this._resizeEventCalls = [];
            this._moveToArg = null;
        }
        initialize() { this.initialized = true; }
        _notifyWindowResizeEvent(w, h) {
            this._resizeEventCalls.push({ w, h });
        }
        moveTo(target) { this._moveToArg = target; }
    };

    Wirecloud.URLs = {
        IWIDGET_COLLECTION: {
            evaluate: (params) => 'http://test/workspace/' + params.workspace_id + '/tab/' + params.tab_id + '/iwidgets',
        },
    };

    Wirecloud.GlobalLogManager = {
        parseErrorResponse: () => 'parsed error',
    };

    Wirecloud.io = {
        makeRequest: () => {},
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WorkspaceTabViewDragboard.js');

    return {
        Wirecloud,
        StyledElements,
        createWidgetMock,
        createBasePreferences,
    };
};

// ===========================================================================
// HELPER: Create dragboard and tab
// ===========================================================================

const createDragboard = (overrides = {}) => {
    const tab = createTabMock(overrides.tab || {});
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    // Override non-writable properties if needed
    if (overrides.customWidth !== undefined) {
        Object.defineProperty(db, 'customWidth', { value: overrides.customWidth, writable: true, configurable: true });
    }

    return { db, tab };
};

// Helper to set widgets on a dragboard (since widgets is non-writable)
const setWidgets = (db, ...widgets) => {
    db.widgets.splice(0, db.widgets.length, ...widgets);
    return db;
};

const createTabMock = (overrides = {}) => {
    const wrapperElement = document.createElement('div');
    const parentNode = document.createElement('div');
    Object.defineProperty(wrapperElement, 'parentNode', { value: parentNode, writable: true, configurable: true });
    Object.defineProperty(wrapperElement, 'offsetWidth', { value: 900, writable: true, configurable: true });
    Object.defineProperty(parentNode, 'clientHeight', { value: 700, writable: true, configurable: true });

    const _prefs = overrides.preferences || createBasePreferences();
    const _modelId = overrides.modelId || 'tab-1';
    const _workspaceId = overrides.workspaceId || 'ws-1';
    const _restricted = overrides.restricted !== undefined ? overrides.restricted : false;
    const _editing = overrides.editing !== undefined ? overrides.editing : true;
    const _widgetsById = overrides.widgetsById || {};

    // Remove known keys from overrides so they don't get spread twice
    const { preferences, modelId, workspaceId, restricted, editing, widgetsById, ...restOverrides } = overrides;

    return {
        wrapperElement,
        model: {
            id: _modelId,
            preferences: _prefs,
        },
        workspace: {
            editing: _editing,
            restricted: _restricted,
            model: {
                id: _workspaceId,
            },
            quitEditingInterval: () => {},
        },
        appendChild: () => {},
        removeChild: () => {},
        quitEditingInterval: () => {},
        widgetsById: _widgetsById,
        ...restOverrides,
    };
};

// Helper to create a fully wired tab mock with proper computed styles for _recomputeSize
const createPaintedTabMock = (overrides = {}) => {
    const wrapperElement = document.createElement('div');
    const parentNode = document.createElement('div');

    Object.defineProperty(wrapperElement, 'parentNode', { value: parentNode, writable: true, configurable: true });
    Object.defineProperty(wrapperElement, 'offsetWidth', { value: 900, writable: true, configurable: true });
    Object.defineProperty(parentNode, 'clientHeight', { value: 700, writable: true, configurable: true });

    const computedStyle = {
        getPropertyValue: (prop) => {
            switch (prop) {
                case 'display': return 'block';
                case 'padding-top': return '10px';
                case 'padding-bottom': return '15px';
                case 'padding-left': return '5px';
                case 'padding-right': return '5px';
                default: return '0px';
            }
        },
    };

    const origGetComputedStyle = document.defaultView.getComputedStyle;
    document.defaultView.getComputedStyle = () => computedStyle;

    const tab = {
        wrapperElement,
        model: {
            id: overrides.modelId || 'tab-1',
            preferences: overrides.preferences || createBasePreferences(),
        },
        workspace: {
            editing: overrides.editing !== undefined ? overrides.editing : true,
            restricted: overrides.restricted !== undefined ? overrides.restricted : false,
            model: {
                id: overrides.workspaceId || 'ws-1',
            },
        },
        appendChild: () => {},
        removeChild: () => {},
        quitEditingInterval: () => {},
        widgetsById: {},
        _restoreGetComputedStyle: () => {
            document.defaultView.getComputedStyle = origGetComputedStyle;
        },
        ...overrides,
    };

    return tab;
};

// ===========================================================================
// TESTS: CONSTRUCTOR
// ===========================================================================

test('constructor initializes all properties', () => {
    setup();
    const { db, tab } = createDragboard();

    assert.equal(db.tab, tab);
    assert.deepEqual(db.widgets, []);
    assert.equal(db.scrollbarSpace, 17);
    assert.equal(db.dragboardWidth, 800);
    assert.equal(db.dragboardHeight, 600);
    assert.equal(db.customWidth, -1);
    assert.equal(db.widgetToMove, null);
    assert.equal(db.painted, false);
});

test('constructor creates fulldragboardLayout instance', () => {
    setup();
    const { db } = createDragboard();

    assert.ok(db.fulldragboardLayout instanceof Wirecloud.ui.FullDragboardLayout);
});

test('constructor creates baseLayout from preferences for columnlayout non-smart', () => {
    setup();
    const tab = createTabMock({
        preferences: createBasePreferences(),
    });
    tab.model.preferences._values.baselayout = {
        type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5,
    };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    assert.ok(db.baseLayout instanceof Wirecloud.ui.ColumnLayout);
    assert.equal(db.baseLayout.columns, 12);
    assert.equal(db.baseLayout.cellheight, 100);
    assert.equal(db.baseLayout.verticalmargin, 5);
    assert.equal(db.baseLayout.horizontalmargin, 5);
});

test('constructor creates baseLayout from preferences for SmartColumnLayout', () => {
    setup();
    const tab = createTabMock({
        preferences: createBasePreferences(),
    });
    tab.model.preferences._values.baselayout = {
        type: 'columnlayout', smart: true, columns: 8, cellheight: 60, verticalmargin: 4, horizontalmargin: 6,
    };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    assert.ok(db.baseLayout instanceof Wirecloud.ui.SmartColumnLayout);
    assert.equal(db.baseLayout.columns, 8);
    assert.equal(db.baseLayout.cellheight, 60);
});

test('constructor creates baseLayout from preferences for GridLayout', () => {
    setup();
    const tab = createTabMock({
        preferences: createBasePreferences(),
    });
    tab.model.preferences._values.baselayout = {
        type: 'gridlayout', columns: 16, rows: 10, verticalmargin: 2, horizontalmargin: 2,
    };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    assert.ok(db.baseLayout instanceof Wirecloud.ui.GridLayout);
    assert.equal(db.baseLayout.columns, 16);
    assert.equal(db.baseLayout.rows, 10);
    assert.equal(db.baseLayout.verticalmargin, 2);
    assert.equal(db.baseLayout.horizontalmargin, 2);
});

test('constructor creates freeLayout instance', () => {
    setup();
    const { db } = createDragboard();

    assert.ok(db.freeLayout instanceof Wirecloud.ui.FreeLayout);
});

test('constructor creates four sidebar layout instances', () => {
    setup();
    const { db } = createDragboard();

    assert.ok(db.leftLayout instanceof Wirecloud.ui.SidebarLayout);
    assert.ok(db.rightLayout instanceof Wirecloud.ui.SidebarLayout);
    assert.ok(db.bottomLayout instanceof Wirecloud.ui.SidebarLayout);
    assert.ok(db.topLayout instanceof Wirecloud.ui.SidebarLayout);
});

test('layouts getter returns array of all 6 layouts', () => {
    setup();
    const { db } = createDragboard();

    const layouts = db.layouts;

    assert.equal(layouts.length, 6);
    assert.equal(layouts[0], db.baseLayout);
    assert.equal(layouts[1], db.freeLayout);
    assert.equal(layouts[2], db.leftLayout);
    assert.equal(layouts[3], db.rightLayout);
    assert.equal(layouts[4], db.bottomLayout);
    assert.equal(layouts[5], db.topLayout);
});

test('constructor adds fixed class when workspace is restricted', () => {
    setup();
    const tab = createTabMock({ restricted: true });
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    assert.ok(tab.wrapperElement.classList.contains('fixed'));
});

test('constructor does not add fixed class when workspace is not restricted', () => {
    setup();
    const tab = createTabMock({ restricted: false });
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    assert.equal(tab.wrapperElement.classList.contains('fixed'), false);
});

// ===========================================================================
// TESTS: getWidth / getHeight
// ===========================================================================

test('getWidth returns dragboardWidth', () => {
    setup();
    const { db } = createDragboard();

    Object.defineProperty(db, 'dragboardWidth', { value: 1024, writable: true, configurable: true });
    assert.equal(db.getWidth(), 1024);
});

test('getHeight returns dragboardHeight', () => {
    setup();
    const { db } = createDragboard();

    Object.defineProperty(db, 'dragboardHeight', { value: 768, writable: true, configurable: true });
    assert.equal(db.getHeight(), 768);
});

// ===========================================================================
// TESTS: lowerToBottom
// ===========================================================================

test('lowerToBottom returns this when z is already 0', () => {
    setup();
    const { db } = createDragboard();

    const widget = createWidgetMock({ z: 0 });
    setWidgets(db, widget);

    const result = db.lowerToBottom(widget);

    assert.equal(result, db);
    assert.equal(db.widgets.length, 1);
    assert.equal(db.widgets[0], widget);
});

test('lowerToBottom moves widget to bottom of z stack', () => {
    setup();
    const { db } = createDragboard();

    const setPositionCalls = [];
    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    w0.setPosition = (pos) => setPositionCalls.push({ id: 'w0', z: pos.z });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    w1.setPosition = (pos) => setPositionCalls.push({ id: 'w1', z: pos.z });
    const w2 = createWidgetMock({ id: 'w2', z: 2 });
    w2.setPosition = (pos) => setPositionCalls.push({ id: 'w2', z: pos.z });

    setWidgets(db, w0, w1, w2);

    let updateCalled = false;
    const origUpdate = db.update;
    db.update = function () { updateCalled = true; return Promise.resolve(db); };

    const result = db.lowerToBottom(w2);

    assert.equal(result, db);
    assert.equal(db.widgets[0], w2);
    assert.equal(db.widgets[1], w0);
    assert.equal(db.widgets[2], w1);
    assert.equal(setPositionCalls.length, 3);
    assert.deepEqual(setPositionCalls[0], { id: 'w2', z: 0 });
    assert.deepEqual(setPositionCalls[1], { id: 'w0', z: 1 });
    assert.deepEqual(setPositionCalls[2], { id: 'w1', z: 2 });
    assert.equal(updateCalled, true);
});

test('lowerToBottom moves widget from middle to bottom', () => {
    setup();
    const { db } = createDragboard();

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    const w2 = createWidgetMock({ id: 'w2', z: 2 });
    const w3 = createWidgetMock({ id: 'w3', z: 3 });

    setWidgets(db, w0, w1, w2, w3);

    let updateCalled = false;
    db.update = function () { updateCalled = true; return Promise.resolve(db); };

    db.lowerToBottom(w1);

    assert.equal(db.widgets[0], w1);
    assert.equal(db.widgets[1], w0);
    assert.equal(db.widgets[2], w2);
    assert.equal(db.widgets[3], w3);
    assert.equal(updateCalled, true);
});

// ===========================================================================
// TESTS: lower
// ===========================================================================

test('lower returns this when z is 0', () => {
    setup();
    const { db } = createDragboard();

    const widget = createWidgetMock({ z: 0 });
    setWidgets(db, widget);

    let updateCalled = false;
    db.update = () => { updateCalled = true; return Promise.resolve(db); };

    const result = db.lower(widget);

    assert.equal(result, db);
    assert.equal(updateCalled, false);
});

test('lower swaps widget with one below', () => {
    setup();
    const { db } = createDragboard();

    let w0SetPos = null;
    let w1SetPos = null;
    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    w0.setPosition = (pos) => { w0SetPos = pos.z; };
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    w1.setPosition = (pos) => { w1SetPos = pos.z; };

    setWidgets(db, w0, w1);

    let updateIds = null;
    db.update = (ids) => { updateIds = ids; return Promise.resolve(db); };

    const result = db.lower(w1);

    assert.equal(result, db);
    assert.equal(db.widgets[0], w1);
    assert.equal(db.widgets[1], w0);
    assert.equal(w1SetPos, 0);
    assert.equal(w0SetPos, 1);
    assert.deepEqual(updateIds, [w1.id, w0.id]);
});

// ===========================================================================
// TESTS: raiseToTop
// ===========================================================================

test('raiseToTop returns this when already at top', () => {
    setup();
    const { db } = createDragboard();

    const widget = createWidgetMock({ z: 0 });
    setWidgets(db, widget);

    let updateCalled = false;
    db.update = () => { updateCalled = true; return Promise.resolve(db); };

    const result = db.raiseToTop(widget);

    assert.equal(result, db);
    assert.equal(updateCalled, false);
});

test('raiseToTop moves widget to top of z stack', () => {
    setup();
    const { db } = createDragboard();

    const setPositionCalls = [];
    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    w0.setPosition = (pos) => setPositionCalls.push({ id: 'w0', z: pos.z });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    w1.setPosition = (pos) => setPositionCalls.push({ id: 'w1', z: pos.z });
    const w2 = createWidgetMock({ id: 'w2', z: 2 });
    w2.setPosition = (pos) => setPositionCalls.push({ id: 'w2', z: pos.z });

    setWidgets(db, w0, w1, w2);

    let updateCalled = false;
    db.update = () => { updateCalled = true; return Promise.resolve(db); };

    db.raiseToTop(w0);

    assert.equal(db.widgets[0], w1);
    assert.equal(db.widgets[1], w2);
    assert.equal(db.widgets[2], w0);
    assert.equal(setPositionCalls.length, 3);
    assert.deepEqual(setPositionCalls[0], { id: 'w1', z: 0 });
    assert.deepEqual(setPositionCalls[1], { id: 'w2', z: 1 });
    assert.deepEqual(setPositionCalls[2], { id: 'w0', z: 2 });
    assert.equal(updateCalled, true);
});

test('raiseToTop on middle widget moves it to end', () => {
    setup();
    const { db } = createDragboard();

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    const w2 = createWidgetMock({ id: 'w2', z: 2 });
    const w3 = createWidgetMock({ id: 'w3', z: 3 });

    setWidgets(db, w0, w1, w2, w3);

    let updateCalled = false;
    db.update = () => { updateCalled = true; return Promise.resolve(db); };

    db.raiseToTop(w1);

    assert.equal(db.widgets[0], w0);
    assert.equal(db.widgets[1], w2);
    assert.equal(db.widgets[2], w3);
    assert.equal(db.widgets[3], w1);
    assert.equal(updateCalled, true);
});

// ===========================================================================
// TESTS: raise
// ===========================================================================

test('raise returns this when already at top', () => {
    setup();
    const { db } = createDragboard();

    const widget = createWidgetMock({ z: 0 });
    setWidgets(db, widget);

    const result = db.raise(widget);

    assert.equal(result, db);
});

test('raise swaps widget with one above', () => {
    setup();
    const { db } = createDragboard();

    let w0SetPos = null;
    let w1SetPos = null;
    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    w0.setPosition = (pos) => { w0SetPos = pos.z; };
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    w1.setPosition = (pos) => { w1SetPos = pos.z; };

    setWidgets(db, w0, w1);

    let updateIds = null;
    db.update = (ids) => { updateIds = ids; return Promise.resolve(db); };

    const result = db.raise(w0);

    assert.equal(result, db);
    assert.equal(db.widgets[0], w1);
    assert.equal(db.widgets[1], w0);
    assert.equal(w0SetPos, 1);
    assert.equal(w1SetPos, 0);
    assert.deepEqual(updateIds, [w0.id, w1.id]);
});

test('raise does nothing when z equals last index', () => {
    setup();
    const { db } = createDragboard();

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    const w2 = createWidgetMock({ id: 'w2', z: 2 });
    setWidgets(db, w0, w1, w2);

    let updateCalled = false;
    db.update = () => { updateCalled = true; return Promise.resolve(db); };

    db.raise(w2);
    assert.equal(updateCalled, false);
});

// ===========================================================================
// TESTS: refreshPositionBasedOnZIndex
// ===========================================================================

test('refreshPositionBasedOnZIndex sorts widgets by position.z', () => {
    setup();
    const { db } = createDragboard();

    const w0 = createWidgetMock({ id: 'w0', z: 3 });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    const w2 = createWidgetMock({ id: 'w2', z: 0 });
    const w3 = createWidgetMock({ id: 'w3', z: 2 });

    setWidgets(db, w0, w1, w2, w3);

    db.refreshPositionBasedOnZIndex();

    assert.equal(db.widgets[0], w2);
    assert.equal(db.widgets[1], w1);
    assert.equal(db.widgets[2], w3);
    assert.equal(db.widgets[3], w0);
});

test('refreshPositionBasedOnZIndex with already sorted widgets', () => {
    setup();
    const { db } = createDragboard();

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    const w2 = createWidgetMock({ id: 'w2', z: 2 });

    setWidgets(db, w0, w1, w2);

    db.refreshPositionBasedOnZIndex();

    assert.equal(db.widgets[0], w0);
    assert.equal(db.widgets[1], w1);
    assert.equal(db.widgets[2], w2);
});

test('refreshPositionBasedOnZIndex with empty widgets', () => {
    setup();
    const { db } = createDragboard();

    db.refreshPositionBasedOnZIndex();
    assert.deepEqual(db.widgets, []);
});

test('refreshPositionBasedOnZIndex with single widget', () => {
    setup();
    const { db } = createDragboard();

    const widget = createWidgetMock({ z: 5 });
    setWidgets(db, widget);

    db.refreshPositionBasedOnZIndex();

    assert.equal(db.widgets[0], widget);
    assert.equal(db.widgets.length, 1);
});

// ===========================================================================
// TESTS: paint
// ===========================================================================

test('paint returns early when already painted', () => {
    setup();
    const tab = createPaintedTabMock();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    Object.defineProperty(db, 'painted', { value: true, writable: true, configurable: true });

    // Find the prototype's _recomputeSize to verify it's NOT called
    let recomputeCalled = false;
    const origRecompute = Object.getPrototypeOf(db)._recomputeSize;
    Object.getPrototypeOf(db)._recomputeSize = function () { recomputeCalled = true; return origRecompute.call(this); };

    db.paint();

    assert.equal(recomputeCalled, false);

    Object.getPrototypeOf(db)._recomputeSize = origRecompute;
    tab._restoreGetComputedStyle();
});

test('paint calls _recomputeSize and initializes all layouts', () => {
    setup();
    const tab = createPaintedTabMock();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    db.paint();

    assert.equal(db.painted, true);
    assert.equal(db.baseLayout.initialized, true);
    assert.equal(db.freeLayout.initialized, true);
    assert.equal(db.fulldragboardLayout.initialized, true);
    assert.equal(db.leftLayout.initialized, true);
    assert.equal(db.rightLayout.initialized, true);
    assert.equal(db.bottomLayout.initialized, true);
    assert.equal(db.topLayout.initialized, true);
    assert.equal(db.dragboardWidth, 890);
    assert.equal(db.dragboardHeight, 675);

    tab._restoreGetComputedStyle();
});

test('paint calls refresh_zindex which removes nulls and resets positions', () => {
    setup();
    const tab = createPaintedTabMock();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    const w2 = createWidgetMock({ id: 'w2', z: 2 });

    setWidgets(db, w0, null, w2);

    db.paint();

    assert.equal(db.widgets.length, 2);
    assert.equal(db.widgets[0], w0);
    assert.equal(db.widgets[1], w2);

    tab._restoreGetComputedStyle();
});

test('paint calls refresh_zindex on trailing nulls', () => {
    setup();
    const tab = createPaintedTabMock();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, w0, null, null);

    db.paint();

    assert.equal(db.widgets.length, 1);
    assert.equal(db.widgets[0], w0);

    tab._restoreGetComputedStyle();
});

test('paint calls refresh_zindex on empty widgets', () => {
    setup();
    const tab = createPaintedTabMock();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    db.paint();

    assert.equal(db.widgets.length, 0);
    assert.equal(db.painted, true);

    tab._restoreGetComputedStyle();
});

// ===========================================================================
// TESTS: resetLayouts
// ===========================================================================

test('resetLayouts resets painted flag', () => {
    setup();
    const { db } = createDragboard();

    Object.defineProperty(db, 'painted', { value: true, writable: true, configurable: true });
    db.resetLayouts();

    assert.equal(db.painted, false);
});

test('resetLayouts creates all layout instances', () => {
    setup();
    const { db } = createDragboard();

    db.resetLayouts();

    assert.ok(db.fulldragboardLayout instanceof Wirecloud.ui.FullDragboardLayout);
    assert.ok(db.baseLayout instanceof Wirecloud.ui.ColumnLayout);
    assert.ok(db.freeLayout instanceof Wirecloud.ui.FreeLayout);
    assert.ok(db.leftLayout instanceof Wirecloud.ui.SidebarLayout);
    assert.ok(db.rightLayout instanceof Wirecloud.ui.SidebarLayout);
    assert.ok(db.bottomLayout instanceof Wirecloud.ui.SidebarLayout);
    assert.ok(db.topLayout instanceof Wirecloud.ui.SidebarLayout);
});

// ===========================================================================
// TESTS: updateWidgetScreenSize
// ===========================================================================

test('updateWidgetScreenSize calls all steps', () => {
    setup();
    const tab = createPaintedTabMock();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    let updateSizeCalls = [];
    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    w0.updateWindowSize = (size) => updateSizeCalls.push({ id: 'w0', size });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    w1.updateWindowSize = (size) => updateSizeCalls.push({ id: 'w1', size });

    setWidgets(db, w0, w1);

    db.updateWidgetScreenSize(1024);

    assert.equal(updateSizeCalls.length, 2);
    assert.deepEqual(updateSizeCalls[0], { id: 'w0', size: 1024 });
    assert.deepEqual(updateSizeCalls[1], { id: 'w1', size: 1024 });
    assert.equal(db.painted, true);

    tab._restoreGetComputedStyle();
});

test('updateWidgetScreenSize with empty widgets', () => {
    setup();
    const tab = createPaintedTabMock();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    db.updateWidgetScreenSize(800);

    assert.equal(db.widgets.length, 0);
    assert.equal(db.painted, true);

    tab._restoreGetComputedStyle();
});

// ===========================================================================
// TESTS: updateWidgetScreenSizeWithId
// ===========================================================================

test('updateWidgetScreenSizeWithId computes average size', () => {
    setup();
    const tab = createTabMock({
        preferences: createBasePreferences(),
    });
    tab.model.preferences._values.screenSizes = [
        { id: 'tablet', name: 'tablet', moreOrEqual: 481, lessOrEqual: 1024 },
    ];

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    let screenSizeArg = null;
    db.updateWidgetScreenSize = (size) => { screenSizeArg = size; };

    db.updateWidgetScreenSizeWithId('tablet');

    assert.equal(screenSizeArg, (481 + 1024) / 2);
});

test('updateWidgetScreenSizeWithId uses moreOrEqual when lessOrEqual === -1', () => {
    setup();
    const tab = createTabMock({
        preferences: createBasePreferences(),
    });
    tab.model.preferences._values.screenSizes = [
        { id: 'desktop', name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
    ];

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    let screenSizeArg = null;
    db.updateWidgetScreenSize = (size) => { screenSizeArg = size; };

    db.updateWidgetScreenSizeWithId('desktop');

    assert.equal(screenSizeArg, 1025);
});

test('updateWidgetScreenSizeWithId does nothing when screenSize not found', () => {
    setup();
    const tab = createTabMock({
        preferences: createBasePreferences(),
    });
    tab.model.preferences._values.screenSizes = [];

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    let called = false;
    db.updateWidgetScreenSize = () => { called = true; };

    db.updateWidgetScreenSizeWithId('nonexistent');

    assert.equal(called, false);
});

// ===========================================================================
// TESTS: update
// ===========================================================================

test('update returns Promise.resolve(this) when editing is false', async () => {
    setup();
    const tab = createTabMock({ editing: false });
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const result = await db.update();

    assert.equal(result, db);
});

test('update returns Promise.resolve(this) when no content (empty widgets)', async () => {
    setup();
    const { db } = createDragboard();

    const result = await db.update();

    assert.equal(result, db);
});

test('update returns Promise.resolve(this) when all widgets are volatile', async () => {
    setup();
    const { db } = createDragboard();

    const w0 = createWidgetMock({ id: 'w0', z: 0, volatile: true });
    setWidgets(db, w0);

    const result = await db.update();

    assert.equal(result, db);
});

test('update returns Promise.resolve(this) when ids filter matches no widgets', async () => {
    setup();
    const { db } = createDragboard();

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, w0);

    const result = await db.update(['unknown-id']);

    assert.equal(result, db);
});

test('update sends PUT request with widget data on 204 success', async () => {
    setup();
    const tab = createTabMock();
    tab.widgetsById = { w0: null };
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, w0);

    let requestUrl = null;
    let requestBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        requestUrl = url;
        requestBody = opts.postBody;
        return Promise.resolve({ status: 204 });
    };

    const result = await db.update();

    assert.equal(result, db);
    assert.ok(typeof requestUrl === 'string');
    assert.ok(requestUrl.includes('iwidgets'));
    assert.ok(typeof requestBody === 'string');
    assert.ok(requestBody.includes('w0'));
});

test('update sends PUT request with allLayoutConfigurations param', async () => {
    setup();
    const tab = createTabMock();
    tab.widgetsById = { w0: null };
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    let toJSONArgs = null;
    w0.toJSON = (action, allLayouts) => { toJSONArgs = { action, allLayouts }; return { id: 'w0' }; };

    setWidgets(db, w0);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });

    await db.update(null, true);

    assert.equal(toJSONArgs.action, 'update');
    assert.equal(toJSONArgs.allLayouts, true);
});

test('update calls widget.persist on success', async () => {
    setup();
    const tab = createTabMock();
    tab.widgetsById = { w0: null };
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    let persistCalled = false;
    w0.persist = () => { persistCalled = true; };

    setWidgets(db, w0);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });

    await db.update();

    assert.equal(persistCalled, true);
});

function createUpdateTestTab() {
    const tab = createTabMock();
    tab.widgetsById = { w0: null };
    return tab;
}

test('update rejects on status 200 (unexpected)', async () => {
    setup();
    const tab = createUpdateTestTab();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, w0);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200 });

    let errorCaught = null;
    try {
        await db.update();
    } catch (e) {
        errorCaught = e;
    }

    assert.ok(errorCaught != null);
    assert.ok(errorCaught.includes('Unexpected response'));
});

test('update rejects on status 401', async () => {
    setup();
    const tab = createUpdateTestTab();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, w0);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 401 });

    let errorCaught = null;
    try {
        await db.update();
    } catch (e) {
        errorCaught = e;
    }

    assert.equal(errorCaught, 'parsed error');
});

test('update rejects on status 403', async () => {
    setup();
    const tab = createUpdateTestTab();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, w0);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 403 });

    let errorCaught = null;
    try {
        await db.update();
    } catch (e) {
        errorCaught = e;
    }

    assert.equal(errorCaught, 'parsed error');
});

test('update rejects on status 404', async () => {
    setup();
    const tab = createUpdateTestTab();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, w0);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 404 });

    let errorCaught = null;
    try {
        await db.update();
    } catch (e) {
        errorCaught = e;
    }

    assert.equal(errorCaught, 'parsed error');
});

test('update rejects on status 500', async () => {
    setup();
    const tab = createUpdateTestTab();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, w0);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });

    let errorCaught = null;
    try {
        await db.update();
    } catch (e) {
        errorCaught = e;
    }

    assert.equal(errorCaught, 'parsed error');
});

test('update uses ids parameter when provided', async () => {
    setup();
    const { db } = createDragboard();

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    setWidgets(db, w0, w1);

    let jsonContent = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        jsonContent = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };

    await db.update(['w0']);

    assert.equal(jsonContent.length, 1);
    assert.equal(jsonContent[0].id, 'w0');
});

test('update filters out volatile widgets', async () => {
    setup();
    const tab = createTabMock();
    tab.widgetsById = { w0: null, w1: null };
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0, volatile: true });
    const w1 = createWidgetMock({ id: 'w1', z: 1, volatile: false });
    setWidgets(db, w0, w1);

    let jsonContent = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        jsonContent = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };

    await db.update();

    assert.equal(jsonContent.length, 1);
    assert.equal(jsonContent[0].id, 'w1');
});

test('update uses Object.keys on widgetsById for default ids', async () => {
    setup();
    const tab = createTabMock();
    tab.widgetsById = { w0: null, w1: null };
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    setWidgets(db, w0, w1);

    let jsonContent = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        jsonContent = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };

    await db.update();

    assert.equal(jsonContent.length, 2);
});

// ===========================================================================
// TESTS: _updateBaseLayout
// ===========================================================================

test('_updateBaseLayout creates new layout and moves widgets from old to new', () => {
    setup();
    const { db } = createDragboard();

    const oldBaseLayout = db.baseLayout;

    let newLayoutInitCalled = false;
    const origBuild = db._buildLayoutFromPreferences;
    db._buildLayoutFromPreferences = () => {
        const layout = new Wirecloud.ui.ColumnLayout(db, 5, 50, 3, 3);
        const origInit = layout.initialize;
        layout.initialize = function () { newLayoutInitCalled = true; return origInit.call(this); };
        return layout;
    };

    db._updateBaseLayout();

    assert.equal(newLayoutInitCalled, true);
    assert.notStrictEqual(db.baseLayout, oldBaseLayout);
    assert.equal(oldBaseLayout._moveToArg, db.baseLayout);
});

// ===========================================================================
// TESTS: _updateScreenSizes
// ===========================================================================

test('_updateScreenSizes with customWidth !== -1 calls quitEditingInterval', async () => {
    setup();
    const tab = createPaintedTabMock();
    let quitCalled = false;
    tab.quitEditingInterval = () => { quitCalled = true; };
    tab.workspace.quitEditingInterval = tab.quitEditingInterval;

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'customWidth', { value: 500, writable: true, configurable: true });

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });

    await db._updateScreenSizes();

    assert.equal(quitCalled, true);

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes deletes configs for removed screen sizes', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'desktop', name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'old-screen', anchor: 'top-left', width: 4, height: 3,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 0, lessOrEqual: 480,
            },
            {
                id: 'desktop', anchor: 'top-left', width: 8, height: 6,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 1025, lessOrEqual: -1,
            },
        ],
    });

    let updateWindowSizeArg = null;
    widget.updateWindowSize = (size) => { updateWindowSizeArg = size; };

    setWidgets(db, widget);

    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };

    await db._updateScreenSizes();

    const widgetReq = reqBody.find((r) => r.id === 'w0');
    assert.ok(widgetReq != null);
    const deleteConfig = widgetReq.layoutConfig.find((c) => c.id === 'old-screen' && c.action === 'delete');
    assert.ok(deleteConfig != null);

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes creates new configs for new screen sizes', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'phone', name: 'phone', moreOrEqual: 0, lessOrEqual: 480 },
        { id: 'desktop', name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'desktop', anchor: 'top-left', width: 8, height: 6,
                relwidth: false, relheight: false, left: 50, top: 100, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 1025, lessOrEqual: -1,
            },
        ],
    });

    setWidgets(db, widget);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });

    await db._updateScreenSizes();

    const phoneConfig = widget.model.layoutConfig.find((c) => c.id === 'phone');
    assert.ok(phoneConfig != null);
    assert.equal(phoneConfig.width, 8);
    assert.equal(phoneConfig.height, 6);
    assert.equal(phoneConfig.left, 50);
    assert.equal(phoneConfig.top, 100);

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes updates moreOrEqual when it differs', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'desktop', name: 'desktop', moreOrEqual: 1200, lessOrEqual: -1 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'desktop', anchor: 'top-left', width: 4, height: 3,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 1025, lessOrEqual: -1,
            },
        ],
    });

    setWidgets(db, widget);

    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };

    await db._updateScreenSizes();

    assert.equal(widget.model.layoutConfig[0].moreOrEqual, 1200);
    const widgetReq = reqBody.find((r) => r.id === 'w0');
    const updateConfig = widgetReq.layoutConfig.find((c) => c.id === 'desktop' && c.action === 'update');
    assert.ok(updateConfig != null);

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes does not add update action when bounds unchanged', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'desktop', name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'desktop', anchor: 'top-left', width: 4, height: 3,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 1025, lessOrEqual: -1,
            },
        ],
    });

    setWidgets(db, widget);

    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };

    await db._updateScreenSizes();

    const widgetReq = reqBody.find((r) => r.id === 'w0');
    const updateConfig = widgetReq.layoutConfig.find((c) => c.action === 'update');
    assert.equal(updateConfig, undefined);

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes adds new config when screen size is new', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'new-size', name: 'new-size', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'old-screen', anchor: 'top-left', width: 4, height: 3,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 0, lessOrEqual: 480,
            },
        ],
    });

    setWidgets(db, widget);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });

    await db._updateScreenSizes();

    const newConfig = widget.model.layoutConfig.find((c) => c.id === 'new-size');
    assert.ok(newConfig != null);

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes rejects on 500 status', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'desktop', name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'desktop', anchor: 'top-left', width: 4, height: 3,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 1025, lessOrEqual: -1,
            },
        ],
    });

    setWidgets(db, widget);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });

    let errorCaught = null;
    try {
        await db._updateScreenSizes();
    } catch (e) {
        errorCaught = e;
    }

    assert.equal(errorCaught, 'parsed error');

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes rejects on unexpected status', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'desktop', name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'desktop', anchor: 'top-left', width: 4, height: 3,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 1025, lessOrEqual: -1,
            },
        ],
    });

    setWidgets(db, widget);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200 });

    let errorCaught = null;
    try {
        await db._updateScreenSizes();
    } catch (e) {
        errorCaught = e;
    }

    assert.ok(errorCaught != null);
    assert.ok(errorCaught.includes('Unexpected response'));

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes updates lessOrEqual when it differs', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'phone', name: 'phone', moreOrEqual: 0, lessOrEqual: 600 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'phone', anchor: 'top-left', width: 4, height: 3,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 0, lessOrEqual: 480,
            },
        ],
    });

    setWidgets(db, widget);

    let reqBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };

    await db._updateScreenSizes();

    assert.equal(widget.model.layoutConfig[0].lessOrEqual, 600);

    const widgetReq = reqBody.find((r) => r.id === 'w0');
    const updateConfig = widgetReq.layoutConfig.find((c) => c.id === 'phone' && c.action === 'update');
    assert.ok(updateConfig != null);
    assert.equal(updateConfig.lessOrEqual, 600);

    tab._restoreGetComputedStyle();
});

test('_updateScreenSizes calls refreshPositionBasedOnZIndex and paint', async () => {
    setup();
    const tab = createPaintedTabMock();
    tab.model.preferences._values.screenSizes = [
        { id: 'desktop', name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
    ];
    tab.model.preferences._values.baselayout = { type: 'columnlayout', smart: false, columns: 12, cellheight: 100, verticalmargin: 5, horizontalmargin: 5 };

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    Object.defineProperty(db, 'painted', { value: false, writable: true, configurable: true });

    const widget = createWidgetMock({
        id: 'w0', z: 0,
        layoutConfig: [
            {
                id: 'desktop', anchor: 'top-left', width: 4, height: 3,
                relwidth: false, relheight: false, left: 0, top: 0, zIndex: 0,
                relx: false, rely: false, titlevisible: true, fulldragboard: false,
                minimized: false, moreOrEqual: 1025, lessOrEqual: -1,
            },
        ],
    });

    setWidgets(db, widget);

    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });

    await db._updateScreenSizes();

    assert.equal(db.painted, true);

    tab._restoreGetComputedStyle();
});

// ===========================================================================
// TESTS: setCustomDragboardWidth
// ===========================================================================

test('setCustomDragboardWidth sets customWidth and calls updateWidgetScreenSize', () => {
    setup();
    const { db } = createDragboard();

    let sizeArg = null;
    db.updateWidgetScreenSize = (size) => { sizeArg = size; };

    db.setCustomDragboardWidth(768);

    assert.equal(db.customWidth, 768);
    assert.equal(sizeArg, 768);
});

// ===========================================================================
// TESTS: restoreDragboardWidth
// ===========================================================================

test('restoreDragboardWidth resets customWidth and calls updateWidgetScreenSize', () => {
    setup();
    const { db } = createDragboard();

    Object.defineProperty(db, 'customWidth', { value: 500, writable: true, configurable: true });

    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 1024;

    let sizeArg = null;
    db.updateWidgetScreenSize = (size) => { sizeArg = size; };

    db.restoreDragboardWidth();

    assert.equal(db.customWidth, -1);
    assert.equal(sizeArg, 1024);

    global.window.innerWidth = origInnerWidth;
});

// ===========================================================================
// TESTS: _addWidget
// ===========================================================================

test('_addWidget pushes widget when z is null or undefined', () => {
    setup();
    const { db, tab } = createDragboard();

    const widget = createWidgetMock({ z: 0 });
    // Override position.z to be null (simulating no z)
    widget.position.z = null;

    let setPosCalled = null;
    widget.setPosition = (pos) => { setPosCalled = pos; };

    let appendChildArg = null;
    tab.appendChild = (w) => { appendChildArg = w; };

    db._addWidget(widget);

    assert.equal(db.widgets.length, 1);
    assert.equal(db.widgets[0], widget);
    assert.equal(setPosCalled.z, 0);
    assert.equal(appendChildArg, widget);
});

test('_addWidget sets widget at z index when slot is empty', () => {
    setup();
    const { db, tab } = createDragboard();

    // Pre-populate with null slot
    setWidgets(db, null, null, null);

    const widget = createWidgetMock({ id: 'w-new', z: 1 });

    db._addWidget(widget);

    assert.equal(db.widgets[1], widget);
    // z=1 means we set directly, nulls remain at other slots
    assert.equal(db.widgets[0], null);
    assert.equal(db.widgets[2], null);
});

test('_addWidget splices widget at z index when slot is occupied', () => {
    setup();
    const { db, tab } = createDragboard();

    const existing = createWidgetMock({ id: 'w-existing', z: 1 });
    const existing2 = createWidgetMock({ id: 'w-existing2', z: 2 });
    setWidgets(db, createWidgetMock({ id: 'w0', z: 0 }), existing, existing2);

    const widget = createWidgetMock({ id: 'w-new', z: 1 });

    db._addWidget(widget);

    // splice(z, 1, this.widgets[z], widget) inserts existing before new:
    // [w0, w-existing, w-new, w-existing2]
    assert.equal(db.widgets.length, 4);
    assert.equal(db.widgets[0].id, 'w0');
    assert.equal(db.widgets[1].id, 'w-existing');
    assert.equal(db.widgets[2].id, 'w-new');
    assert.equal(db.widgets[3].id, 'w-existing2');
});

test('_addWidget calls tab.appendChild', () => {
    setup();
    const { db, tab } = createDragboard();

    let appendChildArg = null;
    tab.appendChild = (w) => { appendChildArg = w; };

    const widget = createWidgetMock({ z: 0 });

    db._addWidget(widget);

    assert.equal(appendChildArg, widget);
});

// ===========================================================================
// TESTS: _removeWidget
// ===========================================================================

test('_removeWidget removes widget and reindexes remaining', () => {
    setup();
    const { db, tab } = createDragboard();

    const setPosCalls = [];
    const w0 = createWidgetMock({ id: 'w0', z: 0 });
    w0.setPosition = (pos) => setPosCalls.push({ id: 'w0', z: pos.z });
    const w1 = createWidgetMock({ id: 'w1', z: 1 });
    w1.setPosition = (pos) => setPosCalls.push({ id: 'w1', z: pos.z });
    const w2 = createWidgetMock({ id: 'w2', z: 2 });
    w2.setPosition = (pos) => setPosCalls.push({ id: 'w2', z: pos.z });

    setWidgets(db, w0, w1, w2);

    let removeChildArg = null;
    tab.removeChild = (w) => { removeChildArg = w; };

    db._removeWidget(w1);

    assert.equal(db.widgets.length, 2);
    assert.equal(db.widgets[0], w0);
    assert.equal(db.widgets[1], w2);
    assert.equal(removeChildArg, w1);

    assert.equal(setPosCalls.length, 2);
    assert.deepEqual(setPosCalls[0], { id: 'w0', z: 0 });
    assert.deepEqual(setPosCalls[1], { id: 'w2', z: 1 });
});

test('_removeWidget removes last widget', () => {
    setup();
    const { db, tab } = createDragboard();

    const widget = createWidgetMock({ id: 'w0', z: 0 });
    setWidgets(db, widget);

    db._removeWidget(widget);

    assert.equal(db.widgets.length, 0);
});

test('_removeWidget calls tab.removeChild', () => {
    setup();
    const { db, tab } = createDragboard();

    let removeChildArg = null;
    tab.removeChild = (w) => { removeChildArg = w; };

    const widget = createWidgetMock({ z: 0 });
    setWidgets(db, widget);

    db._removeWidget(widget);

    assert.equal(removeChildArg, widget);
});

// ===========================================================================
// TESTS: _notifyWindowResizeEvent
// ===========================================================================

test('_notifyWindowResizeEvent does nothing when size unchanged', () => {
    setup();
    const { db } = createDragboard();

    Object.defineProperty(db, 'dragboardWidth', { value: 800, writable: true, configurable: true });
    Object.defineProperty(db, 'dragboardHeight', { value: 600, writable: true, configurable: true });

    let updateIWidgetSizesCalled = false;
    db._updateIWidgetSizes = () => { updateIWidgetSizesCalled = true; };

    db._recomputeSize = () => {
        // Don't change dragboardWidth/Height
    };

    db._notifyWindowResizeEvent();

    assert.equal(updateIWidgetSizesCalled, false);
});

test('_notifyWindowResizeEvent calls _updateIWidgetSizes when width changes', () => {
    setup();
    const { db } = createDragboard();

    Object.defineProperty(db, 'dragboardWidth', { value: 800, writable: true, configurable: true });
    Object.defineProperty(db, 'dragboardHeight', { value: 600, writable: true, configurable: true });

    let resizeArgs = null;
    db._updateIWidgetSizes = (w, h) => { resizeArgs = { w, h }; };

    db._recomputeSize = () => {
        Object.defineProperty(db, 'dragboardWidth', { value: 1024, writable: true, configurable: true });
    };

    db._notifyWindowResizeEvent();

    assert.equal(resizeArgs.w, true);
    assert.equal(resizeArgs.h, false);
});

test('_notifyWindowResizeEvent calls _updateIWidgetSizes when height changes', () => {
    setup();
    const { db } = createDragboard();

    Object.defineProperty(db, 'dragboardWidth', { value: 800, writable: true, configurable: true });
    Object.defineProperty(db, 'dragboardHeight', { value: 600, writable: true, configurable: true });

    let resizeArgs = null;
    db._updateIWidgetSizes = (w, h) => { resizeArgs = { w, h }; };

    db._recomputeSize = () => {
        Object.defineProperty(db, 'dragboardHeight', { value: 768, writable: true, configurable: true });
    };

    db._notifyWindowResizeEvent();

    assert.equal(resizeArgs.w, false);
    assert.equal(resizeArgs.h, true);
});

test('_notifyWindowResizeEvent calls _updateIWidgetSizes when both change', () => {
    setup();
    const { db } = createDragboard();

    Object.defineProperty(db, 'dragboardWidth', { value: 800, writable: true, configurable: true });
    Object.defineProperty(db, 'dragboardHeight', { value: 600, writable: true, configurable: true });

    let resizeArgs = null;
    db._updateIWidgetSizes = (w, h) => { resizeArgs = { w, h }; };

    db._recomputeSize = () => {
        Object.defineProperty(db, 'dragboardWidth', { value: 1280, writable: true, configurable: true });
        Object.defineProperty(db, 'dragboardHeight', { value: 800, writable: true, configurable: true });
    };

    db._notifyWindowResizeEvent();

    assert.equal(resizeArgs.w, true);
    assert.equal(resizeArgs.h, true);
});

// ===========================================================================
// TESTS: _recomputeSize
// ===========================================================================

test('_recomputeSize returns early when display is none', () => {
    setup();
    const tab = createPaintedTabMock();

    const computedStyleNone = {
        getPropertyValue: (prop) => prop === 'display' ? 'none' : '0px',
    };
    document.defaultView.getComputedStyle = () => computedStyleNone;

    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);
    const origWidth = db.dragboardWidth;
    const origHeight = db.dragboardHeight;

    db._recomputeSize();

    assert.equal(db.dragboardWidth, origWidth);
    assert.equal(db.dragboardHeight, origHeight);

    tab._restoreGetComputedStyle();
});

test('_recomputeSize calculates correct dimensions', () => {
    setup();
    const tab = createPaintedTabMock();
    const db = new Wirecloud.ui.WorkspaceTabViewDragboard(tab);

    db._recomputeSize();

    assert.equal(db.topMargin, 10);
    assert.equal(db.bottomMargin, 15);
    assert.equal(db.leftMargin, 5);
    assert.equal(db.rightMargin, 5);
    assert.equal(db.dragboardWidth, 890);  // 900 - 5 - 5
    assert.equal(db.dragboardHeight, 675); // 700 - 10 - 15

    tab._restoreGetComputedStyle();
});

// ===========================================================================
// TESTS: _updateIWidgetSizes
// ===========================================================================

test('_updateIWidgetSizes calls _notifyWindowResizeEvent on all layouts', () => {
    setup();
    const { db } = createDragboard();

    db._updateIWidgetSizes(true, false);

    const layouts = db.layouts;
    layouts.forEach((layout) => {
        assert.equal(layout._resizeEventCalls.length, 1);
        assert.equal(layout._resizeEventCalls[0].w, true);
        assert.equal(layout._resizeEventCalls[0].h, false);
    });
});

test('_updateIWidgetSizes with both width and height changed', () => {
    setup();
    const { db } = createDragboard();

    db._updateIWidgetSizes(true, true);

    db.layouts.forEach((layout) => {
        assert.equal(layout._resizeEventCalls.length, 1);
        assert.equal(layout._resizeEventCalls[0].w, true);
        assert.equal(layout._resizeEventCalls[0].h, true);
    });
});

test('_updateIWidgetSizes with neither changed', () => {
    setup();
    const { db } = createDragboard();

    db._updateIWidgetSizes(false, false);

    db.layouts.forEach((layout) => {
        assert.equal(layout._resizeEventCalls.length, 1);
        assert.equal(layout._resizeEventCalls[0].w, false);
        assert.equal(layout._resizeEventCalls[0].h, false);
    });
});
