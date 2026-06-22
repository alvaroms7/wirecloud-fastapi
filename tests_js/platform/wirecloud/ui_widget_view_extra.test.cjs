const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    global.Wirecloud = {
        Utils: StyledElements.Utils,
        ui: {},
        LocalCatalogue: {
            hasAlternativeVersion: () => true,
        },
        UserInterfaceManager: {
            views: {
                myresources: {
                    createUserCommand() {
                        return () => {};
                    },
                },
            },
        },
    };

    StyledElements.DynamicMenuItems = class DynamicMenuItems {};
    StyledElements.Separator = class Separator {};
    StyledElements.MenuItem = class MenuItem {
        constructor(label, handlerOrOptions, context) {
            this.label = label;
            this.disabled = false;
            this.icons = [];
            if (typeof handlerOrOptions === 'function') {
                this.handler = handlerOrOptions;
            } else if (handlerOrOptions != null) {
                this.handler = handlerOrOptions.handler;
                this.disabled = handlerOrOptions.enabled === false;
                if (handlerOrOptions.iconClass) {
                    this.icons.push(handlerOrOptions.iconClass);
                }
            }
            this.context = context;
        }
        addIconClass(iconClass) {
            this.icons.push(iconClass);
            return this;
        }
        setDisabled(disabled) {
            this.disabled = !!disabled;
            return this;
        }
        run() {
            if (this.handler) {
                this.handler(this.context);
            }
        }
    };
    StyledElements.SubMenuItem = class SubMenuItem extends StyledElements.MenuItem {
        constructor(label, options = {}) {
            super(label, options);
            this.children = [];
        }
        append(item) {
            this.children.push(item);
            return this;
        }
        appendSeparator() {
            this.children.push(new StyledElements.Separator());
            return this;
        }
    };

    Wirecloud.ui.FreeLayout = class FreeLayout {};
    Wirecloud.ui.FullDragboardLayout = class FullDragboardLayout {};
    Wirecloud.ui.Draggable = function Draggable(element, context, ondragstart, ondrag, ondragend, canDrag) {
        this.element = element;
        this.context = context;
        this.ondragstart = ondragstart;
        this.ondrag = ondrag;
        this.ondragend = ondragend;
        this.canDrag = canDrag;
    };
    Wirecloud.ui.ResizeHandle = function ResizeHandle(resizableElement, handleElement, data, onresizestart, onresize, onresizeend, canDrag) {
        this.resizableElement = resizableElement;
        this.handleElement = handleElement;
        this.data = data;
        this.onresizestart = onresizestart;
        this.onresize = onresize;
        this.onresizeend = onresizeend;
        this.canDrag = canDrag;
    };
    Wirecloud.ui.UpgradeWindowMenu = class UpgradeWindowMenu {
        constructor(model) {
            this.model = model;
        }
        show() {
            Wirecloud.ui.lastUpgradeDialog = this;
        }
    };
};

const makeClassedElement = (tagName = 'div') => {
    const element = document.createElement(tagName);
    element.offsetLeft = 10;
    element.offsetTop = 20;
    element.clientWidth = 120;
    element.clientHeight = 90;
    return element;
};

const makeWidget = (layout) => {
    const dragboard = {
        leftMargin: 5,
        rightMargin: 7,
        topMargin: 3,
        bottomMargin: 4,
        freeLayout: null,
        baseLayout: { name: 'base' },
        topLayout: { name: 'top' },
        rightLayout: { name: 'right' },
        bottomLayout: { name: 'bottom' },
        leftLayout: { name: 'left' },
        fulldragboardLayout: { name: 'full' },
        updateCalls: [],
        update(ids) {
            this.updateCalls.push(ids);
        },
        _notifyWindowResizeEvent() {
            this.notified = true;
        },
    };
    dragboard.freeLayout = layout;
    layout.dragboard = dragboard;

    const tabElement = makeClassedElement();
    const otherTabElement = makeClassedElement();
    const otherTab = {
        id: 'tab-2',
        tabElement: otherTabElement,
        dragboard: {
            freeLayout: { name: 'dest-free' },
            baseLayout: { name: 'dest-base' },
        },
    };
    const currentTab = {
        id: 'tab-1',
        tabElement,
        wrapperElement: makeClassedElement(),
        dragboard,
        workspace: {
            editing: true,
            tabs: [],
            findTab(id) {
                return id === 'tab-2' ? otherTab : null;
            },
        },
    };
    currentTab.workspace.tabs = [currentTab, otherTab];

    const widget = {
        id: 'widget-1',
        heading: makeClassedElement('h2'),
        wrapperElement: makeClassedElement(),
        tab: currentTab,
        layout,
        position: { x: 10, y: 20, z: 1, anchor: 'top-left', relx: false, rely: false },
        shape: { width: 2, height: 3, relwidth: false, relheight: false },
        titleelement: {
            enableEdition() {
                widget.renaming = true;
            },
        },
        model: {
            volatile: false,
            missing: false,
            meta: {
                doc: 'manual',
                version: '1.0.0',
            },
            isAllowed: () => true,
            hasPreferences: () => true,
        },
        reload() {
            this.reloaded = true;
        },
        showLogs() {
            this.logsShown = true;
        },
        showSettings() {
            this.settingsShown = true;
        },
        setFullDragboardMode(enabled) {
            this.fullDragboard = enabled;
        },
        moveToLayout(newLayout) {
            this.movedTo = newLayout;
        },
        setPosition(position) {
            Object.assign(this.position, position);
        },
        setShape(shape, resizeLeftSide, resizeTopSide, persist) {
            Object.assign(this.shape, shape);
            this.lastShapeCall = { shape, resizeLeftSide, resizeTopSide, persist };
        },
    };

    return { widget, dragboard, otherTab };
};

test('WidgetViewDraggable covers drag permissions and same-tab move lifecycle', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout();
    Object.assign(layout, {
        initializeMove(widget, draggable) {
            this.initialized = { widget, draggable };
        },
        moveTemporally(x, y) {
            this.temporal = { x, y };
        },
        acceptMove() {
            this.accepted = true;
        },
        cancelMove() {
            this.cancelled = true;
        },
        disableCursor() {
            this.cursorDisabled = true;
        },
        dragboard: {
            raiseToTop(widget) {
                this.raised = widget;
            },
        },
    });
    const { widget } = makeWidget(layout);
    layout.dragboard.raiseToTop = function (raisedWidget) {
        this.raised = raisedWidget;
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WidgetViewDraggable.js');
    const draggable = new Wirecloud.ui.WidgetViewDraggable(widget);
    draggable.setXOffset(2).setYOffset(3);

    assert.equal(draggable.canDrag(draggable, draggable.context), true);
    widget.tab.workspace.editing = false;
    widget.model.volatile = false;
    widget.layout = { dragboard: layout.dragboard };
    assert.equal(draggable.canDrag(draggable, draggable.context), false);
    widget.layout = layout;
    widget.tab.workspace.editing = false;
    widget.model.isAllowed = () => false;
    assert.equal(draggable.canDrag(draggable, draggable.context), false);
    widget.model.volatile = true;
    widget.model.isAllowed = () => true;
    assert.equal(draggable.canDrag(draggable, draggable.context, 'viewer'), true);
    widget.layout = new Wirecloud.ui.FullDragboardLayout();
    assert.equal(draggable.canDrag(draggable, draggable.context), false);
    widget.layout = layout;
    widget.tab.workspace.editing = true;
    widget.model.volatile = false;

    const result = draggable.ondragstart(draggable, draggable.context);
    assert.equal(result.dragboard, widget.tab.wrapperElement);
    assert.equal(widget.wrapperElement.classList.contains('dragging'), true);

    draggable.ondrag({}, draggable, draggable.context, 5, 6);
    assert.deepEqual(layout.temporal, { x: 17, y: 29 });
    draggable.ondragend(draggable, draggable.context);
    assert.equal(layout.accepted, true);
});

test('WidgetViewDraggable moves widgets across tabs when hovering another tab', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout();
    Object.assign(layout, {
        initializeMove() {},
        moveTemporally() {},
        acceptMove() {},
        cancelMove() {
            this.cancelled = true;
        },
        disableCursor() {
            this.cursorDisabled = true;
        },
        dragboard: {
            raiseToTop() {},
        },
    });
    const { widget, otherTab } = makeWidget(layout);
    layout.dragboard.raiseToTop = () => {};
    const listeners = {};
    otherTab.tabElement.addEventListener = (type, listener) => {
        listeners[type] = listener;
    };
    otherTab.tabElement.removeEventListener = (type) => {
        delete listeners[type];
    };
    otherTab.tabElement.getAttribute = () => 'tab-2';

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WidgetViewDraggable.js');
    const draggable = new Wirecloud.ui.WidgetViewDraggable(widget);
    draggable.ondragstart(draggable, draggable.context);
    listeners.mouseenter({ target: otherTab.tabElement });
    assert.equal(otherTab.tabElement.classList.contains('selected'), true);
    draggable.ondrag({}, draggable, draggable.context, 1, 1);
    assert.equal(layout.temporal, undefined);
    draggable.ondragend(draggable, draggable.context);

    assert.equal(layout.cancelled, true);
    assert.equal(widget.movedTo, otherTab.dragboard.freeLayout);
    assert.equal(otherTab.tabElement.classList.contains('selected'), false);

    widget.layout = { ...layout, cancelMove() { this.cancelled = true; } };
    widget.tab.dragboard.freeLayout = layout;
    draggable.context.tab = otherTab;
    draggable.context.tabs = [otherTab];
    draggable.ondragend(draggable, draggable.context);
    assert.equal(widget.movedTo, otherTab.dragboard.baseLayout);
});

test('WidgetViewDraggable clears hovered tab on mouseleave', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout();
    const { widget, otherTab } = makeWidget(layout);
    layout.disableCursor = () => {};
    layout.dragboard = widget.tab.dragboard;
    const context = {
        widget,
        _on_mouseenter_tab: null,
        _on_mouseleave_tab: null,
    };
    otherTab.tabElement.getAttribute = () => 'tab-2';

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WidgetViewDraggable.js');
    const draggable = new Wirecloud.ui.WidgetViewDraggable(widget);
    draggable.context._on_mouseenter_tab({ target: otherTab.tabElement });
    draggable.context._on_mouseleave_tab({ target: otherTab.tabElement });
    assert.equal(draggable.context.tab, null);
});

test('WidgetViewResizeHandle covers resize permission, min sizes, fixed dimensions and final persistence', () => {
    setup();
    const layout = {
        dragboard: {
            _notifyWindowResizeEvent() {
                this.notified = true;
            },
        },
        adaptWidth(value) {
            return { inPixels: parseInt(value, 10) + 1, inLU: 9 };
        },
        adaptHeight(value) {
            return { inPixels: parseInt(value, 10) + 2, inLU: 8 };
        },
    };
    const { widget } = makeWidget(layout);
    widget.shape.relwidth = true;
    widget.shape.relheight = true;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WidgetViewResizeHandle.js');
    assert.throws(() => new Wirecloud.ui.WidgetViewResizeHandle(widget, { fixWidth: true, fixHeight: true }), TypeError);

    const defaultHandle = new Wirecloud.ui.WidgetViewResizeHandle(widget);
    assert.equal(defaultHandle.wrapperElement.getAttribute('aria-orientation'), 'horizontal');

    const handle = new Wirecloud.ui.WidgetViewResizeHandle(widget, { resizeLeftSide: true, resizeTopSide: true });
    assert.equal(handle.canDrag(widget.wrapperElement, handle.data), true);
    widget.tab.workspace.editing = false;
    widget.model.isAllowed = () => false;
    assert.equal(handle.canDrag(widget.wrapperElement, handle.data), false);
    widget.model.volatile = true;
    widget.model.isAllowed = () => true;
    assert.equal(handle.canDrag(widget.wrapperElement, handle.data, 'viewer'), true);
    widget.layout = new Wirecloud.ui.FullDragboardLayout();
    assert.equal(handle.canDrag(widget.wrapperElement, handle.data), false);
    widget.layout = layout;

    handle.onresizestart(widget.wrapperElement, handle.wrapperElement, handle.data);
    assert.equal(handle.wrapperElement.classList.contains('inUse'), true);
    assert.equal(widget.position.z, '999999');

    widget.position.anchor = 'top-center';
    handle.onresize(widget.wrapperElement, handle.wrapperElement, handle.data, 1000, 1000);
    assert.equal(widget.shape.width, 9);
    assert.equal(widget.shape.height, 8);

    handle.onresizeend(widget.wrapperElement, handle.wrapperElement, handle.data);
    assert.equal(widget.position.z, 1);
    assert.equal(widget.lastShapeCall.persist, true);
    assert.equal(layout.dragboard.notified, true);

    const fixed = new Wirecloud.ui.WidgetViewResizeHandle(widget, { fixWidth: true });
    fixed.onresizestart(widget.wrapperElement, fixed.wrapperElement, fixed.data);
    fixed.onresize(widget.wrapperElement, fixed.wrapperElement, fixed.data, 10, 10);
    assert.equal(fixed.data.width, widget.shape.width);

    const fixedHeight = new Wirecloud.ui.WidgetViewResizeHandle(widget, { fixHeight: true });
    fixedHeight.onresizestart(widget.wrapperElement, fixedHeight.wrapperElement, fixedHeight.data);
    fixedHeight.onresize(widget.wrapperElement, fixedHeight.wrapperElement, fixedHeight.data, 10, 10);
    assert.equal(fixedHeight.data.height, widget.shape.height);

    widget.shape.relwidth = false;
    widget.shape.relheight = false;
    const absolute = new Wirecloud.ui.WidgetViewResizeHandle(widget, {});
    absolute.onresizestart(widget.wrapperElement, absolute.wrapperElement, absolute.data);
    absolute.onresize(widget.wrapperElement, absolute.wrapperElement, absolute.data, 10, 10);
    assert.equal(absolute.data.width, 141);
    assert.equal(absolute.data.height, 102);

    const unchanged = new Wirecloud.ui.WidgetViewResizeHandle(widget, { fixWidth: true, fixHeight: false });
    widget.shape.height = 102;
    unchanged.onresizestart(widget.wrapperElement, unchanged.wrapperElement, unchanged.data);
    unchanged.data.initialHeight = 102;
    unchanged.data.height = 102;
    unchanged.data.width = widget.shape.width;
    const previousShapeCall = widget.lastShapeCall;
    unchanged.onresizeend(widget.wrapperElement, unchanged.wrapperElement, unchanged.data);
    assert.equal(widget.lastShapeCall, previousShapeCall);
});

test('WidgetViewMenuItems builds and executes actions for free, grid and full dragboard layouts', () => {
    setup();
    const freeLayout = new Wirecloud.ui.FreeLayout();
    Object.assign(freeLayout, {
        getColumnOffset: () => 25,
        getRowOffset: () => 35,
        adaptColumnOffset: () => ({ inLU: 4 }),
        adaptRowOffset: () => ({ inLU: 5 }),
        adaptWidth: () => ({ inLU: 6 }),
        adaptHeight: () => ({ inLU: 7 }),
        getWidthInPixels: () => 80,
        getHeightInPixels: () => 50,
    });
    const { widget, dragboard } = makeWidget(freeLayout);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WidgetViewMenuItems.js');
    const items = new Wirecloud.ui.WidgetViewMenuItems(widget).build();
    assert.ok(items.length > 10);

    items[0].run();
    items[1].run();
    items[2].run();
    items[3].run();
    items[4].run();
    items[5].run();
    assert.equal(widget.renaming, true);
    assert.equal(widget.reloaded, true);
    assert.equal(Wirecloud.ui.lastUpgradeDialog.model, widget.model);
    assert.equal(widget.logsShown, true);
    assert.equal(widget.settingsShown, true);

    const placement = items.find((item) => item instanceof StyledElements.SubMenuItem);
    placement.children[0].children[1].run();
    assert.equal(widget.position.anchor, 'top-center');
    placement.children[0].children[0].run();
    assert.equal(widget.position.anchor, 'top-left');
    placement.children[0].children[2].run();
    assert.equal(widget.position.anchor, 'top-right');
    placement.children[1].children[1].run();
    assert.equal(widget.position.anchor, 'bottom-right');
    placement.children[1].children[0].run();
    assert.equal(widget.position.anchor, 'top-right');
    placement.children[3].run();
    assert.equal(widget.position.relx, true);
    placement.children[3].run();
    assert.equal(widget.position.relx, false);
    placement.children[4].run();
    assert.equal(widget.position.rely, true);
    placement.children[4].run();
    assert.equal(widget.position.rely, false);
    placement.children[5].run();
    assert.equal(widget.shape.relwidth, true);
    placement.children[5].run();
    assert.equal(widget.shape.relwidth, false);
    placement.children[6].run();
    assert.equal(widget.shape.relheight, true);
    placement.children[6].run();
    assert.equal(widget.shape.relheight, false);

    items.find((item) => item.label === 'Full Dragboard').run();
    assert.equal(widget.fullDragboard, true);
    items.find((item) => item.label === 'Snap to grid').run();
    assert.equal(widget.movedTo, dragboard.baseLayout);
    items.find((item) => item.label === 'Move to the top sidebar').run();
    assert.equal(widget.movedTo, dragboard.topLayout);
    items.find((item) => item.label === 'Move to the right sidebar').run();
    assert.equal(widget.movedTo, dragboard.rightLayout);
    items.find((item) => item.label === 'Move to the bottom sidebar').run();
    assert.equal(widget.movedTo, dragboard.bottomLayout);
    items.find((item) => item.label === 'Move to the left sidebar').run();
    assert.equal(widget.movedTo, dragboard.leftLayout);

    widget.layout = dragboard.baseLayout;
    const gridItems = new Wirecloud.ui.WidgetViewMenuItems(widget).build();
    gridItems.find((item) => item.label === 'Extract from grid').run();
    assert.equal(widget.movedTo, dragboard.freeLayout);

    widget.layout = dragboard.fulldragboardLayout;
    const fullItems = new Wirecloud.ui.WidgetViewMenuItems(widget).build();
    assert.ok(fullItems.some((item) => item.label === 'Exit Full Dragboard'));
    assert.equal(fullItems.some((item) => item.label === 'Snap to grid'), false);
});

test('WidgetViewMenuItems covers disabled and pre-relative branch states', () => {
    setup();
    const freeLayout = new Wirecloud.ui.FreeLayout();
    Object.assign(freeLayout, {
        getColumnOffset: () => 25,
        getRowOffset: () => 35,
        adaptColumnOffset: () => ({ inLU: 4 }),
        adaptRowOffset: () => ({ inLU: 5 }),
        adaptWidth: () => ({ inLU: 6 }),
        adaptHeight: () => ({ inLU: 7 }),
        getWidthInPixels: () => 80,
        getHeightInPixels: () => 50,
    });
    const { widget } = makeWidget(freeLayout);
    widget.position.anchor = 'bottom-left';
    widget.position.relx = true;
    widget.position.rely = true;
    widget.shape.relwidth = true;
    widget.shape.relheight = true;
    widget.model.missing = true;
    widget.model.meta.doc = '';
    widget.model.hasPreferences = () => false;
    widget.model.isAllowed = (permission) => permission !== 'move' && permission !== 'rename' && permission !== 'upgrade';
    Wirecloud.LocalCatalogue.hasAlternativeVersion = () => false;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/WidgetViewMenuItems.js');
    const items = new Wirecloud.ui.WidgetViewMenuItems(widget).build();
    assert.equal(items[0].disabled, true);
    assert.equal(items[1].disabled, true);
    assert.equal(items[2].disabled, true);
    assert.equal(items[4].disabled, true);
    assert.equal(items[5].disabled, true);

    const placement = items.find((item) => item instanceof StyledElements.SubMenuItem);
    assert.equal(placement.children[3].label, 'Fixed x');
    placement.children[3].run();
    assert.equal(widget.position.relx, false);
    assert.equal(widget.position.x, 20);
    assert.equal(placement.children[4].label, 'Fixed y');
    placement.children[4].run();
    assert.equal(widget.position.rely, false);
    assert.equal(widget.position.y, 31);
    assert.equal(placement.children[5].label, 'Fixed width');
    placement.children[5].run();
    assert.equal(widget.shape.relwidth, false);
    assert.equal(widget.shape.width, 80);
    assert.equal(placement.children[6].label, 'Fixed height');
    placement.children[6].run();
    assert.equal(widget.shape.relheight, false);
    assert.equal(widget.shape.height, 50);
});
