const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

class MockWindowMenu {
    constructor(title, cssClass) {
        this.title = title;
        this.cssClass = cssClass;
        this.windowBottom = document.createElement('div');
        this.windowContent = document.createElement('div');
        this.hidden = true;
        this.shownWith = null;
    }
    show(parentWindow) {
        this.hidden = false;
        this.shownWith = parentWindow || null;
    }
    hide() {
        this.hidden = true;
    }
}

class MockForm {
    constructor(fields, options) {
        this.fields = fields;
        this.options = options;
        this.acceptButton = { addClassName: (className) => { this.acceptClass = className; } };
        this.listeners = {};
        this.insertedInto = null;
    }
    insertInto(element) {
        this.insertedInto = element;
    }
    addEventListener(name, listener) {
        this.listeners[name] = listener;
    }
}

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    StyledElements.Form = MockForm;
    global.Wirecloud = {
        Utils: StyledElements.Utils,
        URLs: {
            WIRING_ENTRY: {
                evaluate(values) {
                    return `/api/workspace/${values.workspace_id}/wiring`;
                },
            },
        },
        io: {
            requests: [],
            makeRequest(url, options) {
                this.requests.push({ url, options });
            },
        },
        ui: {
            WindowMenu: MockWindowMenu,
        },
    };
    Wirecloud.Utils.gettext = (text) => text;

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/OperatorPreferencesWindowMenu.js',
    ]);
};

const buildOperator = (extra = {}) => ({
    id: 'op-1',
    volatile: false,
    wiring: { workspace: { id: 'ws-1' } },
    preferenceList: [
        {
            hidden: false,
            meta: { name: 'visible' },
            getInterfaceDescription() { return { type: 'text', label: 'Visible' }; },
        },
        {
            hidden: true,
            meta: { name: 'hidden' },
            getInterfaceDescription() { return { type: 'text', label: 'Hidden' }; },
        },
    ],
    preferences: {
        visible: { value: 'old', meta: { secure: false } },
        secret: { value: 'oldsecret', meta: { secure: true } },
        same: { value: 'same', meta: { secure: false } },
    },
    logManager: {
        formatException(error) { return `formatted: ${error.message}`; },
        log(message, details) {
            this.lastLog = { message, details };
        },
    },
    ...extra,
});

test.beforeEach(setup);

test('OperatorPreferencesWindowMenu show builds fields and wires form handlers', () => {
    const menu = new Wirecloud.ui.OperatorPreferencesWindowMenu();
    const operator = buildOperator();
    const parentWindow = { name: 'parent' };

    menu.show(operator, parentWindow);

    assert.equal(menu.title, 'Operator Settings');
    assert.equal(menu.shownWith, parentWindow);
    assert.deepEqual(Object.keys(menu.form.fields), ['visible']);
    assert.equal(menu.form.acceptClass, 'btn-accept');
    assert.equal(typeof menu.form.listeners.submit, 'function');
    assert.equal(typeof menu.form.listeners.cancel, 'function');
    assert.equal(menu.form.insertedInto, menu.windowContent);
});

test('OperatorPreferencesWindowMenu _savePrefs updates preferences and sends patch', () => {
    const menu = new Wirecloud.ui.OperatorPreferencesWindowMenu();
    const operator = buildOperator({
        prefCallback(values) {
            this.callbackValues = values;
        },
    });
    menu.show(operator);

    menu._savePrefs(null, { visible: 'new', secret: 'newsecret', same: 'same' });

    assert.equal(operator.preferences.visible.value, 'new');
    assert.equal(operator.preferences.secret.value, '********');
    assert.equal(operator.preferences.same.value, 'same');
    assert.equal(Wirecloud.io.requests.length, 1);
    assert.equal(Wirecloud.io.requests[0].url, '/api/workspace/ws-1/wiring');
    assert.deepEqual(JSON.parse(Wirecloud.io.requests[0].options.postBody), [
        { op: 'replace', path: '/operators/op-1/preferences/visible/value', value: 'new' },
        { op: 'replace', path: '/operators/op-1/preferences/secret/value', value: 'newsecret' },
    ]);
    assert.deepEqual(operator.callbackValues, { visible: 'new', secret: '********' });
    assert.equal(menu.hidden, true);
});

test('OperatorPreferencesWindowMenu _savePrefs skips request for volatile operators', () => {
    const menu = new Wirecloud.ui.OperatorPreferencesWindowMenu();
    const operator = buildOperator({ volatile: true });
    menu.show(operator);

    menu._savePrefs(null, { visible: 'new' });

    assert.equal(Wirecloud.io.requests.length, 0);
    assert.equal(operator.preferences.visible.value, 'new');
});

test('OperatorPreferencesWindowMenu logs callback exceptions', () => {
    const menu = new Wirecloud.ui.OperatorPreferencesWindowMenu();
    const operator = buildOperator({
        prefCallback() {
            throw new Error('callback failed');
        },
    });
    menu.show(operator);

    menu._savePrefs(null, { visible: 'new' });

    assert.equal(operator.logManager.lastLog.message, 'Exception catched while processing preference changes');
    assert.deepEqual(operator.logManager.lastLog.details, { details: 'formatted: callback failed' });
});
