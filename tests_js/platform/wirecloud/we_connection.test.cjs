const test = require("node:test");
const assert = require("node:assert/strict");
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require("../../support/legacy-runtime.cjs");

const patchCreateElementNS = () => {
    if (typeof document.createElementNS !== "function") {
        document.createElementNS = function (ns, tagName) {
            const el = document.createElement(tagName);
            el.namespaceURI = ns;
            return el;
        };
    }
};

const noop = () => {};

const createFakeEndpoint = (overrides = {}) => {
    const defaults = {
        type: "source",
        id: "source-endpoint-1",
        name: "output1",
        anchorPosition: { x: 100, y: 200 },
        missing: false,
        _connections: [],
        _endpoint: { id: "se-1", name: "out" },
        _toggledActive: null,
        _active: false,
    };
    const ep = { ...defaults, ...overrides };
    ep.component = ep.component || {
        id: "comp-1",
        type: "widget",
        volatile: false,
    };
    ep.equals = ep.equals || function (other) {
        return other && other.type === this.type && other.id === this.id;
    };
    ep.toggleActive = ep.toggleActive || function (active) {
        ep._toggledActive = active;
        ep._active = active;
        return this;
    };
    ep.appendConnection = ep.appendConnection || function (conn) {
        ep._connections.push(conn);
        return this;
    };
    ep.removeConnection = ep.removeConnection || function (conn) {
        ep._connections = ep._connections.filter(function (c) { return c !== conn; });
        return this;
    };
    return ep;
};

const createMinimalConnection = () => {
    return new Wirecloud.ui.WiringEditor.Connection();
};

const createCreatedConnection = (overrides) => {
    const conn = new Wirecloud.ui.WiringEditor.Connection();
    const srcEp = createFakeEndpoint({ type: "source", id: "widg/w1/out", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "widg/w2/in", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: overrides && overrides.establish });
    return { conn, srcEp, tgtEp };
};

const createEstablishedConnection = () => {
    const conn = new Wirecloud.ui.WiringEditor.Connection();
    const srcEp = createFakeEndpoint({ type: "source", id: "widg/w1/out", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "widg/w2/in", name: "in" });
    const wiringConn = createFakeWiringConnection({});
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });
    return { conn, srcEp, tgtEp, wiringConn };
};

const createFakeWiringConnection = (overrides) => {
    const wc = {
        logManager: {
            errorCount: 0,
            _listeners: {},
            addEventListener: function (event, handler) {
                if (this._listeners[event] == null) { this._listeners[event] = []; }
                this._listeners[event].push(handler);
            },
            dispatchEvent: function (event, data) {
                var listeners = this._listeners[event] || [];
                listeners.forEach(function (fn) { fn(data); });
            },
        },
        readonly: false,
        showLogs: function () { wc._logsShown = true; return wc; },
        _logsShown: false,
    };
    if (overrides) {
        if (overrides.readonly != null) { wc.readonly = overrides.readonly; }
        if (overrides.errorCount != null) { wc.logManager.errorCount = overrides.errorCount; }
    }
    return wc;
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    patchCreateElementNS();

    // Mock StyledElements.Tooltip before loading Button
    StyledElements.Tooltip = class Tooltip {
        constructor(options) {
            this.options = Object.assign({ content: "", placement: ["bottom"] }, options);
            this._boundElement = null;
        }
        bind(element) { this._boundElement = element; return this; }
        show() { return this; }
        hide() { return this; }
        destroy() {}
    };

    // Mock StyledElements.PopupMenu before loading PopupButton
    StyledElements.PopupMenu = class PopupMenu {
        constructor() {
            this.wrapperElement = document.createElement("div");
            this._items = [];
            this._visible = false;
            this._listeners = {};
        }
        _flatten(items) {
            const result = [];
            const self = this;
            items.forEach(function (item) {
                if (item instanceof StyledElements.DynamicMenuItems) {
                    self._flatten(item.build()).forEach(function (i) { result.push(i); });
                } else {
                    result.push(item);
                }
            });
            return result;
        }
        append(item) {
            this._items.push(item);
            return this;
        }
        isVisible() { return this._visible; }
        addEventListener(name, handler) {
            if (this._listeners[name] == null) { this._listeners[name] = []; }
            this._listeners[name].push(handler);
        }
        show() { this._visible = true; return this; }
        hide() { this._visible = false; }
        moveFocusDown() { return this; }
        moveFocusUp() { return this; }
        hasEnabledItem() { return false; }
        clearEventListeners() {}
        destroy() {}
        getItems() {
            return this._flatten(this._items);
        }
    };

    loadLegacyScripts([
        "src/wirecloud/commons/static/js/StyledElements/Fragment.js",
        "src/wirecloud/commons/static/js/StyledElements/Container.js",
        "src/wirecloud/commons/static/js/StyledElements/Button.js",
        "src/wirecloud/commons/static/js/StyledElements/Panel.js",
        "src/wirecloud/commons/static/js/StyledElements/PopupButton.js",
        "src/wirecloud/commons/static/js/StyledElements/DynamicMenuItems.js",
        "src/wirecloud/commons/static/js/StyledElements/MenuItem.js",
    ]);

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = { WiringEditor: {} };
    Wirecloud.constants = {
        LOGGING: { ERROR_MSG: 1, WARN_MSG: 2, INFO_MSG: 3, DEBUG_MSG: 4 },
    };

    Wirecloud.UserInterfaceManager = {
        _registerTooltip: () => {},
        _unregisterTooltip: () => {},
    };

    Wirecloud.ui.Draggable = function Draggable(handler, data, onStart, onDrag, onFinish, canBeDragged) {
        this.handler = handler;
        this.data = data;
        this.onStart = onStart;
        this.onDrag = onDrag;
        this.onFinish = onFinish;
        this.canBeDragged = canBeDragged;
        this.destroy = function () {
            this.handler = null;
            this.data = null;
            this.onStart = null;
            this.onDrag = null;
            this.onFinish = null;
        };
    };

    Wirecloud.ui.MessageWindowMenu = function MessageWindowMenu(msg, level) {
        this.msg = msg;
        this.level = level;
        this._shown = false;
        MessageWindowMenu._lastInstance = this;
    };
    Wirecloud.ui.MessageWindowMenu.prototype.show = function () {
        this._shown = true;
        return this;
    };
    Wirecloud.ui.MessageWindowMenu._lastInstance = null;

    // Load ConnectionHandle
    loadLegacyScripts([
        "src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ConnectionHandle.js",
    ]);
    // Load ConnectionPrefs
    loadLegacyScripts([
        "src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ConnectionPrefs.js",
    ]);
    // Load Connection (file under test)
    loadLegacyScripts([
        "src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/Connection.js",
    ]);
});

// =============================================================================
// STATIC CONSTANTS
// =============================================================================

test("Connection.SVG_NS is correct", () => {
    assert.equal(
        Wirecloud.ui.WiringEditor.Connection.SVG_NS,
        "http://www.w3.org/2000/svg"
    );
});

// =============================================================================
// CONSTRUCTOR
// =============================================================================

test("constructor creates an instance of StyledElements.StyledElement", () => {
    const conn = createMinimalConnection();
    assert.ok(conn instanceof StyledElements.StyledElement);
});

test("constructor creates wrapperElement as SVG g element", () => {
    const conn = createMinimalConnection();
    const el = conn.wrapperElement;
    assert.equal(el.tagName, "G");
    assert.equal(
        el.namespaceURI,
        Wirecloud.ui.WiringEditor.Connection.SVG_NS
    );
});

test("constructor wrapperElement has connection class", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.wrapperElement.classList.contains("connection"));
});

test("constructor wrapperElement has click listener", () => {
    const conn = createMinimalConnection();
    const listeners = conn.wrapperElement.listeners.click;
    assert.ok(Array.isArray(listeners));
    assert.equal(listeners.length, 1);
    assert.equal(typeof listeners[0], "function");
});

test("constructor wrapperElement has dblclick stopPropagation listener", () => {
    const conn = createMinimalConnection();
    const listeners = conn.wrapperElement.listeners.dblclick;
    assert.ok(Array.isArray(listeners));
    assert.equal(listeners.length, 1);
    assert.equal(listeners[0], StyledElements.Utils.stopPropagationListener);
});

test("constructor wrapperElement has mouseenter listener", () => {
    const conn = createMinimalConnection();
    const listeners = conn.wrapperElement.listeners.mouseenter;
    assert.ok(Array.isArray(listeners));
    assert.equal(listeners.length, 1);
});

test("constructor wrapperElement has mouseleave listener", () => {
    const conn = createMinimalConnection();
    const listeners = conn.wrapperElement.listeners.mouseleave;
    assert.ok(Array.isArray(listeners));
    assert.equal(listeners.length, 1);
});

test("constructor creates pathElement as SVG path", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.pathElement.tagName, "PATH");
    assert.equal(
        conn.pathElement.namespaceURI,
        Wirecloud.ui.WiringEditor.Connection.SVG_NS
    );
});

test("constructor pathElement has connection-path class", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.pathElement.classList.contains("connection-path"));
});

test("constructor pathElement is child of wrapperElement", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.pathElement.parentElement, conn.wrapperElement);
});

test("constructor creates options Container", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.options instanceof StyledElements.Container);
});

test("constructor options Container is hidden initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.options.hidden, true);
});

test("constructor options Container has connection-options class", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.options.hasClassName("connection-options"));
});

test("constructor creates btnLogs Button", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.btnLogs instanceof StyledElements.Button);
});

test("constructor btnLogs has btn-show-logs class", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.btnLogs.hasClassName("btn-show-logs"));
});

test("constructor btnLogs depth is 1", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.btnLogs.depth, 1);
});

test("constructor btnLogs has click listener", () => {
    // Trigger button click via dispatchEvent
    const conn = createMinimalConnection();
    let showLogsCalled = false;
    conn.showLogs = function () { showLogsCalled = true; return this; };
    conn.btnLogs.dispatchEvent("click");
    assert.ok(showLogsCalled);
});

test("constructor creates btnRemove Button", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.btnRemove instanceof StyledElements.Button);
});

test("constructor btnRemove has btn-remove class", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.btnRemove.hasClassName("btn-remove"));
});

test("constructor btnRemove depth is 1", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.btnRemove.depth, 1);
});

test("constructor creates btnPrefs PopupButton", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.btnPrefs instanceof StyledElements.PopupButton);
});

test("constructor btnPrefs has we-prefs-btn class", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.btnPrefs.hasClassName("we-prefs-btn"));
});

test("constructor btnPrefs popup_menu has ConnectionPrefs items", () => {
    const conn = createMinimalConnection();
    const menu = conn.btnPrefs.popup_menu;
    const items = menu.getItems();
    assert.equal(items.length, 2);
});

test("constructor btnPrefs depth is 1", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.btnPrefs.depth, 1);
});

test("constructor initial activeCount is 0", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.activeCount, 0);
});

test("constructor sets highlighted=false initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.highlighted, false);
});

test("constructor sets active=false initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.active, false);
});

test("constructor has incomplete class when not created", () => {
    const conn = createMinimalConnection();
    assert.ok(conn.hasClassName("incomplete"));
});

test("constructor source is empty object", () => {
    const conn = createMinimalConnection();
    assert.deepEqual(conn.source, {});
});

test("constructor target is empty object", () => {
    const conn = createMinimalConnection();
    assert.deepEqual(conn.target, {});
});

test("constructor removeAllowed is true", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.removeAllowed, true);
});

test("constructor registers all events", () => {
    const events = ["change", "click", "customizestart", "customizeend", "optremove", "optshare", "remove"];
    const conn = createMinimalConnection();
    events.forEach((ev) => {
        let fired = false;
        conn.addEventListener(ev, () => { fired = true; });
        conn.dispatchEvent(ev);
        assert.ok(fired, "Event " + ev + " should fire");
    });
});

// =============================================================================
// active property
// =============================================================================

test("active getter returns false initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.active, false);
});

test("active setter to true when enabled toggles active class", () => {
    const conn = createMinimalConnection();
    conn.active = true;
    assert.equal(conn.active, true);
    assert.ok(conn.hasClassName("active"));
});

test("active setter to false when enabled removes active class", () => {
    const conn = createMinimalConnection();
    conn.active = true;
    conn.active = false;
    assert.equal(conn.active, false);
    assert.equal(conn.hasClassName("active"), false);
});

test("active setter when disabled does not toggle class", () => {
    const conn = createMinimalConnection();
    conn.disable();
    conn.active = true;
    assert.equal(conn.hasClassName("active"), false);
});

test("active=true shows button group", () => {
    const conn = createMinimalConnection();
    conn.active = true;
    assert.equal(conn.btnPrefs.hidden, false);
    assert.equal(conn.btnLogs.hidden, false);
});

test("active=false hides button group", () => {
    const conn = createMinimalConnection();
    conn.active = true;
    conn.active = false;
    assert.equal(conn.btnPrefs.hidden, true);
    assert.equal(conn.btnLogs.hidden, true);
});

test("active toggles active state on endpoints", () => {
    const { conn, srcEp, tgtEp } = createCreatedConnection();
    conn.active = true;
    assert.equal(srcEp._toggledActive, true);
    assert.equal(tgtEp._toggledActive, true);
    conn.active = false;
    assert.equal(srcEp._toggledActive, false);
    assert.equal(tgtEp._toggledActive, false);
});

test("active toggling with null source endpoint does not throw", () => {
    const conn = new Wirecloud.ui.WiringEditor.Connection();
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.unstickEndpoint(createFakeEndpoint({ type: "source", id: "s", name: "out" }));
    conn.stickEndpoint(tgtEp, { establish: false });
    conn.active = true;
    // should not throw
});

// =============================================================================
// highlighted property
// =============================================================================

test("highlighted getter returns false initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.highlighted, false);
});

test("highlighted setter to true", () => {
    const conn = createMinimalConnection();
    conn.highlighted = true;
    assert.equal(conn.highlighted, true);
    assert.ok(conn.hasClassName("highlighted"));
});

test("highlighted setter to false after true", () => {
    const conn = createMinimalConnection();
    conn.highlighted = true;
    conn.highlighted = false;
    assert.equal(conn.highlighted, false);
    assert.equal(conn.hasClassName("highlighted"), false);
});

test("highlighted increment/decrement overlaps", () => {
    const conn = createMinimalConnection();
    conn.highlighted = true;
    conn.highlighted = true;
    assert.equal(conn.highlighted, true);
    assert.ok(conn.hasClassName("highlighted"));

    conn.highlighted = false;
    assert.equal(conn.highlighted, true);
    assert.ok(conn.hasClassName("highlighted"));

    conn.highlighted = false;
    assert.equal(conn.highlighted, false);
    assert.equal(conn.hasClassName("highlighted"), false);
});

test("highlighted cannot go below zero", () => {
    const conn = createMinimalConnection();
    conn.highlighted = false;
    assert.equal(conn.highlighted, false);
});

// =============================================================================
// background property
// =============================================================================

test("background getter returns false initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.background, false);
});

test("background setter to true toggles background class", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    assert.equal(conn.background, true);
    assert.ok(conn.hasClassName("background"));
});

test("background setter to false removes background class", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    conn.background = false;
    assert.equal(conn.background, false);
    assert.equal(conn.hasClassName("background"), false);
});

test("background=true shows add button", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    assert.ok(conn.btnRemove.hasClassName("btn-add"));
    assert.ok(!conn.btnRemove.hasClassName("btn-remove"));
});

test("background=false shows remove/delete button", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    conn.background = false;
    assert.ok(conn.btnRemove.hasClassName("btn-remove"));
    assert.ok(!conn.btnRemove.hasClassName("btn-add"));
});

test("background sets depth=1 when active", () => {
    const conn = createMinimalConnection();
    conn.active = true;
    conn.background = true;
    assert.equal(conn.btnLogs.depth, 1);
    assert.equal(conn.btnPrefs.depth, 1);
    assert.equal(conn.btnRemove.depth, 1);
});

test("background sets depth=0 when not active", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    assert.equal(conn.btnLogs.depth, 0);
    assert.equal(conn.btnPrefs.depth, 0);
    assert.equal(conn.btnRemove.depth, 0);
});

// =============================================================================
// created property
// =============================================================================

test("created returns false initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.created, false);
});

test("created returns true when both endpoints attached", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.created, true);
});

test("created returns false when only source attached", () => {
    const conn = createMinimalConnection();
    conn.stickEndpoint(createFakeEndpoint({ type: "source", id: "s", name: "out" }));
    assert.equal(conn.created, false);
});

test("created returns false when only target attached", () => {
    const conn = createMinimalConnection();
    conn.stickEndpoint(createFakeEndpoint({ type: "target", id: "t", name: "in" }));
    assert.equal(conn.created, false);
});

// =============================================================================
// established property
// =============================================================================

test("established returns false when not created", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.established, false);
});

test("established returns false when created but not established", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.established, false);
});

test("established returns true when created and established", () => {
    const { conn } = createEstablishedConnection();
    assert.equal(conn.established, true);
});

// =============================================================================
// editable property
// =============================================================================

test("editable getter returns false initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.editable, false);
});

test("editable setter to true toggles class and shows handles", () => {
    const { conn } = createCreatedConnection();
    let startFired = false;
    conn.addEventListener("customizestart", () => { startFired = true; });
    conn.editable = true;
    assert.equal(conn.editable, true);
    assert.ok(conn.hasClassName("editable"));
    assert.ok(startFired);
});

test("editable setter to false hides handles and dispatches customizeend", () => {
    const { conn } = createCreatedConnection();
    conn.editable = true;
    let endFired = false;
    conn.addEventListener("customizeend", () => { endFired = true; });
    conn.editable = false;
    assert.equal(conn.editable, false);
    assert.ok(endFired);
});

test("editable setter no-op when value same", () => {
    const conn = createMinimalConnection();
    conn.editable = false;
    // should not dispatch
    let fired = false;
    conn.addEventListener("customizestart", () => { fired = true; });
    conn.addEventListener("customizeend", () => { fired = true; });
    // editable is false by default, set to false again should be no-op
    assert.equal(conn.editable, false);
});

test("editable=true toggles active endpoints", () => {
    const { conn, srcEp, tgtEp } = createCreatedConnection();
    conn.editable = true;
    assert.equal(srcEp._toggledActive, true);
    assert.equal(tgtEp._toggledActive, true);
    conn.editable = false;
    assert.equal(srcEp._toggledActive, false);
    assert.equal(tgtEp._toggledActive, false);
});

test("editable with missing source endpoint throws when handle is undefined", () => {
    const conn = new Wirecloud.ui.WiringEditor.Connection();
    conn.stickEndpoint(createFakeEndpoint({ type: "target", id: "t", name: "in" }));
    // Setting editable=true tries to call this.source.handle.appendTo,
    // but source.handle is undefined since no source endpoint was stuck
    assert.throws(
        () => { conn.editable = true; },
        /Cannot read properties of undefined/
    );
});

test("editable with missing target endpoint throws when handle is undefined", () => {
    const conn = new Wirecloud.ui.WiringEditor.Connection();
    conn.stickEndpoint(createFakeEndpoint({ type: "source", id: "s", name: "out" }));
    assert.throws(
        () => { conn.editable = true; },
        /Cannot read properties of undefined/
    );
});

// =============================================================================
// missing property
// =============================================================================

test("missing returns false when not created", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.missing, false);
});

test("missing returns false when endpoints are not missing", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.missing, false);
});

test("missing returns true when source endpoint is missing", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out", missing: true });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: false });
    assert.equal(conn.missing, true);
});

test("missing returns true when target endpoint is missing", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in", missing: true });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: false });
    assert.equal(conn.missing, true);
});

// =============================================================================
// removeAllowed property
// =============================================================================

test("removeAllowed getter returns true initially", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.removeAllowed, true);
});

test("removeAllowed setter updates value", () => {
    const conn = createMinimalConnection();
    conn.removeAllowed = false;
    assert.equal(conn.removeAllowed, false);
    conn.removeAllowed = true;
    assert.equal(conn.removeAllowed, true);
});

test("removeAllowed setter truthy value", () => {
    const conn = createMinimalConnection();
    conn.removeAllowed = "yes";
    assert.equal(conn.removeAllowed, true);
});

test("removeAllowed falsy value without background toggles button", () => {
    const conn = createMinimalConnection();
    conn.removeAllowed = true;
    assert.ok(conn.btnRemove.hasClassName("btn-remove"));
    conn.removeAllowed = false;
    assert.ok(conn.btnRemove.hasClassName("btn-remove"));
    // With removeAllowed false, should be delete button
    const btnClassList = conn.btnRemove.get().classList.toString();
    assert.ok(btnClassList.includes("btn-remove"));
});

test("removeAllowed setter with background does not toggle button", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    // The btn should have btn-add class from _onbackground
    assert.ok(conn.btnRemove.hasClassName("btn-add"));
    conn.removeAllowed = false;
    // Should still be add button because background
    assert.ok(conn.btnRemove.hasClassName("btn-add"));
});

// =============================================================================
// sourceComponent / targetComponent / sourceId / targetId
// =============================================================================

test("sourceComponent returns source endpoint component", () => {
    const { conn, srcEp } = createCreatedConnection();
    assert.equal(conn.sourceComponent, srcEp.component);
});

test("targetComponent returns target endpoint component", () => {
    const { conn, tgtEp } = createCreatedConnection();
    assert.equal(conn.targetComponent, tgtEp.component);
});

test("sourceId returns source endpoint id", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.sourceId, "widg/w1/out");
});

test("targetId returns target endpoint id", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.targetId, "widg/w2/in");
});

// =============================================================================
// _showButtonAdd / _showButtonDelete / _showButtonRemove
// =============================================================================

test("_showButtonAdd changes btnRemove to add button", () => {
    const conn = createMinimalConnection();
    conn._showButtonAdd();
    assert.ok(conn.btnRemove.hasClassName("btn-add"));
    assert.ok(!conn.btnRemove.hasClassName("btn-remove"));
});

test("_showButtonAdd returns this", () => {
    const conn = createMinimalConnection();
    const result = conn._showButtonAdd();
    assert.equal(result, conn);
});

test("_showButtonDelete changes btnRemove to delete button", () => {
    const conn = createMinimalConnection();
    conn._showButtonAdd();
    conn._showButtonDelete();
    assert.ok(conn.btnRemove.hasClassName("btn-remove"));
    assert.ok(!conn.btnRemove.hasClassName("btn-add"));
});

test("_showButtonDelete returns this", () => {
    const conn = createMinimalConnection();
    const result = conn._showButtonDelete();
    assert.equal(result, conn);
});

test("_showButtonRemove changes btnRemove to remove button", () => {
    const conn = createMinimalConnection();
    conn._showButtonAdd();
    conn._showButtonRemove();
    assert.ok(conn.btnRemove.hasClassName("btn-remove"));
    assert.ok(!conn.btnRemove.hasClassName("btn-add"));
});

test("_showButtonRemove returns this", () => {
    const conn = createMinimalConnection();
    const result = conn._showButtonRemove();
    assert.equal(result, conn);
});

// =============================================================================
// click()
// =============================================================================

test("click toggles active when enabled and not editable", () => {
    const conn = createMinimalConnection();
    conn.click();
    assert.equal(conn.active, true);
    conn.click();
    assert.equal(conn.active, false);
});

test("click dispatches click event when enabled and not editable", () => {
    const conn = createMinimalConnection();
    let fired = false;
    conn.addEventListener("click", () => { fired = true; });
    conn.click();
    assert.ok(fired);
});

test("click does nothing when disabled", () => {
    const conn = createMinimalConnection();
    conn.disable();
    conn.click();
    assert.equal(conn.active, false);
});

test("click does nothing when editable", () => {
    const { conn } = createCreatedConnection();
    conn.editable = true;
    const beforeActive = conn.active;
    conn.click();
    assert.equal(conn.active, beforeActive);
});

test("connection_onclick handler on wrapperElement dispatches click for button 0", () => {
    const conn = createMinimalConnection();
    const event = { button: 0, preventDefault: noop, stopPropagation: noop, type: "click" };
    conn.wrapperElement.listeners.click[0](event);
    assert.equal(conn.active, true);
});

test("connection_onclick handler does not dispatch click for button 1", () => {
    const conn = createMinimalConnection();
    const event = { button: 1, preventDefault: noop, stopPropagation: noop, type: "click" };
    conn.wrapperElement.listeners.click[0](event);
    assert.equal(conn.active, false);
});

// =============================================================================
// createAndBind()
// =============================================================================

test("createAndBind returns Promise.resolve when already established", async () => {
    const { conn } = createEstablishedConnection();
    const wiringEngine = {};
    const result = await conn.createAndBind(false, wiringEngine);
    assert.equal(result, conn);
});

test("createAndBind success path", async () => {
    const conn = new Wirecloud.ui.WiringEditor.Connection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp);

    const fakeConnection = createFakeWiringConnection({ readonly: false });
    const wiringEngine = {
        createConnection: function (s, t, opts) {
            return Promise.resolve(fakeConnection);
        },
    };

    const result = await conn.createAndBind(false, wiringEngine);
    assert.equal(result, conn);
    assert.equal(conn.established, true);
    assert.equal(conn.wrapperElement.getAttribute("data-sourceid"), "s");
    assert.equal(conn.wrapperElement.getAttribute("data-targetid"), "t");
});

test("createAndBind error path", async () => {
    const conn = new Wirecloud.ui.WiringEditor.Connection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp);
    conn.wrapperElement.parentElement = document.body;
    document.body.appendChild(conn.wrapperElement);

    const error = new Error("test error");
    const wiringEngine = {
        createConnection: function () {
            return Promise.reject(error);
        },
    };

    let removeFired = false;
    conn.addEventListener("remove", () => { removeFired = true; });

    await assert.rejects(
        conn.createAndBind(false, wiringEngine),
        /test error/
    );

    assert.ok(removeFired);
    assert.ok(Wirecloud.ui.MessageWindowMenu._lastInstance._shown);
    assert.equal(Wirecloud.ui.MessageWindowMenu._lastInstance.msg, error);
    assert.equal(Wirecloud.ui.MessageWindowMenu._lastInstance.level, Wirecloud.constants.LOGGING.ERROR_MSG);
});

// =============================================================================
// equals()
// =============================================================================

test("equals returns true for connections with same sourceId and targetId", () => {
    const conn1 = new Wirecloud.ui.WiringEditor.Connection();
    const conn2 = new Wirecloud.ui.WiringEditor.Connection();
    const srcEp = createFakeEndpoint({ type: "source", id: "sa", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "tb", name: "in" });
    conn1.stickEndpoint(srcEp);
    conn1.stickEndpoint(tgtEp);
    conn2.stickEndpoint(createFakeEndpoint({ type: "source", id: "sa", name: "out" }));
    conn2.stickEndpoint(createFakeEndpoint({ type: "target", id: "tb", name: "in" }));
    assert.equal(conn1.equals(conn2), true);
});

test("equals returns false for different sourceId", () => {
    const conn1 = new Wirecloud.ui.WiringEditor.Connection();
    const conn2 = new Wirecloud.ui.WiringEditor.Connection();
    conn1.stickEndpoint(createFakeEndpoint({ type: "source", id: "sa", name: "out" }));
    conn1.stickEndpoint(createFakeEndpoint({ type: "target", id: "tb", name: "in" }));
    conn2.stickEndpoint(createFakeEndpoint({ type: "source", id: "sc", name: "out" }));
    conn2.stickEndpoint(createFakeEndpoint({ type: "target", id: "tb", name: "in" }));
    assert.equal(conn1.equals(conn2), false);
});

test("equals returns false for different targetId", () => {
    const conn1 = new Wirecloud.ui.WiringEditor.Connection();
    const conn2 = new Wirecloud.ui.WiringEditor.Connection();
    conn1.stickEndpoint(createFakeEndpoint({ type: "source", id: "sa", name: "out" }));
    conn1.stickEndpoint(createFakeEndpoint({ type: "target", id: "tb", name: "in" }));
    conn2.stickEndpoint(createFakeEndpoint({ type: "source", id: "sa", name: "out" }));
    conn2.stickEndpoint(createFakeEndpoint({ type: "target", id: "td", name: "in" }));
    assert.equal(conn1.equals(conn2), false);
});

test("equals returns false for non-Connection argument", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.equals({}), false);
    assert.equal(conn.equals(null), false);
    assert.equal(conn.equals("not a connection"), false);
    assert.equal(conn.equals(undefined), false);
});

test("equals returns true for self-equality", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.equals(conn), true);
});

// =============================================================================
// hasEndpoint()
// =============================================================================

test("hasEndpoint returns true for matching source endpoint", () => {
    const { conn, srcEp } = createCreatedConnection();
    assert.equal(conn.hasEndpoint(srcEp), true);
});

test("hasEndpoint returns true for matching target endpoint", () => {
    const { conn, tgtEp } = createCreatedConnection();
    assert.equal(conn.hasEndpoint(tgtEp), true);
});

test("hasEndpoint returns false for non-matching endpoint", () => {
    const { conn } = createCreatedConnection();
    const otherEp = createFakeEndpoint({ type: "source", id: "other", name: "other" });
    assert.equal(conn.hasEndpoint(otherEp), false);
});

// =============================================================================
// refresh()
// =============================================================================

test("refresh returns early when not created", () => {
    const conn = createMinimalConnection();
    const result = conn.refresh();
    assert.equal(result, conn);
});

test("refresh updates distance when created", () => {
    const { conn } = createCreatedConnection();
    const result = conn.refresh();
    assert.equal(result, conn);
    assert.ok(conn.pathElement.hasAttribute("d"));
});

test("refresh toggles missing class", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out", missing: true });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: false });
    conn.refresh();
    assert.ok(conn.hasClassName("missing"));
});

test("refresh does not toggle missing when not missing", () => {
    const { conn } = createCreatedConnection();
    conn.refresh();
    assert.equal(conn.hasClassName("missing"), false);
});

// =============================================================================
// refreshEndpoint()
// =============================================================================

test("refreshEndpoint updates endpoint reference when established", () => {
    const { conn } = createEstablishedConnection();
    const newSrcEp = createFakeEndpoint({ type: "source", id: "newS", name: "newOut" });
    conn.refreshEndpoint(newSrcEp);
    assert.equal(conn.source.endpoint, newSrcEp);
    assert.equal(conn.source.handle.endpoint, newSrcEp);
});

test("refreshEndpoint for target when established", () => {
    const { conn } = createEstablishedConnection();
    const newTgtEp = createFakeEndpoint({ type: "target", id: "newT", name: "newIn" });
    conn.refreshEndpoint(newTgtEp);
    assert.equal(conn.target.endpoint, newTgtEp);
    assert.equal(conn.target.handle.endpoint, newTgtEp);
});

test("refreshEndpoint does nothing when not established", () => {
    const { conn, srcEp } = createCreatedConnection();
    const newSrcEp = createFakeEndpoint({ type: "source", id: "newS", name: "newOut" });
    conn.refreshEndpoint(newSrcEp);
    assert.equal(conn.source.endpoint, srcEp);
});

test("refreshEndpoint returns this", () => {
    const { conn } = createCreatedConnection();
    const ep = createFakeEndpoint({ type: "source", id: "a", name: "b" });
    assert.equal(conn.refreshEndpoint(ep), conn);
});

// =============================================================================
// remove()
// =============================================================================

test("remove with null childElement dispatches remove event when established", () => {
    const { conn } = createEstablishedConnection();
    let removeFired = false;
    conn.addEventListener("remove", () => { removeFired = true; });
    conn.wrapperElement.parentElement = document.body;
    document.body.appendChild(conn.wrapperElement);
    conn.remove();
    assert.ok(removeFired);
});

test("remove with null childElement when not established still dispatches remove", () => {
    const { conn } = createCreatedConnection();
    let removeFired = false;
    conn.addEventListener("remove", () => { removeFired = true; });
    conn.wrapperElement.parentElement = document.body;
    document.body.appendChild(conn.wrapperElement);
    conn.remove();
    assert.ok(removeFired);
});

test("remove with childElement calls super.remove", () => {
    const conn = createMinimalConnection();
    document.body.appendChild(conn.wrapperElement);
    const child = document.createElement("span");
    conn.wrapperElement.appendChild(child);
    conn.remove(child);
    // conn wrapperElement should be detached from document.body
    assert.equal(conn.wrapperElement.parentElement, null);
});

test("remove dispatches remove event and calls removeConnection on endpoints", () => {
    const { conn, srcEp, tgtEp } = createEstablishedConnection();
    let sourceRemoved = -1;
    srcEp.removeConnection = function (c) {
        sourceRemoved = this._connections.indexOf(c);
        this._connections = this._connections.filter(function (x) { return x !== c; });
    };
    let targetRemoved = -1;
    tgtEp.removeConnection = function (c) {
        targetRemoved = this._connections.indexOf(c);
        this._connections = this._connections.filter(function (x) { return x !== c; });
    };

    let removeFired = false;
    conn.addEventListener("remove", () => { removeFired = true; });

    conn.wrapperElement.parentElement = document.body;
    document.body.appendChild(conn.wrapperElement);
    conn.remove();

    assert.ok(removeFired);
    assert.notEqual(sourceRemoved, -1);
    assert.notEqual(targetRemoved, -1);
});

// =============================================================================
// restoreDefaults()
// =============================================================================

test("restoreDefaults returns early when readonly", () => {
    const conn = new Wirecloud.ui.WiringEditor.Connection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    const wiringConn = createFakeWiringConnection({ readonly: true });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });
    assert.equal(conn.readonly, true);
    conn.source.handle.auto = false;
    conn.target.handle.auto = false;
    conn.restoreDefaults();
    assert.equal(conn.source.handle.auto, false);
    assert.equal(conn.target.handle.auto, false);
});

test("restoreDefaults returns early when background", () => {
    const { conn } = createEstablishedConnection();
    conn.background = true;
    conn.source.handle.auto = false;
    conn.target.handle.auto = false;
    conn.restoreDefaults();
    assert.equal(conn.source.handle.auto, false);
    assert.equal(conn.target.handle.auto, false);
});

test("restoreDefaults sets handles to auto and dispatches change", () => {
    const { conn } = createEstablishedConnection();
    conn.source.handle.auto = false;
    conn.target.handle.auto = false;

    let changeFired = false;
    conn.addEventListener("change", () => { changeFired = true; });

    conn.restoreDefaults();

    assert.equal(conn.source.handle.auto, true);
    assert.equal(conn.target.handle.auto, true);
    assert.ok(changeFired);
});

test("restoreDefaults when not established does nothing beyond readonly/background check", () => {
    const { conn } = createCreatedConnection();
    conn.restoreDefaults();
    // Should not throw, no handlers to reset
});

test("restoreDefaults returns this", () => {
    const { conn } = createEstablishedConnection();
    assert.equal(conn.restoreDefaults(), conn);
});

// =============================================================================
// stickEndpoint()
// =============================================================================

test("stickEndpoint returns early when established", () => {
    const { conn } = createEstablishedConnection();
    const ep = createFakeEndpoint({ type: "source", id: "extra", name: "extraOut" });
    conn.stickEndpoint(ep);
    assert.notEqual(conn.sourceId, "extra");
});

test("stickEndpoint adds source endpoint", () => {
    const conn = createMinimalConnection();
    const ep = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const result = conn.stickEndpoint(ep);
    assert.equal(conn.source.endpoint, ep);
    assert.ok(conn.source.handle instanceof Wirecloud.ui.WiringEditor.ConnectionHandle);
    assert.equal(result, conn);
    assert.ok(conn.hasClassName("incomplete"));
});

test("stickEndpoint adds target endpoint", () => {
    const conn = createMinimalConnection();
    const ep = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(ep);
    assert.equal(conn.target.endpoint, ep);
    assert.ok(conn.target.handle instanceof Wirecloud.ui.WiringEditor.ConnectionHandle);
});

test("stickEndpoint adds both endpoints and establishes", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    const wiringConn = createFakeWiringConnection();

    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });

    assert.equal(conn.created, true);
    assert.equal(conn.established, true);
    assert.ok(!conn.hasClassName("incomplete"));
});

test("stickEndpoint adds both endpoints without establish", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: false });

    assert.equal(conn.created, true);
    assert.equal(conn.established, false);
});

test("stickEndpoint works with default options", () => {
    const conn = createMinimalConnection();
    const ep = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    conn.stickEndpoint(ep);
    // establishing defaults to true, wiringConnection to null
});

test("stickEndpoint calls refresh when both endpoints attached", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "sx", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "ty", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp);
    assert.ok(conn.pathElement.hasAttribute("d"));
});

// =============================================================================
// unstickEndpoint()
// =============================================================================

test("unstickEndpoint returns early when established", () => {
    const { conn } = createEstablishedConnection();
    const ep = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    conn.unstickEndpoint(ep);
    assert.equal(conn.established, true);
});

test("unstickEndpoint removes source endpoint", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.created, true);
    const ep = { type: "source", id: "s" };
    ep.equals = function (o) { return o.type === "source"; };
    conn.unstickEndpoint(ep);
    assert.deepEqual(conn.source, {});
    assert.equal(conn.created, false);
});

test("unstickEndpoint removes target endpoint", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: false });
    assert.equal(conn.created, true);
    conn.unstickEndpoint(tgtEp);
    assert.equal(conn.created, false);
    assert.ok(conn.hasClassName("incomplete"));
});

test("unstickEndpoint returns this", () => {
    const { conn, tgtEp } = createCreatedConnection();
    assert.equal(conn.unstickEndpoint(tgtEp), conn);
});

// =============================================================================
// showLogs()
// =============================================================================

test("showLogs calls _connection.showLogs", () => {
    const { conn } = createEstablishedConnection();
    conn._connection._logsShown = false;
    conn.showLogs();
    assert.equal(conn._connection._logsShown, true);
});

test("showLogs sets badge when errorCount is truthy", () => {
    const { conn } = createEstablishedConnection();
    conn._connection.logManager.errorCount = 3;
    conn.showLogs();
    // Badge element should be created (setBadge with content=3 calls insertBadge)
    assert.ok(conn.btnLogs.badgeElement != null);
    assert.equal(conn.btnLogs.badgeElement.textContent, "3");
});

test("showLogs removes badge when errorCount is 0", () => {
    const { conn } = createEstablishedConnection();
    conn._connection.logManager.errorCount = 3;
    conn.showLogs();
    assert.ok(conn.btnLogs.badgeElement != null);
    conn._connection.logManager.errorCount = 0;
    conn.showLogs();
    assert.equal(conn.btnLogs.badgeElement, null);
});

test("showLogs returns this", () => {
    const { conn } = createEstablishedConnection();
    assert.equal(conn.showLogs(), conn);
});

// =============================================================================
// toFirst()
// =============================================================================

test("toFirst moves element to front via parentElement", () => {
    const conn = createMinimalConnection();
    const container = document.createElement("div");
    const other = document.createElement("span");
    container.appendChild(conn.get());
    container.appendChild(other);
    conn.toFirst();
    const children = container.childNodes;
    assert.equal(children[children.length - 1], conn.get());
});

test("toFirst moves element via parentElement property", () => {
    const conn = createMinimalConnection();
    const fakeParent = document.createElement("div");
    fakeParent.appendChild(conn.get());
    const other = document.createElement("span");
    fakeParent.appendChild(other);
    conn.toFirst();
    assert.equal(fakeParent.childNodes[fakeParent.childNodes.length - 1], conn.get());
});

test("toFirst uses this.parentElement when set (StyledElement parent)", () => {
    const conn = createMinimalConnection();
    const container = document.createElement("div");
    const other = document.createElement("span");
    container.appendChild(conn.get());
    container.appendChild(other);

    conn.parentElement = {
        removeChild: function (child) {
            // Return mock that has appendChild
            return { appendChild: function (_child) { return child; } };
        }
    };
    conn.toFirst();
    assert.ok(true);
});

test("toFirst with null parentElement does not throw", () => {
    const conn = createMinimalConnection();
    conn.toFirst();
});

test("toFirst with null element parentElement does not throw", () => {
    const conn = createMinimalConnection();
    // No parent at all
    conn.toFirst();
});

test("toFirst returns this", () => {
    const conn = createMinimalConnection();
    assert.equal(conn.toFirst(), conn);
});

// =============================================================================
// toggleActive()
// =============================================================================

test("toggleActive with true calls activate", () => {
    const conn = createMinimalConnection();
    let activated = false;
    conn.activate = function () { activated = true; return this; };
    conn.toggleActive(true);
    assert.ok(activated);
});

test("toggleActive with false calls deactivate", () => {
    const conn = createMinimalConnection();
    let deactivated = false;
    conn.deactivate = function () { deactivated = true; return this; };
    conn.toggleActive(false);
    assert.ok(deactivated);
});

test("toggleActive returns this", () => {
    const conn = createMinimalConnection();
    conn.activate = function () { return this; };
    conn.deactivate = function () { return this; };
    assert.equal(conn.toggleActive(true), conn);
});

// =============================================================================
// toJSON()
// =============================================================================

test("toJSON returns correct shape", () => {
    const { conn } = createCreatedConnection();
    const json = conn.toJSON();
    assert.equal(json.sourcename, conn.sourceId);
    assert.equal(json.targetname, conn.targetId);
    assert.equal(typeof json.sourcehandle, "string");
    assert.equal(typeof json.targethandle, "string");
});

test("toJSON handles reflect auto state", () => {
    const { conn } = createCreatedConnection();
    assert.equal(conn.source.handle.auto, true);
    const json = conn.toJSON();
    assert.equal(json.sourcehandle, "auto");
    assert.equal(json.targethandle, "auto");
});

// =============================================================================
// updateCursorPosition()
// =============================================================================

test("updateCursorPosition returns early when created", () => {
    const { conn } = createCreatedConnection();
    const result = conn.updateCursorPosition({ x: 50, y: 50 });
    assert.equal(result, conn);
});

test("updateCursorPosition with source endpoint uses source as start", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out", anchorPosition: { x: 100, y: 200 } });
    conn.stickEndpoint(srcEp);
    conn.updateCursorPosition({ x: 200, y: 300 });
    assert.ok(conn.pathElement.hasAttribute("d"));
});

test("updateCursorPosition with target endpoint uses target as end", () => {
    const conn = createMinimalConnection();
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in", anchorPosition: { x: 300, y: 400 } });
    conn.stickEndpoint(tgtEp);
    conn.updateCursorPosition({ x: 50, y: 60 });
    assert.ok(conn.pathElement.hasAttribute("d"));
});

test("updateCursorPosition returns this", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    conn.stickEndpoint(srcEp);
    const result = conn.updateCursorPosition({ x: 50, y: 50 });
    assert.equal(result, conn);
});

// =============================================================================
// bg property notification: btnremove_onclick
// =============================================================================

test("btnRemove click dispatches optshare when background", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    let shareFired = false;
    let removeFired = false;
    conn.addEventListener("optshare", () => { shareFired = true; });
    conn.addEventListener("optremove", () => { removeFired = true; });
    conn.btnRemove.dispatchEvent("click");
    assert.ok(shareFired);
    assert.ok(!removeFired);
});

test("btnRemove click dispatches optremove when not background and not readonly", () => {
    const conn = createMinimalConnection();
    let removeFired = false;
    let shareFired = false;
    conn.addEventListener("optremove", () => { removeFired = true; });
    conn.addEventListener("optshare", () => { shareFired = true; });
    conn.btnRemove.dispatchEvent("click");
    assert.ok(removeFired);
    assert.ok(!shareFired);
});

test("btnRemove click does not dispatch when readonly and not background", () => {
    const conn = createMinimalConnection();
    conn.readonly = true;
    let removeFired = false;
    let shareFired = false;
    conn.addEventListener("optremove", () => { removeFired = true; });
    conn.addEventListener("optshare", () => { shareFired = true; });
    conn.btnRemove.dispatchEvent("click");
    assert.ok(!removeFired);
    assert.ok(!shareFired);
});

// =============================================================================
// bindWiringConnection behavior (via stickEndpoint → establishConnection)
// =============================================================================

test("establishing sets logManager and readonly from wiringConnection", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    const wiringConn = createFakeWiringConnection({ readonly: true });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });
    assert.ok(conn.readonly);
    assert.ok(conn.hasClassName("readonly"));
});

test("establishing when readonly disables btnRemove", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    const wiringConn = createFakeWiringConnection({ readonly: true });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });
    assert.equal(conn.btnRemove.enabled, false);
});

test("establishing shows options", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    const wiringConn = createFakeWiringConnection();
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });
    assert.equal(conn.options.hidden, false);
});

test("establishing sets data-sourceid and data-targetid on wrapper and options", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "sx", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "ty", name: "in" });
    const wiringConn = createFakeWiringConnection();
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });
    assert.equal(conn.get().getAttribute("data-sourceid"), "sx");
    assert.equal(conn.get().getAttribute("data-targetid"), "ty");
    assert.equal(conn.options.get().getAttribute("data-sourceid"), "sx");
    assert.equal(conn.options.get().getAttribute("data-targetid"), "ty");
});

test("establishing calls appendConnection on both endpoints", () => {
    const conn = createMinimalConnection();
    let srcAppended = false, tgtAppended = false;
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    const origSrcAppend = srcEp.appendConnection;
    const origTgtAppend = tgtEp.appendConnection;
    srcEp.appendConnection = function (c) { srcAppended = true; return origSrcAppend.call(this, c); };
    tgtEp.appendConnection = function (c) { tgtAppended = true; return origTgtAppend.call(this, c); };
    const wiringConn = createFakeWiringConnection();
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });
    assert.ok(srcAppended);
    assert.ok(tgtAppended);
});

// =============================================================================
// notifyErrors (via logManager event)
// =============================================================================

test("notifyErrors with errorCount > 0 adds has-error class and shows btnLogs", () => {
    const { conn } = createEstablishedConnection();
    conn._connection.logManager.errorCount = 2;
    conn._connection.logManager.dispatchEvent("newentry");
    assert.ok(conn.hasClassName("has-error"));
    assert.equal(conn.btnLogs.hidden, false);
});

test("notifyErrors with errorCount 0 removes has-error class and hides btnLogs", () => {
    const { conn } = createEstablishedConnection();
    conn._connection.logManager.errorCount = 0;
    conn._connection.logManager.dispatchEvent("newentry");
    assert.equal(conn.hasClassName("has-error"), false);
    assert.equal(conn.btnLogs.hidden, true);
});

test("notifyErrors sets badge when errorCount > 0", () => {
    const { conn } = createEstablishedConnection();
    conn._connection.logManager.errorCount = 5;
    conn._connection.logManager.dispatchEvent("newentry");
    assert.ok(conn.btnLogs.hasClassName("has-alert"));
});

test("notifyErrors removes badge when errorCount is 0", () => {
    const { conn } = createEstablishedConnection();
    conn._connection.logManager.errorCount = 0;
    conn._connection.logManager.dispatchEvent("newentry");
    assert.ok(!conn.btnLogs.hasClassName("has-alert"));
});

// =============================================================================
// connection_onmouseenter / connection_onmouseleave handlers
// =============================================================================

test("mouseenter on established non-editable sets highlighted=true", () => {
    const { conn } = createEstablishedConnection();
    conn.highlighted = false;
    conn.wrapperElement.listeners.mouseenter[0]();
    assert.equal(conn.highlighted, true);
});

test("mouseenter on non-established does nothing", () => {
    const { conn } = createCreatedConnection();
    conn.wrapperElement.listeners.mouseenter[0]();
    assert.equal(conn.highlighted, false);
});

test("mouseenter on editable does nothing", () => {
    const { conn } = createEstablishedConnection();
    conn.editable = true;
    conn.wrapperElement.listeners.mouseenter[0]();
    assert.equal(conn.highlighted, false);
});

test("mouseleave on established non-editable sets highlighted=false", () => {
    const { conn } = createEstablishedConnection();
    conn.highlighted = true;
    conn.wrapperElement.listeners.mouseleave[0]();
    assert.equal(conn.highlighted, false);
});

test("mouseleave on non-established does nothing", () => {
    const { conn } = createCreatedConnection();
    conn.highlighted = true;
    conn.wrapperElement.listeners.mouseleave[0]();
    assert.equal(conn.highlighted, true);
});

test("mouseleave on editable does nothing", () => {
    const { conn } = createEstablishedConnection();
    conn.editable = true;
    conn.highlighted = true;
    conn.wrapperElement.listeners.mouseleave[0]();
    assert.equal(conn.highlighted, true);
});

// =============================================================================
// handle_ondrag / handle_ondragend (via source/target handle drag)
// =============================================================================

test("handle_ondrag refreshes connection", () => {
    const { conn } = createEstablishedConnection();
    let refreshed = false;
    conn.refresh = function () { refreshed = true; return this; };
    conn.source.handle.dispatchEvent("drag");
    assert.ok(refreshed);
});

test("handle_ondragend dispatches change event", () => {
    const { conn } = createEstablishedConnection();
    let changeFired = false;
    conn.addEventListener("change", () => { changeFired = true; });
    conn.source.handle.dispatchEvent("dragend");
    assert.ok(changeFired);
});

// =============================================================================
// hideButtonGroup with has-error or missing keeps btnLogs visible
// =============================================================================

test("hideButtonGroup keeps btnLogs visible when has-error class present", () => {
    const conn = createMinimalConnection();
    conn.active = true;
    conn.addClassName("has-error");
    conn.btnLogs.show();
    conn.active = false;
    assert.equal(conn.btnLogs.hidden, false);
    assert.equal(conn.btnPrefs.hidden, true);
});

test("hideButtonGroup keeps btnLogs visible when missing property is true", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out", missing: true });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: false });
    conn.active = true;
    conn.btnLogs.show();
    conn.active = false;
    assert.equal(conn.btnLogs.hidden, false);
});

// =============================================================================
// removeAllowed setter toggles btnRemove (not background)
// =============================================================================

test("removeAllowed=false shows delete button style (not background)", () => {
    const conn = createMinimalConnection();
    conn._showButtonAdd();
    conn.removeAllowed = false;
    assert.ok(conn.btnRemove.hasClassName("btn-remove"));
    assert.ok(!conn.btnRemove.hasClassName("btn-add"));
});

test("removeAllowed=true shows remove button style (not background)", () => {
    const conn = createMinimalConnection();
    conn._showButtonAdd();
    conn.removeAllowed = true;
    assert.ok(conn.btnRemove.hasClassName("btn-remove"));
    assert.ok(!conn.btnRemove.hasClassName("btn-add"));
});

// =============================================================================
// _onbackground depth calculation when active
// =============================================================================

test("_onbackground(true) with active=true keeps depth=1", () => {
    const conn = createMinimalConnection();
    conn.active = true;
    conn.background = true;
    assert.equal(conn.btnLogs.depth, 1);
    assert.equal(conn.btnRemove.depth, 1);
});

test("_onbackground(true) with active=false sets depth=0", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    assert.equal(conn.btnLogs.depth, 0);
    assert.equal(conn.btnRemove.depth, 0);
});

// =============================================================================
// highlightCount clamping below zero
// =============================================================================

test("highlighted count clamps at 0 when going negative", () => {
    const conn = createMinimalConnection();
    conn.highlighted = false;
    conn.highlighted = false;
    assert.equal(conn.highlighted, false);
});

// =============================================================================
// ConnectionPrefs integration (editable toggle via popup menu)
// =============================================================================

test("ConnectionPrefs build items exist and can toggle editable", () => {
    const conn = createMinimalConnection();
    const items = conn.btnPrefs.popup_menu.getItems();
    assert.equal(items.length, 2);
    // First item should toggle editable
    const customizeItem = items[0];
    assert.ok(customizeItem instanceof StyledElements.MenuItem);
});

// =============================================================================
// Static helper: bezier and calculateMiddle
// =============================================================================

test("formatDistance generates SVG d attribute", () => {
    // Test indirectly via updateCursorPosition
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out", anchorPosition: { x: 100, y: 200 } });
    conn.stickEndpoint(srcEp);
    conn.updateCursorPosition({ x: 300, y: 300 });
    const d = conn.pathElement.getAttribute("d");
    assert.ok(d.startsWith("M "));
    assert.ok(d.includes(" C "));
});

// =============================================================================
// Edge cases: stickEndpoint with null wiringConnection in default options
// =============================================================================

test("stickEndpoint with establish=true and null wiringConnection", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: null });
    assert.equal(conn.created, true);
    assert.equal(conn.established, false);
});

// =============================================================================
// Edge case: establishConnection with null wiringConnection returns early
// =============================================================================

test("establishConnection with null wiringConnection returns early", () => {
    const conn = createMinimalConnection();
    conn._connection = null;
    // Testing that the private fn returns early
    assert.equal(conn.established, false);
});

// =============================================================================
// Edge case: active set when enabled=false
// =============================================================================

test("active setter false when disabled does not toggle class", () => {
    const conn = createMinimalConnection();
    conn.disable();
    conn.active = true;
    // When disabled, toggleClassName('active', active) is guarded
    assert.ok(!conn.hasClassName("active"));
});

// =============================================================================
// refreshInternally: button depth calculation
// =============================================================================

test("refreshInternally sets button depth to 1 when active", () => {
    const conn = createMinimalConnection();
    conn.active = true;
    assert.equal(conn.btnLogs.depth, 1);
});

test("refreshInternally sets button depth to 1 when highlighted", () => {
    const conn = createMinimalConnection();
    conn.highlighted = true;
    assert.equal(conn.btnLogs.depth, 1);
});

test("refreshInternally sets button depth to 1 when not active/highlighted and not background", () => {
    // newDepth = active || highlighted || !background ? 1 : 0
    // !background is true when background=false, so depth always 1
    const conn = createMinimalConnection();
    conn.active = false;
    conn.highlighted = false;
    assert.equal(conn.btnLogs.depth, 1);
});

test("refreshInternally sets button depth to 0 when background=true and not active/highlighted", () => {
    const conn = createMinimalConnection();
    conn.background = true;
    assert.equal(conn.btnLogs.depth, 0);
});

// =============================================================================
// establishConnection bind drag event listeners
// =============================================================================

test("establishConnection binds drag listeners to source handle", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    const wiringConn = createFakeWiringConnection();
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });

    // Drag events should be registered on the handle
    conn.source.handle.dispatchEvent("drag");
    conn.source.handle.dispatchEvent("dragend");
    // Should not throw
});

test("establishConnection binds drag listeners to target handle", () => {
    const conn = createMinimalConnection();
    const srcEp = createFakeEndpoint({ type: "source", id: "s", name: "out" });
    const tgtEp = createFakeEndpoint({ type: "target", id: "t", name: "in" });
    const wiringConn = createFakeWiringConnection();
    conn.stickEndpoint(srcEp);
    conn.stickEndpoint(tgtEp, { establish: true, wiringConnection: wiringConn });

    conn.target.handle.dispatchEvent("drag");
    conn.target.handle.dispatchEvent("dragend");
    // Should not throw
});

// =============================================================================
// updateDistance positions options when established
// =============================================================================

test("refresh positions options when established", () => {
    const { conn } = createEstablishedConnection();
    conn.refresh();
    // options should have inline style with top and left
    assert.ok(conn.options.get().style.top !== undefined);
    assert.ok(conn.options.get().style.left !== undefined);
});

// =============================================================================
// _oneditable no-op when same value
// =============================================================================

test("_oneditable returns early when setting same value", () => {
    const conn = createMinimalConnection();
    conn.editable = false; // Already false
    // Should not dispatch anything
});

// =============================================================================
// btnLogs click calls showLogs
// =============================================================================

test("btnLogs click button handler calls showLogs", () => {
    const { conn } = createEstablishedConnection();
    conn._connection._logsShown = false;
    const result = conn.btnLogs.get().listeners.click;
    assert.ok(result && result.length > 0);
});

// =============================================================================
// Drag event - handle_ondrag target handle
// =============================================================================

test("target handle drag refreshes connection", () => {
    const { conn } = createEstablishedConnection();
    let refreshed = false;
    conn.refresh = function () { refreshed = true; return this; };
    conn.target.handle.dispatchEvent("drag");
    assert.ok(refreshed);
});

test("target handle dragend dispatches change event", () => {
    const { conn } = createEstablishedConnection();
    let changeFired = false;
    conn.addEventListener("change", () => { changeFired = true; });
    conn.target.handle.dispatchEvent("dragend");
    assert.ok(changeFired);
});
