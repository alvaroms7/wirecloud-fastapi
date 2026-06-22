const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const buttons = [];
const containers = [];

class MockContainer {
    constructor(options = {}) {
        this.options = options;
        this.children = [];
        this.wrapperElement = document.createElement(options.tagname || 'div');
        if (options.class) {
            this.wrapperElement.className = options.class;
        }
        containers.push(this);
    }
    appendChild(child) {
        this.children.push(child);
        if (child && child.wrapperElement) {
            this.wrapperElement.appendChild(child.wrapperElement);
        } else {
            this.wrapperElement.appendChild(document.createTextNode(String(child)));
        }
        return this;
    }
    clear() {
        this.children = [];
        this.wrapperElement.textContent = '';
        return this;
    }
    insertInto(parent) {
        if (parent && parent.appendChild) {
            parent.appendChild(this.wrapperElement);
        }
        return this;
    }
}

class MockPanel {
    constructor(options = {}) {
        this.options = options;
        this.body = new MockContainer({ class: 'panel-body' });
        this.wrapperElement = document.createElement('section');
    }
    insertInto(parent) {
        if (parent && parent.appendChild) {
            parent.appendChild(this.wrapperElement);
        }
        return this;
    }
}

class MockButton {
    constructor(options = {}) {
        this.options = options;
        this.listeners = {};
        this.wrapperElement = document.createElement('button');
        buttons.push(this);
    }
    addEventListener(name, handler) {
        this.listeners[name] = handler;
    }
    click() {
        return this.listeners.click();
    }
}

class MockWindowMenu {
    constructor(title, className) {
        this.title = title;
        this.className = className;
        this.windowContent = document.createElement('div');
    }
}

const setup = ({ requestMode = 'success', context = {}, workspaces = { alice: { a: {}, b: {} }, bob: { c: {} } } } = {}) => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    buttons.length = 0;
    containers.length = 0;

    StyledElements.Container = MockContainer;
    StyledElements.Panel = MockPanel;
    StyledElements.Button = MockButton;
    StyledElements.Utils.gettext = (text) => text;

    let userManagementShown = false;
    global.Wirecloud = {
        Utils: StyledElements.Utils,
        contextManager: {
            get(name) {
                return context[name];
            },
        },
        URLs: {
            SEARCH_SERVICE: '/api/search',
        },
        io: {
            makeRequest(url, options) {
                if (requestMode === 'invalid-json' && options.parameters.namespace === 'user') {
                    options.onSuccess({ responseText: '{bad json' });
                } else if (requestMode === 'failure' && options.parameters.namespace === 'group') {
                    options.onFailure({});
                } else {
                    const response = options.parameters.namespace === 'user'
                        ? { total: 7, results: [] }
                        : requestMode === 'empty-group-results' ? { total: 3 } : { results: [
                            { is_organization: false },
                            { is_organization: true, is_root: true },
                            { is_organization: true, is_root: false },
                        ] };
                    options.onSuccess({ responseText: JSON.stringify(response) });
                }
            },
        },
        workspacesByUserAndName: workspaces,
        ui: {
            WindowMenu: MockWindowMenu,
            UserManagementWindowMenu: class {
                show() {
                    userManagementShown = true;
                }
            },
        },
    };
    Object.defineProperty(Wirecloud, '_userManagementShown', {
        get() {
            return userManagementShown;
        },
    });

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/AdminPanelWindowMenu.js',
    ]);
};

test('AdminPanelWindowMenu renders info, statistics and user management action', async () => {
    setup({
        context: { username: 'admin', issuperuser: true, isstaff: false },
    });

    const menu = new Wirecloud.ui.AdminPanelWindowMenu();
    buttons[0].click();
    await Promise.resolve();

    assert.equal(menu.title, 'Administration Panel');
    assert.equal(Wirecloud._userManagementShown, true);
    assert.ok(containers.some((container) => container.wrapperElement.textContent === '7'));
    assert.ok(containers.some((container) => container.wrapperElement.textContent === '1'));
    assert.ok(containers.some((container) => container.wrapperElement.textContent === '3'));
});

test('AdminPanelWindowMenu statistics fall back to zero on parse and request failures', async () => {
    setup({
        requestMode: 'invalid-json',
        context: { username: '', issuperuser: false, isstaff: true },
        workspaces: null,
    });

    new Wirecloud.ui.AdminPanelWindowMenu();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(containers.some((container) => container.wrapperElement.textContent === '0'));

    setup({ requestMode: 'failure' });
    new Wirecloud.ui.AdminPanelWindowMenu();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const zeroValues = containers.filter((container) => container.wrapperElement.textContent === '0');
    assert.ok(zeroValues.length >= 2);
});

test('AdminPanelWindowMenu treats group search responses without results as empty', async () => {
    setup({
        requestMode: 'empty-group-results',
        workspaces: { alice: {} },
    });

    new Wirecloud.ui.AdminPanelWindowMenu();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const zeroValues = containers.filter((container) => container.wrapperElement.textContent === '0');
    assert.ok(zeroValues.length >= 2);
});
