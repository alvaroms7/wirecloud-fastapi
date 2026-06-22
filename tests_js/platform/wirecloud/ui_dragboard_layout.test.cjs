const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const createDragboard = (overrides = {}) => Object.assign({
    getWidth: () => 800,
    getHeight: () => 600,
    _addWidget: () => {},
    _removeWidget: () => {},
    update: () => {},
}, overrides);

const createMockWidget = (id = 'w1', overrides = {}) => {
    const element = document.createElement('section');
    return Object.assign({
        id,
        element,
        position: { x: 0, y: 0 },
        shape: { width: 3, height: 4 },
        setShape: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        repaint: () => {},
        layout: null,
        minimized: false,
        moveToLayout: () => {},
    }, overrides);
};

const HCELL = 20;
const VCELL = 20;

const createLayout = (dragboard) => {
    const layout = new Wirecloud.ui.DragboardLayout(dragboard);
    layout.fromPixelsToHCells = (pixels) => Math.ceil(pixels / HCELL);
    layout.fromPixelsToVCells = (pixels) => Math.ceil(pixels / VCELL);
    layout.getWidthInPixels = (cells) => cells * HCELL;
    layout.getHeightInPixels = (cells) => cells * VCELL;
    layout.getColumnOffset = (pos) => pos.x * HCELL;
    layout.getRowOffset = (pos) => pos.y * VCELL;
    return layout;
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = Wirecloud.ui || {};

    Wirecloud.ui.MultiValuedSize = class MultiValuedSize {
        constructor(inPixels, inLU) { this.inPixels = inPixels; this.inLU = inLU; }
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/DragboardLayout.js');
});

// ============================================================================
// CONSTRUCTOR
// ============================================================================

test('constructor stores dragboard and initialises widgets', () => {
    const db = createDragboard();
    const layout = createLayout(db);

    assert.equal(layout.dragboard, db);
    assert.deepEqual(layout.widgets, {});
    assert.ok(typeof layout._on_remove_widget_bound === 'function');
});

test('constructor widget registry starts empty', () => {
    const layout = createLayout(createDragboard());
    assert.equal(Object.keys(layout.widgets).length, 0);
});

// ============================================================================
// _notifyWindowResizeEvent
// ============================================================================

test('_notifyWindowResizeEvent repaints all widgets when width changed', () => {
    const layout = createLayout(createDragboard());
    const calls = [];
    const w1 = createMockWidget('w1', { repaint: () => calls.push('w1') });
    const w2 = createMockWidget('w2', { repaint: () => calls.push('w2') });
    layout.widgets = { w1, w2 };

    layout._notifyWindowResizeEvent(true, false);

    assert.deepEqual(calls, ['w1', 'w2']);
});

test('_notifyWindowResizeEvent repaints all widgets when height changed', () => {
    const layout = createLayout(createDragboard());
    const calls = [];
    const w1 = createMockWidget('w1', { repaint: () => calls.push('w1') });
    layout.widgets = { w1 };

    layout._notifyWindowResizeEvent(false, true);

    assert.deepEqual(calls, ['w1']);
});

test('_notifyWindowResizeEvent repaints when both changed', () => {
    const layout = createLayout(createDragboard());
    const calls = [];
    const w1 = createMockWidget('w1', { repaint: () => calls.push('w1') });
    layout.widgets = { w1 };

    layout._notifyWindowResizeEvent(true, true);

    assert.deepEqual(calls, ['w1']);
});

test('_notifyWindowResizeEvent skips repaint when neither changed', () => {
    const layout = createLayout(createDragboard());
    let called = false;
    const w1 = createMockWidget('w1', { repaint: () => { called = true; } });
    layout.widgets = { w1 };

    layout._notifyWindowResizeEvent(false, false);

    assert.equal(called, false);
});

test('_notifyWindowResizeEvent with no widgets does not throw', () => {
    const layout = createLayout(createDragboard());
    assert.doesNotThrow(() => layout._notifyWindowResizeEvent(true, false));
});

// ============================================================================
// _notifyResizeEvent (empty, no-op stubs on base)
// ============================================================================

test('_notifyResizeEvent is a no-op', () => {
    const layout = createLayout(createDragboard());
    assert.doesNotThrow(() => layout._notifyResizeEvent(null, 0, 0, 0, 0, false, false, false));
    assert.equal(layout._notifyResizeEvent(), undefined);
});

// ============================================================================
// parseSize
// ============================================================================

test('parseSize with number returns cells', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize(42);
    assert.deepEqual(result, [42, 'cells']);
});

test('parseSize with integer string returns cells', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize('5');
    assert.deepEqual(result, [5, 'cells']);
});

test('parseSize with decimal string returns cells', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize('3.14');
    assert.deepEqual(result, [3.14, 'cells']);
});

test('parseSize with negative number', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize('-5');
    assert.deepEqual(result, [-5, 'cells']);
});

test('parseSize with px unit returns px', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize('100px');
    assert.deepEqual(result, [100, 'px']);
});

test('parseSize with percent unit returns %', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize('50%');
    assert.deepEqual(result, [50, '%']);
});

test('parseSize trims whitespace', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize('  10  ');
    assert.deepEqual(result, [10, 'cells']);
});

test('parseSize trims whitespace with unit', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize('  20px  ');
    assert.deepEqual(result, [20, 'px']);
});

test('parseSize throws TypeError for object', () => {
    const layout = createLayout(createDragboard());
    assert.throws(() => layout.parseSize({}), TypeError);
});

test('parseSize throws TypeError for array', () => {
    const layout = createLayout(createDragboard());
    assert.throws(() => layout.parseSize([1, 2]), TypeError);
});

test('parseSize throws TypeError for boolean', () => {
    const layout = createLayout(createDragboard());
    assert.throws(() => layout.parseSize(true), TypeError);
});

test('parseSize with decimal px', () => {
    const layout = createLayout(createDragboard());
    const result = layout.parseSize('1.5px');
    assert.deepEqual(result, [1.5, 'px']);
});

// ============================================================================
// adaptColumnOffset (abstract — throws)
// ============================================================================

test('adaptColumnOffset throws not-implemented error', () => {
    const layout = createLayout(createDragboard());
    // Delete overridden method to test base class version
    delete layout.adaptColumnOffset;
    assert.throws(() => layout.adaptColumnOffset(100), Error);
    assert.throws(() => layout.adaptColumnOffset(100), /adaptColumnOffset/);
});

test('adaptColumnOffset error message contains method name', () => {
    const layout = createLayout(createDragboard());
    delete layout.adaptColumnOffset;
    try {
        layout.adaptColumnOffset(42);
        assert.fail('Expected error');
    } catch (e) {
        assert.ok(e.message.includes('adaptColumnOffset'));
    }
});

// ============================================================================
// adaptRowOffset (abstract — throws)
// ============================================================================

test('adaptRowOffset throws not-implemented error', () => {
    const layout = createLayout(createDragboard());
    delete layout.adaptRowOffset;
    assert.throws(() => layout.adaptRowOffset(100), Error);
    assert.throws(() => layout.adaptRowOffset(100), /adaptRowOffset/);
});

test('adaptRowOffset error message contains method name', () => {
    const layout = createLayout(createDragboard());
    delete layout.adaptRowOffset;
    try {
        layout.adaptRowOffset(99);
        assert.fail('Expected error');
    } catch (e) {
        assert.ok(e.message.includes('adaptRowOffset'));
    }
});

// ============================================================================
// adaptHeight
// ============================================================================

test('adaptHeight with cells returns MultiValuedSize', () => {
    const layout = createLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.adaptHeight(5);
    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 5);
    assert.equal(result.inPixels, 100);
});

test('adaptHeight with cells rounds down', () => {
    const layout = createLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.adaptHeight(3.2);
    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 3); // floor
    assert.equal(result.inPixels, 60);
});

test('adaptHeight with cells rounds up', () => {
    const layout = createLayout(createDragboard({ getHeight: () => 600 }));
    const result = layout.adaptHeight(3.7);
    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 4);
    assert.equal(result.inPixels, 80);
});

test('adaptHeight with percent converts via getHeight', () => {
    const layout = createLayout(createDragboard({ getHeight: () => 500 }));
    const result = layout.adaptHeight('50%');
    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 13); // ceil(250 / 20) = 13
    assert.equal(result.inPixels, 260);
});

test('adaptHeight with px converts via padHeight', () => {
    const layout = createLayout(createDragboard({ getHeight: () => 500 }));
    const result = layout.adaptHeight('60px');
    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 3); // ceil(60 / 20) = 3
    assert.equal(result.inPixels, 60);
});

test('adaptHeight enforces minimum of 1 cell', () => {
    const layout = createLayout(createDragboard({ getHeight: () => 500 }));
    const result = layout.adaptHeight(0);
    assert.equal(result.inLU, 1);
});

test('adaptHeight with 100% returns full-height cells', () => {
    const layout = createLayout(createDragboard({ getHeight: () => 400 }));
    const result = layout.adaptHeight('100%');
    assert.equal(result.inLU, 20); // 400/20 = 20
    assert.equal(result.inPixels, 400);
});

test('adaptHeight with small percent still returns >= 1 cell', () => {
    const layout = createLayout(createDragboard({ getHeight: () => 10 }));
    const result = layout.adaptHeight('1%');
    assert.equal(result.inLU, 1);
});

// ============================================================================
// adaptWidth
// ============================================================================

test('adaptWidth with cells returns MultiValuedSize', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.adaptWidth(5);
    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 5);
    assert.equal(result.inPixels, 100);
});

test('adaptWidth with cells rounds', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.adaptWidth(3.6);
    assert.equal(result.inLU, 4);
    assert.equal(result.inPixels, 80);
});

test('adaptWidth with percent uses explicit width', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.adaptWidth('50%', 400);
    assert.ok(result instanceof Wirecloud.ui.MultiValuedSize);
    assert.equal(result.inLU, 10); // ceil(200/20) = 10
    assert.equal(result.inPixels, 200);
});

test('adaptWidth with percent falls back to getWidth when width undefined', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 600 }));
    const result = layout.adaptWidth('10%');
    assert.equal(result.inLU, 3); // ceil(60/20) = 3
    assert.equal(result.inPixels, 60);
});

test('adaptWidth with percent uses getWidth when width is null', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 600 }));
    const result = layout.adaptWidth('20%', null);
    assert.equal(result.inLU, 6); // ceil(120/20) = 6
    assert.equal(result.inPixels, 120);
});

test('adaptWidth with px uses padWidth', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.adaptWidth('80px');
    assert.equal(result.inLU, 4); // ceil(80/20) = 4
    assert.equal(result.inPixels, 80);
});

test('adaptWidth enforces minimum of 1 cell', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.adaptWidth(0);
    assert.equal(result.inLU, 1);
});

test('adaptWidth with string number uses cells', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.adaptWidth('7');
    assert.equal(result.inLU, 7);
    assert.equal(result.inPixels, 140);
});

test('adaptWidth parseSize result with cells treats value as LU directly', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    const result = layout.adaptWidth(10);
    assert.equal(result.inLU, 10);
    assert.equal(result.inPixels, 200);
});

// ============================================================================
// updatePosition
// ============================================================================

test('updatePosition sets element position from widget position', () => {
    const layout = createLayout(createDragboard());
    const widget = createMockWidget('w1', { position: { x: 3, y: 5 } });
    const element = document.createElement('div');

    layout.updatePosition(widget, element);

    assert.equal(element.style.left, '60px'); // 3 * 20
    assert.equal(element.style.top, '100px'); // 5 * 20
    assert.equal(element.style.bottom, '');
    assert.equal(element.style.right, '');
});

test('updatePosition with position 0,0', () => {
    const layout = createLayout(createDragboard());
    const widget = createMockWidget('w1', { position: { x: 0, y: 0 } });
    const element = document.createElement('div');

    layout.updatePosition(widget, element);

    assert.equal(element.style.left, '0px');
    assert.equal(element.style.top, '0px');
    assert.equal(element.style.bottom, '');
    assert.equal(element.style.right, '');
});

// ============================================================================
// updateShape
// ============================================================================

test('updateShape sets element width and height from widget shape', () => {
    const layout = createLayout(createDragboard());
    const widget = createMockWidget('w1', { shape: { width: 4, height: 3 }, minimized: false });
    const element = document.createElement('div');

    layout.updateShape(widget, element);

    assert.equal(element.style.width, '80px'); // 4 * 20
    assert.equal(element.style.height, '60px'); // 3 * 20
});

test('updateShape with null width clears width style', () => {
    // Override getWidthInPixels to return null
    const layout = createLayout(createDragboard());
    layout.getWidthInPixels = () => null;
    const widget = createMockWidget('w1', { shape: { width: 4, height: 3 }, minimized: false });
    const element = document.createElement('div');
    element.style.width = '100px';

    layout.updateShape(widget, element);

    assert.equal(element.style.width, '');
});

test('updateShape with minimized widget does not set height', () => {
    const layout = createLayout(createDragboard());
    const widget = createMockWidget('w1', { shape: { width: 4, height: 3 }, minimized: true });
    const element = document.createElement('div');
    element.style.height = '50px';

    layout.updateShape(widget, element);

    assert.equal(element.style.width, '80px');
    assert.equal(element.style.height, '');
});

test('updateShape with zero width', () => {
    const layout = createLayout(createDragboard());
    const widget = createMockWidget('w1', { shape: { width: 0, height: 3 }, minimized: false });
    const element = document.createElement('div');

    layout.updateShape(widget, element);

    assert.equal(element.style.width, '0px');
    assert.equal(element.style.height, '60px');
});

test('updateShape with zero height (non-minimized)', () => {
    const layout = createLayout(createDragboard());
    const widget = createMockWidget('w1', { shape: { width: 4, height: 0 }, minimized: false });
    const element = document.createElement('div');

    layout.updateShape(widget, element);

    assert.equal(element.style.width, '80px');
    assert.equal(element.style.height, '0px');
});

// ============================================================================
// padWidth / padHeight
// ============================================================================

test('padWidth returns input unchanged', () => {
    const layout = createLayout(createDragboard());
    assert.equal(layout.padWidth(100), 100);
    assert.equal(layout.padWidth(0), 0);
    assert.equal(layout.padWidth(-1), -1);
});

test('padHeight returns input unchanged', () => {
    const layout = createLayout(createDragboard());
    assert.equal(layout.padHeight(200), 200);
    assert.equal(layout.padHeight(0), 0);
    assert.equal(layout.padHeight(-1), -1);
});

// ============================================================================
// isInside
// ============================================================================

test('isInside returns true for point inside dragboard', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    assert.equal(layout.isInside(0, 0), true);
    assert.equal(layout.isInside(400, 300), true);
    assert.equal(layout.isInside(799, 0), true);
});

test('isInside returns false for x < 0', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    assert.equal(layout.isInside(-1, 0), false);
    assert.equal(layout.isInside(-100, 500), false);
});

test('isInside returns false for x >= width', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    assert.equal(layout.isInside(800, 0), false);
    assert.equal(layout.isInside(1000, 0), false);
});

test('isInside returns false for y < 0', () => {
    const layout = createLayout(createDragboard({ getWidth: () => 800 }));
    assert.equal(layout.isInside(0, -1), false);
});

// ============================================================================
// getWidth / getHeight
// ============================================================================

test('getWidth delegates to dragboard', () => {
    const db = createDragboard({ getWidth: () => 1234 });
    const layout = createLayout(db);
    assert.equal(layout.getWidth(), 1234);
});

test('getHeight delegates to dragboard', () => {
    const db = createDragboard({ getHeight: () => 5678 });
    const layout = createLayout(db);
    assert.equal(layout.getHeight(), 5678);
});

// ============================================================================
// addWidget
// ============================================================================

test('addWidget registers widget, adds event listener, repaints', () => {
    const db = createDragboard();
    let dragboardAddCalled = false;
    db._addWidget = () => { dragboardAddCalled = true; };

    const layout = createLayout(db);
    const collection = [];
    const widget = createMockWidget('w1', {
        repaint: () => collection.push('repaint'),
        addEventListener: (type, fn) => collection.push('addEventListener'),
    });

    const result = layout.addWidget(widget, true);

    assert.equal(widget.layout, layout);
    assert.equal(layout.widgets['w1'], widget);
    assert.equal(dragboardAddCalled, true);
    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
    assert.deepEqual(collection, ['addEventListener', 'repaint']);
});

test('addWidget with affectsDragboard=false skips dragboard._addWidget', () => {
    const db = createDragboard();
    let dragboardAddCalled = false;
    db._addWidget = () => { dragboardAddCalled = true; };

    const layout = createLayout(db);
    const widget = createMockWidget('w1');

    layout.addWidget(widget, false);

    assert.equal(dragboardAddCalled, false);
});

test('addWidget throws when widget already has layout', () => {
    const layout = createLayout(createDragboard());
    const widget = createMockWidget('w1', { layout: {} });

    assert.throws(() => layout.addWidget(widget, false), Error);
});

test('addWidget returns new Set instance each call', () => {
    const layout = createLayout(createDragboard());
    const w1 = createMockWidget('w1');
    const w2 = createMockWidget('w2');

    const r1 = layout.addWidget(w1, false);
    const r2 = layout.addWidget(w2, false);

    assert.ok(r1 instanceof Set);
    assert.ok(r2 instanceof Set);
    assert.notStrictEqual(r1, r2);
});

// ============================================================================
// _adaptIWidget
// ============================================================================

test('_adaptIWidget calls ensureMinimalSize when element exists', () => {
    const layout = createLayout(createDragboard());
    const setShapeCalls = [];
    const widget = createMockWidget('w1', {
        element: document.createElement('section'),
        shape: { width: 1, height: 1 },
        setShape: (shape) => setShapeCalls.push(shape),
    });

    layout._adaptIWidget(widget);

    assert.equal(setShapeCalls.length, 1);
});

test('_adaptIWidget enlarges width when below minimum', () => {
    const layout = createLayout(createDragboard());
    const setShapeCalls = [];
    const widget = createMockWidget('w1', {
        element: document.createElement('section'),
        shape: { width: 1, height: 10 },
        setShape: (shape) => setShapeCalls.push(shape),
    });

    layout._adaptIWidget(widget);

    assert.equal(setShapeCalls.length, 1);
    assert.equal(setShapeCalls[0].width, 4);
    assert.equal(setShapeCalls[0].height, 10);
});

test('_adaptIWidget enlarges height when below minimum', () => {
    const layout = createLayout(createDragboard());
    const setShapeCalls = [];
    const widget = createMockWidget('w1', {
        element: document.createElement('section'),
        shape: { width: 10, height: 1 },
        setShape: (shape) => setShapeCalls.push(shape),
    });

    layout._adaptIWidget(widget);

    assert.equal(setShapeCalls.length, 1);
    assert.equal(setShapeCalls[0].width, 10);
    assert.equal(setShapeCalls[0].height, 4);
});

test('_adaptIWidget enlarges both when both below minimum', () => {
    const layout = createLayout(createDragboard());
    const setShapeCalls = [];
    const widget = createMockWidget('w1', {
        element: document.createElement('section'),
        shape: { width: 1, height: 1 },
        setShape: (shape) => setShapeCalls.push(shape),
    });

    layout._adaptIWidget(widget);

    assert.equal(setShapeCalls.length, 1);
    assert.equal(setShapeCalls[0].width, 4);
    assert.equal(setShapeCalls[0].height, 4);
});

test('_adaptIWidget does not call setShape when size is already adequate', () => {
    const layout = createLayout(createDragboard());
    let setShapeCalled = false;
    const widget = createMockWidget('w1', {
        element: document.createElement('section'),
        shape: { width: 10, height: 10 },
        setShape: () => { setShapeCalled = true; },
    });

    layout._adaptIWidget(widget);

    assert.equal(setShapeCalled, false);
});

test('_adaptIWidget does nothing when element is null', () => {
    const layout = createLayout(createDragboard());
    let setShapeCalled = false;
    const widget = createMockWidget('w1', {
        element: null,
        shape: { width: 1, height: 1 },
        setShape: () => { setShapeCalled = true; },
    });

    layout._adaptIWidget(widget);

    assert.equal(setShapeCalled, false);
});

// ============================================================================
// removeWidget
// ============================================================================

test('removeWidget removes widget from registry and cleans up', () => {
    const db = createDragboard();
    let dragboardRemoveCalled = false;
    db._removeWidget = () => { dragboardRemoveCalled = true; };

    const layout = createLayout(db);
    const collection = [];
    const widget = createMockWidget('w1', {
        removeEventListener: (type, fn) => collection.push('removeEventListener'),
    });
    widget.layout = layout;
    layout.widgets['w1'] = widget;

    const result = layout.removeWidget(widget, true);

    assert.equal(layout.widgets['w1'], undefined);
    assert.equal(widget.layout, null);
    assert.equal(dragboardRemoveCalled, true);
    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
    assert.deepEqual(collection, ['removeEventListener']);
});

test('removeWidget with affectsDragboard=false skips dragboard._removeWidget', () => {
    const db = createDragboard();
    let dragboardRemoveCalled = false;
    db._removeWidget = () => { dragboardRemoveCalled = true; };

    const layout = createLayout(db);
    const widget = createMockWidget('w1');
    widget.layout = layout;
    layout.widgets['w1'] = widget;

    layout.removeWidget(widget, false);

    assert.equal(dragboardRemoveCalled, false);
});

test('removeWidget returns new Set', () => {
    const layout = createLayout(createDragboard());
    const w1 = createMockWidget('w1');
    w1.layout = layout;
    layout.widgets['w1'] = w1;

    const result = layout.removeWidget(w1, false);

    assert.ok(result instanceof Set);
});

// ============================================================================
// removeWidgetEventListeners
// ============================================================================

test('removeWidgetEventListeners removes the remove event listener', () => {
    const layout = createLayout(createDragboard());
    const calls = [];
    const widget = createMockWidget('w1', {
        removeEventListener: (type, fn) => calls.push({ type, fn }),
    });

    layout.removeWidgetEventListeners(widget);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, 'remove');
    assert.equal(calls[0].fn, layout._on_remove_widget_bound);
});

// ============================================================================
// moveTo
// ============================================================================

test('moveTo calls moveToLayout on each widget', () => {
    const layout = createLayout(createDragboard());
    const destLayout = createLayout(createDragboard());
    const calls = [];
    const w1 = createMockWidget('w1', { moveToLayout: (l) => calls.push({ id: 'w1', layout: l }) });
    const w2 = createMockWidget('w2', { moveToLayout: (l) => calls.push({ id: 'w2', layout: l }) });
    layout.widgets = { w1, w2 };

    const result = layout.moveTo(destLayout);

    assert.strictEqual(result, layout);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], { id: 'w1', layout: destLayout });
    assert.deepEqual(calls[1], { id: 'w2', layout: destLayout });
});

test('moveTo with empty widgets returns self', () => {
    const layout = createLayout(createDragboard());
    const destLayout = createLayout(createDragboard());

    const result = layout.moveTo(destLayout);

    assert.strictEqual(result, layout);
});

// ============================================================================
// initializeMove (no-op)
// ============================================================================

test('initializeMove is a no-op', () => {
    const layout = createLayout(createDragboard());
    assert.doesNotThrow(() => layout.initializeMove(null, null));
    assert.equal(layout.initializeMove(), undefined);
});

// ============================================================================
// moveTemporally (no-op)
// ============================================================================

test('moveTemporally is a no-op', () => {
    const layout = createLayout(createDragboard());
    assert.doesNotThrow(() => layout.moveTemporally(0, 0));
    assert.equal(layout.moveTemporally(100, 200), undefined);
});

// ============================================================================
// acceptMove (no-op)
// ============================================================================

test('acceptMove is a no-op', () => {
    const layout = createLayout(createDragboard());
    assert.doesNotThrow(() => layout.acceptMove());
    assert.equal(layout.acceptMove(), undefined);
});

// ============================================================================
// cancelMove (no-op)
// ============================================================================

test('cancelMove is a no-op', () => {
    const layout = createLayout(createDragboard());
    assert.doesNotThrow(() => layout.cancelMove());
    assert.equal(layout.cancelMove(), undefined);
});

// ============================================================================
// disableCursor (no-op)
// ============================================================================

test('disableCursor is a no-op', () => {
    const layout = createLayout(createDragboard());
    assert.doesNotThrow(() => layout.disableCursor());
    assert.equal(layout.disableCursor(), undefined);
});

// ============================================================================
// on_remove_widget (private bound function via constructor)
// ============================================================================

test('_on_remove_widget_bound calls removeWidget and updates dragboard', () => {
    const db = createDragboard();
    let updateCalled = false;
    db.update = () => { updateCalled = true; };

    const layout = createLayout(db);
    const widget = createMockWidget('w1');
    widget.layout = layout;
    layout.widgets['w1'] = widget;

    layout._on_remove_widget_bound(widget);

    assert.equal(layout.widgets['w1'], undefined);
    assert.equal(widget.layout, null);
    assert.equal(updateCalled, true);
});

// ============================================================================
// INTEGRATION: addWidget then removeWidget
// ============================================================================

test('addWidget then removeWidget full lifecycle', () => {
    const db = createDragboard();
    let addCalled = false;
    let removeCalled = false;
    db._addWidget = () => { addCalled = true; };
    db._removeWidget = () => { removeCalled = true; };

    const layout = createLayout(db);
    const widget = createMockWidget('lifecycle');
    const addEventListenerCalls = [];
    const removeEventListenerCalls = [];
    widget.addEventListener = (type, fn) => addEventListenerCalls.push(type);
    widget.removeEventListener = (type, fn) => removeEventListenerCalls.push(type);

    layout.addWidget(widget, true);
    assert.equal(widget.layout, layout);
    assert.equal(layout.widgets['lifecycle'], widget);
    assert.equal(addCalled, true);
    assert.equal(addEventListenerCalls.length, 1);

    layout.removeWidget(widget, true);
    assert.equal(layout.widgets['lifecycle'], undefined);
    assert.equal(widget.layout, null);
    assert.equal(removeCalled, true);
    assert.equal(removeEventListenerCalls.length, 1);
});
