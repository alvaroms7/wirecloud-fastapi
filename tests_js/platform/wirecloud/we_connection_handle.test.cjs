const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

function patchDocument() {
    if (typeof document.createElementNS !== 'function') {
        document.createElementNS = function (ns, tagName) {
            const el = document.createElement(tagName);
            el.namespaceURI = ns;
            return el;
        };
    }
}

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    patchDocument();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = { WiringEditor: {} };

    Wirecloud.UserInterfaceManager = {
        _registerTooltip: () => {},
        _unregisterTooltip: () => {},
    };

    StyledElements.Tooltip = class Tooltip {
        constructor(options) {
            this.options = options;
        }
        bind(element) {
            this.boundElement = element;
        }
        show() { return this; }
        hide() { return this; }
        destroy() {}
    };

    Wirecloud.ui.Draggable = function (handler, data, onStart, onDrag, onFinish, canBeDragged) {
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

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ConnectionHandle.js',
    ]);
});

// =========================================================================
// STATIC CONSTANTS
// =========================================================================

test('ConnectionHandle.SVG_NS is correct', () => {
    const cls = Wirecloud.ui.WiringEditor.ConnectionHandle;
    assert.equal(cls.SVG_NS, "http://www.w3.org/2000/svg");
});

test('ConnectionHandle.MINOFFSET_X is 20', () => {
    const cls = Wirecloud.ui.WiringEditor.ConnectionHandle;
    assert.equal(cls.MINOFFSET_X, 20);
});

test('ConnectionHandle.MAXOFFSET_X is 90', () => {
    const cls = Wirecloud.ui.WiringEditor.ConnectionHandle;
    assert.equal(cls.MAXOFFSET_X, 90);
});

// =========================================================================
// getRelativePosition static method
// =========================================================================

test('getRelativePosition normal distance', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 100, y: 0 }, { x: 150, y: 0 }, false
    );
    assert.deepEqual(result, { x: 50, y: 0 });
});

test('getRelativePosition clamped to MAXOFFSET_X', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 0, y: 0 }, { x: 200, y: 0 }, false
    );
    assert.equal(result.x, 90);
    assert.equal(result.y, 0);
});

test('getRelativePosition clamped to MINOFFSET_X', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 100, y: 0 }, { x: 110, y: 0 }, false
    );
    assert.equal(result.x, 20);
    assert.equal(result.y, 0);
});

test('getRelativePosition at exact MAXOFFSET_X boundary', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 0, y: 0 }, { x: 90, y: 0 }, false
    );
    assert.equal(result.x, 90);
});

test('getRelativePosition at exact MINOFFSET_X boundary', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 0, y: 0 }, { x: 20, y: 0 }, false
    );
    assert.equal(result.x, 20);
});

test('getRelativePosition with invert=true', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 50, y: 0 }, { x: 100, y: 0 }, true
    );
    assert.equal(result.x, -50);
    assert.equal(result.y, 0);
});

test('getRelativePosition with invert=false', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 50, y: 0 }, { x: 100, y: 0 }, false
    );
    assert.equal(result.x, 50);
    assert.equal(result.y, 0);
});

test('getRelativePosition clamped with invert=true', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 0, y: 0 }, { x: 200, y: 0 }, true
    );
    assert.equal(result.x, -90);
    assert.equal(result.y, 0);
});

test('getRelativePosition below MINOFFSET with invert=true', () => {
    const result = Wirecloud.ui.WiringEditor.ConnectionHandle.getRelativePosition(
        { x: 0, y: 0 }, { x: 5, y: 0 }, true
    );
    assert.equal(result.x, -20);
    assert.equal(result.y, 0);
});

// =========================================================================
// Constructor with default options
// =========================================================================

test('constructor creates ConnectionHandle with defaults', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle instanceof Wirecloud.ui.WiringEditor.ConnectionHandle);
    assert.equal(handle.endpoint, endpoint);
});

test('constructor creates SVG g wrapperElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    const el = handle.wrapperElement;
    assert.equal(el.tagName, 'G');
    assert.equal(el.namespaceURI, Wirecloud.ui.WiringEditor.ConnectionHandle.SVG_NS);
});

test('constructor sets we-connection-handle class on wrapper', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle.wrapperElement.classList.contains('we-connection-handle'));
});

test('constructor adds source-handle class on wrapper', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle.wrapperElement.classList.contains('source-handle'));
});

test('constructor adds target-handle class on wrapper', () => {
    const endpoint = { type: 'target', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle.wrapperElement.classList.contains('target-handle'));
});

test('constructor creates SVG path lineElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.lineElement.tagName, 'PATH');
    assert.equal(handle.lineElement.namespaceURI, Wirecloud.ui.WiringEditor.ConnectionHandle.SVG_NS);
});

test('constructor sets we-connection-handle-line class on lineElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle.lineElement.classList.contains('we-connection-handle-line'));
});

test('constructor creates SVG circle ballElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.ballElement.tagName, 'CIRCLE');
    assert.equal(handle.ballElement.namespaceURI, Wirecloud.ui.WiringEditor.ConnectionHandle.SVG_NS);
});

test('constructor sets we-connection-handle-ball class on ballElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle.ballElement.classList.contains('we-connection-handle-ball'));
});

test('constructor sets default radius on ballElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.ballElement.getAttribute('r'), '6px');
});

test('constructor adds click stopPropagation listener on ballElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    const listeners = handle.ballElement.listeners.click;
    assert.ok(Array.isArray(listeners));
    assert.equal(listeners.length, 1);
    assert.equal(listeners[0], StyledElements.Utils.stopPropagationListener);
});

test('constructor auto defaults to true when no position given', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.auto, true);
});

test('constructor auto setter toggles className', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle.wrapperElement.classList.contains('auto'));

    handle.auto = false;
    assert.equal(handle.auto, false);
    assert.ok(!handle.wrapperElement.classList.contains('auto'));

    handle.auto = true;
    assert.equal(handle.auto, true);
    assert.ok(handle.wrapperElement.classList.contains('auto'));
});

test('constructor creates tooltip with correct content', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle.tooltip instanceof StyledElements.Tooltip);
    assert.equal(handle.tooltip.options.content, 'Drag & Drop');
    assert.deepEqual(handle.tooltip.options.placement, ['top']);
});

test('constructor binds tooltip to ballElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.tooltip.boundElement, handle.ballElement);
});

test('constructor creates Draggable on ballElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.ok(handle.draggable != null);
    assert.equal(handle.draggable.handler, handle.ballElement);
});

test('constructor draggable data contains handle reference', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.draggable.data.handle, handle);
});

test('constructor draggable canBeDragged returns true', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.draggable.canBeDragged(), true);
});

// =========================================================================
// Constructor with custom options
// =========================================================================

test('constructor with custom class option', () => {
    const endpoint = { type: 'target', anchorPosition: { x: 50, y: 75 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        class: 'custom-cls',
    });

    assert.ok(handle.wrapperElement.classList.contains('custom-cls'));
});

test('constructor with custom radius', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        radius: '10px',
    });

    assert.equal(handle.ballElement.getAttribute('r'), '10px');
});

test('constructor with valid 2D position sets auto=false', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    assert.equal(handle.auto, false);
    assert.ok(!handle.wrapperElement.classList.contains('auto'));
});

test('constructor with non-2D position sets auto=true', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50.5, y: 0 },
    });

    assert.equal(handle.auto, true);
});

test('constructor with null position sets auto=true', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: null,
    });

    assert.equal(handle.auto, true);
});

test('constructor with non-plain-object position sets auto=true', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: [50, 0],
    });

    assert.equal(handle.auto, true);
});

test('constructor with position having non-integer x sets auto=true', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: '50', y: 0 },
    });

    assert.equal(handle.auto, true);
});

test('constructor with position having non-integer y sets auto=true', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: null },
    });

    assert.equal(handle.auto, true);
});

test('constructor with custom events registers them', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        events: ['custom-event'],
    });

    let called = false;
    handle.addEventListener('custom-event', () => { called = true; });
    handle.dispatchEvent('custom-event');
    assert.ok(called);
});

test('constructor stores relativePosition and sets auto=false for valid 2D position', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    assert.deepEqual(handle.relativePosition, { x: 50, y: 0 });
    assert.equal(handle.auto, false);
});

// =========================================================================
// position() method
// =========================================================================

test('position() getter returns ball position after setter', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    handle.position({ x: 50, y: 0 });

    const pos = handle.position();
    assert.equal(parseInt(pos.x, 10), 150);
    assert.equal(parseInt(pos.y, 10), 200);
});

test('position() setter returns this', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    const result = handle.position({ x: 80, y: 10 });
    assert.equal(result, handle);
});

test('position() setter updates ball and line', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    handle.position({ x: 80, y: 10 });

    const cx = parseInt(handle.ballElement.getAttribute('cx'), 10);
    const cy = parseInt(handle.ballElement.getAttribute('cy'), 10);
    assert.equal(cx, 180);
    assert.equal(cy, 210);
});

test('position() setter updates line d attribute', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    handle.position({ x: 80, y: 10 });

    assert.ok(handle.lineElement.hasAttribute('d'));
    assert.ok(handle.lineElement.getAttribute('d').length > 0);
});

// =========================================================================
// toJSON() method
// =========================================================================

test('toJSON returns "auto" when auto is true', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.toJSON(), 'auto');
});

test('toJSON returns relativePosition when auto is false', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 60, y: 0 },
    });

    assert.deepEqual(handle.toJSON(), { x: 60, y: 0 });
});

// =========================================================================
// updateDistance() method
// =========================================================================

test('updateDistance with auto=true recomputes relativePosition', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.auto, true);
    const result = handle.updateDistance({ x: 300, y: 200 });
    assert.equal(result, handle);
});

test('updateDistance returns this', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    const result = handle.updateDistance({ x: 300, y: 200 });
    assert.equal(result, handle);
});

test('updateDistance with auto=false preserves relativePosition', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 30, y: 0 },
    });

    assert.equal(handle.auto, false);
    handle.updateDistance({ x: 500, y: 400 });

    const cx = parseInt(handle.ballElement.getAttribute('cx'), 10);
    const cy = parseInt(handle.ballElement.getAttribute('cy'), 10);
    assert.equal(cx, 130);
    assert.equal(cy, 200);
});

test('updateDistance updates ball and line elements', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    handle.updateDistance({ x: 300, y: 200 });

    assert.ok(handle.ballElement.hasAttribute('cx'));
    assert.ok(handle.ballElement.hasAttribute('cy'));
    assert.ok(handle.lineElement.hasAttribute('d'));
});

test('updateDistance with invert=true for auto handle', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    handle.updateDistance({ x: 60, y: 200 }, true);

    const cx = parseInt(handle.ballElement.getAttribute('cx'), 10);
    assert.ok(cx < 100, 'should be to the left of anchor when inverted');
});

// =========================================================================
// Drag callbacks
// =========================================================================

test('ondragstart sets initialPosition, auto=false, dispatches dragstart', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    let dragStartFired = false;
    handle.addEventListener('dragstart', () => { dragStartFired = true; });

    const draggable = handle.draggable;
    const context = draggable.data;
    draggable.onStart(draggable, context);

    assert.equal(handle.auto, false);
    assert.deepEqual(context.initialPosition, { x: 50, y: 0 });
    assert.ok(dragStartFired);
});

test('ondragstart auto starts true, becomes false on drag', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.auto, true);

    let fired = false;
    handle.addEventListener('dragstart', () => { fired = true; });

    const draggable = handle.draggable;
    draggable.onStart(draggable, draggable.data);

    assert.equal(handle.auto, false);
    assert.ok(fired);
});

test('ondrag computes new position and dispatches drag event', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    const draggable = handle.draggable;
    const context = draggable.data;
    draggable.onStart(draggable, context);

    let dragPos = null;
    handle.addEventListener('drag', (_, pos) => { dragPos = pos; });

    draggable.onDrag(null, draggable, context, 20, 10);

    assert.deepEqual(dragPos, { x: 70, y: 10 });
    const cx = parseInt(handle.ballElement.getAttribute('cx'), 10);
    const cy = parseInt(handle.ballElement.getAttribute('cy'), 10);
    assert.equal(cx, 170);
    assert.equal(cy, 210);
});

test('ondrag works with negative offsets', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    const draggable = handle.draggable;
    const context = draggable.data;
    draggable.onStart(draggable, context);

    let dragPos = null;
    handle.addEventListener('drag', (_, pos) => { dragPos = pos; });

    draggable.onDrag(null, draggable, context, -30, -15);

    assert.deepEqual(dragPos, { x: 20, y: -15 });
});

test('ondragend dispatches dragend event', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    let dragEndFired = false;
    handle.addEventListener('dragend', () => { dragEndFired = true; });

    const draggable = handle.draggable;
    const context = draggable.data;

    draggable.onFinish(draggable, context);
    assert.ok(dragEndFired);
});

test('full drag lifecycle: start -> drag -> end', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint, {
        position: { x: 50, y: 0 },
    });

    const events = [];
    handle.addEventListener('dragstart', () => events.push('start'));
    handle.addEventListener('drag', () => events.push('drag'));
    handle.addEventListener('dragend', () => events.push('end'));

    const draggable = handle.draggable;
    const context = draggable.data;

    draggable.onStart(draggable, context);
    draggable.onDrag(null, draggable, context, 10, 5);
    draggable.onFinish(draggable, context);

    assert.deepEqual(events, ['start', 'drag', 'end']);
});

// =========================================================================
// formatDistance integration (tested through position)
// =========================================================================

test('formatDistance generates correct SVG path via position', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    handle.position({ x: 80, y: 0 });

    const d = handle.lineElement.getAttribute('d');
    assert.equal(d, 'M 100,200 180,200');
});

// =========================================================================
// Edge cases and regression
// =========================================================================

test('draggable.destroy cleans up', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    handle.draggable.destroy();
    assert.equal(handle.draggable.handler, null);
    assert.equal(handle.draggable.data, null);
});

test('lineElement is child of wrapperElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.lineElement.parentElement, handle.wrapperElement);
    assert.ok(handle.wrapperElement.childNodes.includes(handle.lineElement));
});

test('ballElement is child of wrapperElement', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    assert.equal(handle.ballElement.parentElement, handle.wrapperElement);
    assert.ok(handle.wrapperElement.childNodes.includes(handle.ballElement));
});

test('auto getter reads from hasClassName', () => {
    const endpoint = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const handle = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint);

    handle.wrapperElement.classList.remove('auto');
    assert.equal(handle.auto, false);

    handle.wrapperElement.classList.add('auto');
    assert.equal(handle.auto, true);
});

test('multiple instances are independent', () => {
    const endpoint1 = { type: 'source', anchorPosition: { x: 100, y: 200 } };
    const endpoint2 = { type: 'target', anchorPosition: { x: 300, y: 400 } };

    const handle1 = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint1, { position: { x: 50, y: 0 } });
    const handle2 = new Wirecloud.ui.WiringEditor.ConnectionHandle(endpoint2);

    assert.equal(handle1.auto, false);
    assert.equal(handle2.auto, true);
    assert.equal(handle1.endpoint, endpoint1);
    assert.equal(handle2.endpoint, endpoint2);
});
