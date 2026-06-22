const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

function chainable(promise) {
    const origThen = Promise.prototype.then.bind(promise);
    promise.then = function (onF, onR) { return chainable(origThen(onF, onR)); };
    promise.catch = function (onR) { return chainable(Promise.prototype.catch.call(promise, onR)); };
    promise.toTask = function (n) { return this; };
    promise.renameTask = function () { return this; };
    return promise;
}

class MockFormWindowMenu {
    constructor(fields, title, cssClass) {
        this.fields = fields;
        this.title = title;
        this.cssClass = cssClass;
    }
}

class MockMessageWindowMenu {
    constructor(msg, level) { this.msg = msg; }
    show() {}
}

class MockMissingDepsWindowMenu {
    constructor(cb, details) { this._cb = cb; this.details = details; }
    show() {}
}

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    const se = global.StyledElements;
    se.Utils.gettext = (s) => s;
    se.Utils.interpolate = (str, vars) => str;
    se.Utils.merge = (a, b) => Object.assign({}, a, b);
    se.FormWindowMenu = MockFormWindowMenu;

    global.URLify = (s) => s.toLowerCase().replace(/\s/g, '-');

    global.Wirecloud = {
        Utils: se.Utils,
        constants: { LOGGING: { ERROR_MSG: 1 } },
        contextManager: { get: () => 'testuser' },
        UserInterfaceManager: { monitorTask() {} },
        createWorkspace() { return chainable(Promise.resolve({ id: 'ws1', owner: 'testuser', name: 'test' })); },
        changeActiveWorkspace() { return chainable(Promise.resolve({ id: 'ws1' })); },
        ui: {
            FormWindowMenu: MockFormWindowMenu,
            MessageWindowMenu: MockMessageWindowMenu,
            MissingDependenciesWindowMenu: MockMissingDepsWindowMenu,
        },
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/NewWorkspaceWindowMenu.js',
    ]);
};

test.beforeEach(() => {
    setup();
});

test('NewWorkspaceWindowMenu creates workspace with mashup and no title', () => {
    let capturedTask = null;
    Wirecloud.UserInterfaceManager.monitorTask = (task) => { capturedTask = task; };
    Wirecloud.createWorkspace = () => chainable(Promise.reject(new Error('test error')));

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu({ mashup: 'Wirecloud/Test/1.0' });
    menu.executeOperation({ mashup: 'Wirecloud/Test/1.0' });

    assert.ok(capturedTask != null);
});

test('NewWorkspaceWindowMenu executeOperation calls changeActiveWorkspace on success', async () => {
    let changeCalled = false;
    Wirecloud.changeActiveWorkspace = (ws) => { changeCalled = true; return chainable(Promise.resolve(ws)); };
    Wirecloud.createWorkspace = () => chainable(Promise.resolve({ id: 'ws1', owner: 'testuser', name: 'test' }));

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu({});
    menu.executeOperation({ title: 'Test Workspace' });

    await new Promise(r => setTimeout(r, 10));
    assert.ok(changeCalled, 'changeActiveWorkspace should be called on success');
});

test('NewWorkspaceWindowMenu shows MissingDependenciesWindowMenu when deps missing', async () => {
    Wirecloud.createWorkspace = () => chainable(Promise.reject({
        details: { missingDependencies: [{ id: 1, name: 'dep1' }] },
        description: 'Missing dependencies'
    }));

    let dialogCreated = false;
    const OrigMissing = Wirecloud.ui.MissingDependenciesWindowMenu;
    Wirecloud.ui.MissingDependenciesWindowMenu = class {
        constructor(cb, details) { dialogCreated = true; }
        show() {}
    };

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu({});
    menu.executeOperation({ title: 'Test Workspace' });

    await new Promise(r => setTimeout(r, 10));
    assert.ok(dialogCreated, 'MissingDependenciesWindowMenu should be created');

    Wirecloud.ui.MissingDependenciesWindowMenu = OrigMissing;
});

test('NewWorkspaceWindowMenu shows MessageWindowMenu on generic error', async () => {
    Wirecloud.createWorkspace = () => chainable(Promise.reject(new Error('Server error')));

    let dialogCreated = false;
    Wirecloud.ui.MessageWindowMenu = class {
        constructor(msg, level) { dialogCreated = true; }
        show() {}
    };

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu({});
    menu.executeOperation({ title: 'Test Workspace' });

    await new Promise(r => setTimeout(r, 10));
    assert.ok(dialogCreated, 'MessageWindowMenu should be created on generic error');
});

test('NewWorkspaceWindowMenu shows object error descriptions', async () => {
    Wirecloud.createWorkspace = () => chainable(Promise.reject({ description: 'Object server error' }));

    let errorDialogMessage = null;
    Wirecloud.ui.MessageWindowMenu = class {
        constructor(msg) { errorDialogMessage = msg; }
        show() {}
    };

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu({});
    menu.executeOperation({ title: 'Test Workspace' });

    await new Promise(r => setTimeout(r, 10));
    assert.equal(errorDialogMessage, 'Object server error');
});

test('NewWorkspaceWindowMenu handles object errors with null details', async () => {
    Wirecloud.createWorkspace = () => chainable(Promise.reject({ details: null, description: 'Null details error' }));

    let errorDialogMessage = null;
    Wirecloud.ui.MessageWindowMenu = class {
        constructor(msg) { errorDialogMessage = msg; }
        show() {}
    };

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu({});
    menu.executeOperation({ title: 'Test Workspace' });

    await new Promise(r => setTimeout(r, 10));
    assert.equal(errorDialogMessage, 'Null details error');
});

test('NewWorkspaceWindowMenu handles object errors with non-missing dependency details', async () => {
    Wirecloud.createWorkspace = () => chainable(Promise.reject({ details: {}, description: 'No missing deps error' }));

    let errorDialogMessage = null;
    Wirecloud.ui.MessageWindowMenu = class {
        constructor(msg) { errorDialogMessage = msg; }
        show() {}
    };

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu({});
    menu.executeOperation({ title: 'Test Workspace' });

    await new Promise(r => setTimeout(r, 10));
    assert.equal(errorDialogMessage, 'No missing deps error');
});

test('NewWorkspaceWindowMenu with workspace creates copy menu', () => {
    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu({ workspace: 'ws-other' });
    assert.equal(menu.title, 'Copy Workspace');
});

test('NewWorkspaceWindowMenu default constructor creates template field', () => {
    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu();

    assert.equal(menu.title, 'Create Workspace');
    assert.equal(menu.fields.title.initialValue, undefined);
    assert.equal(menu.fields.mashup.type, 'mac');
    assert.equal(menu.fields.mashup.scope, 'mashup');
});

test('NewWorkspaceWindowMenu executeOperation uses mashup title branch', () => {
    let capturedTask = null;
    Wirecloud.UserInterfaceManager.monitorTask = (task) => { capturedTask = task; };
    Wirecloud.createWorkspace = () => chainable(Promise.resolve({ id: 'ws1' }));

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu();
    menu.executeOperation({ title: 'From Template', mashup: 'Vendor/Mashup/1.0' });

    assert.ok(capturedTask != null);
});

test('NewWorkspaceWindowMenu retry callback monitors task and shows error dialog', async () => {
    let retryCallback = null;
    let monitored = 0;
    let errorDialogMessage = null;

    Wirecloud.UserInterfaceManager.monitorTask = () => { monitored += 1; };
    Wirecloud.createWorkspace = () => chainable(Promise.reject({
        details: { missingDependencies: [{ name: 'dep' }] },
        description: 'Missing dependencies',
    }));
    Wirecloud.ui.MissingDependenciesWindowMenu = class {
        constructor(cb) { retryCallback = cb; }
        show() {}
    };
    Wirecloud.ui.MessageWindowMenu = class {
        constructor(msg) { errorDialogMessage = msg; }
        show() {}
    };

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu();
    menu.executeOperation({ title: 'Retry Me' });
    await new Promise(r => setTimeout(r, 10));

    Wirecloud.createWorkspace = () => chainable(Promise.reject('retry failed'));
    retryCallback();
    await new Promise(r => setTimeout(r, 10));

    assert.equal(monitored, 2);
    assert.equal(errorDialogMessage, 'retry failed');
});

test('NewWorkspaceWindowMenu retry callback changes workspace on success', async () => {
    let retryCallback = null;
    let changedWorkspace = null;

    Wirecloud.createWorkspace = () => chainable(Promise.reject({
        details: { missingDependencies: [{ name: 'dep' }] },
        description: 'Missing dependencies',
    }));
    Wirecloud.changeActiveWorkspace = (workspace) => {
        changedWorkspace = workspace;
        return chainable(Promise.resolve(workspace));
    };
    Wirecloud.ui.MissingDependenciesWindowMenu = class {
        constructor(cb) { retryCallback = cb; }
        show() {}
    };

    const menu = new Wirecloud.ui.NewWorkspaceWindowMenu();
    menu.executeOperation({ title: 'Retry Success' });
    await new Promise(r => setTimeout(r, 10));

    Wirecloud.createWorkspace = () => chainable(Promise.resolve({ id: 'ws-retry' }));
    retryCallback();
    await new Promise(r => setTimeout(r, 10));

    assert.deepEqual(changedWorkspace, { id: 'ws-retry' });
});
