const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// -----------------------------------------------------------------------
// TEST SUITE: Wirecloud.ui.WiringEditor.EndpointGroup
// -----------------------------------------------------------------------

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    // Load StyledElements Container and Fragment (needed for Container base)
    loadLegacyScripts([
        'src/wirecloud/commons/static/js/StyledElements/Fragment.js',
        'src/wirecloud/commons/static/js/StyledElements/Container.js',
    ]);

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = { WiringEditor: {} };
    Wirecloud.wiring = { SourceEndpoint: class SourceEndpoint {}, TargetEndpoint: class TargetEndpoint {} };

    // Mock Wirecloud.ui.WiringEditor.Endpoint
    // Must extend StyledElements.StyledElement so Container.addChild recognizes it
    Wirecloud.ui.WiringEditor.Endpoint = class Endpoint extends StyledElements.StyledElement {
        constructor(wiringEndpoint, component) {
            var epType;
            if (wiringEndpoint instanceof Wirecloud.wiring.SourceEndpoint) {
                epType = 'source';
            } else if (wiringEndpoint instanceof Wirecloud.wiring.TargetEndpoint) {
                epType = 'target';
            } else {
                throw new TypeError('invalid wiringEndpoint parameter');
            }
            super([]);
            var el = document.createElement('div');
            el.className = 'endpoint';
            el.offsetWidth = 100;
            el.offsetHeight = 24;
            el.cloneNode = function () {
                var clone = document.createElement('div');
                clone.className = this.className;
                return clone;
            };
            this.wrapperElement = el;
            this._endpoint = wiringEndpoint;
            this.component = component;
            this.name = wiringEndpoint.name;
            this.missing = !!wiringEndpoint.missing;
            this.type = epType || wiringEndpoint.type || 'source';
            this.index = -1;
            this.draggable = null;
            this.activeCount = 0;
            this.connections = [];
        }
        get() { return this.wrapperElement; }
        refresh() {
            this._refreshed = true;
            return this;
        }
        addClassName(name) {
            this.get().classList.add(name);
            return this;
        }
        removeClassName(name) {
            this.get().classList.remove(name);
            return this;
        }
        hasClassName(name) {
            return this.get().classList.contains(name);
        }
    };

    // Mock Wirecloud.ui.Draggable (used by makeEndpointDraggable)
    Wirecloud.ui.Draggable = class Draggable {
        constructor(handler, data, onStart, onDrag, onFinish, canDrag) {
            this.handler = handler;
            this.data = data;
            this.onStart = onStart;
            this.onDrag = onDrag;
            this.onFinish = onFinish;
            this.canDrag = canDrag;
            this._destroyed = false;
        }
        destroy() {
            this._destroyed = true;
        }
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/EndpointGroup.js',
    ]);
});

// -----------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------

function makeWiringEndpoint(overrides) {
    return Object.assign({
        name: 'ep1',
        friendcode: '',
        label: 'Endpoint 1',
        description: '',
        missing: false,
        type: 'source',
    }, overrides);
}

function makeWiringSourceEndpoint(overrides) {
    const ep = makeWiringEndpoint(overrides);
    Object.setPrototypeOf(ep, Wirecloud.wiring.SourceEndpoint.prototype);
    return ep;
}

function makeWiringTargetEndpoint(overrides) {
    const ep = makeWiringEndpoint(overrides);
    Object.setPrototypeOf(ep, Wirecloud.wiring.TargetEndpoint.prototype);
    return ep;
}

function makeComponent(overrides) {
    const layoutElement = document.createElement('div');
    layoutElement.offsetWidth = 500;
    layoutElement.offsetHeight = 400;
    return Object.assign({
        parentElement: {
            get: function () { return layoutElement; },
            appendChild: function (child) { return layoutElement.appendChild(child); },
            removeChild: function (child) { return layoutElement.removeChild(child); }
        },
    }, overrides);
}

// -----------------------------------------------------------------------
// CONSTRUCTOR TESTS
// -----------------------------------------------------------------------

test('Constructor - basics', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    assert.ok(group instanceof Wirecloud.ui.WiringEditor.EndpointGroup);
    assert.ok(group instanceof StyledElements.Container);
    assert.ok(group.hasClassName('endpoints'));
    assert.ok(group.hasClassName('target-endpoints'));
    assert.deepStrictEqual(group.endpoints, {});
    assert.equal(group.component, comp);
    assert.deepStrictEqual(group.originalOrder, []);
    assert.equal(group.type, 'target');
});

test('Constructor - source type adds source-endpoints class', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('source', comp);
    assert.ok(group.hasClassName('source-endpoints'));
    assert.equal(group.type, 'source');
});

test('Constructor - wrapperElement uses div tagname', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    assert.equal(group.wrapperElement.tagName, 'DIV');
});

test('Constructor - orderable defaults to false (no orderable class)', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    assert.equal(group.orderable, false);
    assert.ok(!group.hasClassName('orderable'));
});

test('Constructor - orderable setter toggles class name', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.orderable = true;
    assert.equal(group.orderable, true);
    assert.ok(group.hasClassName('orderable'));

    group.orderable = false;
    assert.equal(group.orderable, false);
    assert.ok(!group.hasClassName('orderable'));
});

// -----------------------------------------------------------------------
// MODIFIED GETTER TESTS
// -----------------------------------------------------------------------

test('modified - returns false when cannot be ordered', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    assert.equal(group.children.length, 0);
    assert.equal(group.modified, false);
});

test('modified - returns false when order equals originalOrder', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const wep1 = makeWiringSourceEndpoint({ name: 'a' });
    const wep2 = makeWiringSourceEndpoint({ name: 'b' });
    group.appendEndpoint(wep1);
    group.appendEndpoint(wep2);

    assert.equal(group.modified, false);
});

test('modified - returns true when order differs from originalOrder (after reorder)', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const wep1 = makeWiringSourceEndpoint({ name: 'a' });
    const wep2 = makeWiringSourceEndpoint({ name: 'b' });
    group.appendEndpoint(wep1);
    group.appendEndpoint(wep2);

    assert.equal(group.modified, false);

    group.orderEndpoints(['b', 'a']);

    assert.equal(group.modified, true);
});

// -----------------------------------------------------------------------
// APPENDENDPOINT TESTS
// -----------------------------------------------------------------------

test('appendEndpoint - normal endpoint, no missing endpoints', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    const wep = makeWiringSourceEndpoint({ name: 'ep-a' });

    const result = group.appendEndpoint(wep);

    assert.equal(result.name, 'ep-a');
    assert.ok(result instanceof Wirecloud.ui.WiringEditor.Endpoint);
    assert.deepStrictEqual(group.originalOrder, ['ep-a']);
    assert.equal(group.endpoints['ep-a'], result);
    assert.equal(group.children.length, 1);
    assert.equal(group.children[0], result);
    assert.equal(result.index, 0);
});

test('appendEndpoint - missing endpoint is not added to originalOrder', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    const wep = makeWiringSourceEndpoint({ name: 'ep-missing', missing: true });

    const result = group.appendEndpoint(wep);

    assert.deepStrictEqual(group.originalOrder, []);
    assert.equal(group.endpoints['ep-missing'], result);
    assert.equal(group.children.length, 1);
});

test('appendEndpoint - normal endpoint prepended before missing endpoint', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const missing1 = makeWiringSourceEndpoint({ name: 'missing1', missing: true });
    group.appendEndpoint(missing1);

    const normal = makeWiringSourceEndpoint({ name: 'normal' });
    const result = group.appendEndpoint(normal);

    assert.deepStrictEqual(group.originalOrder, ['normal']);
    assert.equal(group.children.length, 2);
    assert.equal(group.children[0], result);
    assert.equal(group.children[1].name, 'missing1');
    assert.equal(result.index, 0);
    assert.equal(group.children[1].index, 1);
});

test('appendEndpoint - multiple normal endpoints, all prepended before first missing', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const missing1 = makeWiringSourceEndpoint({ name: 'm1', missing: true });
    group.appendEndpoint(missing1);

    const normal1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'n1' }));
    const normal2 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'n2' }));

    assert.deepStrictEqual(group.originalOrder, ['n1', 'n2']);
    assert.equal(group.children[0], normal1);
    assert.equal(group.children[1], normal2);
    assert.equal(group.children[2].name, 'm1');
});

test('appendEndpoint - normal after all missing are placed', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const m1 = makeWiringSourceEndpoint({ name: 'm1', missing: true });
    const m2 = makeWiringSourceEndpoint({ name: 'm2', missing: true });
    group.appendEndpoint(m1);
    group.appendEndpoint(m2);

    const normal = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'n1' }));

    assert.deepStrictEqual(group.originalOrder, ['n1']);
    assert.equal(group.children.length, 3);
    assert.equal(group.children[0], normal);
    assert.equal(group.children[1].name, 'm1');
    assert.equal(group.children[2].name, 'm2');
});

test('appendEndpoint - children indices are updated correctly', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const ep2 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    const ep3 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    assert.equal(ep1.index, 0);
    assert.equal(ep2.index, 1);
    assert.equal(ep3.index, 2);
});

test('appendEndpoint - uses wiringEndpoint.name as key in endpoints dict', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    const wep = makeWiringSourceEndpoint({ name: 'unique-name' });

    group.appendEndpoint(wep);

    assert.equal(group.endpoints['unique-name'].name, 'unique-name');
    assert.equal(group.getEndpoint('unique-name').name, 'unique-name');
});

// -----------------------------------------------------------------------
// CANBEORDERED TESTS
// -----------------------------------------------------------------------

test('canBeOrdered - returns false when children length <= MIN_LENGTH (1)', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    assert.equal(group.children.length, 0);
    assert.equal(group.canBeOrdered(), false);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'only' }));
    assert.equal(group.children.length, 1);
    assert.equal(group.canBeOrdered(), false);
});

test('canBeOrdered - returns false when has missing endpoints', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b', missing: true }));

    assert.equal(group.children.length, 2);
    assert.equal(group.canBeOrdered(), false);
});

test('canBeOrdered - returns true when length > MIN_LENGTH and no missing', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    assert.equal(group.canBeOrdered(), true);
});

test('canBeOrdered - returns true with three or more endpoints', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    assert.equal(group.canBeOrdered(), true);
});

// -----------------------------------------------------------------------
// GETENDPOINT TESTS
// -----------------------------------------------------------------------

test('getEndpoint - returns the endpoint for a known name', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    const ep = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'findme' }));

    assert.equal(group.getEndpoint('findme'), ep);
});

test('getEndpoint - returns undefined for unknown name', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    assert.equal(group.getEndpoint('nope'), undefined);
});

test('getEndpoint - returns correct endpoint when multiple exist', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const a = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const b = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    assert.equal(group.getEndpoint('a'), a);
    assert.equal(group.getEndpoint('b'), b);
});

// -----------------------------------------------------------------------
// REFRESH TESTS
// -----------------------------------------------------------------------

test('refresh - calls refresh on all endpoints', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const ep2 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    ep1._refreshed = false;
    ep2._refreshed = false;

    const result = group.refresh();

    assert.equal(result, group);
    assert.equal(ep1._refreshed, true);
    assert.equal(ep2._refreshed, true);
});

test('refresh - returns this even when no endpoints', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const result = group.refresh();
    assert.equal(result, group);
});

// -----------------------------------------------------------------------
// ORDERENDPOINTS TESTS
// -----------------------------------------------------------------------

test('orderEndpoints - returns this when cannot be ordered', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    const result = group.orderEndpoints(['a']);
    assert.equal(result, group);
});

test('orderEndpoints - returns this when newOrder length < 2', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    const result = group.orderEndpoints(['a']);
    assert.equal(result, group);
});

test('orderEndpoints - returns this when newOrder equals originalOrder (sorted)', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    const result = group.orderEndpoints(['a', 'b']);
    assert.equal(result, group);
});

test('orderEndpoints - returns this when newOrder has different elements (unsorted)', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    const result = group.orderEndpoints(['a', 'x']);
    assert.equal(result, group);
});

test('orderEndpoints - reorders children when order differs but same elements', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const epA = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const epB = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    const epC = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    const result = group.orderEndpoints(['c', 'a', 'b']);

    assert.equal(result, group);
    assert.equal(group.children[0], epC);
    assert.equal(group.children[1], epA);
    assert.equal(group.children[2], epB);
    assert.equal(epC.index, 0);
    assert.equal(epA.index, 1);
    assert.equal(epB.index, 2);
});

test('orderEndpoints - reorders when same elements in different order (equals unsorted)', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));

    const result = group.orderEndpoints(['a', 'b', 'c']);
    assert.deepStrictEqual(group.children.map(function (c) { return c.name; }), ['a', 'b', 'c']);
});

// -----------------------------------------------------------------------
// REMOVECHILD TESTS
// -----------------------------------------------------------------------

test('removeChild - removes endpoint from originalOrder', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const ep2 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    assert.deepStrictEqual(group.originalOrder, ['a', 'b']);

    const result = group.removeChild(ep1);
    assert.equal(result, group);
    assert.deepStrictEqual(group.originalOrder, ['b']);
});

test('removeChild - does not error when endpoint not in originalOrder', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.originalOrder = [];
    assert.doesNotThrow(function () {
        group.removeChild(ep);
    });
});

test('removeChild - removes from endpoints dict', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'to-remove' }));
    assert.ok(group.endpoints['to-remove']);

    group.removeChild(ep);
    assert.equal(group.endpoints['to-remove'], undefined);
});

test('removeChild - reindexes remaining children', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep0 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    const ep2 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    group.removeChild(ep1);

    assert.equal(group.children.length, 2);
    assert.equal(ep0.index, 0);
    assert.equal(ep2.index, 1);
});

test('removeChild - removes from DOM via super.removeChild', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'rm' }));
    const el = ep.get();
    assert.equal(el.parentElement, group.wrapperElement);

    group.removeChild(ep);
    assert.equal(el.parentElement, null);
});

// -----------------------------------------------------------------------
// STARTORDERING TESTS
// -----------------------------------------------------------------------

test('startOrdering - returns this when cannot be ordered', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    const result = group.startOrdering();
    assert.equal(result, group);
    assert.equal(group.orderable, false);
});

test('startOrdering - returns this when already orderable', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.orderable = true;
    const result = group.startOrdering();
    assert.equal(result, group);
});

test('startOrdering - sets orderable to true', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    const result = group.startOrdering();
    assert.equal(result, group);
    assert.equal(group.orderable, true);
    assert.ok(group.hasClassName('orderable'));
});

test('startOrdering - creates Draggable for each endpoint', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const ep2 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();

    assert.ok(ep1.draggable instanceof Wirecloud.ui.Draggable);
    assert.ok(ep2.draggable instanceof Wirecloud.ui.Draggable);
    assert.equal(ep1.draggable.data.group, group);
});

test('startOrdering - Draggable canDrag returns true', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();
    assert.equal(ep.draggable.canDrag(), true);
});

// -----------------------------------------------------------------------
// STOPORDERING TESTS
// -----------------------------------------------------------------------

test('stopOrdering - returns this when not orderable', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);
    const result = group.stopOrdering();
    assert.equal(result, group);
});

test('stopOrdering - sets orderable to false', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();
    assert.equal(group.orderable, true);

    const result = group.stopOrdering();
    assert.equal(result, group);
    assert.equal(group.orderable, false);
    assert.ok(!group.hasClassName('orderable'));
});

test('stopOrdering - destroys all draggables', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const ep2 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();
    const drag1 = ep1.draggable;
    const drag2 = ep2.draggable;

    group.stopOrdering();
    assert.equal(drag1._destroyed, true);
    assert.equal(drag2._destroyed, true);
});

// -----------------------------------------------------------------------
// TOJSON TESTS
// -----------------------------------------------------------------------

test('toJSON - returns empty array when not modified', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    assert.deepStrictEqual(group.toJSON(), []);
});

test('toJSON - returns children names when modified', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.orderEndpoints(['b', 'a']);

    assert.deepStrictEqual(group.toJSON(), ['b', 'a']);
});

test('toJSON - returns empty when cannot be ordered', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'only' }));
    assert.deepStrictEqual(group.toJSON(), []);
});

test('toJSON - returns empty when has missing endpoints', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c', missing: true }));

    assert.deepStrictEqual(group.toJSON(), []);
});

// -----------------------------------------------------------------------
// EQUALSLISTS FUNCTIONAL TESTS (via orderEndpoints)
// -----------------------------------------------------------------------

test('equalsLists - with sorted=true (default), order matters', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    // newOrder is different order but same elements → should reorder
    group.orderEndpoints(['b', 'a']);

    // Children are now in ['b', 'a'] order
    assert.deepStrictEqual(group.children.map(function (c) { return c.name; }), ['b', 'a']);
});

test('equalsLists - with sorted=false, order must match exactly', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    group.orderEndpoints(['a', 'b', 'c']);
    assert.deepStrictEqual(group.children.map(function (c) { return c.name; }), ['a', 'b', 'c']);
});

// -----------------------------------------------------------------------
// DRAG FUNCTIONALITY TESTS (via startOrdering + Draggable callbacks)
// -----------------------------------------------------------------------

test('dragstart - sets context properties', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();

    var drag = ep1.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);

    assert.ok(ctx.layout);
    assert.equal(ctx.layout, comp.parentElement);
    assert.equal(typeof ctx.x, 'number');
    assert.equal(typeof ctx.y, 'number');
    assert.equal(typeof ctx.offsetHeight, 'number');
    assert.equal(typeof ctx.topBorder, 'number');
    assert.equal(typeof ctx.ratio, 'number');
    assert.ok(ctx.clonedEndpoint);
    assert.ok(ctx.clonedEndpoint.classList.contains('cloned'));
    assert.ok(ctx.clonedEndpoint.classList.contains('source-endpoint'));
    assert.ok(ep1.hasClassName('dragging'));
});

test('drag - updates clonedEndpoint position', () => {
    var comp = makeComponent();
    var group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    var ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    group.startOrdering();

    var drag = ep1.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);

    var clone = ctx.clonedEndpoint;
    drag.onDrag(event, drag, ctx, 10, 20);

    assert.ok(clone.style.left);
    assert.ok(clone.style.top);
});

test('drag - moveEndpoint moves to correct new position (move to end)', () => {
    var comp = makeComponent();
    var group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    var epA = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    var epB = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    var epC = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    group.startOrdering();

    var drag = epA.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);

    ctx.topBorder = 0;
    ctx.ratio = 20;
    var yDelta = 50 - ctx.y;

    drag.onDrag(event, drag, ctx, 0, yDelta);

    assert.equal(epA.index, 2);
    assert.equal(group.children[0], epB);
    assert.equal(group.children[1], epC);
    assert.equal(group.children[2], epA);
});

test('drag - moveEndpoint with new_index = 0 (prependChild)', () => {
    var comp = makeComponent();
    var group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    var epA = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    var epB = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();

    var drag = epB.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);

    ctx.topBorder = 0;
    ctx.ratio = 20;
    var yDelta = -20 - ctx.y;

    drag.onDrag(event, drag, ctx, 0, yDelta);

    assert.equal(epB.index, 0);
    assert.equal(group.children[0], epB);
    assert.equal(group.children[1], epA);
});

test('dragend - removes dragging class and cloned endpoint', () => {
    var comp = makeComponent();
    var group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    var ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();

    var drag = ep1.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);
    assert.ok(ep1.hasClassName('dragging'));

    drag.onFinish(drag, ctx);

    assert.ok(!ep1.hasClassName('dragging'));
    assert.equal(ctx.clonedEndpoint.parentElement, null);
});

test('dragend - calls refresh after moveEndpoint', () => {
    var comp = makeComponent();
    var group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    var epA = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();

    var drag = epA.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);

    epA._refreshed = false;
    ctx.topBorder = 0;
    ctx.ratio = 20;
    var yDelta = 30 - ctx.y;

    drag.onDrag(event, drag, ctx, 0, yDelta);

    assert.equal(epA._refreshed, true);
});

test('canDrag - returns true', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();
    const ep = group.children[0];
    assert.equal(ep.draggable.canDrag(), true);
});

test('drag - new_index clamping to 0 (negative yPos)', () => {
    var comp = makeComponent();
    var group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    var epA = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    var epB = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    group.startOrdering();

    var drag = epB.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);

    ctx.topBorder = 100;
    ctx.ratio = 20;
    var yDelta = -200 - ctx.y;

    drag.onDrag(event, drag, ctx, 0, yDelta);
    assert.equal(epB.index, 0);
});

test('drag - new_index clamping to max (children.length - 1)', () => {
    var comp = makeComponent();
    var group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    var epA = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    var epB = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    var epC = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    group.startOrdering();

    var drag = epA.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);

    ctx.topBorder = 0;
    ctx.ratio = 5;
    var yDelta = 100 - ctx.y;

    drag.onDrag(event, drag, ctx, 0, yDelta);
    assert.equal(epA.index, 2);
});

test('drag - no move when new_index equals current index', () => {
    var comp = makeComponent();
    var group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    var epA = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    group.startOrdering();

    var drag = epA.draggable;
    var ctx = drag.data;
    var event = { clientX: 200, clientY: 150 };

    drag.onStart(drag, ctx, event);

    var indexBefore = epA.index;

    // Override ratio to a large value so new_index stays 0 with yDelta=0
    ctx.ratio = 9999;
    ctx.topBorder = 0;
    drag.onDrag(event, drag, ctx, 0, 0);

    assert.equal(epA.index, indexBefore);
});

// -----------------------------------------------------------------------
// ENDPOINTGROUP.MIN_LENGTH TESTS
// -----------------------------------------------------------------------

test('MIN_LENGTH is 1', () => {
    assert.equal(Wirecloud.ui.WiringEditor.EndpointGroup.MIN_LENGTH, 1);
});

// -----------------------------------------------------------------------
// INTEGRATION: startOrdering + stopOrdering lifecycle
// -----------------------------------------------------------------------

test('startOrdering then stopOrdering - full lifecycle', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    assert.equal(group.orderable, false);
    assert.equal(group.children[0].draggable, null);

    group.startOrdering();
    assert.equal(group.orderable, true);
    assert.ok(group.children[0].draggable instanceof Wirecloud.ui.Draggable);
    assert.ok(group.children[1].draggable instanceof Wirecloud.ui.Draggable);

    group.stopOrdering();
    assert.equal(group.orderable, false);
    assert.equal(group.children[0].draggable._destroyed, true);
});

// -----------------------------------------------------------------------
// EDGE CASES
// -----------------------------------------------------------------------

test('appendEndpoint then removeChild returns group to empty state', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'x' }));
    group.removeChild(ep);

    assert.deepStrictEqual(group.endpoints, {});
    assert.deepStrictEqual(group.originalOrder, []);
    assert.equal(group.children.length, 0);
});

test('appendEndpoint missing then append normal before it', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'm1', missing: true }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'm2', missing: true }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'n1' }));

    assert.deepStrictEqual(group.originalOrder, ['n1']);
    assert.equal(group.children[0].name, 'n1');
    assert.equal(group.children[1].name, 'm1');
    assert.equal(group.children[2].name, 'm2');
    assert.equal(group.children[0].index, 0);
    assert.equal(group.children[1].index, 1);
    assert.equal(group.children[2].index, 2);
});

test('toJSON on reordered group via orderEndpoints', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'c' }));

    assert.deepStrictEqual(group.toJSON(), []);

    group.orderEndpoints(['c', 'a', 'b']);

    assert.deepStrictEqual(group.toJSON(), ['c', 'a', 'b']);
});

test('canBeOrdered after removeChild reduces length', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    const ep1 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    const ep2 = group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));

    assert.equal(group.canBeOrdered(), true);

    group.removeChild(ep1);
    assert.equal(group.canBeOrdered(), false);
});

test('modified getter with missing endpoints returns false', () => {
    const comp = makeComponent();
    const group = new Wirecloud.ui.WiringEditor.EndpointGroup('target', comp);

    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'b' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'a' }));
    group.appendEndpoint(makeWiringSourceEndpoint({ name: 'm', missing: true }));

    assert.equal(group.modified, false);
});
