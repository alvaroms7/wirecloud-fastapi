const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = Wirecloud.ui || {};
    global.URLify = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // ES5 constructors needed because source uses .call(this) pattern
    StyledElements.DynamicMenuItems = function DynamicMenuItems() {};
    StyledElements.MenuItem = function MenuItem(label, fn, context) {
        this.label = label;
        this.fn = fn;
        this.context = context;
        this.iconClasses = [];
        this._disabled = false;
    };
    StyledElements.MenuItem.prototype.addIconClass = function (cls) {
        this.iconClasses.push(cls);
        return this;
    };
    StyledElements.MenuItem.prototype.setDisabled = function (d) {
        this._disabled = d;
        return this;
    };
    StyledElements.Separator = function Separator() {};

    Wirecloud.MarketManager = {
        getMarketTypes: function () { return [{ label: 'WireCloud', value: 'wirecloud' }]; },
        addMarket: function () { return { then: function (cb) { return { catch: function () {} }; } }; },
        deleteMarket: function () { return Promise.resolve(); },
    };
    Wirecloud.contextManager = {
        get: function (k) { return k === 'issuperuser' ? false : 'testuser'; },
    };
    Wirecloud.constants = { LOGGING: { ERROR_MSG: 1 } };
    Wirecloud.UserInterfaceManager = { monitorTask: (p) => p };
    Wirecloud.GlobalLogManager = { log: function () {} };

    Wirecloud.ui.FormWindowMenu = function FormWindowMenu(fields, title, extraClass) {
        this.fields = fields;
        this.title = title;
        this.extraClass = extraClass;
        this._executeOp = null;
        this._shown = false;
        Wirecloud.ui._lastFormWindowMenu = this;
    };
    Object.defineProperty(Wirecloud.ui.FormWindowMenu.prototype, 'executeOperation', {
        get: function () { return this._executeOp; },
        set: function (fn) { this._executeOp = fn; },
    });
    Wirecloud.ui.FormWindowMenu.prototype.show = function () { this._shown = true; };

    Wirecloud.ui.AlertWindowMenu = function AlertWindowMenu(msg) {
        this.msg = msg;
        this._handler = null;
        this.shown = false;
        Wirecloud.ui._lastAlertWindowMenu = this;
    };
    Wirecloud.ui.AlertWindowMenu.prototype.setHandler = function (fn) {
        this._handler = fn;
        return this;
    };
    Wirecloud.ui.AlertWindowMenu.prototype.show = function () {
        this.shown = true;
        return this;
    };
    Wirecloud.ui.MessageWindowMenu = function MessageWindowMenu(msg, level) {
        this.msg = msg;
        this.level = level;
        this.shown = false;
        Wirecloud.ui._lastMessageWindowMenu = this;
    };
    Wirecloud.ui.MessageWindowMenu.prototype.show = function () {
        this.shown = true;
        return this;
    };
});

var makeMockMarketplaceView = function (overrides) {
    overrides = overrides || {};
    return {
        alternatives: {
            getCurrentAlternative: function () {
                return {
                    getLabel: function () { return overrides.label || 'Test Market'; },
                    show_upload_view: overrides.hasUpload ? function () {} : undefined,
                    isAllow: overrides.allowDelete != null ? function () { return overrides.allowDelete; } : (function () { return false; }),
                    desc: overrides.desc || { user: 'test', name: 'test_market' },
                };
            },
        },
        number_of_alternatives: overrides.alternatives != null ? overrides.alternatives : 1,
        viewList: overrides.viewList || [],
        changeCurrentMarket: function () {},
        addMarket: function () {},
        refreshViewInfo: function () { return Promise.resolve(); },
    };
};

test('build returns menu items with market views (lines 47-62)', () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var mockView = makeMockMarketplaceView({
        viewList: [
            { getLabel: function () { return 'Market A'; }, market_id: 'u/a' },
            { getLabel: function () { return 'Market B'; }, market_id: 'u/b' },
        ],
        hasUpload: true,
        allowDelete: true,
    });

    var menu = new Wirecloud.ui.MarketplaceViewMenuItems(mockView);
    var items = menu.build();

    assert.ok(items.length > 0);
    var labels = items.filter(function (i) { return i.label; }).map(function (i) { return i.label; });
    assert.ok(labels.includes('Market A'));
    assert.ok(labels.includes('Market B'));
    assert.ok(labels.includes('Upload'));
    assert.ok(labels.includes('Add new marketplace'));
    assert.ok(labels.includes('Delete marketplace'));
});

test('build excludes upload when no show_upload_view (line 57)', () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var mockView = makeMockMarketplaceView({
        viewList: [
            { getLabel: function () { return 'Market C'; }, market_id: 'u/c' },
        ],
        hasUpload: false,
    });

    var menu = new Wirecloud.ui.MarketplaceViewMenuItems(mockView);
    var items = menu.build();
    var labels = items.filter(function (i) { return i.label; }).map(function (i) { return i.label; });
    assert.ok(!labels.includes('Upload'));
});

test('build skips market list and upload when no alternatives (line 45)', () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var mockView = makeMockMarketplaceView({
        alternatives: 0,
        viewList: [],
    });

    var menu = new Wirecloud.ui.MarketplaceViewMenuItems(mockView);
    var items = menu.build();
    var labels = items.filter(function (i) { return i.label; }).map(function (i) { return i.label; });
    assert.ok(labels.includes('Add new marketplace'));
    assert.ok(labels.includes('Delete marketplace'));
});

test('build add new marketplace click opens FormWindowMenu (lines 65-107)', () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var mockView = makeMockMarketplaceView({ viewList: [] });
    var menu = new Wirecloud.ui.MarketplaceViewMenuItems(mockView);
    var items = menu.build();

    var addItem = items.find(function (i) { return i.label === 'Add new marketplace'; });
    assert.ok(addItem);
    assert.ok(addItem.iconClasses.includes('fa fa-plus'));

    // Invoke the click handler
    addItem.fn();
});

test('build delete marketplace disabled when no delete permission (line 129)', () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var mockView = makeMockMarketplaceView({
        viewList: [],
        allowDelete: false,
    });

    var menu = new Wirecloud.ui.MarketplaceViewMenuItems(mockView);
    var items = menu.build();
    var delItem = items.find(function (i) { return i.label === 'Delete marketplace'; });
    assert.ok(delItem._disabled);
    assert.ok(delItem.iconClasses.includes('fa fa-trash'));
});

test('build delete marketplace click shows AlertWindowMenu (lines 112-130)', () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var mockView = makeMockMarketplaceView({
        viewList: [],
        allowDelete: true,
    });

    var menu = new Wirecloud.ui.MarketplaceViewMenuItems(mockView);
    var items = menu.build();
    var delItem = items.find(function (i) { return i.label === 'Delete marketplace'; });

    // Invoke the delete handler
    delItem.fn();
});

test('build add marketplace includes public field for superusers (line 87-92)', () => {
    Wirecloud.contextManager.get = function (k) { return k === 'issuperuser' ? true : 'testuser'; };
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var mockView = makeMockMarketplaceView({ viewList: [] });
    var menu = new Wirecloud.ui.MarketplaceViewMenuItems(mockView);
    var items = menu.build();
    var addItem = items.find(function (i) { return i.label === 'Add new marketplace'; });
    addItem.fn();
});

test('market and upload menu callbacks execute against current views', () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var changedTo = null;
    var uploadCalled = false;
    var mockView = makeMockMarketplaceView({
        viewList: [{ getLabel: function () { return 'Market A'; }, market_id: 'market-a' }],
        hasUpload: true,
        allowDelete: true,
    });
    mockView.changeCurrentMarket = function (marketId) { changedTo = marketId; };
    mockView.alternatives.getCurrentAlternative = function () {
        return {
            getLabel: function () { return 'Current'; },
            show_upload_view: function () { uploadCalled = true; },
            isAllow: function () { return true; },
            desc: { name: 'current' },
        };
    };

    var items = new Wirecloud.ui.MarketplaceViewMenuItems(mockView).build();
    items.find(function (i) { return i.label === 'Market A'; }).fn(null, 'market-a');
    items.find(function (i) { return i.label === 'Upload'; }).fn();

    assert.equal(changedTo, 'market-a');
    assert.equal(uploadCalled, true);
});

test('add marketplace executeOperation normalizes data and adds market to view', async () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var addedData = null;
    var viewAddedData = null;
    Wirecloud.MarketManager.addMarket = function (data) {
        addedData = data;
        return Promise.resolve(data);
    };

    var mockView = makeMockMarketplaceView({ viewList: [] });
    mockView.addMarket = function (data) { viewAddedData = data; };
    var items = new Wirecloud.ui.MarketplaceViewMenuItems(mockView).build();
    items.find(function (i) { return i.label === 'Add new marketplace'; }).fn();

    var result = await Wirecloud.ui._lastFormWindowMenu.executeOperation({
        title: 'My Market',
        url: 'https://market.example',
        type: 'wirecloud'
    });

    assert.equal(result.title, 'My Market');
    assert.equal(addedData.name, 'my_market');
    assert.equal(addedData.user, 'testuser');
    assert.equal(viewAddedData, addedData);
});

test('delete marketplace handler refreshes on success and reports failures', async () => {
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MarketplaceViewMenuItems.js');

    var refreshed = false;
    var monitored = false;
    Wirecloud.UserInterfaceManager.monitorTask = function (task) {
        monitored = true;
        return task;
    };
    Wirecloud.MarketManager.deleteMarket = function () { return Promise.resolve(); };

    var mockView = makeMockMarketplaceView({ viewList: [], allowDelete: true });
    mockView.refreshViewInfo = function () { refreshed = true; };
    var items = new Wirecloud.ui.MarketplaceViewMenuItems(mockView).build();
    items.find(function (i) { return i.label === 'Delete marketplace'; }).fn();
    Wirecloud.ui._lastAlertWindowMenu._handler();
    await Promise.resolve();

    assert.equal(monitored, true);
    assert.equal(refreshed, true);

    var logged = null;
    Wirecloud.GlobalLogManager.log = function (error) { logged = error; };
    Wirecloud.MarketManager.deleteMarket = function () { return Promise.reject('delete failed'); };
    items.find(function (i) { return i.label === 'Delete marketplace'; }).fn();
    Wirecloud.ui._lastAlertWindowMenu._handler();
    await new Promise(function (resolve) { setTimeout(resolve, 0); });

    assert.equal(Wirecloud.ui._lastMessageWindowMenu.msg, 'delete failed');
    assert.equal(Wirecloud.ui._lastMessageWindowMenu.shown, true);
    assert.equal(logged, 'delete failed');
});
