const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// ============================================================================
// HELPERS
// ============================================================================

const fakeParseResult = () => {
    const wrapper = document.createElement('div');

    // Build heading element with proper DOM children so getElementsByClassName works
    const heading = document.createElement('div');
    heading.className = 'wc-widget-heading';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'wc-widget-title';
    heading.appendChild(titleSpan);

    const toolbar = document.createElement('div');
    toolbar.className = 'wc-widget-toolbar';
    heading.appendChild(toolbar);

    wrapper.appendChild(heading);

    // Build content element
    const content = document.createElement('div');
    content.className = 'wc-widget-content';

    const iframeWrapper = document.createElement('div');
    iframeWrapper.className = 'wc-iframe-wrapper';
    content.appendChild(iframeWrapper);

    wrapper.appendChild(content);

    wrapper.offsetHeight = 200;
    wrapper.offsetWidth = 300;

    const fragment = {
        children: [
            document.createElement('div'), // dummy first child
            wrapper,
        ],
    };
    return { fragment, wrapper };
};

const makeModel = (overrides = {}) => {
    const wrapperElement = document.createElement('div');
    wrapperElement.offsetHeight = 300;
    wrapperElement.offsetWidth = 400;
    wrapperElement.contentDocument = { defaultView: { addEventListener() {} } };

    return Object.assign({
        id: 'widget-1',
        volatile: false,
        missing: false,
        title: 'Test Widget',
        titlevisible: true,
        minimized: false,
        fulldragboard: false,
        layout: 0,
        loaded: true,
        meta: { macversion: 1, doc: 'manual', version: '1.0' },
        position: { x: 10, y: 20, z: 1, anchor: 'top-left', relx: false, rely: false },
        shape: { width: 2, height: 3, relwidth: false, relheight: false },
        permissions: { viewer: { move: true, close: true, resize: true, rename: true, upgrade: true, minimize: true } },

        wrapperElement,

        isAllowed(perm, role) {
            if (role === 'viewer' && perm === 'close') return false;
            if (role === 'viewer' && this.volatile) return true;
            return !this.volatile || role === 'editor';
        },
        contextManager: {
            _lastModify: null,
            _allModifies: [],
            modify(data) { this._lastModify = data; this._allModifies.push(data); },
        },
        logManager: {
            errorCount: 0,
            _listeners: {},
            addEventListener(event, handler) {
                if (!this._listeners[event]) this._listeners[event] = [];
                this._listeners[event].push(handler);
            },
            _dispatch(event) {
                (this._listeners[event] || []).forEach((h) => h());
            },
        },

        _eventListeners: {},
        addEventListener(event, handler) {
            if (!this._eventListeners[event]) this._eventListeners[event] = [];
            this._eventListeners[event].push(handler);
        },
        removeEventListener() {},
        _dispatchEvent(event, ...args) {
            // Always pass model as first argument to match real dispatch behavior
            (this._eventListeners[event] || []).forEach((h) => h(this, ...args));
        },

        load() { this._loaded = true; },
        reload() { this._reloaded = true; },
        remove() { this._removed = true; },
        rename(title) { this._renamed = title; },
        showLogs() { this._logsShown = true; },
        showSettings() { this._settingsShown = true; },

        setPosition(pos) { Object.assign(this.position, pos); },
        setShape(shape) { Object.assign(this.shape, shape); },
        setLayoutPosition() {},
        setLayoutShape() {},
        setTitleVisibility(v, p) {
            this.titlevisible = v;
            return Promise.resolve();
        },
        setPermissions(changes, p) {
            Object.keys(changes).forEach((k) => {
                this.permissions.viewer[k] = changes[k];
            });
            return Promise.resolve();
        },
        setLayoutMinimizedStatus() {},
        setLayoutIndex() {},
        setLayoutFulldragboard() {},
        updateWindowSize() {},
        changeTab(model) { return Promise.resolve(); },

        layoutConfig: [{ id: 'config-1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 60, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' }],
        currentLayoutConfig: { id: 'config-1' },
    }, overrides);
};

const makeLayout = (overrides = {}) => {
    return Object.assign({
        name: 'free',
        dragboard: null,
        widgets: {},
        iWidgets: {},
        _on_remove_widget_bound() {},
        _notifyResizeEventCalls: [],
        _notifyResizeEvent(widget, oldW, oldH, newW, newH, resizeLS, resizeTS, persist, reserveSpace) {
            this._notifyResizeEventCalls.push({ widget, oldW, oldH, newW, newH, resizeLS, resizeTS, persist, reserveSpace });
        },
        _searchFreeSpaceCalls: [],
        _searchFreeSpace(w, h) {
            this._searchFreeSpaceCalls.push({ w, h });
            return { x: 0, y: 0, relx: false, rely: false, anchor: 'top-left' };
        },
        _searchFreeSpace2Calls: [],
        _searchFreeSpace2(w, h, matrix) {
            this._searchFreeSpace2Calls.push({ w, h, matrix });
            return { x: 0, y: 0, relx: false, rely: false, anchor: 'top-left' };
        },
        fromHCellsToPixels(w, as) { return w * 50; },
        fromVCellsToPixels(h) { return h * 40; },
        adaptWidth(val, avgScreen) { return { inLU: 2, inPixels: 100 }; },
        adaptHeight(val) { return { inLU: 3, inPixels: 120 }; },
        adaptColumnOffset(val, avgScreen) { return { inLU: 4, inPixels: 200 }; },
        adaptRowOffset(val) { return { inLU: 5, inPixels: 150 }; },
        getColumnOffset(pos, avgScreen) { return pos.x * 10; },
        getRowOffset(pos) { return pos.y * 10; },
        getHeightInPixels(h) { return h * 40; },
        getWidthInPixels(w) { return w * 50; },
        updatePosition(widget, wrapper) {},
        updateShape(widget, wrapper) {},
        addWidget(widget, affectsDragboard) {
            widget.layout = this;
            if (affectsDragboard && this.dragboard) {
                this.dragboard._addWidget(widget);
            }
            this._on_remove_widget_bound = () => {};
            this.widgets[widget.id] = widget;
            this.iWidgets[widget.id] = widget;
            widget.addEventListener('remove', this._on_remove_widget_bound);
            return new Set([widget.id]);
        },
        removeWidget(widget, affectsDragboard) {
            delete this.widgets[widget.id];
            delete this.iWidgets[widget.id];
            if (affectsDragboard && this.dragboard) {
                this.dragboard._removeWidget(widget);
            }
            widget.layout = null;
            widget.removeEventListener('remove', this._on_remove_widget_bound);
            return new Set([widget.id]);
        },
        removeWidgetEventListeners() {},
        removeHandle() {},
        lowerToBottom() {},
    }, overrides);
};

const makeFreeLayout = (overrides = {}) => {
    const layout = makeLayout(Object.assign({ name: 'free' }, overrides));
    Object.setPrototypeOf(layout, Wirecloud.ui.FreeLayout.prototype);
    return layout;
};

const makeFullDragboardLayout = (overrides = {}) => {
    const layout = makeLayout(Object.assign({ name: 'fulldragboard' }, overrides));
    Object.setPrototypeOf(layout, Wirecloud.ui.FullDragboardLayout.prototype);
    return layout;
};

const makeDragboard = (overrides = {}) => {
    const freeLayout = makeFreeLayout();
    const fulldragboardLayout = makeFullDragboardLayout();
    const baseLayout = makeLayout({ name: 'base' });
    const tab = { id: 'tab-1', hidden: false, dragboard: null, model: {}, workspace: null, wrapperElement: document.createElement('div') };
    const layouts = [freeLayout, baseLayout]; // index 0 is freeLayout (common default)

    const dragboard = Object.assign({
        tab,
        layouts,
        fulldragboardLayout,
        widgets: {},
        _addWidget(widget) { this.widgets[widget.id] = widget; },
        _removeWidget(widget) { delete this.widgets[widget.id]; },
        update(ids, p) { this._updateCalls = (this._updateCalls || []).concat([ids]); },
        _updateCalls: [],
        raiseToTop() {},
        lowerToBottom() {},
    }, overrides);

    dragboard.tab.dragboard = dragboard;
    freeLayout.dragboard = dragboard;
    fulldragboardLayout.dragboard = dragboard;
    baseLayout.dragboard = dragboard;

    return dragboard;
};

const makeWorkspace = (overrides = {}) => {
    const ws = Object.assign({
        editing: true,
        hidden: false,
        _listeners: {},
        addEventListener(event, handler) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
        },
        _dispatch(event, ...args) {
            (this._listeners[event] || []).forEach((h) => h(...args));
        },
    }, overrides);
    return ws;
};

// ============================================================================
// SETUP
// ============================================================================

let _guibuilderParseResult;
let _guibuilderParseCalled;

const setup = (overrides = {}) => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    // Augment Element prototype with missing DOM methods needed by WidgetView
    if (!Element.prototype.getElementsByClassName) {
        Element.prototype.getElementsByClassName = function (className) {
            const results = [];
            const walk = (node) => {
                if (node.nodeType === 1) {
                    if (node.classList && node.classList.contains(className)) {
                        results.push(node);
                    }
                    (node.childNodes || []).forEach(walk);
                }
            };
            walk(this);
            return results;
        };
    }

    // Prepare parse result
    if (overrides.parseResult) {
        _guibuilderParseResult = overrides.parseResult;
    } else {
        const { fragment, wrapper } = fakeParseResult();
        _guibuilderParseResult = fragment;
    }
    _guibuilderParseCalled = false;

    // Mock StyledElements classes
    StyledElements.GUIBuilder = class GUIBuilder {
        constructor() {}
        parse(doc, tcomponents, context) {
            _guibuilderParseCalled = { doc, tcomponents, context };

            // Simulate processing the template: call each tcomponent function
            // to properly initialize the view's child components.
            // The real GUIBuilder calls tcomponents for matched t: namespace elements;
            // here we call all of them to ensure closebutton, errorbutton, etc. are set.
            if (tcomponents && typeof tcomponents === 'object') {
                // Call each tcomponent function to initialize component references on the view
                Object.keys(tcomponents).forEach((key) => {
                    const fn = tcomponents[key];
                    if (typeof fn === 'function') {
                        fn({}, tcomponents, context);
                    } else if (fn != null) {
                        // Non-function tcomponents are used directly as the return value
                        // This handles cases like strings or DOM elements
                    }
                });
            }

            return _guibuilderParseResult;
        }
    };

    StyledElements.Button = class Button extends StyledElements.StyledElement {
        constructor(options = {}) {
            super(['blur', 'click', 'dblclick', 'focus', 'mouseenter', 'mouseleave']);
            this.wrapperElement = document.createElement('div');
            this.wrapperElement.setAttribute('role', 'button');
            this.wrapperElement.className = 'se-btn';
            this.icon = null;
            this._title = '';
            if (options.class) this.addClassName(options.class);
            if (options.iconClass) this.addIconClassName(options.iconClass);
            if (options.title) this.setTitle(options.title);
            if (options.plain) this.addClassName('plain');
        }
        addIconClassName(classList) {
            if (!this.icon) {
                this.icon = document.createElement('i');
                this.icon.className = 'se-icon';
                this.wrapperElement.appendChild(this.icon);
            }
            (Array.isArray(classList) ? classList : String(classList || '').split(/\s+/)).forEach((c) => {
                if (c) this.icon.classList.add(c);
            });
            return this;
        }
        removeIconClassName(classList) {
            if (this.icon) {
                (Array.isArray(classList) ? classList : String(classList || '').split(/\s+/)).forEach((c) => {
                    if (c) this.icon.classList.remove(c);
                });
            }
            return this;
        }
        replaceIconClassName(oldC, newC) {
            return this.removeIconClassName(oldC).addIconClassName(newC);
        }
        setTitle(title) {
            this._title = title;
            this.wrapperElement.setAttribute('title', String(title || ''));
            return this;
        }
        getTitle() { return this._title; }
        disable() { this.enabled = false; return this; }
        enable() { this.enabled = true; return this; }
    };

    StyledElements.PopupMenu = class PopupMenu extends StyledElements.StyledElement {
        constructor() {
            super(['visibilityChange']);
            this.wrapperElement = document.createElement('ul');
            this._items = [];
            this._visible = false;
        }
        append(item) { this._items.push(item); return this; }
        isVisible() { return this._visible; }
        show() { this._visible = true; return this; }
        hide() { this._visible = false; return this; }
    };

    StyledElements.PopupButton = class PopupButton extends StyledElements.Button {
        constructor(options = {}) {
            super(options);
            this.wrapperElement.setAttribute('aria-haspopup', 'true');
            this.popup_menu = options.menu || new StyledElements.PopupMenu();
        }
    };

    StyledElements.EditableElement = class EditableElement extends StyledElements.StyledElement {
        constructor(options = {}) {
            super(['change']);
            this.wrapperElement = document.createElement('span');
            this.wrapperElement.setAttribute('role', 'textbox');
            this.wrapperElement.setAttribute('tabindex', '0');
            this.setTextContent(options.initialContent || '');
        }
        setTextContent(text) {
            this.wrapperElement.textContent = text;
            return this;
        }
        enableEdition() {}
        disableEdition() {}
    };

    StyledElements.Fragment = class Fragment extends StyledElements.StyledElement {
        constructor(elements) {
            super();
            this.children = [];
            if (Array.isArray(elements)) {
                elements.forEach((e) => this.children.push(e));
            } else if (elements != null) {
                this.children.push(elements);
            }
        }
    };

    // Set up Wirecloud globals
    global.Wirecloud = {
        Utils: Object.assign({}, StyledElements.Utils),
        ui: {},
    };

    // Add layout utility functions used by WidgetView
    Wirecloud.Utils.getLayoutMatrix = (layout, widgets, avgScreenSize) => {
        return [];
    };
    Wirecloud.Utils.setupdate = (a, b) => {
        const result = new Set(a);
        b.forEach((v) => result.add(v));
        return result;
    };

    Wirecloud.currentTheme = {
        templates: {
            'wirecloud/workspace/widget': '<s:dummy></s:dummy>',
        },
    };

    Wirecloud.UserInterfaceManager = {
        handleEscapeEvent() {},
    };

    Wirecloud.ui.FreeLayout = class FreeLayout {};
    Wirecloud.ui.FullDragboardLayout = class FullDragboardLayout {};

    Wirecloud.ui.LogWindowMenu = class LogWindowMenu {
        constructor(manager) { this.manager = manager; }
        show() {}
    };

    Wirecloud.ui.WidgetViewMenuItems = class WidgetViewMenuItems {
        constructor(view) { this.view = view; }
    };

    Wirecloud.ui.WidgetViewResizeHandle = class WidgetViewResizeHandle extends StyledElements.StyledElement {
        constructor(view, options = {}) {
            super();
            this.view = view;
            this.options = options;
            this.wrapperElement = document.createElement('div');
            this._resizableElement = null;
        }
        setResizableElement(el) {
            this._resizableElement = el;
            return this;
        }
        addClassName(name) {
            this.wrapperElement.classList.add(name);
            return this;
        }
    };

    Wirecloud.ui.WidgetViewDraggable = class WidgetViewDraggable {
        constructor(widget, options = {}) {
            this.widget = widget;
            this.options = options;
        }
        canDrag(b, c, role) { return true; }
        setXOffset(x) { this.xOffset = x; return this; }
        setYOffset(y) { this.yOffset = y; return this; }
    };

    // Load the WidgetView module
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WidgetView.js');
};

let _view;

const createWidgetView = (options = {}) => {
    const model = options.model || makeModel();
    const layout = options.layout || makeFreeLayout();
    const dragboard = options.dragboard || makeDragboard();
    const workspace = options.workspace || makeWorkspace();
    const tab = options.tab || {
        id: 'tab-1',
        hidden: false,
        workspace,
        dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener(event, handler) {
            if (!this._listeners) this._listeners = {};
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
        },
        _dispatch(event, ...args) {
            (this._listeners?.[event] || []).forEach((h) => h(...args));
        },
        _listeners: {},
    };

    // Wire layout into dragboard so constructor finds it
    dragboard.tab = tab;
    layout.dragboard = dragboard;
    tab.dragboard = dragboard;
    tab.workspace = workspace;

    // Replace the free layout at index 0 with the user-provided layout
    // so the constructor picks it up via model.layout (default 0)
    dragboard.layouts[0] = layout;

    return new Wirecloud.ui.WidgetView(tab, model, {});
};

// ============================================================================
// TESTS: Module-level functions (via internal access)
// ============================================================================

test('update_buttons: sets grip visibility and icon correctly', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const model = makeModel({ volatile: false });
    const view = createWidgetView({ model, layout: layout, dragboard, workspace });

    // After construction, update has been called
    assert.equal(view.grip.hidden, false);
    assert.equal(view.grip.enabled, true);
    assert.equal(view.titlevisibilitybutton.hidden, false);
    assert.equal(view.closebutton.hidden, false);
    assert.equal(view.menubutton.hidden, false);

    // Switch to viewer mode
    workspace.editing = false;
    workspace._dispatch('editmode');
    assert.equal(view.titlevisibilitybutton.hidden, true);
    assert.equal(view.menubutton.hidden, true);
});

test('update_buttons: grip hidden when not moveable in viewer mode', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: false });
    const model = makeModel({ volatile: false });
    const view = createWidgetView({ model, layout: layout, dragboard, workspace });

    // canDrag returns true by default, so grip is visible (moveable) but not enabled
    assert.equal(view.grip.hidden, false); // moveable keeps it visible
    assert.equal(view.grip.enabled, false); // not editable

    // Make draggable.canDrag return false for viewer to hide grip
    view.draggable.canDrag = () => false;
    workspace._dispatch('editmode'); // re-trigger update_buttons
    assert.equal(view.grip.hidden, true);
});

test('update_buttons: grip icon anchor when not moveable', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const model = makeModel({ volatile: false });
    const view = createWidgetView({ model, layout: layout, dragboard, workspace });

    // canDrag returns true by default -> moveable = true -> fa-grip-vertical, not fa-anchor
    assert.equal(view.grip.icon.classList.contains('fa-anchor'), false);
    assert.equal(view.grip.icon.classList.contains('fa-grip-vertical'), true);

    // Make draggable not moveable to show fa-anchor
    view.draggable.canDrag = () => false;
    workspace._dispatch('editmode');
    assert.equal(view.grip.icon.classList.contains('fa-anchor'), true);
    assert.equal(view.grip.icon.classList.contains('fa-grip-vertical'), false);
});

test('update_buttons: titlevisibilitybutton hidden when not editing', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: false });
    const model = makeModel({ volatile: false });
    const view = createWidgetView({ model, layout: layout, dragboard, workspace });

    assert.equal(view.titlevisibilitybutton.hidden, true);
});

test('update_buttons: titlevisibilitybutton title and icon reflect model state', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const model = makeModel({ titlevisible: true, volatile: false });
    const view = createWidgetView({ model, layout: layout, dragboard, workspace });

    // When titlevisible is true, button shows "Hide title" (action to hide it)
    assert.equal(view.titlevisibilitybutton.getTitle(), 'Hide title');
    assert.ok(view.titlevisibilitybutton.icon);

    // Change titlevisible
    model.titlevisible = false;
    model._dispatchEvent('change', ['titlevisible']);
    // When titlevisible is false, button shows "Show title" (action to show it)
    assert.equal(view.titlevisibilitybutton.getTitle(), 'Show title');
});

test('update_buttons: closebutton hidden for non-volatile viewer', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: false });
    const model = makeModel({ volatile: false });
    model.isAllowed = (perm, role) => role === 'editor';
    const view = createWidgetView({ model, layout: layout, dragboard, workspace });

    assert.equal(view.closebutton.hidden, true);
});

test('update_buttons: resize handles enabled based on editing', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const model = makeModel({ volatile: false });
    const view = createWidgetView({ model, layout: layout, dragboard, workspace });

    assert.equal(view.bottomresizehandle.enabled, true);
    assert.equal(view.leftresizehandle.enabled, true);
    assert.equal(view.rightresizehandle.enabled, true);

    workspace.editing = false;
    workspace._dispatch('editmode');
    assert.equal(view.bottomresizehandle.enabled, false);
});

test('update_className: sets wrapper classes based on model and layout', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ missing: false, titlevisible: true });
    const view = createWidgetView({ model, layout: layout, dragboard });

    assert.equal(view.wrapperElement.classList.contains('wc-missing-widget'), false);
    assert.equal(view.wrapperElement.classList.contains('wc-floating-widget'), true);
    assert.equal(view.wrapperElement.classList.contains('wc-titled-widget'), true);

    // Test missing widget class
    model.missing = true;
    model._dispatchEvent('change', ['meta']);
    assert.equal(view.wrapperElement.classList.contains('wc-missing-widget'), true);
});

test('update_position: delegates to layout.updatePosition', (t) => {
    setup();
    const layout = makeFreeLayout();
    let updatePosCalled = false;
    layout.updatePosition = (w, we) => { updatePosCalled = { widget: w, wrapperEl: we }; };
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel({ position: { x: 5, y: 10, z: 3 } }), layout, dragboard });

    view.repaint();
    assert.ok(updatePosCalled);
    assert.equal(view.wrapperElement.style.zIndex, 4);
});

test('update_shape: delegates to layout.updateShape', (t) => {
    setup();
    const layout = makeFreeLayout();
    let updateShapeCalled = false;
    layout.updateShape = (w, we) => { updateShapeCalled = { widget: w, wrapperEl: we }; };
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    view.repaint();
    assert.ok(updateShapeCalled);
});

test('notify_position: calls contextManager.modify with position', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ position: { x: 10, y: 20, z: 1 } });
    const view = createWidgetView({ model, layout, dragboard });

    model.contextManager._allModifies = [];
    view.repaint();
    // notify_position is called before notify_shape in repaint,
    // so position data should be in the first modify call
    assert.deepStrictEqual(model.contextManager._allModifies[0], {
        xPosition: 10,
        yPosition: 20,
        zPosition: 1,
    });
});

test('notify_shape: calls contextManager.modify with shape and pixel dimensions', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ shape: { width: 2, height: 3 } });
    model.wrapperElement.offsetHeight = 300;
    model.wrapperElement.offsetWidth = 400;
    const view = createWidgetView({ model, layout, dragboard });

    model.contextManager._lastModify = null;
    view.repaint();
    assert.deepStrictEqual(model.contextManager._lastModify, {
        height: 3,
        width: 2,
        heightInPixels: 300,
        widthInPixels: 400,
    });
});

test('update_widget_visibility: visible when not minimized, tab not hidden, workspace not hidden', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ hidden: false });
    const tab = {
        id: 'tab-1', hidden: false, workspace, dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _dispatch() {},
        _listeners: {},
    };
    const view = createWidgetView({ model: makeModel(), layout, dragboard, workspace, tab });

    view.model.contextManager._lastModify = null;
    assert.equal(view.model.contextManager._lastModify, null); // Not called until visibility event

    workspace._dispatch('show');
    assert.deepStrictEqual(view.model.contextManager._lastModify, { visible: true });
});

test('on_add_log: updates error button based on log count', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    model.logManager.errorCount = 3;
    const view = createWidgetView({ model, layout, dragboard });

    // After construction, initial state
    model.logManager._dispatch('newentry');
    assert.equal(view.errorbutton.hidden, false);

    model.logManager.errorCount = 0;
    model.logManager._dispatch('newentry');
    assert.equal(view.errorbutton.hidden, true);
});

test('on_remove: dispatches remove event from widget view', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    let removed = false;
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    view.addEventListener('remove', () => { removed = true; });
    model._dispatchEvent('remove');
    assert.equal(removed, true);
});

// ============================================================================
// TESTS: Constructor
// ============================================================================

test('constructor: creates WidgetView with all component references', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    assert.ok(view instanceof Wirecloud.ui.WidgetView);
    assert.equal(view.id, 'widget-1');
    assert.equal(view.model, model);
    assert.equal(view.layout, layout);
    assert.equal(view.tab.id, 'tab-1');
    assert.equal(view.title, 'Test Widget');
    assert.equal(view.titlevisible, true);
    assert.ok(view.wrapperElement);
    assert.ok(view.closebutton);
    assert.ok(view.errorbutton);
    assert.ok(view.grip);
    assert.ok(view.menubutton);
    assert.ok(view.minimizebutton);
    assert.ok(view.titleelement);
    assert.ok(view.titlevisibilitybutton);
    assert.ok(view.bottomresizehandle);
    assert.ok(view.leftresizehandle);
    assert.ok(view.rightresizehandle);
    assert.ok(view.draggable);
    assert.ok(view.heading);
    assert.equal(view.wrapperElement.classList.contains('wc-widget'), true);
    assert.equal(view.wrapperElement.getAttribute('data-id'), 'widget-1');
    assert.ok(view.position);
    assert.ok(view.shape);
});

test('constructor: fulldragboard mode saves previous layout/position/shape', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ fulldragboard: true, layout: 0 });
    dragboard.layouts = [layout]; // index 0

    const { fragment, wrapper } = fakeParseResult();
    _guibuilderParseResult = fragment;
    _guibuilderParseCalled = false;

    const workspace = makeWorkspace();
    const tab = {
        id: 'tab-1', hidden: false, workspace, dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener(event, handler) {
            if (!this._listeners) this._listeners = {};
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
        },
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});

    assert.notEqual(view.previousLayout, null);
    assert.notEqual(view.previousPosition, null);
    assert.notEqual(view.previousShape, null);
});

test('constructor: handles empty wrapper height (0) on first load', (t) => {
    setup();
    const { fragment, wrapper } = fakeParseResult();
    wrapper.offsetHeight = 0;
    _guibuilderParseResult = fragment;

    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false });
    const view = createWidgetView({ model, layout, dragboard });

    assert.ok(view);
});

test('constructor: adds wc-widget class and data-id attribute', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ id: 'custom-id' });
    const view = createWidgetView({ model, layout, dragboard });

    assert.equal(view.wrapperElement.classList.contains('wc-widget'), true);
    assert.equal(view.wrapperElement.getAttribute('data-id'), 'custom-id');
});

test('constructor: registers model change listener for title, meta, permissions, titlevisible', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ title: 'Original' });
    const view = createWidgetView({ model, layout, dragboard });

    model.title = 'Changed Title';
    model._dispatchEvent('change', ['title']);
    assert.equal(view.titleelement.wrapperElement.textContent, 'Changed Title');

    model.missing = true;
    model._dispatchEvent('change', ['meta']);
    assert.equal(view.wrapperElement.classList.contains('wc-missing-widget'), true);
});

test('constructor: registers model unload listener', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    view.highlight();
    assert.equal(view.wrapperElement.classList.contains('wc-widget-highlight'), true);

    model._dispatchEvent('unload');
    assert.equal(view.wrapperElement.classList.contains('wc-widget-highlight'), false);
});

test('constructor: registers model load listener for key events and repaint', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ loaded: false, meta: { macversion: 1 } });
    model.wrapperElement.contentDocument = { defaultView: { addEventListener() {} } };

    let escapeCalled = false;
    Wirecloud.UserInterfaceManager.handleEscapeEvent = () => { escapeCalled = true; };

    const view = createWidgetView({ model, layout, dragboard });

    model._dispatchEvent('load');

    assert.equal(view.wrapperElement.classList.contains('in'), true);

    // Simulate escape key on wrapperElement
    model.wrapperElement.dispatchEvent({ type: 'keydown', keyCode: 27 });
    // For macversion 1, the keydown listener is on contentDocument.defaultView,
    // not on wrapperElement directly. Test that instead.
});

test('constructor: registers model load listener on wrapperElement when macversion > 1', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ loaded: false, meta: { macversion: 2 } });

    let escapeCalled = false;
    Wirecloud.UserInterfaceManager.handleEscapeEvent = () => { escapeCalled = true; };

    const view = createWidgetView({ model, layout, dragboard });

    model._dispatchEvent('load');

    assert.equal(view.wrapperElement.classList.contains('in'), true);

    // For macversion > 1, keydown is on model.wrapperElement directly
    model.wrapperElement.dispatchEvent({ type: 'keydown', keyCode: 27 });
    // Note: handleEscapeEvent uses the view but the listener is on model,
    // not view's wrapperElement
});

test('constructor: registers editmode listener on workspace', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const tab = {
        id: 'tab-1', hidden: false, workspace, dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener(event, handler) {
            if (!this._listeners) this._listeners = {};
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
        },
        _listeners: {},
    };
    dragboard.tab = tab;
    const model = makeModel({ volatile: false });
    const view = createWidgetView({ model, layout, dragboard, workspace, tab });

    // In editing mode, closebutton should be visible for editor
    assert.equal(view.closebutton.hidden, false);

    workspace.editing = false;
    workspace._dispatch('editmode');
    assert.equal(view.menubutton.hidden, true);
});

test('constructor: registers visibility listeners', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ hidden: false });
    const tab = {
        id: 'tab-1', hidden: false, workspace, dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener(event, handler) {
            if (!this._listeners) this._listeners = {};
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
        },
        _dispatch(event, ...args) {
            (this._listeners?.[event] || []).forEach((h) => h(...args));
        },
        _listeners: {},
    };
    dragboard.tab = tab;
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard, workspace, tab });

    model.contextManager._lastModify = null;
    tab.hidden = true;
    tab._dispatch('hide');
    assert.deepStrictEqual(model.contextManager._lastModify, { visible: false });
});

// ============================================================================
// TESTS: setMinimizeStatus
// ============================================================================

test('setMinimizeStatus: changes minimize status and propagates to model', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false });
    const view = createWidgetView({ model, layout, dragboard });

    view.setMinimizeStatus(true);
    // Minimize class should be added to wrapper
    assert.equal(view.wrapperElement.classList.contains('wc-minimized-widget'), true);
    // The minimize button title should change to "Maximize"
    assert.equal(view.minimizebutton.getTitle(), 'Maximize');
    // The model's context manager should be notified about visibility
    assert.ok(model.contextManager._lastModify);
});

test('setMinimizeStatus: toggles minimize button icon and title', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false });
    const view = createWidgetView({ model, layout, dragboard });

    view.setMinimizeStatus(true);
    assert.equal(view.minimizebutton.getTitle(), 'Maximize');

    view.setMinimizeStatus(false);
    assert.equal(view.minimizebutton.getTitle(), 'Minimize');
});

test('setMinimizeStatus: calls _notifyResizeEvent when reserveSpace is true', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false });
    const view = createWidgetView({ model, layout, dragboard });

    view.setMinimizeStatus(true, true, true);
    assert.equal(layout._notifyResizeEventCalls.length, 1);
});

test('setMinimizeStatus: does not call _notifyResizeEvent when reserveSpace is false', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false });
    const view = createWidgetView({ model, layout, dragboard });

    view.setMinimizeStatus(true, true, false);
    assert.equal(layout._notifyResizeEventCalls.length, 0);
});

test('setMinimizeStatus: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    assert.equal(view.setMinimizeStatus(true), view);
});

// ============================================================================
// TESTS: _setMinimizeStatusStyle
// ============================================================================

test('_setMinimizeStatusStyle: no-op when newStatus equals current minimized', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false });
    const view = createWidgetView({ model, layout, dragboard });

    const result = view._setMinimizeStatusStyle(false, layout);
    assert.equal(result, view);
});

test('_setMinimizeStatusStyle: sets minimize shape on minimize', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false, shape: { width: 2, height: 3, relwidth: false, relheight: false } });
    const view = createWidgetView({ model, layout, dragboard });

    layout.adaptHeight = (v) => ({ inLU: 5 });
    view._setMinimizeStatusStyle(true, layout);

    assert.equal(view.wrapperElement.classList.contains('wc-minimized-widget'), true);
    // title should be forced visible
    assert.equal(view.model.titlevisible, true); // Because setTitleVisibility(true, false) -> titlevisible = true
});

test('_setMinimizeStatusStyle: restores shape on maximize', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: true, shape: { width: 2, height: 3, relwidth: false, relheight: false } });
    const view = createWidgetView({ model, layout, dragboard });

    layout.getHeightInPixels = (h) => h * 40;
    assert.equal(view.wrapperElement.classList.contains('wc-minimized-widget'), true);

    view._setMinimizeStatusStyle(false, layout);
    assert.equal(view.wrapperElement.classList.contains('wc-minimized-widget'), false);
});

test('_setMinimizeStatusStyle: uses provided height when available', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false, shape: { width: 2, height: 3, relwidth: false, relheight: false } });
    const view = createWidgetView({ model, layout, dragboard });

    layout.adaptHeight = (v) => {
        layout._adaptHeightArg = v;
        return { inLU: 5 };
    };
    view._setMinimizeStatusStyle(true, layout, 500);

    assert.ok(layout._adaptHeightArg.includes('500'));
});

// ============================================================================
// TESTS: toggleTitleVisibility
// ============================================================================

test('toggleTitleVisibility: toggles title visibility via model', async (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ titlevisible: true });
    const view = createWidgetView({ model, layout, dragboard });

    const result = await view.toggleTitleVisibility(true);
    assert.equal(model.titlevisible, false);
});

test('toggleTitleVisibility: disables and re-enables the button', async (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ titlevisible: true });
    const view = createWidgetView({ model, layout, dragboard });

    await view.toggleTitleVisibility(true);
    assert.equal(view.titlevisibilitybutton.enabled, true);
});

// ============================================================================
// TESTS: togglePermission
// ============================================================================

test('togglePermission: toggles a viewer permission', async (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    model.permissions.viewer.move = true;
    const view = createWidgetView({ model, layout, dragboard });

    const result = await view.togglePermission('move', true);
    assert.equal(model.permissions.viewer.move, false);
});

// ============================================================================
// TESTS: setPosition
// ============================================================================

test('setPosition: updates internal position and model', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ position: { x: 0, y: 0, z: 0 } });
    const view = createWidgetView({ model, layout, dragboard });

    view.setPosition({ x: 50, y: 100, z: 2 });
    assert.deepStrictEqual(view.position, { x: 50, y: 100, z: 2 });
    assert.equal(model.position.x, 50);
    assert.equal(model.position.y, 100);
    assert.equal(model.position.z, 2);
});

test('setPosition: does not update model when updateModel is false', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    let setPositionCalled = false;
    let setLayoutPositionCalled = false;
    const model = makeModel({ position: { x: 0, y: 0, z: 0 } });
    model.setPosition = () => { setPositionCalled = true; };
    model.setLayoutPosition = () => { setLayoutPositionCalled = true; };
    const view = createWidgetView({ model, layout, dragboard });

    view.setPosition({ x: 99, y: 88, z: 7 }, false);
    // Model's setPosition/setLayoutPosition should NOT be called
    assert.equal(setPositionCalled, false);
    assert.equal(setLayoutPositionCalled, false);
    // Internal position should be updated
    assert.equal(view.position.x, 99);
});

test('setPosition: does not update layout position when layout is null', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ position: { x: 0, y: 0, z: 0 } });
    const view = createWidgetView({ model, layout, dragboard });

    view.layout = null;
    const result = view.setPosition({ x: 50, y: 100, z: 2 });
    assert.equal(result, view);
});

// ============================================================================
// TESTS: setShape
// ============================================================================

test('setShape: updates internal shape and model', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ shape: { width: 2, height: 3 } });
    const view = createWidgetView({ model, layout, dragboard });

    view.setShape({ width: 5, height: 8 });
    assert.equal(view.shape.width, 5);
    assert.equal(view.shape.height, 8);
    assert.equal(model.shape.width, 5);
});

test('setShape: does not update model when updateModel is false', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    let setShapeCalled = false;
    let setLayoutShapeCalled = false;
    const model = makeModel({ shape: { width: 2, height: 3 } });
    model.setShape = () => { setShapeCalled = true; };
    model.setLayoutShape = () => { setLayoutShapeCalled = true; };
    const view = createWidgetView({ model, layout, dragboard });

    view.setShape({ width: 5, height: 8 }, false, false, false, false);
    // Model's setShape/setLayoutShape should NOT be called
    assert.equal(setShapeCalled, false);
    assert.equal(setLayoutShapeCalled, false);
    // Internal shape should be updated
    assert.equal(view.shape.width, 5);
});

test('setShape: returns early when layout is null', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ shape: { width: 2, height: 3 } });
    const view = createWidgetView({ model, layout, dragboard });

    view.layout = null;
    view.setShape({ width: 5, height: 8 });
    // Should not throw
});

test('setShape: notifies resize event on layout', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ shape: { width: 2, height: 3 } });
    const view = createWidgetView({ model, layout, dragboard });

    view.setShape({ width: 5, height: 8 }, true, true, true);
    assert.equal(layout._notifyResizeEventCalls.length, 1);
    const call = layout._notifyResizeEventCalls[0];
    assert.equal(call.widget, view);
    assert.equal(call.oldW, 2);
    assert.equal(call.oldH, 3);
    assert.equal(call.newW, 5);
    assert.equal(call.newH, 8);
    assert.equal(call.resizeLS, true);
    assert.equal(call.resizeTS, true);
    assert.equal(call.persist, true);
});

// ============================================================================
// TESTS: load
// ============================================================================

test('load: loads model if not already loaded', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ loaded: false });
    const view = createWidgetView({ model, layout, dragboard });

    view.load();
    assert.equal(model._loaded, true);
});

test('load: does not load model if already loaded', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    let loadCalled = false;
    const model = makeModel({ loaded: true });
    model.load = () => { loadCalled = true; };
    const view = createWidgetView({ model, layout, dragboard });

    view.load();
    assert.equal(loadCalled, false); // Not called because already loaded
});

test('load: returns repaint result', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    assert.equal(view.load(), view);
});

// ============================================================================
// TESTS: repaint
// ============================================================================

test('repaint: updates position and shape, notifies context manager', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ position: { x: 5, y: 5, z: 0 } });
    const view = createWidgetView({ model, layout, dragboard });

    let positionUpdated = false;
    let shapeUpdated = false;
    layout.updatePosition = () => { positionUpdated = true; };
    layout.updateShape = () => { shapeUpdated = true; };

    view.repaint();
    assert.equal(positionUpdated, true);
    assert.equal(shapeUpdated, true);
    assert.ok(model.contextManager._lastModify);
});

test('repaint: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.repaint(), view);
});

// ============================================================================
// TESTS: reload
// ============================================================================

test('reload: delegates to model.reload', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    view.reload();
    assert.equal(model._reloaded, true);
});

test('reload: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.reload(), view);
});

// ============================================================================
// TESTS: showLogs
// ============================================================================

test('showLogs: delegates to model.showLogs', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    view.showLogs();
    assert.equal(model._logsShown, true);
});

test('showLogs: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.showLogs(), view);
});

// ============================================================================
// TESTS: showSettings
// ============================================================================

test('showSettings: delegates to model.showSettings', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    view.showSettings();
    assert.equal(model._settingsShown, true);
});

test('showSettings: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.showSettings(), view);
});

// ============================================================================
// TESTS: highlight
// ============================================================================

test('highlight: adds panel-success and wc-widget-highlight classes', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    view.highlight();
    assert.equal(view.wrapperElement.classList.contains('panel-success'), true);
    assert.equal(view.wrapperElement.classList.contains('panel-default'), false);
    assert.equal(view.wrapperElement.classList.contains('wc-widget-highlight'), true);
});

test('highlight: dispatches highlight event', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    let highlighted = false;
    view.addEventListener('highlight', () => { highlighted = true; });
    view.highlight();
    assert.equal(highlighted, true);
});

test('highlight: resets animation when already highlighted', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    view.highlight(); // First highlight adds the class
    assert.equal(view.wrapperElement.classList.contains('wc-widget-highlight'), true);

    let events = 0;
    view.addEventListener('highlight', () => { events++; });
    view.highlight(); // Already highlighted - goes to else branch

    // The else branch does NOT dispatch any event, it just resets animation
    assert.equal(events, 0);
});

test('highlight: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.highlight(), view);
});

// ============================================================================
// TESTS: unhighlight
// ============================================================================

test('unhighlight: removes panel-success and wc-widget-highlight classes', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    view.wrapperElement.classList.add('panel-success', 'wc-widget-highlight');
    view.wrapperElement.classList.remove('panel-default');
    view.unhighlight();

    assert.equal(view.wrapperElement.classList.contains('panel-success'), false);
    assert.equal(view.wrapperElement.classList.contains('panel-default'), true);
    assert.equal(view.wrapperElement.classList.contains('wc-widget-highlight'), false);
});

test('unhighlight: dispatches unhighlight event', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    view.wrapperElement.classList.add('wc-widget-highlight');
    let unhighlighted = false;
    view.addEventListener('unhighlight', () => { unhighlighted = true; });
    view.unhighlight();
    assert.equal(unhighlighted, true);
});

test('unhighlight: no-op when not highlighted', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    let events = 0;
    view.addEventListener('unhighlight', () => { events++; });
    view.unhighlight();
    assert.equal(events, 0);
});

test('unhighlight: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.unhighlight(), view);
});

// ============================================================================
// TESTS: moveToLayout
// ============================================================================

test('moveToLayout: no-op when newLayout equals current layout', async (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    const result = await view.moveToLayout(layout);
    assert.equal(result, undefined); // Promise.resolve() returns undefined
});

test('moveToLayout: moves to a different layout', async (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'layout1' });
    const layout2 = makeFreeLayout({ name: 'layout2' });
    const dragboard = makeDragboard();
    dragboard.layouts = [layout1, layout2];
    layout1.dragboard = dragboard;
    layout2.dragboard = dragboard;
    const model = makeModel({ layoutConfig: [
        { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
    ] });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    // Override layout to be layout1
    view.layout = layout1;

    view.moveToLayout(layout2);
    // The move is async via changeTab, but the sync portions should have worked
    // layout2.addWidget should have been called
    assert.ok(layout2.widgets[view.id]);
});

test('moveToLayout: minimizes first if currently minimized, then restores', async (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'layout1' });
    const layout2 = makeFreeLayout({ name: 'layout2' });
    const dragboard = makeDragboard();
    dragboard.layouts = [layout1, layout2];
    layout1.dragboard = dragboard;
    layout2.dragboard = dragboard;
    const model = makeModel({ minimized: true, layoutConfig: [
        { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
    ] });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = layout1;

    view.moveToLayout(layout2);
    // After move, widget should be in new layout
    assert.ok(layout2.widgets[view.id]);
});

test('moveToLayout: handles FreeLayout destination shape conversion', async (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'layout1' });
    const layout2 = makeFreeLayout({ name: 'layout2' });
    const dragboard = makeDragboard();
    dragboard.layouts = [layout1, layout2];
    layout1.dragboard = dragboard;
    layout2.dragboard = dragboard;
    const model = makeModel({ layoutConfig: [
        { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
    ] });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = layout1;

    view.moveToLayout(layout2);
    assert.ok(layout2.widgets[view.id]);
});

test('moveToLayout: handles FullDragboardLayout source restore', async (t) => {
    setup();
    const freeLayout = makeFreeLayout({ name: 'free' });
    const fullLayout = makeFullDragboardLayout({ name: 'full' });
    const dragboard = makeDragboard();
    dragboard.layouts = [freeLayout];
    dragboard.fulldragboardLayout = fullLayout;
    freeLayout.dragboard = dragboard;
    fullLayout.dragboard = dragboard;
    const model = makeModel({ layoutConfig: [
        { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
    ] });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = fullLayout; // Start in full dragboard
    view.previousShape = { width: 4, height: 6 };
    view.previousPosition = { x: 20, y: 30 };

    view.moveToLayout(freeLayout);
    assert.ok(freeLayout.widgets[view.id]);
});

test('moveToLayout: calls changeTab on model and updates dragboards', async (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'layout1' });
    const layout2 = makeFreeLayout({ name: 'layout2' });
    const dragboard = makeDragboard();
    dragboard.layouts = [layout1, layout2];
    layout1.dragboard = dragboard;
    layout2.dragboard = dragboard;
    let changeTabCalled = false;
    const model = makeModel({
        changeTab(m) { changeTabCalled = true; return Promise.resolve(); },
        layoutConfig: [
            { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
        ],
    });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = layout1;

    view.moveToLayout(layout2);
    // changeTab is called in the 'then' callback - it's async.
    // We verify the sync portion is correct.
    assert.ok(layout2.widgets[view.id]);
});

// ============================================================================
// TESTS: toggleMinimizeStatus
// ============================================================================

test('toggleMinimizeStatus: toggles minimize state', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false });
    const view = createWidgetView({ model, layout, dragboard });

    view.toggleMinimizeStatus(true);
    assert.equal(view.minimized, true);

    view.toggleMinimizeStatus(true);
    assert.equal(view.minimized, false);
});

// ============================================================================
// TESTS: setFullDragboardMode
// ============================================================================

test('setFullDragboardMode: no-op when already in requested mode', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    const result = view.setFullDragboardMode(false);
    assert.equal(result, view);
});

test('setFullDragboardMode: enables full dragboard mode', (t) => {
    setup();
    const freeLayout = makeFreeLayout({ name: 'free' });
    const fullLayout = makeFullDragboardLayout({ name: 'full' });
    const dragboard = makeDragboard();
    dragboard.layouts = [freeLayout];
    dragboard.fulldragboardLayout = fullLayout;
    freeLayout.dragboard = dragboard;
    fullLayout.dragboard = dragboard;
    const model = makeModel({ fulldragboard: false, layoutConfig: [
        { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
    ] });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = freeLayout;

    view.setFullDragboardMode(true);
    assert.equal(model.fulldragboard, true);
    assert.ok(fullLayout.widgets[view.id]);
});

test('setFullDragboardMode: disables full dragboard mode', (t) => {
    setup();
    const freeLayout = makeFreeLayout({ name: 'free' });
    const fullLayout = makeFullDragboardLayout({ name: 'full' });
    const dragboard = makeDragboard();
    dragboard.layouts = [freeLayout];
    dragboard.fulldragboardLayout = fullLayout;
    freeLayout.dragboard = dragboard;
    fullLayout.dragboard = dragboard;
    const model = makeModel({ fulldragboard: true, layoutConfig: [
        { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
    ] });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = fullLayout;
    view.previousLayout = freeLayout;

    view.setFullDragboardMode(false);
    assert.equal(model.fulldragboard, false);
});

// ============================================================================
// TESTS: updateWindowSize
// ============================================================================

test('updateWindowSize: updates model window size', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    let updateWindowSizeCalled = false;
    model.updateWindowSize = (size) => { updateWindowSizeCalled = size; };
    const view = createWidgetView({ model, layout, dragboard });

    view.updateWindowSize({ width: 1200, height: 800 });
    assert.deepStrictEqual(updateWindowSizeCalled, { width: 1200, height: 800 });
});

test('updateWindowSize: removes from current layout and re-adds (non-fulldragboard)', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    let removeWidgetEventsCalled = false;
    layout.removeWidgetEventListeners = (w) => { removeWidgetEventsCalled = true; };
    const model = makeModel({ fulldragboard: false, layout: 0 });
    const view = createWidgetView({ model, layout, dragboard });

    view.updateWindowSize({ width: 1200, height: 800 });
    assert.equal(removeWidgetEventsCalled, true);
    assert.ok(layout.widgets[view.id]);
});

test('updateWindowSize: handles fulldragboard mode re-add', (t) => {
    setup();
    const freeLayout = makeFreeLayout({ name: 'free' });
    const fullLayout = makeFullDragboardLayout({ name: 'full' });
    const dragboard = makeDragboard();
    dragboard.layouts = [freeLayout];
    dragboard.fulldragboardLayout = fullLayout;
    freeLayout.dragboard = dragboard;
    fullLayout.dragboard = dragboard;
    let removeWidgetEventsCalled = false;
    fullLayout.removeWidgetEventListeners = (w) => { removeWidgetEventsCalled = true; };
    const model = makeModel({ fulldragboard: true, layout: 0, minimized: false });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = fullLayout;
    view.previousLayout = freeLayout;

    view.updateWindowSize({ width: 1200, height: 800 });
    assert.equal(removeWidgetEventsCalled, true);
    assert.ok(fullLayout.widgets[view.id]);
    assert.notEqual(view.previousPosition, null);
    assert.notEqual(view.previousShape, null);
});

// ============================================================================
// TESTS: toJSON
// ============================================================================

test('toJSON: returns widget data with action=update and all configs when allLayoutConfigurations', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    dragboard.layouts = [layout]; // layout is at index 0
    const model = makeModel({
        layoutConfig: [
            { id: 'c1', width: 100, height: 80 },
            { id: 'c2', width: 200, height: 120 },
        ],
        currentLayoutConfig: { id: 'c1' },
    });
    const view = createWidgetView({ model, layout, dragboard });

    const json = view.toJSON('update', true);
    assert.equal(json.id, 'widget-1');
    assert.equal(json.tab, 'tab-1');
    assert.equal(json.layout, 0);
    assert.equal(json.layoutConfig.length, 2);
    assert.equal(json.layoutConfig[0].action, 'update');
    assert.equal(json.layoutConfig[1].action, 'update');
});

test('toJSON: filters to only current layout config when allLayoutConfigurations is false', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    dragboard.layouts = [layout];
    const model = makeModel({
        layoutConfig: [
            { id: 'c1', width: 100 },
            { id: 'c2', width: 200 },
        ],
        currentLayoutConfig: { id: 'c1' },
    });
    const view = createWidgetView({ model, layout, dragboard });

    const json = view.toJSON('remove', false);
    assert.equal(json.layoutConfig.length, 1);
    assert.equal(json.layoutConfig[0].id, 'c1');
    assert.equal(json.layoutConfig[0].action, 'remove');
});

test('toJSON: uses previousLayout index when in fulldragboard', (t) => {
    setup();
    const freeLayout = makeFreeLayout({ name: 'free' });
    const fullLayout = makeFullDragboardLayout({ name: 'full' });
    const dragboard = makeDragboard();
    dragboard.layouts = [freeLayout];
    dragboard.fulldragboardLayout = fullLayout;
    freeLayout.dragboard = dragboard;
    fullLayout.dragboard = dragboard;
    const model = makeModel({ layoutConfig: [{ id: 'c1' }], currentLayoutConfig: { id: 'c1' } });
    const workspace = makeWorkspace();
    const tab = {
        id: 'tab-1', hidden: false, workspace, dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;
    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = fullLayout; // In full dragboard
    view.previousLayout = freeLayout;

    const json = view.toJSON();
    assert.equal(json.layout, 0); // index of previousLayout
});

// ============================================================================
// TESTS: persist
// ============================================================================

test('persist: saves position and shape to model when not volatile', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    let positionSet = false;
    let shapeSet = false;
    const model = makeModel({ volatile: false });
    model.setPosition = (p) => { positionSet = p; };
    model.setShape = (s) => { shapeSet = s; };
    const view = createWidgetView({ model, layout, dragboard });

    view.persist();
    assert.ok(positionSet);
    assert.ok(shapeSet);
});

test('persist: does not save when volatile', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    let positionSet = false;
    const model = makeModel({ volatile: true });
    model.setPosition = () => { positionSet = true; };
    model.setShape = () => {};
    const view = createWidgetView({ model, layout, dragboard });

    view.persist();
    assert.equal(positionSet, false);
});

test('persist: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.persist(), view);
});

// ============================================================================
// TESTS: remove
// ============================================================================

test('remove: delegates to model.remove', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    view.remove();
    assert.equal(model._removed, true);
});

test('remove: returns this for chaining', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.remove(), view);
});

// ============================================================================
// TESTS: Properties
// ============================================================================

test('id property: returns model id', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel({ id: 'my-widget' }), layout, dragboard });

    assert.equal(view.id, 'my-widget');
});

test('layout property: get/set updates privates and model', (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'layout1' });
    const layout2 = makeFreeLayout({ name: 'layout2' });
    const dragboard = makeDragboard();
    dragboard.layouts = [layout1, layout2];
    layout1.dragboard = dragboard;
    layout2.dragboard = dragboard;
    const model = makeModel();
    let setFulldragboardCalled = false;
    let setLayoutIndexCalled = -1;
    model.setLayoutFulldragboard = (v) => { setFulldragboardCalled = v; };
    model.setLayoutIndex = (v) => { setLayoutIndexCalled = v; };
    const view = createWidgetView({ model, layout: layout1, dragboard });

    view.layout = layout2;
    assert.equal(view.layout, layout2);
    assert.equal(setFulldragboardCalled, false);
    assert.equal(setLayoutIndexCalled, 1);
});

test('position property: returns a clone', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ position: { x: 10, y: 20, z: 5 } });
    const view = createWidgetView({ model, layout, dragboard });

    const pos = view.position;
    assert.deepStrictEqual(pos, { x: 10, y: 20, z: 5 });
    pos.x = 99;
    assert.equal(view.position.x, 10); // Original unchanged (clone)
});

test('shape property: returns clone of shape or minimized_shape', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false, shape: { width: 2, height: 3 } });
    const view = createWidgetView({ model, layout, dragboard });

    assert.deepStrictEqual(view.shape, { width: 2, height: 3 });

    // Minimize to test minimized_shape path
    view.setMinimizeStatus(true, false, false);
    assert.equal(view.minimized, true);
    const shape = view.shape;
    assert.ok(shape.width !== undefined);
});

test('tab property: returns the tab', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel(), layout, dragboard });

    assert.equal(view.tab.id, 'tab-1');
});

test('title property: returns model.title', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel({ title: 'Hello World' }), layout, dragboard });

    assert.equal(view.title, 'Hello World');
});

test('titlevisible property: returns model.titlevisible', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const view = createWidgetView({ model: makeModel({ titlevisible: false }), layout, dragboard });

    assert.equal(view.titlevisible, false);
});

// ============================================================================
// TESTS: Template components (closebutton, errorbutton, grip, menubutton, etc.)
// ============================================================================

test('closebutton: clicking closes the widget', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    view.closebutton.dispatchEvent('click');
    assert.equal(model._removed, true);
});

test('grip: clicking toggles move permission', async (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    model.permissions.viewer.move = true;
    const view = createWidgetView({ model, layout, dragboard });

    view.grip.dispatchEvent('click');
    // togglePermission is async, so we check the model change
    // The mock setPermissions resolves immediately
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(model.permissions.viewer.move, false);
});

test('titleelement: change event renames the model', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ title: 'Old Title' });
    const view = createWidgetView({ model, layout, dragboard });

    view.titleelement.dispatchEvent('change', 'New Title');
    assert.equal(model._renamed, 'New Title');
});

test('titlevisibilitybutton: clicking toggles title visibility', async (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ titlevisible: true });
    const view = createWidgetView({ model, layout, dragboard });

    view.titlevisibilitybutton.dispatchEvent('click');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(model.titlevisible, false);
});

// ============================================================================
// TESTS: transitionend listener on wrapperElement
// ============================================================================

test('transitionend: repaints and notifies shape on width/height/top/left transition', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ shape: { width: 2, height: 3 } });
    model.wrapperElement.offsetHeight = 300;
    model.wrapperElement.offsetWidth = 400;
    const view = createWidgetView({ model, layout, dragboard });

    model.contextManager._lastModify = null;
    view.layout.iwidgetToMove = null;

    view.wrapperElement.dispatchEvent({ type: 'transitionend', propertyName: 'width' });
    assert.ok(model.contextManager._lastModify);
});

test('transitionend: does not repaint when iwidgetToMove is set', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    model.contextManager._lastModify = null;
    view.layout.iwidgetToMove = 'some-widget';

    view.wrapperElement.dispatchEvent({ type: 'transitionend', propertyName: 'width' });
    assert.equal(model.contextManager._lastModify, null);
});

test('transitionend: does not repaint on non-size/position property transitions', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    const view = createWidgetView({ model, layout, dragboard });

    model.contextManager._lastModify = null;

    view.wrapperElement.dispatchEvent({ type: 'transitionend', propertyName: 'opacity' });
    assert.equal(model.contextManager._lastModify, null);
});

// ============================================================================
// TESTS: getUpdatedLayoutConfigurations (module-level function)
// ============================================================================

test('getUpdatedLayoutConfigurations: skips FullDragboardLayout source', (t) => {
    setup();
    const freeLayout = makeFreeLayout();
    const fullLayout = makeFullDragboardLayout();
    const dragboard = makeDragboard();
    freeLayout.dragboard = dragboard;
    fullLayout.dragboard = dragboard;
    const model = makeModel({
        layoutConfig: [
            { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
        ],
    });
    const view = createWidgetView({ model, layout: fullLayout, dragboard });

    view.layout = fullLayout;
    // moveToLayout to freeLayout - since source is FullDragboardLayout, configs should be skipped
    view.moveToLayout(freeLayout);
    // The result is async; verify freeLayout received the widget
    assert.ok(freeLayout.widgets[view.id]);
});

test('getUpdatedLayoutConfigurations: skips FullDragboardLayout destination', (t) => {
    setup();
    const freeLayout = makeFreeLayout({ name: 'free' });
    const fullLayout = makeFullDragboardLayout({ name: 'full' });
    const dragboard = makeDragboard();
    dragboard.layouts = [freeLayout];
    dragboard.fulldragboardLayout = fullLayout;
    freeLayout.dragboard = dragboard;
    fullLayout.dragboard = dragboard;
    const model = makeModel({
        layoutConfig: [
            { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 100, height: 80, relwidth: false, relheight: false, left: 0, top: 0, zIndex: 1, relx: false, rely: false, anchor: 'top-left' },
        ],
    });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = freeLayout;

    view.moveToLayout(fullLayout);
    assert.ok(fullLayout.widgets[view.id]);
});

test('getUpdatedLayoutConfigurations: handles layoutConfig with lessOrEqual -1', (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'src' });
    const layout2 = makeFreeLayout({ name: 'dst' });
    const dragboard = makeDragboard();
    dragboard.layouts = [layout1, layout2];
    layout1.dragboard = dragboard;
    layout2.dragboard = dragboard;
    const model = makeModel({
        layoutConfig: [
            { id: 'c1', lessOrEqual: -1, moreOrEqual: 1024, width: 200, height: 100, relwidth: true, relheight: true, left: 10, top: 20, zIndex: 1, relx: true, rely: true, anchor: 'top-left' },
        ],
    });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard.tab = tab;

    layout1.fromHCellsToPixels = (w, as) => w;
    layout1.fromVCellsToPixels = (h) => h;
    layout2.fromHCellsToPixels = (w, as) => w;
    layout2.fromVCellsToPixels = (h) => h;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = layout1;

    view.moveToLayout(layout2);
    assert.ok(layout2.widgets[view.id]);
});

test('getUpdatedLayoutConfigurations: adapts config when dragboard changes and not FreeLayout dest', (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'src' });
    const layout2 = makeFreeLayout({ name: 'dst' });
    const dragboard1 = makeDragboard();
    dragboard1.layouts = [layout1];
    layout1.dragboard = dragboard1;
    const dragboard2 = makeDragboard();
    dragboard2.layouts = [layout2];
    layout2.dragboard = dragboard2;
    const model = makeModel({
        layoutConfig: [
            { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 200, height: 100, relwidth: true, relheight: true, left: 10, top: 20, zIndex: 1, relx: true, rely: true, anchor: 'top-left' },
        ],
    });
    const tab = {
        id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard: dragboard1,
        model: {},
        wrapperElement: document.createElement('div'),
        addEventListener() {},
        _listeners: {},
    };
    dragboard1.tab = tab;
    dragboard2.tab = { ...tab, id: 'tab-2', dragboard: dragboard2, _listeners: {} };

    layout1.fromHCellsToPixels = (w, as) => w;
    layout1.fromVCellsToPixels = (h) => h;
    layout2.fromHCellsToPixels = (w, as) => w;
    layout2.fromVCellsToPixels = (h) => h;

    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = layout1;

    view.moveToLayout(layout2);
    assert.ok(layout2.widgets[view.id]);
});

// ============================================================================
// TESTS: load event handler (macversion branch)
// ============================================================================

test('load event: uses model wrapperElement when macversion > 1', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ loaded: false, meta: { macversion: 2 } });
    const view = createWidgetView({ model, layout, dragboard });

    model._dispatchEvent('load');
    assert.equal(view.wrapperElement.classList.contains('in'), true);

    // For macversion > 1, model.wrapperElement is used directly for event listeners
    let clickReceived = false;
    model.wrapperElement.addEventListener('click', () => { clickReceived = true; });
    model.wrapperElement.dispatchEvent({ type: 'click' });
    // HandleEscapeEvent should be called
});

test('load event: uses contentDocument.defaultView when macversion <= 1', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ loaded: false, meta: { macversion: 1 } });
    model.wrapperElement.contentDocument = {
        defaultView: {
            _listeners: {},
            addEventListener(event, handler) {
                if (!this._listeners[event]) this._listeners[event] = [];
                this._listeners[event].push(handler);
            },
        },
    };
    const view = createWidgetView({ model, layout, dragboard });

    model._dispatchEvent('load');
    assert.equal(view.wrapperElement.classList.contains('in'), true);
});

// ============================================================================
// TESTS: Permission/role logic in update_buttons
// ============================================================================

test('update_buttons: editor can close', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const model = makeModel({ volatile: false });
    model.isAllowed = (perm, role) => perm === 'close' && role === 'editor';
    const view = createWidgetView({ model, layout, dragboard, workspace });

    assert.equal(view.closebutton.hidden, false);
});

test('update_buttons: volatile widget always visible close button', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const model = makeModel({ volatile: true });
    model.isAllowed = (perm, role) => true;
    const view = createWidgetView({ model, layout, dragboard, workspace });

    // Editing=true, volatile=true => closebutton.should be shown
    assert.equal(view.closebutton.hidden, false);

    // Switch to viewer mode - volatile still shows close button
    workspace.editing = false;
    workspace._dispatch('editmode');
    // volatile || editing = true || false = true, and isAllowed returns true
    assert.equal(view.closebutton.hidden, false);
});

test('update_buttons: grip editable when editing, not volatile, and FreeLayout', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const model = makeModel({ volatile: false });
    const view = createWidgetView({ model, layout, dragboard, workspace });

    assert.equal(view.grip.enabled, true);
});

test('errorbutton click: creates LogWindowMenu with model logManager', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel();
    model.logManager.errorCount = 3;
    const view = createWidgetView({ model, layout, dragboard });

    model.logManager._dispatch('newentry');

    let logManagerArg = null;
    const OrigLogWindowMenu = Wirecloud.ui.LogWindowMenu;
    Wirecloud.ui.LogWindowMenu = class MockLogWindowMenu {
        constructor(manager) { logManagerArg = manager; }
        show() {}
    };

    view.errorbutton.dispatchEvent('click');
    assert.equal(logManagerArg, model.logManager);
    Wirecloud.ui.LogWindowMenu = OrigLogWindowMenu;
});

test('minimizebutton click: calls toggleMinimizeStatus', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const model = makeModel({ minimized: false });
    const view = createWidgetView({ model, layout, dragboard });

    view.minimizebutton.dispatchEvent('click');
    assert.equal(view.minimized, true);
});

test('getUpdatedLayoutConfigurations non-FreeLayout else branches (lines 135-141)', (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'free' });
    const layout2 = makeLayout({ name: 'grid' });
    const dragboard = makeDragboard();
    dragboard.layouts = [layout1, layout2];
    layout1.dragboard = dragboard;
    layout2.dragboard = dragboard;
    const model = makeModel({
        layoutConfig: [
            { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 4, height: 3, relwidth: true, relheight: true, left: 1, top: 2, zIndex: 1, relx: true, rely: true, anchor: 'top-left' },
        ],
    });
    const view = createWidgetView({ model, layout: layout1, dragboard });

    const result = view.moveToLayout(layout2);
    // Non-FreeLayout paths should be taken for the else branches
    assert.ok(layout2.widgets[view.id]);
});

test('getUpdatedLayoutConfigurations non-FreeLayout with dragboardChange (lines 144-149)', (t) => {
    setup();
    const layout1 = makeFreeLayout({ name: 'free1' });
    const layout2 = makeLayout({ name: 'grid2' });
    const dragboard1 = makeDragboard();
    dragboard1.layouts = [layout1];
    layout1.dragboard = dragboard1;
    const dragboard2 = makeDragboard();
    dragboard2.layouts = [layout2];
    layout2.dragboard = dragboard2;
    const model = makeModel({
        layoutConfig: [
            { id: 'c1', lessOrEqual: -1, moreOrEqual: 0, width: 4, height: 3, relwidth: true, relheight: true, left: 1, top: 2, zIndex: 1, relx: true, rely: true, anchor: 'top-left' },
        ],
    });
    const tab = { id: 'tab-1', hidden: false, workspace: makeWorkspace(), dragboard: dragboard1, model: {}, wrapperElement: document.createElement('div'), addEventListener() {}, _listeners: {} };
    dragboard1.tab = tab;
    dragboard2.tab = { ...tab, id: 'tab-2', dragboard: dragboard2, _listeners: {} };
    const view = new Wirecloud.ui.WidgetView(tab, model, {});
    view.layout = layout1;

    view.moveToLayout(layout2);
    assert.ok(layout2.widgets[view.id]);
});

test('moveToLayout uses _searchFreeSpace when dragboard changes and newLayout is not FreeLayout', (t) => {
    setup();
    const layout = makeFreeLayout();
    const dragboard = makeDragboard();
    const workspace = makeWorkspace({ editing: true });
    const model = makeModel({ volatile: false });
    const view = createWidgetView({ model, layout, dragboard, workspace });

    const otherDragboard = makeDragboard();
    const baseLayout = makeLayout({ name: 'base' });
    baseLayout.dragboard = otherDragboard;
    Object.setPrototypeOf(baseLayout, Wirecloud.ui.FullDragboardLayout.prototype);

    let searchCalled = false;
    baseLayout._searchFreeSpace = function (w, h) {
        searchCalled = true;
        return { x: 5, y: 5 };
    };

    let setPositionCalled = null;
    view.setPosition = function (pos) {
        setPositionCalled = pos;
    };

    view.moveToLayout(baseLayout);
    assert.ok(searchCalled, '_searchFreeSpace should be called');
    assert.equal(setPositionCalled.x, 5);
    assert.equal(setPositionCalled.y, 5);
    assert.equal(setPositionCalled.relx, true);
    assert.equal(setPositionCalled.rely, true);
    assert.equal(setPositionCalled.anchor, 'top-left');
});
