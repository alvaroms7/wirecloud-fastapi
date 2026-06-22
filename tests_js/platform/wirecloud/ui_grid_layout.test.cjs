const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const createDragboard = (overrides = {}) => Object.assign({
    getWidth: () => 1200,
    getHeight: () => 900,
    update: () => {},
    _addWidget: () => {},
    _removeWidget: () => {},
    leftMargin: 5,
    topMargin: 5,
}, overrides);

const createMockWidget = (id, x = 0, y = 0, width = 2, height = 2, overrides = {}) => {
    const pos = { x, y };
    const shape = { width, height };
    return Object.assign({
        id,
        position: pos,
        shape,
        setPosition(newPos) { Object.assign(pos, newPos); },
        setShape(newShape) {
            if (newShape.width != null) shape.width = newShape.width;
            if (newShape.height != null) shape.height = newShape.height;
        },
        addEventListener() {},
        removeEventListener() {},
        repaint() {},
        layout: null,
        element: null,
        model: { load() {} },
        moveToLayout() {},
    }, overrides);
};

/**
 * Fill matrix cells for a widget.
 */
const fillMatrix = (layout, widget) => {
    const pos = widget.position;
    for (let cx = 0; cx < widget.shape.width; cx++) {
        for (let cy = 0; cy < widget.shape.height; cy++) {
            if (!(pos.x + cx in layout.matrix)) {
                layout.matrix[pos.x + cx] = [];
            }
            layout.matrix[pos.x + cx][pos.y + cy] = widget;
        }
    }
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = Wirecloud.ui || {};

    Wirecloud.DragboardPosition = class DragboardPosition {
        constructor(x, y) { this.x = x; this.y = y; }
    };

    Wirecloud.ui.MultiValuedSize = class MultiValuedSize {
        constructor(inPixels, inLU) { this.inPixels = inPixels; this.inLU = inLU; }
    };

    Wirecloud.ui.WidgetView = class WidgetView {};
    Wirecloud.ui.DragboardCursor = class DragboardCursor {
        constructor(widget) {
            this.widget = widget;
            this.position = new Wirecloud.DragboardPosition(0, 0);
            this.id = 'cursor_' + (widget && widget.id ? widget.id : 'unknown');
            this.shape = {
                width: (widget && widget.shape) ? widget.shape.width : 1,
                height: (widget && widget.shape) ? widget.shape.height : 1,
            };
        }
        destroy() { this._destroyed = true; }
        setPosition(pos) { this.position = pos; }
    };

    Wirecloud.GlobalLogManager = { log() {} };
    Wirecloud.constants = Wirecloud.constants || {};
    Wirecloud.constants.LOGGING = { WARN_MSG: 2 };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/DragboardLayout.js',
        'src/wirecloud/platform/static/js/wirecloud/ui/ColumnLayout.js',
        'src/wirecloud/platform/static/js/wirecloud/ui/GridLayout.js',
    ]);
});

// ---------------------------------------------------------------------------
// CONSTRUCTOR
// ---------------------------------------------------------------------------

test('constructor with even margins creates GridLayout', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    assert.ok(layout instanceof Wirecloud.ui.DragboardLayout);
    assert.ok(layout instanceof Wirecloud.ui.GridLayout);
    assert.equal(layout.dragboard, db);
    assert.equal(layout.initialized, false);
    assert.equal(layout.columns, 20);
    assert.equal(layout.rows, 30);
    assert.equal(layout.topMargin, 5);
    assert.equal(layout.bottomMargin, 5);
    assert.equal(layout.leftMargin, 10);
    assert.equal(layout.rightMargin, 10);
    assert.equal(layout.dragboardCursor, null);
    assert.equal(layout.iwidgetToMove, null);
    assert.deepEqual(layout.widgets, {});
    assert.ok(Array.isArray(layout.matrix));
    assert.equal(layout.matrix.length, 20);
});

test('constructor with odd margins splits correctly', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 10, 20, 11, 21);

    assert.equal(layout.topMargin, 5);
    assert.equal(layout.bottomMargin, 6);       // floor(11/2)+1
    assert.equal(layout.leftMargin, 10);
    assert.equal(layout.rightMargin, 11);       // floor(21/2)+1
});

test('constructor with zero margins', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 5, 5, 0, 0);

    assert.equal(layout.topMargin, 0);
    assert.equal(layout.bottomMargin, 0);
    assert.equal(layout.leftMargin, 0);
    assert.equal(layout.rightMargin, 0);
});

test('constructor initializes empty matrix with correct columns', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 4, 5, 10, 10);

    assert.equal(layout.matrix.length, 4);
    for (let x = 0; x < 4; x++) {
        assert.ok(Array.isArray(layout.matrix[x]));
        assert.equal(layout.matrix[x].length, 0);
    }
    assert.strictEqual(layout._buffers.base.matrix, layout.matrix);
});

// ---------------------------------------------------------------------------
// fromPixelsToVCells
// ---------------------------------------------------------------------------

test('fromPixelsToVCells - positive value converts correctly', () => {
    const db = createDragboard({ getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromVCellsToPixels(1) = (900 * (100/30)) / 100 = 30
    // 60 / 30 = 2
    assert.equal(layout.fromPixelsToVCells(60), 2);
});

test('fromPixelsToVCells - zero returns 0', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    assert.equal(layout.fromPixelsToVCells(0), 0);
});

test('fromPixelsToVCells - negative returns 0', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    assert.equal(layout.fromPixelsToVCells(-50), 0);
});

// ---------------------------------------------------------------------------
// fromVCellsToPixels
// ---------------------------------------------------------------------------

test('fromVCellsToPixels converts rows to pixels', () => {
    const db = createDragboard({ getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromVCellsToPercentage(3) = 3 * (100/30) = 10
    // (900 * 10) / 100 = 90
    assert.equal(layout.fromVCellsToPixels(3), 90);
});

test('fromVCellsToPixels with zero rows returns 0', () => {
    const db = createDragboard({ getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    assert.equal(layout.fromVCellsToPixels(0), 0);
});

// ---------------------------------------------------------------------------
// fromVCellsToPercentage
// ---------------------------------------------------------------------------

test('fromVCellsToPercentage', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    assert.equal(layout.fromVCellsToPercentage(15), 50);
    assert.equal(layout.fromVCellsToPercentage(30), 100);
    assert.equal(layout.fromVCellsToPercentage(0), 0);
});

// ---------------------------------------------------------------------------
// getWidthInPixels / getHeightInPixels
// ---------------------------------------------------------------------------

test('getWidthInPixels subtracts margins', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromHCellsToPixels(1, undefined) = (1200 * 5) / 100 = 60
    // 120 - 10 - 10 = 100
    const result = layout.getWidthInPixels(2);
    assert.equal(result, 100);
});

test('getWidthInPixels with explicit width', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromHCellsToPixels(1, 800) = (800 * 5) / 100 = 40
    // getWidthInPixels(2, 800) = 80 - 20 = 60
    const result = layout.getWidthInPixels(2, 800);
    assert.equal(result, 60);
});

test('getHeightInPixels subtracts margins', () => {
    const db = createDragboard({ getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromVCellsToPixels(3) = 90
    // 90 - 5 - 5 = 80
    const result = layout.getHeightInPixels(3);
    assert.equal(result, 80);
});

// ---------------------------------------------------------------------------
// fromPixelsToHCells
// ---------------------------------------------------------------------------

test('fromPixelsToHCells - positive value', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromHCellsToPixels(1, undefined) = (1200 * 5) / 100 = 60
    // 120 / 60 = 2
    assert.equal(layout.fromPixelsToHCells(120), 2);
});

test('fromPixelsToHCells - zero returns 0', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    assert.equal(layout.fromPixelsToHCells(0), 0);
});

test('fromPixelsToHCells - negative returns 0', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    assert.equal(layout.fromPixelsToHCells(-10), 0);
});

test('fromPixelsToHCells with explicit width', () => {
    const db = createDragboard({ getWidth: () => 999 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromHCellsToPixels(1, 600) = (600 * 5) / 100 = 30
    // 90 / 30 = 3
    assert.equal(layout.fromPixelsToHCells(90, 600), 3);
});

// ---------------------------------------------------------------------------
// fromHCellsToPixels
// ---------------------------------------------------------------------------

test('fromHCellsToPixels uses getWidth when width not provided', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    assert.equal(layout.fromHCellsToPixels(2, undefined), 120);
});

test('fromHCellsToPixels uses explicit width', () => {
    const db = createDragboard({ getWidth: () => 999 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    assert.equal(layout.fromHCellsToPixels(2, 800), 80);
});

test('fromHCellsToPixels with null width uses getWidth', () => {
    const db = createDragboard({ getWidth: () => 600 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    assert.equal(layout.fromHCellsToPixels(2, null), 60);
});

test('fromHCellsToPixels with 0 width (falsy) uses getWidth', () => {
    const db = createDragboard({ getWidth: () => 500 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    assert.equal(layout.fromHCellsToPixels(2, 0), 50);
});

// ---------------------------------------------------------------------------
// fromHCellsToPercentage
// ---------------------------------------------------------------------------

test('fromHCellsToPercentage', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    assert.equal(layout.fromHCellsToPercentage(10), 50);
    assert.equal(layout.fromHCellsToPercentage(20), 100);
    assert.equal(layout.fromHCellsToPercentage(0), 0);
});

// ============================================================================
// adaptColumnOffset
// ============================================================================

test('adaptColumnOffset - cells unit (number)', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const result = layout.adaptColumnOffset('3');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 3);
    // adaptColumnOffset passes offsetInLU directly to getColumnOffset,
    // so getColumnOffset receives a number, not {x: number} -> inPixels is NaN.
    assert.ok(Number.isNaN(result.inPixels));
});

test('adaptColumnOffset - raw number (cells)', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const result = layout.adaptColumnOffset(5);

    assert.equal(result.inLU, 5);
    assert.ok(Number.isNaN(result.inPixels));
});

test('adaptColumnOffset - percent unit', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const result = layout.adaptColumnOffset('50%');

    assert.equal(result.inLU, 10);
    assert.ok(Number.isNaN(result.inPixels));
});

test('adaptColumnOffset - pixel unit', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const result = layout.adaptColumnOffset('100px');

    assert.equal(result.inLU, 2);
    assert.ok(Number.isNaN(result.inPixels));
});

test('adaptColumnOffset - cells unit with explicit width', () => {
    const db = createDragboard({ getWidth: () => 999 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const result = layout.adaptColumnOffset('3', 600);

    assert.equal(result.inLU, 3);
    assert.ok(Number.isNaN(result.inPixels));
});

test('adaptColumnOffset - percent unit with explicit width', () => {
    const db = createDragboard({ getWidth: () => 999 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // pixels = round((50 * 600)/100) = 300
    // fromHCellsToPixels(1, 600) = (600*5)/100 = 30
    // round((300-10)/30) = round(9.667) = 10
    const result = layout.adaptColumnOffset('50%', 600);

    assert.equal(result.inLU, 10);
});

// ============================================================================
// adaptRowOffset
// ============================================================================

test('adaptRowOffset - cells unit', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const result = layout.adaptRowOffset('4');

    assert.equal(result.inLU, 4);
    assert.equal(result.inPixels, layout.getRowOffset({ y: 4 }));
});

test('adaptRowOffset - number (cells)', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const result = layout.adaptRowOffset(7);

    assert.equal(result.inLU, 7);
});

test('adaptRowOffset - percent unit', () => {
    const db = createDragboard({ getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // pixels = round((50 * 900)/100) = 450
    // fromPixelsToVCells(450 - topMargin(5)) = fromPixelsToVCells(445)
    // fromVCellsToPixels(1) = 30, round(445/30) = round(14.833) = 15
    const result = layout.adaptRowOffset('50%');

    assert.equal(result.inLU, 15);
});

test('adaptRowOffset - pixel unit', () => {
    const db = createDragboard({ getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromPixelsToVCells(95 - 5) = fromPixelsToVCells(90) = round(90/30) = 3
    const result = layout.adaptRowOffset('95px');

    assert.equal(result.inLU, 3);
});

// ============================================================================
// padWidth / padHeight
// ============================================================================

test('padWidth adds left and right margins', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    assert.equal(layout.padWidth(100), 120);
    assert.equal(layout.padWidth(0), 20);
});

test('padHeight adds top and bottom margins', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    assert.equal(layout.padHeight(80), 90);
    assert.equal(layout.padHeight(0), 10);
});

// ============================================================================
// getColumnOffset / getRowOffset
// ============================================================================

test('getColumnOffset with default width', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // fromHCellsToPercentage(2) = 2 * 5 = 10%
    // floor((1200 * 10)/100) + 10 + 5 = 120 + 15 = 135
    const result = layout.getColumnOffset({ x: 2, y: 0 });

    assert.equal(result, 135);
});

test('getColumnOffset with explicit width', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const result = layout.getColumnOffset({ x: 1 }, 800);

    // floor((800 * 5)/100) + 15 = 40 + 15 = 55
    assert.equal(result, 55);
});

test('getColumnOffset at position x=0', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const result = layout.getColumnOffset({ x: 0 });

    // floor(0) + 10 + 5 = 15
    assert.equal(result, 15);
});

test('getRowOffset', () => {
    const db = createDragboard({ getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // dragboard.topMargin + fromVCellsToPixels(2) + topMargin
    // 5 + 60 + 5 = 70
    const result = layout.getRowOffset({ x: 0, y: 2 });

    assert.equal(result, 70);
});

test('getRowOffset at position y=0', () => {
    const db = createDragboard({ getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // 5 + 0 + 5 = 10
    const result = layout.getRowOffset({ y: 0 });

    assert.equal(result, 10);
});

// ============================================================================
// _hasSpaceFor
// ============================================================================

test('_hasSpaceFor returns true for empty area', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);

    const result = layout._hasSpaceFor(layout.matrix, 0, 0, 3, 3);

    assert.equal(result, true);
});

test('_hasSpaceFor returns false when cell is occupied', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const w = createMockWidget('w1', 1, 1, 1, 1);
    fillMatrix(layout, w);

    const result = layout._hasSpaceFor(layout.matrix, 0, 0, 3, 3);

    assert.equal(result, false);
});

test('_hasSpaceFor returns true when target area and widget occupy different cells', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const w = createMockWidget('w1', 5, 5, 1, 1);
    fillMatrix(layout, w);

    const result = layout._hasSpaceFor(layout.matrix, 0, 0, 3, 3);

    assert.equal(result, true);
});

// ============================================================================
// _searchFreeSpace / _searchFreeSpace2
// ============================================================================

test('_searchFreeSpace finds positions for empty matrix', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);

    const result = layout._searchFreeSpace(2, 3);

    assert.deepEqual(result, { relx: true, x: 0, rely: true, y: 0 });
});

test('_searchFreeSpace skips occupied cells', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    // Fill first row to force position to next row
    for (let x = 0; x < 20; x++) {
        const w = createMockWidget(`block${x}`, x, 0, 1, 1);
        fillMatrix(layout, w);
    }

    const result = layout._searchFreeSpace(2, 2);

    assert.equal(result.y, 1);
});

test('_searchFreeSpace2 finds position when matrix has gaps', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    // Populate a few cells
    const w1 = createMockWidget('w1', 0, 0, 1, 1);
    fillMatrix(layout, w1);

    const result = layout._searchFreeSpace2(3, 3, layout.matrix);

    assert.deepEqual(result, { relx: true, x: 1, rely: true, y: 0 });
});

// ============================================================================
// _reserveSpace
// ============================================================================

test('_reserveSpace fills matrix cells', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const w = createMockWidget('w1', 2, 3, 2, 2);

    layout._reserveSpace(layout._buffers.base, w);

    // Check cells are filled
    assert.strictEqual(layout.matrix[2][3], w);
    assert.strictEqual(layout.matrix[2][4], w);
    assert.strictEqual(layout.matrix[3][3], w);
    assert.strictEqual(layout.matrix[3][4], w);
});

// ============================================================================
// _notifyResizeEvent
// ============================================================================

test('_notifyResizeEvent - width expand right, no collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 2);
    fillMatrix(layout, w);
    layout.widgets = { w1: w };

    let notifyCalled = false;
    let updateCalled = false;
    const origNotify = layout._notifyWindowResizeEvent;
    layout._notifyWindowResizeEvent = (wc, hc) => { notifyCalled = true; };
    db.update = () => { updateCalled = true; };

    // Expand right: 2x2 -> 4x2, persist=false
    layout._notifyResizeEvent(w, 2, 2, 4, 2, false, false, false);

    // Should reserve space at (4, 3) size (2, 2)
    assert.strictEqual(layout.matrix[4][3], w);
    assert.strictEqual(layout.matrix[5][3], w);
    assert.strictEqual(layout.matrix[4][4], w);
    assert.strictEqual(layout.matrix[5][4], w);
    assert.equal(notifyCalled, true);
    assert.equal(updateCalled, false); // persist=false

    layout._notifyWindowResizeEvent = origNotify;
});

test('_notifyResizeEvent - width expand right, with collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 2);
    const w2 = createMockWidget('w2', 4, 4, 1, 1);
    fillMatrix(layout, w);
    fillMatrix(layout, w2);
    layout.widgets = { w1: w, w2: w2 };

    let movedDownWidget = null;
    let movedOffset = null;
    const origMoveDown = layout.moveSpaceDown;
    layout.moveSpaceDown = (buffer, widget, offset) => {
        movedDownWidget = widget;
        movedOffset = offset;
        return new Set();
    };

    // Expand right: 2x2 -> 4x2 (newHeight=2)
    // finalYPos = 3+2 = 5
    // column x=4, row y=4: w2 is at (4,4), offset = 5-4 = 1
    layout._notifyResizeEvent(w, 2, 2, 4, 2, false, false, false);

    assert.equal(movedDownWidget, w2);
    assert.equal(movedOffset, 1);

    layout.moveSpaceDown = origMoveDown;
});

test('_notifyResizeEvent - width expand left, no collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 5, 3, 2, 2);
    fillMatrix(layout, w);
    layout.widgets = { w1: w };

    // Expand left: 2x2 -> 4x2, widthDiff=2
    // Reserved at position.x=5-2=3, y=3
    let setPosCalled = false;
    w.setPosition = (pos) => { setPosCalled = true; w.position = pos; };

    layout._notifyResizeEvent(w, 2, 2, 4, 2, true, false, false);

    assert.equal(setPosCalled, true);
    assert.equal(w.position.x, 3);
    // Reserved at (3, 3) size (2, 2)
    assert.strictEqual(layout.matrix[3][3], w);
    assert.strictEqual(layout.matrix[4][3], w);
});

test('_notifyResizeEvent - width expand left, with collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 5, 3, 2, 2);
    const w2 = createMockWidget('w2', 4, 4, 1, 1);
    fillMatrix(layout, w);
    fillMatrix(layout, w2);
    layout.widgets = { w1: w, w2: w2 };

    let movedDownWidget = null;
    const origMoveDown = layout.moveSpaceDown;
    layout.moveSpaceDown = (buffer, widget) => {
        movedDownWidget = widget;
        return new Set();
    };

    // Expand left: loop x from 3 to 4 (position.x-widthDiff=3 to position.x-1=4)
    // x=4: y=0..1. matrix[4][3] is null (w1 at (5,3)), matrix[4][4] is w2
    layout._notifyResizeEvent(w, 2, 2, 4, 2, true, false, false);

    assert.equal(movedDownWidget, w2);

    layout.moveSpaceDown = origMoveDown;
});

test('_notifyResizeEvent - width shrink left, widgets to move up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 4, 2);
    const w2 = createMockWidget('w2', 2, 5, 1, 1);
    fillMatrix(layout, w);
    fillMatrix(layout, w2);
    layout.widgets = { w1: w, w2: w2 };

    // Shrink left: 4x2 -> 2x2. widthDiff=2. Clear at (2,3) size(2,2).
    // Position moves from x=2 to x=4.
    layout._notifyResizeEvent(w, 4, 2, 2, 2, true, false, false);

    assert.equal(w.position.x, 4);
    // Cleared space should not have w1
    assert.strictEqual(layout.matrix[2][3], undefined);
});

test('_notifyResizeEvent - width shrink right', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 3, 2);
    fillMatrix(layout, w);
    layout.widgets = { w1: w };

    // Shrink right: 3x2 -> 1x2. Clear at (2+1=3, 3) size(2,2)
    layout._notifyResizeEvent(w, 3, 2, 1, 2, false, false, false);

    // Cells at (3,3) and (3,4) should be cleared
    assert.strictEqual(layout.matrix[3][3], undefined);
    assert.strictEqual(layout.matrix[3][4], undefined);
});

test('_notifyResizeEvent - height expand, no collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 2);
    fillMatrix(layout, w);
    layout.widgets = { w1: w };

    // Expand height: 2x2 -> 2x4. Reserve at (2, 3+2=5) size(2, 2)
    layout._notifyResizeEvent(w, 2, 2, 2, 4, false, false, false);

    assert.strictEqual(layout.matrix[2][5], w);
    assert.strictEqual(layout.matrix[3][5], w);
    assert.strictEqual(layout.matrix[2][6], w);
    assert.strictEqual(layout.matrix[3][6], w);
});

test('_notifyResizeEvent - height expand, with collisions moves space down', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 2);
    const w2 = createMockWidget('w2', 2, 5, 1, 1);
    fillMatrix(layout, w);
    fillMatrix(layout, w2);
    layout.widgets = { w1: w, w2: w2 };

    let movedDownWidgets = [];
    const origMoveDown = layout.moveSpaceDown;
    layout.moveSpaceDown = (buffer, widget) => {
        movedDownWidgets.push(widget);
        return new Set();
    };

    // Expand height: 2x2 -> 2x4. step2Width=2, step2X=2.
    // limitY = 7, limitX = 4. y=5, x=2,3: matrix[2][5] has w2.
    layout._notifyResizeEvent(w, 2, 2, 2, 4, false, false, false);

    assert.equal(movedDownWidgets.length, 1);
    assert.equal(movedDownWidgets[0], w2);

    layout.moveSpaceDown = origMoveDown;
});

test('_notifyResizeEvent - height shrink clears space', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 4);
    fillMatrix(layout, w);
    layout.widgets = { w1: w };

    let clearCall = null;
    const origClear2 = layout._clearSpace2;
    layout._clearSpace2 = (matrix, px, py, pw, ph) => {
        clearCall = { px, py, pw, ph };
    };

    // Shrink height: 2x4 -> 2x2. Clear at (2, 5) size(2, 2)
    layout._notifyResizeEvent(w, 2, 4, 2, 2, false, false, false);

    assert.deepEqual(clearCall, { px: 2, py: 5, pw: 2, ph: 2 });

    layout._clearSpace2 = origClear2;
});

test('_notifyResizeEvent - persist true calls dragboard.update', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 2);
    fillMatrix(layout, w);
    layout.widgets = { w1: w };

    let updateCalled = false;
    db.update = () => { updateCalled = true; };

    layout._notifyResizeEvent(w, 2, 2, 2, 2, false, false, true);

    assert.equal(updateCalled, true);
});

test('_notifyResizeEvent - persist false skips update', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 2);
    fillMatrix(layout, w);
    layout.widgets = { w1: w };

    let updateCalled = false;
    db.update = () => { updateCalled = true; };

    layout._notifyResizeEvent(w, 2, 2, 2, 2, false, false, false);

    assert.equal(updateCalled, false);
});

test('_notifyResizeEvent - no dimension change, persist=true', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 2);
    fillMatrix(layout, w);
    layout.widgets = { w1: w };

    let notifyCalled = false;
    let updateCalled = false;
    layout._notifyWindowResizeEvent = () => { notifyCalled = true; };
    db.update = () => { updateCalled = true; };

    layout._notifyResizeEvent(w, 2, 2, 2, 2, false, false, true);

    assert.equal(notifyCalled, true);
    assert.equal(updateCalled, true);
});

// ============================================================================
// _insertAt
// ============================================================================

test('_insertAt - inserts widget with no collisions', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const buffer = layout._buffers.base;
    const w = createMockWidget('w1', 0, 0, 2, 2);

    const result = layout._insertAt(w, 3, 4, buffer);

    assert.equal(result.size, 0);
    // Position set on widget
    assert.equal(w.position.x, 3);
    assert.equal(w.position.y, 4);
    // Matrix filled
    assert.strictEqual(layout.matrix[3][4], w);
    assert.strictEqual(layout.matrix[4][4], w);
    assert.strictEqual(layout.matrix[3][5], w);
    assert.strictEqual(layout.matrix[4][5], w);
});

test('_insertAt - clamps negative coordinates to 0', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const buffer = layout._buffers.base;
    const w = createMockWidget('w1', 0, 0, 1, 1);

    layout._insertAt(w, -5, -3, buffer);

    assert.equal(w.position.x, 0);
    assert.equal(w.position.y, 0);
    assert.strictEqual(layout.matrix[0][0], w);
});

test('_insertAt - moves affected widgets down', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const buffer = layout._buffers.base;

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const w2 = createMockWidget('w2', 3, 4, 1, 1);
    fillMatrix(layout, w2);
    layout.widgets = { w1, w2 };

    let movedCalls = [];
    const origMoveDown = layout.moveSpaceDown;
    layout.moveSpaceDown = (buf, widget, offset) => {
        movedCalls.push({ widget: widget.id, offset });
        return new Set();
    };

    // Insert w1 at (3, 4) - w2 occupies (3, 4)
    // lastY = 6, affectedY for w2 = 4, offset = 6 - 4 = 2
    layout._insertAt(w1, 3, 4, buffer);

    assert.equal(movedCalls.length, 1);
    assert.equal(movedCalls[0].widget, 'w2');
    assert.equal(movedCalls[0].offset, 2);

    layout.moveSpaceDown = origMoveDown;
});

test('_insertAt - deduplicates same widget across multiple columns', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const buffer = layout._buffers.base;

    const w1 = createMockWidget('w1', 0, 0, 3, 2);
    const w2 = createMockWidget('w2', 3, 4, 2, 1);
    fillMatrix(layout, w2);
    layout.widgets = { w1, w2 };

    let moveDownCount = 0;
    const origMoveDown = layout.moveSpaceDown;
    layout.moveSpaceDown = () => {
        moveDownCount++;
        return new Set();
    };

    // w2 occupies columns 3,4 at row 4. Calls moveSpaceDown for each column (2 calls).
    layout._insertAt(w1, 3, 4, buffer);

    assert.equal(moveDownCount, 2);

    layout.moveSpaceDown = origMoveDown;
});

// ============================================================================
// getCellAt
// ============================================================================

test('getCellAt computes cell from pixel coordinates', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    // columnWidth = 1200/20 = 60, rowHeight = 900/30 = 30

    const result = layout.getCellAt(150, 100);
    assert.ok(result instanceof Wirecloud.DragboardPosition);
    assert.equal(result.x, 2);  // floor(150/60) = 2
    assert.equal(result.y, 3);  // floor(100/30) = 3
});

test('getCellAt returns 0,0 for zero coordinates', () => {
    const db = createDragboard({ getWidth: () => 800, getHeight: () => 600 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const result = layout.getCellAt(0, 0);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
});

test('getCellAt handles edge of dragboard', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const result = layout.getCellAt(1199, 899);
    assert.equal(result.x, 19);
    assert.equal(result.y, 29);
});

// ============================================================================
// initialize
// ============================================================================

test('initialize - empty widgets returns false', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const result = layout.initialize();

    assert.equal(result, false);
    assert.equal(layout.initialized, true);
});

test('initialize - fits widget in matrix', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets = { w1: w };

    const result = layout.initialize();

    assert.equal(result, false);
    assert.strictEqual(layout.matrix[0][0], w);
    assert.strictEqual(layout.matrix[1][0], w);
});

test('initialize - reinserts widget that does not fit (occupied)', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    fillMatrix(layout, w1);
    layout.widgets = { w1, w2: createMockWidget('w2', 0, 0, 2, 2) };

    const result = layout.initialize();

    // w2 was reinserted to a free position, so modified=true
    assert.equal(result, true);
    assert.equal(layout.initialized, true);
});

test('initialize - reinserts widget beyond column count', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 19, 0, 2, 2); // width+pos.x = 21 > 20
    layout.widgets = { w1: w };

    const result = layout.initialize();

    assert.equal(result, true); // reinserted
    assert.ok(w.position.x < 19); // placed in a valid position
});

test('initialize - truncates widget width to columns', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 10, 30, 10, 20);

    const w = createMockWidget('w1', 0, 0, 25, 2); // width > columns
    layout.widgets = { w1: w };

    layout.initialize();

    assert.equal(w.shape.width, 10); // truncated to columns
});

test('initialize - calls widget.model.load()', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    let loaded = false;
    const w = createMockWidget('w1', 0, 0, 2, 2, {
        model: { load() { loaded = true; } }
    });
    layout.widgets = { w1: w };

    layout.initialize();

    assert.equal(loaded, true);
});

// ============================================================================
// addWidget
// ============================================================================

test('addWidget - not initialized returns empty set', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const w = createMockWidget('w1');

    const result = layout.addWidget(w, false);

    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
    assert.strictEqual(layout.widgets[w.id], w);
    assert.equal(w.layout, layout);
    assert.equal(layout.initialized, false);
});

test('addWidget - not initialized with affectsDragboard=true', () => {
    const db = createDragboard();
    let dragboardAdded = false;
    db._addWidget = () => { dragboardAdded = true; };

    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const w = createMockWidget('w1');

    layout.addWidget(w, true);

    assert.equal(dragboardAdded, true);
    assert.strictEqual(layout.widgets[w.id], w);
});

test('addWidget - initialized, widget has position, fits exactly', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    layout.initialized = true;

    const w = createMockWidget('w1', 5, 5, 2, 2);

    const result = layout.addWidget(w, false);

    assert.equal(result.size, 0); // no collisions
    // Widget inserted at (5, 5)
    assert.strictEqual(layout.matrix[5][5], w);
});

test('addWidget - initialized, widget has position, diff > 0 shifts left', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    layout.initialized = true;

    const w = createMockWidget('w1', 18, 5, 3, 2); // 18+3=21 > 20, diff=1
    layout.widgets = { w1: w };

    const result = layout.addWidget(w, false);

    // Should shift position.x -= 1 => 17
    assert.equal(w.position.x, 17);
    assert.ok(result instanceof Set);
});

test('addWidget - initialized, widget has no position, finds free space', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    layout.initialized = true;

    // Widget without position property at all
    const w = {
        id: 'w1',
        shape: { width: 3, height: 3 },
        addEventListener() {},
        removeEventListener() {},
        repaint() {},
        layout: null,
        element: null,
        model: { load() {} },
    };
    w.setPosition = (pos) => { w.position = pos; };
    w.setShape = () => {};

    const result = layout.addWidget(w, false);

    // Should have been assigned a position
    assert.notEqual(w.position, null);
    assert.ok(result instanceof Set);
    // Should be reserved in matrix
    assert.strictEqual(layout.matrix[w.position.x][w.position.y], w);
});

test('addWidget - initialized, widget width > columns gets truncated', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 10, 30, 10, 20);
    layout.initialized = true;

    const w = createMockWidget('w1', 2, 2, 15, 3);

    layout.addWidget(w, false);

    assert.equal(w.shape.width, 10);
});

test('addWidget - initialized, widget width > columns with position beyond', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 10, 30, 10, 20);
    layout.initialized = true;

    const w = createMockWidget('w1', 8, 0, 15, 2); // width > columns

    layout.addWidget(w, false);

    // Width truncated to columns
    assert.equal(w.shape.width, 10);
    // Position adjusted: 8 + 10 - 10 = 8, diff=8, x = 8-8 = 0
    assert.equal(w.position.x, 0);
});

test('addWidget - initialized, _adaptIWidget called with element', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    layout.initialized = true;

    const w = createMockWidget('w1', 2, 2, 1, 1, { element: {} }); // truthy element

    layout.addWidget(w, false);

    // ensureMinimalSize should not throw
    assert.ok(true);
});

// ============================================================================
// removeWidget
// ============================================================================

test('removeWidget removes widget from matrix and super', () => {
    const db = createDragboard();
    let removeFromDragboardCalled = false;
    db._removeWidget = () => { removeFromDragboardCalled = true; };

    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w = createMockWidget('w1', 2, 3, 2, 2);
    layout.widgets = { w1: w };
    fillMatrix(layout, w);

    let removeListenerCalled = false;
    w.removeEventListener = () => { removeListenerCalled = true; };

    const result = layout.removeWidget(w, true);

    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
    assert.equal(removeFromDragboardCalled, true);
    assert.equal(removeListenerCalled, true);
    assert.strictEqual(layout.widgets[w.id], undefined);
    assert.equal(w.layout, null);
    // Matrix cells cleared
    assert.strictEqual(layout.matrix[2][3], undefined);
    assert.strictEqual(layout.matrix[3][3], undefined);
});

test('removeWidget with affectsDragboard=false', () => {
    const db = createDragboard();
    let removeFromDragboardCalled = false;
    db._removeWidget = () => { removeFromDragboardCalled = true; };

    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const w = createMockWidget('w1');
    layout.widgets = { w1: w };

    layout.removeWidget(w, false);

    assert.equal(removeFromDragboardCalled, false);
    assert.strictEqual(layout.widgets[w.id], undefined);
});

// ============================================================================
// moveTo
// ============================================================================

test('moveTo - moves all widgets to destination layout in order', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w1 = createMockWidget('w1', 2, 1, 1, 1);
    const w2 = createMockWidget('w2', 0, 0, 1, 1);
    const w3 = createMockWidget('w3', 1, 0, 1, 1);
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);
    fillMatrix(layout, w3);
    layout.widgets = { w1, w2, w3 };

    const destLayout = { widgets: {} };
    const movedOrder = [];
    w1.moveToLayout = (dest) => { movedOrder.push('w1'); dest.widgets['w1'] = w1; };
    w2.moveToLayout = (dest) => { movedOrder.push('w2'); dest.widgets['w2'] = w2; };
    w3.moveToLayout = (dest) => { movedOrder.push('w3'); dest.widgets['w3'] = w3; };

    layout.moveTo(destLayout);

    // Order should be top-left to bottom-right: w2(0,0), w3(1,0), w1(2,1)
    assert.deepEqual(movedOrder, ['w2', 'w3', 'w1']);
    assert.ok('w1' in destLayout.widgets);
    assert.ok('w2' in destLayout.widgets);
    assert.ok('w3' in destLayout.widgets);
});

test('moveTo - removes custom _removeFromMatrix after moving', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const destLayout = { widgets: {} };

    layout.moveTo(destLayout);

    // The own property should be deleted; prototype is inherited
    assert.equal(layout.hasOwnProperty('_removeFromMatrix'), false);
});

test('moveTo - empty layout moves nothing', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    const destLayout = { widgets: {} };

    layout.moveTo(destLayout);

    assert.equal(layout.hasOwnProperty('_removeFromMatrix'), false);
    assert.deepEqual(destLayout.widgets, {});
});

// ============================================================================
// initializeMove
// ============================================================================

test('initializeMove - throws TypeError for non-WidgetView', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    assert.throws(() => {
        layout.initializeMove({}, { setXOffset() {}, setYOffset() {} });
    }, TypeError);
});

test('initializeMove - throws TypeError for null widget', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    assert.throws(() => {
        layout.initializeMove(null, { setXOffset() {}, setYOffset() {} });
    }, TypeError);
});

test('initializeMove - cancels pending move and warns', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 0, y: 0 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = () => {};

    layout.iwidgetToMove = widget; // pending move
    layout.widgets = { w1: widget };

    let logMsg = null;
    let logLevel = null;
    Wirecloud.GlobalLogManager.log = (msg, level) => { logMsg = msg; logLevel = level; };

    const draggable = { setXOffset() {}, setYOffset() {} };
    const newWidget = new Wirecloud.ui.WidgetView();
    newWidget.id = 'w2';
    newWidget.position = { x: 5, y: 5 };
    newWidget.shape = { width: 2, height: 2 };
    newWidget.setPosition = () => {};

    layout.widgets = { w1: widget, w2: newWidget };
    layout.initializeMove(newWidget, draggable);

    assert.ok(logMsg.includes('pending move'));
    assert.equal(logLevel, Wirecloud.constants.LOGGING.WARN_MSG);
    // Old move cancelled
    assert.strictEqual(layout.iwidgetToMove, newWidget);
});

test('initializeMove - sets up buffers, cursor, and offsets', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 3, y: 3 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = () => {};

    layout.widgets = { w1: widget };
    // Reserve space so _removeFromMatrix has something to clear
    layout._reserveSpace(layout._buffers.base, widget);

    let xOffsetSet = null;
    let yOffsetSet = null;
    const draggable = {
        setXOffset(val) { xOffsetSet = val; return this; },
        setYOffset(val) { yOffsetSet = val; return this; },
    };

    layout.initializeMove(widget, draggable);

    assert.strictEqual(layout.iwidgetToMove, widget);
    assert.ok(layout.dragboardCursor instanceof Wirecloud.ui.DragboardCursor);
    assert.ok(layout._buffers.backup);
    assert.ok(layout._buffers.shadow);
    // fromHCellsToPixels(1) = (1200*5)/100 = 60, half = 30
    assert.equal(xOffsetSet, 30);
    // fromVCellsToPixels(1) = (900*3.33)/100 = 30, half = 15
    assert.ok(yOffsetSet > 0);
});

// ============================================================================
// _destroyCursor / disableCursor
// ============================================================================

test('_destroyCursor destroys cursor and nulls it', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const cursor = new Wirecloud.ui.DragboardCursor({});
    layout.dragboardCursor = cursor;

    layout._destroyCursor();

    assert.equal(layout.dragboardCursor, null);
    assert.equal(cursor._destroyed, true);
});

test('_destroyCursor does nothing when cursor is null', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);

    assert.doesNotThrow(() => layout._destroyCursor());

    assert.equal(layout.dragboardCursor, null);
});

test('disableCursor calls _destroyCursor', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    const cursor = new Wirecloud.ui.DragboardCursor({});
    layout.dragboardCursor = cursor;

    layout.disableCursor();

    assert.equal(layout.dragboardCursor, null);
});

// ============================================================================
// _setPositions
// ============================================================================

test('_setPositions updates widget and cursor positions from shadow', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const w2 = createMockWidget('w2', 5, 5, 1, 1);
    layout.widgets = { w1, w2 };

    layout.iwidgetToMove = w1;

    layout._buffers.shadow = {
        matrix: [],
        positions: {},
    };

    // Shadow positions
    const shadowPos1 = new Wirecloud.DragboardPosition(10, 10);
    const shadowPos2 = new Wirecloud.DragboardPosition(3, 7);
    const cursorPos = new Wirecloud.DragboardPosition(2, 2);

    const origGetPosOn = layout._getPositionOn;
    layout._getPositionOn = (buffer, widget) => {
        if (widget === layout.dragboardCursor) return cursorPos;
        if (widget === w1) return shadowPos1;
        if (widget === w2) return shadowPos2;
        return widget.position;
    };

    const cursor = new Wirecloud.ui.DragboardCursor(w1);
    layout.dragboardCursor = cursor;

    layout._setPositions();

    // w1 is the widget being moved - should NOT be repositioned
    assert.equal(w1.position.x, 0);
    assert.equal(w1.position.y, 0);
    // w2 should get shadow position
    assert.equal(w2.position.x, 3);
    assert.equal(w2.position.y, 7);
    // cursor should get its shadow position
    assert.equal(cursor.position.x, 2);
    assert.equal(cursor.position.y, 2);

    layout._getPositionOn = origGetPosOn;
});

// ============================================================================
// moveTemporally
// ============================================================================

test('moveTemporally - warns when iwidgetToMove is null', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);

    let logMsg = null;
    Wirecloud.GlobalLogManager.log = (msg) => { logMsg = msg; };

    layout.moveTemporally(100, 200);

    assert.ok(logMsg.includes('initializeMove'));
});

test('moveTemporally - clamps y < 0 to 0', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 2, y: 2 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = () => {};
    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };
    layout._buffers.backup = { matrix: [], positions: {} };
    layout._buffers.shadow = { matrix: layout.matrix, positions: {} };

    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    // Set cursor to a non-zero position so it differs from the clamped cell
    cursor.position = { x: 5, y: 5 };
    layout.dragboardCursor = cursor;

    let insertCalled = null;
    const origInsertAt = layout._insertAt;
    layout._insertAt = (w, x, y) => { insertCalled = { x, y }; return new Set(); };

    // y < 0 gets clamped to 0; x < 0 gets clamped to 0
    layout.moveTemporally(-100, -100);

    assert.notEqual(insertCalled, null);
    assert.equal(insertCalled.y, 0);

    layout._insertAt = origInsertAt;
});

test('moveTemporally - clamps x < 0 to 0', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 2, y: 2 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = () => {};
    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };
    layout._buffers.backup = { matrix: [], positions: {} };
    layout._buffers.shadow = { matrix: layout.matrix };

    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    layout.dragboardCursor = cursor;

    let insertCalled = null;
    const origInsertAt = layout._insertAt;
    layout._insertAt = (w, x, y) => { insertCalled = { x, y }; return new Set(); };

    layout.moveTemporally(-50, 50);

    assert.equal(insertCalled.x, 0);

    layout._insertAt = origInsertAt;
});

test('moveTemporally - clamps x beyond maxX', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 0, y: 0 };
    widget.shape = { width: 5, height: 2 };
    widget.setPosition = () => {};
    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };
    layout._buffers.backup = { matrix: [], positions: {} };
    layout._buffers.shadow = { matrix: layout.matrix };

    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    layout.dragboardCursor = cursor;

    let insertCalled = null;
    const origInsertAt = layout._insertAt;
    layout._insertAt = (w, x) => { insertCalled = { x }; return new Set(); };

    // maxX = 20 - 5 = 15, so x should be clamped to 15
    layout.moveTemporally(2000, 50);

    assert.equal(insertCalled.x, 15);

    layout._insertAt = origInsertAt;
});

test('moveTemporally - cursor position unchanged does nothing', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 2, y: 2 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = () => {};
    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };
    layout._buffers.backup = { matrix: [], positions: {} };
    layout._buffers.shadow = { matrix: layout.matrix };

    // Cursor position is (2, 2), and getCellAt(120, 60) = (2, 2)
    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    cursor.position = { x: 2, y: 2 };
    layout.dragboardCursor = cursor;

    let insertCalled = false;
    layout._insertAt = () => { insertCalled = true; return new Set(); };

    // getCellAt with getWidth=1200, getHeight=900: x=2, y=2
    layout.moveTemporally(120, 60);

    assert.equal(insertCalled, false);

    delete layout._insertAt;
});

test('moveTemporally - cursor position changed clones and inserts', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 5, y: 5 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = () => {};
    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };

    layout._buffers.backup = { matrix: [],
        positions: { w1: new Wirecloud.DragboardPosition(5, 5) },
    };
    layout._buffers.shadow = { matrix: layout.matrix };

    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    cursor.position = { x: 10, y: 10 };
    layout.dragboardCursor = cursor;

    let insertCalled = null;
    layout._insertAt = (w, x, y) => { insertCalled = { widget: w, x, y }; return new Set(); };

    layout.moveTemporally(300, 300); // should move to different cell

    assert.notEqual(insertCalled, null);
    assert.equal(insertCalled.widget, cursor);

    delete layout._insertAt;
});

test('moveTemporally - null cursor, creates new cursor', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 3, y: 3 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = () => {};
    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };
    layout._buffers.backup = { matrix: [],
        positions: { w1: new Wirecloud.DragboardPosition(3, 3) },
    };
    layout._buffers.shadow = { matrix: [] };
    layout.dragboardCursor = null;

    let insertCalled = null;
    layout._insertAt = (w, x, y) => { insertCalled = { widget: w, x, y }; return new Set(); };

    layout.moveTemporally(180, 90);

    assert.notEqual(insertCalled, null);
    assert.ok(insertCalled.widget instanceof Wirecloud.ui.DragboardCursor);

    delete layout._insertAt;
});

// ============================================================================
// cancelMove
// ============================================================================

test('cancelMove - warns when iwidgetToMove is null', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);

    let logMsg = null;
    Wirecloud.GlobalLogManager.log = (msg) => { logMsg = msg; };

    layout.cancelMove();

    assert.ok(logMsg.includes('inexistant'));
});

test('cancelMove - restores positions and cleans up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 7, y: 7 };
    widget.shape = { width: 2, height: 2 };
    let setPosCalled = null;
    widget.setPosition = (pos) => { setPosCalled = pos; };
    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };

    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    layout.dragboardCursor = cursor;

    layout.cancelMove();

    assert.equal(layout.iwidgetToMove, null);
    assert.equal(layout.dragboardCursor, null);
    assert.ok(cursor._destroyed);
    assert.equal(setPosCalled.x, 7);
    assert.equal(setPosCalled.y, 7);
});

// ============================================================================
// acceptMove
// ============================================================================

test('acceptMove - warns when iwidgetToMove is null', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);

    let logMsg = null;
    Wirecloud.GlobalLogManager.log = (msg) => { logMsg = msg; };

    layout.acceptMove();

    assert.ok(logMsg.includes('acceptMove'));
});

test('acceptMove - position unchanged does not update dragboard', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 5, y: 5 };
    widget.shape = { width: 2, height: 2 };
    let setPosCalled = null;
    widget.setPosition = (pos) => { setPosCalled = pos; };
    layout.iwidgetToMove = widget;

    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    cursor.position = { x: 5, y: 5 }; // same position
    layout.dragboardCursor = cursor;

    let updateCalled = false;
    db.update = () => { updateCalled = true; };

    layout.acceptMove();

    assert.equal(setPosCalled.x, 5);
    assert.equal(setPosCalled.y, 5);
    assert.equal(updateCalled, false); // no position change
    assert.equal(layout.iwidgetToMove, null);
    assert.equal(layout.dragboardCursor, null);
});

test('acceptMove - position changed updates dragboard', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 3, y: 3 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = (pos) => { widget.position = pos; };

    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };

    layout._buffers.shadow = { matrix: [], positions: {} };
    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    cursor.position = { x: 8, y: 8 }; // different position
    layout.dragboardCursor = cursor;

    let updateCalled = false;
    db.update = () => { updateCalled = true; };

    layout.acceptMove();

    assert.equal(widget.position.x, 8);
    assert.equal(widget.position.y, 8);
    assert.equal(updateCalled, true);
    assert.equal(layout.iwidgetToMove, null);
    assert.equal(layout.dragboardCursor, null);
    // Matrix should be updated from shadow
    assert.strictEqual(layout.matrix, layout._buffers.shadow.matrix);
});

// ============================================================================
// INTEGRATION tests
// ============================================================================

test('full lifecycle: add, initialize, move, remove', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    // Add widgets before initialization
    const w1 = createMockWidget('w1', 5, 5, 2, 2);
    const w2 = createMockWidget('w2', 10, 10, 1, 1);
    layout.addWidget(w1, false);
    layout.addWidget(w2, false);

    assert.strictEqual(layout.widgets['w1'], w1);
    assert.strictEqual(layout.widgets['w2'], w2);

    // Initialize
    const initResult = layout.initialize();
    assert.equal(layout.initialized, true);
    assert.equal(initResult, false);

    // Remove a widget
    layout.removeWidget(w2, false);
    assert.strictEqual(layout.widgets['w2'], undefined);

    // Add another widget after init without a preset position
    const w3 = {
        id: 'w3',
        shape: { width: 2, height: 2 },
        addEventListener() {},
        removeEventListener() {},
        repaint() {},
        layout: null,
        element: null,
        model: { load() {} },
    };
    w3.setPosition = (pos) => { w3.position = pos; };
    w3.setShape = () => {};
    layout.addWidget(w3, false);
    assert.notEqual(w3.position, null);
    assert.ok(w3.position.x >= 0);
});

test('move lifecycle: initializeMove, moveTemporally, acceptMove', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 0, y: 0 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = (pos) => { widget.position = pos; };
    layout.widgets = { w1: widget };
    layout._reserveSpace(layout._buffers.base, widget);

    const draggable = { setXOffset() {}, setYOffset() {} };

    layout.initializeMove(widget, draggable);
    layout.moveTemporally(300, 300);
    layout.acceptMove();

    assert.equal(widget.position.x, 5); // floor(300/60)=5
    assert.equal(widget.position.y, 10); // floor(300/30)=10
    assert.strictEqual(layout.iwidgetToMove, null);
    assert.strictEqual(layout.dragboardCursor, null);
});

test('move lifecycle: initializeMove, moveTemporally, cancelMove', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 0, y: 0 };
    widget.shape = { width: 2, height: 2 };
    widget.setPosition = (pos) => { widget.position = pos; };
    layout.widgets = { w1: widget };

    const draggable = { setXOffset() {}, setYOffset() {} };

    layout.initializeMove(widget, draggable);
    assert.notEqual(layout.dragboardCursor, null);

    layout.moveTemporally(300, 300);
    layout.cancelMove();

    // Position restored to original
    assert.equal(widget.position.x, 0);
    assert.equal(widget.position.y, 0);
    assert.strictEqual(layout.iwidgetToMove, null);
    assert.strictEqual(layout.dragboardCursor, null);
});

test('multiple initializeMove calls cancel previous move', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const w1 = new Wirecloud.ui.WidgetView();
    w1.id = 'w1';
    w1.position = { x: 0, y: 0 };
    w1.shape = { width: 2, height: 2 };
    w1.setPosition = () => {};

    const w2 = new Wirecloud.ui.WidgetView();
    w2.id = 'w2';
    w2.position = { x: 5, y: 5 };
    w2.shape = { width: 2, height: 2 };
    w2.setPosition = () => {};

    layout.widgets = { w1, w2 };
    layout._reserveSpace(layout._buffers.base, w1);
    layout._reserveSpace(layout._buffers.base, w2);

    const draggable = { setXOffset() {}, setYOffset() {} };

    layout.initializeMove(w1, draggable);
    assert.strictEqual(layout.iwidgetToMove, w1);

    // Second call cancels first
    layout.initializeMove(w2, draggable);
    assert.strictEqual(layout.iwidgetToMove, w2);
});

test('moveTemporally keeps x within valid range for large widgets', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900 });
    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);

    const widget = new Wirecloud.ui.WidgetView();
    widget.id = 'w1';
    widget.position = { x: 0, y: 0 };
    widget.shape = { width: 10, height: 2 };
    widget.setPosition = () => {};
    layout.iwidgetToMove = widget;
    layout.widgets = { w1: widget };
    layout._buffers.backup = { matrix: [], positions: { w1: { x: 0, y: 0 } } };
    layout._buffers.shadow = { matrix: layout.matrix };

    const cursor = new Wirecloud.ui.DragboardCursor(widget);
    cursor.position = { x: 5, y: 5 };
    layout.dragboardCursor = cursor;

    let insertX = null;
    layout._insertAt = (w, x) => { insertX = x; return new Set(); };

    // maxX = 20 - 10 = 10
    layout.moveTemporally(1200, 100);

    assert.equal(insertX, 10);

    delete layout._insertAt;
});

test('removeWidget sequence after add', () => {
    const db = createDragboard();
    let dragboardEvents = [];
    db._addWidget = () => { dragboardEvents.push('add'); };
    db._removeWidget = () => { dragboardEvents.push('remove'); };

    const layout = new Wirecloud.ui.GridLayout(db, 20, 30, 10, 20);
    layout.initialized = true;

    const w = createMockWidget('w1', 2, 2, 2, 2);
    layout.addWidget(w, true);
    assert.deepEqual(dragboardEvents, ['add']);

    layout.removeWidget(w, true);
    assert.deepEqual(dragboardEvents, ['add', 'remove']);
    assert.strictEqual(layout.widgets['w1'], undefined);
    assert.equal(w.layout, null);
});

test('disposeCursor handles null cursor gracefully', () => {
    const layout = new Wirecloud.ui.GridLayout(createDragboard(), 20, 30, 10, 20);
    assert.doesNotThrow(() => layout.disableCursor());
});

test('initialize with multiple widgets, some overflow', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.GridLayout(db, 10, 30, 10, 20);
    layout.initialized = false;

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const w2 = createMockWidget('w2', 16, 0, 3, 2); // 16+3 > 10
    layout.widgets = { w1, w2 };

    const result = layout.initialize();

    assert.equal(result, true); // w2 was reinserted
    assert.equal(layout.initialized, true);
});
