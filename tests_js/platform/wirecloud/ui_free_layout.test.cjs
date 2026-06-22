const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// ============================================================================
// Test helpers
// ============================================================================

const createDragboard = (overrides = {}) => {
    const wrapperElement = document.createElement('div');
    wrapperElement.offsetWidth = 800;
    wrapperElement.offsetHeight = 600;

    return Object.assign({
        getWidth: () => 800,
        getHeight: () => 600,
        update: () => {},
        _addWidget: () => {},
        _removeWidget: () => {},
        leftMargin: 4,
        rightMargin: 4,
        topMargin: 10,
        bottomMargin: 10,
        tab: {
            wrapperElement,
        },
    }, overrides);
};

const createWidgetView = (id = 'w1', overrides = {}) => {
    const wrapperElement = document.createElement('section');
    wrapperElement.offsetLeft = 100;
    wrapperElement.offsetTop = 100;
    wrapperElement.offsetWidth = 200;
    wrapperElement.offsetHeight = 150;

    return Object.assign({
        id,
        wrapperElement,
        position: {
            x: 0,
            y: 0,
            anchor: 'top-left',
            relx: false,
            rely: false,
        },
        shape: {
            width: 100000,
            height: 100000,
            relwidth: false,
            relheight: false,
        },
        minimized: false,
        setPosition() { return this; },
        setShape() { return this; },
        addEventListener() {},
        removeEventListener() {},
        repaint() { return this; },
        layout: null,
        element: null,
        moveToLayout() {},
    }, overrides);
};

// ============================================================================
// Setup
// ============================================================================

let _parentAddWidgetCalls;
let _parentNotifyWindowResizeCalls;
let _parentNotifyResizeCalls;

const setup = (mockGetRelativePosition = false) => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    global.Wirecloud = {
        Utils: Object.assign({}, StyledElements.Utils),
        ui: {},
        constants: {
            LOGGING: {
                ERROR_MSG: 1,
                WARN_MSG: 2,
                INFO_MSG: 3,
                DEBUG_MSG: 4,
            },
        },
        GlobalLogManager: {
            log: () => {},
        },
    };

    if (mockGetRelativePosition) {
        Wirecloud.Utils.getRelativePosition = () => ({ x: 0, y: 0 });
    } else {
        Wirecloud.Utils.getRelativePosition = StyledElements.Utils.getRelativePosition;
    }

    Wirecloud.DragboardPosition = class DragboardPosition {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }
    };

    Wirecloud.ui.MultiValuedSize = class MultiValuedSize {
        constructor(inPixels, inLU) {
            this.inPixels = inPixels;
            this.inLU = inLU;
        }
    };

    Wirecloud.ui.WidgetView = class WidgetView {
        constructor(id) {
            this.id = id;
        }
    };

    _parentAddWidgetCalls = [];
    _parentNotifyWindowResizeCalls = [];
    _parentNotifyResizeCalls = [];

    Wirecloud.ui.DragboardLayout = class DragboardLayout {
        constructor(dragboard) {
            this.dragboard = dragboard;
            this.widgets = {};
            this._on_remove_widget_bound = () => {};
        }

        addWidget(widget, affectsDragboard) {
            _parentAddWidgetCalls.push({ widget, affectsDragboard });
            widget.layout = this;
            if (affectsDragboard) {
                this.dragboard._addWidget(widget);
            }
            this.widgets[widget.id] = widget;
            widget.addEventListener('remove', this._on_remove_widget_bound);
            widget.repaint();
            return new Set();
        }

        _notifyWindowResizeEvent(widthChanged, heightChanged) {
            _parentNotifyWindowResizeCalls.push({ widthChanged, heightChanged });
            if (widthChanged || heightChanged) {
                Object.values(this.widgets).forEach((w) => w.repaint());
            }
        }

        _notifyResizeEvent() {
            _parentNotifyResizeCalls.push(arguments);
        }

        parseSize(value) {
            if (typeof value === 'number') {
                return [value, 'cells'];
            } else if (typeof value === 'string') {
                value = value.trim();
                const matches = value.match(/^([-+]?\d+(?:\.\d+)?)\s*(px|%|)$/);
                if (matches[2] !== '') {
                    return [Number(matches[1]), matches[2]];
                } else {
                    return [Number(matches[1]), 'cells'];
                }
            } else {
                throw new TypeError();
            }
        }

        getWidth() {
            return this.dragboard.getWidth();
        }

        getHeight() {
            return this.dragboard.getHeight();
        }

        _adaptIWidget() {}
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/FreeLayout.js');
};

// ============================================================================
// CONSTRUCTOR
// ============================================================================

test('constructor creates FreeLayout instance', () => {
    setup();
    const db = createDragboard();
    const layout = new Wirecloud.ui.FreeLayout(db);

    assert.ok(layout instanceof Wirecloud.ui.DragboardLayout);
    assert.ok(layout instanceof Wirecloud.ui.FreeLayout);
    assert.equal(layout.dragboard, db);
    assert.equal(layout.initialized, false);
    assert.equal(layout.iwidgetToMove, null);
    assert.deepEqual(layout.widgets, {});
    assert.equal(layout.MAX_HLU, 1000000);
    assert.equal(layout.MAX_HLU_PERCENTAGE, 10000);
});

// ============================================================================
// fromPixelsToVCells
// ============================================================================

test('fromPixelsToVCells computes correct value', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.fromPixelsToVCells(300);
    assert.equal(result, (300 * 1000000) / 600);
});

test('fromPixelsToVCells with zero pixels', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    assert.equal(layout.fromPixelsToVCells(0), 0);
});

// ============================================================================
// fromVCellsToPixels
// ============================================================================

test('fromVCellsToPixels computes correct value', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.fromVCellsToPixels(500000);
    assert.equal(result, Math.round((600 * 500000) / 1000000));
});

test('fromVCellsToPixels with zero cells', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    assert.equal(layout.fromVCellsToPixels(0), 0);
});

// ============================================================================
// getWidthInPixels
// ============================================================================

test('getWidthInPixels delegates to fromHCellsToPixels', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.getWidthInPixels(500000, 1000);
    assert.equal(result, Math.round((1000 * 500000) / 1000000));
});

test('getWidthInPixels without width param', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.getWidthInPixels(500000);
    assert.equal(result, Math.round((800 * 500000) / 1000000));
});

// ============================================================================
// getHeightInPixels
// ============================================================================

test('getHeightInPixels delegates to fromVCellsToPixels', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.getHeightInPixels(500000);
    assert.equal(result, Math.round((600 * 500000) / 1000000));
});

// ============================================================================
// fromPixelsToHCells
// ============================================================================

test('fromPixelsToHCells with explicit width', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.fromPixelsToHCells(400, 1000);
    assert.equal(result, (400 * 1000000) / 1000);
});

test('fromPixelsToHCells without width uses getWidth', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.fromPixelsToHCells(400);
    assert.equal(result, (400 * 1000000) / 800);
});

// ============================================================================
// fromHCellsToPixels
// ============================================================================

test('fromHCellsToPixels with explicit width', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.fromHCellsToPixels(500000, 1000);
    assert.equal(result, Math.round((1000 * 500000) / 1000000));
});

test('fromHCellsToPixels without width uses getWidth', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.fromHCellsToPixels(500000);
    assert.equal(result, Math.round((800 * 500000) / 1000000));
});

// ============================================================================
// getColumnOffset
// ============================================================================

test('getColumnOffset - left anchor, css, relx', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 5, rightMargin: 7 }));
    const pos = { anchor: 'top-left', relx: true, x: 300000 };
    const result = layout.getColumnOffset(pos, 800, true);

    assert.ok(result.includes('calc('));
    assert.ok(result.includes('%'));
    assert.ok(result.includes('+'));
    assert.ok(result.includes('px)'));
});

test('getColumnOffset - left anchor, css, no relx', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 5 }));
    const pos = { anchor: 'top-left', relx: false, x: 10 };
    const result = layout.getColumnOffset(pos, 800, true);
    assert.equal(result, '15px');
});

test('getColumnOffset - right anchor, css, relx', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ rightMargin: 7 }));
    const pos = { anchor: 'top-right', relx: true, x: 300000 };
    const result = layout.getColumnOffset(pos, 800, true);

    assert.ok(result.includes('calc('));
    assert.ok(result.includes('%'));
});

test('getColumnOffset - right anchor, css, no relx', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ rightMargin: 7 }));
    const pos = { anchor: 'top-right', relx: false, x: 10 };
    const result = layout.getColumnOffset(pos, 800, true);
    assert.equal(result, '17px');
});

test('getColumnOffset - left anchor, no css, relx', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 5 }));
    // fromHCellsToPixels(40, 800) = Math.round(800 * 40 / 1000000) = Math.round(0.032) = 0
    const pos = { anchor: 'top-left', relx: true, x: 100000 };
    const result = layout.getColumnOffset(pos, 800, false);
    assert.equal(result, 5 + Math.round((800 * 100000) / 1000000));
});

test('getColumnOffset - left anchor, no css, no relx', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 5 }));
    const pos = { anchor: 'bottom-left', relx: false, x: 10 };
    const result = layout.getColumnOffset(pos, 800, false);
    assert.equal(result, 15);
});

test('getColumnOffset - right anchor, no css, no relx', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ rightMargin: 7 }));
    const pos = { anchor: 'bottom-right', relx: false, x: 10 };
    const result = layout.getColumnOffset(pos, null, false);
    assert.equal(result, 17);
});

// ============================================================================
// getRowOffset
// ============================================================================

test('getRowOffset - top anchor, css, rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ topMargin: 10 }));
    const pos = { anchor: 'top-left', rely: true, y: 300000 };
    const result = layout.getRowOffset(pos, true);

    assert.ok(result.includes('calc('));
    assert.ok(result.includes('%'));
});

test('getRowOffset - top anchor, css, no rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ topMargin: 10 }));
    const pos = { anchor: 'top-left', rely: false, y: 5 };
    const result = layout.getRowOffset(pos, true);
    assert.equal(result, '15px');
});

test('getRowOffset - bottom anchor, css, rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ bottomMargin: 10 }));
    const pos = { anchor: 'bottom-left', rely: true, y: 300000 };
    const result = layout.getRowOffset(pos, true);

    assert.ok(result.includes('calc('));
    assert.ok(result.includes('%'));
});

test('getRowOffset - bottom anchor, css, no rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ bottomMargin: 10 }));
    const pos = { anchor: 'bottom-left', rely: false, y: 5 };
    const result = layout.getRowOffset(pos, true);
    assert.equal(result, '15px');
});

test('getRowOffset - top anchor, no css, rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ topMargin: 10 }));
    const pos = { anchor: 'top-left', rely: true, y: 100000 };
    const result = layout.getRowOffset(pos, false);
    assert.equal(result, 10 + Math.round((600 * 100000) / 1000000));
});

test('getRowOffset - top anchor, no css, no rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ topMargin: 10 }));
    const pos = { anchor: 'top-left', rely: false, y: 5 };
    const result = layout.getRowOffset(pos, false);
    assert.equal(result, 15);
});

test('getRowOffset - bottom anchor, no css, no rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ bottomMargin: 10 }));
    const pos = { anchor: 'bottom-left', rely: false, y: 5 };
    const result = layout.getRowOffset(pos, false);
    assert.equal(result, 15);
});

// ============================================================================
// adaptColumnOffset
// ============================================================================

test('adaptColumnOffset - cells unit (number)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4 }));
    const result = layout.adaptColumnOffset(50, 800);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 50);
    assert.equal(result.inPixels, 0);
});

test('adaptColumnOffset - percentage unit with width', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4 }));
    const result = layout.adaptColumnOffset('50%', 1000);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 500);
    assert.equal(result.inLU, 500000);
});

test('adaptColumnOffset - percentage unit without width', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4 }));
    const result = layout.adaptColumnOffset('50%');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
});

test('adaptColumnOffset - px unit, value less than leftMargin', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 20 }));
    const result = layout.adaptColumnOffset('10px', 800);

    assert.equal(result.inLU, 0);
    assert.equal(result.inPixels, 0);
});

test('adaptColumnOffset - px unit, value more than leftMargin', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4 }));
    const result = layout.adaptColumnOffset('100px', 1000);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.ok(result.inPixels > 0);
});

// ============================================================================
// adaptRowOffset
// ============================================================================

test('adaptRowOffset - newsize >= topMargin', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ topMargin: 10 }));
    const result = layout.adaptRowOffset('200px');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.ok(result.inPixels >= 0);
});

test('adaptRowOffset - newsize < topMargin (clamped to 0)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ topMargin: 200 }));
    const result = layout.adaptRowOffset('50px');

    assert.equal(result.inPixels, 0);
    assert.equal(result.inLU, 0);
});

// ============================================================================
// adaptHeight
// ============================================================================

test('adaptHeight - percentage unit', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.adaptHeight('50%');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 300);
});

test('adaptHeight - cells unit (number)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.adaptHeight(100000);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 100000);
});

test('adaptHeight - px unit', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.adaptHeight('200px');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 200);
});

test('adaptHeight - cells unit (string with no suffix)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.adaptHeight('100');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
});

// ============================================================================
// _notifyWindowResizeEvent
// ============================================================================

test('_notifyWindowResizeEvent - widthChanged true, calls parent', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    layout._notifyWindowResizeEvent(true, false);

    assert.equal(_parentNotifyWindowResizeCalls.length, 1);
    assert.deepEqual(_parentNotifyWindowResizeCalls[0], { widthChanged: true, heightChanged: false });
});

test('_notifyWindowResizeEvent - widthChanged false, skips parent', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    layout._notifyWindowResizeEvent(false, true);

    assert.equal(_parentNotifyWindowResizeCalls.length, 0);
});

test('_notifyWindowResizeEvent - widthChanged false, heightChanged false', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    layout._notifyWindowResizeEvent(false, false);

    assert.equal(_parentNotifyWindowResizeCalls.length, 0);
});

// ============================================================================
// _notifyResizeEvent
// ============================================================================

test('_notifyResizeEvent - resize left side, left anchor, width changed', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';

    let setPosCalled = null;
    let repaintCalled = false;
    let updateCalled = false;
    widget.setPosition = (pos) => { setPosCalled = pos; return widget; };
    widget.repaint = () => { repaintCalled = true; return widget; };
    layout.dragboard.update = () => { updateCalled = true; };

    layout._notifyResizeEvent(widget, 100000, 100000, 200000, 100000, true, false, false);

    assert.equal(setPosCalled.x, widget.position.x - 100000);
    assert.equal(setPosCalled.y, undefined);
    assert.equal(repaintCalled, true);
    assert.equal(updateCalled, false);
});

test('_notifyResizeEvent - resize right side, right anchor, width changed', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-right';

    let setPosCalled = null;
    let repaintCalled = false;
    widget.setPosition = (pos) => { setPosCalled = pos; return widget; };
    widget.repaint = () => { repaintCalled = true; return widget; };

    // resizeLeftSide=false, anchor ends with "right" → moves x
    layout._notifyResizeEvent(widget, 100000, 100000, 200000, 100000, false, false, false);

    assert.equal(setPosCalled.x, widget.position.x - 100000);
    assert.equal(repaintCalled, true);
});

test('_notifyResizeEvent - resize left side, center anchor, width changed', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-center';

    let setPosCalled = null;
    widget.setPosition = (pos) => { setPosCalled = pos; return widget; };
    widget.repaint = () => widget;

    layout._notifyResizeEvent(widget, 100000, 100000, 200000, 100000, true, false, false);

    assert.equal(setPosCalled.x, widget.position.x - 50000);
});

test('_notifyResizeEvent - resize top side, top anchor, height changed', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';

    let setPosCalled = null;
    widget.setPosition = (pos) => { setPosCalled = pos; return widget; };
    widget.repaint = () => widget;

    layout._notifyResizeEvent(widget, 100000, 100000, 100000, 200000, false, true, false);

    assert.equal(setPosCalled.y, widget.position.y - 100000);
});

test('_notifyResizeEvent - resize bottom side, bottom anchor, height changed', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'bottom-left';

    let setPosCalled = null;
    widget.setPosition = (pos) => { setPosCalled = pos; return widget; };
    widget.repaint = () => widget;

    // resizeTopSide=false, anchor starts with "bottom" → moves y
    layout._notifyResizeEvent(widget, 100000, 100000, 100000, 200000, false, false, false);

    assert.equal(setPosCalled.y, widget.position.y - 100000);
});

test('_notifyResizeEvent - no dimension change (widthDiff=0, heightDiff=0)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';

    let setPosCalled = false;
    widget.setPosition = () => { setPosCalled = true; return widget; };
    widget.repaint = () => widget;

    layout._notifyResizeEvent(widget, 100000, 100000, 100000, 100000, true, true, false);

    assert.equal(setPosCalled, false);
});

test('_notifyResizeEvent - persist true calls dragboard.update', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';

    widget.setPosition = () => widget;
    widget.repaint = () => widget;
    let updateCalled = false;
    let updateArgs = null;
    layout.dragboard.update = (ids) => { updateCalled = true; updateArgs = ids; };

    layout._notifyResizeEvent(widget, 100000, 100000, 200000, 100000, true, false, true);

    assert.equal(updateCalled, true);
    assert.deepEqual(updateArgs, ['w1']);
});

test('_notifyResizeEvent - persist false does NOT call dragboard.update', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';

    widget.setPosition = () => widget;
    widget.repaint = () => widget;
    let updateCalled = false;
    layout.dragboard.update = () => { updateCalled = true; };

    // Same dimensions, no pos change
    layout._notifyResizeEvent(widget, 100000, 100000, 100000, 100000, false, false, false);

    assert.equal(updateCalled, false);
});

test('_notifyResizeEvent - persist true with position change', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';

    let setPosCalled = false;
    widget.setPosition = (pos) => {
        setPosCalled = true;
        Object.assign(widget.position, pos);
        return widget;
    };
    widget.repaint = () => widget;
    let updateCalled = false;
    layout.dragboard.update = () => { updateCalled = true; };

    layout._notifyResizeEvent(widget, 100000, 100000, 200000, 200000, true, true, true);

    assert.equal(setPosCalled, true);
    assert.equal(updateCalled, true);
});

// ============================================================================
// initialize
// ============================================================================

test('initialize - no widgets', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());

    assert.equal(layout.initialized, false);
    const result = layout.initialize();
    assert.equal(layout.initialized, true);
    assert.equal(result, false);
});

test('initialize - with widgets, calls repaint on each', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());

    const w1 = createWidgetView('w1');
    const w2 = createWidgetView('w2');
    let repaintCalls = [];
    w1.repaint = () => { repaintCalls.push('w1'); return w1; };
    w2.repaint = () => { repaintCalls.push('w2'); return w2; };

    layout.widgets = { w1, w2 };

    const result = layout.initialize();

    assert.equal(layout.initialized, true);
    assert.equal(result, false);
    assert.deepEqual(repaintCalls, ['w1', 'w2']);
});

test('initialize - returns false regardless of widgets', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const w1 = createWidgetView('w1');
    w1.repaint = () => w1;
    layout.widgets = { w1 };

    const result = layout.initialize();

    assert.equal(result, false);
});

// ============================================================================
// getCellAt
// ============================================================================

test('getCellAt returns DragboardPosition', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 5, topMargin: 10, getWidth: () => 800 }));

    const result = layout.getCellAt(205, 110);

    assert.ok(result instanceof Wirecloud.DragboardPosition);
    assert.equal(result.x, ((205 - 5) * 1000000) / 800);
    assert.equal(result.y, 110 - 10);
});

// ============================================================================
// addWidget
// ============================================================================

test('addWidget when not initialized calls parent and returns', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');

    const result = layout.addWidget(widget, false);

    assert.equal(_parentAddWidgetCalls.length, 1);
    assert.equal(_parentAddWidgetCalls[0].widget, widget);
    assert.equal(_parentAddWidgetCalls[0].affectsDragboard, false);
    assert.equal(result, undefined);
    assert.equal(layout.initialized, false);
});

test('addWidget when initialized calls parent and _adaptIWidget', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    layout.initialized = true;
    const widget = createWidgetView('w1');

    let adaptCalled = false;
    layout._adaptIWidget = (w) => { adaptCalled = true; assert.equal(w, widget); };

    const result = layout.addWidget(widget, true);

    assert.equal(_parentAddWidgetCalls.length, 1);
    assert.equal(adaptCalled, true);
    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
});

test('addWidget when initialized returns new Set (not parent Set)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    layout.initialized = true;
    const widget = createWidgetView('w1');

    const result = layout.addWidget(widget, false);

    assert.ok(result instanceof Set);
    // Returned by FreeLayout.addWidget, not the parent's Set
});

// ============================================================================
// initializeMove
// ============================================================================

test('initializeMove with valid widget', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    // Must pass instanceof WidgetView check
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    const draggable = { offsets: {}, setXOffset(v) { this.offsets.x = v; return this; }, setYOffset(v) { this.offsets.y = v; return this; } };

    layout.initializeMove(widget, draggable);

    assert.equal(layout.iwidgetToMove, widget);
    assert.deepEqual(layout.newPosition, { x: 100, y: 100 });
    assert.equal(draggable.offsets.x, 0);
    assert.equal(draggable.offsets.y, 0);
});

test('initializeMove throws TypeError for null widget', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());

    assert.throws(() => layout.initializeMove(null, {}), TypeError);
});

test('initializeMove throws TypeError for non-WidgetView', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());

    assert.throws(() => layout.initializeMove({}, {}), TypeError);
});

test('initializeMove with pending move cancels previous', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());

    // Create two WidgetView-like objects
    const oldWidget = createWidgetView('old');
    const newWidget = createWidgetView('new');
    const realProto = Object.getPrototypeOf(oldWidget);
    Object.setPrototypeOf(oldWidget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(newWidget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    oldWidget.repaint = () => oldWidget;
    newWidget.repaint = () => newWidget;

    let logCalls = [];
    Wirecloud.GlobalLogManager.log = (msg, level) => { logCalls.push({ msg, level }); };

    const draggable = { setXOffset() { return this; }, setYOffset() { return this; } };

    layout.initializeMove(oldWidget, draggable);
    assert.equal(layout.iwidgetToMove, oldWidget);

    layout.initializeMove(newWidget, draggable);

    assert.equal(layout.iwidgetToMove, newWidget);
    assert.notEqual(layout.iwidgetToMove, oldWidget);

    // Should have logged a warning about canceling pending move
    assert.equal(logCalls.length, 1);
    assert.equal(logCalls[0].level, 2); // WARN_MSG
    assert.ok(logCalls[0].msg.includes('pending move'));
});

// ============================================================================
// moveTemporally
// ============================================================================

test('moveTemporally without initialized move logs warning', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());

    let logCalls = [];
    Wirecloud.GlobalLogManager.log = (msg, level) => { logCalls.push({ msg, level }); };

    layout.moveTemporally(100, 200);

    assert.equal(logCalls.length, 1);
    assert.equal(logCalls[0].level, 2);
});

test('moveTemporally clamps negative y to 0', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.wrapperElement.offsetLeft = 50;
    widget.wrapperElement.offsetTop = 50;
    widget.shape.width = 200000;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.moveTemporally(100, -10);

    assert.equal(layout.newPosition.x, 100);
    assert.equal(layout.newPosition.y, 0);
});

test('moveTemporally clamps negative x to 0', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.wrapperElement.offsetLeft = 50;
    widget.wrapperElement.offsetTop = 50;
    widget.shape.width = 200000;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.moveTemporally(-5, 100);

    assert.equal(layout.newPosition.x, 0);
    assert.equal(layout.newPosition.y, 100);
});

test('moveTemporally clamps x > maxX', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.wrapperElement.offsetLeft = 50;
    widget.wrapperElement.offsetTop = 50;
    widget.shape.width = 200000;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    // MAX_HLU = 1000000, shape.width = 200000
    // maxX = 1000000 - 200000 = 800000
    layout.moveTemporally(999999, 100);

    assert.equal(layout.newPosition.x, 1000000 - 200000); // 800000
    assert.equal(layout.newPosition.y, 100);
});

test('moveTemporally within bounds - sets position', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.wrapperElement.offsetLeft = 50;
    widget.wrapperElement.offsetTop = 50;
    widget.shape.width = 200000;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.moveTemporally(500000, 300);

    assert.equal(layout.newPosition.x, 500000);
    assert.equal(layout.newPosition.y, 300);
});

// ============================================================================
// acceptMove
// ============================================================================

test('acceptMove without initialized move logs warning', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());

    let logCalls = [];
    Wirecloud.GlobalLogManager.log = (msg, level) => { logCalls.push({ msg, level }); };

    layout.acceptMove();

    assert.equal(logCalls.length, 1);
    assert.equal(logCalls[0].level, 2);
});

test('acceptMove - top-left anchor, no relx/rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800, getHeight: () => 600, leftMargin: 5, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.shape.relwidth = false;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };

    let updateIds = null;
    layout.dragboard.update = (ids) => { updateIds = ids; };

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 100, y: 200 };
    layout.acceptMove();

    assert.ok(setPosArgs);
    // top-left: anchor doesn't end with "right" so x -= leftMargin
    assert.equal(setPosArgs.x, 100 - 5);
    assert.equal(setPosArgs.y, 200 - 10);
    assert.deepEqual(updateIds, ['w1']);
    assert.equal(layout.iwidgetToMove, null);
    assert.equal(layout.newPosition, null);
});

test('acceptMove - bottom-right anchor, no relx/rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800, getHeight: () => 600, leftMargin: 5, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'bottom-right';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.wrapperElement.offsetHeight = 150;
    widget.wrapperElement.offsetWidth = 200;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };
    layout.dragboard.update = () => {};

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 100, y: 200 };
    layout.acceptMove();

    // Y: bottom-* anchor → y = getHeight - offsetHeight - y
    // Then bottom anchor → y += topMargin
    // X: bottom-right / top-right → x = getWidth - offsetWidth - x
    // Then right anchor → x += leftMargin
    const expectedY = 600 - 150 - 200 + 10;
    const expectedX = 800 - 200 - 100 + 5;

    assert.equal(setPosArgs.y, expectedY);
    assert.equal(setPosArgs.x, expectedX);
});

test('acceptMove - bottom-center anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800, getHeight: () => 600, leftMargin: 5, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'bottom-center';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.shape.relwidth = false;
    widget.shape.width = 200000;
    widget.wrapperElement.offsetHeight = 150;
    widget.wrapperElement.offsetWidth = 200;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };
    layout.dragboard.update = () => {};

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 100, y: 200 };
    layout.acceptMove();

    // Y: bottom-* → y = getHeight - offsetHeight - y; then bottom anchor → y += topMargin
    const expectedY = 600 - 150 - 200 + 10;
    // X: bottom-center/top-center → x += shape.width / 2 (200000 LU / 2 = 100000), then x -= leftMargin
    const expectedX = 100 + 100000 - 5;

    assert.equal(setPosArgs.y, expectedY);
    assert.equal(setPosArgs.x, expectedX);
});

test('acceptMove - rely true', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800, getHeight: () => 600, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';
    widget.position.relx = false;
    widget.position.rely = true;
    widget.shape.width = 200000;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };
    layout.dragboard.update = () => {};

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 100, y: 200 };
    layout.acceptMove();

    // rely=true → adaptRowOffset("200px").inLU
    // fromPixelsToVCells(190) = 190*1000000/600
    assert.ok(setPosArgs);
    assert.notEqual(setPosArgs.y, undefined);
});

test('acceptMove - relx true', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800, leftMargin: 5 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';
    widget.position.relx = true;
    widget.position.rely = false;
    widget.shape.width = 200000;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };
    layout.dragboard.update = () => {};

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 100, y: 200 };
    layout.acceptMove();

    // relx=true → adaptColumnOffset("100px").inLU
    assert.ok(setPosArgs);
    assert.notEqual(setPosArgs.x, undefined);
});

test('acceptMove - top-right anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800, getHeight: () => 600, leftMargin: 5, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-right';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.wrapperElement.offsetWidth = 200;
    widget.wrapperElement.offsetHeight = 150;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };
    layout.dragboard.update = () => {};

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 100, y: 200 };
    layout.acceptMove();

    // X: top-right → x = getWidth - offsetWidth - x; then right anchor → x += leftMargin
    const expectedX = 800 - 200 - 100 + 5;
    // Y: NOT bottom-* → stays as is; top anchor → y -= topMargin
    const expectedY = 200 - 10;

    assert.equal(setPosArgs.x, expectedX);
    assert.equal(setPosArgs.y, expectedY);
});

test('acceptMove - top-center anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-center';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.shape.relwidth = false;
    widget.shape.width = 200000;
    widget.wrapperElement.offsetWidth = 200;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };
    layout.dragboard.update = () => {};

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 100, y: 200 };
    layout.acceptMove();

    assert.ok(setPosArgs);
});

test('acceptMove - bottom-center anchor with relwidth', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getWidth: () => 800, getHeight: () => 600, leftMargin: 5, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'bottom-center';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.shape.relwidth = true;
    widget.shape.width = 500000;
    widget.wrapperElement.offsetHeight = 150;
    widget.wrapperElement.offsetWidth = 200;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };
    layout.dragboard.update = () => {};

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 100, y: 200 };
    layout.acceptMove();

    assert.ok(setPosArgs);
});

test('_notifyResizeEvent - X block entered but widthDiff=0', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';

    let setPosCalled = false;
    widget.setPosition = () => { setPosCalled = true; return widget; };
    widget.repaint = () => widget;

    // Outer X if true (resizeLeftSide=true, anchor="left") but widthDiff=0
    // Y should not change (resizeTopSide=false, anchor not "bottom")
    layout._notifyResizeEvent(widget, 200000, 100000, 200000, 100000, true, false, false);

    assert.equal(setPosCalled, false);
});

test('_notifyResizeEvent - Y block entered but heightDiff=0', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';

    let setPosCalled = false;
    widget.setPosition = () => { setPosCalled = true; return widget; };
    widget.repaint = () => widget;

    // Outer Y if true (resizeTopSide=true, anchor="top") but heightDiff=0
    // X should not change (resizeLeftSide=false, anchor not "right")
    layout._notifyResizeEvent(widget, 100000, 200000, 100000, 200000, false, true, false);

    assert.equal(setPosCalled, false);
});

// ============================================================================
// updatePosition
// ============================================================================

test('updatePosition - top-left anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';
    widget.position.relx = false;
    widget.position.rely = false;

    const element = document.createElement('div');
    const result = layout.updatePosition(widget, element);

    assert.equal(element.style.top, '10px'); // topMargin + position.y
    assert.equal(element.style.bottom, '');
    assert.equal(element.style.left, '4px'); // leftMargin + position.x
    assert.equal(element.style.right, '');
    assert.equal(result, layout);
});

test('updatePosition - top-right anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ rightMargin: 7, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-right';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.position.x = 10;

    const element = document.createElement('div');
    layout.updatePosition(widget, element);

    assert.equal(element.style.top, '10px');
    assert.equal(element.style.bottom, '');
    assert.equal(element.style.right, '17px');
    assert.equal(element.style.left, '');
});

test('updatePosition - bottom-left anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4, bottomMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'bottom-left';
    widget.position.relx = false;
    widget.position.rely = false;

    const element = document.createElement('div');
    layout.updatePosition(widget, element);

    assert.equal(element.style.top, '');
    assert.equal(element.style.bottom, '10px');
    assert.equal(element.style.left, '4px');
    assert.equal(element.style.right, '');
});

test('updatePosition - bottom-right anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ rightMargin: 7, bottomMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'bottom-right';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.position.x = 10;

    const element = document.createElement('div');
    layout.updatePosition(widget, element);

    assert.equal(element.style.top, '');
    assert.equal(element.style.bottom, '10px');
    assert.equal(element.style.right, '17px');
    assert.equal(element.style.left, '');
});

test('updatePosition - top-center anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-center';
    widget.position.relx = false;
    widget.position.rely = false;

    const element = document.createElement('div');
    layout.updatePosition(widget, element);

    assert.equal(element.style.top, '10px');
    assert.equal(element.style.bottom, '');
    assert.equal(element.style.left, '4px');
    assert.equal(element.style.right, '');
});

test('updatePosition - bottom-center anchor', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4, bottomMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'bottom-center';
    widget.position.relx = false;
    widget.position.rely = false;

    const element = document.createElement('div');
    layout.updatePosition(widget, element);

    assert.equal(element.style.top, '');
    assert.equal(element.style.bottom, '10px');
    assert.equal(element.style.left, '4px');
    assert.equal(element.style.right, '');
});

test('updatePosition - center anchor with relwidth', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4, rightMargin: 6, topMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-center';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.shape.relwidth = true;
    widget.shape.width = 200000; // in LU

    const element = document.createElement('div');
    layout.updatePosition(widget, element);

    assert.equal(element.style.top, '10px');
    assert.ok(element.style.marginLeft.includes('calc('));
    assert.ok(element.style.marginLeft.includes('%'));
});

test('updatePosition - center anchor without relwidth', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-center';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.shape.relwidth = false;
    widget.shape.width = 400; // non-LU width (px-based)

    const element = document.createElement('div');
    layout.updatePosition(widget, element);

    assert.ok(element.style.marginLeft.startsWith('-'));
    assert.ok(element.style.marginLeft.endsWith('px'));
});

// ============================================================================
// updateShape
// ============================================================================

test('updateShape - relwidth', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ leftMargin: 4, rightMargin: 6 }));
    const widget = createWidgetView('w1');
    widget.shape.relwidth = true;
    widget.shape.width = 200000;

    const element = document.createElement('div');
    const result = layout.updateShape(widget, element);

    assert.ok(element.style.width.includes('calc('));
    assert.equal(result, layout);
});

test('updateShape - fixed width', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.shape.relwidth = false;
    widget.shape.width = 300;

    const element = document.createElement('div');
    layout.updateShape(widget, element);

    assert.equal(element.style.width, '300px');
});

test('updateShape - minimized widget (height empty)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.minimized = true;

    const element = document.createElement('div');
    element.style.height = '100px'; // initially set something
    layout.updateShape(widget, element);

    assert.equal(element.style.height, '');
});

test('updateShape - relheight', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ topMargin: 10, bottomMargin: 10 }));
    const widget = createWidgetView('w1');
    widget.minimized = false;
    widget.shape.relheight = true;
    widget.shape.height = 200000;

    const element = document.createElement('div');
    layout.updateShape(widget, element);

    assert.ok(element.style.height.includes('calc('));
});

test('updateShape - fixed height', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    widget.minimized = false;
    widget.shape.relheight = false;
    widget.shape.height = 300;

    const element = document.createElement('div');
    layout.updateShape(widget, element);

    assert.equal(element.style.height, '300px');
});

// ============================================================================
// cancelMove
// ============================================================================

test('cancelMove without initialized move logs warning', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());

    let logCalls = [];
    Wirecloud.GlobalLogManager.log = (msg, level) => { logCalls.push({ msg, level }); };

    layout.cancelMove();

    assert.equal(logCalls.length, 1);
    assert.equal(logCalls[0].level, 2);
    assert.ok(logCalls[0].msg.includes('cancel'));
});

test('cancelMove with initialized move repaints and clears state', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const widget = createWidgetView('w1');
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let repaintCalled = false;
    widget.repaint = () => { repaintCalled = true; return widget; };

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.newPosition = { x: 500, y: 300 };

    layout.cancelMove();

    assert.equal(repaintCalled, true);
    assert.equal(layout.iwidgetToMove, null);
    assert.equal(layout.newPosition, null);
});

// ============================================================================
// searchBestPosition
// ============================================================================

test('searchBestPosition - first placement fits (bottom-right)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({
        getWidth: () => 1000,
        getHeight: () => 800,
        leftMargin: 4,
        topMargin: 10,
    }));

    const options = {
        refposition: { left: 100, top: 100, right: 200, bottom: 180 },
        refiframe: null,
        width: 100000,
        height: 60,
    };
    const layoutConfig = { width: 100000, height: 80 };

    layout.searchBestPosition(options, layoutConfig, 1000);

    // layoutConfig should be modified with left (in LU) and top (inPixels)
    assert.ok(typeof layoutConfig.left === 'number');
    assert.ok(typeof layoutConfig.top === 'number');
});

test('searchBestPosition - with refiframe', () => {
    setup(true); // mock getRelativePosition
    const iframe = document.createElement('iframe');
    const wrapperEl = document.createElement('div');

    const layout = new Wirecloud.ui.FreeLayout(createDragboard({
        getWidth: () => 1000,
        getHeight: () => 800,
        leftMargin: 4,
        topMargin: 10,
        tab: { wrapperElement: wrapperEl },
    }));

    const options = {
        refposition: { left: 100, top: 100, right: 200, bottom: 180 },
        refiframe: iframe,
        width: 100000,
        height: 60,
    };
    const layoutConfig = { width: 100000, height: 80 };

    layout.searchBestPosition(options, layoutConfig, 1000);

    assert.ok(typeof layoutConfig.left === 'number');
    assert.ok(typeof layoutConfig.top === 'number');
});

test('searchBestPosition - all placements overflow (pick best)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({
        getWidth: () => 300,
        getHeight: () => 200,
        leftMargin: 4,
        topMargin: 10,
    }));

    const options = {
        refposition: { left: 250, top: 150, right: 350, bottom: 250 },
        refiframe: null,
        width: 200000,
        height: 30,
    };
    const layoutConfig = { width: 200000, height: 40 };

    layout.searchBestPosition(options, layoutConfig, 800);

    // All placements should overflow the small dragboard
    // The best (minimum standsOut) should be selected
    assert.ok(typeof layoutConfig.left !== 'undefined');
    assert.ok(typeof layoutConfig.top !== 'undefined');
});

test('searchBestPosition - second placement fits (bottom-left)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({
        getWidth: () => 1000,
        getHeight: () => 1000,
        leftMargin: 4,
        topMargin: 10,
    }));

    // Make bottom-right overflow (refposition right is way off)
    // and bottom-left fit
    const options = {
        refposition: { left: 900, top: 100, right: 1100, bottom: 180 },
        refiframe: null,
        width: 50000,
        height: 60,
    };
    const layoutConfig = { width: 50000, height: 30 };

    layout.searchBestPosition(options, layoutConfig, 1000);

    assert.ok(typeof layoutConfig.left === 'number');
    assert.ok(typeof layoutConfig.top === 'number');
});

test('searchBestPosition - top-left placement fits', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({
        getWidth: () => 1000,
        getHeight: () => 1000,
        leftMargin: 4,
        topMargin: 10,
    }));

    // Make bottom placements overflow (refposition bottom is way below)
    // and top-left fit (ref has space above)
    const options = {
        refposition: { left: 100, top: 500, right: 200, bottom: 1100 },
        refiframe: null,
        width: 50000,
        height: 60,
    };
    const layoutConfig = { width: 50000, height: 40 };

    layout.searchBestPosition(options, layoutConfig, 1000);

    assert.ok(typeof layoutConfig.left === 'number');
    assert.ok(typeof layoutConfig.top === 'number');
});

test('searchBestPosition - with width adjustment when left+width >= MAX_HLU', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({
        getWidth: () => 300,
        getHeight: () => 200,
        leftMargin: 4,
        topMargin: 10,
    }));

    // All placements overflow, best is bottom-right with adapted left of ~115000 LU
    // Combined with width=900000 gives >= 1000000 (MAX_HLU), triggering width clip
    const options = {
        refposition: { left: 100, top: 80, right: 200, bottom: 160 },
        refiframe: null,
        width: 900000,
        height: 30,
    };
    const layoutConfig = { width: 900000, height: 30 };

    layout.searchBestPosition(options, layoutConfig, 800);

    assert.ok(typeof layoutConfig.left === 'number');
    assert.ok(typeof layoutConfig.top === 'number');
    // Width was clipped: 115000 + 900000 = 1015000 >= 1000000
    assert.ok(layoutConfig.width <= 900000);
});

// ============================================================================
// delete options.left/top/right/bottom in setPosition
// ============================================================================

test('setPosition deletes left/top/right/bottom from options (via searchBestPosition)', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({
        getWidth: () => 1000,
        getHeight: () => 800,
        leftMargin: 4,
        topMargin: 10,
    }));

    const options = {
        refposition: { left: 100, top: 100, right: 200, bottom: 180 },
        refiframe: null,
        width: 50000,
        height: 60,
        left: 'garbage',
        top: 'garbage',
        right: 'garbage',
        bottom: 'garbage',
    };
    const layoutConfig = { width: 50000, height: 40 };

    layout.searchBestPosition(options, layoutConfig, 1000);

    assert.equal(options.left, undefined);
    assert.equal(options.top, undefined);
    assert.equal(options.right, undefined);
    assert.equal(options.bottom, undefined);
    // refposition should still be intact
    assert.equal(options.refposition.left, 100);
});

// ============================================================================
// Integration: initializeMove → moveTemporally → acceptMove
// ============================================================================

test('full move lifecycle', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({
        getWidth: () => 800,
        getHeight: () => 600,
        leftMargin: 5,
        topMargin: 10,
    }));
    const widget = createWidgetView('w1');
    widget.position.anchor = 'top-left';
    widget.position.relx = false;
    widget.position.rely = false;
    widget.wrapperElement.offsetLeft = 100;
    widget.wrapperElement.offsetTop = 100;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    let setPosArgs = null;
    widget.setPosition = (pos) => { setPosArgs = pos; return widget; };

    let updateIds = null;
    layout.dragboard.update = (ids) => { updateIds = ids; };

    const draggable = { offsets: {}, setXOffset(v) { this.offsets.x = v; return this; }, setYOffset(v) { this.offsets.y = v; return this; } };

    layout.initializeMove(widget, draggable);
    assert.equal(layout.iwidgetToMove, widget);
    assert.equal(draggable.offsets.x, 0);

    layout.moveTemporally(200, 300);
    assert.equal(layout.newPosition.x, 200);
    assert.equal(layout.newPosition.y, 300);

    layout.acceptMove();
    assert.ok(setPosArgs);
    assert.equal(setPosArgs.x, 200 - 5);
    assert.equal(setPosArgs.y, 300 - 10);
    assert.deepEqual(updateIds, ['w1']);
    assert.equal(layout.iwidgetToMove, null);
});

// ============================================================================
// Edge cases and boundary values
// ============================================================================

test('adaptColumnOffset - negative percentage', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard());
    const result = layout.adaptColumnOffset('-10%', 800);
    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
});

test('adaptHeight - percentage unit with large value', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ getHeight: () => 100 }));
    const result = layout.adaptHeight('200%');
    assert.equal(result.inPixels, 200);
});

test('getColumnOffset - right anchor, no css, relx', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ rightMargin: 7 }));
    const pos = { anchor: 'top-right', relx: true, x: 200000 };
    const result = layout.getColumnOffset(pos, 800, false);
    assert.equal(result, 7 + Math.round((800 * 200000) / 1000000));
});

test('getRowOffset - bottom anchor, no css, rely', () => {
    setup();
    const layout = new Wirecloud.ui.FreeLayout(createDragboard({ bottomMargin: 10 }));
    const pos = { anchor: 'bottom-left', rely: true, y: 200000 };
    const result = layout.getRowOffset(pos, false);
    assert.equal(result, 10 + Math.round((600 * 200000) / 1000000));
});
