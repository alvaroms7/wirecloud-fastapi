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

const createDragboard = (overrides = {}) => Object.assign({
    getWidth: () => 1200,
    getHeight: () => 900,
    update: () => {},
    _addWidget: () => {},
    _removeWidget: () => {},
    _notifyWindowResizeEvent: () => {},
    leftMargin: 5,
    topMargin: 5,
}, overrides);

const createMockWidget = (id, x = 0, y = 0, width = 2, height = 2, overrides = {}) => {
    const pos = { x, y };
    const shape = { width, height };
    const mock = {
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
        minimized: false,
        model: { load() {} },
        moveToLayout() {},
    };
    return Object.assign(mock, overrides);
};

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

const createLayout = (db, columns, cellHeight, verticalMargin, horizontalMargin, scrollbarSpace) => {
    return new Wirecloud.ui.ColumnLayout(db, columns, cellHeight, verticalMargin, horizontalMargin, scrollbarSpace);
};

// ============================================================================
// Setup
// ============================================================================

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
            this.id = 'cursor';
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
    ]);
});

// ============================================================================
// CONSTRUCTOR
// ============================================================================

test('constructor with even margins splits equally', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.ok(layout instanceof Wirecloud.ui.DragboardLayout);
    assert.ok(layout instanceof Wirecloud.ui.ColumnLayout);
    assert.equal(layout.dragboard, db);
    assert.equal(layout.initialized, false);
    assert.equal(layout.columns, 20);
    assert.equal(layout.cellHeight, 30);
    assert.equal(layout.topMargin, 5);
    assert.equal(layout.bottomMargin, 5);
    assert.equal(layout.leftMargin, 10);
    assert.equal(layout.rightMargin, 10);
    assert.equal(layout.dragboardCursor, null);
    assert.equal(layout.iwidgetToMove, null);
    assert.deepEqual(layout.widgets, {});
});

test('constructor with odd vertical margin splits correctly', () => {
    const db = createDragboard();
    const layout = createLayout(db, 10, 20, 11, 20, 10);

    assert.equal(layout.topMargin, 5);
    assert.equal(layout.bottomMargin, 6);
});

test('constructor with odd horizontal margin splits correctly', () => {
    const db = createDragboard();
    const layout = createLayout(db, 10, 20, 10, 21, 10);

    assert.equal(layout.leftMargin, 10);
    assert.equal(layout.rightMargin, 11);
});

test('constructor with zero margins', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 20, 0, 0, 0);

    assert.equal(layout.topMargin, 0);
    assert.equal(layout.bottomMargin, 0);
    assert.equal(layout.leftMargin, 0);
    assert.equal(layout.rightMargin, 0);
});

test('constructor initializes empty matrix with correct columns', () => {
    const db = createDragboard();
    const layout = createLayout(db, 4, 30, 10, 20, 10);

    assert.equal(layout.matrix.length, 4);
    for (let x = 0; x < 4; x++) {
        assert.ok(Array.isArray(layout.matrix[x]));
        assert.equal(layout.matrix[x].length, 0);
    }
    assert.strictEqual(layout._buffers.base.matrix, layout.matrix);
});

test('constructor defines rows as getter and columns remains', () => {
    const db = createDragboard();
    const layout = createLayout(db, 6, 30, 10, 20, 10);

    assert.equal(layout.columns, 6);
    assert.equal(layout.rows, 0);

    const descRows = Object.getOwnPropertyDescriptor(layout, 'rows');
    assert.equal(typeof descRows.get, 'function');
    assert.equal(typeof descRows.set, 'undefined');
});

// ============================================================================
// rows getter
// ============================================================================

test('rows getter returns max row count across all columns', () => {
    const db = createDragboard();
    const layout = createLayout(db, 4, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 0, 0, 2, 3);
    const w2 = createMockWidget('w2', 2, 0, 2, 5);
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);

    assert.equal(layout.rows, 5);
});

test('rows getter returns 0 for empty matrix', () => {
    const db = createDragboard();
    const layout = createLayout(db, 4, 30, 10, 20, 10);

    assert.equal(layout.rows, 0);
});

// ============================================================================
// fromPixelsToVCells
// ============================================================================

test('fromPixelsToVCells positive value converts correctly', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.equal(layout.fromPixelsToVCells(60), 2);
    assert.equal(layout.fromPixelsToVCells(90), 3);
});

test('fromPixelsToVCells zero returns 0', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.equal(layout.fromPixelsToVCells(0), 0);
});

test('fromPixelsToVCells negative returns 0', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.equal(layout.fromPixelsToVCells(-50), 0);
});

// ============================================================================
// fromVCellsToPixels
// ============================================================================

test('fromVCellsToPixels converts cells to pixels', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.equal(layout.fromVCellsToPixels(3), 90);
    assert.equal(layout.fromVCellsToPixels(0), 0);
});

// ============================================================================
// getWidthInPixels
// ============================================================================

test('getWidthInPixels subtracts margins', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // fromHCellsToPixels(2) = (1200 * 2*5%) / 100 = 1200 * 10 / 100 = 120
    // 120 - 10 - 10 = 100
    assert.equal(layout.getWidthInPixels(2), 100);
});

// ============================================================================
// getHeightInPixels
// ============================================================================

test('getHeightInPixels subtracts margins', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // fromVCellsToPixels(4) = 4 * 30 = 120
    // 120 - 5 - 5 = 110
    assert.equal(layout.getHeightInPixels(4), 110);
});

// ============================================================================
// fromPixelsToHCells
// ============================================================================

test('fromPixelsToHCells zero or negative returns 0', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.equal(layout.fromPixelsToHCells(0), 0);
    assert.equal(layout.fromPixelsToHCells(-10), 0);
});

test('fromPixelsToHCells positive with explicit width', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // fromHCellsToPixels(1, 1200) = (1200 * (1 * 100/20)) / 100 = 1200 * 5 / 100 = 60
    // 180 / 60 = 3
    assert.equal(layout.fromPixelsToHCells(180, 1200), 3);
});

test('fromPixelsToHCells positive without width uses getWidth', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // fromHCellsToPixels(1) = (1200 * 5) / 100 = 60
    // 120 / 60 = 2
    assert.equal(layout.fromPixelsToHCells(120), 2);
});

// ============================================================================
// fromHCellsToPixels
// ============================================================================

test('fromHCellsToPixels with explicit width', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // fromHCellsToPercentage(3) = 3 * (100/20) = 15
    // (1000 * 15) / 100 = 150
    assert.equal(layout.fromHCellsToPixels(3, 1000), 150);
});

test('fromHCellsToPixels without width uses getWidth', () => {
    const db = createDragboard({ getWidth: () => 800 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // fromHCellsToPercentage(3) = 3 * 5 = 15
    // (800 * 15) / 100 = 120
    assert.equal(layout.fromHCellsToPixels(3), 120);
});

// ============================================================================
// fromHCellsToPercentage
// ============================================================================

test('fromHCellsToPercentage calculates correctly', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.equal(layout.fromHCellsToPercentage(1), 5);
    assert.equal(layout.fromHCellsToPercentage(4), 20);
    assert.equal(layout.fromHCellsToPercentage(20), 100);
});

// ============================================================================
// adaptColumnOffset
// ============================================================================

test('adaptColumnOffset with cells unit', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptColumnOffset(7, 1200);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 7);
});

test('adaptColumnOffset with percentage unit and width', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptColumnOffset('50%', 1000);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    // pixels = 50 * 1000 / 100 = 500
    // inLU = fromPixelsToHCells(500, 1000)
    assert.equal(result.inLU > 0, true);
});

test('adaptColumnOffset with percentage unit without width uses getWidth', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptColumnOffset('50%');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
});

test('adaptColumnOffset with px unit less than dragboard.leftMargin clamps pixels to 0', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 20 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptColumnOffset('10px', 1200);

    assert.equal(result.inLU, 0);
    // inPixels = getColumnOffset({x:0}, 1200) = 0 + leftMargin + dragboard.leftMargin = 30
    assert.ok(result.inPixels >= 0);
});

test('adaptColumnOffset with px unit >= leftMargin', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptColumnOffset('100px', 1000);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.ok(result.inLU >= 0);
});

test('adaptColumnOffset with px unit without width', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptColumnOffset('50px');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
});

// ============================================================================
// adaptRowOffset
// ============================================================================

test('adaptRowOffset with cells unit', () => {
    const db = createDragboard({ getHeight: () => 900, topMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptRowOffset(7);

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 7);
});

test('adaptRowOffset with percentage unit', () => {
    const db = createDragboard({ getHeight: () => 900, topMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptRowOffset('50%');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.ok(result.inLU >= 0);
});

test('adaptRowOffset with px unit less than dragboard.topMargin clamps to 0', () => {
    const db = createDragboard({ topMargin: 50 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptRowOffset('10px');

    // pixels = 0 (clamped), then fromPixelsToVCells(0 - topMargin) = fromPixelsToVCells(-5) = 0
    assert.equal(result.inLU, 0);
});

test('adaptRowOffset with px unit >= topMargin', () => {
    const db = createDragboard({ topMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.adaptRowOffset('200px');

    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.ok(result.inLU >= 0);
});

// ============================================================================
// padWidth
// ============================================================================

test('padWidth adds left and right margins', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.equal(layout.padWidth(100), 120); // 100 + 10 + 10
    assert.equal(layout.padWidth(0), 20);
});

// ============================================================================
// padHeight
// ============================================================================

test('padHeight adds top and bottom margins', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    assert.equal(layout.padHeight(100), 110); // 100 + 5 + 5
    assert.equal(layout.padHeight(0), 10);
});

// ============================================================================
// getColumnOffset
// ============================================================================

test('getColumnOffset with explicit width, non-css', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // fromHCellsToPercentage(3) = 3 * 5 = 15
    // floor((1000 * 15) / 100) = floor(150) = 150
    // 150 + 10 + 5 = 165
    const result = layout.getColumnOffset({ x: 3 }, 1000, false);
    assert.equal(result, 165);
});

test('getColumnOffset without width uses getWidth', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // fromHCellsToPercentage(3) = 3 * 5 = 15
    // floor((1200 * 15) / 100) = 180
    // 180 + 10 + 5 = 195
    const result = layout.getColumnOffset({ x: 3 }, null, false);
    assert.equal(result, 195);
});

test('getColumnOffset with css returns string', () => {
    const db = createDragboard({ getWidth: () => 1200, leftMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.getColumnOffset({ x: 3 }, 1000, true);
    assert.equal(result, '165px');
});

// ============================================================================
// getRowOffset
// ============================================================================

test('getRowOffset non-css returns number', () => {
    const db = createDragboard({ topMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    // dragboard.topMargin + fromVCellsToPixels(4) + topMargin
    // 5 + 4*30 + 5 = 130
    const result = layout.getRowOffset({ y: 4 }, false);
    assert.equal(result, 130);
});

test('getRowOffset with css returns string', () => {
    const db = createDragboard({ topMargin: 5 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.getRowOffset({ y: 4 }, true);
    assert.equal(result, '130px');
});

// ============================================================================
// _notifyWindowResizeEvent
// ============================================================================

test('_notifyWindowResizeEvent calls parent when widthChanged is true', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    let parentCalled = false;
    const orig = Wirecloud.ui.DragboardLayout.prototype._notifyWindowResizeEvent;
    Wirecloud.ui.DragboardLayout.prototype._notifyWindowResizeEvent = function (wc, hc) {
        parentCalled = true;
        assert.equal(wc, true);
        assert.equal(hc, true);
    };

    layout._notifyWindowResizeEvent(true, true);

    assert.equal(parentCalled, true);

    Wirecloud.ui.DragboardLayout.prototype._notifyWindowResizeEvent = orig;
});

test('_notifyWindowResizeEvent skips parent when widthChanged is false', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    let parentCalled = false;
    const orig = Wirecloud.ui.DragboardLayout.prototype._notifyWindowResizeEvent;
    Wirecloud.ui.DragboardLayout.prototype._notifyWindowResizeEvent = function () {
        parentCalled = true;
    };

    layout._notifyWindowResizeEvent(false, true);

    assert.equal(parentCalled, false);

    Wirecloud.ui.DragboardLayout.prototype._notifyWindowResizeEvent = orig;
});

// ============================================================================
// _getPositionOn
// ============================================================================

test('_getPositionOn returns widget.position for base buffer', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    const widget = createMockWidget('w1', 3, 5);

    const pos = layout._getPositionOn(layout._buffers.base, widget);

    assert.deepEqual(pos, { x: 3, y: 5 });
});

test('_getPositionOn returns buffer.positions for non-base buffer', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    const widget = createMockWidget('w1');
    const buffer = { positions: { 'w1': { x: 10, y: 20 } } };

    const pos = layout._getPositionOn(buffer, widget);

    assert.deepEqual(pos, { x: 10, y: 20 });
});

// ============================================================================
// _setPositionOn
// ============================================================================

test('_setPositionOn calls setPosition on widget for base buffer', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    let setPosCalled = null;
    const widget = createMockWidget('w1', 0, 0, 1, 1, {
        setPosition: (pos) => { setPosCalled = pos; },
    });

    layout._setPositionOn(layout._buffers.base, widget, { x: 7, y: 9 });

    assert.deepEqual(setPosCalled, { x: 7, y: 9 });
});

test('_setPositionOn updates buffer.positions for non-base buffer', () => {
    const db = createDragboard();
    const layout = createLayout(db, 20, 30, 10, 20, 10);
    const widget = createMockWidget('w1');
    const buffer = { positions: {} };

    layout._setPositionOn(buffer, widget, { x: 5, y: 8 });

    assert.deepEqual(buffer.positions['w1'], { x: 5, y: 8 });
});

// ============================================================================
// _clearMatrix
// ============================================================================

test('_clearMatrix resets matrix to empty columns', () => {
    const db = createDragboard();
    const layout = createLayout(db, 3, 30, 10, 20, 10);

    // Fill matrix first
    const w1 = createMockWidget('w1', 0, 0, 1, 1);
    fillMatrix(layout, w1);

    layout._clearMatrix();

    assert.equal(layout.matrix.length, 3);
    for (let x = 0; x < 3; x++) {
        assert.deepEqual(layout.matrix[x], []);
    }
    assert.strictEqual(layout._buffers.base.matrix, layout.matrix);
});

// ============================================================================
// _hasSpaceFor
// ============================================================================

test('_hasSpaceFor returns true when space is free', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    // Fill some cells but leave [2][0] -> [3][1] free
    const matrix = [[], [], [], [], []];
    matrix[0][0] = 'blocked';
    matrix[0][1] = 'blocked';

    assert.equal(layout._hasSpaceFor(matrix, 2, 0, 2, 2), true);
});

test('_hasSpaceFor returns false when space is occupied', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const matrix = [[], [], [], [], []];
    matrix[2][1] = 'occupied';

    assert.equal(layout._hasSpaceFor(matrix, 2, 0, 2, 2), false);
});

// ============================================================================
// _clearSpace
// ============================================================================

test('_clearSpace clears widget from matrix and compresses columns', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 1, 2, 2, 2);
    layout._reserveSpace2(layout.matrix, widget, 1, 2, 2, 2);

    assert.equal(layout.matrix[1][2], widget);
    assert.equal(layout.matrix[2][3], widget);

    layout._clearSpace(layout._buffers.base, widget);

    assert.equal(layout.matrix[1][2], undefined);
    assert.equal(layout.matrix[2][3], undefined);
});

// ============================================================================
// _compressColumns
// ============================================================================

test('_compressColumns removes trailing null entries', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const matrix = [[], [], []];
    matrix[0][0] = 'a';
    matrix[0][1] = 'b';
    matrix[0][2] = null;
    matrix[0][3] = null;

    layout._compressColumns(matrix, 0, 1);

    assert.equal(matrix[0].length, 2);
    assert.equal(matrix[0][0], 'a');
    assert.equal(matrix[0][1], 'b');
});

test('_compressColumns keeps entries that end with non-null', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const matrix = [[], [], []];
    matrix[0][0] = 'a';
    matrix[0][1] = 'b';
    matrix[0][2] = 'c';

    layout._compressColumns(matrix, 0, 1);

    assert.equal(matrix[0].length, 3);
});

// ============================================================================
// _reserveSpace2
// ============================================================================

test('_reserveSpace2 places widget in matrix cells', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const matrix = [[], [], [], [], []];
    const widget = createMockWidget('w1');

    layout._reserveSpace2(matrix, widget, 2, 1, 2, 3);

    for (let x = 2; x < 4; x++) {
        for (let y = 1; y < 4; y++) {
            assert.equal(matrix[x][y], widget);
        }
    }
});

test('_reserveSpace2 creates columns if they do not exist', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const matrix = [[], []];
    const widget = createMockWidget('w1');

    layout._reserveSpace2(matrix, widget, 3, 0, 1, 1);

    assert.ok(Array.isArray(matrix[3]));
    assert.equal(matrix[3][0], widget);
});

// ============================================================================
// _clearSpace2
// ============================================================================

test('_clearSpace2 removes widget from matrix and compresses', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const matrix = [[], [], [], [], []];
    const widget = createMockWidget('w1');
    matrix[1][2] = widget;
    matrix[2][2] = widget;
    matrix[1][3] = widget;
    matrix[2][3] = widget;
    matrix[1][4] = null;

    layout._clearSpace2(matrix, 1, 2, 2, 2);

    assert.equal(matrix[1][2], undefined);
    assert.equal(matrix[2][2], undefined);
    // Column 1 should be compressed - length should be at most 2
    assert.equal(matrix[1].length <= 2, true);
});

// ============================================================================
// moveSpaceDown
// ============================================================================

test('moveSpaceDown with no affected widgets', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 1, 0, 2, 2);
    fillMatrix(layout, widget);
    layout.widgets['w1'] = widget;

    const affected = layout.moveSpaceDown(layout._buffers.base, widget, 3);

    assert.equal(affected.size, 0);
    // Widget should have moved down
    assert.equal(widget.position.y, 3);
});

test('moveSpaceDown with affected widgets', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    // w1 at row 0, w2 at row 2 directly below w1
    const w1 = createMockWidget('w1', 1, 0, 2, 2);
    const w2 = createMockWidget('w2', 1, 2, 2, 2);
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);
    layout.widgets['w1'] = w1;
    layout.widgets['w2'] = w2;

    const affected = layout.moveSpaceDown(layout._buffers.base, w1, 3);

    // w1 moves to row 3, w2 should be affected
    assert.ok(affected.has('w2') || affected.has('w1'));
});

// ============================================================================
// moveSpaceUp
// ============================================================================

test('moveSpaceUp can move up when space is free', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 1, 4, 2, 2);
    fillMatrix(layout, widget);
    layout.widgets['w1'] = widget;

    const affected = layout.moveSpaceUp(layout._buffers.base, widget);

    // Widget should move up as far as possible
    assert.equal(widget.position.y < 4, true);
});

test('moveSpaceUp cannot move up if blocked', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    // w1 at y=0, w2 at y=2
    const w1 = createMockWidget('w1', 1, 0, 2, 2);
    const w2 = createMockWidget('w2', 1, 2, 2, 2);
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);
    layout.widgets['w1'] = w1;
    layout.widgets['w2'] = w2;

    const affected = layout.moveSpaceUp(layout._buffers.base, w2);

    // w2 can move up at most 0 (blocked by w1 at row 2)
    // offsetY = 1, from _hasSpaceFor at y=1: blocked by w1, so offsetY = 0
    assert.equal(w2.position.y >= 2, true);
    assert.equal(affected.size, 0);
});

test('moveSpaceUp with affected widgets below', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 1, 4, 2, 2);
    const w2 = createMockWidget('w2', 1, 6, 2, 2);
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);
    layout.widgets['w1'] = w1;
    layout.widgets['w2'] = w2;

    const origY = w1.position.y;
    const affected = layout.moveSpaceUp(layout._buffers.base, w1);

    assert.equal(w1.position.y < origY, true);
});

// ============================================================================
// _removeFromMatrix
// ============================================================================

test('_removeFromMatrix clears widget and returns empty set', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 1, 1, 2, 2);
    fillMatrix(layout, widget);

    const result = layout._removeFromMatrix(layout._buffers.base, widget);

    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
});

// ============================================================================
// _reserveSpace
// ============================================================================

test('_reserveSpace calls _reserveSpace2', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 1, 1, 2, 2);
    layout._reserveSpace(layout._buffers.base, widget);

    assert.equal(layout.matrix[1][1], widget);
    assert.equal(layout.matrix[2][2], widget);
});

// ============================================================================
// _searchFreeSpace / _searchFreeSpace2
// ============================================================================

test('_searchFreeSpace2 finds position in empty matrix', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const matrix = [[], [], [], [], []];
    const result = layout._searchFreeSpace2(3, 2, matrix);

    assert.equal(result.relx, true);
    assert.equal(result.x, 0);
    assert.equal(result.rely, true);
    assert.equal(result.y, 0);
});

test('_searchFreeSpace2 finds position when first rows are occupied', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const matrix = [[], [], [], [], []];
    // Occupy first 2 rows
    for (let x = 0; x < 5; x++) {
        matrix[x][0] = 'occupied';
        matrix[x][1] = 'occupied';
    }

    const result = layout._searchFreeSpace2(3, 2, matrix);

    assert.equal(result.x, 0);
    assert.equal(result.y, 2);
});

test('_searchFreeSpace finds position in main matrix', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const result = layout._searchFreeSpace(3, 2);

    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
});

// ============================================================================
// _insertAt
// ============================================================================

test('_insertAt places widget at position with no affected widgets', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 2, {
        setPosition: (pos) => { widget.position.x = pos.x; widget.position.y = pos.y; },
    });
    layout.widgets['w1'] = widget;

    const buffer = { matrix: layout.matrix, positions: { 'w1': null } };
    const affected = layout._insertAt(widget, 3, 0, layout._buffers.base);

    assert.equal(widget.position.x, 3);
    assert.equal(widget.position.y, 0);
    assert.equal(layout.matrix[3][0], widget);
});

test('_insertAt moves affected widgets down', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    // Pre-fill matrix with w2 at the insertion point
    const w2 = createMockWidget('w2', 2, 0, 2, 2);
    fillMatrix(layout, w2);
    layout.widgets['w2'] = w2;

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets['w1'] = w1;

    const affected = layout._insertAt(w1, 2, 0, layout._buffers.base);

    // w1 inserted at (2,0), w2 pushed down
    assert.ok(affected.has('w2') || affected.has('w1'));
});

test('_insertAt clamps negative coords to 0', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets['w1'] = widget;

    layout._insertAt(widget, -5, -3, layout._buffers.base);

    assert.equal(widget.position.x, 0);
    assert.equal(widget.position.y, 0);
});

// ============================================================================
// initialize
// ============================================================================

test('initialize with no widgets returns false', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    assert.equal(layout.initialized, false);
    const result = layout.initialize();

    assert.equal(layout.initialized, true);
    assert.equal(result, false);
});

test('initialize with widgets that fit', () => {
    const db = createDragboard();
    const layout = createLayout(db, 10, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 0, 0, 3, 4);
    let w1Repainted = false;
    w1.repaint = () => { w1Repainted = true; };

    const w2 = createMockWidget('w2', 5, 0, 3, 4);
    let w2Repainted = false;
    w2.repaint = () => { w2Repainted = true; };

    layout.widgets = { w1, w2 };
    const result = layout.initialize();

    assert.equal(layout.initialized, true);
    assert.equal(result, false);
    assert.equal(w1Repainted, true);
    assert.equal(w2Repainted, true);
    assert.equal(layout.matrix[0][0], w1);
    assert.equal(layout.matrix[5][0], w2);
});

test('initialize limits widget shape.width to columns', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 0, 0, 10, 2);
    let setShapeCalled = null;
    w1.setShape = (s) => { setShapeCalled = s; w1.shape.width = s.width; };
    layout.widgets = { w1 };

    layout.initialize();

    assert.equal(w1.shape.width, 5);
});

test('initialize reinserts widgets that overflow column count', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 4, 0, 3, 2);

    let setPositionCalled = null;
    w1.setPosition = (pos) => { setPositionCalled = pos; w1.position.x = pos.x; w1.position.y = pos.y; };
    layout.widgets = { w1 };

    const result = layout.initialize();

    // position.x + width = 4 + 3 = 7 > 5 columns -> reinsert
    assert.equal(result, true);
    assert.ok(setPositionCalled != null);
    assert.equal(w1.position.x + w1.shape.width <= 5, true);
});

test('initialize reinserts widgets that overlap', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    // Two widgets at same position
    const w1 = createMockWidget('w1', 1, 0, 3, 2);
    const w2 = createMockWidget('w2', 1, 0, 3, 2);

    const setPosCalls = [];
    w1.setPosition = (pos) => { setPosCalls.push('w1'); };
    w2.setPosition = (pos) => { setPosCalls.push('w2'); };
    layout.widgets = { w1, w2 };

    const result = layout.initialize();

    // At least one of the widgets should be reinserted
    assert.equal(result, true);
});

// ============================================================================
// getCellAt
// ============================================================================

test('getCellAt returns correct DragboardPosition', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.getCellAt(180, 90);

    assert.ok(result instanceof Wirecloud.DragboardPosition);
    assert.equal(result.x, Math.floor(180 / (1200 / 20)));
    assert.equal(result.y, Math.floor(90 / 30));
});

test('getCellAt returns zero for zero coords', () => {
    const db = createDragboard({ getWidth: () => 1200 });
    const layout = createLayout(db, 20, 30, 10, 20, 10);

    const result = layout.getCellAt(0, 0);

    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
});

// ============================================================================
// addWidget
// ============================================================================

test('addWidget when not initialized returns early', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);
    layout.initialized = false;
    const widget = createMockWidget('w1', 0, 0, 2, 2);

    const result = layout.addWidget(widget, false);

    // parent addWidget should be called, layout should exit early
    assert.equal(result, undefined);
});

test('addWidget when initialized limits width to columns', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);
    layout.initialized = true;
    const widget = createMockWidget('w1', 0, 0, 10, 2);
    widget.layout = null;
    layout.widgets = {};

    let setShapeCalled = null;
    widget.setShape = (s) => { setShapeCalled = s; widget.shape.width = s.width; };

    layout.addWidget(widget, false);

    assert.equal(widget.shape.width, 5);
});

test('addWidget adjusts x when position overflows', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);
    layout.initialized = true;

    const widget = createMockWidget('w1', 4, 0, 2, 2);
    widget.layout = null;
    layout.widgets = {};

    layout.addWidget(widget, false);

    // position.x + width = 4 + 2 = 6 > 5, so position.x -= 1
    assert.equal(widget.position.x, 3);
});

test('addWidget returns affected widgets set', () => {
    const db = createDragboard();
    const layout = createLayout(db, 10, 30, 10, 20, 10);
    layout.initialized = true;
    layout._adaptIWidget = () => {};

    const widget = createMockWidget('w1', 0, 0, 2, 2);
    widget.layout = null;
    layout.widgets = {};

    const result = layout.addWidget(widget, false);

    assert.ok(result instanceof Set);
});

// ============================================================================
// removeWidget
// ============================================================================

test('removeWidget clears matrix and calls parent', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);
    layout.initialized = true;

    const widget = createMockWidget('w1', 1, 1, 2, 2);
    fillMatrix(layout, widget);
    widget.layout = layout;
    layout.widgets['w1'] = widget;

    const result = layout.removeWidget(widget, false);

    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
    assert.equal(layout.matrix[1][1], undefined);
    assert.equal(widget.layout, null);
});

// ============================================================================
// moveTo
// ============================================================================

test('moveTo moves widgets in order and restores _removeFromMatrix', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const destLayout = createLayout(createDragboard(), 5, 30, 10, 20, 10);
    const calls = [];

    const w1 = createMockWidget('w1', 0, 0, 2, 2, {
        moveToLayout: (dest) => { calls.push({ id: 'w1', dest }); },
    });
    const w2 = createMockWidget('w2', 2, 0, 2, 2, {
        moveToLayout: (dest) => { calls.push({ id: 'w2', dest }); },
    });
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);
    layout.widgets = { w1, w2 };

    const originalRemoveFromMatrix = layout._removeFromMatrix;
    const result = layout.moveTo(destLayout);

    assert.equal(calls.length, 2);
    assert.equal(calls[0].dest, destLayout);
    assert.equal(calls[1].dest, destLayout);
    assert.equal(layout._removeFromMatrix, originalRemoveFromMatrix);
});

test('moveTo with empty widgets does not throw', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);
    const destLayout = createLayout(createDragboard(), 5, 30, 10, 20, 10);

    assert.doesNotThrow(() => layout.moveTo(destLayout));
});

// ============================================================================
// _cloneMatrix
// ============================================================================

test('_cloneMatrix creates a shallow copy of the matrix', () => {
    const db = createDragboard();
    const layout = createLayout(db, 3, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 1, 1, 1, 1);
    fillMatrix(layout, widget);

    const cloned = layout._cloneMatrix(layout.matrix);

    assert.equal(cloned.length, 3);
    assert.equal(cloned[1][1], widget);
    assert.notStrictEqual(cloned, layout.matrix);
    assert.notStrictEqual(cloned[1], layout.matrix[1]);
});

// ============================================================================
// _clonePositions
// ============================================================================

test('_clonePositions clones all widget positions from buffer', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 1, 2, 1, 1);
    const w2 = createMockWidget('w2', 3, 4, 1, 1);
    layout.widgets = { w1, w2 };

    const buffer = { positions: { 'w1': { x: 10, y: 20 }, 'w2': { x: 30, y: 40 } } };
    const result = layout._clonePositions(buffer);

    assert.deepEqual(result['w1'], { x: 10, y: 20 });
    assert.deepEqual(result['w2'], { x: 30, y: 40 });
    assert.notStrictEqual(result['w1'], buffer.positions['w1']);
});

// ============================================================================
// initializeMove
// ============================================================================

test('initializeMove throws TypeError for null widget', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    assert.throws(() => layout.initializeMove(null, {}), TypeError);
});

test('initializeMove throws TypeError for non-WidgetView', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    assert.throws(() => layout.initializeMove({}, {}), TypeError);
});

test('initializeMove with valid widget sets up move state', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets['w1'] = widget;

    // Make widget pass instanceof check
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    widget.repaint = () => widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 60, offsetWidth: 100 };
    widget.tab = { wrapperElement: document.createElement('div') };

    const draggable = {
        offsets: {},
        setXOffset(v) { this.offsets.x = v; return this; },
        setYOffset(v) { this.offsets.y = v; return this; },
    };

    layout.initializeMove(widget, draggable);

    assert.equal(layout.iwidgetToMove, widget);
    assert.ok(layout.dragboardCursor instanceof Wirecloud.ui.DragboardCursor);
    assert.ok(layout._buffers.backup != null);
    assert.ok(layout._buffers.shadow != null);
    assert.equal(draggable.offsets.x, layout.fromHCellsToPixels(1) / 2);
    assert.equal(draggable.offsets.y, layout.cellHeight);
});

test('initializeMove with pending move cancels previous', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const logs = [];
    Wirecloud.GlobalLogManager.log = (msg, level) => { logs.push({ msg, level }); };

    const oldWidget = createMockWidget('old', 0, 0, 2, 2);
    const newWidget = createMockWidget('new', 0, 0, 2, 2);
    layout.widgets['old'] = oldWidget;
    layout.widgets['new'] = newWidget;

    // Make widgets pass instanceof check
    const realProto = Object.getPrototypeOf(oldWidget);
    Object.setPrototypeOf(oldWidget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(newWidget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    oldWidget.repaint = () => oldWidget;
    newWidget.repaint = () => newWidget;
    oldWidget.layout = layout;
    newWidget.layout = layout;
    oldWidget.wrapperElement = { offsetHeight: 60, offsetWidth: 100 };
    newWidget.wrapperElement = { offsetHeight: 60, offsetWidth: 100 };
    oldWidget.tab = { wrapperElement: document.createElement('div') };
    newWidget.tab = { wrapperElement: document.createElement('div') };

    const draggable = { setXOffset() { return this; }, setYOffset() { return this; } };

    layout.initializeMove(oldWidget, draggable);
    assert.equal(layout.iwidgetToMove, oldWidget);

    layout.initializeMove(newWidget, draggable);

    assert.equal(layout.iwidgetToMove, newWidget);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].level, 2);
    assert.ok(logs[0].msg.includes('pending move'));
});

// ============================================================================
// disableCursor
// ============================================================================

test('disableCursor destroys cursor and sets to null', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 2);
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 60, offsetWidth: 100 };
    widget.tab = { wrapperElement: document.createElement('div') };
    layout.dragboardCursor = new Wirecloud.ui.DragboardCursor(widget);

    layout.disableCursor();

    assert.equal(layout.dragboardCursor, null);
});

test('disableCursor does nothing when cursor is null', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    assert.doesNotThrow(() => layout.disableCursor());
    assert.equal(layout.dragboardCursor, null);
});

// ============================================================================
// _setPositions
// ============================================================================

test('_setPositions updates widget positions from shadow buffer', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const setPosCalls = [];
    const w1 = createMockWidget('w1', 0, 0, 2, 2, {
        setPosition: (pos) => { setPosCalls.push({ id: 'w1', pos }); },
    });
    const w2 = createMockWidget('w2', 0, 0, 2, 2, {
        setPosition: (pos) => { setPosCalls.push({ id: 'w2', pos }); },
    });
    layout.widgets = { w1, w2 };

    const cursor = new Wirecloud.ui.DragboardCursor(w1);
    cursor.id = 'cursor';
    cursor.widget = w2; // needed so w1 lookup matches iwidgetToMove check
    layout.dragboardCursor = cursor;
    layout.iwidgetToMove = w1;

    layout._buffers.shadow = {
        matrix: layout.matrix,
        positions: {
            'w1': { x: 1, y: 1 },
            'w2': { x: 3, y: 3 },
        },
    };

    layout._setPositions();

    // w2 should get its position updated
    assert.equal(setPosCalls.length, 1);
    assert.equal(setPosCalls[0].id, 'w2');
});

// ============================================================================
// moveTemporally
// ============================================================================

test('moveTemporally without initializeMove logs warning', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const logs = [];
    Wirecloud.GlobalLogManager.log = (msg, level) => { logs.push({ msg, level }); };

    layout.moveTemporally(100, 200);

    assert.equal(logs.length, 1);
    assert.equal(logs[0].level, 2);
    assert.ok(logs[0].msg.includes('moveTemporally'));
});

test('moveTemporally clamps negative y to 0', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 1, 1);
    layout.widgets['w1'] = widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 30, offsetWidth: 60 };
    widget.tab = { wrapperElement: document.createElement('div') };
    widget.repaint = () => widget;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });

    layout.moveTemporally(100, -10);

    // cell width = 1200/5 = 240, so getCellAt(100, -10) y = -1 -> clamped to 0
    assert.equal(layout.dragboardCursor.position.y, 0);
});

test('moveTemporally clamps negative x to 0', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 1);
    layout.widgets['w1'] = widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 30, offsetWidth: 60 };
    widget.tab = { wrapperElement: document.createElement('div') };
    widget.repaint = () => widget;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });

    layout.moveTemporally(-5, 100);

    // cell width = 1200/5 = 240, so getCellAt(-5, 100) x = -1 -> clamped to 0
    assert.equal(layout.dragboardCursor.position.x, 0);
});

test('moveTemporally clamps x > maxX', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 1);
    layout.widgets['w1'] = widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 30, offsetWidth: 60 };
    widget.tab = { wrapperElement: document.createElement('div') };
    widget.repaint = () => widget;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });

    // cell width = 1200/5 = 240, getCellAt(999, 100) x = 4, maxX = 5-2 = 3
    layout.moveTemporally(999, 100);

    assert.equal(layout.dragboardCursor.position.x, 3);
});

test('moveTemporally within bounds updates shadow buffer', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 1);
    layout.widgets['w1'] = widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 30, offsetWidth: 60 };
    widget.tab = { wrapperElement: document.createElement('div') };
    widget.repaint = () => widget;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });

    // Give cursor a different starting position so getCellAt changes
    layout.dragboardCursor.position = new Wirecloud.DragboardPosition(4, 4);

    // cell width = 1200/5 = 240, cell height = 30
    // getCellAt(480, 90) => x_cell = 2, y_cell = 3
    layout.moveTemporally(480, 90);

    assert.equal(layout.dragboardCursor.position.x, 2);
    assert.equal(layout.dragboardCursor.position.y, 3);
});

test('moveTemporally recreates cursor when it is null', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 1);
    layout.widgets['w1'] = widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 30, offsetWidth: 60 };
    widget.tab = { wrapperElement: document.createElement('div') };
    widget.repaint = () => widget;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });
    layout.dragboardCursor = null;
    layout.iwidgetToMove = widget;

    // cell width = 1200/5 = 240, getCellAt(480, 90) => (2, 3)
    layout.moveTemporally(480, 90);

    assert.ok(layout.dragboardCursor instanceof Wirecloud.ui.DragboardCursor);
    // Cursor position is set via _insertAt in the buffer, then read back
    assert.ok(layout._buffers.shadow.positions != null);
    assert.equal(layout._buffers.shadow.positions['cursor'].x, 2);
    assert.equal(layout._buffers.shadow.positions['cursor'].y, 3);
});

// ============================================================================
// cancelMove
// ============================================================================

test('cancelMove without initializeMove logs warning', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const logs = [];
    Wirecloud.GlobalLogManager.log = (msg, level) => { logs.push({ msg, level }); };

    layout.cancelMove();

    assert.equal(logs.length, 1);
    assert.equal(logs[0].level, 2);
    assert.ok(logs[0].msg.includes('cancel'));
});

test('cancelMove with initialized move resets state', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets['w1'] = widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 60, offsetWidth: 100 };
    widget.tab = { wrapperElement: document.createElement('div') };
    widget.repaint = () => widget;
    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });

    layout.cancelMove();

    assert.equal(layout.iwidgetToMove, null);
    assert.equal(layout.dragboardCursor, null);
});

// ============================================================================
// acceptMove
// ============================================================================

test('acceptMove without initializeMove logs warning', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const logs = [];
    Wirecloud.GlobalLogManager.log = (msg, level) => { logs.push({ msg, level }); };

    layout.acceptMove();

    assert.equal(logs.length, 1);
    assert.equal(logs[0].level, 2);
    assert.ok(logs[0].msg.includes('acceptMove'));
});

test('acceptMove with position changed updates dragboard', () => {
    const db = createDragboard();
    let updateCalled = false;
    let notifyWindowResizeCalled = false;
    db.update = () => { updateCalled = true; };
    db._notifyWindowResizeEvent = () => { notifyWindowResizeCalled = true; };

    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets['w1'] = widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 60, offsetWidth: 100 };
    widget.tab = { wrapperElement: document.createElement('div') };
    widget.repaint = () => widget;

    // setPosition must NOT mutate the old position object in-place
    // (oldposition and newposition are compared in acceptMove)
    let setPosCalled = null;
    widget.setPosition = (pos) => {
        setPosCalled = pos;
        widget.position = { x: pos.x, y: pos.y };
    };

    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });

    // Set cursor position different from widget position
    layout.dragboardCursor.position = new Wirecloud.DragboardPosition(3, 4);

    layout.acceptMove();

    assert.ok(setPosCalled != null);
    assert.equal(setPosCalled.x, 3);
    assert.equal(setPosCalled.y, 4);
    assert.equal(updateCalled, true);
    assert.equal(notifyWindowResizeCalled, true);
    assert.equal(layout.iwidgetToMove, null);
    assert.equal(layout.dragboardCursor, null);
});

test('acceptMove with position unchanged does NOT update dragboard', () => {
    const db = createDragboard();
    let updateCalled = false;
    db.update = () => { updateCalled = true; };
    db._notifyWindowResizeEvent = () => {};

    const layout = createLayout(db, 5, 30, 10, 20, 10);

    const widget = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets['w1'] = widget;
    widget.layout = layout;
    widget.wrapperElement = { offsetHeight: 60, offsetWidth: 100 };
    widget.tab = { wrapperElement: document.createElement('div') };
    widget.repaint = () => widget;

    let setPosCalled = null;
    widget.setPosition = (pos) => { setPosCalled = pos; widget.position = { x: pos.x, y: pos.y }; };

    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    layout.initializeMove(widget, { setXOffset() { return this; }, setYOffset() { return this; } });

    // Set cursor position same as widget position (0, 0)
    layout.dragboardCursor.position = new Wirecloud.DragboardPosition(0, 0);

    layout.acceptMove();

    assert.equal(updateCalled, false);
    assert.equal(layout.iwidgetToMove, null);
});

// ============================================================================
// _notifyResizeEvent
// ============================================================================

test('_notifyResizeEvent newWidth > oldWidth resizeLeftSide pushes neighbours down', () => {
    const db = createDragboard({ update: () => {} });
    const layout = createLayout(db, 10, 30, 10, 20, 10);

    // w1 at (3,0) size 2x2, expanding left by 1
    // w2 at (2,0) size 1x2 — will be pushed down
    const w1 = createMockWidget('w1', 3, 0, 2, 2);
    const w2 = createMockWidget('w2', 2, 0, 1, 2);
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);
    layout.widgets = { w1, w2 };

    let setPosCalled = null;
    w1.setPosition = (pos) => { setPosCalled = pos; w1.position.x = pos.x; w1.position.y = pos.y; };

    layout._notifyResizeEvent(w1, 2, 2, 3, 2, true, false, false);

    // w1 should have moved left by 1
    assert.equal(w1.position.x, 2);
    assert.ok(setPosCalled != null);
});

test('_notifyResizeEvent newWidth > oldWidth NOT resizeLeftSide pushes right neighbours down', () => {
    const db = createDragboard({ update: () => {} });
    const layout = createLayout(db, 10, 30, 10, 20, 10);

    // w1 at (2,0) size 2x2, expanding right by 1
    // w2 at (4,0) size 1x2 — will be pushed down
    const w1 = createMockWidget('w1', 2, 0, 2, 2);
    const w2 = createMockWidget('w2', 4, 0, 1, 2);
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);
    layout.widgets = { w1, w2 };

    w1.setPosition = (pos) => { w1.position.x = pos.x; w1.position.y = pos.y; };

    const origW1X = w1.position.x;
    layout._notifyResizeEvent(w1, 2, 2, 3, 2, false, false, false);

    // w1 should NOT have moved
    assert.equal(w1.position.x, origW1X);
    // Space should have been reserved for new width
    assert.equal(layout.matrix[4][0], w1);
});

test('_notifyResizeEvent newWidth < oldWidth resizeLeftSide clears left space and shifts widget', () => {
    const db = createDragboard({ update: () => {} });
    const layout = createLayout(db, 10, 30, 10, 20, 10);

    // w1 at (3,0) size 3x2, shrinking left by 1
    const w1 = createMockWidget('w1', 3, 0, 3, 2);
    fillMatrix(layout, w1);
    layout.widgets = { w1 };

    w1.setPosition = (pos) => { w1.position.x = pos.x; w1.position.y = pos.y; };
    w1.setShape = (s) => { w1.shape.width = s.width; w1.shape.height = s.height; };

    const origX = w1.position.x;
    layout._notifyResizeEvent(w1, 3, 2, 2, 2, true, false, false);

    // w1 should have moved right
    assert.equal(w1.position.x, origX + 1);
});

test('_notifyResizeEvent newWidth < oldWidth NOT resizeLeftSide clears right space', () => {
    const db = createDragboard({ update: () => {} });
    const layout = createLayout(db, 10, 30, 10, 20, 10);

    // w1 at (2,0) size 3x2, shrinking right by 1
    const w1 = createMockWidget('w1', 2, 0, 3, 2);
    fillMatrix(layout, w1);
    layout.widgets = { w1 };

    w1.setPosition = (pos) => { w1.position.x = pos.x; w1.position.y = pos.y; };

    const origX = w1.position.x;
    layout._notifyResizeEvent(w1, 3, 2, 2, 2, false, false, false);

    // w1 should NOT have moved
    assert.equal(w1.position.x, origX);
    // Space to the right should have been cleared
    assert.equal(layout.matrix[4][0], undefined);
});

test('_notifyResizeEvent newHeight > oldHeight pushes widgets below down', () => {
    const db = createDragboard({ update: () => {} });
    const layout = createLayout(db, 10, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 2, 0, 2, 2);
    const w2 = createMockWidget('w2', 2, 2, 2, 2);
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);
    layout.widgets = { w1, w2 };

    w1.setPosition = (pos) => { w1.position.x = pos.x; w1.position.y = pos.y; };

    layout._notifyResizeEvent(w1, 2, 2, 2, 4, false, false, false);

    // w2 should have been pushed down by 2 rows (now at y=4)
    assert.equal(w2.position.y >= 4, true);
});

test('_notifyResizeEvent newHeight < oldHeight clears freed space', () => {
    const db = createDragboard({ update: () => {} });
    const layout = createLayout(db, 10, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 2, 0, 2, 4);
    fillMatrix(layout, w1);
    layout.widgets = { w1 };

    layout._notifyResizeEvent(w1, 2, 4, 2, 2, false, false, false);

    // Freed rows should be undefined
    assert.equal(layout.matrix[2][2], undefined);
    assert.equal(layout.matrix[3][3], undefined);
});

test('_notifyResizeEvent with persist calls dragboard.update', () => {
    const db = createDragboard();
    let updateCalled = false;
    db.update = () => { updateCalled = true; };

    const layout = createLayout(db, 10, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 2, 0, 2, 2);
    fillMatrix(layout, w1);
    layout.widgets = { w1 };

    w1.setPosition = () => {};
    w1.setShape = () => {};

    layout._notifyResizeEvent(w1, 2, 2, 3, 2, true, false, true);

    assert.equal(updateCalled, true);
});

test('_notifyResizeEvent with persist=false does NOT call dragboard.update', () => {
    const db = createDragboard();
    let updateCalled = false;
    db.update = () => { updateCalled = true; };

    const layout = createLayout(db, 10, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 2, 0, 2, 2);
    fillMatrix(layout, w1);
    layout.widgets = { w1 };

    w1.setPosition = () => {};
    w1.setShape = () => {};

    layout._notifyResizeEvent(w1, 2, 2, 3, 2, true, false, false);

    assert.equal(updateCalled, false);
});

test('_notifyResizeEvent no dimension change works gracefully', () => {
    const db = createDragboard({ update: () => {} });
    const layout = createLayout(db, 10, 30, 10, 20, 10);

    const w1 = createMockWidget('w1', 2, 0, 2, 2);
    fillMatrix(layout, w1);
    layout.widgets = { w1 };

    w1.setPosition = () => {};

    assert.doesNotThrow(() => {
        layout._notifyResizeEvent(w1, 2, 2, 2, 2, false, false, false);
    });
});

// ============================================================================
// INTEGRATION tests
// ============================================================================

test('full lifecycle: addWidget -> initializeMove -> moveTemporally -> acceptMove', () => {
    const db = createDragboard({ getWidth: () => 1200, getHeight: () => 900, leftMargin: 5, topMargin: 5 });
    let updateCalled = false;
    db.update = () => { updateCalled = true; };

    const layout = createLayout(db, 10, 30, 10, 20, 10);
    layout.initialized = true;
    layout._adaptIWidget = () => {};

    const widget = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets['w1'] = widget;
    widget.layout = null;
    widget.wrapperElement = { offsetHeight: 60, offsetWidth: 100 };
    widget.tab = { wrapperElement: document.createElement('div') };

    // setPosition must NOT mutate old position object in-place
    let setPosCalls = [];
    widget.setPosition = (pos) => {
        setPosCalls.push(pos);
        widget.position = { x: pos.x, y: pos.y };
    };
    widget.repaint = () => widget;

    const realProto = Object.getPrototypeOf(widget);
    Object.setPrototypeOf(widget, Wirecloud.ui.WidgetView.prototype);
    Object.setPrototypeOf(Wirecloud.ui.WidgetView.prototype, realProto);

    // Add widget
    layout.addWidget(widget, false);
    assert.equal(widget.layout, layout);
    assert.equal(layout.widgets['w1'], widget);

    // Initialize move
    const draggable = { setXOffset() { return this; }, setYOffset() { return this; } };
    layout.initializeMove(widget, draggable);
    assert.equal(layout.iwidgetToMove, widget);

    // cellWidth = 1200/10 = 120, cellHeight = 30
    // getCellAt(600, 90) => x_cell = 5, y_cell = 3
    layout.moveTemporally(600, 90);
    assert.equal(layout.dragboardCursor.position.x, 5);
    assert.equal(layout.dragboardCursor.position.y, 3);

    // Accept move
    layout.acceptMove();
    assert.equal(updateCalled, true);
    assert.equal(layout.iwidgetToMove, null);
    assert.equal(layout.dragboardCursor, null);
});

test('moveTo restores _removeFromMatrix correctly', () => {
    const db = createDragboard();
    const layout = createLayout(db, 5, 30, 10, 20, 10);
    const dest = createLayout(createDragboard(), 5, 30, 10, 20, 10);

    const origRemoveFromMatrix = layout._removeFromMatrix;
    layout.moveTo(dest);

    // _removeFromMatrix should be back to original (removed from instance)
    assert.equal(layout._removeFromMatrix, origRemoveFromMatrix);
});
