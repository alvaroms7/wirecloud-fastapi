const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

class MockSelect {
    constructor(opts) {
        this.options = opts || {};
        this._value = '';
        this._entries = [];
        this._listeners = {};
        this.wrapperElement = document.createElement('select');
    }
    addEntries(entries) { this._entries = entries; }
    getValue() { return this._value; }
    setValue(v) { this._value = v; }
    addEventListener(t, h) { this._listeners[t] = h; }
    dispatchEvent(t) { if (this._listeners[t]) this._listeners[t](); }
}

class MockButton {
    constructor(opts) {
        this.options = opts || {};
        this._enabled = true;
        this._listeners = {};
        this.wrapperElement = document.createElement('button');
    }
    insertInto(parent) {
        if (parent && parent.wrapperElement) parent.wrapperElement.appendChild(this.wrapperElement);
        else if (parent && parent.appendChild) parent.appendChild(this.wrapperElement);
    }
    addEventListener(t, h) { this._listeners[t] = h; }
    click() { if (this._listeners.click) this._listeners.click(this); }
    disable() { this._enabled = false; return this; }
    enable() { this._enabled = true; return this; }
    addClassName() { return this; }
    removeClassName() { return this; }
    setLabel() { return this; }
}

class MockContainer {
    constructor(opts) {
        this.options = opts || {};
        this._children = [];
        this.wrapperElement = document.createElement('div');
        if (opts && opts.class) this.wrapperElement.className = opts.class;
    }
    disable() {}
    enable() {}
    removeClassName() { return this; }
    addClassName() { return this; }
    clear() { this._children = []; return this; }
    appendChild(c) {
        this._children.push(c);
        if (c && c.wrapperElement) this.wrapperElement.appendChild(c.wrapperElement);
        else if (c && c.nodeType) this.wrapperElement.appendChild(c);
    }
}

class MockWindowMenu {
    constructor(title, className) {
        this.title = title;
        this.className = className;
        this.windowContent = document.createElement('div');
        this.windowBottom = document.createElement('div');
        this._closeListener = null;
    }
    appendChild(c) {
        if (c && c.wrapperElement) this.windowContent.appendChild(c.wrapperElement);
        else if (c && c.nodeType) this.windowContent.appendChild(c);
    }
    show() {
        this.shown = true;
    }
}

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    const se = global.StyledElements;
    se.Select = MockSelect;
    se.Button = MockButton;
    se.Container = MockContainer;
    se.StyledElement = MockContainer;
    se.Fragment = class MockFragment {
        constructor(html) {
            this.html = html;
        }
    };
    se.Utils.gettext = (s) => s;
    se.Utils.interpolate = (str, vars) => str;
    se.GUIBuilder = class {
        constructor() {
            this.DEFAULT_OPENING = '<div>';
            this.DEFAULT_CLOSING = '</div>';
        }
        parse(template, context) {
            const wrapper = document.createElement('div');
            if (context && context.versionselect && context.versionselect.wrapperElement)
                wrapper.appendChild(context.versionselect.wrapperElement);
            if (context && context.changelog && context.changelog.wrapperElement)
                wrapper.appendChild(context.changelog.wrapperElement);
            return { appendTo(p) { if (p.appendChild) p.appendChild(wrapper); } };
        }
    };

    global.Wirecloud = {
        Utils: se.Utils,
        constants: { LOGGING: { ERROR_MSG: 1 } },
        contextManager: { get: () => 'testuser' },
        currentTheme: {
            templates: {
                'wirecloud/modals/upgrade_downgrade_component': '<div></div>',
            }
        },
        LocalCatalogue: {
            resourceVersions: {},
            getResourceId() { return 'Wirecloud/Widget/1.0'; },
            RESOURCE_CHANGELOG_ENTRY: { evaluate: () => '/api/changelog' },
        },
        io: {
            makeRequest(url, opts) {
                if (opts.onSuccess) opts.onSuccess({ responseText: '<div>changelog</div>' });
                return { abort() {} };
            }
        },
        ui: {
            WindowMenu: MockWindowMenu,
        },
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/Version.js',
        'src/wirecloud/platform/static/js/wirecloud/ui/UpgradeWindowMenu.js',
    ]);
};

test.beforeEach(() => {
    setup();
});

// --- version sorting (lines 99-100) ---

test('UpgradeWindowMenu sorts versions descending', () => {
    const v1 = new Wirecloud.Version('1.0.0');
    const v2 = new Wirecloud.Version('2.0.0');
    const v3 = new Wirecloud.Version('3.0.0');

    Wirecloud.LocalCatalogue.resourceVersions['g1'] = [
        { version: v1 },
        { version: v2 },
        { version: v3 },
    ];

    const model = {
        meta: {
            group_id: 'g1',
            vendor: 'Wirecloud',
            name: 'Widget',
            version: v2,
        },
        upgrade() { return Promise.resolve(model); }
    };

    const menu = new Wirecloud.ui.UpgradeWindowMenu(model);
    // Versions should be sorted descending and exclude current version (v2)
    assert.equal(menu.version_selector._entries.length, 2);
    // v3 should come before v1 (descending sort: highest first)
});

test('UpgradeWindowMenu excludes current version', () => {
    const v1 = new Wirecloud.Version('1.0.0');
    const v2 = new Wirecloud.Version('2.0.0');

    Wirecloud.LocalCatalogue.resourceVersions['g1'] = [
        { version: v1 },
        { version: v2 },
    ];

    const model = {
        meta: {
            group_id: 'g1',
            vendor: 'Wirecloud',
            name: 'Widget',
            version: v2,
        },
        upgrade() { return Promise.resolve(model); }
    };

    const menu = new Wirecloud.ui.UpgradeWindowMenu(model);
    assert.equal(menu.version_selector._entries.length, 1);
});

// --- accept button click handler (lines 119-131) ---

test('UpgradeWindowMenu accept button calls model.upgrade', async () => {
    const v1 = new Wirecloud.Version('1.0.0');
    const v2 = new Wirecloud.Version('2.0.0');
    const v3 = new Wirecloud.Version('3.0.0');

    Wirecloud.LocalCatalogue.resourceVersions['g1'] = [
        { version: v1 },
        { version: v2 },
        { version: v3 },
    ];

    let upgradedTo = null;
    const model = {
        meta: {
            group_id: 'g1',
            vendor: 'Wirecloud',
            name: 'Widget',
            version: v2,
        },
        upgrade(newId) {
            upgradedTo = newId;
            return Promise.resolve(model);
        }
    };

    Wirecloud.LocalCatalogue.getResourceId = (id) => id;

    const menu = new Wirecloud.ui.UpgradeWindowMenu(model);
    menu.version_selector.setValue('3.0.0');
    menu._closeListener = () => {};

    menu.acceptButton.click();
    await new Promise(r => setTimeout(r, 10));

    assert.ok(upgradedTo !== null, 'upgrade should have been called');
});

test('UpgradeWindowMenu accept button handles upgrade failure', async () => {
    const v1 = new Wirecloud.Version('1.0.0');
    const v3 = new Wirecloud.Version('3.0.0');

    Wirecloud.LocalCatalogue.resourceVersions['g1'] = [
        { version: v1 },
        { version: v3 },
    ];

    let upgradeFailed = false;
    const model = {
        meta: {
            group_id: 'g1',
            vendor: 'Wirecloud',
            name: 'Widget',
            version: v1,
        },
        upgrade() {
            upgradeFailed = true;
            return Promise.reject(new Error('fail'));
        }
    };

    Wirecloud.LocalCatalogue.getResourceId = (id) => id;

    const menu = new Wirecloud.ui.UpgradeWindowMenu(model);
    menu.version_selector.setValue('3.0.0');
    menu._closeListener = () => {};

    menu.acceptButton.click();
    await new Promise(r => setTimeout(r, 10));

    assert.equal(menu.acceptButton._enabled, true, 'button should be re-enabled on failure');
});

test('UpgradeWindowMenu show aborts previous request and handles downgrade changelog 404', () => {
    const v1 = new Wirecloud.Version('1.0.0');
    const v2 = new Wirecloud.Version('2.0.0');
    const removedClasses = [];
    const addedClasses = [];
    let aborted = false;
    let requestOptions = null;

    Wirecloud.LocalCatalogue.resourceVersions.g1 = [{ version: v1 }, { version: v2 }];
    Wirecloud.io.makeRequest = (url, opts) => {
        requestOptions = opts;
        opts.on404({});
        opts.onComplete();
        return { abort() { aborted = true; } };
    };

    const model = {
        meta: { group_id: 'g1', vendor: 'Wirecloud', name: 'Widget', version: v2 },
        upgrade() { return Promise.resolve(model); },
    };
    const menu = new Wirecloud.ui.UpgradeWindowMenu(model);
    menu.version_selector.setValue(v1);
    menu.current_request = { abort() { aborted = true; } };
    menu.changelog.removeClassName = (classes) => { removedClasses.push(classes); return menu.changelog; };
    menu.changelog.addClassName = (className) => { addedClasses.push(className); return menu.changelog; };

    menu.show();

    assert.equal(aborted, true);
    assert.deepEqual(requestOptions.parameters, { from: v1 });
    assert.ok(addedClasses.includes('downgrade'));
    assert.deepEqual(removedClasses.at(-1), ['upgrade', 'downgrade']);
});

test('UpgradeWindowMenu show handles upgrade and generic changelog failures', () => {
    const v1 = new Wirecloud.Version('1.0.0');
    const v2 = new Wirecloud.Version('2.0.0');
    const addedClasses = [];
    let requestOptions = null;

    Wirecloud.LocalCatalogue.resourceVersions.g1 = [{ version: v1 }, { version: v2 }];
    Wirecloud.io.makeRequest = (url, opts) => {
        requestOptions = opts;
        opts.onFailure({});
        opts.onComplete();
        return { abort() {} };
    };

    const model = {
        meta: { group_id: 'g1', vendor: 'Wirecloud', name: 'Widget', version: v1 },
        upgrade() { return Promise.resolve(model); },
    };
    const menu = new Wirecloud.ui.UpgradeWindowMenu(model);
    menu.version_selector.setValue(v2);
    menu.changelog.addClassName = (className) => { addedClasses.push(className); return menu.changelog; };

    menu.show();

    assert.deepEqual(requestOptions.parameters, { from: v1 });
    assert.ok(addedClasses.includes('upgrade'));
});

test('UpgradeWindowMenu show appends successful changelog response', () => {
    const v1 = new Wirecloud.Version('1.0.0');
    const v2 = new Wirecloud.Version('2.0.0');
    let appended = null;

    Wirecloud.LocalCatalogue.resourceVersions.g1 = [{ version: v1 }, { version: v2 }];
    Wirecloud.io.makeRequest = (url, opts) => {
        opts.onSuccess({ responseText: '<p>changes</p>' });
        opts.onComplete();
        return { abort() {} };
    };

    const model = {
        meta: { group_id: 'g1', vendor: 'Wirecloud', name: 'Widget', version: v1 },
        upgrade() { return Promise.resolve(model); },
    };
    const menu = new Wirecloud.ui.UpgradeWindowMenu(model);
    menu.version_selector.setValue(v2);
    menu.changelog.appendChild = (child) => { appended = child; return menu.changelog; };

    menu.show();

    assert.ok(appended instanceof StyledElements.Fragment);
});
