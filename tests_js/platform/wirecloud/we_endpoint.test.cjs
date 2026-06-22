const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

const makeWiringSourceEndpoint = (overrides = {}) => {
    return Object.assign({
        name: 'output1',
        label: 'Output 1',
        description: 'An output endpoint',
        friendcodeList: ['output', 'data'],
        missing: false,
    }, overrides);
};

const makeWiringTargetEndpoint = (overrides = {}) => {
    return Object.assign({
        name: 'input1',
        label: 'Input 1',
        description: 'An input endpoint',
        friendcodeList: ['input', 'data'],
        missing: false,
    }, overrides);
};

const makeComponent = (overrides = {}) => {
    return Object.assign({
        id: 'comp-1',
        type: 'widget',
    }, overrides);
};

const makeMockConnection = (sourceId, targetId) => {
    return {
        _sourceId: sourceId,
        _targetId: targetId,
        _active: false,
        _refreshed: false,
        _activated: false,
        _deactivated: false,
        _refreshEndpointCalled: null,
        get sourceId() { return this._sourceId; },
        get targetId() { return this._targetId; },
        equals(other) {
            if (!(other instanceof Wirecloud.ui.WiringEditor.Connection)) return false;
            return this.sourceId === other.sourceId && this.targetId === other.targetId;
        },
        hasEndpoint(endpoint) {
            return endpoint.type === 'source'
                ? endpoint.id === this._sourceId
                : endpoint.id === this._targetId;
        },
        activate() { this._activated = true; return this; },
        deactivate() { this._deactivated = true; return this; },
        refresh() { this._refreshed = true; return this; },
        refreshEndpoint(endpoint) { this._refreshEndpointCalled = endpoint; return this; },
    };
};

// -----------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;

    // Wiring namespace with SourceEndpoint / TargetEndpoint class mocks
    Wirecloud.wiring = {};

    Wirecloud.wiring.SourceEndpoint = class SourceEndpoint {
        constructor(id, meta = {}) {
            this.id = id;
            this.name = meta.name || '';
            this.label = meta.label || '';
            this.description = meta.description || '';
            this.friendcode = meta.friendcode || '';
            this.friendcodeList = meta.friendcodeList || (meta.friendcode || '').split(' ').filter(Boolean);
            this.missing = meta.missing || false;
        }
    };

    Wirecloud.wiring.TargetEndpoint = class TargetEndpoint {
        constructor(id, meta = {}) {
            this.id = id;
            this.name = meta.name || '';
            this.label = meta.label || '';
            this.description = meta.description || '';
            this.friendcode = meta.friendcode || '';
            this.friendcodeList = meta.friendcodeList || (meta.friendcode || '').split(' ').filter(Boolean);
            this.missing = meta.missing || false;
        }
    };

    // Mock StyledElements.Popover
    StyledElements.Popover = class Popover {
        constructor(options = {}) {
            this.options = options;
            this._bound = null;
            this._boundEvent = null;
        }
        bind(element, event) {
            this._bound = element;
            this._boundEvent = event;
        }
    };

    // Setup Wirecloud.ui.WiringEditor namespace
    Wirecloud.ui = Wirecloud.ui || {};
    Wirecloud.ui.WiringEditor = {};

    // Mock Connection class (needed for instanceof checks and connection operations)
    Wirecloud.ui.WiringEditor.Connection = class Connection {
        constructor(sourceId, targetId) {
            this._sourceId = sourceId;
            this._targetId = targetId;
        }
        equals(other) {
            if (!(other instanceof Wirecloud.ui.WiringEditor.Connection)) return false;
            return this.sourceId === other.sourceId && this.targetId === other.targetId;
        }
        hasEndpoint(endpoint) {
            return endpoint.type === 'source'
                ? endpoint.id === this._sourceId
                : endpoint.id === this._targetId;
        }
        get sourceId() { return this._sourceId; }
        get targetId() { return this._targetId; }
        activate() { this._activated = true; return this; }
        deactivate() { this._deactivated = true; return this; }
        refresh() { this._refreshed = true; return this; }
        refreshEndpoint(endpoint) { this._refreshEndpointCalled = endpoint; return this; }
    };

    // Load the file under test
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/Endpoint.js',
    ]);
});

// =======================================================================
// CONSTRUCTOR
// =======================================================================

test('constructor with SourceEndpoint creates source type endpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.ok(ep instanceof StyledElements.StyledElement);
    assert.ok(ep instanceof Wirecloud.ui.WiringEditor.Endpoint);
    assert.equal(ep.type, 'source');
    assert.equal(ep.rightAnchorPoint, true);
    assert.equal(ep._endpoint, wiringEp);
    assert.equal(ep.component, comp);
});

test('constructor with TargetEndpoint creates target type endpoint', () => {
    const wiringEp = new Wirecloud.wiring.TargetEndpoint('te-1', makeWiringTargetEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.type, 'target');
    assert.equal(ep.rightAnchorPoint, false);
});

test('constructor throws TypeError for invalid wiringEndpoint', () => {
    const comp = makeComponent();

    assert.throws(
        () => new Wirecloud.ui.WiringEditor.Endpoint({}, comp),
        /invalid wiringEndpoint parameter/
    );
    assert.throws(
        () => new Wirecloud.ui.WiringEditor.Endpoint(null, comp),
        /invalid wiringEndpoint parameter/
    );
    assert.throws(
        () => new Wirecloud.ui.WiringEditor.Endpoint('not an endpoint', comp),
        /invalid wiringEndpoint parameter/
    );
});

test('constructor creates wrapperElement with correct class and role', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const wrapper = ep.get();
    assert.equal(wrapper.tagName, 'DIV');
    assert.ok(wrapper.classList.contains('endpoint'));
    assert.equal(wrapper.getAttribute('role'), 'button');
});

test('constructor creates titleElement and anchorElement', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.ok(ep.titleElement.tagName, 'SPAN');
    assert.ok(ep.titleElement.classList.contains('endpoint-title'));
    assert.equal(ep.titleElement.parentElement, ep.get());

    assert.ok(ep.anchorElement.tagName, 'SPAN');
    assert.ok(ep.anchorElement.classList.contains('endpoint-anchor'));
    assert.equal(ep.anchorElement.getAttribute('aria-hidden'), 'true');
    assert.equal(ep.anchorElement.parentElement, ep.get());
});

test('constructor initializes activeCount and connections', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.activeCount, 0);
    assert.deepEqual(ep.connections, []);
});

// --- Property: id ---

test('id property is constructed from component type, id, and endpoint name', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent({ id: 'my-comp', type: 'widget' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.id, 'widget/my-comp/output1');
});

test('id property with different values', () => {
    const wiringEp = new Wirecloud.wiring.TargetEndpoint('te-2', makeWiringTargetEndpoint({ name: 'inputX' }));
    const comp = makeComponent({ id: 'abc', type: 'operator' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.id, 'operator/abc/inputX');
});

// --- Property: index ---

test('index getter reads data-index attribute', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.get().setAttribute('data-index', '5');
    assert.equal(ep.index, 5);
});

test('index setter writes data-index attribute', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.index = 42;
    assert.equal(ep.get().getAttribute('data-index'), '42');
});

test('index getter returns NaN when data-index not set', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.ok(Number.isNaN(ep.index));
});

test('index getter/setter roundtrip', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.index = 7;
    assert.equal(ep.index, 7);
    ep.index = 0;
    assert.equal(ep.index, 0);
});

// --- Property: friendcodeList ---

test('friendcodeList property mirrors wiringEndpoint.friendcodeList', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ friendcodeList: ['a', 'b', 'c'] }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.deepEqual(ep.friendcodeList, ['a', 'b', 'c']);
});

// --- Property: missing ---

test('missing getter delegates to hasClassName', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.missing, false);
});

test('missing setter toggles className', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.missing = true;
    assert.equal(ep.missing, true);
    assert.ok(ep.hasClassName('missing'));

    ep.missing = false;
    assert.equal(ep.missing, false);
    assert.equal(ep.hasClassName('missing'), false);
});

test('constructor sets missing when wiringEndpoint.missing is true', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ missing: true }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.missing, true);
});

test('constructor does not set missing when wiringEndpoint.missing is false', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ missing: false }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.missing, false);
});

// --- Property: name ---

test('name property mirrors wiringEndpoint.name', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'customName' }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.name, 'customName');
});

// --- Property: title ---

test('title getter reads titleElement.textContent', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    // title is set from wiringEndpoint.label in constructor
    assert.equal(ep.title, 'Output 1');
});

test('title setter writes titleElement.textContent', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.title = 'New Title';
    assert.equal(ep.title, 'New Title');
    assert.equal(ep.titleElement.textContent, 'New Title');
});

// --- Property: type ---

test('type property is source for SourceEndpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.type, 'source');
});

test('type property is target for TargetEndpoint', () => {
    const wiringEp = new Wirecloud.wiring.TargetEndpoint('te-1', makeWiringTargetEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.type, 'target');
});

// --- data-name attribute ---

test('constructor sets data-name attribute on wrapperElement', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'myEp' }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.get().getAttribute('data-name'), 'myEp');
});

// --- Tooltip (Popover) ---

test('constructor creates tooltip with wiringEndpoint label and description', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({
        label: 'My Label',
        description: 'My Description'
    }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.ok(ep.tooltip instanceof StyledElements.Popover);
    assert.equal(ep.tooltip.options.title, 'My Label');
    assert.equal(ep.tooltip.options.content, 'My Description');
    assert.deepEqual(ep.tooltip.options.placement, ['top', 'bottom', 'right', 'left']);
});

test('tooltip uses default message when description is empty', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({
        label: 'My Label',
        description: ''
    }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.tooltip.options.content, 'No description provided.');
});

test('tooltip uses default message when description is nullish', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({
        label: 'My Label',
        description: null
    }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    // null !== '' so it uses null, which is '' falsy, but let's check
    assert.equal(ep.tooltip.options.content, 'No description provided.');
});

test('tooltip is bound to wrapperElement on hover', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.tooltip._bound, ep.get());
    assert.equal(ep.tooltip._boundEvent, 'hover');
});

// =======================================================================
// active getter / setter
// =======================================================================

test('active getter returns false initially', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.active, false);
});

test('active setter toggles active class', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.active = true;
    assert.equal(ep.active, true);
    assert.ok(ep.hasClassName('active'));

    ep.active = false;
    assert.equal(ep.active, false);
    assert.equal(ep.hasClassName('active'), false);
});

// =======================================================================
// activate()
// =======================================================================

test('activate sets active when activeCount is 0', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const result = ep.activate();

    assert.equal(ep.activeCount, 1);
    assert.equal(ep.active, true);
    assert.equal(result, ep);
});

test('activate increments activeCount without setting active when already active', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.activate(); // activeCount: 0→1, sets active=true
    ep.activate(); // activeCount: 1→2, doesn't set active again

    assert.equal(ep.activeCount, 2);
    assert.equal(ep.active, true);
});

test('activate returns this for chaining', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.activate(), ep);
});

// =======================================================================
// deactivate()
// =======================================================================

test('deactivate returns immediately when activeCount is 0', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const result = ep.deactivate();

    assert.equal(ep.activeCount, 0);
    assert.equal(ep.active, false);
    assert.equal(result, ep);
});

test('deactivate decrements activeCount and sets active false when reaches 0', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.activate(); // activeCount = 1, active = true
    ep.deactivate(); // activeCount = 0, active = false

    assert.equal(ep.activeCount, 0);
    assert.equal(ep.active, false);
});

test('deactivate decrements but does not change active when count remains > 0', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.activate(); // 0→1, active=true
    ep.activate(); // 1→2, active stays true
    ep.deactivate(); // 2→1, active still true

    assert.equal(ep.activeCount, 1);
    assert.equal(ep.active, true);
});

test('deactivate returns this for chaining', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.deactivate(), ep);
});

// =======================================================================
// toggleActive()
// =======================================================================

test('toggleActive with true calls activate', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const result = ep.toggleActive(true);

    assert.equal(ep.activeCount, 1);
    assert.equal(ep.active, true);
    assert.equal(result, ep);
});

test('toggleActive with false calls deactivate', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.activate(); // activeCount=1
    const result = ep.toggleActive(false);

    assert.equal(ep.activeCount, 0);
    assert.equal(ep.active, false);
    assert.equal(result, ep);
});

// =======================================================================
// appendConnection()
// =======================================================================

test('appendConnection pushes connection and dispatches event', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');
    let dispatched = null;
    ep.addEventListener('connectionadded', (endpoint, connection) => {
        dispatched = connection;
    });

    const result = ep.appendConnection(conn);

    assert.equal(ep.connections.length, 1);
    assert.equal(ep.connections[0], conn);
    assert.equal(dispatched, conn);
    assert.equal(result, ep);
});

test('appendConnection with updateEndpoint truthy calls refreshEndpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');

    ep.appendConnection(conn, true);

    assert.equal(conn._refreshEndpointCalled, ep);
});

test('appendConnection with updateEndpoint falsy does not call refreshEndpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');

    ep.appendConnection(conn, false);

    assert.equal(conn._refreshEndpointCalled, undefined);
});

test('appendConnection with updateEndpoint undefined does not call refreshEndpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');

    ep.appendConnection(conn);

    assert.equal(conn._refreshEndpointCalled, undefined);
});

test('appendConnection with updateEndpoint 0 does not call refreshEndpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');

    ep.appendConnection(conn, 0);

    assert.equal(conn._refreshEndpointCalled, undefined);
});

// =======================================================================
// removeConnection()
// =======================================================================

test('removeConnection removes connection from list and dispatches event', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');
    ep.connections.push(conn);

    let dispatched = null;
    ep.addEventListener('connectionremoved', (endpoint, connection) => {
        dispatched = connection;
    });

    const result = ep.removeConnection(conn);

    assert.equal(ep.connections.length, 0);
    assert.equal(dispatched, conn);
    assert.equal(result, ep);
});

test('removeConnection with connection not in list does nothing', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn1 = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');
    const conn2 = new Wirecloud.ui.WiringEditor.Connection('id3', 'id4');
    ep.connections.push(conn1);

    let dispatched = null;
    ep.addEventListener('connectionremoved', () => {
        dispatched = true;
    });

    const result = ep.removeConnection(conn2);

    assert.equal(ep.connections.length, 1);
    assert.equal(ep.connections[0], conn1);
    assert.equal(dispatched, null);
    assert.equal(result, ep);
});

test('removeConnection with empty connections list does nothing', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');

    let dispatched = null;
    ep.addEventListener('connectionremoved', () => {
        dispatched = true;
    });

    ep.removeConnection(conn);

    assert.equal(ep.connections.length, 0);
    assert.equal(dispatched, null);
});

// =======================================================================
// hasConnections()
// =======================================================================

test('hasConnections returns false when empty', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.hasConnections(), false);
});

test('hasConnections returns true when connections exist', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.connections.push(new Wirecloud.ui.WiringEditor.Connection('id1', 'id2'));

    assert.equal(ep.hasConnections(), true);
});

// =======================================================================
// hasConnection()
// =======================================================================

test('hasConnection returns false for non-Connection instance', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.hasConnection({}), false);
    assert.equal(ep.hasConnection(null), false);
    assert.equal(ep.hasConnection('not a connection'), false);
});

test('hasConnection returns true when connection is in list', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp = makeComponent({ id: 'c', type: 'widget' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('widget/c/ep1', 'target');
    ep.connections.push(conn);

    assert.equal(ep.hasConnection(conn), true);
});

test('hasConnection returns false when connection is not in list', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp = makeComponent({ id: 'c', type: 'widget' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn1 = new Wirecloud.ui.WiringEditor.Connection('widget/c/ep1', 't1');
    const conn2 = new Wirecloud.ui.WiringEditor.Connection('other', 't2');
    ep.connections.push(conn1);

    assert.equal(ep.hasConnection(conn2), false);
});

// =======================================================================
// hasConnectionTo()
// =======================================================================

test('hasConnectionTo returns true when connection has the given endpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp = makeComponent({ id: 'c', type: 'widget' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('widget/c/ep1', 'widget/c/target1');
    ep.connections.push(conn);

    // Create a target endpoint with the same id as the connection's targetId
    const targetEp = new Wirecloud.wiring.TargetEndpoint('te', { name: 'target1' });
    const targetComp = makeComponent({ id: 'c', type: 'widget' });
    const targetUiEp = new Wirecloud.ui.WiringEditor.Endpoint(targetEp, targetComp);

    assert.equal(ep.hasConnectionTo(targetUiEp), true);
});

test('hasConnectionTo returns false when no connection has the given endpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp = makeComponent({ id: 'c', type: 'widget' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('widget/c/ep1', 'widget/c/target1');
    ep.connections.push(conn);

    // Create a different target endpoint
    const otherEp = new Wirecloud.wiring.TargetEndpoint('te', { name: 'otherEp' });
    const otherComp = makeComponent({ id: 'c', type: 'widget' });
    const otherUiEp = new Wirecloud.ui.WiringEditor.Endpoint(otherEp, otherComp);

    assert.equal(ep.hasConnectionTo(otherUiEp), false);
});

test('hasConnectionTo returns false when connections list is empty', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const otherEp = new Wirecloud.wiring.TargetEndpoint('te', { name: 'any' });
    const otherComp = makeComponent();
    const otherUiEp = new Wirecloud.ui.WiringEditor.Endpoint(otherEp, otherComp);

    assert.equal(ep.hasConnectionTo(otherUiEp), false);
});

// =======================================================================
// getConnectionTo()
// =======================================================================

test('getConnectionTo returns the connection with the given endpoint', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp = makeComponent({ id: 'c', type: 'widget' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('widget/c/ep1', 'widget/c/target1');
    ep.connections.push(conn);

    const targetEp = new Wirecloud.wiring.TargetEndpoint('te', { name: 'target1' });
    const targetComp = makeComponent({ id: 'c', type: 'widget' });
    const targetUiEp = new Wirecloud.ui.WiringEditor.Endpoint(targetEp, targetComp);

    const result = ep.getConnectionTo(targetUiEp);

    assert.equal(result, conn);
});

test('getConnectionTo returns null when no match', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp = makeComponent({ id: 'c', type: 'widget' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const targetEp = new Wirecloud.wiring.TargetEndpoint('te', { name: 'targetX' });
    const targetComp = makeComponent({ id: 'c', type: 'widget' });
    const targetUiEp = new Wirecloud.ui.WiringEditor.Endpoint(targetEp, targetComp);

    const result = ep.getConnectionTo(targetUiEp);

    assert.equal(result, null);
});

test('getConnectionTo returns null when connections list is empty', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const targetEp = new Wirecloud.wiring.TargetEndpoint('te', { name: 'any' });
    const targetComp = makeComponent();
    const targetUiEp = new Wirecloud.ui.WiringEditor.Endpoint(targetEp, targetComp);

    const result = ep.getConnectionTo(targetUiEp);

    assert.equal(result, null);
});

test('getConnectionTo returns first match with find semantics', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp = makeComponent({ id: 'c', type: 'widget' });
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn1 = new Wirecloud.ui.WiringEditor.Connection('widget/c/ep1', 'widget/c/target1');
    const conn2 = new Wirecloud.ui.WiringEditor.Connection('widget/c/ep1', 'widget/c/target1');
    ep.connections.push(conn1, conn2);

    const targetEp = new Wirecloud.wiring.TargetEndpoint('te', { name: 'target1' });
    const targetComp = makeComponent({ id: 'c', type: 'widget' });
    const targetUiEp = new Wirecloud.ui.WiringEditor.Endpoint(targetEp, targetComp);

    const result = ep.getConnectionTo(targetUiEp);

    assert.equal(result, conn1); // find returns first match
});

// =======================================================================
// equals()
// =======================================================================

test('equals returns true for same type and same id', () => {
    const wiringEp1 = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp1 = makeComponent({ id: 'c', type: 'widget' });
    const ep1 = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp1, comp1);

    const wiringEp2 = new Wirecloud.wiring.SourceEndpoint('se-2', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp2 = makeComponent({ id: 'c', type: 'widget' });
    const ep2 = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp2, comp2);

    assert.equal(ep1.equals(ep2), true);
    assert.equal(ep2.equals(ep1), true);
});

test('equals returns false for different types', () => {
    const wiringEpSrc = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp = makeComponent({ id: 'c', type: 'widget' });
    const epSrc = new Wirecloud.ui.WiringEditor.Endpoint(wiringEpSrc, comp);

    const wiringEpTgt = new Wirecloud.wiring.TargetEndpoint('te-1', makeWiringTargetEndpoint({ name: 'ep1' }));
    const epTgt = new Wirecloud.ui.WiringEditor.Endpoint(wiringEpTgt, comp);

    assert.equal(epSrc.equals(epTgt), false);
});

test('equals returns false for different ids', () => {
    const wiringEp1 = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp1 = makeComponent({ id: 'c', type: 'widget' });
    const ep1 = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp1, comp1);

    const wiringEp2 = new Wirecloud.wiring.SourceEndpoint('se-2', makeWiringSourceEndpoint({ name: 'ep2' }));
    const comp2 = makeComponent({ id: 'c', type: 'widget' });
    const ep2 = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp2, comp2);

    assert.equal(ep1.equals(ep2), false);
});

test('equals returns false for different component types', () => {
    const wiringEp1 = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp1 = makeComponent({ id: 'c', type: 'widget' });
    const ep1 = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp1, comp1);

    const wiringEp2 = new Wirecloud.wiring.SourceEndpoint('se-2', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp2 = makeComponent({ id: 'c', type: 'operator' });
    const ep2 = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp2, comp2);

    // type is determined by SourceEndpoint/TargetEndpoint, not component.type
    // Both are 'source' type, but ids differ: widget/c/ep1 vs operator/c/ep1
    assert.equal(ep1.equals(ep2), false);
});

test('equals returns false for non-Endpoint argument', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.equals({}), false);
    assert.equal(ep.equals(null), false);
    assert.equal(ep.equals('not an endpoint'), false);
    assert.equal(ep.equals(undefined), false);
});

test('equals returns self-equality', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.equals(ep), true);
});

// =======================================================================
// forEachConnection()
// =======================================================================

test('forEachConnection iterates connections in reverse order', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn1 = new Wirecloud.ui.WiringEditor.Connection('a', 'b');
    const conn2 = new Wirecloud.ui.WiringEditor.Connection('c', 'd');
    ep.connections.push(conn1, conn2);

    const visited = [];
    ep.forEachConnection((connection, index) => {
        visited.push({ connection, index });
    });

    assert.equal(visited.length, 2);
    assert.equal(visited[0].connection, conn2);
    assert.equal(visited[0].index, 1);
    assert.equal(visited[1].connection, conn1);
    assert.equal(visited[1].index, 0);
});

test('forEachConnection returns this', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const result = ep.forEachConnection(() => {});

    assert.equal(result, ep);
});

test('forEachConnection does not call callback when connections is empty', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let called = false;
    ep.forEachConnection(() => { called = true; });

    assert.equal(called, false);
});

// =======================================================================
// activateAll()
// =======================================================================

test('activateAll calls activate on all connections', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn1 = new Wirecloud.ui.WiringEditor.Connection('a', 'b');
    const conn2 = new Wirecloud.ui.WiringEditor.Connection('c', 'd');
    ep.connections.push(conn1, conn2);

    const result = ep.activateAll();

    assert.equal(conn1._activated, true);
    assert.equal(conn2._activated, true);
    assert.equal(result, ep);
});

test('activateAll with empty connections returns this', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const result = ep.activateAll();

    assert.equal(result, ep);
});

// =======================================================================
// deactivateAll()
// =======================================================================

test('deactivateAll calls deactivate on all connections', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn1 = new Wirecloud.ui.WiringEditor.Connection('a', 'b');
    const conn2 = new Wirecloud.ui.WiringEditor.Connection('c', 'd');
    ep.connections.push(conn1, conn2);

    const result = ep.deactivateAll();

    assert.equal(conn1._deactivated, true);
    assert.equal(conn2._deactivated, true);
    assert.equal(result, ep);
});

test('deactivateAll with empty connections returns this', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const result = ep.deactivateAll();

    assert.equal(result, ep);
});

// =======================================================================
// refresh()
// =======================================================================

test('refresh calls refresh on all connections', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn1 = new Wirecloud.ui.WiringEditor.Connection('a', 'b');
    const conn2 = new Wirecloud.ui.WiringEditor.Connection('c', 'd');
    ep.connections.push(conn1, conn2);

    const result = ep.refresh();

    assert.equal(conn1._refreshed, true);
    assert.equal(conn2._refreshed, true);
    assert.equal(result, ep);
});

test('refresh with empty connections returns this', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const result = ep.refresh();

    assert.equal(result, ep);
});

// =======================================================================
// anchorPosition getter
// =======================================================================

test('anchorPosition computes position for target endpoint (left side)', () => {
    const wiringEp = new Wirecloud.wiring.TargetEndpoint('te-1', makeWiringTargetEndpoint());
    const layoutEl = document.createElement('div');
    layoutEl.getBoundingClientRect = () => ({ left: 10, top: 10, width: 0, height: 0 });
    layoutEl.scrollLeft = 5;
    layoutEl.scrollTop = 3;

    const comp = makeComponent();
    comp.parent = () => layoutEl;

    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);
    ep.anchorElement.getBoundingClientRect = () => ({ left: 20, top: 20, width: 10, height: 8 });
    ep.anchorElement.offsetHeight = 8;

    const pos = ep.anchorPosition;

    // x = anchorBCR.left - (layoutBCR.left + 1) + layout.scrollLeft
    //   = 20 - (10 + 1) + 5 = 14
    // y = anchorBCR.top + (offsetHeight / 2) - (layoutBCR.top + 1) + layout.scrollTop
    //   = 20 + (8 / 2) - (10 + 1) + 3 = 20 + 4 - 11 + 3 = 16
    assert.equal(pos.x, 14);
    assert.equal(pos.y, 16);
});

test('anchorPosition computes position for source endpoint (right side)', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const layoutEl = document.createElement('div');
    layoutEl.getBoundingClientRect = () => ({ left: 100, top: 50, width: 0, height: 0 });
    layoutEl.scrollLeft = 10;
    layoutEl.scrollTop = 20;

    const comp = makeComponent();
    comp.parent = () => layoutEl;

    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);
    ep.anchorElement.getBoundingClientRect = () => ({ left: 120, top: 70, width: 10, height: 6 });
    ep.anchorElement.offsetHeight = 6;

    const pos = ep.anchorPosition;

    // x = anchorBCR.left - (layoutBCR.left + 1) + layout.scrollLeft
    //   = 120 - (100 + 1) + 10 = 29
    // but rightAnchorPoint is true:
    // x = Math.round(x + anchorBCR.width) = 29 + 10 = 39
    // y = 70 + (6 / 2) - (50 + 1) + 20 = 70 + 3 - 51 + 20 = 42
    assert.equal(pos.x, 39);
    assert.equal(pos.y, 42);
});

test('anchorPosition with rightAnchorPoint false does not add width', () => {
    const wiringEp = new Wirecloud.wiring.TargetEndpoint('te-1', makeWiringTargetEndpoint());
    const layoutEl = document.createElement('div');
    layoutEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    layoutEl.scrollLeft = 0;
    layoutEl.scrollTop = 0;

    const comp = makeComponent();
    comp.parent = () => layoutEl;

    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);
    ep.anchorElement.getBoundingClientRect = () => ({ left: 50, top: 30, width: 8, height: 4 });
    ep.anchorElement.offsetHeight = 4;

    const pos = ep.anchorPosition;

    // For target, rightAnchorPoint is false
    // x = 50 - (0 + 1) + 0 = 49
    // y = 30 + 2 - (0 + 1) + 0 = 31
    assert.equal(pos.x, 49);
    assert.equal(pos.y, 31);
});

// =======================================================================
// DOM event handlers (static closure functions via wrapperElement listeners)
// =======================================================================

test('mousedown on enabled endpoint dispatches mousedown event', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let dispatched = false;
    ep.addEventListener('mousedown', () => { dispatched = true; });

    const event = {
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
        type: 'mousedown',
    };

    // Find and invoke the mousedown listener on the wrapperElement
    const mousedownListeners = ep.get().listeners['mousedown'];
    assert.ok(mousedownListeners != null && mousedownListeners.length > 0);
    mousedownListeners[0](event);

    assert.equal(dispatched, true);
});

test('mousedown on disabled endpoint does not dispatch', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);
    ep.disable();

    let dispatched = false;
    ep.addEventListener('mousedown', () => { dispatched = true; });

    const event = {
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
        type: 'mousedown',
    };

    const mousedownListeners = ep.get().listeners['mousedown'];
    mousedownListeners[0](event);

    assert.equal(dispatched, false);
});

test('mousedown with button !== 0 does not dispatch', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let dispatched = false;
    ep.addEventListener('mousedown', () => { dispatched = true; });

    const event = {
        button: 2,
        stopPropagation: () => {},
        preventDefault: () => {},
        type: 'mousedown',
    };

    const mousedownListeners = ep.get().listeners['mousedown'];
    mousedownListeners[0](event);

    assert.equal(dispatched, false);
});

test('mousedown calls stopPropagation and preventDefault when processing', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let stopped = false;
    let prevented = false;

    const event = {
        button: 0,
        stopPropagation: () => { stopped = true; },
        preventDefault: () => { prevented = true; },
        type: 'mousedown',
    };

    const mousedownListeners = ep.get().listeners['mousedown'];
    mousedownListeners[0](event);

    assert.equal(stopped, true);
    assert.equal(prevented, true);
});

test('mouseenter on enabled endpoint dispatches mouseenter event', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let dispatched = false;
    ep.addEventListener('mouseenter', () => { dispatched = true; });

    const event = {
        stopPropagation: () => {},
        type: 'mouseenter',
    };

    const listeners = ep.get().listeners['mouseenter'];
    assert.ok(listeners != null && listeners.length > 0);
    listeners[0](event);

    assert.equal(dispatched, true);
});

test('mouseenter on disabled endpoint does not dispatch', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);
    ep.disable();

    let dispatched = false;
    ep.addEventListener('mouseenter', () => { dispatched = true; });

    const event = {
        stopPropagation: () => {},
        type: 'mouseenter',
    };

    const listeners = ep.get().listeners['mouseenter'];
    listeners[0](event);

    assert.equal(dispatched, false);
});

test('mouseleave on enabled endpoint dispatches mouseleave event', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let dispatched = false;
    ep.addEventListener('mouseleave', () => { dispatched = true; });

    const event = {
        stopPropagation: () => {},
        type: 'mouseleave',
    };

    const listeners = ep.get().listeners['mouseleave'];
    assert.ok(listeners != null && listeners.length > 0);
    listeners[0](event);

    assert.equal(dispatched, true);
});

test('mouseleave on disabled endpoint does not dispatch', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);
    ep.disable();

    let dispatched = false;
    ep.addEventListener('mouseleave', () => { dispatched = true; });

    const event = {
        stopPropagation: () => {},
        type: 'mouseleave',
    };

    const listeners = ep.get().listeners['mouseleave'];
    listeners[0](event);

    assert.equal(dispatched, false);
});

test('mouseup on enabled endpoint dispatches mouseup event', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let dispatched = false;
    ep.addEventListener('mouseup', () => { dispatched = true; });

    const event = {
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
        type: 'mouseup',
    };

    const listeners = ep.get().listeners['mouseup'];
    assert.ok(listeners != null && listeners.length > 0);
    listeners[0](event);

    assert.equal(dispatched, true);
});

test('mouseup on disabled endpoint does not dispatch', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);
    ep.disable();

    let dispatched = false;
    ep.addEventListener('mouseup', () => { dispatched = true; });

    const event = {
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
        type: 'mouseup',
    };

    const listeners = ep.get().listeners['mouseup'];
    listeners[0](event);

    assert.equal(dispatched, false);
});

test('mouseup with button !== 0 does not dispatch', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let dispatched = false;
    ep.addEventListener('mouseup', () => { dispatched = true; });

    const event = {
        button: 1,
        stopPropagation: () => {},
        preventDefault: () => {},
        type: 'mouseup',
    };

    const listeners = ep.get().listeners['mouseup'];
    listeners[0](event);

    assert.equal(dispatched, false);
});

test('mouseup calls stopPropagation and preventDefault', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    let stopped = false;
    let prevented = false;

    const event = {
        button: 0,
        stopPropagation: () => { stopped = true; },
        preventDefault: () => { prevented = true; },
        type: 'mouseup',
    };

    const listeners = ep.get().listeners['mouseup'];
    listeners[0](event);

    assert.equal(stopped, true);
    assert.equal(prevented, true);
});

// =======================================================================
// Multiple connections operations
// =======================================================================

test('multiple connections with appendConnection, removeConnection, and hasConnections', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.hasConnections(), false);

    const conn1 = new Wirecloud.ui.WiringEditor.Connection('a', 'b');
    const conn2 = new Wirecloud.ui.WiringEditor.Connection('c', 'd');

    ep.appendConnection(conn1);
    assert.equal(ep.hasConnections(), true);
    assert.equal(ep.connections.length, 1);

    ep.appendConnection(conn2);
    assert.equal(ep.connections.length, 2);

    ep.removeConnection(conn1);
    assert.equal(ep.connections.length, 1);
    assert.equal(ep.connections[0], conn2);

    ep.removeConnection(conn2);
    assert.equal(ep.hasConnections(), false);
    assert.equal(ep.connections.length, 0);
});

// =======================================================================
// edge cases: deactivate with count > 0 when initial deactivate would early-return
// =======================================================================

test('deactivate when activeCount > 1 decrements but keeps active true', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.activate(); // count=1, active=true
    ep.activate(); // count=2, active stays true
    ep.activate(); // count=3

    ep.deactivate(); // count=2, active stays true

    assert.equal(ep.activeCount, 2);
    assert.equal(ep.active, true);
});

test('multiple activate/deactivate cycles reset properly', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.activate();   // 1
    ep.activate();   // 2
    ep.deactivate(); // 1
    ep.deactivate(); // 0 -> active=false

    assert.equal(ep.activeCount, 0);
    assert.equal(ep.active, false);
});

test('deactivate below 0 does nothing (already at 0 early return)', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    ep.deactivate(); // count already 0, early return
    ep.deactivate(); // still 0

    assert.equal(ep.activeCount, 0);
    assert.equal(ep.active, false);
});

// =======================================================================
// toggleActive edge cases
// =======================================================================

test('toggleActive false when activeCount is 0 returns this without changing state', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const result = ep.toggleActive(false);

    assert.equal(ep.activeCount, 0);
    assert.equal(ep.active, false);
    assert.equal(result, ep);
});

// =======================================================================
// equals edge case: same type but different id (component ids differ)
// =======================================================================

test('equals returns false when component ids differ', () => {
    const wiringEp1 = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp1 = makeComponent({ id: 'comp-a', type: 'widget' });
    const ep1 = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp1, comp1);

    const wiringEp2 = new Wirecloud.wiring.SourceEndpoint('se-2', makeWiringSourceEndpoint({ name: 'ep1' }));
    const comp2 = makeComponent({ id: 'comp-b', type: 'widget' });
    const ep2 = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp2, comp2);

    // ids: widget/comp-a/ep1 vs widget/comp-b/ep1 → different
    assert.equal(ep1.equals(ep2), false);
});

// =======================================================================
// dispatchEvent for connectionadded passes correct args
// =======================================================================

test('connectionadded event passes endpoint and connection to listener', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');
    let capturedEndpoint = null;
    let capturedConnection = null;

    ep.addEventListener('connectionadded', (endpoint, connection) => {
        capturedEndpoint = endpoint;
        capturedConnection = connection;
    });

    ep.appendConnection(conn);

    assert.equal(capturedEndpoint, ep);
    assert.equal(capturedConnection, conn);
});

test('connectionremoved event passes endpoint and connection to listener', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const conn = new Wirecloud.ui.WiringEditor.Connection('id1', 'id2');
    ep.connections.push(conn);

    let capturedEndpoint = null;
    let capturedConnection = null;

    ep.addEventListener('connectionremoved', (endpoint, connection) => {
        capturedEndpoint = endpoint;
        capturedConnection = connection;
    });

    ep.removeConnection(conn);

    assert.equal(capturedEndpoint, ep);
    assert.equal(capturedConnection, conn);
});

// =======================================================================
// Multiple event handlers registered on wrapperElement
// =======================================================================

test('wrapperElement has all four event listeners registered', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const wrapper = ep.get();
    assert.ok(wrapper.listeners.mousedown != null && wrapper.listeners.mousedown.length > 0);
    assert.ok(wrapper.listeners.mouseenter != null && wrapper.listeners.mouseenter.length > 0);
    assert.ok(wrapper.listeners.mouseleave != null && wrapper.listeners.mouseleave.length > 0);
    assert.ok(wrapper.listeners.mouseup != null && wrapper.listeners.mouseup.length > 0);
});

// =======================================================================
// Constructor: rightAnchorPoint for source vs target
// =======================================================================

test('rightAnchorPoint is true for source endpoints', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.rightAnchorPoint, true);
});

test('rightAnchorPoint is false for target endpoints', () => {
    const wiringEp = new Wirecloud.wiring.TargetEndpoint('te-1', makeWiringTargetEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.equal(ep.rightAnchorPoint, false);
});

// =======================================================================
// Constructor: friendcodeList property is writable? (it's a value, not function)
// =======================================================================

test('friendcodeList property is readable', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint({ friendcodeList: ['x', 'y'] }));
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    assert.deepEqual(ep.friendcodeList, ['x', 'y']);
});

// =======================================================================
// Constructor: id property is non-writable (defined with only value)
// =======================================================================

test('id property is a plain value (non-writable as Object.defineProperties default)', () => {
    const wiringEp = new Wirecloud.wiring.SourceEndpoint('se-1', makeWiringSourceEndpoint());
    const comp = makeComponent();
    const ep = new Wirecloud.ui.WiringEditor.Endpoint(wiringEp, comp);

    const originalId = ep.id;
    ep.id = 'new';
    // Property is defined with {value: ...} (non-writable), assignment silently fails
    assert.equal(ep.id, originalId);
});
