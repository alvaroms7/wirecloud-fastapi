const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = { WiringEditor: {} };

    StyledElements.Tooltip = class Tooltip {
        constructor(options) {
            this.options = Object.assign({content: '', placement: ['right', 'bottom', 'left', 'top']}, options);
        }
        bind() {}
        show() { return this; }
        hide() { return this; }
        destroy() {}
    };

    StyledElements.PopupMenu = class PopupMenu {
        constructor() {
            this.wrapperElement = document.createElement('div');
            this._items = [];
            this._visible = false;
            this._listeners = {};
        }
        append(item) { this._items.push(item); return this; }
        isVisible() { return this._visible; }
        addEventListener(name, handler) {
            if (this._listeners[name] == null) {
                this._listeners[name] = [];
            }
            this._listeners[name].push(handler);
        }
        show() { this._visible = true; return this; }
        hide() { this._visible = false; }
        moveFocusDown() { return this; }
        moveFocusUp() { return this; }
        hasEnabledItem() { return false; }
        clearEventListeners() {}
    };

    // Mock LogManager
    Wirecloud.LogManager = function LogManager(parent) {
        this.parent = parent;
        this.entries = [];
    };

    // Mock GlobalLogManager
    const globalLogEntries = [];
    Wirecloud.GlobalLogManager = {
        entries: globalLogEntries,
        addEntry: (entry) => { globalLogEntries.push(entry); },
    };

    // Mock LogWindowMenu
    Wirecloud.ui.LogWindowMenu = function LogWindowMenu(logManager, options) {
        this.logManager = logManager;
        this.options = options;
        this._shown = false;
        LogWindowMenu._lastInstance = this;
    };
    Wirecloud.ui.LogWindowMenu.prototype.show = function () {
        this._shown = true;
        return this;
    };
    Wirecloud.ui.LogWindowMenu._lastInstance = null;

    // Mock FormWindowMenu
    Wirecloud.ui.FormWindowMenu = function FormWindowMenu(fields, title, classname) {
        this._fields = fields;
        this._title = title;
        this._classname = classname;
        this._executeOperation = null;
        this._value = null;
        this._shown = false;
        FormWindowMenu._lastInstance = this;
    };
    Wirecloud.ui.FormWindowMenu.prototype.show = function () {
        this._shown = true;
        return this;
    };
    Wirecloud.ui.FormWindowMenu.prototype.setValue = function (obj) {
        this._value = obj;
        return this;
    };
    Wirecloud.ui.FormWindowMenu._lastInstance = null;

    // Mock AlertWindowMenu
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
    Wirecloud.ui.AlertWindowMenu.prototype.show = function () {
        this._shown = true;
        return this;
    };
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;

    // Load StyledElements dependencies
    loadLegacyScripts([
        'src/wirecloud/commons/static/js/StyledElements/Fragment.js',
        'src/wirecloud/commons/static/js/StyledElements/Container.js',
        'src/wirecloud/commons/static/js/StyledElements/Button.js',
        'src/wirecloud/commons/static/js/StyledElements/Panel.js',
        'src/wirecloud/commons/static/js/StyledElements/PopupButton.js',
        'src/wirecloud/commons/static/js/StyledElements/DynamicMenuItems.js',
        'src/wirecloud/commons/static/js/StyledElements/MenuItem.js',
    ]);

    // Mock BehaviourPrefs
    if (global.StyledElements == null) {
        global.StyledElements = {};
    }
    if (StyledElements.DynamicMenuItems == null) {
        StyledElements.DynamicMenuItems = class DynamicMenuItems {
            constructor() {}
            build() { return []; }
        };
    }
    if (StyledElements.MenuItem == null) {
        StyledElements.MenuItem = class MenuItem {
            constructor(title, onclick) {
                this.title = title;
                this.onclick = onclick;
            }
            addIconClass() { return this; }
        };
    }
    Wirecloud.ui.WiringEditor.BehaviourPrefs = class BehaviourPrefs extends StyledElements.DynamicMenuItems {
        constructor(behaviour) {
            super();
            this.behaviour = behaviour;
        }
        build() {
            return [
                new StyledElements.MenuItem("Logs", () => { this.behaviour.showLogs(); }),
                new StyledElements.MenuItem("Settings", () => { this.behaviour.showSettings(); }),
            ];
        }
    };

    // Load the file under test
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/Behaviour.js',
    ]);
});

// =========================================================================
// JSON_TEMPLATE
// =========================================================================

test('Behaviour.JSON_TEMPLATE is correct', () => {
    const tmpl = Wirecloud.ui.WiringEditor.Behaviour.JSON_TEMPLATE;
    assert.deepEqual(tmpl, {
        title: "",
        description: "",
        active: false,
        components: {operator: {}, widget: {}},
        connections: []
    });
});

// =========================================================================
// Constructor tests
// =========================================================================

test('constructor creates Behaviour instance', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Test'});
    assert.ok(behaviour instanceof StyledElements.Panel);
    assert.ok(behaviour instanceof Wirecloud.ui.WiringEditor.Behaviour);
    assert.equal(behaviour.index, 0);
    assert.equal(behaviour.active, false);
});

test('constructor throws TypeError for empty title', () => {
    assert.throws(() => {
        new Wirecloud.ui.WiringEditor.Behaviour(0, {title: ''});
    }, TypeError);
    assert.throws(() => {
        new Wirecloud.ui.WiringEditor.Behaviour(0, {title: '   '});
    }, TypeError);
});

test('constructor with default options applies JSON_TEMPLATE', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(5, {title: 'My Behaviour'});
    assert.equal(behaviour.title, 'My Behaviour');
    assert.equal(behaviour.description, '');
    assert.equal(behaviour.active, false);
    assert.deepEqual(behaviour.components, {operator: {}, widget: {}});
    assert.deepEqual(behaviour.connections, []);
});

test('constructor with active=true option', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Active', active: true});
    assert.equal(behaviour.active, true);
});

test('constructor with description option', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Desc', description: 'Some description'});
    assert.equal(behaviour.description, 'Some description');
});

test('constructor creates btnPrefs as PopupButton', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Prefs Test'});
    assert.ok(behaviour.btnPrefs instanceof StyledElements.PopupButton);
    assert.equal(behaviour.btnPrefs.popup_menu._items.length, 1);
    assert.ok(behaviour.btnPrefs.popup_menu._items[0] instanceof Wirecloud.ui.WiringEditor.BehaviourPrefs);
    assert.equal(behaviour.btnPrefs.popup_menu._items[0].behaviour, behaviour);
});

test('constructor creates btnRemove as Button', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Remove Test'});
    assert.ok(behaviour.btnRemove instanceof StyledElements.Button);
});

test('constructor adds panel class and behaviour class', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Class Test'});
    assert.ok(behaviour.hasClassName('behaviour'));
    assert.ok(behaviour.hasClassName('panel'));
});

test('constructor is selectable', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Selectable Test'});
    assert.ok(behaviour.hasClassName('panel-selectable'));
});

test('constructor sets heading title class name', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Heading Test'});
    assert.ok(behaviour.heading.title.hasClassName('se-link'));
    assert.ok(behaviour.heading.title.hasClassName('behaviour-title'));
    assert.ok(behaviour.heading.title.hasClassName('text-truncate'));
});

test('constructor creates descriptionElement', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Desc Element Test',
        description: 'A description'
    });
    assert.equal(behaviour.descriptionElement.tagName, 'P');
    assert.equal(behaviour.descriptionElement.className, 'behaviour-description');
    assert.equal(behaviour.descriptionElement.textContent, 'A description');
    assert.equal(behaviour.descriptionElement.getAttribute('role'), 'note');
    assert.equal(behaviour.descriptionElement.parentElement, behaviour.body.wrapperElement);
});

test('constructor creates descriptionElement with empty description', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'No Desc'});
    assert.equal(behaviour.descriptionElement.textContent, '');
});

test('constructor creates logManager', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Log Test'});
    assert.ok(behaviour.logManager instanceof Wirecloud.LogManager);
    assert.equal(behaviour.logManager.parent, Wirecloud.GlobalLogManager);
});

test('constructor stores custom components', () => {
    const customComps = {operator: {op1: {}}, widget: {w1: {}, w2: {}}};
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Comps Test',
        components: customComps
    });
    assert.deepEqual(behaviour.components, customComps);
});

test('constructor stores custom connections', () => {
    const customConns = [
        {sourcename: 'src1', targetname: 'tgt1'},
        {sourcename: 'src2', targetname: 'tgt2'},
    ];
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Conns Test',
        connections: customConns
    });
    assert.deepEqual(behaviour.connections, customConns);
});

test('constructor stores index', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(42, {title: 'Index Test'});
    assert.equal(behaviour.index, 42);
});

// =========================================================================
// description getter/setter
// =========================================================================

test('description getter returns textContent', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Getter',
        description: 'Initial description'
    });
    assert.equal(behaviour.description, 'Initial description');
});

test('description setter updates textContent', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Setter'});
    behaviour.description = 'Updated description';
    assert.equal(behaviour.description, 'Updated description');
    assert.equal(behaviour.descriptionElement.textContent, 'Updated description');
});

// =========================================================================
// index getter/setter
// =========================================================================

test('index getter returns Number from data-index', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(7, {title: 'Index Getter'});
    assert.equal(behaviour.index, 7);
});

test('index setter with valid number', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Index Setter'});
    behaviour.index = 99;
    assert.equal(behaviour.index, 99);
    assert.equal(behaviour.get().getAttribute('data-index'), '99');
});

test('index setter with numeric string', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'String Index'});
    behaviour.index = '123';
    assert.equal(behaviour.index, 123);
});

test('index setter with NaN throws TypeError', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'NaN Index'});
    assert.throws(() => {
        behaviour.index = 'not-a-number';
    }, TypeError);
});

test('index setter with undefined throws TypeError', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Undefined Index'});
    assert.throws(() => {
        behaviour.index = undefined;
    }, TypeError);
});

// =========================================================================
// titletooltip getter
// =========================================================================

test('titletooltip getter creates Tooltip and caches it', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Tooltip Test'});
    const tooltip1 = behaviour.titletooltip;
    assert.ok(tooltip1 instanceof StyledElements.Tooltip);
    const tooltip2 = behaviour.titletooltip;
    assert.equal(tooltip1, tooltip2);
});

test('titletooltip placement options', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Tooltip Placement'});
    const tooltip = behaviour.titletooltip;
    assert.deepEqual(tooltip.options.placement, ['top', 'bottom', 'right', 'left']);
});

// =========================================================================
// _onclick tests
// =========================================================================

test('_onclick when not active calls super._onclick', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Onclick Test'});
    let superCalled = false;
    const originalOnclick = StyledElements.Panel.prototype._onclick;
    StyledElements.Panel.prototype._onclick = function () { superCalled = true; };
    const result = behaviour._onclick({stopPropagation: () => {}});
    assert.ok(superCalled);
    assert.equal(result, behaviour);
    StyledElements.Panel.prototype._onclick = originalOnclick;
});

test('_onclick when active does not call super._onclick', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Active Onclick', active: true});
    let superCalled = false;
    const originalOnclick = StyledElements.Panel.prototype._onclick;
    StyledElements.Panel.prototype._onclick = function () { superCalled = true; };
    const result = behaviour._onclick({stopPropagation: () => {}});
    assert.equal(superCalled, false);
    assert.equal(result, behaviour);
    StyledElements.Panel.prototype._onclick = originalOnclick;
});

// =========================================================================
// clear tests
// =========================================================================

test('clear resets components and connections', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Clear Test',
        components: {operator: {op1: {}}, widget: {w1: {}}},
        connections: [{sourcename: 'a', targetname: 'b'}]
    });
    assert.equal(Object.keys(behaviour.components.operator).length, 1);
    assert.equal(behaviour.connections.length, 1);
    behaviour.clear();
    assert.deepEqual(behaviour.components, {operator: {}, widget: {}});
    assert.deepEqual(behaviour.connections, []);
});

test('clear dispatches change event', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Clear Event'});
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    behaviour.clear();
    assert.ok(changed);
});

// =========================================================================
// setTitle tests
// =========================================================================

test('setTitle creates span with correct text', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Old Title'});
    const result = behaviour.setTitle('New Title');
    const titleSpan = behaviour.heading.title.wrapperElement.firstChild;
    assert.equal(titleSpan.tagName, 'SPAN');
    assert.equal(titleSpan.textContent, 'New Title');
    assert.equal(result, behaviour);
});

test('setTitle sets aria-label on span', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Aria Test'});
    behaviour.setTitle('Aria Title');
    const titleSpan = behaviour.heading.title.wrapperElement.firstChild;
    assert.ok(titleSpan.getAttribute('aria-label').includes('Behaviour:'));
    assert.ok(titleSpan.getAttribute('aria-label').includes('Aria Title'));
});

test('setTitle updates tooltip content and binds', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Tooltip Title'});
    behaviour.setTitle('Titled');
    assert.equal(behaviour.titletooltip.options.content, 'Titled');
});

// =========================================================================
// equals tests
// =========================================================================

test('equals returns true for same object', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Same'});
    assert.equal(behaviour.equals(behaviour), true);
});

test('equals returns false for different object', () => {
    const b1 = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'First'});
    const b2 = new Wirecloud.ui.WiringEditor.Behaviour(1, {title: 'Second'});
    assert.equal(b1.equals(b2), false);
    assert.equal(b2.equals(b1), false);
});

test('equals returns false for unrelated object', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Test'});
    assert.equal(behaviour.equals({}), false);
});

// =========================================================================
// getConnectionIndex tests
// =========================================================================

test('getConnectionIndex finds matching connection', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Index Find',
        connections: [
            {sourcename: 'a', targetname: 'b'},
            {sourcename: 'c', targetname: 'd'},
            {sourcename: 'e', targetname: 'f'},
        ]
    });
    const idx = behaviour.getConnectionIndex({sourceId: 'c', targetId: 'd'});
    assert.equal(idx, 1);
});

test('getConnectionIndex returns 0 for first match', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'First Match',
        connections: [
            {sourcename: 'x', targetname: 'y'},
        ]
    });
    assert.equal(behaviour.getConnectionIndex({sourceId: 'x', targetId: 'y'}), 0);
});

test('getConnectionIndex returns -1 when not found', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Not Found',
        connections: [
            {sourcename: 'a', targetname: 'b'},
        ]
    });
    assert.equal(behaviour.getConnectionIndex({sourceId: 'z', targetId: 'b'}), -1);
    assert.equal(behaviour.getConnectionIndex({sourceId: 'a', targetId: 'z'}), -1);
});

test('getConnectionIndex returns -1 for empty connections', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Empty'});
    assert.equal(behaviour.getConnectionIndex({sourceId: 'a', targetId: 'b'}), -1);
});

test('getConnectionIndex matches on both sourcename and targetname', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Both Match',
        connections: [
            {sourcename: 'src', targetname: 'tgt', extra: true},
        ]
    });
    assert.equal(behaviour.getConnectionIndex({sourceId: 'src', targetId: 'tgt'}), 0);
});

// =========================================================================
// getCurrentStatus tests
// =========================================================================

test('getCurrentStatus returns correct counts', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Status Test',
        components: {
            operator: {op1: {}, op2: {}},
            widget: {w1: {}}
        },
        connections: [{sourcename: 'a', targetname: 'b'}, {sourcename: 'c', targetname: 'd'}]
    });
    const status = behaviour.getCurrentStatus();
    assert.equal(status.title, 'Status Test');
    assert.equal(status.connections, 2);
    assert.equal(status.components.operator, 2);
    assert.equal(status.components.widget, 1);
});

test('getCurrentStatus with empty components and connections', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Empty Status'});
    const status = behaviour.getCurrentStatus();
    assert.equal(status.title, 'Empty Status');
    assert.equal(status.connections, 0);
    assert.equal(status.components.operator, 0);
    assert.equal(status.components.widget, 0);
});

test('getCurrentStatus with only operators', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Ops Only',
        components: {operator: {op1: {}, op2: {}, op3: {}}, widget: {}}
    });
    const status = behaviour.getCurrentStatus();
    assert.equal(status.components.operator, 3);
    assert.equal(status.components.widget, 0);
});

test('getCurrentStatus with only widgets', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Widgets Only',
        components: {operator: {}, widget: {w1: {}, w2: {}, w3: {}, w4: {}}}
    });
    const status = behaviour.getCurrentStatus();
    assert.equal(status.components.operator, 0);
    assert.equal(status.components.widget, 4);
});

// =========================================================================
// hasComponent tests
// =========================================================================

test('hasComponent returns true when component is present', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Has Comp',
        components: {operator: {op1: {}}, widget: {w1: {}}}
    });
    assert.equal(behaviour.hasComponent({id: 'op1', type: 'operator'}), true);
    assert.equal(behaviour.hasComponent({id: 'w1', type: 'widget'}), true);
});

test('hasComponent returns false when component is absent', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'No Comp',
        components: {operator: {}, widget: {}}
    });
    assert.equal(behaviour.hasComponent({id: 'missing', type: 'operator'}), false);
    assert.equal(behaviour.hasComponent({id: 'missing', type: 'widget'}), false);
});

test('hasComponent returns false when type is empty', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'No Type'});
    assert.equal(behaviour.hasComponent({id: 'x', type: 'operator'}), false);
});

// =========================================================================
// hasConnection tests
// =========================================================================

test('hasConnection returns true when matching', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Has Conn',
        connections: [
            {sourcename: 'src', targetname: 'tgt'}
        ]
    });
    assert.equal(behaviour.hasConnection({sourceId: 'src', targetId: 'tgt'}), true);
});

test('hasConnection returns false when not matching', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'No Conn',
        connections: [
            {sourcename: 'a', targetname: 'b'}
        ]
    });
    assert.equal(behaviour.hasConnection({sourceId: 'x', targetId: 'y'}), false);
});

test('hasConnection returns false for empty connections', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Empty Conns'});
    assert.equal(behaviour.hasConnection({sourceId: 'a', targetId: 'b'}), false);
});

test('hasConnection with multiple connections finds correct one', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Multi Conn',
        connections: [
            {sourcename: 'a', targetname: 'b'},
            {sourcename: 'c', targetname: 'd'},
            {sourcename: 'e', targetname: 'f'},
        ]
    });
    assert.equal(behaviour.hasConnection({sourceId: 'c', targetId: 'd'}), true);
    assert.equal(behaviour.hasConnection({sourceId: 'a', targetId: 'd'}), false);
});

// =========================================================================
// removeComponent tests
// =========================================================================

test('removeComponent removes existing component', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Remove Comp',
        components: {operator: {op1: {}, op2: {}}, widget: {}}
    });
    assert.equal(behaviour.hasComponent({id: 'op1', type: 'operator'}), true);
    const result = behaviour.removeComponent({id: 'op1', type: 'operator'});
    assert.equal(result, behaviour);
    assert.equal(behaviour.hasComponent({id: 'op1', type: 'operator'}), false);
    assert.equal(behaviour.hasComponent({id: 'op2', type: 'operator'}), true);
});

test('removeComponent dispatches change event', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Remove Event',
        components: {operator: {op1: {}}, widget: {}}
    });
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    behaviour.removeComponent({id: 'op1', type: 'operator'});
    assert.ok(changed);
});

test('removeComponent does nothing for absent component', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'No Remove',
        components: {operator: {}, widget: {}}
    });
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    const result = behaviour.removeComponent({id: 'nope', type: 'operator'});
    assert.equal(result, behaviour);
    assert.equal(changed, false);
});

// =========================================================================
// removeConnection tests
// =========================================================================

test('removeConnection removes existing connection', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Remove Conn',
        connections: [
            {sourcename: 'a', targetname: 'b'},
            {sourcename: 'c', targetname: 'd'},
        ]
    });
    assert.equal(behaviour.connections.length, 2);
    const result = behaviour.removeConnection({sourceId: 'a', targetId: 'b'});
    assert.equal(result, behaviour);
    assert.equal(behaviour.connections.length, 1);
    assert.equal(behaviour.connections[0].sourcename, 'c');
});

test('removeConnection dispatches change event', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Remove Conn Event',
        connections: [{sourcename: 'a', targetname: 'b'}]
    });
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    behaviour.removeConnection({sourceId: 'a', targetId: 'b'});
    assert.ok(changed);
});

test('removeConnection does nothing for absent connection', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'No Conn Remove',
        connections: [{sourcename: 'a', targetname: 'b'}]
    });
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    const result = behaviour.removeConnection({sourceId: 'x', targetId: 'y'});
    assert.equal(result, behaviour);
    assert.equal(changed, false);
    assert.equal(behaviour.connections.length, 1);
});

test('removeConnection with empty connections array', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Empty Remove'});
    const result = behaviour.removeConnection({sourceId: 'a', targetId: 'b'});
    assert.equal(result, behaviour);
});

// =========================================================================
// showLogs tests
// =========================================================================

test('showLogs creates LogWindowMenu and shows it', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Logs Test'});
    const result = behaviour.showLogs();
    assert.equal(result, behaviour);
    const dialog = Wirecloud.ui.LogWindowMenu._lastInstance;
    assert.ok(dialog instanceof Wirecloud.ui.LogWindowMenu);
    assert.equal(dialog.logManager, behaviour.logManager);
    assert.ok(dialog.options.title.includes('Logs Test'));
    assert.equal(dialog._shown, true);
});

// =========================================================================
// showSettings tests
// =========================================================================

test('showSettings creates FormWindowMenu with correct fields', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Settings Test'});
    const result = behaviour.showSettings();
    assert.equal(result, behaviour);
    const dialog = Wirecloud.ui.FormWindowMenu._lastInstance;
    assert.ok(dialog instanceof Wirecloud.ui.FormWindowMenu);
    assert.equal(dialog._fields.length, 2);
    assert.equal(dialog._fields[0].name, 'title');
    assert.equal(dialog._fields[0].required, true);
    assert.equal(dialog._fields[0].type, 'text');
    assert.equal(dialog._fields[1].name, 'description');
    assert.equal(dialog._fields[1].type, 'longtext');
    assert.equal(dialog._title, 'Behaviour settings');
    assert.equal(dialog._classname, 'behaviour-update-form');
    assert.equal(dialog._shown, true);
});

test('showSettings executeOperation updates behaviour', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Update Test'});
    behaviour.showSettings();
    const dialog = Wirecloud.ui.FormWindowMenu._lastInstance;
    // Simulate calling executeOperation from the dialog
    dialog.executeOperation.call(behaviour, {title: 'New Title  ', description: 'New desc'});
    assert.equal(behaviour.title, 'New Title');
    assert.equal(behaviour.description, 'New desc');
});

test('showSettings setValue is called with behaviour', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'SetValue Test'});
    behaviour.showSettings();
    const dialog = Wirecloud.ui.FormWindowMenu._lastInstance;
    assert.equal(dialog._value, behaviour);
});

// =========================================================================
// toJSON tests
// =========================================================================

test('toJSON returns correct plain object', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'JSON Test',
        description: 'JSON Desc',
        active: true,
        components: {operator: {op1: {}}, widget: {w1: {}}},
        connections: [{sourcename: 'a', targetname: 'b'}]
    });
    const json = behaviour.toJSON();
    assert.deepEqual(json, {
        title: 'JSON Test',
        description: 'JSON Desc',
        active: true,
        components: {operator: {op1: {}}, widget: {w1: {}}},
        connections: [{sourcename: 'a', targetname: 'b'}]
    });
});

test('toJSON with defaults', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Default JSON'});
    const json = behaviour.toJSON();
    assert.equal(json.title, 'Default JSON');
    assert.equal(json.description, '');
    assert.equal(json.active, false);
    assert.deepEqual(json.components, {operator: {}, widget: {}});
    assert.deepEqual(json.connections, []);
});

// =========================================================================
// updateComponent tests
// =========================================================================

test('updateComponent adds new component', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Add Comp'});
    assert.equal(behaviour.hasComponent({id: 'newOp', type: 'operator'}), false);
    const result = behaviour.updateComponent({id: 'newOp', type: 'operator'});
    assert.equal(result, behaviour);
    assert.equal(behaviour.hasComponent({id: 'newOp', type: 'operator'}), true);
    assert.deepEqual(behaviour.components.operator.newOp, {});
});

test('updateComponent dispatches change event for new component', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Add Comp Event'});
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    behaviour.updateComponent({id: 'w', type: 'widget'});
    assert.ok(changed);
});

test('updateComponent does not dispatch change for existing component', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Exists Comp',
        components: {operator: {existing: {value: 42}}, widget: {}}
    });
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    behaviour.updateComponent({id: 'existing', type: 'operator'});
    assert.equal(changed, false);
    // Preserve existing value
    assert.equal(behaviour.components.operator.existing.value, 42);
});

test('updateComponent adds widget type component', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Add Widget'});
    behaviour.updateComponent({id: 'widget1', type: 'widget'});
    assert.equal(behaviour.hasComponent({id: 'widget1', type: 'widget'}), true);
});

// =========================================================================
// updateConnection tests
// =========================================================================

test('updateConnection adds new connection', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Add Conn'});
    assert.equal(behaviour.connections.length, 0);
    const result = behaviour.updateConnection({sourceId: 'src', targetId: 'tgt'});
    assert.equal(result, behaviour);
    assert.equal(behaviour.connections.length, 1);
    assert.equal(behaviour.connections[0].sourcename, 'src');
    assert.equal(behaviour.connections[0].targetname, 'tgt');
});

test('updateConnection dispatches change event for new connection', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Add Conn Event'});
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    behaviour.updateConnection({sourceId: 's', targetId: 't'});
    assert.ok(changed);
});

test('updateConnection does not duplicate existing connection', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Dup Conn',
        connections: [{sourcename: 'src', targetname: 'tgt'}]
    });
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });
    behaviour.updateConnection({sourceId: 'src', targetId: 'tgt'});
    assert.equal(changed, false);
    assert.equal(behaviour.connections.length, 1);
});

// =========================================================================
// btnremove_onclick (private function) tests
// =========================================================================

test('btnRemove click with connections shows AlertWindowMenu', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Remove Alert',
        connections: [{sourcename: 'a', targetname: 'b'}]
    });
    behaviour.btnRemove.dispatchEvent('click');
    const dialog = Wirecloud.ui.AlertWindowMenu._lastInstance;
    assert.ok(dialog instanceof Wirecloud.ui.AlertWindowMenu);
    assert.equal(dialog._shown, true);
    assert.ok(dialog.options.message.length > 0);
    assert.ok(dialog.options.acceptLabel.length > 0);
    assert.ok(dialog.options.cancelLabel.length > 0);
});

test('btnRemove click with connections - AlertWindowMenu handler dispatches optremove', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Remove Handler',
        connections: [{sourcename: 'a', targetname: 'b'}]
    });
    let removed = false;
    behaviour.addEventListener('optremove', () => { removed = true; });
    behaviour.btnRemove.dispatchEvent('click');
    const dialog = Wirecloud.ui.AlertWindowMenu._lastInstance;
    dialog._handler();
    assert.ok(removed);
});

test('btnRemove click without connections dispatches optremove directly', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Direct Remove',
        connections: []
    });
    let removed = false;
    behaviour.addEventListener('optremove', () => { removed = true; });
    behaviour.btnRemove.dispatchEvent('click');
    assert.ok(removed);
});

test('btnRemove click without connections does not show alert', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'No Alert',
        connections: []
    });
    Wirecloud.ui.AlertWindowMenu._lastInstance = null;
    behaviour.btnRemove.dispatchEvent('click');
    assert.equal(Wirecloud.ui.AlertWindowMenu._lastInstance, null);
});

// =========================================================================
// updateInfo (private function) tests
// =========================================================================

test('updateInfo sets title and description and dispatches change', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Before', description: 'Before desc'});
    let changed = false;
    behaviour.addEventListener('change', () => { changed = true; });

    // Access updateInfo through showSettings -> executeOperation
    behaviour.showSettings();
    const dialog = Wirecloud.ui.FormWindowMenu._lastInstance;
    dialog.executeOperation.call(behaviour, {title: '  After  ', description: 'After desc'});

    assert.equal(behaviour.title, 'After');
    assert.equal(behaviour.description, 'After desc');
    assert.ok(changed);
});

test('updateInfo trims title whitespace', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Before'});
    behaviour.showSettings();
    Wirecloud.ui.FormWindowMenu._lastInstance.executeOperation.call(behaviour, {
        title: '\t\n Padded Title \t\n',
        description: ''
    });
    assert.equal(behaviour.title, 'Padded Title');
});

// =========================================================================
// Integration / combined lifecycle tests
// =========================================================================

test('full add-remove cycle for components and connections', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Cycle Test'});

    // Add components
    behaviour.updateComponent({id: 'op1', type: 'operator'});
    behaviour.updateComponent({id: 'w1', type: 'widget'});
    assert.equal(behaviour.hasComponent({id: 'op1', type: 'operator'}), true);
    assert.equal(behaviour.hasComponent({id: 'w1', type: 'widget'}), true);

    // Add connections
    behaviour.updateConnection({sourceId: 'op1', targetId: 'w1'});
    assert.equal(behaviour.connections.length, 1);

    // Check status
    const status = behaviour.getCurrentStatus();
    assert.equal(status.components.operator, 1);
    assert.equal(status.components.widget, 1);
    assert.equal(status.connections, 1);

    // Remove connection
    behaviour.removeConnection({sourceId: 'op1', targetId: 'w1'});
    assert.equal(behaviour.connections.length, 0);

    // Remove component
    behaviour.removeComponent({id: 'op1', type: 'operator'});
    assert.equal(behaviour.hasComponent({id: 'op1', type: 'operator'}), false);
});

test('toJSON after mutation reflects current state', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Mutate'});
    behaviour.description = 'Updated';
    behaviour.updateComponent({id: 'c1', type: 'widget'});
    behaviour.updateConnection({sourceId: 'c1', targetId: 'c2'});
    const json = behaviour.toJSON();
    assert.equal(json.description, 'Updated');
    assert.ok('c1' in json.components.widget);
    assert.equal(json.connections.length, 1);
});

test('multiple behaviours are independent', () => {
    const b1 = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'First',
        components: {operator: {o1: {}}, widget: {}},
        connections: [{sourcename: 'a', targetname: 'b'}]
    });
    const b2 = new Wirecloud.ui.WiringEditor.Behaviour(1, {
        title: 'Second',
        components: {operator: {}, widget: {w1: {}}},
        connections: []
    });

    assert.equal(b1.title, 'First');
    assert.equal(b2.title, 'Second');
    assert.equal(b1.index, 0);
    assert.equal(b2.index, 1);
    assert.notEqual(b1.logManager, b2.logManager);

    b2.updateComponent({id: 'o1', type: 'operator'});
    assert.equal(b1.hasComponent({id: 'o1', type: 'operator'}), true);
    assert.equal(b2.hasComponent({id: 'o1', type: 'operator'}), true);
});

// =========================================================================
// Edge cases
// =========================================================================

test('constructor with empty description creates element with empty text', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'No Desc', description: ''});
    assert.equal(behaviour.descriptionElement.textContent, '');
});

test('getConnectionIndex with sourcename match but targetname mismatch', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Partial Match',
        connections: [{sourcename: 'src', targetname: 'correct'}]
    });
    assert.equal(behaviour.getConnectionIndex({sourceId: 'src', targetId: 'wrong'}), -1);
});

test('getConnectionIndex with targetname match but sourcename mismatch', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {
        title: 'Partial Match 2',
        connections: [{sourcename: 'correct', targetname: 'tgt'}]
    });
    assert.equal(behaviour.getConnectionIndex({sourceId: 'wrong', targetId: 'tgt'}), -1);
});

test('showLogs title interpolation', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'My Logs'});
    behaviour.showLogs();
    const dialog = Wirecloud.ui.LogWindowMenu._lastInstance;
    assert.ok(dialog.options.title.includes('My Logs'));
});

test('description setter with empty string', () => {
    const behaviour = new Wirecloud.ui.WiringEditor.Behaviour(0, {title: 'Desc Empty', description: 'has text'});
    assert.equal(behaviour.description, 'has text');
    behaviour.description = '';
    assert.equal(behaviour.description, '');
});
