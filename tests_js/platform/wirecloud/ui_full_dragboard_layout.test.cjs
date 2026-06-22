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
    };

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

    // Store last interactions per-test for assertions
    const _tracker = {
        lastSuperAddWidget: null,
        lastSuperRemoveWidget: null,
        superAddWidgetCalls: [],
        superRemoveWidgetCalls: [],
    };

    Wirecloud.ui.DragboardLayout = class DragboardLayout {
        constructor(dragboard, scrollbarSpace) {
            _tracker.constructorArgs = { dragboard, scrollbarSpace };
            this.dragboard = dragboard;
            this.widgets = {};
            this.iWidgets = {};
            this._on_remove_widget_bound = () => {};
        }

        addWidget(widget, affectsDragboard) {
            _tracker.lastSuperAddWidget = { widget, affectsDragboard };
            _tracker.superAddWidgetCalls.push({ widget, affectsDragboard });

            widget.layout = this;
            if (affectsDragboard) {
                this.dragboard._addWidget(widget);
            }
            this.widgets[widget.id] = widget;
            this.iWidgets[widget.id] = widget;
            widget.addEventListener('remove', this._on_remove_widget_bound);
            widget.repaint();

            return new Set();
        }

        removeWidget(widget, affectsDragboard) {
            _tracker.lastSuperRemoveWidget = { widget, affectsDragboard };
            _tracker.superRemoveWidgetCalls.push({ widget, affectsDragboard });

            delete this.widgets[widget.id];
            delete this.iWidgets[widget.id];

            if (affectsDragboard) {
                this.dragboard._removeWidget(widget);
            }

            widget.layout = null;
            widget.removeEventListener('remove', this._on_remove_widget_bound);

            return new Set();
        }

        getWidth() {
            return this.dragboard.getWidth();
        }

        getHeight() {
            return this.dragboard.getHeight();
        }
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/FullDragboardLayout.js');

    return _tracker;
};

const makeDragboard = (overrides = {}) => {
    const wrapperElement = document.createElement('div');
    wrapperElement.offsetWidth = 800;
    wrapperElement.offsetHeight = 600;

    return Object.assign({
        getWidth: () => 1200,
        getHeight: () => 900,
        _addWidget: () => {},
        _removeWidget: () => {},
        update: () => {},
        leftMargin: 5,
        topMargin: 5,
        tab: {
            wrapperElement,
        },
    }, overrides);
};

const makeWidget = (id = 'w1') => {
    const wrapperElement = document.createElement('section');
    return {
        id,
        wrapperElement,
        position: { x: 0, y: 0 },
        setPosition: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        repaint: () => {},
        paint: () => {},
        layout: null,
        minimized: false,
    };
};

// ============================================================================
// CONSTRUCTOR
// ============================================================================

test('constructor creates FullDragboardLayout instance', () => {
    const tracker = setup();
    const db = makeDragboard();
    const scrollbarSpace = 17;
    const layout = new Wirecloud.ui.FullDragboardLayout(db, scrollbarSpace);

    assert.ok(layout instanceof Wirecloud.ui.DragboardLayout);
    assert.ok(layout instanceof Wirecloud.ui.FullDragboardLayout);
    assert.equal(layout.dragboard, db);
    assert.equal(layout.initialized, false);
    assert.deepEqual(layout.widgets, {});
    assert.deepEqual(layout.iWidgets, {});
    assert.equal(tracker.constructorArgs.dragboard, db);
    assert.equal(tracker.constructorArgs.scrollbarSpace, scrollbarSpace);
});

test('constructor without scrollbarSpace', () => {
    setup();
    const db = makeDragboard();
    const layout = new Wirecloud.ui.FullDragboardLayout(db);

    assert.ok(layout instanceof Wirecloud.ui.FullDragboardLayout);
    assert.equal(layout.dragboard, db);
    assert.equal(layout.initialized, false);
});

// ============================================================================
// fromPixelsToVCells
// ============================================================================

test('fromPixelsToVCells returns 1 for positive value', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.fromPixelsToVCells(100), 1);
});

test('fromPixelsToVCells returns 1 for zero', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.fromPixelsToVCells(0), 1);
});

test('fromPixelsToVCells returns 1 for negative value', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.fromPixelsToVCells(-50), 1);
});

// ============================================================================
// fromVCellsToPixels
// ============================================================================

test('fromVCellsToPixels returns getHeight', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getHeight: () => 900 }));
    assert.equal(layout.fromVCellsToPixels(5), 900);
});

test('fromVCellsToPixels returns getHeight regardless of cells value', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getHeight: () => 450 }));
    assert.equal(layout.fromVCellsToPixels(0), 450);
    assert.equal(layout.fromVCellsToPixels(100), 450);
});

// ============================================================================
// getWidthInPixels
// ============================================================================

test('getWidthInPixels returns null', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.getWidthInPixels(3), null);
    assert.equal(layout.getWidthInPixels(0), null);
    assert.equal(layout.getWidthInPixels(100), null);
});

// ============================================================================
// getHeightInPixels
// ============================================================================

test('getHeightInPixels returns null', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.getHeightInPixels(3), null);
    assert.equal(layout.getHeightInPixels(0), null);
    assert.equal(layout.getHeightInPixels(100), null);
});

// ============================================================================
// fromPixelsToHCells
// ============================================================================

test('fromPixelsToHCells returns 1 for positive value', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.fromPixelsToHCells(200), 1);
});

test('fromPixelsToHCells returns 1 for zero', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.fromPixelsToHCells(0), 1);
});

// ============================================================================
// fromHCellsToPixels
// ============================================================================

test('fromHCellsToPixels returns getWidth', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getWidth: () => 1200 }));
    assert.equal(layout.fromHCellsToPixels(5), 1200);
});

test('fromHCellsToPixels returns getWidth regardless of cells value', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getWidth: () => 600 }));
    assert.equal(layout.fromHCellsToPixels(0), 600);
    assert.equal(layout.fromHCellsToPixels(10), 600);
});

// ============================================================================
// getColumnOffset
// ============================================================================

test('getColumnOffset returns 0 regardless of position', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.getColumnOffset({ x: 5, y: 10 }), 0);
    assert.equal(layout.getColumnOffset({ x: 0, y: 0 }), 0);
    assert.equal(layout.getColumnOffset({ x: 100, y: 200 }, 42), 0);
});

// ============================================================================
// getRowOffset
// ============================================================================

test('getRowOffset returns 0 regardless of position', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    assert.equal(layout.getRowOffset({ x: 5, y: 10 }), 0);
    assert.equal(layout.getRowOffset({ x: 0, y: 100 }), 0);
});

// ============================================================================
// adaptColumnOffset
// ============================================================================

test('adaptColumnOffset uses wrapperElement left position', () => {
    setup();
    const db = makeDragboard();
    db.tab.wrapperElement.getBoundingClientRect = () => ({ left: 42, top: 0, width: 800, height: 600 });

    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    const result = layout.adaptColumnOffset(100);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 42);
    assert.equal(result.inLU, 0);
});

test('adaptColumnOffset works with zero left', () => {
    setup();
    const db = makeDragboard();
    db.tab.wrapperElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    const result = layout.adaptColumnOffset(50);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 0);
    assert.equal(result.inLU, 0);
});

test('adaptColumnOffset ignores size parameter', () => {
    setup();
    const db = makeDragboard();
    db.tab.wrapperElement.getBoundingClientRect = () => ({ left: 77, top: 0, width: 800, height: 600 });

    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    const result1 = layout.adaptColumnOffset(10);
    const result2 = layout.adaptColumnOffset(999);

    assert.equal(result1.inPixels, 77);
    assert.equal(result2.inPixels, 77);
});

// ============================================================================
// adaptRowOffset
// ============================================================================

test('adaptRowOffset uses wrapperElement top position', () => {
    setup();
    const db = makeDragboard();
    db.tab.wrapperElement.getBoundingClientRect = () => ({ left: 0, top: 33, width: 800, height: 600 });

    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    const result = layout.adaptRowOffset(100);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 33);
    assert.equal(result.inLU, 0);
});

test('adaptRowOffset works with zero top', () => {
    setup();
    const db = makeDragboard();
    db.tab.wrapperElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    const result = layout.adaptRowOffset(50);

    assert.equal(result.inPixels, 0);
    assert.equal(result.inLU, 0);
});

test('adaptRowOffset ignores size parameter', () => {
    setup();
    const db = makeDragboard();
    db.tab.wrapperElement.getBoundingClientRect = () => ({ left: 0, top: 55, width: 800, height: 600 });

    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    const result1 = layout.adaptRowOffset(10);
    const result2 = layout.adaptRowOffset(999);

    assert.equal(result1.inPixels, 55);
    assert.equal(result2.inPixels, 55);
});

// ============================================================================
// adaptHeight
// ============================================================================

test('adaptHeight returns MultiValuedSize with getHeight and 1', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getHeight: () => 900 }));

    const result = layout.adaptHeight(5);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 900);
    assert.equal(result.inLU, 1);
});

test('adaptHeight ignores size parameter', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getHeight: () => 500 }));

    const result = layout.adaptHeight(200);

    assert.equal(result.inPixels, 500);
    assert.equal(result.inLU, 1);
});

// ============================================================================
// adaptWidth
// ============================================================================

test('adaptWidth returns MultiValuedSize with width when truthy', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getWidth: () => 1200 }));

    const result = layout.adaptWidth(5, 400);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 400);
    assert.equal(result.inLU, 1);
});

test('adaptWidth returns MultiValuedSize with getWidth when width is undefined', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getWidth: () => 1200 }));

    const result = layout.adaptWidth(5);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inPixels, 1200);
    assert.equal(result.inLU, 1);
});

test('adaptWidth returns MultiValuedSize with getWidth when width is null', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getWidth: () => 800 }));

    const result = layout.adaptWidth(5, null);

    assert.equal(result.inPixels, 800);
    assert.equal(result.inLU, 1);
});

test('adaptWidth returns MultiValuedSize with getWidth when width is 0 (falsy)', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getWidth: () => 640 }));

    const result = layout.adaptWidth(5, 0);

    // width=0 is falsy, so it uses getWidth() instead
    assert.equal(result.inPixels, 640);
    assert.equal(result.inLU, 1);
});

test('adaptWidth returns MultiValuedSize with getWidth when width is empty string', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard({ getWidth: () => 500 }));

    const result = layout.adaptWidth(5, '');

    assert.equal(result.inPixels, 500);
    assert.equal(result.inLU, 1);
});

// ============================================================================
// initialize
// ============================================================================

test('initialize sets initialized to true with no iWidgets', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    assert.equal(layout.initialized, false);
    layout.initialize();
    assert.equal(layout.initialized, true);
});

test('initialize calls paint(true) on each iWidget', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const paintCalls = [];
    const w1 = makeWidget('w1');
    w1.paint = (state) => paintCalls.push({ id: 'w1', state });
    const w2 = makeWidget('w2');
    w2.paint = (state) => paintCalls.push({ id: 'w2', state });

    layout.iWidgets = { w1, w2 };

    layout.initialize();

    assert.equal(layout.initialized, true);
    assert.equal(paintCalls.length, 2);
    assert.deepEqual(paintCalls[0], { id: 'w1', state: true });
    assert.deepEqual(paintCalls[1], { id: 'w2', state: true });
});

test('initialize calls paint on all own iWidgets (for-in iterates own properties)', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const paintCalls = [];
    const w1 = makeWidget('w1');
    w1.paint = (state) => paintCalls.push({ id: 'w1', state });
    const w2 = makeWidget('w2');
    w2.paint = (state) => paintCalls.push({ id: 'w2', state });
    const w3 = makeWidget('w3');
    w3.paint = (state) => paintCalls.push({ id: 'w3', state });

    layout.iWidgets = { w1, w2, w3 };

    layout.initialize();

    assert.equal(paintCalls.length, 3);
    assert.equal(layout.initialized, true);
});

test('initialize with single iWidget', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    let paintCalled = false;
    const w1 = makeWidget('w1');
    w1.paint = (state) => { paintCalled = state; };

    layout.iWidgets = { w1 };

    layout.initialize();

    assert.equal(paintCalled, true);
    assert.equal(layout.initialized, true);
});

test('initialize multiple times', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const paintCalls = [];
    const w1 = makeWidget('w1');
    w1.paint = (state) => paintCalls.push({ id: 'w1', state });

    layout.iWidgets = { w1 };

    layout.initialize();
    assert.equal(paintCalls.length, 1);

    // Second call re-paints (initialized is set to true at end each time)
    layout.initialize();
    assert.equal(paintCalls.length, 2);
    assert.equal(layout.initialized, true);
});

// ============================================================================
// getCellAt
// ============================================================================

test('getCellAt returns DragboardPosition(0, 0) regardless of coordinates', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const result = layout.getCellAt(100, 200);
    assert.ok(result instanceof Wirecloud.DragboardPosition);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
});

test('getCellAt returns 0,0 for zero coordinates', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    const result = layout.getCellAt(0, 0);

    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
});

test('getCellAt returns 0,0 for negative coordinates', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    const result = layout.getCellAt(-10, -20);

    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
});

// ============================================================================
// addWidget
// ============================================================================

test('addWidget when not initialized adds class and calls super', () => {
    const tracker = setup();
    const db = makeDragboard();
    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    const widget = makeWidget('w1');

    let paintCalled = false;
    widget.repaint = () => { paintCalled = true; };
    let addToDragboardCalled = false;
    db._addWidget = () => { addToDragboardCalled = true; };

    const result = layout.addWidget(widget, true);

    // Should add class
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), true);

    // Should call super.addWidget
    assert.equal(tracker.superAddWidgetCalls.length, 1);
    assert.equal(tracker.superAddWidgetCalls[0].widget, widget);
    assert.equal(tracker.superAddWidgetCalls[0].affectsDragboard, true);
    assert.equal(addToDragboardCalled, true);

    // Not initialized, so should NOT set position
    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
});

test('addWidget when initialized adds class, calls super, and sets position', () => {
    const tracker = setup();
    const db = makeDragboard();
    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    layout.initialized = true;

    const widget = makeWidget('w1');
    let setPositionCalled = null;
    widget.setPosition = (pos, flag) => { setPositionCalled = { pos, flag }; };

    const result = layout.addWidget(widget, false);

    // Should add class
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), true);

    // Should call super.addWidget
    assert.equal(tracker.superAddWidgetCalls.length, 1);
    assert.equal(tracker.superAddWidgetCalls[0].widget, widget);
    assert.equal(tracker.superAddWidgetCalls[0].affectsDragboard, false);

    // Should set position to (0, 0) with false flag
    assert.ok(setPositionCalled);
    assert.equal(setPositionCalled.pos.x, 0);
    assert.equal(setPositionCalled.pos.y, 0);
    assert.equal(setPositionCalled.flag, false);

    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
});

test('addWidget with affectsDragboard=true when initialized', () => {
    const tracker = setup();
    const db = makeDragboard();
    let addToDragboardCalled = false;
    db._addWidget = () => { addToDragboardCalled = true; };

    const layout = new Wirecloud.ui.FullDragboardLayout(db);
    layout.initialized = true;

    const widget = makeWidget('w2');
    let setPositionCalled = null;
    widget.setPosition = (pos, flag) => { setPositionCalled = { x: pos.x, y: pos.y, flag }; };

    layout.addWidget(widget, true);

    assert.equal(tracker.superAddWidgetCalls.length, 1);
    assert.equal(tracker.superAddWidgetCalls[0].affectsDragboard, true);
    assert.equal(addToDragboardCalled, true);
    assert.equal(setPositionCalled.x, 0);
    assert.equal(setPositionCalled.y, 0);
    assert.equal(setPositionCalled.flag, false);
});

test('addWidget when not initialized does not call setPosition', () => {
    setup();
    const db = makeDragboard();
    const layout = new Wirecloud.ui.FullDragboardLayout(db);

    const widget = makeWidget('w3');
    let setPositionCalled = false;
    widget.setPosition = () => { setPositionCalled = true; };

    layout.addWidget(widget, false);

    assert.equal(setPositionCalled, false);
    assert.equal(layout.initialized, false);
});

test('addWidget returns new Set every time', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const w1 = makeWidget('w1');
    const w2 = makeWidget('w2');

    const result1 = layout.addWidget(w1, false);
    const result2 = layout.addWidget(w2, false);

    assert.ok(result1 instanceof Set);
    assert.ok(result2 instanceof Set);
    assert.notStrictEqual(result1, result2);
});

test('addWidget returns new Set when initialized', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    layout.initialized = true;

    const w1 = makeWidget('w1');
    let setPosCalled = false;
    w1.setPosition = () => { setPosCalled = true; };

    const result = layout.addWidget(w1, false);

    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
    assert.equal(setPosCalled, true);
});

// ============================================================================
// removeWidget
// ============================================================================

test('removeWidget removes class and calls super.removeWidget', () => {
    const tracker = setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const widget = makeWidget('w1');
    widget.wrapperElement.classList.add('wc-widget-fulldragboard');
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), true);

    const result = layout.removeWidget(widget, true);

    // Should remove class
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), false);

    // Should call super.removeWidget
    assert.equal(tracker.superRemoveWidgetCalls.length, 1);
    assert.equal(tracker.superRemoveWidgetCalls[0].widget, widget);
    assert.equal(tracker.superRemoveWidgetCalls[0].affectsDragboard, true);

    // Returns result from super
    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
});

test('removeWidget with affectsDragboard=false', () => {
    const tracker = setup();
    const db = makeDragboard();
    let removeFromDragboardCalled = false;
    db._removeWidget = () => { removeFromDragboardCalled = true; };

    const layout = new Wirecloud.ui.FullDragboardLayout(db);

    const widget = makeWidget('w2');
    widget.wrapperElement.classList.add('wc-widget-fulldragboard');

    layout.removeWidget(widget, false);

    assert.equal(tracker.superRemoveWidgetCalls.length, 1);
    assert.equal(tracker.superRemoveWidgetCalls[0].affectsDragboard, false);
    assert.equal(removeFromDragboardCalled, false);
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), false);
});

test('removeWidget clears widget layout reference', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const widget = makeWidget('w3');
    widget.layout = layout;

    layout.removeWidget(widget, false);

    assert.equal(widget.layout, null);
});

test('removeWidget works with widget that never had the class', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const widget = makeWidget('w4');
    // Class never added - remove should still work
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), false);

    const result = layout.removeWidget(widget, false);

    assert.ok(result instanceof Set);
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), false);
});

test('removeWidget returns super.removeWidget result', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    const widget = makeWidget('w5');

    const result = layout.removeWidget(widget, true);

    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
});

// ============================================================================
// INTEGRATION: addWidget then removeWidget
// ============================================================================

test('addWidget and removeWidget sequence', () => {
    const tracker = setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    layout.initialized = true;

    const widget = makeWidget('seq');
    let setPosCalled = null;
    widget.setPosition = (pos, flag) => { setPosCalled = { x: pos.x, y: pos.y, flag }; };

    // Add
    const addResult = layout.addWidget(widget, true);
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), true);
    assert.equal(setPosCalled.x, 0);
    assert.equal(setPosCalled.y, 0);

    // Remove
    const removeResult = layout.removeWidget(widget, true);
    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), false);

    assert.ok(addResult instanceof Set);
    assert.ok(removeResult instanceof Set);
});

// ============================================================================
// EDGE CASES
// ============================================================================

test('initialize with iWidget containing widget with null paint', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const w1 = makeWidget('w1');
    w1.paint = null;

    layout.iWidgets = { w1 };

    assert.throws(() => layout.initialize(), TypeError);
});

test('addWidget with wrapperElement that already has class does not duplicate', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const widget = makeWidget('dup');
    widget.wrapperElement.classList.add('wc-widget-fulldragboard');

    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), true);

    layout.addWidget(widget, false);

    assert.equal(widget.wrapperElement.classList.contains('wc-widget-fulldragboard'), true);
});

test('adaptColumnOffset and adaptRowOffset can be called together', () => {
    setup();
    const db = makeDragboard();
    db.tab.wrapperElement.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });

    const layout = new Wirecloud.ui.FullDragboardLayout(db);

    const colResult = layout.adaptColumnOffset(50);
    const rowResult = layout.adaptRowOffset(50);

    assert.equal(colResult.inPixels, 10);
    assert.equal(colResult.inLU, 0);
    assert.equal(rowResult.inPixels, 20);
    assert.equal(rowResult.inLU, 0);
});

test('fromPixelsToVCells and fromPixelsToHCells both return 1', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    assert.equal(layout.fromPixelsToVCells(500), 1);
    assert.equal(layout.fromPixelsToHCells(500), 1);
});

test('getCellAt creates fresh DragboardPosition each call', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());

    const result1 = layout.getCellAt(10, 20);
    const result2 = layout.getCellAt(30, 40);

    assert.notStrictEqual(result1, result2);
    assert.equal(result2.x, 0);
    assert.equal(result2.y, 0);
});

test('addWidget when not initialized returns empty set', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    const widget = makeWidget('empty');

    const result = layout.addWidget(widget, false);

    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
});

test('addWidget sets position with DragboardPosition(0, 0)', () => {
    setup();
    const layout = new Wirecloud.ui.FullDragboardLayout(makeDragboard());
    layout.initialized = true;

    const widget = makeWidget('poscheck');
    let receivedPos = null;
    widget.setPosition = (pos, flag) => { receivedPos = pos; };

    layout.addWidget(widget, false);

    assert.ok(receivedPos instanceof Wirecloud.DragboardPosition);
    assert.equal(receivedPos.x, 0);
    assert.equal(receivedPos.y, 0);
});
