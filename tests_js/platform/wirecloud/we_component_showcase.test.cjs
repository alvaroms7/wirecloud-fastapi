const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// ---------------------------------------------------------------------------
// Shared mutable state for mock instances (reset in beforeEach)
// ---------------------------------------------------------------------------
let lastToggleButtonInstances;
let lastFragmentInstances;
let lastMACSearchInstances;
let lastComponentGroupInstances;
let lastComponentInstances;
let lastDraggableInstances;
let searchEventHandlers;

function mockToggleButton() {
    StyledElements.ToggleButton = class ToggleButton extends StyledElements.StyledElement {
        constructor(options) {
            super(['click', 'blur', 'focus']);
            this.options = options;
            this._active = false;
            this._clickHandlers = [];
            lastToggleButtonInstances.push(this);
        }
        get active() { return this._active; }
        set active(v) { this._active = v; }
        addEventListener(type, handler) {
            if (type === 'click') {
                this._clickHandlers.push(handler);
            } else {
                super.addEventListener(type, handler);
            }
            return this;
        }
        _click() {
            this._clickHandlers.forEach((fn) => fn());
        }
    };
}

function mockFragment() {
    StyledElements.Fragment = class Fragment extends StyledElements.StyledElement {
        constructor(children) {
            super([]);
            this.children = children || [];
            this.wrapperElement = document.createElement('div');
            lastFragmentInstances.push(this);
        }
    };
}

function mockMACSearch() {
    Wirecloud.ui.MACSearch = class MACSearch extends StyledElements.StyledElement {
        constructor(config) {
            super(['search', 'change', 'focus', 'blur']);
            this.config = config;
            this._searchScope = config.scope || 'widget';
            this._listeners = {};
            this.wrapperElement = document.createElement('div');
            this.wrapperElement.className = 'macsearch-wrapper';
            lastMACSearchInstances.push(this);
        }
        get search_scope() { return this._searchScope; }
        set search_scope(v) { this._searchScope = v; }
        addEventListener(type, handler) {
            if (type === 'search') {
                searchEventHandlers.push(handler);
            }
            super.addEventListener(type, handler);
            return this;
        }
        refresh() { this._refreshed = true; }
        clear() { this._cleared = true; }
        get() { return this.wrapperElement; }
    };
}

function mockComponentGroup() {
    const WiringEditor = Wirecloud.ui.WiringEditor;
    WiringEditor.ComponentGroup = class ComponentGroup extends StyledElements.StyledElement {
        constructor(groupData) {
            super(['btncreate.click', 'hide', 'show']);
            this._groupData = groupData;
            this._listeners = {};
            this._btncreateClickHandlers = [];
            this.id = groupData.id || (groupData.vendor + '/' + groupData.name);
            this.wrapperElement = document.createElement('div');
            this.components = [];
            lastComponentGroupInstances.push(this);
        }
        addEventListener(type, handler) {
            if (type === 'btncreate.click') {
                this._btncreateClickHandlers.push(handler);
            }
            super.addEventListener(type, handler);
            return this;
        }
        addComponent(comp) {
            this.components.push(comp);
            return this;
        }
        _btncreateClick(button) {
            // Simulate Event.dispatch: handler receives (context, button)
            this._btncreateClickHandlers.forEach((fn) => fn(this, button));
        }
    };
}

function mockComponent() {
    const WiringEditor = Wirecloud.ui.WiringEditor;
    WiringEditor.Component = class Component extends StyledElements.StyledElement {
        constructor(wiringComponent) {
            super(['change', 'hide', 'show']);
            this.wrapperElement = document.createElement('div');
            this.wrapperElement.className = 'component-mock';
            this._wiringComponent = wiringComponent;
            this.id = wiringComponent.id;
            this._used = false;
            this.heading = {
                wrapperElement: document.createElement('div'),
            };
            this._removed = false;
            this.enabled = true;
            lastComponentInstances.push(this);
        }
        get used() { return this._used; }
        set used(v) { this._used = v; }
        get() { return this.wrapperElement; }
        addClassName(cls) { this.wrapperElement.classList.add(...cls.split(/\s+/)); return this; }
        removeClassName(cls) { this.wrapperElement.classList.remove(...cls.split(/\s+/)); return this; }
        position(pos) { this._position = pos; return this; }
        remove() { this._removed = true; }
        toJSON() { return { id: this.id }; }
        appendTo(parent) { parent.appendChild(this.wrapperElement); return this; }
    };
}

function mockDraggable() {
    Wirecloud.ui.Draggable = class Draggable {
        constructor(handler, data, onStart, onDrag, onFinish, canBeDragged) {
            this.handler = handler;
            this.data = data;
            this.onStart = onStart;
            this.onDrag = onDrag;
            this.onFinish = onFinish;
            this.canBeDragged = canBeDragged;
            this._destroyed = false;
            lastDraggableInstances.push(this);
        }
        destroy() { this._destroyed = true; }
    };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeWiringComponent(overrides) {
    return Object.assign({
        id: 'comp-1',
        meta: {
            type: 'widget',
            group_id: 'TestVendor/TestWidget'
        },
        title: 'Test Component',
        eventListeners: {},
        addEventListener() {},
    }, overrides);
}

// ---------------------------------------------------------------------------
// beforeEach – bootstrap
// ---------------------------------------------------------------------------
test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    lastToggleButtonInstances = [];
    lastFragmentInstances = [];
    lastMACSearchInstances = [];
    lastComponentGroupInstances = [];
    lastComponentInstances = [];
    lastDraggableInstances = [];
    searchEventHandlers = [];

    // Wirecloud namespace
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = {};
    Wirecloud.ui.WiringEditor = {};

    // Install mocks
    mockToggleButton();
    mockFragment();
    mockMACSearch();
    mockComponentGroup();
    mockComponent();
    mockDraggable();

    // Load the file under test
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentShowcase.js',
    ]);
});

// =============================================================================
// Constructor tests
// =============================================================================

test('constructor creates instance extending StyledElement', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.ok(cs instanceof StyledElements.StyledElement);
    assert.ok(cs instanceof Wirecloud.ui.WiringEditor.ComponentShowcase);
});

test('constructor initializes components as {operator: {}, widget: {}}', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.deepStrictEqual(cs.components, { operator: {}, widget: {} });
});

test('constructor initializes groups as empty object', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.deepStrictEqual(cs.groups, {});
});

test('constructor creates two ToggleButton instances (operator + widget)', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.equal(lastToggleButtonInstances.length, 2);
});

test('constructor creates operatorButton with correct options', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const opBtn = lastToggleButtonInstances[0];
    assert.equal(opBtn.options.class, 'btn-list-operator-group');
    assert.equal(opBtn.options.state, 'primary');
    assert.equal(opBtn.options.text, 'Operators');
});

test('constructor creates widgetButton with correct options', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const widgetBtn = lastToggleButtonInstances[1];
    assert.equal(widgetBtn.options.class, 'btn-list-widget-group');
    assert.equal(widgetBtn.options.state, 'primary');
    assert.equal(widgetBtn.options.text, 'Widgets');
});

test('constructor creates a Fragment with both buttons', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.equal(lastFragmentInstances.length, 1);
    const frag = lastFragmentInstances[0];
    assert.ok(frag.children[0] instanceof StyledElements.ToggleButton);
    assert.ok(frag.children[1] instanceof StyledElements.ToggleButton);
});

test('constructor creates MACSearch with correct template', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.equal(lastMACSearchInstances.length, 1);
    const mac = lastMACSearchInstances[0];
    assert.equal(mac.config.template, 'wirecloud/component_sidebar');
});

test('constructor creates MACSearch with scope widget', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    assert.equal(mac.config.scope, 'widget');
});

test('constructor creates MACSearch with Fragment in extra_template_context', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    assert.ok(mac.config.extra_template_context.typebuttons instanceof StyledElements.Fragment);
});

test('constructor creates MACSearch with resource_painter function', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    assert.equal(typeof mac.config.resource_painter, 'object');
    assert.equal(typeof mac.config.resource_painter.paint, 'function');
});

test('constructor registers search event handler (to clear groups)', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.equal(searchEventHandlers.length, 1);
});

test('constructor sets widgetButton active to true by default', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const widgetBtn = lastToggleButtonInstances[1];
    assert.equal(widgetBtn.active, true);
});

test('constructor sets wrapperElement from MACSearch get()', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    assert.equal(cs.wrapperElement, mac.wrapperElement);
});

test('constructor stores searchComponents reference', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.ok(cs.searchComponents instanceof Wirecloud.ui.MACSearch);
    assert.equal(cs.searchComponents, lastMACSearchInstances[0]);
});

// =============================================================================
// ToggleButton click handlers
// =============================================================================

test('operatorButton click sets active states and switches scope', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const opBtn = lastToggleButtonInstances[0];
    const widgetBtn = lastToggleButtonInstances[1];
    const mac = lastMACSearchInstances[0];

    // Initially widget is active
    assert.equal(opBtn.active, false);
    assert.equal(widgetBtn.active, true);

    opBtn._click();

    assert.equal(opBtn.active, true);
    assert.equal(widgetBtn.active, false);
    assert.equal(mac.search_scope, 'operator');
    assert.equal(mac._refreshed, true);
});

test('widgetButton click sets active states and switches scope', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    // First activate operator
    const opBtn = lastToggleButtonInstances[0];
    opBtn._click();

    const widgetBtn = lastToggleButtonInstances[1];
    const mac = lastMACSearchInstances[0];

    // Reset refresh flag
    mac._refreshed = false;

    widgetBtn._click();

    assert.equal(opBtn.active, false);
    assert.equal(widgetBtn.active, true);
    assert.equal(mac.search_scope, 'widget');
    assert.equal(mac._refreshed, true);
});

test('operatorButton click twice keeps operator active', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const opBtn = lastToggleButtonInstances[0];
    const widgetBtn = lastToggleButtonInstances[1];

    opBtn._click();
    opBtn._click();

    assert.equal(opBtn.active, true);
    assert.equal(widgetBtn.active, false);
});

// =============================================================================
// resource_painter.paint tests
// =============================================================================

test('resource_painter.paint creates ComponentGroup from group data', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;

    const groupData = { vendor: 'TestVendor', name: 'TestWidget', id: 'tv/tw' };
    const result = painter.paint(groupData);

    assert.equal(lastComponentGroupInstances.length, 1);
    assert.ok(lastComponentGroupInstances[0] instanceof Wirecloud.ui.WiringEditor.ComponentGroup);
    assert.equal(lastComponentGroupInstances[0]._groupData, groupData);
    assert.equal(result, lastComponentGroupInstances[0]);
});

test('resource_painter.paint registers btncreate.click on group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;

    const groupData = { vendor: 'TestVendor', name: 'TestWidget' };
    const group = painter.paint(groupData);

    assert.equal(group._btncreateClickHandlers.length, 1);
});

test('resource_painter.paint stores group in this.groups by id', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;

    const groupData = { vendor: 'TestVendor', name: 'TestWidget' };
    const group = painter.paint(groupData);

    assert.equal(cs.groups['TestVendor/TestWidget'], group);
});

test('resource_painter.paint returns the created group', () => {
    new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;

    const groupData = { vendor: 'V', name: 'N' };
    const group = painter.paint(groupData);
    assert.equal(group, lastComponentGroupInstances[0]);
});

test('resource_painter.paint adds existing operator components for group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    // Pre-populate operator components for a group
    const mockComp = { id: 'op-1', meta: {} };
    cs.components.operator['V/N'] = { 'op-1': mockComp };

    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;
    const group = painter.paint({ vendor: 'V', name: 'N' });

    assert.ok(group.components.includes(mockComp));
});

test('resource_painter.paint adds existing widget components for group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    const mockComp = { id: 'w-1', meta: {} };
    cs.components.widget['V/N'] = { 'w-1': mockComp };

    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;
    const group = painter.paint({ vendor: 'V', name: 'N' });

    assert.ok(group.components.includes(mockComp));
});

test('resource_painter.paint adds both operator and widget components for group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    const opComp = { id: 'op-x', meta: {} };
    const wComp = { id: 'w-x', meta: {} };
    cs.components.operator['V/N'] = { 'op-x': opComp };
    cs.components.widget['V/N'] = { 'w-x': wComp };

    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;
    const group = painter.paint({ vendor: 'V', name: 'N' });

    assert.ok(group.components.includes(opComp));
    assert.ok(group.components.includes(wComp));
    assert.equal(group.components.length, 2);
});

test('resource_painter.paint handles null operator components gracefully', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    // operator has no entry for this group (nullish)
    cs.components.operator = {};

    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;
    const group = painter.paint({ vendor: 'V', name: 'N' });

    // group created, no operator components added
    assert.equal(group.components.length, 0);
});

test('resource_painter.paint handles null operator for specific group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    cs.components.operator['V/N'] = null;

    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;

    assert.doesNotThrow(() => {
        painter.paint({ vendor: 'V', name: 'N' });
    });
});

test('resource_painter.paint handles null widget components gracefully', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    cs.components.widget = {};

    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;
    const group = painter.paint({ vendor: 'V', name: 'N' });

    assert.equal(group.components.length, 0);
});

// =============================================================================
// search event (clearAll)
// =============================================================================

test('search event clears groups', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    // Add some groups first
    cs.groups = { 'A/B': {}, 'C/D': {} };
    assert.deepStrictEqual(cs.groups, { 'A/B': {}, 'C/D': {} });

    // Trigger search
    searchEventHandlers.forEach((fn) => fn());

    assert.deepStrictEqual(cs.groups, {});
});

test('search event resets groups to empty', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    cs.groups = { 'x': 1, 'y': 2, 'z': 3 };
    searchEventHandlers.forEach((fn) => fn());
    assert.equal(Object.keys(cs.groups).length, 0);
});

// =============================================================================
// addComponent tests
// =============================================================================

test('addComponent adds a widget component', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'wc-1',
        meta: { type: 'widget', group_id: 'V/N' },
    });

    const result = cs.addComponent(wc);

    assert.ok(result instanceof Wirecloud.ui.WiringEditor.Component);
    assert.equal(cs.components.widget['V/N']['wc-1'], result);
});

test('addComponent adds an operator component', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'op-1',
        meta: { type: 'operator', group_id: 'V/Op' },
    });

    const result = cs.addComponent(wc);

    assert.ok(result instanceof Wirecloud.ui.WiringEditor.Component);
    assert.ok('V/Op' in cs.components.operator);
    assert.equal(cs.components.operator['V/Op']['op-1'], result);
});

test('addComponent creates group_id entry when it does not exist', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'wc-new',
        meta: { type: 'widget', group_id: 'NewGroup' },
    });

    cs.addComponent(wc);

    assert.ok('NewGroup' in cs.components.widget);
    assert.equal(typeof cs.components.widget['NewGroup'], 'object');
});

test('addComponent adds second component to same type+group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc1 = makeWiringComponent({
        id: 'wc-a',
        meta: { type: 'widget', group_id: 'G1' },
    });
    const wc2 = makeWiringComponent({
        id: 'wc-b',
        meta: { type: 'widget', group_id: 'G1' },
    });

    cs.addComponent(wc1);
    cs.addComponent(wc2);

    assert.equal(Object.keys(cs.components.widget['G1']).length, 2);
});

test('addComponent creates Draggable for each component', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'draggable-test',
        meta: { type: 'widget', group_id: 'G1' },
    });

    cs.addComponent(wc);

    assert.equal(lastDraggableInstances.length, 1);
    const drag = lastDraggableInstances[0];
    assert.equal(drag.data.component, lastComponentInstances[0]);
    assert.equal(typeof drag.onStart, 'function');
    assert.equal(typeof drag.onDrag, 'function');
    assert.equal(typeof drag.onFinish, 'function');
    assert.equal(typeof drag.canBeDragged, 'function');
});

test('addComponent Draggable canBeDragged returns component.enabled', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'drag-enabled',
        meta: { type: 'widget', group_id: 'G1' },
    });

    cs.addComponent(wc);

    const drag = lastDraggableInstances[0];
    const comp = drag.data.component;

    // Standard: component is enabled
    comp.enabled = true;
    assert.equal(drag.canBeDragged(), true);

    // Disabled
    comp.enabled = false;
    assert.equal(drag.canBeDragged(), false);
});

test('addComponent adds to existing group if group is loaded', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'wc-group',
        meta: { type: 'widget', group_id: 'V/N' },
    });

    // Manually put a group in this.groups
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup({ vendor: 'V', name: 'N' });
    cs.groups['V/N'] = group;

    cs.addComponent(wc);

    assert.ok(group.components.includes(lastComponentInstances[0]));
});

test('addComponent does not add to group when group_id not in groups', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'wc-nogroup',
        meta: { type: 'widget', group_id: 'UnknownGroup' },
    });

    // groups is empty
    const comp = cs.addComponent(wc);

    // Component created, but no group to add to
    assert.ok(comp instanceof Wirecloud.ui.WiringEditor.Component);
});

test('addComponent returns the created component', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent();

    const comp = cs.addComponent(wc);

    assert.ok(comp instanceof Wirecloud.ui.WiringEditor.Component);
    assert.equal(comp, lastComponentInstances[0]);
});

test('addComponent uses component.id from the created Component, not from wiringComponent', () => {
    // The path does component.id, which comes from new Component(wc)
    // where Component's constructor uses wiringComponent.id
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'source-id',
        meta: { type: 'widget', group_id: 'G1' },
    });

    const comp = cs.addComponent(wc);
    assert.equal(comp.id, 'source-id');
    assert.equal(cs.components.widget['G1']['source-id'], comp);
});

// =============================================================================
// clear tests
// =============================================================================

test('clear calls searchComponents.clear and resets components', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];

    // Add some components
    cs.components.widget['G1'] = { 'c1': {} };
    cs.components.operator['G2'] = { 'c2': {} };

    const result = cs.clear();

    assert.equal(mac._cleared, true);
    assert.deepStrictEqual(cs.components, { operator: {}, widget: {} });
    assert.equal(result, cs);
});

test('clear returns this for chaining', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.equal(cs.clear(), cs);
});

// =============================================================================
// findComponent tests
// =============================================================================

test('findComponent finds component in first group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const comp = { id: 'target', _marker: true };
    cs.components.widget['G1'] = { 'target': comp };

    const result = cs.findComponent('widget', 'target');
    assert.equal(result, comp);
});

test('findComponent finds component in second group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const comp = { id: 'target2', _marker: true };
    cs.components.operator['G1'] = { 'a': {} };
    cs.components.operator['G2'] = { 'b': {}, 'target2': comp };

    const result = cs.findComponent('operator', 'target2');
    assert.equal(result, comp);
});

test('findComponent returns null when type does not exist', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    cs.components.widget = {}; // empty

    const result = cs.findComponent('widget', 'nonexistent');
    assert.equal(result, null);
});

test('findComponent returns null when id not found in any group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    cs.components.widget['G1'] = { 'a': {} };
    cs.components.widget['G2'] = { 'b': {} };

    const result = cs.findComponent('widget', 'c');
    assert.equal(result, null);
});

test('findComponent searches across multiple groups for operator type', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const op = { id: 'op-target' };
    cs.components.operator['G1'] = { 'x': {} };
    cs.components.operator['G2'] = { 'y': {} };
    cs.components.operator['G3'] = { 'op-target': op };

    const result = cs.findComponent('operator', 'op-target');
    assert.equal(result, op);
});

test('findComponent returns null when components[type] is empty', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    const result = cs.findComponent('widget', 'anything');
    assert.equal(result, null);
});

// =============================================================================
// forEachComponent tests
// =============================================================================

test('forEachComponent iterates all components across types and groups', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const comp1 = { id: 'c1' };
    const comp2 = { id: 'c2' };
    const comp3 = { id: 'c3' };

    cs.components.widget['G1'] = { 'c1': comp1 };
    cs.components.widget['G2'] = { 'c2': comp2 };
    cs.components.operator['G3'] = { 'c3': comp3 };

    const visited = [];
    cs.forEachComponent((comp) => visited.push(comp));

    assert.equal(visited.length, 3);
    assert.ok(visited.includes(comp1));
    assert.ok(visited.includes(comp2));
    assert.ok(visited.includes(comp3));
});

test('forEachComponent returns this for chaining', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    assert.equal(cs.forEachComponent(() => {}), cs);
});

test('forEachComponent with empty components calls nothing', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    let called = false;
    cs.forEachComponent(() => { called = true; });
    assert.equal(called, false);
});

test('forEachComponent iterates multiple components in same group', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const c1 = { id: 'a' };
    const c2 = { id: 'b' };
    const c3 = { id: 'c' };
    cs.components.widget['G1'] = { 'a': c1, 'b': c2, 'c': c3 };

    const ids = [];
    cs.forEachComponent((comp) => ids.push(comp.id));
    assert.deepStrictEqual(ids.sort(), ['a', 'b', 'c']);
});

// =============================================================================
// removeComponent tests
// =============================================================================

test('removeComponent calls component.remove() and deletes from store', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    // Manually place a component in the structure
    const comp = new Wirecloud.ui.WiringEditor.Component(makeWiringComponent({
        id: 'rm-1',
        meta: { type: 'widget', group_id: 'G1' },
    }));
    cs.components.widget['G1'] = { 'rm-1': comp };

    // Give the component a meta so removeComponent can read it
    comp.meta = { type: 'widget', group_id: 'G1' };

    const result = cs.removeComponent(comp);

    assert.equal(comp._removed, true);
    assert.equal(cs.components.widget['G1']['rm-1'], undefined);
    assert.equal(result, cs);
});

test('removeComponent handles operator type correctly', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    const comp = new Wirecloud.ui.WiringEditor.Component(makeWiringComponent({
        id: 'rm-op',
        meta: { type: 'operator', group_id: 'GrpOp' },
    }));
    comp.meta = { type: 'operator', group_id: 'GrpOp' };
    cs.components.operator['GrpOp'] = { 'rm-op': comp };

    cs.removeComponent(comp);

    assert.equal(comp._removed, true);
    assert.equal(cs.components.operator['GrpOp']['rm-op'], undefined);
});

// =============================================================================
// createcomponent_onclick (via btncreate.click on group)
// =============================================================================

test('btncreate.click on group dispatches create event', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    // Listen for 'create' events
    // dispatchEvent('create', group, button) calls handler(context, group, button)
    let dispatchedCtx = null;
    let dispatchedGroup = null;
    let dispatchedButton = null;

    cs.addEventListener('create', (ctx, group, button) => {
        dispatchedCtx = ctx;
        dispatchedGroup = group;
        dispatchedButton = button;
    });

    // Use resource_painter to create a group and fire btncreate.click
    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;
    const group = painter.paint({ vendor: 'V', name: 'N' });

    const fakeButton = { _fake: true };
    group._btncreateClick(fakeButton);

    assert.equal(dispatchedCtx, cs);
    assert.equal(dispatchedGroup, group);
    assert.equal(dispatchedButton, fakeButton);
});

// =============================================================================
// Drag-and-drop: component_ondragstart tests
// =============================================================================

function makeLayoutMock() {
    const parentEl = document.createElement('div');
    const slideOutParentEl = document.createElement('div');
    return {
        getBoundingClientRect() { return { left: 100, top: 50, width: 800, height: 600 }; },
        slideOut() {
            return { parentElement: slideOutParentEl };
        },
        slideIn(cfg) { this._slideInCalled = cfg; },
        content: {
            _elements: [],
            has(el) { return this._elements.includes(el); },
            get() { return document.createElement('div'); },
            appendChild(el) { this._elements.push(el); },
        },
        _slideInCalled: null,
    };
}

function makeDragContext(component, layout) {
    return {
        component,
        layout,
        element: component,
        x: 0,
        y: 0,
    };
}

test('component_ondragstart dispatches add event with context', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    // dispatchEvent('add', context) calls handler(cs, context)
    let addCtx = null;
    let addContext = null;
    cs.addEventListener('add', (ctx, dragCtx) => { addCtx = ctx; addContext = dragCtx; });

    const wc = makeWiringComponent({
        id: 'dragstart-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    dragContext.component.used = false;

    const event = { clientX: 200, clientY: 150 };
    drag.onStart(drag, dragContext, event);

    assert.equal(addCtx, cs);
    assert.equal(addContext, dragContext);
});

test('component_ondragstart calculates x/y positions correctly', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'dragpos-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;

    // Set wrapperElement offset dimensions
    dragContext.element.wrapperElement.offsetWidth = 100;
    dragContext.element.heading.wrapperElement.offsetHeight = 30;

    const event = { clientX: 250, clientY: 200 };
    drag.onStart(drag, dragContext, event);

    // x = clientX - bcr.left - offsetWidth/2 = 250 - 100 - 50 = 100
    // y = clientY - bcr.top - offsetHeight/2 = 200 - 50 - 15 = 135
    assert.equal(dragContext.x, 100);
    assert.equal(dragContext.y, 135);
});

test('component_ondragstart sets component.used = true', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'used-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    dragContext.element.wrapperElement.offsetWidth = 100;
    dragContext.element.heading.wrapperElement.offsetHeight = 30;

    dragContext.component.used = false;
    drag.onStart(drag, dragContext, { clientX: 0, clientY: 0 });

    assert.equal(dragContext.component.used, true);
});

test('component_ondragstart adds cloned and dragging class', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'class-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    dragContext.element.wrapperElement.offsetWidth = 100;
    dragContext.element.heading.wrapperElement.offsetHeight = 30;

    drag.onStart(drag, dragContext, { clientX: 0, clientY: 0 });

    const el = dragContext.element.wrapperElement;
    assert.ok(el.classList.contains('cloned'));
    assert.ok(el.classList.contains('dragging'));
});

test('component_ondragstart positions element at calculated coords', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'pos-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    dragContext.element.wrapperElement.offsetWidth = 200;
    dragContext.element.heading.wrapperElement.offsetHeight = 20;

    drag.onStart(drag, dragContext, { clientX: 500, clientY: 300 });

    // x = 500 - 100 - 100 = 300
    // y = 300 - 50 - 10 = 240
    assert.equal(dragContext.element._position.x, 300);
    assert.equal(dragContext.element._position.y, 240);
});

// =============================================================================
// component_ondrag tests
// =============================================================================

test('component_ondrag when element not in layout content: removes and re-appends', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'ondrag-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    dragContext.x = 50;
    dragContext.y = 30;

    // The element is NOT in layout.content._elements yet
    const event = {};
    drag.onDrag(event, drag, dragContext, 10, 5);

    // Element should now be in layout.content._elements
    assert.ok(layout.content._elements.includes(dragContext.element));
});

test('component_ondrag when element already in layout content: repositions', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'ondrag2-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    dragContext.x = 50;
    dragContext.y = 30;

    // First drag to get element into layout content
    drag.onDrag({}, drag, dragContext, 10, 5);

    // Reset position flag
    dragContext.element._position = null;

    // Second drag - element already in content
    drag.onDrag({}, drag, dragContext, 20, 15);

    assert.equal(dragContext.element._position.x, 70);  // 50 + 20
    assert.equal(dragContext.element._position.y, 45);  // 30 + 15
});

test('component_ondrag adds scrollLeft/scrollTop when first entering content', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'scroll-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const contentDiv = document.createElement('div');
    contentDiv.scrollLeft = 25;
    contentDiv.scrollTop = 15;

    const layout = {
        content: {
            _elements: [],
            has(el) { return this._elements.includes(el); },
            get() { return contentDiv; },
            appendChild(el) { this._elements.push(el); },
        },
    };
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    dragContext.x = 100;
    dragContext.y = 200;

    drag.onDrag({}, drag, dragContext, 5, 3);

    // context.x should have scrollLeft added: 100 + 25 = 125
    // context.y should have scrollTop added: 200 + 15 = 215
    assert.equal(dragContext.x, 125);
    assert.equal(dragContext.y, 215);
});

// =============================================================================
// component_ondragend tests
// =============================================================================

test('component_ondragend when element not in layout: removes and re-appends', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'dragend-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;

    drag.onFinish(drag, dragContext);

    assert.ok(layout.content._elements.includes(dragContext.element));
});

test('component_ondragend when element already in layout: removes cloned dragging class', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'dragend-class-test',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;

    // First put element in layout content (simulate ondrag)
    layout.content._elements.push(dragContext.element);

    // Set classes that would be there
    dragContext.element.wrapperElement.classList.add('cloned', 'dragging');

    drag.onFinish(drag, dragContext);

    assert.ok(!dragContext.element.wrapperElement.classList.contains('cloned'));
    assert.ok(!dragContext.element.wrapperElement.classList.contains('dragging'));
});

test('component_ondragend dispatches change event on element', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'dragend-change',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    layout.content._elements.push(dragContext.element);

    // dispatchEvent('change', toJSON()) calls handler(context, data)
    let changeCtx = null;
    let changeData = null;
    dragContext.element.addEventListener('change', (ctx, data) => { changeCtx = ctx; changeData = data; });

    drag.onFinish(drag, dragContext);

    assert.equal(changeCtx, dragContext.element);
    assert.deepStrictEqual(changeData, { id: dragContext.element.id });
});

test('component_ondragend calls layout.slideIn(1)', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'dragend-slide',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    layout.content._elements.push(dragContext.element);

    drag.onFinish(drag, dragContext);

    assert.equal(layout._slideInCalled, 1);
});

test('component_ondragend without layout content having element: still calls slideIn', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const wc = makeWiringComponent({
        id: 'dragend-no-has',
        meta: { type: 'widget', group_id: 'G1' },
    });
    cs.addComponent(wc);
    const drag = lastDraggableInstances[0];
    const dragContext = drag.data;

    const layout = makeLayoutMock();
    dragContext.layout = layout;
    dragContext.element = dragContext.component;
    // NOT adding to _elements - this will trigger the if block

    drag.onFinish(drag, dragContext);

    assert.ok(layout.content._elements.includes(dragContext.element));
    assert.equal(layout._slideInCalled, 1);
});

// =============================================================================
// Integration / lifecycle tests
// =============================================================================

test('full add -> find -> remove cycle for widget', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    const wc = makeWiringComponent({
        id: 'cycle-1',
        meta: { type: 'widget', group_id: 'G1' },
    });
    const comp = cs.addComponent(wc);

    // Find it
    const found = cs.findComponent('widget', 'cycle-1');
    assert.equal(found, comp);

    // Remove it
    comp.meta = { type: 'widget', group_id: 'G1' };
    cs.removeComponent(comp);

    // Should no longer find
    assert.equal(cs.findComponent('widget', 'cycle-1'), null);
});

test('full add -> find -> remove cycle for operator', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    const wc = makeWiringComponent({
        id: 'op-cycle',
        meta: { type: 'operator', group_id: 'OpGroup' },
    });
    const comp = cs.addComponent(wc);

    const found = cs.findComponent('operator', 'op-cycle');
    assert.equal(found, comp);

    comp.meta = { type: 'operator', group_id: 'OpGroup' };
    cs.removeComponent(comp);

    assert.equal(cs.findComponent('operator', 'op-cycle'), null);
});

test('multiple adds across different types and groups then forEach', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    const wc1 = makeWiringComponent({ id: 'w1', meta: { type: 'widget', group_id: 'GA' } });
    const wc2 = makeWiringComponent({ id: 'w2', meta: { type: 'widget', group_id: 'GB' } });
    const wc3 = makeWiringComponent({ id: 'o1', meta: { type: 'operator', group_id: 'GC' } });

    cs.addComponent(wc1);
    cs.addComponent(wc2);
    cs.addComponent(wc3);

    const ids = [];
    cs.forEachComponent((comp) => ids.push(comp.id));
    assert.deepStrictEqual(ids.sort(), ['o1', 'w1', 'w2']);
});

test('clear after adding components resets everything', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();

    cs.addComponent(makeWiringComponent({ id: 'a', meta: { type: 'widget', group_id: 'G' } }));
    cs.addComponent(makeWiringComponent({ id: 'b', meta: { type: 'operator', group_id: 'G' } }));

    cs.clear();

    assert.deepStrictEqual(cs.components, { operator: {}, widget: {} });
    const ids = [];
    cs.forEachComponent((comp) => ids.push(comp.id));
    assert.equal(ids.length, 0);
});

test('search event clears groups even after paint', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const mac = lastMACSearchInstances[0];
    const painter = mac.config.resource_painter;

    // Paint a group
    painter.paint({ vendor: 'V', name: 'N1' });
    painter.paint({ vendor: 'V', name: 'N2' });

    assert.equal(Object.keys(cs.groups).length, 2);

    // Trigger search
    searchEventHandlers.forEach((fn) => fn());

    assert.deepStrictEqual(cs.groups, {});
});

test('operatorButton -> search switches to operator, then widgetButton back', () => {
    const cs = new Wirecloud.ui.WiringEditor.ComponentShowcase();
    const opBtn = lastToggleButtonInstances[0];
    const widgetBtn = lastToggleButtonInstances[1];
    const mac = lastMACSearchInstances[0];

    // Switch to operator mode
    opBtn._click();
    assert.equal(mac.search_scope, 'operator');
    assert.equal(mac._refreshed, true);

    // Reset refresh flag
    mac._refreshed = false;

    // Switch back to widget mode
    widgetBtn._click();
    assert.equal(mac.search_scope, 'widget');
    assert.equal(mac._refreshed, true);
});
