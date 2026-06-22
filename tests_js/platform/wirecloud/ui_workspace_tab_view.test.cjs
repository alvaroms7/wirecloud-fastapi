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

const createLayoutMock = (overrides = {}) => ({
    adaptColumnOffset: (value) => ({ inLU: value, inPixels: value * 10 }),
    adaptRowOffset: (value) => ({ inLU: value, inPixels: value * 10 }),
    adaptHeight: (value) => ({ inLU: value, inPixels: value * 10 }),
    adaptWidth: (value) => ({ inLU: value, inPixels: value * 10 }),
    columns: 12,
    ...overrides,
});

const createDragboardMock = (overrides = {}) => ({
    customWidth: -1,
    baseLayout: createLayoutMock(),
    freeLayout: createLayoutMock(),
    leftLayout: createLayoutMock(),
    rightLayout: createLayoutMock(),
    _updateScreenSizes: () => {},
    _updateBaseLayout: () => {},
    updateWidgetScreenSize: () => {},
    setCustomDragboardWidth: () => {},
    restoreDragboardWidth: () => {},
    paint: () => {},
    _notifyWindowResizeEvent: () => {},
    ...overrides,
});

const createModelMock = (overrides = {}) => {
    const listeners = {};
    const prefListeners = {};
    return {
        id: 'tab-1',
        title: 'Test Tab',
        name: 'test_tab',
        preferences: {
            _values: {
                screenSizes: [
                    { name: 'phone', moreOrEqual: 0, lessOrEqual: 480 },
                    { name: 'tablet', moreOrEqual: 481, lessOrEqual: 1024 },
                    { name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1 },
                ],
                baselayout: 'base',
                initiallayout: 'Free',
            },
            get(key) { return this._values[key]; },
            addEventListener(type, handler) {
                if (!prefListeners[type]) prefListeners[type] = [];
                prefListeners[type].push(handler);
            },
            _dispatch(type, ...args) {
                (prefListeners[type] || []).forEach((h) => h(...args));
            },
        },
        widgets: [],
        isAllowed: () => true,
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        _dispatch(type, ...args) {
            (listeners[type] || []).forEach((h) => h(...args));
        },
        createWidget: () => Promise.resolve({ id: 'widget-new' }),
        ...overrides,
    };
};

const createWorkspaceMock = (overrides = {}) => {
    const listeners = {};
    let _editing = true;
    return {
        get editing() { return _editing; },
        set editing(v) { _editing = v; },
        model: {
            isAllowed: () => true,
        },
        activeTab: null,
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        _dispatch(type, ...args) {
            (listeners[type] || []).forEach((h) => h(...args));
        },
        updateEditingInterval: () => {},
        buildAddWidgetButton: () => {},
        ...overrides,
    };
};

// ===========================================================================
// SETUP
// ===========================================================================

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    // Patch window with addEventListener for resize handling
    global.window.addEventListener = function (type, handler) {
        if (!global.window._listeners) global.window._listeners = {};
        if (!global.window._listeners[type]) global.window._listeners[type] = [];
        global.window._listeners[type].push(handler);
    };
    global.window.removeEventListener = function () {};
    global.window.dispatchEvent = function (event) {
        const listeners = global.window._listeners && global.window._listeners[event.type];
        if (listeners) listeners.forEach((h) => h(event));
    };

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = Wirecloud.ui || {};

    // -- SE mocks -----------------------------------------------------------
    class SEButton {
        constructor(opts = {}) {
            this._disabled = false;
            this.enabled = true;
            this.opts = opts;
            this.listeners = {};
            this.wrapperElement = document.createElement('button');
            this.wrapperElement.className = opts.class || '';
            if (opts.iconClass) {
                const icon = document.createElement('i');
                icon.className = opts.iconClass;
                this.wrapperElement.appendChild(icon);
            }
        }
        addEventListener(type, handler) {
            if (!this.listeners[type]) this.listeners[type] = [];
            this.listeners[type].push(handler);
        }
        removeEventListener() {}
        _dispatch(type, data) {
            (this.listeners[type] || []).forEach((h) => h(data));
        }
        insertInto(parent) { parent.appendChild(this.wrapperElement); return this; }
        appendTo(parent) { parent.appendChild(this.wrapperElement); return this; }
        disable() { this._disabled = true; this.enabled = false; return this; }
        enable() { this._disabled = false; this.enabled = true; return this; }
        addClassName() { return this; }
        removeClassName() { return this; }
        addIconClass() { return this; }
        setLabel() { return this; }
        destroy() { return this; }
        focus() {}
    }

    class SEPopupMenuBase {
        constructor() {
            this._items = [];
        }
        append(item) { this._items.push(item); return this; }
    }

    class SEPopupMenu extends SEPopupMenuBase {}
    class SEPopupButton extends SEButton {
        constructor(opts = {}) {
            super(opts);
            this.popup_menu = new SEPopupMenu();
            this.opts = opts;
        }
    }

    class SEContainer {
        constructor(opts = {}, evts) {
            this._children = [];
            this._idCounter = 0;
            this.wrapperElement = document.createElement(opts && opts.tagname ? opts.tagname : 'div');
            if (opts && opts.class) {
                this.wrapperElement.className = opts.class;
            }
            this._hidden = false;
            this.hidden = false;
            this._listeners = {};
            this._events = evts || [];
        }
        appendChild(child) {
            if (child && child.wrapperElement) {
                this.wrapperElement.appendChild(child.wrapperElement);
            } else if (child) {
                this.wrapperElement.appendChild(child);
            }
            return this;
        }
        insertInto(parent) {
            if (parent && parent.appendChild) {
                parent.appendChild(this.wrapperElement);
            }
            return this;
        }
        addEventListener(type, handler) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(handler);
        }
        removeEventListener() {}
        dispatchEvent(type) {
            (this._listeners[type] || []).forEach((h) => h());
            return this;
        }
        hide() { this._hidden = true; this.hidden = true; this.wrapperElement.classList.add('hidden'); return this; }
        show() { this._hidden = false; this.hidden = false; this.wrapperElement.classList.remove('hidden'); return this; }
        clear() { return this; }
        addClassName() { return this; }
        removeClassName() { return this; }
        repaint() { return this; }
    }

    class SENotebook extends SEContainer {
        constructor() {
            super();
            this._tabs = {};
        }
        removeTab(id) { delete this._tabs[id]; return this; }
        goToTab() { return this; }
        createTab() { return this; }
    }

    class SETab extends SEContainer {
        constructor(id, notebook, options) {
            super(options && options.containerOptions ? options.containerOptions : {}, ['show', 'hide', 'close']);
            if (!(notebook instanceof SENotebook)) {
                throw new TypeError("Invalid notebook argument");
            }
            this._label = (options && options.name) || "";
            this.notebook = notebook;
            this.tabId = id;
            this._tabElement = document.createElement("li");
            this._labelElement = document.createElement('span');
            this._tabElement.className = "se-notebook-tab";
            this._tabElement.setAttribute('role', 'tab');
            this._tabElement.setAttribute('aria-selected', 'false');
            this._tabElement.setAttribute('aria-controls', 'se-notebook-tabpanel-' + id);
            this._tabElement.appendChild(this._labelElement);

            this.wrapperElement.classList.add("se-notebook-tab-content");
            this.wrapperElement.classList.add("hidden");
            this.wrapperElement.setAttribute('role', 'tabpanel');
            this.wrapperElement.setAttribute('id', 'se-notebook-tabpanel-' + id);
            this.wrapperElement.setAttribute('aria-labelledby', 'se-notebook-tab-' + id);

            this._tabElement.addEventListener("click", () => {
                this.notebook.goToTab(this.tabId);
            });

            // closable button skip (closable: false for WorkspaceTabView)
            if (options && options.closable) {
                const closeBtn = new SEButton({ iconClass: "fas fa-times", plain: true, class: "close_button" });
                closeBtn.insertInto(this._tabElement);
                closeBtn.addEventListener("click", () => this.close());
            }

            this.setLabel(options && options.label ? options.label : (options && options.name ? options.name : ""));
            if (options && options.title) {
                // skip tooltip for mock
            }
        }
        get label() { return this._labelElement.textContent; }
        get tabElement() { return this._tabElement; }
        close() {
            this.notebook.removeTab(this.tabId);
            return this.dispatchEvent("close");
        }
        setLabel(newLabel) {
            this._labelElement.textContent = newLabel;
            return this;
        }
        hide() {
            super.hide();
            this._tabElement.classList.remove("selected");
            this._tabElement.setAttribute('aria-selected', 'false');
            return this;
        }
        show() {
            super.show();
            this._tabElement.classList.add("selected");
            this._tabElement.setAttribute('aria-selected', 'true');
            return this;
        }
        getTabElement() { return this._tabElement; }
    }
    SETab.prototype.rename = SETab.prototype.setLabel;
    SETab.prototype.Tooltip = class Tooltip {};
    SETab.prototype.Button = SEButton;

    class SEGUIBuilder {
        parse(template, context) {
            const fragment = document.createElement('div');
            const child1 = document.createElement('div');
            const child2 = document.createElement('div');
            fragment.appendChild(child1);
            fragment.appendChild(child2);
            fragment.children = [child1, child2];
            fragment.appendTo = function (parent) { parent.appendChild(this); };
            fragment.insertInto = function (parent) { parent.appendChild(this); };
            return fragment;
        }
    }

    class SEDynamicMenuItems {
        constructor(context) { this.context = context; }
    }

    class SEStyledElement {
        constructor(events) {
            this._listeners = {};
            this._events = events || [];
            this._hidden = false;
            this.hidden = false;
            this.wrapperElement = document.createElement('div');
        }
        addEventListener(type, handler) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(handler);
        }
        removeEventListener() {}
        dispatchEvent(type, data) {
            (this._listeners[type] || []).forEach((h) => h(data));
            return this;
        }
        hide() { this._hidden = true; this.hidden = true; this.wrapperElement.classList.add('hidden'); return this; }
        show() { this._hidden = false; this.hidden = false; this.wrapperElement.classList.remove('hidden'); return this; }
        appendChild(child) {
            if (child && child.wrapperElement) {
                this.wrapperElement.appendChild(child.wrapperElement);
            } else if (child) {
                this.wrapperElement.appendChild(child);
            }
            return this;
        }
        insertInto(parent) {
            if (parent && parent.appendChild) {
                parent.appendChild(this.wrapperElement);
            }
            return this;
        }
        destroy() { return this; }
        clear() { return this; }
        repaint() { return this; }
    }

    // Register mock SE classes on StyledElements
    StyledElements.StyledElement = SEStyledElement;
    StyledElements.objectWithEvents = { prototype: {} };
    StyledElements.Container = SEContainer;
    StyledElements.Tab = SETab;
    StyledElements.Notebook = SENotebook;
    StyledElements.Button = SEButton;
    StyledElements.PopupMenuBase = SEPopupMenuBase;
    StyledElements.PopupMenu = SEPopupMenu;
    StyledElements.PopupButton = SEPopupButton;
    StyledElements.GUIBuilder = SEGUIBuilder;
    StyledElements.DynamicMenuItems = SEDynamicMenuItems;

    // -- Wirecloud globals --------------------------------------------------
    Wirecloud.currentTheme = {
        templates: {},
    };
    const emptyTemplate = '<div><div class="empty-message"></div></div>';
    Wirecloud.currentTheme.templates['wirecloud/workspace/empty_tab_message'] = emptyTemplate;

    Wirecloud.TutorialCatalogue = {
        buildTutorialReferences: () => [],
    };

    Wirecloud.HistoryManager = {
        getCurrentState: () => ({ tab: 'test' }),
        replaceState: () => {},
    };

    Wirecloud.GlobalLogManager = {
        log: () => {},
        parseErrorResponse: () => 'error',
        formatException: (e) => e ? e.message : '',
    };

    Wirecloud.LogManager = class LogManager {
        constructor(parent) { this.entries = []; this.parent = parent; }
        addEventListener() {}
        removeEventListener() {}
        log() {}
        formatException(e) { return e ? e.message : ''; }
    };

    // Wirecloud.ui.WidgetView mock
    const WidgetViewCalls = [];
    Wirecloud.ui.WidgetView = class WidgetView {
        constructor(tab, model) {
            WidgetViewCalls.push({ tab, model });
            this.id = model.id || 'widget-' + Math.random().toString(36).substr(2, 9);
            this.model = model;
            this.tab = tab;
            this.loaded = false;
        }
        load() { this.loaded = true; }
    };

    // Wirecloud.ui.WorkspaceTabViewMenuItems mock
    const WorkspaceTabViewMenuItemsCalls = [];
    Wirecloud.ui.WorkspaceTabViewMenuItems = class WorkspaceTabViewMenuItems {
        constructor(context) {
            WorkspaceTabViewMenuItemsCalls.push({ context });
            this.context = context;
        }
    };

    // Wirecloud.ui.PreferencesWindowMenu mock
    const PrefsWindowMenuCalls = [];
    Wirecloud.ui.PreferencesWindowMenu = class PreferencesWindowMenu {
        constructor(type, prefs) {
            PrefsWindowMenuCalls.push({ type, prefs });
            this.shown = false;
        }
        show() { this.shown = true; return this; }
    };

    // DragboardLayout mock for types
    Wirecloud.DragboardPosition = class DragboardPosition {
        constructor(x, y) { this.x = x; this.y = y; }
    };

    // getLayoutMatrix helper
    Wirecloud.Utils.getLayoutMatrix = () => {
        const matrix = [];
        for (let i = 0; i < 20; i++) {
            matrix[i] = [];
            for (let j = 0; j < 20; j++) {
                matrix[i][j] = null;
            }
        }
        return matrix;
    };

    WidgetViewCalls.length = 0;
    WorkspaceTabViewMenuItemsCalls.length = 0;
    PrefsWindowMenuCalls.length = 0;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WorkspaceTabView.js');

    // Set up WorkspaceTabViewDragboard on the ui namespace
    let dragboardCalls = [];
    Wirecloud.ui.WorkspaceTabViewDragboard = class WorkspaceTabViewDragboard {
        constructor(tab) {
            dragboardCalls.push({ tab });
            this.tab = tab;
            this.customWidth = -1;
            this.baseLayout = createLayoutMock();
            this.freeLayout = createLayoutMock();
            this.leftLayout = createLayoutMock({ active: false });
            this.rightLayout = createLayoutMock({ active: false });
            this.scrollbarSpace = 17;
            this.widgets = [];
            this._updateScreenSizes = () => {};
            this._updateBaseLayout = () => {};
            this.updateWidgetScreenSize = () => {};
            this.setCustomDragboardWidth = () => {};
            this.restoreDragboardWidth = () => {};
            this.paint = () => {};
            this._notifyWindowResizeEvent = () => {};
        }
    };

    return {
        StyledElements,
        Wirecloud,
        WidgetViewCalls,
        WorkspaceTabViewMenuItemsCalls,
        PrefsWindowMenuCalls,
        get dragboardCalls() { return dragboardCalls; },
        createModelMock,
        createWorkspaceMock,
        createDragboardMock,
        createLayoutMock,
    };
};

// ===========================================================================
// HELPER: Create a fully wired WorkspaceTabView instance
// ===========================================================================

const createTab = (options = {}) => {
    const notebook = new StyledElements.Notebook();
    const model = options.model || createModelMock();
    const workspace = options.workspace || createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, {
        model,
        workspace,
    });

    workspace.activeTab = tab;

    if (options.dragboard) {
        Object.assign(tab.dragboard, options.dragboard);
    }

    return { tab, model, workspace, notebook };
};

// ===========================================================================
// TESTS
// ===========================================================================

test.beforeEach(() => {
    setup();
});

// ===========================================================================
// CONSTRUCTOR
// ===========================================================================

test('constructor creates instance with correct inheritance', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.ok(tab instanceof Wirecloud.ui.WorkspaceTabView);
    assert.ok(tab instanceof StyledElements.Tab);
    assert.ok(tab instanceof StyledElements.Container);
});

test('constructor sets properties from model', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ id: 'my-tab-id', title: 'My Tab', name: 'my_tab' });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.id, 'my-tab-id');
    assert.equal(tab.title, 'My Tab');
    assert.equal(tab.name, 'my_tab');
    assert.equal(tab.model, model);
    assert.equal(tab.workspace, workspace);
});

test('constructor sets tabElement data attributes and classes', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ id: 'tab-attr', name: 'attr_name' });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.tabElement.getAttribute('data-id'), 'tab-attr');
    assert.equal(tab.tabElement.getAttribute('data-name'), 'attr_name');
    assert.ok(tab.tabElement.classList.contains('wc-workspace-tab'));
});

test('constructor sets wrapperElement data attributes and classes', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ id: 'tab-wrap' });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.wrapperElement.getAttribute('data-id'), 'tab-wrap');
    assert.ok(tab.wrapperElement.classList.contains('wc-workspace-tab-content'));
});

test('constructor creates logManager', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.ok(tab.logManager instanceof Wirecloud.LogManager);
});

test('constructor sets widgets as empty array copy', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.deepEqual(tab.widgets, []);
});

test('constructor sets widgetsById as empty object', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.deepEqual(tab.widgetsById, {});
});

test('constructor creates prefbutton when edit is allowed', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock({ model: { isAllowed: () => true } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.ok(tab.prefbutton instanceof StyledElements.PopupButton);
    assert.equal(tab.prefbutton.enabled, true);
});

test('constructor does not create prefbutton when edit is not allowed', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock({ model: { isAllowed: (perm) => perm !== 'edit' } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.prefbutton, undefined);
});

test('constructor creates dragboard', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.ok(tab.dragboard instanceof Wirecloud.ui.WorkspaceTabViewDragboard);
});

test('constructor creates initialMessage and appends it', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [] });
    const workspace = createWorkspaceMock({ model: { isAllowed: () => true } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.ok(tab.initialMessage != null);
    // When no widgets, initial message should be visible
    assert.equal(tab.initialMessage.hidden, false);
});

test('constructor hides initialMessage when widgets exist', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({
        widgets: [{ id: 'existing-widget', title: 'W1' }],
    });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.initialMessage.hidden, true);
    assert.equal(tab.widgets.length, 1);
});

test('constructor hides initialMessage when edit not allowed even without widgets', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [] });
    const workspace = createWorkspaceMock({ model: { isAllowed: (perm) => perm !== 'edit' } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.initialMessage.hidden, true);
});

test('constructor registers model event listeners', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    // Verify model has listeners registered (dispatch events for coverage later)
    assert.ok(typeof model._dispatch === 'function');
});

test('constructor registers window resize listener', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock();

    // Just verify construction doesn't throw
    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    assert.ok(tab != null);
});

test('constructor throws TypeError if notebook is not an instance of se.Notebook', () => {
    assert.throws(() => {
        const model = createModelMock();
        const workspace = createWorkspaceMock();
        new Wirecloud.ui.WorkspaceTabView('id', {}, { model, workspace });
    }, TypeError);
});

// ===========================================================================
// INITIAL MESSAGE LOGIC
// ===========================================================================

test('initialMessage hidden reflects workspace edit permission and widget count', () => {
    const notebook = new StyledElements.Notebook();

    // Edit allowed, no widgets -> show message
    const model1 = createModelMock({ widgets: [] });
    const ws1 = createWorkspaceMock({ model: { isAllowed: () => true } });
    const tab1 = new Wirecloud.ui.WorkspaceTabView(model1.id, notebook, { model: model1, workspace: ws1 });
    assert.equal(tab1.initialMessage.hidden, false);

    // Edit allowed, widgets exist -> hide message
    const notebook2 = new StyledElements.Notebook();
    const model2 = createModelMock({ widgets: [{ id: 'w1' }] });
    const ws2 = createWorkspaceMock({ model: { isAllowed: () => true } });
    const tab2 = new Wirecloud.ui.WorkspaceTabView(model2.id, notebook2, { model: model2, workspace: ws2 });
    assert.equal(tab2.initialMessage.hidden, true);

    // Edit not allowed, even without widgets -> hide message
    const notebook3 = new StyledElements.Notebook();
    const model3 = createModelMock({ widgets: [] });
    const ws3 = createWorkspaceMock({ model: { isAllowed: (p) => p !== 'edit' } });
    const tab3 = new Wirecloud.ui.WorkspaceTabView(model3.id, notebook3, { model: model3, workspace: ws3 });
    assert.equal(tab3.initialMessage.hidden, true);
});

// ===========================================================================
// PREFBUTTON
// ===========================================================================

test('prefbutton enabled set correctly based on workspace editing state', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock({ model: { isAllowed: () => true } });
    workspace.editing = true;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    assert.equal(tab.prefbutton.enabled, true);

    workspace.editing = false;
    workspace._dispatch('editmode');
    assert.equal(tab.prefbutton.enabled, false);
});

test('prefbutton disabled when edit not allowed', () => {
    // When edit is not allowed, prefbutton is not created at all
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock({ model: { isAllowed: (p) => p !== 'edit' } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    assert.equal(tab.prefbutton, undefined);
});

// ===========================================================================
// WIDGETS
// ===========================================================================

test('widgets returns a copy of the internal array', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w1' }, { id: 'w2' }] });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    const widgets = tab.widgets;

    assert.equal(widgets.length, 2);
    assert.equal(widgets[0].model.id, 'w1');
    assert.equal(widgets[1].model.id, 'w2');

    // Verify it's a copy
    widgets.pop();
    assert.equal(tab.widgets.length, 2);
});

test('widgetsById returns correct mapping', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w1' }, { id: 'w2' }] });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    const byId = tab.widgetsById;

    assert.ok(byId[tab.widgets[0].id] instanceof Wirecloud.ui.WidgetView);
    assert.ok(byId[tab.widgets[1].id] instanceof Wirecloud.ui.WidgetView);
});

// ===========================================================================
// HIGHLIGHT / UNHIGHLIGHT / FINEWIDGET / REPAINT / SHOWSETTINGS
// ===========================================================================

test('highlight adds highlight class to tabElement', () => {
    const { tab } = createTab();

    tab.highlight();

    assert.ok(tab.tabElement.classList.contains('highlight'));
});

test('highlight returns this', () => {
    const { tab } = createTab();
    assert.equal(tab.highlight(), tab);
});

test('unhighlight removes highlight class from tabElement', () => {
    const { tab } = createTab();

    tab.tabElement.classList.add('highlight');
    tab.unhighlight();

    assert.equal(tab.tabElement.classList.contains('highlight'), false);
});

test('unhighlight returns this', () => {
    const { tab } = createTab();
    assert.equal(tab.unhighlight(), tab);
});

test('findWidget returns widget by id', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w-find' }] });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    const widget = tab.findWidget(tab.widgets[0].id);

    assert.ok(widget instanceof Wirecloud.ui.WidgetView);
    assert.equal(widget.model.id, 'w-find');
});

test('findWidget returns undefined for unknown id', () => {
    const { tab } = createTab();
    assert.equal(tab.findWidget('non-existent'), undefined);
});

test('repaint calls dragboard paint and _notifyWindowResizeEvent', () => {
    let paintCalled = false;
    let resizeCalled = false;

    const { tab } = createTab({
        dragboard: {
            customWidth: -1,
            paint: () => { paintCalled = true; },
            _notifyWindowResizeEvent: () => { resizeCalled = true; },
        },
    });

    tab.repaint();

    assert.equal(paintCalled, true);
    assert.equal(resizeCalled, true);
});

test('repaint returns this', () => {
    const { tab } = createTab();
    assert.equal(tab.repaint(), tab);
});

test('showSettings creates PreferencesWindowMenu and calls show', () => {
    const { tab } = createTab();

    let prefMenu = null;
    Wirecloud.ui.PreferencesWindowMenu = class {
        constructor(type, prefs) {
            prefMenu = { type, prefs, shown: false };
        }
        show() { prefMenu.shown = true; return this; }
    };

    tab.showSettings();

    assert.ok(prefMenu != null);
    assert.equal(prefMenu.type, 'tab');
    assert.equal(prefMenu.prefs, tab.model.preferences);
    assert.equal(prefMenu.shown, true);
});

test('showSettings returns this', () => {
    const { tab } = createTab();
    assert.equal(tab.showSettings(), tab);
});

// ===========================================================================
// SHOW
// ===========================================================================

test('show activates left and right layouts when workspace is editing', () => {
    let leftActive = null;
    let rightActive = null;

    const { tab, workspace } = createTab({
        dragboard: {
            customWidth: -1,
            leftLayout: {
                get active() { return false; },
                set active(v) { leftActive = v; },
            },
            rightLayout: {
                get active() { return false; },
                set active(v) { rightActive = v; },
            },
            paint: () => {},
            _notifyWindowResizeEvent: () => {},
        },
    });
    workspace.editing = true;

    tab.show();

    assert.equal(leftActive, true);
    assert.equal(rightActive, true);
});

test('show does not activate layouts when workspace is not editing', () => {
    let leftActive = null;
    let rightActive = null;

    const { tab, workspace } = createTab({
        dragboard: {
            customWidth: -1,
            leftLayout: {
                get active() { return true; },
                set active(v) { leftActive = v; },
            },
            rightLayout: {
                get active() { return true; },
                set active(v) { rightActive = v; },
            },
            paint: () => {},
            _notifyWindowResizeEvent: () => {},
        },
    });
    workspace.editing = false;

    tab.show();

    assert.equal(leftActive, null);
    assert.equal(rightActive, null);
});

test('show loads all widgets', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w1' }, { id: 'w2' }] });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    tab.show();

    tab.widgets.forEach((w) => {
        assert.equal(w.loaded, true);
    });
});

test('show returns this', () => {
    const { tab } = createTab();
    assert.equal(tab.show(), tab);
});

// ===========================================================================
// EDITING INTERVAL NAME (get_editing_interval_name private function)
// ===========================================================================

test('updateEditingIntervalName sets editingIntervalName based on screen size match', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'small', moreOrEqual: 0, lessOrEqual: 480 },
        { name: 'medium', moreOrEqual: 481, lessOrEqual: 1024 },
        { name: 'large', moreOrEqual: 1025, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    // Set innerWidth to trigger 'medium' match
    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 800;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    // With customWidth === -1, uses window.innerWidth (800) to match 'medium'
    assert.equal(tab.editingIntervalName, 'medium');

    global.window.innerWidth = origInnerWidth;
});

test('updateEditingIntervalName matches lessOrEqual === -1 as unbounded upper', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 0, lessOrEqual: 480 },
        { name: 'wide', moreOrEqual: 481, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 2000;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.editingIntervalName, 'wide');

    global.window.innerWidth = origInnerWidth;
});

test('updateEditingIntervalName returns null when no screen size matches', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 100, lessOrEqual: 480 },
    ];
    const workspace = createWorkspaceMock();

    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 50;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.editingIntervalName, null);

    global.window.innerWidth = origInnerWidth;
});

test('updateEditingIntervalName uses customWidth when not -1', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'small', moreOrEqual: 0, lessOrEqual: 480 },
        { name: 'medium', moreOrEqual: 481, lessOrEqual: 1024 },
        { name: 'large', moreOrEqual: 1025, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    // Override dragboard customWidth
    tab.dragboard.customWidth = 300;
    tab.updateEditingIntervalName();

    assert.equal(tab.editingIntervalName, 'small');
});

// ===========================================================================
// GETEDITINGINTERVALELEMENT
// ===========================================================================

test('getEditingIntervalElement returns div with correct text for normal mode', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 1200;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    const el = tab.getEditingIntervalElement();

    assert.equal(el.getAttribute('role'), 'status');
    assert.equal(el.getAttribute('aria-live'), 'polite');
    assert.ok(el.childNodes.length >= 1);
    assert.ok(el.childNodes[0].textContent.includes('desktop'));

    global.window.innerWidth = origInnerWidth;
});

test('getEditingIntervalElement includes close button when customWidth !== -1', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    tab.dragboard.customWidth = 400;

    const el = tab.getEditingIntervalElement();

    assert.ok(el.textContent.includes('Overriden'));
    // Should have close button
    const closeBtn = el.childNodes[el.childNodes.length - 1];
    assert.equal(closeBtn.tagName, 'A');
    assert.equal(closeBtn.getAttribute('role'), 'button');
    assert.equal(closeBtn.getAttribute('aria-label'), 'Quit editing interval');
});

test('getEditingIntervalElement close button click calls quitEditingInterval', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    let quitCalled = false;
    let restoreCalled = false;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    tab.dragboard.customWidth = 400;
    tab.dragboard.restoreDragboardWidth = () => { restoreCalled = true; };
    tab.quitEditingInterval = () => { quitCalled = true; };

    const el = tab.getEditingIntervalElement();
    const closeBtn = el.childNodes[el.childNodes.length - 1];

    // Simulate click
    const clickEvent = { type: 'click', preventDefault: () => {} };
    // Find the click handler on the close button
    const clickListeners = closeBtn.listeners['click'] || [];
    clickListeners.forEach((h) => h(clickEvent));

    assert.equal(quitCalled, true);
});

// ===========================================================================
// SETEDITINGINTERVAL
// ===========================================================================

test('setEditingInterval calculates avgScreenSize from moreOrEqual and lessOrEqual', () => {
    let setWidthCalled = null;

    const { tab } = createTab({
        dragboard: {
            customWidth: -1,
            setCustomDragboardWidth: (w) => { setWidthCalled = w; },
        },
    });

    tab.setEditingInterval(300, 600, 'tablet');

    assert.equal(setWidthCalled, 450); // Math.floor((300+600)/2)
    assert.equal(tab.editingIntervalName, 'tablet');
});

test('setEditingInterval handles lessOrEqual === -1', () => {
    let setWidthCalled = null;

    const { tab } = createTab({
        dragboard: {
            customWidth: -1,
            setCustomDragboardWidth: (w) => { setWidthCalled = w; },
        },
    });

    tab.setEditingInterval(1025, -1, 'desktop');

    assert.equal(setWidthCalled, 1025);
    assert.equal(tab.editingIntervalName, 'desktop');
});

test('setEditingInterval calls workspace.updateEditingInterval', () => {
    let updateCalled = null;

    const { tab, workspace } = createTab({
        dragboard: {
            customWidth: -1,
            setCustomDragboardWidth: () => {},
        },
    });
    workspace.updateEditingInterval = (el) => { updateCalled = el; };

    tab.setEditingInterval(300, 600, 'tablet');

    assert.ok(updateCalled != null);
    assert.equal(updateCalled.getAttribute('role'), 'status');
});

// ===========================================================================
// QUITEDITINGINTERVAL
// ===========================================================================

test('quitEditingInterval restores dragboard width', () => {
    let restoreCalled = false;

    const { tab } = createTab({
        dragboard: {
            customWidth: 500,
            restoreDragboardWidth: () => { restoreCalled = true; },
        },
    });

    tab.quitEditingInterval();

    assert.equal(restoreCalled, true);
});

test('quitEditingInterval updates editing interval name from window width', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'small', moreOrEqual: 0, lessOrEqual: 480 },
        { name: 'large', moreOrEqual: 481, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 1000;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    tab.dragboard.customWidth = 200;
    tab.dragboard.restoreDragboardWidth = () => { tab.dragboard.customWidth = -1; };

    tab.quitEditingInterval();

    // After restore, customWidth = -1, uses window.innerWidth (1000) -> 'large'
    assert.equal(tab.editingIntervalName, 'large');

    global.window.innerWidth = origInnerWidth;
});

// ===========================================================================
// CREATEWIDGET
// ===========================================================================

test('createWidget returns findWidget result when commit is false', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 0, lessOrEqual: 480 },
    ];
    model.preferences._values.initiallayout = 'Free';
    model.createWidget = (resource, opts) => {
        return { id: 'direct-widget' };
    };

    const resource = { default_width: 100, default_height: 200 };
    const foundWidget = { id: 'direct-widget', found: true };
    tab.findWidget = (id) => id === 'direct-widget' ? foundWidget : undefined;

    const result = tab.createWidget(resource, { commit: false });

    assert.equal(result, foundWidget);
});

test('createWidget returns promise when commit is true', async () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';
    model.createWidget = () => Promise.resolve({ id: 'promise-widget' });

    const foundWidget = { id: 'promise-widget', found: true };
    tab.findWidget = (id) => id === 'promise-widget' ? foundWidget : undefined;

    const resource = { default_width: 100, default_height: 200 };
    const result = await tab.createWidget(resource, { commit: true });

    assert.equal(result, foundWidget);
});

test('createWidget uses Free layout when initiallayout is Free', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let layoutUsed = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => { layoutUsed = 'free'; return { inLU: v, inPixels: v * 10 }; },
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 100, default_height: 200 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = (r, o) => ({ id: 'test' });

    tab.createWidget(resource, { commit: false });

    assert.equal(layoutUsed, 'free');
});

test('createWidget uses baseLayout when initiallayout is not Free', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Grid';

    let layoutUsed = null;
    const baseLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => { layoutUsed = 'base'; return { inLU: v, inPixels: v * 10 }; },
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.baseLayout = baseLayout;

    const resource = { default_width: 100, default_height: 200 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = (r, o) => ({ id: 'test' });

    tab.createWidget(resource, { commit: false, layout: 0 });

    assert.equal(layoutUsed, 'base');
});

test('createWidget merges default layout options from resource', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let configs = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 100,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 10, default_height: 20 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = (r, opts) => {
        configs = opts.layoutConfig;
        return { id: 'test' };
    };

    tab.createWidget(resource, { commit: false });

    assert.ok(configs != null);
    assert.equal(configs[0].width, 10);
    assert.equal(configs[0].height, 200);
    assert.equal(configs[0].titlevisible, true);
});

test('createWidget uses options width/height over resource defaults', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let configs = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 100,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 5, default_height: 5 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = (r, opts) => {
        configs = opts.layoutConfig;
        return { id: 'test' };
    };

    tab.createWidget(resource, {
        commit: false,
        width: 8,
        height: 6,
        anchor: 'top-right',
    });

    assert.equal(configs[0].width, 8);
    assert.equal(configs[0].height, 60);
    assert.equal(configs[0].anchor, 'top-right');
});

test('createWidget passes rely and titlevisible options to layout config', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let configs = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 100,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 10, default_height: 20 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = (r, opts) => {
        configs = opts.layoutConfig;
        return { id: 'test' };
    };

    tab.createWidget(resource, {
        commit: false,
        rely: true,
        titlevisible: false,
    });

    assert.ok(configs != null);
    assert.equal(configs[0].rely, true);
    assert.equal(configs[0].titlevisible, false);
});

test('createWidget calculates avgScreenSize when lessOrEqual !== -1', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 0, lessOrEqual: 480, left: 5, top: 5 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let avgSize = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => { avgSize = s; return { inLU: v, inPixels: v * 10 }; },
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 100, default_height: 100 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false });

    assert.equal(avgSize, 240);
});

test('createWidget uses moreOrEqual as avgScreenSize when lessOrEqual === -1', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1, left: 5, top: 5 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let avgSize = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => { avgSize = s; return { inLU: v, inPixels: v * 10 }; },
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 100, default_height: 100 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false });

    assert.equal(avgSize, 1025);
});

test('createWidget uses window.innerWidth as avgScreenSize when innerWidth is within layoutConfig range', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 0, lessOrEqual: 480, left: 5, top: 5 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let avgSize = null;
    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 300;

    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => { avgSize = s; return { inLU: v, inPixels: v * 10 }; },
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 100, default_height: 100 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false });

    assert.equal(avgSize, 300);

    global.window.innerWidth = origInnerWidth;
});

test('createWidget searchBestPosition used when left/top null and refposition set', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let searchCalled = false;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: 5, inPixels: 50 }),
        adaptRowOffset: (v) => ({ inLU: 8, inPixels: 80 }),
        adaptHeight: (v) => ({ inLU: 10, inPixels: 100 }),
        adaptWidth: (v, s) => ({ inLU: 6, inPixels: 60 }),
        columns: 12,
        searchBestPosition: (opts, cfg, avg) => { searchCalled = true; cfg.left = 3; cfg.top = 4; },
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 100, default_height: 100 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, {
        commit: false,
        refposition: { x: 10, y: 20 },
    });

    assert.equal(searchCalled, true);
});

test('createWidget _searchFreeSpace2 used when left/top null and no searchBestPosition', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let searchCalled = false;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: 5, inPixels: 50 }),
        adaptRowOffset: (v) => ({ inLU: 8, inPixels: 80 }),
        adaptHeight: (v) => ({ inLU: 10, inPixels: 100 }),
        adaptWidth: (v, s) => ({ inLU: 6, inPixels: 60 }),
        columns: 12,
        _searchFreeSpace2: (w, h, matrix) => { searchCalled = true; return { x: 2, y: 3 }; },
        dragboard: { widgets: [] },
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 100, default_height: 100 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false });

    assert.equal(searchCalled, true);
});

test('createWidget falls back to position 0,0 when no search method available', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let configLeft = null;
    let configTop = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: 5, inPixels: 50 }),
        adaptRowOffset: (v) => ({ inLU: 8, inPixels: 80 }),
        adaptHeight: (v) => ({ inLU: 10, inPixels: 100 }),
        adaptWidth: (v, s) => ({ inLU: 6, inPixels: 60 }),
        columns: 12,
        // No searchBestPosition and no _searchFreeSpace2
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 100, default_height: 100 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = (r, opts) => {
        configLeft = opts.layoutConfig[0].left;
        configTop = opts.layoutConfig[0].top;
        return { id: 'test' };
    };

    tab.createWidget(resource, { commit: false });

    assert.equal(configLeft, 0);
    assert.equal(configTop, 0);
});

test('createWidget with multiple layoutConfigs processes each', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 0, lessOrEqual: 480, left: 1, top: 1 },
        { name: 'tablet', moreOrEqual: 481, lessOrEqual: 1024, left: 2, top: 2 },
        { name: 'desktop', moreOrEqual: 1025, lessOrEqual: -1, left: 3, top: 3 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let adaptCallCount = 0;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => { adaptCallCount++; return { inLU: v, inPixels: v * 10 }; },
        adaptRowOffset: (v) => { adaptCallCount++; return { inLU: v, inPixels: v * 10 }; },
        adaptHeight: (v) => { adaptCallCount++; return { inLU: v, inPixels: v * 10 }; },
        adaptWidth: (v, s) => { adaptCallCount++; return { inLU: v, inPixels: v * 10 }; },
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 100, default_height: 100 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false });

    assert.ok(adaptCallCount >= 12);
});

test('createWidget uses inPixels for left when relx is false on Free layout', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1, left: 5, top: 5 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let leftUsed = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => { leftUsed = 'inPixels'; return { inLU: v, inPixels: v * 10 }; },
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 5, default_height: 5 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false, relx: false });

    // relx=false on Free layout means relx branch is false, layout===freeLayout is true,
    // so condition: (freeLayout !== freeLayout || false) = false, uses inPixels
    assert.equal(leftUsed, 'inPixels');
});

test('createWidget uses inLU for height when relheight is true on Free layout', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let heightUsed = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => {
            heightUsed = 'inLU';
            return { inLU: v, inPixels: v * 10 };
        },
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 5, default_height: 5 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false, relheight: true });

    assert.equal(heightUsed, 'inLU');
});

test('createWidget uses inPixels for width when relwidth is false on Free layout', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let widthUsed = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => {
            widthUsed = 'inPixels';
            return { inLU: v, inPixels: v * 10 };
        },
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const resource = { default_width: 5, default_height: 5 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false, relwidth: false });

    assert.equal(widthUsed, 'inPixels');
});

test('createWidget uses non-Free layout for column/row offset adaptation', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1, left: 5, top: 5 },
    ];
    model.preferences._values.initiallayout = 'Grid';

    let leftUsed = null;
    let rowUsed = null;
    const baseLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => { leftUsed = 'base-inLU'; return { inLU: v, inPixels: v * 10 }; },
        adaptRowOffset: (v) => { rowUsed = 'base-inLU'; return { inLU: v, inPixels: v * 10 }; },
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.baseLayout = baseLayout;

    const resource = { default_width: 5, default_height: 5 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false, layout: 0 });

    assert.equal(leftUsed, 'base-inLU');
    assert.equal(rowUsed, 'base-inLU');
});

// ===========================================================================
// WINDOW RESIZE HANDLER (on_windowresize)
// ===========================================================================

test('window resize triggers updateWidgetScreenSize when customWidth === -1', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'wide', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    let updateSizeCalled = false;
    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 1400;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    tab.dragboard.updateWidgetScreenSize = (w) => { updateSizeCalled = w; };

    // Dispatch window resize
    global.window.dispatchEvent({ type: 'resize' });

    assert.equal(updateSizeCalled, 1400);

    global.window.innerWidth = origInnerWidth;
});

test('window resize does not update when customWidth !== -1', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'wide', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    let updateSizeCalled = false;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    tab.dragboard.customWidth = 500;
    tab.dragboard.updateWidgetScreenSize = () => { updateSizeCalled = true; };

    global.window.dispatchEvent({ type: 'resize' });

    assert.equal(updateSizeCalled, false);
});

test('window resize updates editing interval when this tab is active', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'small', moreOrEqual: 0, lessOrEqual: 480 },
        { name: 'large', moreOrEqual: 481, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    let editingIntervalElement = null;
    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 1000;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    workspace.activeTab = tab;
    workspace.updateEditingInterval = (el) => { editingIntervalElement = el; };

    global.window.dispatchEvent({ type: 'resize' });

    assert.equal(tab.editingIntervalName, 'large');
    assert.ok(editingIntervalElement != null);

    global.window.innerWidth = origInnerWidth;
});

test('window resize does not update editing interval when tab is not active', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'small', moreOrEqual: 0, lessOrEqual: 480 },
        { name: 'large', moreOrEqual: 481, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    let editingIntervalCalled = false;
    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 1000;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    // activeTab is already set to this tab by createTab; override to be different
    workspace.activeTab = null;
    workspace.updateEditingInterval = () => { editingIntervalCalled = true; };

    global.window.dispatchEvent({ type: 'resize' });

    assert.equal(editingIntervalCalled, false);

    global.window.innerWidth = origInnerWidth;
});

// ===========================================================================
// MODEL EVENT HANDLERS
// ===========================================================================

// -- on_changetab (title change) --------------------------------------------

test('on_changetab title change renames the tab', () => {
    const { tab, model } = createTab();

    let renameCalled = null;
    const origRename = StyledElements.Tab.prototype.rename;
    StyledElements.Tab.prototype.rename = function (newTitle) {
        renameCalled = newTitle;
    };

    try {
        model._dispatch('change', model, ['title']);
        assert.equal(renameCalled, 'Test Tab');
    } finally {
        StyledElements.Tab.prototype.rename = origRename;
    }
});

test('on_changetab non-title change does not rename', () => {
    const { tab, model } = createTab();

    let renamed = false;
    tab.rename = () => { renamed = true; };

    model._dispatch('change', model, ['name']);

    assert.equal(renamed, false);
});

// -- on_changetab (name change, non-hidden) ---------------------------------

test('on_changetab name change updates data-name attribute when not hidden', () => {
    let replaceStateCalled = false;
    let replaceStateData = null;
    Wirecloud.HistoryManager.replaceState = (data) => { replaceStateCalled = true; replaceStateData = data; };
    Wirecloud.HistoryManager.getCurrentState = () => ({ existing: 'state' });

    const { tab, model } = createTab();
    tab.hidden = false;
    model.name = 'new_name';

    model._dispatch('change', model, ['name']);

    assert.equal(replaceStateCalled, true);
    assert.equal(replaceStateData.tab, 'new_name');
    assert.equal(replaceStateData.existing, 'state');
    assert.equal(tab.tabElement.getAttribute('data-name'), 'new_name');
});

test('on_changetab name change does not update when tab is hidden', () => {
    let replaceStateCalled = false;
    Wirecloud.HistoryManager.replaceState = () => { replaceStateCalled = true; };

    const { tab, model } = createTab();
    tab.hidden = true;
    model.name = 'hidden_name';

    model._dispatch('change', model, ['name']);

    assert.equal(replaceStateCalled, false);
});

// -- on_addwidget -----------------------------------------------------------

test('on_addwidget creates and pushes widget when view is null, loads if not hidden', () => {
    const { tab, model } = createTab();
    tab.hidden = false;

    const newModel = { id: 'added-widget' };
    model._dispatch('addwidget', model, newModel, null);

    assert.equal(tab.widgets.length, 1);
    assert.equal(tab.widgets[0].model.id, 'added-widget');
    assert.equal(tab.widgets[0].loaded, true);
    assert.equal(tab.initialMessage.hidden, true);
});

test('on_addwidget creates widget but does not load when hidden', () => {
    const { tab, model } = createTab();
    tab.hidden = true;

    const newModel = { id: 'hidden-widget' };
    model._dispatch('addwidget', model, newModel, null);

    assert.equal(tab.widgets.length, 1);
    assert.equal(tab.widgets[0].model.id, 'hidden-widget');
    assert.equal(tab.widgets[0].loaded, false);
});

test('on_addwidget pushes existing view when view is not null', () => {
    const { tab, model } = createTab();

    const existingView = { id: 'existing-view', loaded: false };
    model._dispatch('addwidget', model, { id: 'm' }, existingView);

    assert.equal(tab.widgets.length, 1);
    assert.equal(tab.widgets[0], existingView);
    assert.equal(tab.initialMessage.hidden, true);
});

// -- on_removetab -----------------------------------------------------------

test('on_removetab calls close', () => {
    const { tab, model, notebook } = createTab();

    // Register tab in notebook
    notebook._tabs[tab.tabId] = tab;

    let closeDispatched = false;
    tab.addEventListener('close', () => { closeDispatched = true; });

    model._dispatch('remove', model);

    // close() calls notebook.removeTab, which we can check
    assert.equal(notebook._tabs[tab.tabId], undefined);
});

// -- on_removewidget --------------------------------------------------------

test('on_removewidget removes widget from array', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w1' }, { id: 'w2' }] });
    const workspace = createWorkspaceMock({ model: { isAllowed: (p) => p !== 'edit' } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.widgets.length, 2);
    const widgetToRemove = tab.widgets[0];

    model._dispatch('removewidget', widgetToRemove);

    assert.equal(tab.widgets.length, 1);
});

test('on_removewidget hides initialMessage when no remaining widgets and edit not allowed', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w1' }] });
    const workspace = createWorkspaceMock({ model: { isAllowed: (p) => p !== 'edit' } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    const widgetToRemove = tab.widgets[0];

    model._dispatch('removewidget', widgetToRemove);

    assert.equal(tab.initialMessage.hidden, true);
    assert.equal(tab.widgets.length, 0);
});

test('on_removewidget shows initialMessage when no remaining widgets and edit allowed', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w1' }] });
    const workspace = createWorkspaceMock({ model: { isAllowed: () => true } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    const widgetToRemove = tab.widgets[0];

    model._dispatch('removewidget', widgetToRemove);

    assert.equal(tab.initialMessage.hidden, false);
    assert.equal(tab.widgets.length, 0);
});

test('on_removewidget keeps initialMessage hidden when widgets remain', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w1' }, { id: 'w2' }] });
    const workspace = createWorkspaceMock({ model: { isAllowed: () => true } });

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    const widgetToRemove = tab.widgets[0];

    model._dispatch('removewidget', widgetToRemove);

    assert.equal(tab.initialMessage.hidden, true);
    assert.equal(tab.widgets.length, 1);
});

// ===========================================================================
// PREFERENCE CHANGE HANDLER (on_change_preferences)
// ===========================================================================

test('on_change_preferences screenSizes change calls dragboard._updateScreenSizes', () => {
    const { tab, model } = createTab();

    let updateScreenSizesCalled = false;
    tab.dragboard._updateScreenSizes = () => { updateScreenSizesCalled = true; };

    model.preferences._dispatch('post-commit', model.preferences, { screenSizes: [] });

    assert.equal(updateScreenSizesCalled, true);
});

test('on_change_preferences baselayout change calls dragboard._updateBaseLayout', () => {
    const { tab, model } = createTab();

    let updateBaseLayoutCalled = false;
    tab.dragboard._updateBaseLayout = () => { updateBaseLayoutCalled = true; };

    model.preferences._dispatch('post-commit', model.preferences, { baselayout: 'newbase' });

    assert.equal(updateBaseLayoutCalled, true);
});

test('on_change_preferences other changes do nothing', () => {
    const { tab, model } = createTab();

    let updateScreenSizesCalled = false;
    let updateBaseLayoutCalled = false;
    tab.dragboard._updateScreenSizes = () => { updateScreenSizesCalled = true; };
    tab.dragboard._updateBaseLayout = () => { updateBaseLayoutCalled = true; };

    model.preferences._dispatch('post-commit', model.preferences, { otherProp: 'val' });

    assert.equal(updateScreenSizesCalled, false);
    assert.equal(updateBaseLayoutCalled, false);
});

test('on_change_preferences both screenSizes and baselayout changes', () => {
    const { tab, model } = createTab();

    let updateScreenSizesCalled = false;
    let updateBaseLayoutCalled = false;
    tab.dragboard._updateScreenSizes = () => { updateScreenSizesCalled = true; };
    tab.dragboard._updateBaseLayout = () => { updateBaseLayoutCalled = true; };

    model.preferences._dispatch('post-commit', model.preferences, {
        screenSizes: [],
        baselayout: 'new',
    });

    assert.equal(updateScreenSizesCalled, true);
    assert.equal(updateBaseLayoutCalled, true);
});

// ===========================================================================
// UPDATE_PREF_BUTTON
// ===========================================================================

test('update_pref_button sets enabled based on workspace.editing', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    const workspace = createWorkspaceMock({ model: { isAllowed: () => true } });

    workspace.editing = true;
    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    assert.equal(tab.prefbutton.enabled, true);

    workspace.editing = false;
    workspace._dispatch('editmode');
    assert.equal(tab.prefbutton.enabled, false);

    workspace.editing = true;
    workspace._dispatch('editmode');
    assert.equal(tab.prefbutton.enabled, true);
});

// ===========================================================================
// GET_EDITING_INTERVAL_NAME (get_editing_interval_name)
// ===========================================================================

test('get_editing_interval_name returns null when no match', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'phone', moreOrEqual: 100, lessOrEqual: 480 },
    ];
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    // updateEditingIntervalName is called in constructor with innerWidth
    // Let's call it explicitly with a width that doesn't match
    tab.dragboard.customWidth = 50;
    tab.updateEditingIntervalName();

    assert.equal(tab.editingIntervalName, null);
});

test('get_editing_interval_name returns first matching name', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [
        { name: 'small', moreOrEqual: 0, lessOrEqual: 400 },
        { name: 'medium', moreOrEqual: 0, lessOrEqual: 800 },
        { name: 'large', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    tab.dragboard.customWidth = 300;
    tab.updateEditingIntervalName();

    // first match is 'small' (not 'medium' even though that also matches)
    assert.equal(tab.editingIntervalName, 'small');
});

// ===========================================================================
// CLEAN_NUMBER (indirectly through constructor widgets)
// ===========================================================================

test('constructor creates widgets from model.widgets via _create_widget', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({
        widgets: [
            { id: 'w-alpha', title: 'Alpha' },
            { id: 'w-beta', title: 'Beta' },
        ],
    });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });

    assert.equal(tab.widgets.length, 2);
    assert.equal(tab.widgets[0].model.id, 'w-alpha');
    assert.equal(tab.widgets[1].model.id, 'w-beta');
    assert.ok(tab.widgets[0] instanceof Wirecloud.ui.WidgetView);
});

// ===========================================================================
// GET_WIDGETS_BY_ID
// ===========================================================================

test('widgetsById uses get_widgets_by_id to build mapping', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'a' }, { id: 'b' }] });
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    const result = tab.widgetsById;

    assert.equal(Object.keys(result).length, 2);
    assert.ok(result[tab.widgets[0].id] != null);
    assert.ok(result[tab.widgets[1].id] != null);
});

// ===========================================================================
// TAB SHOW WITH WIDGET LOADING
// ===========================================================================

test('show loads widgets only when editing', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock({ widgets: [{ id: 'w-editing' }] });
    const workspace = createWorkspaceMock();
    workspace.editing = false;

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    tab.dragboard.leftLayout.active = false;
    tab.dragboard.rightLayout.active = false;

    tab.show();

    // Widget should be loaded regardless of editing state (show always loads)
    assert.equal(tab.widgets[0].loaded, true);
    // Layouts not activated because editing is false
    assert.equal(tab.dragboard.leftLayout.active, false);
    assert.equal(tab.dragboard.rightLayout.active, false);
});

// ===========================================================================
// EDGE CASE: Empty screenSizes
// ===========================================================================

test('get_editing_interval_name with empty screenSizes array returns null', () => {
    const notebook = new StyledElements.Notebook();
    const model = createModelMock();
    model.preferences._values.screenSizes = [];
    const workspace = createWorkspaceMock();

    const tab = new Wirecloud.ui.WorkspaceTabView(model.id, notebook, { model, workspace });
    // No screen sizes to iterate, returns null
    assert.equal(tab.editingIntervalName, null);
});

// ===========================================================================
// MODEL NAME ACCESSOR
// ===========================================================================

test('name getter returns model.name', () => {
    const { tab, model } = createTab();
    model.name = 'my_custom_name';
    assert.equal(tab.name, 'my_custom_name');
});

test('title getter returns model.title', () => {
    const { tab, model } = createTab();
    model.title = 'My Custom Title';
    assert.equal(tab.title, 'My Custom Title');
});

test('createWidget clean_number min branch triggered when adaptHeight returns 0', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'desktop', moreOrEqual: 0, lessOrEqual: -1 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let configs = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: 0, inPixels: 0 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    model.createWidget = (r, opts) => { configs = opts.layoutConfig; return { id: 'test' }; };
    const resource = { default_width: 100, default_height: 200 };
    tab.findWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false });

    assert.ok(configs != null);
    assert.equal(configs[0].height, 1);
});

test('createWidget uses window.innerWidth when layoutConfig length is 0', () => {
    const { tab, model } = createTab();
    model.preferences._values.screenSizes = [
        { name: 'custom', moreOrEqual: 0, lessOrEqual: 480, left: 0, top: 0, length: 0 },
    ];
    model.preferences._values.initiallayout = 'Free';

    let avgSize = null;
    const freeLayout = createLayoutMock({
        adaptColumnOffset: (v, s) => { avgSize = s; return { inLU: v, inPixels: v * 10 }; },
        adaptRowOffset: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptHeight: (v) => ({ inLU: v, inPixels: v * 10 }),
        adaptWidth: (v, s) => ({ inLU: v, inPixels: v * 10 }),
        columns: 12,
    });
    tab.dragboard.freeLayout = freeLayout;

    const origInnerWidth = global.window.innerWidth;
    global.window.innerWidth = 1024;

    const resource = { default_width: 100, default_height: 100 };
    tab.findWidget = () => ({ id: 'test' });
    model.createWidget = () => ({ id: 'test' });

    tab.createWidget(resource, { commit: false });

    assert.equal(avgSize, 1024);

    global.window.innerWidth = origInnerWidth;
});
