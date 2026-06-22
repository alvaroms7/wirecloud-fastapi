const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const API_DIR = 'src/wirecloud/platform/static/js/WirecloudAPI';

const createMockParent = () => {
    const mockWirecloud = {
        Utils: {
            interpolate: (s, d) => s,
            gettext: (s) => s,
            merge: (a, b) => Object.assign({}, a, b),
        },
        io: {
            buildProxyURL: (url) => url,
            makeRequest: (url, opts) => Promise.resolve(),
        },
        wiring: {
            EndpointDoesNotExistError: class extends Error {},
            EndpointTypeError: class extends Error {},
            EndpointValueError: class extends Error {},
            WidgetTargetEndpoint: class { constructor(resource) { this.component = {}; } },
            WidgetSourceEndpoint: class { constructor(resource) { this.component = {}; } },
            OperatorTargetEndpoint: class { constructor(resource) { this.component = {}; } },
            OperatorSourceEndpoint: class { constructor(resource) { this.component = {}; } },
        },
        Widget: class Widget {},
        UserInterfaceManager: { workspaceviews: {} },
        activeWorkspace: { view: null },
        contextManager: {
            getAvailableContext: () => [],
            get: (n) => null,
        },
        PreferenceDoesNotExistError: class extends Error {},
        LocalCatalogue: {
            addComponent: (opts) => Promise.resolve(),
            getResource: (v, n, ver) => null,
            getResourceId: (ref) => null,
            resourceVersions: {},
            resourceExistsId: (id) => false,
            deleteResource: (comp, opts) => Promise.resolve(),
        },
        changeActiveWorkspace: (ws, opts) => Promise.resolve(),
        removeWorkspace: (ws) => Promise.resolve(),
        createWorkspace: (opts) => Promise.resolve(),
        ui: {
            AlertWindowMenu: class {
                constructor(msg) { this.msg = msg; }
                setHandler(fn) { this._handler = fn; return this; }
                show() {}
            },
        },
        APIRequirements: {},
        APIComponents: {},
    };

    const mockStyledElements = {};
    const seComponents = [
        'Accordion', 'Addon', 'Alternatives', 'BorderLayout', 'ButtonsGroup',
        'CheckBox', 'CodeArea', 'Container', 'DynamicMenuItems', 'Event',
        'Fragment', 'Form', 'GUIBuilder', 'HorizontalLayout', 'InputElement',
        'List', 'MenuItem', 'NumericField', 'ObjectWithEvents',
        'PaginatedSource', 'PaginationInterface', 'PasswordField', 'RadioButton',
        'Select', 'Separator', 'StaticPaginatedSource', 'StyledElement',
        'TextArea', 'TextField', 'VerticalLayout', 'PopupMenu', 'Popover',
        'Tooltip', 'ModelTable', 'Button', 'FileButton', 'ToggleButton',
        'PopupButton', 'Notebook',
    ];
    seComponents.forEach((name) => {
        mockStyledElements[name] = class {};
    });

    mockStyledElements.DynamicMenuItems = function () {};
    mockStyledElements.GUIBuilder = class {
        constructor() { this.DEFAULT_OPENING = ''; this.DEFAULT_CLOSING = ''; }
        parse(s, d) { return ''; }
    };
    mockStyledElements.Notebook = class {};
    mockStyledElements.Notebook.prototype.Tab = class {};
    mockStyledElements.PopupMenu = class {
        constructor(opts) { this.events = {}; this.append = () => this; this.repaint = () => this; this.show = () => this; this.hide = () => this; this.isVisible = () => false; this.moveFocusDown = () => this; this.moveFocusUp = () => this; this.hasEnabledItem = () => false; this.destroy = () => this; }
    };
    mockStyledElements.Popover = class {
        constructor(opts) { this.events = {}; this.visible = false; this.repaint = () => this; this.show = () => this; this.hide = () => this; this.toggle = () => {}; this.update = () => this; this.disablePointerEvents = () => this; this.enablePointerEvents = () => this; }
    };
    mockStyledElements.Tooltip = class {
        constructor(opts) { this.options = opts || {}; this.events = {}; this.repaint = () => this; this.show = () => this; this.hide = () => this; this.bind = () => this; }
    };
    mockStyledElements.StyledElement = class {
        constructor() { this.events = {}; }
        destroy() {}
    };

    return {
        Wirecloud: mockWirecloud,
        StyledElements: mockStyledElements,
        URL: class URL { constructor(url, base) { this.href = url; } },
        gettext: (s) => s,
        ngettext: (s, p, n) => n === 1 ? s : p,
        interpolate: (s, d, b) => s,
        document: {
            body: { scrollLeft: 0, scrollTop: 0 },
        },
    };
};

const createMockWorkspaceView = () => {
    const widgetModel = {
        id: 'test-component',
        meta: { preferences: {}, base_url: '' },
        preferences: {},
        properties: {},
        inputs: {},
        outputs: {},
        contextManager: {
            getAvailableContext: () => [],
            get: (n) => null,
        },
        logManager: { log: () => {} },
        volatile: true,
        remove: () => {},
        setPreferences: () => {},
        registerContextAPICallback: () => {},
        registerPrefCallback: () => {},
        tab: {
            workspace: {
                wiring: {},
                drawAttention: () => {},
                createWidget: (def, opts) => ({
                    model: widgetModel,
                }),
            },
        },
        wiring: {
            workspace: { wiring: {} },
        },
        wrapperElement: {
            getBoundingClientRect: () => ({
                left: 0, top: 0, width: 100, height: 100,
            }),
        },
        addEventListener: () => {},
    };

    const mockView = {
        model: {
            wiring: {
                createConnection: (out, inp, opts) => ({
                    remove: () => {},
                }),
            },
            contextManager: {
                getAvailableContext: () => [],
                get: (n) => null,
            },
            findOperator: (id) => ({
                id: id,
                logManager: { log: () => {} },
                meta: { preferences: {} },
                preferences: {},
                properties: {},
                inputs: {},
                outputs: {},
                wiring: { workspace: { wiring: {} } },
                addEventListener: () => {},
                destroy: () => {},
                setPreferences: () => {},
                registerContextAPICallback: () => {},
                registerPrefCallback: () => {},
                tab: { workspace: { wiring: {}, drawAttention: () => {} } },
                wrapperElement: {
                    getBoundingClientRect: () => ({
                        left: 0, top: 0, width: 100, height: 100,
                    }),
                },
                volatile: true,
                remove: () => {},
            }),
        },
        findWidget: (id) => ({
            model: widgetModel,
            tab: { workspace: { drawAttention: () => {} } },
        }),
    };
    return mockView;
};

test.beforeEach(() => {
    resetLegacyRuntime();

    global.DOMRect = class DOMRect {
        constructor(x, y, w, h) {
            this.left = x;
            this.top = y;
            this.width = w;
            this.height = h;
            this.right = x + w;
            this.bottom = y + h;
        }
    };

    global.location = {
        href: 'http://test.com/widget#id=test-component&workspaceview=default',
        hash: '#id=test-component&workspaceview=default',
    };

    document.location = global.location;

    window.addEventListener = () => {};
    window.removeEventListener = () => {};
});

test('WirecloudAPIClosure.js loads and registers _APIClosure', () => {
    const mockParent = createMockParent();
    window.parent = mockParent;
    window._privs = {};
    window.MashupPlatform = { priv: {}, mashup: {}, widget: {} };

    loadLegacyScript(`${API_DIR}/WirecloudAPIClosure.js`);

    assert.ok(window._privs == null || typeof window._privs !== 'object',
        '_privs should be deleted after Closure iframe branch fires');
});

test('WirecloudAPIBootstrap.js loads and registers _APIBootstrap', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    window._privs = {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);

    assert.ok(window._privs._APIBootstrap, '_privs._APIBootstrap should be defined');
    assert.equal(typeof window._privs._APIBootstrap, 'function');
});

test('WirecloudWidgetAPI.js loads and registers _WidgetAPI', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    window._privs = {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    loadLegacyScript(`${API_DIR}/WirecloudWidgetAPI.js`);

    assert.ok(window._privs._WidgetAPI, '_privs._WidgetAPI should be defined');
    assert.equal(typeof window._privs._WidgetAPI, 'function');
    assert.ok(window._privs._APIBootstrap, '_privs._APIBootstrap should still exist');
});

test('WirecloudOperatorAPI.js loads and registers _OperatorAPI', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    window._privs = {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    loadLegacyScript(`${API_DIR}/WirecloudOperatorAPI.js`);

    assert.ok(window._privs._OperatorAPI, '_privs._OperatorAPI should be defined');
    assert.equal(typeof window._privs._OperatorAPI, 'function');
});

test('WirecloudAPICommon.js loads and registers _APICommon', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    window._privs = {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    loadLegacyScript(`${API_DIR}/WirecloudAPICommon.js`);

    assert.ok(window._privs._APICommon, '_privs._APICommon should be defined');
    assert.equal(typeof window._privs._APICommon, 'function');
});

test('WirecloudAPIV2Bootstrap.js loads and sets up createAPIComponent', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    global.Wirecloud = mockParent.Wirecloud;
    window._privs = {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    loadLegacyScript(`${API_DIR}/WirecloudWidgetAPI.js`);
    loadLegacyScript(`${API_DIR}/WirecloudOperatorAPI.js`);
    loadLegacyScript(`${API_DIR}/WirecloudAPICommon.js`);
    loadLegacyScript(`${API_DIR}/WirecloudAPIV2Bootstrap.js`);

    assert.ok(Wirecloud.createAPIComponent, 'Wirecloud.createAPIComponent should be defined');
    assert.equal(typeof Wirecloud.createAPIComponent, 'function');
    assert.ok(Wirecloud.registerWidgetClass, 'Wirecloud.registerWidgetClass should be defined');
    assert.ok(Wirecloud.registerOperatorClass, 'Wirecloud.registerOperatorClass should be defined');
    assert.ok(Wirecloud.APIRequirements, 'Wirecloud.APIRequirements should be defined');
    assert.ok(Wirecloud.APIComponents, 'Wirecloud.APIComponents should be defined');
    assert.ok(Wirecloud.APIRequirements.hasOwnProperty('StyledElements'),
        'Wirecloud.APIRequirements.StyledElements should exist');
    assert.ok(Wirecloud.APIRequirements.hasOwnProperty('ComponentManagement'),
        'Wirecloud.APIRequirements.ComponentManagement should exist');
    assert.ok(Wirecloud.APIRequirements.hasOwnProperty('DashboardManagement'),
        'Wirecloud.APIRequirements.DashboardManagement should exist');
});

test('StyledElements.js loads and registers _StyledElements', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    window._privs = {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    loadLegacyScript(`${API_DIR}/WirecloudWidgetAPI.js`);
    loadLegacyScript(`${API_DIR}/StyledElements.js`);

    assert.ok(window._privs._StyledElements, '_privs._StyledElements should be defined');
    assert.equal(typeof window._privs._StyledElements, 'function');
});

test('ComponentManagementAPI.js loads and registers _ComponentManagementAPI', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    window._privs = {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    loadLegacyScript(`${API_DIR}/WirecloudWidgetAPI.js`);
    loadLegacyScript(`${API_DIR}/ComponentManagementAPI.js`);

    assert.ok(window._privs._ComponentManagementAPI,
        '_privs._ComponentManagementAPI should be defined');
    assert.equal(typeof window._privs._ComponentManagementAPI, 'function');
});

test('DashboardManagementAPI.js loads and registers _DashboardManagementAPI', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    window._privs = {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    loadLegacyScript(`${API_DIR}/WirecloudWidgetAPI.js`);
    loadLegacyScript(`${API_DIR}/WirecloudAPICommon.js`);
    loadLegacyScript(`${API_DIR}/DashboardManagementAPI.js`);

    assert.ok(window._privs._DashboardManagementAPI,
        '_privs._DashboardManagementAPI should be defined');
    assert.equal(typeof window._privs._DashboardManagementAPI, 'function');
});

test('full API load order sets up all registrations on _privs', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.parent = mockParent;
    window._privs = {};
    window.MashupPlatform = { priv: {}, mashup: {}, widget: {} };

    loadLegacyScript(`${API_DIR}/WirecloudAPIClosure.js`);

    window._privs = {};
    window.parent = mockParent;

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    loadLegacyScript(`${API_DIR}/WirecloudWidgetAPI.js`);
    loadLegacyScript(`${API_DIR}/WirecloudOperatorAPI.js`);
    loadLegacyScript(`${API_DIR}/WirecloudAPICommon.js`);

    const privsAfterCommon = { ...window._privs };
    assert.ok(privsAfterCommon._APIBootstrap, 'should have _APIBootstrap');
    assert.ok(privsAfterCommon._WidgetAPI, 'should have _WidgetAPI');
    assert.ok(privsAfterCommon._OperatorAPI, 'should have _OperatorAPI');
    assert.ok(privsAfterCommon._APICommon, 'should have _APICommon');

    global.Wirecloud = window.parent.Wirecloud;
    loadLegacyScript(`${API_DIR}/WirecloudAPIV2Bootstrap.js`);

    assert.ok(Wirecloud.createAPIComponent, 'createAPIComponent should be on Wirecloud');
    assert.ok(Wirecloud.APIRequirements, 'APIRequirements should be on Wirecloud');

    window._privs = {};
    loadLegacyScript(`${API_DIR}/StyledElements.js`);
    loadLegacyScript(`${API_DIR}/ComponentManagementAPI.js`);
    loadLegacyScript(`${API_DIR}/DashboardManagementAPI.js`);

    assert.ok(window._privs._StyledElements, 'should have _StyledElements');
    assert.ok(window._privs._ComponentManagementAPI, 'should have _ComponentManagementAPI');
    assert.ok(window._privs._DashboardManagementAPI, 'should have _DashboardManagementAPI');
});

test('createAPIComponent creates a container and calls all API layers', () => {
    const mockParent = createMockParent();
    const mockView = createMockWorkspaceView();
    mockParent.Wirecloud.activeWorkspace.view = mockView;
    mockParent.Wirecloud.UserInterfaceManager.workspaceviews = { default: mockView };

    window.StyledElements = mockParent.StyledElements;
    global.Wirecloud = mockParent.Wirecloud;

    window._privs = {};
    window.parent = window;
    window.MashupPlatform = { priv: {}, mashup: {}, widget: {} };

    loadLegacyScript(`${API_DIR}/WirecloudAPIClosure.js`);
    const savedAPIClosure = window._privs._APIClosure;

    window.parent = mockParent;

    loadLegacyScript(`${API_DIR}/WirecloudAPIBootstrap.js`);
    window._privs._APIClosure = savedAPIClosure;

    loadLegacyScript(`${API_DIR}/WirecloudWidgetAPI.js`);
    loadLegacyScript(`${API_DIR}/WirecloudOperatorAPI.js`);
    loadLegacyScript(`${API_DIR}/WirecloudAPICommon.js`);

    window._privs._StyledElements = function _StyledElements(parent, platform, _) {
        parent.StyledElements = {
            Accordion: platform.StyledElements.Accordion,
            StyledElement: platform.StyledElements.StyledElement,
            ObjectWithEvents: platform.StyledElements.ObjectWithEvents,
        };
    };
    window._privs._DashboardManagementAPI = function _DashboardManagementAPI() {};
    window._privs._ComponentManagementAPI = function _ComponentManagementAPI() {};

    loadLegacyScript(`${API_DIR}/WirecloudAPIV2Bootstrap.js`);

    class TestWidgetClass {
        constructor(platform, shadowRoot, container) {
            this.platform = platform;
            this.shadowRoot = shadowRoot;
            this.container = container;
        }
    }

    const result = Wirecloud.createAPIComponent(
        'widget',
        [],
        TestWidgetClass,
        document.createElement('div'),
        'test-widget-id',
        'default',
        'http://test.com/widget/'
    );

    assert.ok(result instanceof TestWidgetClass, 'should return a TestWidgetClass instance');
    assert.ok(result.platform, 'platform should be set');
    assert.ok(result.platform.http, 'platform.http should exist');
    assert.ok(result.platform.context, 'platform.context should exist');
    assert.ok(result.platform.prefs, 'platform.prefs should exist');
    assert.ok(result.platform.wiring, 'platform.wiring should exist');
    assert.ok(result.platform.mashup, 'platform.mashup should exist');
    assert.ok(result.platform.widget, 'platform.widget should exist');
});
