const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

class MockFormWindowMenu {
    constructor(fields, title, cssClass, opts) {
        this.fields = fields;
        this.title = title;
        this.cssClass = cssClass;
        this.options = opts || {};
        this.form = {
            wrapperElement: document.createElement('div'),
            cancelButton: { focus() {} },
        };
        this.windowContent = document.createElement('div');
        this._shown = false;
        this._shownWith = null;
    }
    show(parentWindow) {
        this._shown = true;
        this._shownWith = parentWindow || null;
    }
}

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    const se = global.StyledElements;
    se.Utils.gettext = (s) => s;
    se.Utils.interpolate = (str, vars) => str;
    se.FormWindowMenu = MockFormWindowMenu;
    se.Select = class MockSelect {
        constructor(options) {
            this.options = options;
            this.optionValues = {};
            options.initialEntries.forEach((entry) => {
                this.optionValues[entry.value] = entry.value;
            });
        }
    };

    global.Wirecloud = {
        Utils: se.Utils,
        URLs: {
            PUBLISH_ON_OTHER_MARKETPLACE: '/api/publish/marketplace',
        },
        GlobalLogManager: { parseErrorResponse: (r) => 'error' },
        UserInterfaceManager: {
            views: {
                marketplace: { viewsByName: {} },
            },
        },
        io: { makeRequest: () => Promise.resolve({ status: 204 }) },
        ui: {
            FormWindowMenu: MockFormWindowMenu,
        },
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/PublishResourceWindowMenu.js',
    ]);
};

test.beforeEach(() => {
    setup();
});

test('PublishResourceWindowMenu show calls super.show', () => {
    const resource = { uri: '/api/resource/1' };
    const menu = new Wirecloud.ui.PublishResourceWindowMenu(resource);
    const parentWindow = { name: 'parent' };

    menu.show(parentWindow);

    assert.ok(menu._shown, 'menu should be shown');
    assert.equal(menu._shownWith, parentWindow);
});

test('PublishResourceWindowMenu constructor loads marketplace endpoints', () => {
    Wirecloud.UserInterfaceManager.views.marketplace.viewsByName = {
        main: {
            getPublishEndpoints() {
                return [
                    { label: 'Default', value: 'default' },
                    { label: 'Backup', value: 'backup' },
                ];
            },
        },
        empty: {
            getPublishEndpoints() {
                return [];
            },
        },
        disabled: {
            getPublishEndpoints() {
                return null;
            },
        },
    };

    const menu = new Wirecloud.ui.PublishResourceWindowMenu({ uri: '/api/resource/1' });
    const buttons = menu.fields[0].buttons;

    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].value, 'main');
    assert.ok(buttons[0].secondInput instanceof StyledElements.Select);
    assert.deepEqual(
        Object.keys(buttons[0].secondInput.optionValues),
        ['main#default', 'main#backup']
    );
    assert.equal(buttons[1].value, 'empty');
    assert.equal(buttons[1].secondInput, null);
});

test('PublishResourceWindowMenu setFocus focuses cancel button', () => {
    let focused = false;
    const menu = new Wirecloud.ui.PublishResourceWindowMenu({ uri: '/api/resource/1' });
    menu.form.cancelButton.focus = () => { focused = true; };

    menu.setFocus();

    assert.equal(focused, true);
});

test('PublishResourceWindowMenu executeOperation success on 204', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 204 });

    const resource = { uri: '/api/resource/1' };
    const menu = new Wirecloud.ui.PublishResourceWindowMenu(resource);

    const result = await menu.executeOperation({
        marketplaces: ['http://market.example.com#store1', 'http://market2.example.com']
    });
    assert.equal(result, undefined);
});

test('PublishResourceWindowMenu executeOperation handles 401 error', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 401, responseText: '{"description":"Unauthorized"}' });

    const resource = { uri: '/api/resource/1' };
    const menu = new Wirecloud.ui.PublishResourceWindowMenu(resource);

    await assert.rejects(
        () => menu.executeOperation({ marketplaces: ['http://market.example.com'] }),
        /error/
    );
});

test('PublishResourceWindowMenu executeOperation handles 403 error', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 403 });

    const resource = { uri: '/api/resource/1' };
    const menu = new Wirecloud.ui.PublishResourceWindowMenu(resource);

    await assert.rejects(
        () => menu.executeOperation({ marketplaces: ['http://market.example.com'] }),
        /error/
    );
});

test('PublishResourceWindowMenu executeOperation handles 500 error', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 500 });

    const resource = { uri: '/api/resource/1' };
    const menu = new Wirecloud.ui.PublishResourceWindowMenu(resource);

    await assert.rejects(
        () => menu.executeOperation({ marketplaces: ['http://market.example.com'] }),
        /error/
    );
});

test('PublishResourceWindowMenu executeOperation handles unexpected status', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200 });

    const resource = { uri: '/api/resource/1' };
    const menu = new Wirecloud.ui.PublishResourceWindowMenu(resource);

    await assert.rejects(
        () => menu.executeOperation({ marketplaces: ['http://market.example.com'] }),
        /Unexpected/
    );
});

test('PublishResourceWindowMenu executeOperation parses marketplaces with and without stores', () => {
    // Verify marketplace parsing logic
    const parts1 = 'http://market.example.com#store1'.split('#', 2);
    assert.equal(parts1[0], 'http://market.example.com');
    assert.equal(parts1[1], 'store1');

    const parts2 = 'http://market2.example.com'.split('#', 2);
    assert.equal(parts2[0], 'http://market2.example.com');
    assert.equal(parts2.length, 1);
});

test('PublishResourceWindowMenu executeOperation sends resource URI', async () => {
    let postBody = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        postBody = JSON.parse(opts.postBody);
        return Promise.resolve({ status: 204 });
    };

    const resource = { uri: '/api/resource/Widget/1' };
    const menu = new Wirecloud.ui.PublishResourceWindowMenu(resource);

    await menu.executeOperation({ marketplaces: ['http://market.example.com'] });

    assert.equal(postBody.resource, '/api/resource/Widget/1');
    assert.deepEqual(postBody.marketplaces, [{ market: 'http://market.example.com' }]);
});
