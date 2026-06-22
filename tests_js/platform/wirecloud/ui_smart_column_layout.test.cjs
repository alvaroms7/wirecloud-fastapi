const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const createDragboard = () => ({
    getWidth: () => 800,
    getHeight: () => 600,
    update: () => {},
    _addWidget: () => {},
    _removeWidget: () => {},
    leftMargin: 0,
    topMargin: 0,
});

const createMockWidget = (id, x, y, width, height) => {
    const pos = { x, y };
    return {
        id,
        position: pos,
        shape: { width, height },
        setPosition(newPos) { Object.assign(pos, newPos); },
        setShape() {},
        addEventListener() {},
        removeEventListener() {},
        repaint() {},
        minimized: false,
        layout: null,
        element: null,
    };
};

const fillMatrix = (layout, widget) => {
    const pos = widget.position;
    for (let cx = 0; cx < widget.shape.width; cx++) {
        for (let cy = 0; cy < widget.shape.height; cy++) {
            layout.matrix[pos.x + cx][pos.y + cy] = widget;
        }
    }
};

const clearMatrix = (layout, widget) => {
    const pos = widget.position;
    for (let cx = 0; cx < widget.shape.width; cx++) {
        for (let cy = 0; cy < widget.shape.height; cy++) {
            delete layout.matrix[pos.x + cx][pos.y + cy];
        }
    }
};

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
        constructor(pixels, lu) { this.inPixels = pixels; this.inLU = lu; }
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/DragboardLayout.js',
        'src/wirecloud/platform/static/js/wirecloud/ui/ColumnLayout.js',
        'src/wirecloud/platform/static/js/wirecloud/ui/SmartColumnLayout.js',
    ]);
});

// ============================================================================
// CONSTRUCTOR
// ============================================================================

test('constructor creates SmartColumnLayout instance', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    assert.ok(layout instanceof Wirecloud.ui.ColumnLayout);
    assert.ok(layout instanceof Wirecloud.ui.DragboardLayout);
    assert.ok(layout instanceof Wirecloud.ui.SmartColumnLayout);
    assert.equal(layout.dragboard, db);
    assert.equal(layout.columns, 20);
    assert.deepEqual(layout.widgets, {});
});

// ============================================================================
// initialize
// ============================================================================

test('initialize - no widgets, super returns false', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const result = layout.initialize();

    assert.equal(result, false);
});

test('initialize - widgets in matrix, super returns false, moveSpaceUp returns empty', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._reserveSpace(layout._buffers.base, w1);

    // Mock moveSpaceUp to return empty Set (nothing moved)
    const origMoveSpaceUp = layout.moveSpaceUp;
    layout.moveSpaceUp = () => new Set();

    let updateCalled = false;
    layout.dragboard.update = () => { updateCalled = true; };

    const result = layout.initialize();

    assert.equal(result, false);
    assert.equal(updateCalled, false);

    layout.moveSpaceUp = origMoveSpaceUp;
});

test('initialize - first widget moves, second short-circuits', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const w2 = createMockWidget('w2', 3, 0, 2, 2);

    layout.widgets = {};
    layout.widgets['w1'] = w1;
    layout.widgets['w2'] = w2;
    layout.iWidgets = {};
    layout.iWidgets['w1'] = w1;
    layout.iWidgets['w2'] = w2;

    // Replace super.initialize to return false (simulating all widgets fit)
    const origInit = layout.initialize;
    layout.initialize = function () {
        let modified = false;
        const keys = [];
        for (const key in this.widgets) {
            keys.push(key);
            const widget = this.widgets[key];
            modified = modified || (this.moveSpaceUp(this._buffers.base, widget).size > 0);
        }
        if (modified) {
            this.dragboard.update(keys);
        }
        this.initialized = true;
        return modified;
    };

    const origMoveSpaceUp = layout.moveSpaceUp;
    let moveUpCalls = [];
    layout.moveSpaceUp = function (buffer, widget) {
        moveUpCalls.push(widget.id);
        const s = new Set();
        s.add(widget.id);
        return s;
    };

    let updateKeys = null;
    layout.dragboard.update = (keys) => { updateKeys = keys; };

    const result = layout.initialize();

    // Only w1's moveSpaceUp is called due to || short-circuit after first modification
    assert.equal(result, true);
    assert.equal(moveUpCalls.length, 1);
    assert.equal(moveUpCalls[0], 'w1');
    assert.deepEqual(updateKeys, ['w1', 'w2']);

    layout.moveSpaceUp = origMoveSpaceUp;
    layout.initialize = origInit;
});

test('initialize - no widgets move (short-circuit not triggered)', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const w2 = createMockWidget('w2', 3, 0, 2, 2);

    layout.widgets = {};
    layout.widgets['w1'] = w1;
    layout.widgets['w2'] = w2;
    layout.iWidgets = {};
    layout.iWidgets['w1'] = w1;
    layout.iWidgets['w2'] = w2;

    const origInit = layout.initialize;
    layout.initialize = function () {
        let modified = false;
        const keys = [];
        for (const key in this.widgets) {
            keys.push(key);
            const widget = this.widgets[key];
            modified = modified || (this.moveSpaceUp(this._buffers.base, widget).size > 0);
        }
        if (modified) {
            this.dragboard.update(keys);
        }
        this.initialized = true;
        return modified;
    };

    const origMoveSpaceUp = layout.moveSpaceUp;
    let moveUpCalls = [];
    layout.moveSpaceUp = function (buffer, widget) {
        moveUpCalls.push(widget.id);
        return new Set();
    };

    let updateKeys = null;
    layout.dragboard.update = (keys) => { updateKeys = keys; };

    const result = layout.initialize();

    assert.equal(result, false);
    assert.deepEqual(moveUpCalls, ['w1', 'w2']);
    assert.equal(updateKeys, null);

    layout.moveSpaceUp = origMoveSpaceUp;
    layout.initialize = origInit;
});

test('initialize - super returns true, no moveSpaceUp changes', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 4, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 3, 0, 3, 2);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();

    // w1 has width 3 at position.x=3 in 4-column layout, so width + x = 6 > 4
    // -> super.initialize will push to iWidgetsToReinsert, returning true
    layout.initialized = false;

    // Mock moveSpaceUp to return empty Set
    const origMoveSpaceUp = layout.moveSpaceUp;
    layout.moveSpaceUp = () => new Set();

    let updateKeys = null;
    layout.dragboard.update = (keys) => { updateKeys = keys; };

    const result = layout.initialize();

    assert.equal(result, true);
    assert.deepEqual(updateKeys, ['w1']);

    layout.moveSpaceUp = origMoveSpaceUp;
});

// ============================================================================
// _insertAt
// ============================================================================

test('_insertAt - calls parent _insertAt and moves space up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const buffer = layout._buffers.base;

    // Mock parent _insertAt to return a known set
    const origParentInsertAt = Wirecloud.ui.ColumnLayout.prototype._insertAt;
    Wirecloud.ui.ColumnLayout.prototype._insertAt = function (widget, x, y, buf) {
        const s = new Set();
        s.add('existingWidget');
        return s;
    };

    // Mock moveSpaceUp to return another set
    const origMoveSpaceUp = layout.moveSpaceUp;
    layout.moveSpaceUp = () => {
        const s = new Set();
        s.add('w1');
        s.add('extraWidget');
        return s;
    };

    const result = layout._insertAt(w1, 0, 0, buffer);

    assert.equal(result.size, 3);
    assert.ok(result.has('existingWidget'));
    assert.ok(result.has('w1'));
    assert.ok(result.has('extraWidget'));

    layout.moveSpaceUp = origMoveSpaceUp;
    Wirecloud.ui.ColumnLayout.prototype._insertAt = origParentInsertAt;
});

test('_insertAt - parent returns empty, moveSpaceUp returns empty', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const buffer = layout._buffers.base;

    const origParentInsertAt = Wirecloud.ui.ColumnLayout.prototype._insertAt;
    Wirecloud.ui.ColumnLayout.prototype._insertAt = () => new Set();

    const origMoveSpaceUp = layout.moveSpaceUp;
    layout.moveSpaceUp = () => new Set();

    const result = layout._insertAt(w1, 0, 0, buffer);

    assert.equal(result.size, 0);

    layout.moveSpaceUp = origMoveSpaceUp;
    Wirecloud.ui.ColumnLayout.prototype._insertAt = origParentInsertAt;
});

// ============================================================================
// _removeFromMatrix
// ============================================================================

test('_removeFromMatrix - no widgets below', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const buffer = layout._buffers.base;

    // Ensure matrix has empty cells below w1
    fillMatrix(layout, w1);

    // Mock moveSpaceUp (should not be called)
    let moveUpCalled = false;
    const origMoveSpaceUp = layout.moveSpaceUp;
    layout.moveSpaceUp = () => { moveUpCalled = true; return new Set(); };

    const result = layout._removeFromMatrix(buffer, w1);

    assert.equal(result.size, 0);
    assert.equal(moveUpCalled, false);

    layout.moveSpaceUp = origMoveSpaceUp;
});

test('_removeFromMatrix - widgets below moved up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const w2 = createMockWidget('w2', 0, 2, 1, 2);
    const buffer = layout._buffers.base;

    // Place w1 at (0,0) size 2x2 and w2 below at (0,2) size 1x2
    fillMatrix(layout, w1);
    fillMatrix(layout, w2);

    // Mock moveSpaceUp to return set with w2
    const origMoveSpaceUp = layout.moveSpaceUp;
    let moveUpCalls = [];
    layout.moveSpaceUp = (buf, widget) => {
        moveUpCalls.push(widget.id);
        const s = new Set();
        s.add(widget.id);
        return s;
    };

    const result = layout._removeFromMatrix(buffer, w1);

    assert.equal(result.size, 1);
    assert.ok(result.has('w2'));
    assert.deepEqual(moveUpCalls, ['w2']);

    layout.moveSpaceUp = origMoveSpaceUp;
});

test('_removeFromMatrix - deduplicates same widget below multiple columns', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 3, 2);
    const w2 = createMockWidget('w2', 0, 2, 2, 2);
    const buffer = layout._buffers.base;

    fillMatrix(layout, w1);
    fillMatrix(layout, w2);

    // moveSpaceUp called only once for w2 (visitedwidgets dedup)
    const origMoveSpaceUp = layout.moveSpaceUp;
    let moveUpCallCount = 0;
    layout.moveSpaceUp = () => {
        moveUpCallCount++;
        const s = new Set();
        s.add('w2');
        return s;
    };

    const result = layout._removeFromMatrix(buffer, w1);

    assert.equal(result.size, 1);
    assert.ok(result.has('w2'));
    // w1 has width 3, w2 occupies columns 0,1. Visitedwidgets dedup means only 1 call.
    assert.equal(moveUpCallCount, 1);

    layout.moveSpaceUp = origMoveSpaceUp;
});

test('_removeFromMatrix - null entries below (skip)', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 10, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 0, 0, 2, 2);
    const buffer = layout._buffers.base;

    // Place w1 at (0,0) but leave gaps in columns below
    fillMatrix(layout, w1);

    // No widgets below, all matrix[x][edgeY] should be null/undefined
    const origMoveSpaceUp = layout.moveSpaceUp;
    let moveUpCalled = false;
    layout.moveSpaceUp = () => { moveUpCalled = true; return new Set(); };

    const result = layout._removeFromMatrix(buffer, w1);

    assert.equal(result.size, 0);
    assert.equal(moveUpCalled, false);

    layout.moveSpaceUp = origMoveSpaceUp;
});

// ============================================================================
// _notifyResizeEvent
// ============================================================================

// ---- Width expansion, resize right (resizeLeftSide=false) ----

test('_notifyResizeEvent - width expand right, no collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 3);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    // Set up matrix with w1
    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    // Mock all side-effect methods
    const origMoveDown = layout.moveSpaceDown;
    const origReserve2 = layout._reserveSpace2;
    const origNotifyWindow = layout._notifyWindowResizeEvent;
    const origMoveUp = layout.moveSpaceUp;

    let moveDownCalls = [];
    let reserve2Calls = [];
    let notifyCalled = false;
    let updateCalled = false;

    layout.moveSpaceDown = (...args) => { moveDownCalls.push(args); return new Set(); };
    layout._reserveSpace2 = (...args) => { reserve2Calls.push(args); };
    layout._notifyWindowResizeEvent = () => { notifyCalled = true; };
    layout.moveSpaceUp = () => { const s = new Set(); s.add('w1'); return s; };
    layout.dragboard.update = () => { updateCalled = true; };

    // Expand right: old=2x3, new=4x3, persist=true
    layout._notifyResizeEvent(w1, 2, 3, 4, 3, false, false, true);

    // No collisions expected (nothing in columns 4-5 at rows 3-5)
    assert.equal(moveDownCalls.length, 0);
    // reserveSpace2 called for the new right columns: position(2+2, 3) size (2, 3)
    assert.equal(reserve2Calls.length, 1);
    assert.deepEqual(reserve2Calls[0].slice(1), [w1, 4, 3, 2, 3]);
    assert.equal(notifyCalled, true);
    assert.equal(updateCalled, true);

    layout.moveSpaceDown = origMoveDown;
    layout._reserveSpace2 = origReserve2;
    layout._notifyWindowResizeEvent = origNotifyWindow;
    layout.moveSpaceUp = origMoveUp;
});

test('_notifyResizeEvent - width expand right, with collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 3);
    const w2 = createMockWidget('w2', 4, 4, 1, 2);
    layout.widgets = { w1, w2 };
    layout.iWidgets = { w1, w2 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);
    // Place w2 at matrix[4][4] and matrix[4][5] (covers x=4, y=4-5)
    fillMatrix(layout, w2);

    const origMoveDown = layout.moveSpaceDown;
    const origReserve2 = layout._reserveSpace2;
    const origNotifyWindow = layout._notifyWindowResizeEvent;
    const origMoveUp = layout.moveSpaceUp;

    let moveDownCalls = [];
    let reserve2Calls = [];

    layout.moveSpaceDown = (buffer, widget, offset) => {
        moveDownCalls.push({ widget: widget.id, offset });
        return new Set();
    };
    layout._reserveSpace2 = (...args) => { reserve2Calls.push(args); };
    layout._notifyWindowResizeEvent = () => {};
    layout.moveSpaceUp = () => new Set();
    layout.dragboard.update = () => {};

    // Expand right: old=2x3, new=4x3. Column 4 at row 4 has w2.
    // finalYPos = 3 + 3 = 6. w2.position.y = 4. offset = 6 - 4 = 2
    layout._notifyResizeEvent(w1, 2, 3, 4, 3, false, false, true);

    assert.equal(moveDownCalls.length, 1);
    assert.equal(moveDownCalls[0].widget, 'w2');
    assert.equal(moveDownCalls[0].offset, 2);
    assert.equal(reserve2Calls.length, 1);

    layout.moveSpaceDown = origMoveDown;
    layout._reserveSpace2 = origReserve2;
    layout._notifyWindowResizeEvent = origNotifyWindow;
    layout.moveSpaceUp = origMoveUp;
});

// ---- Width expansion, resize left (resizeLeftSide=true) ----

test('_notifyResizeEvent - width expand left, no collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 5, 3, 2, 3);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    const origMoveDown = layout.moveSpaceDown;
    const origReserve2 = layout._reserveSpace2;
    const origMoveUp = layout.moveSpaceUp;

    let moveDownCalls = [];
    let reserve2Calls = [];
    let setPositionCalled = false;
    const origSetPosition = w1.setPosition;
    w1.setPosition = (pos) => { setPositionCalled = true; origSetPosition(pos); };

    layout.moveSpaceDown = (...args) => { moveDownCalls.push(args); return new Set(); };
    layout._reserveSpace2 = (...args) => { reserve2Calls.push(args); };
    layout._notifyWindowResizeEvent = () => {};
    layout.moveSpaceUp = () => new Set();
    layout.dragboard.update = () => {};

    // Expand left: old=2x3, new=4x3. Expand left by 2 columns.
    layout._notifyResizeEvent(w1, 2, 3, 4, 3, true, false, true);

    assert.equal(moveDownCalls.length, 0);
    assert.equal(reserve2Calls.length, 1);
    // Should reserve at (x=3, y=3) size (2, 3) after moving left
    // position goes from 5 to 3 (x -= 2)
    assert.deepEqual(reserve2Calls[0].slice(1), [w1, 3, 3, 2, 3]);
    assert.equal(setPositionCalled, true);
    assert.equal(w1.position.x, 3);

    w1.setPosition = origSetPosition;
    layout.moveSpaceDown = origMoveDown;
    layout._reserveSpace2 = origReserve2;
    layout.moveSpaceUp = origMoveUp;
});

test('_notifyResizeEvent - width expand left, with collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 5, 3, 2, 3);
    const w2 = createMockWidget('w2', 4, 4, 1, 2);
    layout.widgets = { w1, w2 };
    layout.iWidgets = { w1, w2 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);
    fillMatrix(layout, w2);

    const origMoveDown = layout.moveSpaceDown;
    const origReserve2 = layout._reserveSpace2;
    const origMoveUp = layout.moveSpaceUp;

    let moveDownCalls = [];

    layout.moveSpaceDown = (buffer, widget, offset) => {
        moveDownCalls.push({ widget: widget.id, offset });
        return new Set();
    };
    layout._reserveSpace2 = () => {};
    layout._notifyWindowResizeEvent = () => {};
    layout.moveSpaceUp = () => new Set();
    layout.dragboard.update = () => {};

    // Expand left: old=2x3, new=4x3. widthDiff=2.
    // Loops x from 3 to 4 (5-2 to 5-1). y from 0 to 2.
    // matrix[4][3+0]=matrix[4][3]=w2? w2 at (4,4) so matrix[4][3] is null.
    // matrix[4][3+1]=matrix[4][4]=w2. Move it down.
    layout._notifyResizeEvent(w1, 2, 3, 4, 3, true, false, true);

    assert.equal(moveDownCalls.length, 1);
    assert.equal(moveDownCalls[0].widget, 'w2');
    // finalYPos = 3 + 3 = 6, w2.position.y = 4, offset = 6 - 4 = 2

    layout.moveSpaceDown = origMoveDown;
    layout._reserveSpace2 = origReserve2;
    layout.moveSpaceUp = origMoveUp;
});

// ---- Width reduction, resize left (resizeLeftSide=true) ----

test('_notifyResizeEvent - width shrink left, with widgets to move up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 4, 3);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    // Need a widget below the cleared area to move up
    const w2 = createMockWidget('w2', 2, 6, 1, 2);
    layout.widgets.w2 = w2;
    layout.iWidgets.w2 = w2;

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);
    fillMatrix(layout, w2);

    const origClear2 = layout._clearSpace2;
    const origMoveUp = layout.moveSpaceUp;

    let clear2Calls = [];
    let moveUpCalls = [];

    layout._clearSpace2 = (...args) => { clear2Calls.push(args); };
    layout.moveSpaceUp = (buffer, widget) => {
        moveUpCalls.push(widget.id);
        return new Set();
    };
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => {};

    // Shrink left: old=4x3, new=2x3. widthDiff=2.
    layout._notifyResizeEvent(w1, 4, 3, 2, 3, true, false, false);

    assert.equal(clear2Calls.length, 1);
    assert.deepEqual(clear2Calls[0].slice(1), [2, 3, 2, 3]);
    // y = 3 + 3 = 6, limitX = 2 + 2 = 4. Loops x = 2,3. matrix[2][6] = w2.
    assert.equal(moveUpCalls.length, 1);
    assert.equal(moveUpCalls[0], 'w2');
    // Position moved: x += 2 (from 2 to 4)
    assert.equal(w1.position.x, 4);

    layout._clearSpace2 = origClear2;
    layout.moveSpaceUp = origMoveUp;
});

test('_notifyResizeEvent - width shrink left, no widgets to move up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 4, 3);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    const origMoveUp = layout.moveSpaceUp;
    let moveUpCalled = false;
    layout.moveSpaceUp = () => { moveUpCalled = true; return new Set(); };
    layout._clearSpace2 = () => {};
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => {};

    // Shrink left: old=4x3, new=2x3.
    layout._notifyResizeEvent(w1, 4, 3, 2, 3, true, false, false);

    // y = 6, no widgets at matrix[2][6], [3][6] -> moveUp not called
    assert.equal(moveUpCalled, false);
    assert.equal(w1.position.x, 4);

    layout.moveSpaceUp = origMoveUp;
});

// ---- Width reduction, resize right (resizeLeftSide=false) ----

test('_notifyResizeEvent - width shrink right, with widgets to move up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 4, 3);
    const w2 = createMockWidget('w2', 4, 6, 1, 2);
    layout.widgets = { w1, w2 };
    layout.iWidgets = { w1, w2 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);
    fillMatrix(layout, w2);

    const origClear2 = layout._clearSpace2;
    const origMoveUp = layout.moveSpaceUp;

    let clear2Calls = [];
    let moveUpCalls = [];

    layout._clearSpace2 = (...args) => { clear2Calls.push(args); };
    layout.moveSpaceUp = (buffer, widget) => {
        moveUpCalls.push(widget.id);
        return new Set();
    };
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => {};

    // Shrink right: old=4x3, new=2x3. widthDiff=2.
    layout._notifyResizeEvent(w1, 4, 3, 2, 3, false, false, false);

    assert.equal(clear2Calls.length, 1);
    // Clear right: at (2+2=4, 3) size (2, 3)
    assert.deepEqual(clear2Calls[0].slice(1), [4, 3, 2, 3]);
    // y = 6, limitX = 2+4 = 6. Loops x=4,5. matrix[4][6] has w2.
    assert.equal(moveUpCalls.length, 1);
    assert.equal(moveUpCalls[0], 'w2');

    layout._clearSpace2 = origClear2;
    layout.moveSpaceUp = origMoveUp;
});

test('_notifyResizeEvent - width shrink right, no widgets to move up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 4, 3);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    const origMoveUp = layout.moveSpaceUp;
    let moveUpCalled = false;
    layout.moveSpaceUp = () => { moveUpCalled = true; return new Set(); };
    layout._clearSpace2 = () => {};
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => {};

    // Shrink right: old=4x3, new=2x3.
    layout._notifyResizeEvent(w1, 4, 3, 2, 3, false, false, false);

    assert.equal(moveUpCalled, false);

    layout.moveSpaceUp = origMoveUp;
});

// ---- Height expansion (newHeight > oldHeight) ----

test('_notifyResizeEvent - no width change, height expand, no collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 2);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    const origMoveDown = layout.moveSpaceDown;
    const origReserve2 = layout._reserveSpace2;

    let moveDownCalls = [];
    let reserve2Calls = [];

    layout.moveSpaceDown = (...args) => { moveDownCalls.push(args); return new Set(); };
    layout._reserveSpace2 = (...args) => { reserve2Calls.push(args); };
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => {};

    // Expand down: old=2x2, new=2x4. Same width.
    layout._notifyResizeEvent(w1, 2, 2, 2, 4, false, false, false);

    assert.equal(moveDownCalls.length, 0);
    assert.equal(reserve2Calls.length, 1);
    // Reserve at (2, 3+2=5) size (2, 2)
    assert.deepEqual(reserve2Calls[0].slice(1), [w1, 2, 5, 2, 2]);

    layout.moveSpaceDown = origMoveDown;
    layout._reserveSpace2 = origReserve2;
});

test('_notifyResizeEvent - width expand right, height expand, with collisions', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 2);
    // Widget below the expanded area
    const w2 = createMockWidget('w2', 2, 6, 1, 2);
    layout.widgets = { w1, w2 };
    layout.iWidgets = { w1, w2 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);
    fillMatrix(layout, w2);

    const origMoveDown = layout.moveSpaceDown;

    let moveDownCalls = [];

    layout.moveSpaceDown = (buffer, widget, offset) => {
        moveDownCalls.push({ widget: widget.id, offset });
        return new Set();
    };
    layout._reserveSpace2 = () => {};
    layout._notifyWindowResizeEvent = () => {};
    layout.moveSpaceUp = () => new Set();
    layout.dragboard.update = () => {};

    // Expand down: old=2x2, new=2x4. step2X=2, step2Width=2.
    // limitY = 7, limitX = 4. Loops y=5,6 (oldHeight=2 so from 3+2=5 to 7-1=6).
    // matrix[2][6] = w2 -> moveDown with offset 7-6=1.
    layout._notifyResizeEvent(w1, 2, 2, 2, 4, false, false, false);

    assert.equal(moveDownCalls.length, 1);
    assert.equal(moveDownCalls[0].widget, 'w2');
    assert.equal(moveDownCalls[0].offset, 1);

    layout.moveSpaceDown = origMoveDown;
});

// ---- Height reduction (newHeight < oldHeight) ----

test('_notifyResizeEvent - no width change, height shrink, with widgets to move up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 4);
    const w2 = createMockWidget('w2', 2, 7, 1, 2);
    layout.widgets = { w1, w2 };
    layout.iWidgets = { w1, w2 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);
    fillMatrix(layout, w2);

    const origClear2 = layout._clearSpace2;
    const origMoveUp = layout.moveSpaceUp;

    let clear2Calls = [];
    let moveUpCalls = [];

    layout._clearSpace2 = (...args) => { clear2Calls.push(args); };
    layout.moveSpaceUp = (buffer, widget) => {
        moveUpCalls.push(widget.id);
        return new Set();
    };
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => {};

    // Shrink down: old=2x4, new=2x2. step2X=2, step2Width=2.
    layout._notifyResizeEvent(w1, 2, 4, 2, 2, false, false, false);

    assert.equal(clear2Calls.length, 1);
    // Clear at (2, 3+2=5) size (2, 2)
    assert.deepEqual(clear2Calls[0].slice(1), [2, 5, 2, 2]);
    // y = 7, limitX = 4. Loops x=2,3. matrix[2][7] has w2.
    assert.equal(moveUpCalls.length, 1);
    assert.equal(moveUpCalls[0], 'w2');

    layout._clearSpace2 = origClear2;
    layout.moveSpaceUp = origMoveUp;
});

test('_notifyResizeEvent - height shrink, no widgets to move up', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 4);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    const origMoveUp = layout.moveSpaceUp;
    let moveUpCalled = false;
    layout.moveSpaceUp = () => { moveUpCalled = true; return new Set(); };
    layout._clearSpace2 = () => {};
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => {};

    // Shrink down: old=2x4, new=2x2.
    layout._notifyResizeEvent(w1, 2, 4, 2, 2, false, false, false);

    assert.equal(moveUpCalled, false);

    layout.moveSpaceUp = origMoveUp;
});

// ---- No dimension changes ----

test('_notifyResizeEvent - no width change, no height change', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 2);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    let notifyCalled = false;
    let updateCalled = false;
    let moveUpCalled = false;

    layout._notifyWindowResizeEvent = () => { notifyCalled = true; };
    layout.dragboard.update = () => { updateCalled = true; };
    layout.moveSpaceUp = () => { moveUpCalled = true; return new Set(); };

    // No change: same width and height, persist=true
    layout._notifyResizeEvent(w1, 2, 2, 2, 2, false, false, true);

    // _notifyWindowResizeEvent always called
    assert.equal(notifyCalled, true);
    // persist=true triggers moveSpaceUp and dragboard.update
    assert.equal(moveUpCalled, true);
    assert.equal(updateCalled, true);
});

// ---- persist = false ----

test('_notifyResizeEvent - persist false skips save', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 2);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    let notifyCalled = false;
    let updateCalled = false;
    let moveUpCalled = false;

    layout._notifyWindowResizeEvent = () => { notifyCalled = true; };
    layout.dragboard.update = () => { updateCalled = true; };
    layout.moveSpaceUp = () => { moveUpCalled = true; return new Set(); };

    // persist=false
    layout._notifyResizeEvent(w1, 2, 2, 2, 2, false, false, false);

    assert.equal(notifyCalled, true);
    assert.equal(moveUpCalled, false);
    assert.equal(updateCalled, false);
});

// ---- Combined width and height changes ----

test('_notifyResizeEvent - width expand right, height shrink, persist=true', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 2, 4);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    const origReserve2 = layout._reserveSpace2;
    const origClear2 = layout._clearSpace2;

    let reserve2Calls = [];
    let clear2Calls = [];
    let updateCalled = false;

    layout._reserveSpace2 = (...args) => { reserve2Calls.push(args); };
    layout.moveSpaceDown = () => new Set();
    layout._clearSpace2 = (...args) => { clear2Calls.push(args); };
    layout.moveSpaceUp = () => new Set();
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => { updateCalled = true; };

    // Width: 2->4 (expand right), height: 4->2 (shrink), persist=true
    // step2Width stays at oldWidth=2 (width expanded in step1)
    layout._notifyResizeEvent(w1, 2, 4, 4, 2, false, false, true);

    // Step 1: reserve right columns at (4, 3) size (2, 2) (uses newHeight=2)
    assert.equal(reserve2Calls.length, 1);
    assert.deepEqual(reserve2Calls[0].slice(1), [w1, 4, 3, 2, 2]);
    // Step 2: shrink height. step2X=2, step2Width=2. Clear at (2, 5) size (2, 2)
    assert.equal(clear2Calls.length, 1);
    assert.deepEqual(clear2Calls[0].slice(1), [2, 5, 2, 2]);
    // persist
    assert.equal(updateCalled, true);

    layout._reserveSpace2 = origReserve2;
    layout._clearSpace2 = origClear2;
});

// ---- Width shrink left, height expand, interactions ----

test('_notifyResizeEvent - width shrink left, height expand', () => {
    const db = createDragboard();
    const layout = new Wirecloud.ui.SmartColumnLayout(db, 20, 30, 10, 20, 17);

    const w1 = createMockWidget('w1', 2, 3, 4, 2);
    layout.widgets = { w1 };
    layout.iWidgets = { w1 };

    layout._clearMatrix();
    layout._reserveSpace(layout._buffers.base, w1);

    const origClear2 = layout._clearSpace2;
    const origReserve2 = layout._reserveSpace2;

    let clear2Calls = [];
    let reserve2Calls = [];
    let setPosCalled = false;
    const origSetPos = w1.setPosition;
    w1.setPosition = (pos) => { setPosCalled = true; origSetPos(pos); };

    layout._clearSpace2 = (...args) => { clear2Calls.push(args); };
    layout._reserveSpace2 = (...args) => { reserve2Calls.push(args); };
    layout.moveSpaceDown = () => new Set();
    layout.moveSpaceUp = () => new Set();
    layout._notifyWindowResizeEvent = () => {};
    layout.dragboard.update = () => {};

    // Width: 4->2 (shrink left), height: 2->4 (expand)
    layout._notifyResizeEvent(w1, 4, 2, 2, 4, true, false, false);

    // Step 1: shrink width. step2Width=newWidth=2. Clear at (2,3) size (2,2).
    assert.equal(clear2Calls.length, 1);
    assert.deepEqual(clear2Calls[0].slice(1), [2, 3, 2, 2]);
    assert.equal(setPosCalled, true);
    assert.equal(w1.position.x, 4);
    // step2X = position.x = 4 (after move)

    // Step 2: expand height. step2Width=2, step2X=4. Reserve at (4, 5) size (2, 2).
    assert.equal(reserve2Calls.length, 1);
    assert.deepEqual(reserve2Calls[0].slice(1), [w1, 4, 5, 2, 2]);

    w1.setPosition = origSetPos;
    layout._clearSpace2 = origClear2;
    layout._reserveSpace2 = origReserve2;
});
