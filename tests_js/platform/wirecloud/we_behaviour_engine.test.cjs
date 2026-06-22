const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

let behaviourCounter = 0;
let componentCounter = 0;
let connectionCounter = 0;

function makeComponent(overrides = {}) {
    componentCounter++;
    return {
        id: `comp-${componentCounter}`,
        type: 'operator',
        title: `Component ${componentCounter}`,
        toJSON() { return { id: this.id, type: this.type, title: this.title }; },
        equals(other) { return this === other || (other != null && this.id === other.id); },
        remove() {},
        _connections: [],
        forEachConnection(cb) {
            this._connections.forEach(cb);
            return this;
        },
        ...overrides,
    };
}

function makeConnection(overrides = {}) {
    connectionCounter++;
    return {
        _id: connectionCounter,
        sourceId: overrides.sourceId || `src-${connectionCounter}`,
        targetId: overrides.targetId || `tgt-${connectionCounter}`,
        sourceComponent: overrides.sourceComponent || makeComponent(),
        targetComponent: overrides.targetComponent || makeComponent(),
        background: false,
        removeAllowed: false,
        _removed: false,
        remove() { this._removed = true; return this; },
        equals(other) {
            if (other == null) return false;
            if (other._id != null && this._id === other._id) return true;
            return this.sourceId === other.sourceId && this.targetId === other.targetId;
        },
        toJSON() {
            return { sourcename: this.sourceId, targetname: this.targetId };
        },
        ...overrides,
    };
}

function makeBehaviour(overrides = {}) {
    behaviourCounter++;
    const index = overrides.index != null ? overrides.index : behaviourCounter - 1;
    const title = overrides.title || `Behaviour ${behaviourCounter}`;
    const b = {
        _index: index,
        _title: title,
        _active: overrides.active || false,
        _listeners: {},
        _classNames: new Set(),
        _components: {
            operator: Object.assign({}, overrides.operator || {}),
            widget: Object.assign({}, overrides.widget || {}),
        },
        _connections: (overrides.connections || []).slice(),
        _description: overrides.description || '',
        _enabled: true,
        _bodyEl: document.createElement('div'),
        _compEl: document.createElement('div'),
        equals(other) { return this === other; },
        get() { return this._compEl; },
        parent() {
            return {
                insertBefore(child, ref) {
                    if (child && child.get) child = child.get();
                    if (ref && ref.get) ref = ref.get();
                    return { appendChild() {} };
                },
            };
        },
        remove() {},
        get index() { return this._index; },
        set index(v) { this._index = Number(v); },
        get active() { return this._active; },
        set active(v) { this._active = v; },
        get title() { return this._title; },
        set title(v) { this._title = v; },
        get description() { return this._description; },
        set description(v) { this._description = v; },
        get enabled() { return this._enabled; },
        set enabled(v) { this._enabled = v; },
        addEventListener(name, handler) {
            if (this._listeners[name] == null) this._listeners[name] = [];
            this._listeners[name].push(handler);
            return this;
        },
        dispatchEvent(name, ...args) {
            (this._listeners[name] || []).forEach((h) => h.apply(this, args));
        },
        hasComponent(component) {
            return !!(component && component.id && this._components[component.type] &&
                this._components[component.type][component.id]);
        },
        hasConnection(connection) {
            return this._connections.some((c) => {
                return c.sourcename === connection.sourceId && c.targetname === connection.targetId;
            });
        },
        removeComponent(component) {
            if (component && this._components[component.type]) {
                delete this._components[component.type][component.id];
                this.dispatchEvent('change');
            }
            return this;
        },
        removeConnection(connection) {
            const idx = this._connections.findIndex((c) =>
                c.sourcename === connection.sourceId && c.targetname === connection.targetId);
            if (idx !== -1) {
                this._connections.splice(idx, 1);
                this.dispatchEvent('change');
            }
            return this;
        },
        updateComponent(component) {
            if (component) {
                if (!this._components[component.type]) this._components[component.type] = {};
                this._components[component.type][component.id] = component;
            }
            return this;
        },
        updateConnection(connection) {
            const idx = this._connections.findIndex((c) =>
                c.sourcename === connection.sourceId && c.targetname === connection.targetId);
            if (idx !== -1) {
                this._connections[idx] = { sourcename: connection.sourceId, targetname: connection.targetId };
            } else {
                this._connections.push({ sourcename: connection.sourceId, targetname: connection.targetId });
                this.dispatchEvent('change');
            }
            return this;
        },
        clear() {
            this._components = { operator: {}, widget: {} };
            this._connections = [];
            this.dispatchEvent('change');
            return this;
        },
        getCurrentStatus() {
            return {
                title: this._title,
                connections: this._connections.length,
                components: {
                    operator: Object.keys(this._components.operator).length,
                    widget: Object.keys(this._components.widget).length,
                },
            };
        },
        getsourceId() { return ''; },
        gettargetId() { return ''; },
        addClassName(cls) { this._classNames.add(cls); return this; },
        removeClassName(cls) { this._classNames.delete(cls); return this; },
        hasClassName(cls) { return this._classNames.has(cls); },
        getBoundingClientRect() { return { top: 100, left: 0, width: 300, height: 50 }; },
        showLogs() { return this; },
        showSettings() { return this; },
        toJSON() {
            return {
                title: this._title,
                description: this._description,
                active: this._active,
                components: JSON.parse(JSON.stringify(this._components)),
                connections: this._connections.slice(),
            };
        },
    };
    b.btnPrefs = {
        enabled: true,
        enable() { this.enabled = true; return this; },
        disable() { this.enabled = false; return this; },
    };
    b.btnRemove = {
        enabled: true,
        enable() { this.enabled = true; return this; },
        disable() { this.enabled = false; return this; },
    };
    b.draggable = null;
    b.logManager = {
        log() {},
        entries: [],
    };
    return b;
}

function patchFakeDom() {
    const proto = Object.getPrototypeOf(document.createElement('div'));
    if (!Object.getOwnPropertyDescriptor(proto, 'firstElementChild')) {
        Object.defineProperty(proto, 'firstElementChild', {
            get() {
                const children = this.childNodes;
                if (!children) return null;
                for (let i = 0; i < children.length; i++) {
                    if (children[i].nodeType === 1) return children[i];
                }
                return null;
            },
            configurable: true,
        });
    }
    if (proto.cloneNode === undefined) {
        proto.cloneNode = function (deep) {
            const clone = document.createElement(this.tagName);
            clone.className = this.className;
            clone._textContent = this._textContent;
            clone.attributes = Object.assign({}, this.attributes);
            clone.style = Object.assign({}, this.style);
            clone.dataset = Object.assign({}, this.dataset);
            clone.offsetHeight = this.offsetHeight;
            clone.offsetWidth = this.offsetWidth;
            if (deep && this.childNodes) {
                this.childNodes.forEach((child) => {
                    if (child.nodeType === 3) {
                        clone.appendChild(document.createTextNode(child.textContent));
                    } else {
                        clone.appendChild(child.cloneNode(true));
                    }
                });
            }
            return clone;
        };
    }
}

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    patchFakeDom();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = { WiringEditor: {} };

    behaviourCounter = 0;
    componentCounter = 0;
    connectionCounter = 0;

    // Mock DOMParser for GUIBuilder
    global.DOMParser = function DOMParser() {};
    DOMParser.prototype.parseFromString = function () {
        const doc = document.createElement('div');
        doc.documentElement = document.createElement('root');
        return doc;
    };

    // Load StyledElements dependencies (order matters)
    loadLegacyScripts([
        'src/wirecloud/commons/static/js/StyledElements/GUIBuilder.js',
        'src/wirecloud/commons/static/js/StyledElements/Tooltip.js',
        'src/wirecloud/commons/static/js/StyledElements/Fragment.js',
        'src/wirecloud/commons/static/js/StyledElements/Container.js',
        'src/wirecloud/commons/static/js/StyledElements/Button.js',
        'src/wirecloud/commons/static/js/StyledElements/Addon.js',
        'src/wirecloud/commons/static/js/StyledElements/ToggleButton.js',
        'src/wirecloud/commons/static/js/StyledElements/Alert.js',
        'src/wirecloud/commons/static/js/StyledElements/Panel.js',
        'src/wirecloud/commons/static/js/StyledElements/EditableElement.js',
        'src/wirecloud/commons/static/js/StyledElements/PopupButton.js',
        'src/wirecloud/commons/static/js/StyledElements/DynamicMenuItems.js',
        'src/wirecloud/commons/static/js/StyledElements/MenuItem.js',
    ]);

    // Override Alert.addNote to return element with working firstElementChild
    StyledElements.Alert.prototype.addNote = function (textContent) {
        const blockquote = document.createElement('blockquote');
        blockquote.setAttribute('role', 'note');
        const anchor = document.createElement('a');
        anchor.setAttribute('href', '#');
        blockquote.appendChild(anchor);
        this.body.wrapperElement.appendChild(blockquote);
        return blockquote;
    };

    // Mock GUIBuilder.prototype.parse
    StyledElements.GUIBuilder.prototype.parse = function (doc, tcomponents) {
        if (tcomponents && tcomponents.behaviourlist) {
            tcomponents.behaviourlist({ class: 'behaviour-list' });
        }
        const fragment = new StyledElements.Fragment();
        const wrapperEl = document.createElement('div');
        wrapperEl.className = 'behaviour-engine-outer';
        const bodyEl = document.createElement('div');
        bodyEl.className = 'behaviour-engine-body';
        wrapperEl.appendChild(bodyEl);
        fragment.wrapperElement = wrapperEl;
        fragment.children = [wrapperEl, bodyEl];

        // Ensure buttons have parent elements for enable/disable logic
        ['enablebutton', 'createbutton', 'orderbutton'].forEach((key) => {
            if (tcomponents && tcomponents[key]) {
                const btn = tcomponents[key];
                const el = btn.get ? btn.get() : btn;
                wrapperEl.appendChild(el);
            }
        });

        return fragment;
    };

    // Wirecloud mocks
    Wirecloud.ui.FormWindowMenu = function FormWindowMenu(fields, title, classname) {
        this._fields = fields;
        this._title = title;
        this._classname = classname;
        this._executeOperation = null;
        this._shown = false;
        this._value = null;
        FormWindowMenu._lastInstance = this;
    };
    Wirecloud.ui.FormWindowMenu.prototype.show = function () { this._shown = true; return this; };
    Wirecloud.ui.FormWindowMenu.prototype.setValue = function (obj) { this._value = obj; return this; };
    Wirecloud.ui.FormWindowMenu._lastInstance = null;

    Wirecloud.ui.AlertWindowMenu = function AlertWindowMenu(options) {
        this.options = options;
        this._handler = null;
        this._shown = false;
        AlertWindowMenu._lastInstance = this;
    };
    Wirecloud.ui.AlertWindowMenu.prototype.setHandler = function (handler) {
        this._handler = handler;
        return this;
    };
    Wirecloud.ui.AlertWindowMenu.prototype.show = function () { this._shown = true; return this; };
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;

    Wirecloud.ui.Draggable = function Draggable(element, options, ondragstart, ondrag, ondragend) {
        this._element = element;
        this._options = options;
        this._ondragstart = ondragstart;
        this._ondrag = ondrag;
        this._ondragend = ondragend;
        Draggable._lastInstance = this;
    };
    Wirecloud.ui.Draggable.prototype.destroy = function () {};
    Wirecloud.ui.Draggable._lastInstance = null;

    Wirecloud.currentTheme = {
        templates: {
            'wirecloud/wiring/behaviour_sidebar': document.createElement('div'),
        },
    };

    Wirecloud.Wiring = {
        normalize() {
            return {
                visualdescription: {
                    behaviours: [],
                    components: { operator: {}, widget: {} },
                    connections: [],
                },
            };
        },
    };

    Wirecloud.TutorialCatalogue = {
        get() {
            return { start() {} };
        },
    };

    Wirecloud.constants = {
        LOGGING: { DEBUG_MSG: 1, INFO_MSG: 2, WARN_MSG: 3, ERROR_MSG: 4 },
    };

    // Mock Behaviour class
    Wirecloud.ui.WiringEditor.Behaviour = function Behaviour(index, info) {
        return makeBehaviour({
            index: index,
            title: info ? info.title : 'Untitled',
            description: info ? (info.description || '') : '',
        });
    };

    // Load the file under test
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/BehaviourEngine.js',
    ]);
});

// =========================================================================
// STATIC CONSTANTS
// =========================================================================

test('STATIC GLOBAL constant', () => {
    assert.equal(Wirecloud.ui.WiringEditor.BehaviourEngine.GLOBAL, 0);
});

test('STATIC INDEPENDENT constant', () => {
    assert.equal(Wirecloud.ui.WiringEditor.BehaviourEngine.INDEPENDENT, 1);
});

// =========================================================================
// Constructor
// =========================================================================

test('constructor creates BehaviourEngine instance', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.ok(engine instanceof StyledElements.StyledElement);
    assert.ok(engine instanceof Wirecloud.ui.WiringEditor.BehaviourEngine);
});

test('constructor creates btnEnable Button', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.ok(engine.btnEnable instanceof StyledElements.Button);
});

test('constructor creates btnCreate Button', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.ok(engine.btnCreate instanceof StyledElements.Button);
});

test('constructor creates btnOrder ToggleButton and disables it', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.ok(engine.btnOrder instanceof StyledElements.ToggleButton);
    assert.ok(engine.btnOrder.hasClassName('disabled'));
});

test('constructor sets wrapperElement', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.ok(engine.wrapperElement != null);
    assert.ok(engine.wrapperElement.className.includes('behaviour-engine-body'));
});

test('constructor sets body Container', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.ok(engine.body instanceof StyledElements.Container);
});

test('constructor defines orderingEnabled property', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.orderingEnabled, false);
});

test('constructor creates disabledAlert', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.ok(engine.disabledAlert instanceof StyledElements.Alert);
});

test('constructor initializes behaviours as empty array', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.deepEqual(engine.behaviours, []);
});

test('constructor initializes components with operator and widget', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.deepEqual(engine.components, { operator: {}, widget: {} });
});

test('constructor sets viewpoint to GLOBAL', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.viewpoint, Wirecloud.ui.WiringEditor.BehaviourEngine.GLOBAL);
});

test('constructor calls clear to initialize state', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.enabled, false);
    assert.equal(engine.ready, false);
    assert.ok(engine.description != null);
    assert.equal(engine.description.connections.length, 0);
});

// =========================================================================
// _onenabled
// =========================================================================

test('_onenabled true updates button title to Disable', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const label = engine.btnEnable.wrapperElement.getAttribute('aria-label');
    assert.ok(label != null);
    assert.ok(label.includes('Disable'));
});

test('_onenabled true shows btnCreate', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    assert.ok(!engine.btnCreate.hasClassName('hidden'));
});

test('_onenabled true removes disabledAlert from body', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    // Initially disabled (from clear()), so disabledAlert is in body
    assert.ok(engine.body.wrapperElement.childNodes.includes(engine.disabledAlert.wrapperElement));
    // Enable via setter to properly toggle classes
    engine.enabled = true;
    // Now disabledAlert should be removed
    assert.ok(!engine.body.wrapperElement.childNodes.includes(engine.disabledAlert.wrapperElement));
});

test('_onenabled false removes all behaviours from body', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b = makeBehaviour({ title: 'Test' });
    engine.behaviours = [b];
    engine._onenabled(false);
    assert.deepEqual(engine.behaviours, []);
    assert.equal(engine.behaviour, null);
});

test('_onenabled false hides btnCreate and sets parent class hidden', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const parentEl = document.createElement('div');
    const btnWrapperEl = engine.btnCreate.wrapperElement;
    parentEl.appendChild(btnWrapperEl);
    engine._onenabled(false);
    assert.ok(engine.btnCreate.hasClassName('hidden'));
    assert.ok(parentEl.classList.contains('hidden'));
});

test('_onenabled false resets viewpoint to GLOBAL', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.viewpoint = Wirecloud.ui.WiringEditor.BehaviourEngine.INDEPENDENT;
    engine._onenabled(false);
    assert.equal(engine.viewpoint, Wirecloud.ui.WiringEditor.BehaviourEngine.GLOBAL);
});

test('_onenabled false calls stopOrdering', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    let stopped = false;
    engine.stopOrdering = function () { stopped = true; return this; };
    engine._onenabled(false);
    assert.ok(stopped);
});

test('_onenabled dispatches enable event when ready=true', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.ready = true;
    let fired = false;
    let firedVal = null;
    engine.addEventListener('enable', function (ctx, val) { fired = true; firedVal = val; });
    engine.enabled = true;
    assert.ok(fired);
    assert.equal(firedVal, true);
});

test('_onenabled returns this when ready=false (no dispatch)', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.ready = false;
    assert.equal(engine._onenabled(true), engine);
});

test('_onenabled false sets heading button to Enable', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine._onenabled(false);
    const label = engine.btnEnable.wrapperElement.getAttribute('aria-label');
    assert.ok(label != null);
    assert.ok(label.includes('Enable'));
});

test('_onenabled false appends disabledAlert to body', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine._onenabled(false);
    assert.ok(engine.body.wrapperElement.childNodes.includes(engine.disabledAlert.wrapperElement));
});

test('_onenabled false calls onchange_ordering', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine._onenabled(false);
    assert.ok(engine.btnOrder.enabled === false);
});

// =========================================================================
// activate
// =========================================================================

test('activate returns this early if not enabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    const b = makeBehaviour({ title: 'Test' });
    assert.equal(engine.activate(b), engine);
});

test('activate calls deactivateAllExcept when behaviour differs', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b1 = makeBehaviour({ title: 'B1' });
    const b2 = makeBehaviour({ title: 'B2' });
    engine.behaviour = b1;
    engine.behaviours = [b1, b2];
    engine.activate(b2);
    assert.equal(engine.behaviour, b2);
    assert.equal(b2.active, true);
    assert.equal(b1.active, false);
});

test('activate is no-op when behaviour is already active', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b = makeBehaviour({ title: 'Active', active: true });
    engine.behaviour = b;
    engine.behaviours = [b];
    assert.equal(engine.activate(b), engine);
});

test('activate dispatches activate event', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b = makeBehaviour({ title: 'B' });
    engine.behaviour = makeBehaviour({ title: 'Old' });
    engine.behaviours = [engine.behaviour, b];
    let fired = false;
    engine.addEventListener('activate', function () { fired = true; });
    engine.activate(b);
    assert.ok(fired);
});

// =========================================================================
// createBehaviour
// =========================================================================

test('createBehaviour creates and inserts a behaviour', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b = engine.createBehaviour({ title: 'Created' });
    assert.ok(b != null);
    assert.equal(b.title, 'Created');
    assert.equal(engine.behaviours.length, 1);
    assert.equal(engine.behaviours[0], b);
});

test('createBehaviour sets behaviour as active', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b = engine.createBehaviour({ title: 'Active' });
    assert.equal(engine.behaviour, b);
    assert.equal(b.active, true);
});

test('createBehaviour dispatches change on behaviour change when active', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b = engine.createBehaviour({ title: 'Change Test' });
    let changed = false;
    engine.addEventListener('change', function () { changed = true; });
    b.dispatchEvent('change');
    assert.ok(changed);
});

test('createBehaviour dispatches optremove', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b = engine.createBehaviour({ title: 'Remove Test' });
    let removed = false;
    let rmBehaviour = null;
    engine.removeBehaviour = function (beh) { removed = true; rmBehaviour = beh; return this; };
    b.dispatchEvent('optremove');
    assert.ok(removed);
    assert.equal(rmBehaviour, b);
});

test('createBehaviour click activates when not ordering', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b1 = engine.createBehaviour({ title: 'First' });
    const b2 = engine.createBehaviour({ title: 'Second' });
    engine.activate(b1);
    engine.btnOrder.active = false; // not ordering
    b2.dispatchEvent('click');
    assert.equal(engine.behaviour, b2);
});

test('createBehaviour click does not activate when orderingEnabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b1 = engine.createBehaviour({ title: 'First' });
    const b2 = engine.createBehaviour({ title: 'Second' });
    engine.activate(b1);
    engine.btnOrder.active = true; // ordering active
    b2.dispatchEvent('click');
    assert.equal(engine.behaviour, b1);
});

// =========================================================================
// clear
// =========================================================================

test('clear when enabled removes all behaviours', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.createBehaviour({ title: 'B1' });
    engine.createBehaviour({ title: 'B2' });
    engine.enabled = true;
    engine.clear();
    assert.equal(engine.behaviours.length, 0);
    assert.equal(engine.viewpoint, Wirecloud.ui.WiringEditor.BehaviourEngine.GLOBAL);
    assert.equal(engine.behaviour, null);
});

test('clear when disabled removes components directly', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    const comp = makeComponent({ type: 'operator', id: 'op1' });
    engine.components.operator.op1 = comp;
    engine.description.components.operator.op1 = comp;
    engine.clear();
    assert.ok(!('op1' in engine.components.operator));
});

test('clear sets description from Wiring.normalize', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.clear();
    assert.ok(engine.description != null);
    assert.deepEqual(engine.description.connections, []);
    assert.deepEqual(engine.description.components, { operator: {}, widget: {} });
});

test('clear sets enabled=false and ready=false', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.ready = true;
    engine.clear();
    assert.equal(engine.enabled, false);
    assert.equal(engine.ready, false);
});

test('clear returns this', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.clear(), engine);
});

// =========================================================================
// emptyBehaviour
// =========================================================================

test('emptyBehaviour returns this early if not enabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    assert.equal(engine.emptyBehaviour(makeBehaviour({ title: 'Test' })), engine);
});

test('emptyBehaviour activates target before emptying if not active', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b1 = engine.createBehaviour({ title: 'Active' });
    const b2 = engine.createBehaviour({ title: 'Target' });
    engine.activate(b1);
    engine.emptyBehaviour(b2);
    assert.equal(engine.behaviour, b1);
});

test('emptyBehaviour clears the target behaviour', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b = engine.createBehaviour({ title: 'Clear Me' });
    engine.emptyBehaviour(b);
    assert.deepEqual(b._components, { operator: {}, widget: {} });
    assert.deepEqual(b._connections, []);
});

// =========================================================================
// filterByComponent
// =========================================================================

test('filterByComponent returns matching behaviours', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const comp = makeComponent({ id: 'shared', type: 'operator' });
    const b1 = makeBehaviour({ title: 'B1', operator: { shared: comp } });
    const b2 = makeBehaviour({ title: 'B2', operator: {} });
    const b3 = makeBehaviour({ title: 'B3', operator: { shared: comp } });
    engine.behaviours = [b1, b2, b3];
    assert.deepEqual(engine.filterByComponent(comp), [b1, b3]);
});

test('filterByComponent returns empty when no match', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.behaviours = [makeBehaviour(), makeBehaviour()];
    assert.deepEqual(engine.filterByComponent(makeComponent({ id: 'no', type: 'operator' })), []);
});

// =========================================================================
// filterByConnection
// =========================================================================

test('filterByConnection returns matching behaviours', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const conn = makeConnection({ sourceId: 's1', targetId: 't1' });
    engine.behaviours = [
        makeBehaviour({ connections: [{ sourcename: 's1', targetname: 't1' }] }),
        makeBehaviour({ connections: [{ sourcename: 'x', targetname: 'y' }] }),
    ];
    assert.equal(engine.filterByConnection(conn).length, 1);
});

test('filterByConnection returns empty when no match', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.behaviours = [makeBehaviour()];
    assert.deepEqual(engine.filterByConnection(makeConnection({ sourceId: 'na', targetId: 'nb' })), []);
});

// =========================================================================
// forEachComponent
// =========================================================================

test('forEachComponent iterates all components', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const op1 = makeComponent({ type: 'operator', id: 'o1' });
    const w1 = makeComponent({ type: 'widget', id: 'w1' });
    engine.components = { operator: { o1: op1 }, widget: { w1: w1 } };
    const items = [];
    engine.forEachComponent((c) => items.push(c));
    assert.equal(items.length, 2);
    assert.ok(items.includes(op1));
    assert.ok(items.includes(w1));
});

test('forEachComponent with empty components', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const items = [];
    engine.forEachComponent((c) => items.push(c));
    assert.deepEqual(items, []);
});

test('forEachComponent returns this', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.forEachComponent(() => {}), engine);
});

// =========================================================================
// getConnectionIndex
// =========================================================================

test('getConnectionIndex finds matching connection', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = {
        components: { operator: {}, widget: {} },
        connections: [
            { sourcename: 'a', targetname: 'b' },
            { sourcename: 'c', targetname: 'd' },
        ],
    };
    assert.equal(engine.getConnectionIndex(makeConnection({ sourceId: 'c', targetId: 'd' })), 1);
});

test('getConnectionIndex returns 0 for first match', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = {
        components: { operator: {}, widget: {} },
        connections: [{ sourcename: 'x', targetname: 'y' }],
    };
    assert.equal(engine.getConnectionIndex(makeConnection({ sourceId: 'x', targetId: 'y' })), 0);
});

test('getConnectionIndex returns -1 when not found', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = {
        components: { operator: {}, widget: {} },
        connections: [{ sourcename: 'a', targetname: 'b' }],
    };
    assert.equal(engine.getConnectionIndex(makeConnection({ sourceId: 'z', targetId: 'b' })), -1);
});

test('getConnectionIndex returns -1 for empty connections', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = {
        components: { operator: {}, widget: {} },
        connections: [],
    };
    assert.equal(engine.getConnectionIndex(makeConnection({ sourceId: 'a', targetId: 'b' })), -1);
});

// =========================================================================
// getCurrentStatus
// =========================================================================

test('getCurrentStatus returns counts from description', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = {
        components: { operator: { o1: {}, o2: {} }, widget: { w1: {} } },
        connections: [{ sourcename: 'a', targetname: 'b' }, { sourcename: 'c', targetname: 'd' }],
    };
    const status = engine.getCurrentStatus();
    assert.equal(status.title, '');
    assert.equal(status.connections, 2);
    assert.equal(status.components.operator, 2);
    assert.equal(status.components.widget, 1);
});

test('getCurrentStatus with empty description', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    const status = engine.getCurrentStatus();
    assert.equal(status.connections, 0);
    assert.equal(status.components.operator, 0);
    assert.equal(status.components.widget, 0);
});

// =========================================================================
// hasComponent
// =========================================================================

test('hasComponent returns true via behaviours when enabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const comp = makeComponent({ id: 'c1', type: 'widget' });
    engine.behaviours = [makeBehaviour({ widget: { c1: comp } })];
    assert.equal(engine.hasComponent(comp), true);
});

test('hasComponent returns false when not in any behaviour (enabled)', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.behaviours = [makeBehaviour()];
    assert.equal(engine.hasComponent(makeComponent({ id: 'missing', type: 'operator' })), false);
});

test('hasComponent returns true via description when disabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    engine.description = { components: { operator: { op1: {} }, widget: {} } };
    assert.equal(engine.hasComponent(makeComponent({ id: 'op1', type: 'operator' })), true);
});

test('hasComponent returns false via description when disabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    engine.description = { components: { operator: {}, widget: {} } };
    assert.equal(engine.hasComponent(makeComponent({ id: 'no', type: 'widget' })), false);
});

// =========================================================================
// hasComponents
// =========================================================================

test('hasComponents returns true when components exist', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.components = { operator: { o1: makeComponent() }, widget: {} };
    assert.equal(engine.hasComponents(), true);
});

test('hasComponents returns false when empty', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.components = { operator: {}, widget: {} };
    assert.equal(engine.hasComponents(), false);
});

test('hasComponents with only operators', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.components = { operator: { o: makeComponent() }, widget: {} };
    assert.equal(engine.hasComponents(), true);
});

test('hasComponents with only widgets', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.components = { operator: {}, widget: { w: makeComponent() } };
    assert.equal(engine.hasComponents(), true);
});

// =========================================================================
// hasConnection
// =========================================================================

test('hasConnection returns true via behaviours when enabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.behaviours = [makeBehaviour({ connections: [{ sourcename: 's', targetname: 't' }] })];
    assert.equal(engine.hasConnection(makeConnection({ sourceId: 's', targetId: 't' })), true);
});

test('hasConnection returns false when not in any behaviour (enabled)', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.behaviours = [makeBehaviour()];
    assert.equal(engine.hasConnection(makeConnection({ sourceId: 'x', targetId: 'y' })), false);
});

test('hasConnection returns true via description when disabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    engine.description = {
        components: { operator: {}, widget: {} },
        connections: [{ sourcename: 'a', targetname: 'b' }],
    };
    assert.equal(engine.hasConnection(makeConnection({ sourceId: 'a', targetId: 'b' })), true);
});

test('hasConnection returns false via description when disabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    assert.equal(engine.hasConnection(makeConnection({ sourceId: 'a', targetId: 'b' })), false);
});

// =========================================================================
// loadBehaviours
// =========================================================================

test('loadBehaviours loads behaviours and sets enabled=true', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.loadBehaviours([
        { title: 'B1', description: 'Desc1' },
        { title: 'B2' },
    ]);
    assert.equal(engine.enabled, true);
    assert.equal(engine.behaviours.length, 2);
    assert.equal(engine.ready, true);
});

test('loadBehaviours with empty array dispatches change', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    let changed = false;
    engine.addEventListener('change', function () { changed = true; });
    engine.loadBehaviours([]);
    assert.equal(engine.enabled, false);
    assert.equal(engine.ready, true);
    assert.ok(changed);
});

test('loadBehaviours sets ready=true', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.loadBehaviours([]);
    assert.equal(engine.ready, true);
});

// =========================================================================
// removeBehaviour
// =========================================================================

test('removeBehaviour returns early if not enabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    assert.equal(engine.removeBehaviour(makeBehaviour({ title: 'Test' })), engine);
});

test('removeBehaviour removes the given behaviour', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b1 = engine.createBehaviour({ title: 'B1' });
    const b2 = engine.createBehaviour({ title: 'B2' });
    engine.activate(b1);
    engine.removeBehaviour(b2);
    assert.equal(engine.behaviours.length, 1);
    assert.equal(engine.behaviours[0], b1);
});

test('removeBehaviour activates another behaviour when removing active one', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b1 = engine.createBehaviour({ title: 'B1' });
    const b2 = engine.createBehaviour({ title: 'B2' });
    engine.activate(b2);
    engine.removeBehaviour(b2);
    assert.equal(engine.behaviour, b1);
});

test('removeBehaviour destroys draggable when orderingEnabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b = engine.createBehaviour({ title: 'Only' });
    let destroyed = false;
    b.draggable = { destroy() { destroyed = true; } };
    engine.btnOrder.active = true;
    engine.removeBehaviour(b);
    assert.ok(destroyed);
});

test('removeBehaviour reindexes remaining behaviours', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.createBehaviour({ title: 'B0' });
    engine.createBehaviour({ title: 'B1' });
    engine.createBehaviour({ title: 'B2' });
    engine.removeBehaviour(engine.behaviours[1]);
    assert.equal(engine.behaviours[0].index, 0);
    assert.equal(engine.behaviours[1].index, 1);
});

// =========================================================================
// removeComponent
// =========================================================================

test('removeComponent disabled branch calls disabled_removeComponent', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    const comp = makeComponent({ id: 'op1', type: 'operator' });
    engine.components.operator.op1 = comp;
    engine.description.components.operator.op1 = comp;
    let changed = false;
    engine.addEventListener('change', function () { changed = true; });
    engine.removeComponent(comp);
    assert.ok(changed);
    assert.ok(!engine.description.components.operator.op1);
});

test('removeComponent cascade=true shows modal', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    engine.removeComponent(makeComponent({ id: 'c1', type: 'operator' }), true);
    const modal = Wirecloud.ui.AlertWindowMenu._lastInstance;
    assert.ok(modal != null);
    assert.equal(modal._shown, true);
});

test('removeComponent cascade=false with multiple behaviours removes directly', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const comp = makeComponent({ id: 'shared', type: 'operator' });
    engine.behaviours = [
        makeBehaviour({ operator: { shared: comp } }),
        makeBehaviour({ operator: { shared: comp } }),
    ];
    engine.behaviour = engine.behaviours[0];
    engine.description = { components: { operator: { shared: {} }, widget: {} }, connections: [] };
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    engine.removeComponent(comp, false);
    assert.equal(Wirecloud.ui.AlertWindowMenu._lastInstance, null);
});

test('removeComponent cascade=false with single behaviour shows modal', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const comp = makeComponent({ id: 'alone', type: 'widget' });
    engine.behaviours = [makeBehaviour({ widget: { alone: comp } })];
    engine.behaviour = engine.behaviours[0];
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    engine.removeComponent(comp, false);
    const modal = Wirecloud.ui.AlertWindowMenu._lastInstance;
    assert.ok(modal != null);
    assert.equal(modal._shown, true);
});

test('removeComponent returns this', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.removeComponent(makeComponent({ id: 'rc', type: 'widget' })), engine);
});

// =========================================================================
// removeComponentList
// =========================================================================

test('removeComponentList enabled separated into modal and direct', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const c1 = makeComponent({ id: 'c1', type: 'operator' });
    const c2 = makeComponent({ id: 'c2', type: 'operator' });
    engine.behaviours = [
        makeBehaviour({ operator: { c1: c1, c2: c2 } }),
        makeBehaviour({ operator: { c1: c1 }, widget: {} }),
    ];
    engine.behaviour = engine.behaviours[0];
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    engine.removeComponentList([c1, c2]);
    const modal = Wirecloud.ui.AlertWindowMenu._lastInstance;
    assert.ok(modal != null);
});

test('removeComponentList disabled branch removes all directly', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    const c1 = makeComponent({ id: 'dc1', type: 'operator' });
    const c2 = makeComponent({ id: 'dc2', type: 'widget' });
    engine.components.operator.dc1 = c1;
    engine.components.widget.dc2 = c2;
    engine.description.components.operator.dc1 = c1;
    engine.description.components.widget.dc2 = c2;
    let changes = 0;
    engine.addEventListener('change', function () { changes++; });
    engine.removeComponentList([c1, c2]);
    assert.equal(changes, 2);
});

test('removeComponentList returns this', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.removeComponentList([]), engine);
});

// =========================================================================
// removeConnection
// =========================================================================

test('removeConnection cascade=true removes from all behaviours', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b1 = makeBehaviour({ connections: [{ sourcename: 's', targetname: 't' }] });
    const b2 = makeBehaviour({ connections: [{ sourcename: 's', targetname: 't' }] });
    engine.behaviours = [b1, b2];
    engine.behaviour = b1;
    engine.description = { components: { operator: {}, widget: {} }, connections: [{ sourcename: 's', targetname: 't' }] };
    engine.removeConnection(makeConnection({ sourceId: 's', targetId: 't' }), true);
    assert.equal(b1._connections.length, 0);
    assert.equal(b2._connections.length, 0);
});

test('removeConnection cascade=false with connection elsewhere sets background', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const conn = makeConnection({ sourceId: 's', targetId: 't' });
    engine.behaviours = [
        makeBehaviour({ connections: [{ sourcename: 's', targetname: 't' }] }),
        makeBehaviour({ connections: [{ sourcename: 's', targetname: 't' }] }),
    ];
    engine.behaviour = engine.behaviours[0];
    engine.description = { components: { operator: {}, widget: {} }, connections: [{ sourcename: 's', targetname: 't' }] };
    engine.removeConnection(conn, false);
    assert.equal(conn.background, true);
});

test('removeConnection cascade=false last one fully removes', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.behaviours = [makeBehaviour({ connections: [{ sourcename: 'ls', targetname: 'lt' }] })];
    engine.behaviour = engine.behaviours[0];
    engine.description = { components: { operator: {}, widget: {} }, connections: [{ sourcename: 'ls', targetname: 'lt' }] };
    engine.removeConnection(makeConnection({ sourceId: 'ls', targetId: 'lt' }), false);
    assert.equal(engine.description.connections.length, 0);
});

test('removeConnection when disabled dispatches change', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    engine.description = { components: { operator: {}, widget: {} }, connections: [{ sourcename: 's', targetname: 't' }] };
    let changed = false;
    engine.addEventListener('change', function () { changed = true; });
    engine.removeConnection(makeConnection({ sourceId: 's', targetId: 't' }), false);
    assert.ok(changed);
});

test('removeConnection returns this', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    assert.equal(engine.removeConnection(makeConnection({ sourceId: 'r', targetId: 't' })), engine);
});

// =========================================================================
// stopOrdering
// =========================================================================

test('stopOrdering clicks btnOrder when orderingEnabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    let clicked = false;
    engine.btnOrder.click = function () { clicked = true; };
    engine.btnOrder.active = true;
    engine.stopOrdering();
    assert.ok(clicked);
});

test('stopOrdering does nothing when not orderingEnabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    let clicked = false;
    engine.btnOrder.click = function () { clicked = true; };
    engine.btnOrder.active = false;
    engine.stopOrdering();
    assert.ok(!clicked);
});

test('stopOrdering returns this', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.stopOrdering(), engine);
});

// =========================================================================
// toJSON
// =========================================================================

test('toJSON returns plain object with behaviours/components/connections', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.createBehaviour({ title: 'JSON Test' });
    engine.description.connections.push({ sourcename: 'a', targetname: 'b' });
    const json = engine.toJSON();
    assert.equal(json.behaviours.length, 1);
    assert.equal(json.connections.length, 1);
    assert.ok(json.components != null);
});

test('toJSON deep clones', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description.connections.push({ sourcename: 'a', targetname: 'b' });
    const json1 = engine.toJSON();
    const json2 = engine.toJSON();
    json1.connections[0].sourcename = 'modified';
    assert.equal(json2.connections[0].sourcename, 'a');
});

// =========================================================================
// updateComponent
// =========================================================================

test('updateComponent adds to description and components map', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    const comp = makeComponent({ id: 'newOp', type: 'operator' });
    engine.updateComponent(comp);
    assert.ok('newOp' in engine.description.components.operator);
    assert.equal(engine.components.operator.newOp, comp);
});

test('updateComponent enabled with !background updates behaviour', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.createBehaviour({ title: 'Active' });
    const comp = makeComponent({ id: 'ac', type: 'widget' });
    comp.background = false;
    engine.updateComponent(comp, false);
    assert.ok(engine.behaviour.hasComponent(comp));
    assert.equal(comp.removeAllowed, true);
    assert.equal(comp.background, false);
});

test('updateComponent beShared=true forces behaviour update', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.createBehaviour({ title: 'Active' });
    const comp = makeComponent({ id: 'bgComp', type: 'operator' });
    comp.background = true;
    engine.updateComponent(comp, true);
    assert.ok(engine.behaviour.hasComponent(comp));
    assert.equal(comp.background, false);
});

test('updateComponent when enabled but background true and not beShared skips behaviour update', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.createBehaviour({ title: 'Test' });
    const comp = makeComponent({ id: 'bgComp2', type: 'operator' });
    comp.background = true;
    engine.updateComponent(comp, false);
    assert.equal(engine.behaviour.hasComponent(comp), false);
});

test('updateComponent when disabled dispatches change', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    let changed = false;
    engine.addEventListener('change', function () { changed = true; });
    engine.updateComponent(makeComponent({ id: 'dc', type: 'widget' }));
    assert.ok(changed);
});

test('updateComponent returns this', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.updateComponent(makeComponent({ id: 'rc', type: 'operator' })), engine);
});

// =========================================================================
// updateConnection
// =========================================================================

test('updateConnection adds new connection to description', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    engine.updateConnection(makeConnection({ sourceId: 'ns', targetId: 'nt' }));
    assert.equal(engine.description.connections.length, 1);
});

test('updateConnection updates existing description entry', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    engine.description = {
        components: { operator: {}, widget: {} },
        connections: [{ sourcename: 's', targetname: 't', extra: 'old' }],
    };
    engine.updateConnection(makeConnection({ sourceId: 's', targetId: 't' }));
    assert.equal(engine.description.connections.length, 1);
});

test('updateConnection enabled with !background updates behaviour', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.createBehaviour({ title: 'Active' });
    const conn = makeConnection({ sourceId: 'us', targetId: 'ut' });
    conn.background = false;
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    engine.updateConnection(conn);
    assert.equal(conn.removeAllowed, true);
    assert.equal(conn.background, false);
});

test('updateConnection beShared=true forces behaviour update', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.createBehaviour({ title: 'Active' });
    const conn = makeConnection({ sourceId: 'bs', targetId: 'bt' });
    conn.background = true;
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    engine.updateConnection(conn, true);
    assert.equal(conn.background, false);
});

test('updateConnection when disabled dispatches change', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    let changed = false;
    engine.addEventListener('change', function () { changed = true; });
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    engine.updateConnection(makeConnection({ sourceId: 'ds', targetId: 'dt' }));
    assert.ok(changed);
});

test('updateConnection returns this', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    assert.equal(engine.updateConnection(makeConnection({ sourceId: 'rs', targetId: 'rt' })), engine);
});

// =========================================================================
// btnEnable click (btnenable_onclick)
// =========================================================================

test('btnEnable click when enabled shows AlertWindowMenu', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    engine.btnEnable.dispatchEvent('click');
    const modal = Wirecloud.ui.AlertWindowMenu._lastInstance;
    assert.ok(modal != null);
    assert.equal(modal._shown, true);
});

test('btnEnable click when enabled handler sets enabled=false', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.btnEnable.dispatchEvent('click');
    const modal = Wirecloud.ui.AlertWindowMenu._lastInstance;
    modal._handler();
    assert.equal(engine.enabled, false);
});

test('btnEnable click when disabled creates behaviour and enables', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = false;
    engine.btnEnable.dispatchEvent('click');
    assert.equal(engine.enabled, true);
    assert.equal(engine.behaviours.length, 1);
});

// =========================================================================
// btnCreate click (btncreate_onclick)
// =========================================================================

test('btnCreate click shows FormWindowMenu with correct fields', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    Wirecloud.ui.FormWindowMenu._lastInstance = null;
    engine.btnCreate.dispatchEvent('click');
    const dialog = Wirecloud.ui.FormWindowMenu._lastInstance;
    assert.ok(dialog != null);
    assert.equal(dialog._fields[0].name, 'title');
    assert.equal(dialog._fields[1].name, 'description');
    assert.equal(dialog._title, 'New behaviour');
    assert.equal(dialog._classname, 'we-new-behaviour-modal');
    assert.equal(dialog._shown, true);
});

test('btnCreate dialog executeOperation creates behaviour', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.btnCreate.dispatchEvent('click');
    const dialog = Wirecloud.ui.FormWindowMenu._lastInstance;
    dialog.executeOperation.call(engine, { title: 'Created', description: 'Desc' });
    assert.equal(engine.behaviours.length, 1);
    assert.equal(engine.behaviours[0].title, 'Created');
});

// =========================================================================
// btnOrder click (btnorder_onclick)
// =========================================================================

test('btnOrder click active makes behaviours draggable', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b1 = engine.createBehaviour({ title: 'B1' });
    const b2 = engine.createBehaviour({ title: 'B2' });
    engine.btnOrder.active = true;
    engine.btnOrder.dispatchEvent('click');
    assert.ok(b1.draggable instanceof Wirecloud.ui.Draggable);
    assert.ok(b2.draggable instanceof Wirecloud.ui.Draggable);
});

test('btnOrder click inactive destroys draggables', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b1 = engine.createBehaviour({ title: 'B1' });
    let destroyed = false;
    b1.draggable = { destroy() { destroyed = true; } };
    engine.btnOrder.active = false;
    engine.btnOrder.dispatchEvent('click');
    assert.ok(destroyed);
});

// =========================================================================
// enableToRemoveBehaviour / remove button state
// =========================================================================

test('create second behaviour enables remove buttons', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b1 = engine.createBehaviour({ title: 'B1' });
    const b2 = engine.createBehaviour({ title: 'B2' });
    assert.equal(b1.btnRemove.enabled, true);
    assert.equal(b2.btnRemove.enabled, true);
});

test('single behaviour disables remove buttons', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b1 = engine.createBehaviour({ title: 'B1' });
    assert.equal(b1.btnRemove.enabled, false);
});

// =========================================================================
// Full lifecycle integration tests
// =========================================================================

test('enable-disable-enable cycle', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.enabled, false);
    assert.equal(engine.ready, false);

    engine.btnEnable.dispatchEvent('click');
    assert.equal(engine.enabled, true);
    assert.equal(engine.behaviours.length, 1);

    engine.enabled = false;
    assert.equal(engine.behaviours.length, 0);

    engine.enabled = true;
    assert.equal(engine.behaviours.length, 0);
});

test('create-activate-remove lifecycle', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b1 = engine.createBehaviour({ title: 'First' });
    const b2 = engine.createBehaviour({ title: 'Second' });
    assert.equal(engine.behaviours.length, 2);
    // First behaviour remains active; second added but not active
    assert.equal(engine.behaviour, b1);
    engine.removeBehaviour(b1);
    assert.equal(engine.behaviours.length, 1);
    assert.equal(engine.behaviour, b2);
});

test('connection getIndex and remove lifecycle', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = { components: { operator: {}, widget: {} }, connections: [] };
    engine.enabled = false;
    const conn = makeConnection({ sourceId: 'lcs', targetId: 'lct' });
    engine.updateConnection(conn);
    assert.equal(engine.description.connections.length, 1);
    assert.equal(engine.getConnectionIndex(conn), 0);
    engine.removeConnection(conn);
    assert.equal(engine.description.connections.length, 0);
});

test('component add-update lifecycle', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const comp = makeComponent({ id: 'lifeComp', type: 'operator' });
    engine.updateComponent(comp);
    assert.equal(engine.components.operator.lifeComp, comp);
});

test('clear after full setup resets everything', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    engine.createBehaviour({ title: 'ToClear' });
    engine.clear();
    assert.equal(engine.enabled, false);
    assert.equal(engine.ready, false);
    assert.deepEqual(engine.behaviours, []);
    assert.equal(engine.behaviour, null);
});

test('emptyBehaviour when already active does not switch', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b = engine.createBehaviour({ title: 'Active' });
    engine.emptyBehaviour(b);
    assert.equal(engine.behaviour, b);
});

test('forEachComponent with multi-type components', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.components = {
        operator: { opA: makeComponent({ id: 'opA' }), opB: makeComponent({ id: 'opB' }) },
        widget: { wA: makeComponent({ id: 'wA', type: 'widget' }) },
    };
    const keys = [];
    engine.forEachComponent((c) => keys.push(c.id));
    assert.deepEqual(keys.sort(), ['opA', 'opB', 'wA']);
});

test('getConnectionIndex partial matches', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = {
        components: { operator: {}, widget: {} },
        connections: [
            { sourcename: 'a', targetname: 'b' },
            { sourcename: 'a', targetname: 'c' },
        ],
    };
    assert.equal(engine.getConnectionIndex(makeConnection({ sourceId: 'a', targetId: 'c' })), 1);
    assert.equal(engine.getConnectionIndex(makeConnection({ sourceId: 'a', targetId: 'x' })), -1);
});

test('updateComponent preserves existing description properties', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.description = {
        components: { operator: { existing: { preserved: true } }, widget: {} },
        connections: [],
    };
    engine.components = { operator: {}, widget: {} };
    const comp = makeComponent({ id: 'existing', type: 'operator' });
    comp.toJSON = function () { return { id: 'existing', type: 'operator', newProp: 'value' }; };
    engine.updateComponent(comp);
    assert.equal(engine.description.components.operator.existing.newProp, 'value');
});

// =========================================================================
// Edge cases
// =========================================================================

test('enabled setter true triggers _onenabled(true)', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.ready = true;
    let fired = false;
    engine.addEventListener('enable', function () { fired = true; });
    engine.enabled = true;
    assert.ok(fired);
});

test('enabled setter for same value is no-op', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    let fired = false;
    engine.addEventListener('enable', function () { fired = true; });
    engine.enabled = true;
    assert.ok(!fired);
});

test('orderingEnabled reflects btnOrder.active', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    assert.equal(engine.orderingEnabled, false);
    engine.btnOrder.active = true;
    assert.equal(engine.orderingEnabled, true);
});

test('removeComponent cascade=true handler fully removes', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const comp = makeComponent({ id: 'fullRemove', type: 'operator' });
    engine.components.operator.fullRemove = comp;
    engine.description.components.operator.fullRemove = comp;
    engine.behaviours = [
        makeBehaviour({ operator: { fullRemove: comp } }),
        makeBehaviour({ operator: { fullRemove: comp } }),
    ];
    engine.behaviour = engine.behaviours[0];
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    engine.removeComponent(comp, true);
    const modal = Wirecloud.ui.AlertWindowMenu._lastInstance;
    assert.ok(modal != null);
    modal._handler();
    assert.ok(!engine.components.operator.fullRemove);
});

test('removeComponentList modal handler processes components', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const c1 = makeComponent({ id: 'mc1', type: 'operator' });
    engine.behaviours = [makeBehaviour({ operator: { mc1: c1 } })];
    engine.behaviour = engine.behaviours[0];
    engine.description = { components: { operator: { mc1: {} }, widget: {} }, connections: [] };
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    engine.removeComponentList([c1]);
    const modal = Wirecloud.ui.AlertWindowMenu._lastInstance;
    assert.ok(modal != null);
    modal._handler();
});

test('removeComponentList empty componentsForModal', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const c1 = makeComponent({ id: 'ec1', type: 'operator' });
    engine.behaviours = [
        makeBehaviour({ operator: { ec1: c1 } }),
        makeBehaviour({ operator: { ec1: c1 } }),
    ];
    engine.behaviour = engine.behaviours[0];
    engine.description = { components: { operator: { ec1: {} }, widget: {} }, connections: [] };
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    engine.removeComponentList([c1]);
    assert.equal(Wirecloud.ui.AlertWindowMenu._lastInstance, null);
});

test('emptyBehaviour with behaviour that has nothing to remove', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b = engine.createBehaviour({ title: 'Empty' });
    assert.doesNotThrow(() => engine.emptyBehaviour(b));
});

test('event listener orderingEnabled property returns btnOrder.active', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const btn = engine.btnOrder;
    let observed = false;
    btn.active = false;
    assert.equal(engine.orderingEnabled, false);
    btn.active = true;
    assert.equal(engine.orderingEnabled, true);
});

// =============================================================================
// Tutorial link click (constructor line 379)
// =============================================================================

test('constructor tutorial link click starts tutorial', () => {
    var startCalled = false;
    Wirecloud.TutorialCatalogue = {
        get(name) {
            assert.equal(name, 'mashup-wiring-design');
            return { start() { startCalled = true; } };
        }
    };
    var clickHandler;
    var origAddNote = StyledElements.Alert.prototype.addNote;
    StyledElements.Alert.prototype.addNote = function (textContent) {
        var fakeChild = document.createElement('div');
        fakeChild.addEventListener = function (event, handler) {
            if (event === 'click') clickHandler = handler;
        };
        return { firstElementChild: fakeChild };
    };
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    StyledElements.Alert.prototype.addNote = origAddNote;
    assert.ok(typeof clickHandler === 'function');
    clickHandler();
    assert.ok(startCalled);
});

// =============================================================================
// emptyBehaviour early return when disabled (line 520)
// =============================================================================

test('emptyBehaviour returns early when engine is disabled', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    const b = engine.createBehaviour({ title: 'Test' });
    engine.enabled = false;
    assert.equal(engine.emptyBehaviour(b), engine);
});

// =============================================================================
// emptyBehaviour removes components from target behaviour (lines 530-532)
// =============================================================================

test('emptyBehaviour removes components belonging to target behaviour', () => {
    const engine = new Wirecloud.ui.WiringEditor.BehaviourEngine();
    engine.enabled = true;
    const b = engine.createBehaviour({ title: 'Test' });
    const comp = makeComponent({ id: 'c1', type: 'operator' });

    engine.components.operator.c1 = comp;
    engine.description.components.operator.c1 = {};
    b._components.operator.c1 = comp;

    engine.emptyBehaviour(b);

    assert.ok(!('c1' in engine.components.operator));
    assert.ok(!('c1' in engine.description.components.operator));
});
