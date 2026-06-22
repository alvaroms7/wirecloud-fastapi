const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

class MockButton {
    constructor(opts) {
        this._enabled = true;
        this._classNames = new Set(['btn-accept']);
    }
    addClassName(n) { this._classNames.add(n); }
    removeClassName(n) { this._classNames.delete(n); }
    enable() { this._enabled = true; }
    disable() { this._enabled = false; }
    get busy() { return this._classNames.has('busy'); }
}

let lastMessageShown = null;

class MockMessageWindowMenu {
    constructor(msg, level) { lastMessageShown = { msg, level }; }
    show() {}
}

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    const se = global.StyledElements;
    se.Utils.gettext = (s) => s;
    se.Utils.interpolate = (str, vars) => str;
    se.Utils.merge = Object.assign;
    se.FormWindowMenu = class {
        constructor(fields, title, cssClass, opts) {
            this.fields = fields;
            this.title = title;
            this.cssClass = cssClass;
            this.options = opts || {};
            this.form = {
                wrapperElement: document.createElement('div'),
                acceptButton: new MockButton(),
                cancelButton: new MockButton(),
                fieldInterfaces: { title: { focus() {} } },
            };
            this.windowContent = document.createElement('div');
        }
        hide() { this._hidden = true; }
    };

    global.URLify = (s) => s.toLowerCase().replace(/\s/g, '-');

    global.Wirecloud = {
        Utils: se.Utils,
        constants: { LOGGING: { ERROR_MSG: 1 } },
        contextManager: {
            get(k) {
                if (k === 'fullname') return 'Test User';
                if (k === 'username') return 'testuser';
                return '';
            }
        },
        ui: {
            FormWindowMenu: se.FormWindowMenu,
            MessageWindowMenu: MockMessageWindowMenu,
        },
    };

    lastMessageShown = null;
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/PublishWorkspaceWindowMenu.js',
    ]);
};

test.beforeEach(() => {
    lastMessageShown = null;
    setup();
});

test('PublishWorkspaceWindowMenu constructor creates form with fields', () => {
    const ws = { title: 'My Dash', tabs: [] };
    const menu = new Wirecloud.ui.PublishWorkspaceWindowMenu(ws);
    assert.ok(menu.form.acceptButton);
    assert.ok(menu.form.cancelButton);
});

test('PublishWorkspaceWindowMenu constructor falls back to username and focuses title', () => {
    Wirecloud.contextManager.get = (key) => key === 'fullname' ? '   ' : 'testuser';
    let focused = false;

    const menu = new Wirecloud.ui.PublishWorkspaceWindowMenu({ title: 'My Dash', tabs: [] });
    menu.form.fieldInterfaces.title.focus = () => { focused = true; };
    menu.setFocus();

    assert.equal(menu.fields[0].fields[1].initialValue, 'testuser');
    assert.equal(focused, true);
});

test('PublishWorkspaceWindowMenu parses parametrizable workspace tabs', () => {
    const ws = {
        title: 'MyDash',
        tabs: [
            {
                title: 'Main',
                widgets: [
                    {
                        id: 'w1',
                        title: 'Widget 1',
                        preferenceList: [
                            { label: 'Preference', vardef: { order: 2 } },
                        ],
                        propertyList: [
                            { label: 'Property A', vardef: { order: 5 } },
                            { label: 'Property B', vardef: { order: 1 } },
                        ],
                    },
                ],
            },
            { title: 'Empty', widgets: [{ id: 'w2', title: 'Widget 2', preferenceList: [], propertyList: [] }] },
        ],
    };
    const fields = [];
    const menu = new Wirecloud.ui.PublishWorkspaceWindowMenu(ws);

    menu._addVariableParametrization(ws, fields);

    assert.equal(fields.length, 1);
    assert.equal(fields[0].name, 'tab-Main');
    assert.equal(fields[0].fields[0].name, 'w1');
    assert.equal(fields[0].fields[0].fields.pref.fields[0].variable.label, 'Preference');
    assert.deepEqual(
        fields[0].fields[0].fields.props.fields.map((field) => field.variable.vardef.order),
        [1, 5]
    );
    assert.equal(menu._parseTab(ws.tabs[1]), null);
});

test('PublishWorkspaceWindowMenu executeOperation merges tab data into parametrization', () => {
    let publishData = null;
    const ws = {
        title: 'MyDash',
        tabs: [],
        publish(data) {
            publishData = data;
            return Promise.resolve();
        }
    };

    const menu = new Wirecloud.ui.PublishWorkspaceWindowMenu(ws);
    const execData = {
        title: 'MyDash',
        'tab-MyTab': { widget1: { pref1: { value: 'param' } } },
    };
    menu.executeOperation(execData);

    assert.ok(publishData.parametrization.iwidgets.widget1);
    assert.equal(publishData.parametrization.iwidgets.widget1.pref1.value, 'param');
    assert.ok(!('tab-MyTab' in publishData));
});

test('PublishWorkspaceWindowMenu executeOperation merges multiple tab data', () => {
    let publishData = null;
    const ws = {
        title: 'MyDash',
        tabs: [],
        publish(data) {
            publishData = data;
            return Promise.resolve();
        }
    };

    const menu = new Wirecloud.ui.PublishWorkspaceWindowMenu(ws);
    const execData = {
        title: 'MyDash',
        'tab-Tab1': { widgetA: { pref1: { value: 'a' } } },
        'tab-Tab2': { widgetB: { pref2: { value: 'b' } } },
    };
    menu.executeOperation(execData);

    assert.equal(publishData.parametrization.iwidgets.widgetA.pref1.value, 'a');
    assert.equal(publishData.parametrization.iwidgets.widgetB.pref2.value, 'b');
});

test('PublishWorkspaceWindowMenu executeOperation handles failure', async () => {
    const ws = {
        title: 'MyDash',
        tabs: [],
        publish() {
            return Promise.reject('Publish failed');
        }
    };

    const menu = new Wirecloud.ui.PublishWorkspaceWindowMenu(ws);
    menu.executeOperation({ title: 'MyDash' });

    await new Promise(r => setTimeout(r, 10));
    assert.ok(lastMessageShown !== null, 'MessageWindowMenu should be shown on failure');
    assert.equal(lastMessageShown.msg, 'Publish failed');
    assert.equal(menu.form.acceptButton._enabled, true, 'accept button should be re-enabled');
    assert.ok(!menu.form.acceptButton.busy, 'accept button should not be busy');
});

test('PublishWorkspaceWindowMenu executeOperation success hides menu', async () => {
    const ws = {
        title: 'MyDash',
        tabs: [],
        publish() {
            return Promise.resolve();
        }
    };

    const menu = new Wirecloud.ui.PublishWorkspaceWindowMenu(ws);
    menu._hidden = false;
    menu.executeOperation({ title: 'MyDash' });

    await new Promise(r => setTimeout(r, 10));
    assert.ok(menu._hidden, 'menu should be hidden on success');
});
