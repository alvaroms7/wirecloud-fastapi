const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

let wrapperId = 0;
let createdButtons = [];
let lastMessage = null;

class MockButtonsGroup {
    constructor(name) {
        this.name = name;
        this._value = '';
        this._disabled = false;
        this._listeners = {};
        this.wrapperElement = document.createElement('div');
    }
    setValue(v) { this._value = v; }
    setDisabled(v) { this._disabled = v; }
    addEventListener(t, h) { this._listeners[t] = h; }
    dispatchEvent(t) { if (this._listeners[t]) this._listeners[t](); }
    get value() { return this._value; }
}

class MockContainer {
    constructor(opts) {
        this.options = opts || {};
        this._disabled = false;
        this._children = [];
        this.wrapperElement = document.createElement('div');
        if (this.options.class) this.wrapperElement.className = this.options.class;
    }
    appendChild(c) {
        this._children.push(c);
        if (c && c.wrapperElement) this.wrapperElement.appendChild(c.wrapperElement);
        else if (c && c.nodeType) this.wrapperElement.appendChild(c);
    }
    appendTo(parent) {
        if (parent && parent.wrapperElement) parent.wrapperElement.appendChild(this.wrapperElement);
        else if (parent && parent.appendChild) parent.appendChild(this.wrapperElement);
    }
    removeChild(c) { this._children = this._children.filter(x => x !== c); }
    setDisabled(v) { this._disabled = v; }
}

class MockButton {
    constructor(opts) {
        this.options = opts || {};
        this._enabled = true;
        this._listeners = {};
        this.wrapperElement = document.createElement('button');
    }
    appendTo(parent) {
        if (parent && parent.wrapperElement) parent.wrapperElement.appendChild(this.wrapperElement);
        else if (parent && parent.appendChild) parent.appendChild(this.wrapperElement);
    }
    addEventListener(t, h) { this._listeners[t] = h; }
    click() { if (this._listeners.click) this._listeners.click(); }
    disable() { this._enabled = false; return this; }
    enable() { this._enabled = true; return this; }
    addClassName() { return this; }
    removeClassName() { return this; }
}

class MockTextField {
    constructor(opts) {
        this.options = opts || {};
        this._disabled = false;
        this.wrapperElement = document.createElement('input');
    }
    appendTo(parent) {
        if (parent && parent.wrapperElement) parent.wrapperElement.appendChild(this.wrapperElement);
        else if (parent && parent.appendChild) parent.appendChild(this.wrapperElement);
    }
    setDisabled(v) { this._disabled = v; }
}

class MockWindowMenu {
    constructor(title, className) {
        wrapperId++;
        this.title = title;
        this.className = className;
        this.windowContent = document.createElement('div');
        this.windowBottom = document.createElement('div');
        this._closeListener = null;
        this.closed = false;
        this._closeListener = () => { this.closed = true; };
    }
    appendChild(c) {
        if (c && c.wrapperElement) this.windowContent.appendChild(c.wrapperElement);
        else if (c && c.nodeType) this.windowContent.appendChild(c);
    }
}

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    createdButtons = [];
    lastMessage = null;

    const se = global.StyledElements;
    se.ButtonsGroup = MockButtonsGroup;
    se.Container = MockContainer;
    se.Button = MockButton;
    se.TextField = MockTextField;
    se.Utils.removeFromArray = (arr, item) => {
        const idx = arr.indexOf(item);
        if (idx >= 0) arr.splice(idx, 1);
    };
    se.Utils.interpolate = (str, vars) => str;
    se.Utils.gettext = (s) => s;
    se.Utils.clone = (o) => JSON.parse(JSON.stringify(o));
    se.GUIBuilder = class {
        constructor() {
            this.DEFAULT_OPENING = '<div>';
            this.DEFAULT_CLOSING = '</div>';
        }
        parse(template, context) {
            const wrapper = document.createElement('div');
            const row = document.createElement('div');
            wrapper.appendChild(row);
            if (context.radiobutton) {
                context.radiobutton();
                row.appendChild(document.createElement('span'));
            }
            if (context.image) row.appendChild(context.image());
            if (context.icon) row.appendChild(context.icon());
            if (context.permission) row.appendChild(context.permission());
            if (context.btndelete) {
                const button = context.btndelete();
                createdButtons.push(button);
                row.appendChild(button.wrapperElement);
            }
            const elements = [wrapper, row];
            return { elements, appendTo(p) { p.appendChild(wrapper); } };
        }
    };
    se.RadioButton = class {
        constructor(opts) {
            this.options = opts || {};
        }
    };
    se.StyledElement = MockContainer;

    global.Wirecloud = {
        Utils: se.Utils,
        constants: { LOGGING: { ERROR_MSG: 1 } },
        contextManager: { get: () => 'testuser' },
        currentTheme: {
            templates: {
                'wirecloud/workspace/sharing_user': '<div><span class="fullname"></span><span class="username"></span><span class="permission"></span><button class="delete"></button></div>',
                'wirecloud/workspace/visibility_option': '<div><input type="radio" /><span class="icon"></span><span class="title"></span><span class="desc"></span></div>',
            }
        },
        ui: {
            WindowMenu: MockWindowMenu,
            UserGroupTypeahead: class {
                constructor(opts) { this.opts = opts; this._listeners = {}; }
                bind(el) {}
                addEventListener(t, h) { this._listeners[t] = h; }
            },
            MessageWindowMenu: class {
                constructor(msg, level) { this.msg = msg; this.level = level; lastMessage = this; }
                show() {}
            },
        },
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/SharingWindowMenu.js',
    ]);
};

test.beforeEach(() => {
    wrapperId = 0;
    setup();
});

// --- groups forEach (lines 207-212) ---

test('SharingWindowMenu iterates workspace.model.groups', () => {
    const ws = {
        model: {
            users: [],
            groups: [{ accesslevel: 'read', name: 'admins' }],
            preferences: {
                get(k) {
                    if (k === 'public') return true;
                    if (k === 'requireauth') return false;
                    return undefined;
                }
            }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);
    assert.equal(menu.sharelist.length, 1);
    assert.equal(menu.sharelist[0].name, 'admins');
    assert.equal(menu.sharelist[0].type, 'group');
});

test('SharingWindowMenu with empty users and groups initializes cleanly', () => {
    const ws = {
        model: {
            users: [],
            groups: [],
            preferences: {
                get(k) {
                    if (k === 'public') return false;
                    return undefined;
                }
            }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);
    assert.equal(menu.sharelist.length, 0);
});

// --- visibilityOptions else branch (lines 228-229) ---

test('SharingWindowMenu public with requireauth=false sets visibility to public', () => {
    const ws = {
        model: {
            users: [],
            groups: [],
            preferences: {
                get(k) {
                    if (k === 'public') return true;
                    if (k === 'requireauth') return false;
                    return undefined;
                }
            }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);
    assert.equal(menu.visibilityOptions._value, 'public');
});

test('SharingWindowMenu public with requireauth=true sets visibility to public-auth', () => {
    const ws = {
        model: {
            users: [],
            groups: [],
            preferences: {
                get(k) {
                    if (k === 'public') return true;
                    if (k === 'requireauth') return true;
                    return undefined;
                }
            }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);
    assert.equal(menu.visibilityOptions._value, 'public-auth');
});

test('SharingWindowMenu private visibility sets private', () => {
    const ws = {
        model: {
            users: [],
            groups: [],
            preferences: {
                get(k) {
                    if (k === 'public') return false;
                    return undefined;
                }
            }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);
    assert.equal(menu.visibilityOptions._value, 'private');
});

test('SharingWindowMenu typeahead appends users once and delete removes non-owner entries', () => {
    const ws = {
        model: {
            users: [],
            groups: [],
            preferences: { get: () => false }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);
    const context = { type: 'user', username: 'alice', fullname: 'Alice' };

    menu.inputSearchTypeahead._listeners.select(null, { context });
    menu.inputSearchTypeahead._listeners.select(null, { context });

    assert.equal(menu.sharelist.length, 1);
    assert.equal(menu.users.alice, context);
    createdButtons.at(-1).click();
    assert.equal(menu.sharelist.length, 0);
    assert.equal(menu.users.alice, undefined);
});

test('SharingWindowMenu marks current user as owner and disables delete', () => {
    const ws = {
        model: {
            users: [],
            groups: [],
            preferences: { get: () => false }
        }
    };

    const menu = new Wirecloud.ui.SharingWindowMenu(ws);
    menu.inputSearchTypeahead._listeners.select(null, {
        context: { type: 'user', username: 'testuser', fullname: 'Current User' }
    });

    assert.equal(menu.sharelist[0].accesslevel, 'owner');
    assert.equal(createdButtons.at(-1)._enabled, false);
});

test('SharingWindowMenu visibility changes enable and disable private controls', () => {
    const ws = {
        model: {
            users: [],
            groups: [],
            preferences: { get: () => false }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);

    menu.visibilityOptions.setValue('public');
    menu.visibilityOptions.dispatchEvent('change');
    assert.equal(menu.inputSearch._disabled, true);
    assert.equal(menu.userGroup._disabled, true);

    menu.visibilityOptions.setValue('private');
    menu.visibilityOptions.dispatchEvent('change');
    assert.equal(menu.inputSearch._disabled, false);
    assert.equal(menu.userGroup._disabled, false);
});

test('SharingWindowMenu accept saves preferences and updates workspace users and groups', async () => {
    let savedData = null;
    const ws = {
        model: {
            users: [{ username: 'old', fullname: 'Old', organization: false, accesslevel: 'read' }],
            groups: [],
            preferences: {
                get: () => false,
                set(data) {
                    savedData = data;
                    return Promise.resolve();
                }
            }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);

    menu.inputSearchTypeahead._listeners.select(null, { context: { type: 'group', name: 'admins' } });
    menu.inputSearchTypeahead._listeners.select(null, { context: { type: 'organization', name: 'org' } });
    menu.btnAccept.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(savedData.public.value, false);
    assert.equal(savedData.requireauth.value, true);
    assert.equal(ws.model.groups.length, 1);
    assert.equal(ws.model.users.length, 2);
    assert.equal(menu.closed, true);
});

test('SharingWindowMenu accept failure re-enables buttons and shows error', async () => {
    const ws = {
        model: {
            users: [],
            groups: [],
            preferences: {
                get: () => true,
                set() { return Promise.reject('save failed'); }
            }
        }
    };
    const menu = new Wirecloud.ui.SharingWindowMenu(ws);

    menu.btnAccept.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(menu.btnAccept._enabled, true);
    assert.equal(menu.btnCancel._enabled, true);
    assert.equal(lastMessage.msg, 'save failed');
});
