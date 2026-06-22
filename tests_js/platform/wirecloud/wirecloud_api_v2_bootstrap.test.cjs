const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLegacyScript, resetLegacyRuntime } = require('../../support/legacy-runtime.cjs');

const setupV2Bootstrap = () => {
    if (global.Wirecloud == null) global.Wirecloud = {};
    global._privs = {};
};

test('Wirecloud.APIRequirements is populated', () => {
    setupV2Bootstrap();
    const privs = {
        _StyledElements: () => {},
        _DashboardManagementAPI: () => {},
        _ComponentManagementAPI: () => {}
    };
    const fn = function (Wirecloud) {
        const privates = window._privs;
        delete window._privs;
        Wirecloud.APIRequirements = {
            StyledElements: privates._StyledElements,
            DashboardManagement: privates._DashboardManagementAPI,
            ComponentManagement: privates._ComponentManagementAPI
        };
    };
    fn.apply(null, [Wirecloud]);
    assert.ok('StyledElements' in Wirecloud.APIRequirements);
    assert.ok('DashboardManagement' in Wirecloud.APIRequirements);
    assert.ok('ComponentManagement' in Wirecloud.APIRequirements);
});

test('createAPIComponent creates widget component', () => {
    setupV2Bootstrap();
    const privs = {
        _APIBootstrap: (Wirecloud, utils, container, id, viewid) => {
            container.MashupPlatform = { priv: { id } };
        },
        _WidgetAPI: (container) => {
            Object.defineProperty(container.MashupPlatform, 'widget', { value: {} });
        },
        _APICommon: (container, platform, wrapperElement, baseURL) => {},
        _APIClosure: (container) => {},
        _StyledElements: (container) => {}
    };
    global._privs = privs;
    const WidgetClass = class Widget {
        constructor(mp, shadowRoot, container) { this.mp = mp; }
    };

    const fn = function createAPIComponent(type, requirements, ComponentClass, wrapperElement, id, viewid, baseURL) {
        const container = {};
        privs._APIBootstrap(Wirecloud, Wirecloud.Utils, container, id, viewid);
        if (type === "widget") {
            privs._WidgetAPI(container);
        }
        privs._APICommon(container, window, wrapperElement, baseURL);
        requirements.forEach(function (requirement) {
            if (requirement.name in Wirecloud.APIRequirements) {
                Wirecloud.APIRequirements[requirement.name](container, window, wrapperElement);
            }
        });
        privs._APIClosure(container);
        const MashupPlatform = container.MashupPlatform;
        let component;
        if (type === "widget") {
            component = new ComponentClass(MashupPlatform, wrapperElement.shadowRoot, container);
        }
        return component;
    };
    Wirecloud.Utils = {};
    Wirecloud.APIRequirements = {};
    const widget = fn("widget", [], WidgetClass, { shadowRoot: {} }, 'w1');
    assert.ok(widget instanceof WidgetClass);
});

test('createAPIComponent creates operator component', () => {
    setupV2Bootstrap();
    const privs = {
        _APIBootstrap: (Wirecloud, utils, container, id, viewid) => {
            container.MashupPlatform = { priv: { id } };
        },
        _OperatorAPI: (container) => {
            Object.defineProperty(container.MashupPlatform, 'operator', { value: {} });
        },
        _APICommon: (container, platform, wrapperElement, baseURL) => {},
        _APIClosure: (container) => {}
    };
    global._privs = privs;
    const OperatorClass = class Operator {
        constructor(mp) { this.mp = mp; }
    };

    const fn = function createAPIComponent(type, requirements, ComponentClass, wrapperElement, id, viewid, baseURL) {
        const container = {};
        privs._APIBootstrap(Wirecloud, Wirecloud.Utils, container, id, viewid);
        if (type === "operator") {
            privs._OperatorAPI(container);
        }
        privs._APICommon(container, window, wrapperElement, baseURL);
        requirements.forEach(function (requirement) {
            if (requirement.name in Wirecloud.APIRequirements) {
                Wirecloud.APIRequirements[requirement.name](container, window, wrapperElement);
            }
        });
        privs._APIClosure(container);
        const MashupPlatform = container.MashupPlatform;
        let component;
        if (type === "operator") {
            component = new ComponentClass(MashupPlatform, container);
        }
        return component;
    };
    Wirecloud.Utils = {};
    Wirecloud.APIRequirements = {};
    const op = fn("operator", [], OperatorClass, null, 'op1');
    assert.ok(op instanceof OperatorClass);
});

test('createAPIComponent calls API requirements', () => {
    setupV2Bootstrap();
    let styledCalled = false;
    const privs = {
        _APIBootstrap: (Wirecloud, utils, container, id, viewid) => {
            container.MashupPlatform = { priv: { id } };
        },
        _WidgetAPI: (container) => { container.MashupPlatform.widget = {}; },
        _APICommon: (container, platform, wrapperElement, baseURL) => {},
        _APIClosure: (container) => {},
        _StyledElements: (container) => { styledCalled = true; }
    };
    global._privs = privs;
    const WidgetClass = class {};
    Wirecloud.Utils = {};
    Wirecloud.APIRequirements = { StyledElements: privs._StyledElements };

    const fn = function createAPIComponent(type, requirements, ComponentClass, wrapperElement, id, viewid, baseURL) {
        const container = {};
        privs._APIBootstrap(Wirecloud, Wirecloud.Utils, container, id, viewid);
        if (type === "widget") privs._WidgetAPI(container);
        privs._APICommon(container, window, wrapperElement, baseURL);
        requirements.forEach(function (requirement) {
            if (requirement.name in Wirecloud.APIRequirements) {
                Wirecloud.APIRequirements[requirement.name](container, window, wrapperElement);
            }
        });
    };
    fn("widget", [{ name: 'StyledElements' }], WidgetClass, { shadowRoot: {} }, 'w1');
    assert.equal(styledCalled, true);

    styledCalled = false;
    fn("widget", [{ name: 'UnknownReq' }], WidgetClass, { shadowRoot: {} }, 'w1');
    assert.equal(styledCalled, false);
});

test('registerWidgetClass and registerOperatorClass store classes', () => {
    setupV2Bootstrap();
    Wirecloud.APIComponents = {};
    const registerWidgetClass = function registerWidgetClass(script, widgetClass) {
        Wirecloud.APIComponents[script.dataset.id] = widgetClass;
    };
    const registerOperatorClass = function registerOperatorClass(script, operatorClass) {
        Wirecloud.APIComponents[script.dataset.id] = operatorClass;
    };
    const WidgetClass = class {};
    const OperatorClass = class {};
    registerWidgetClass({ dataset: { id: 'wid1' } }, WidgetClass);
    registerOperatorClass({ dataset: { id: 'op1' } }, OperatorClass);
    assert.equal(Wirecloud.APIComponents['wid1'], WidgetClass);
    assert.equal(Wirecloud.APIComponents['op1'], OperatorClass);
});

test('createAPIComponent passes baseURL and wrapperElement to _APICommon', () => {
    setupV2Bootstrap();
    let capturedBaseURL = null;
    let capturedWrapper = null;
    const privs = {
        _APIBootstrap: (Wirecloud, utils, container, id, viewid) => {
            container.MashupPlatform = { priv: { id } };
        },
        _WidgetAPI: () => {},
        _APICommon: (container, platform, wrapperElement, baseURL) => {
            capturedBaseURL = baseURL;
            capturedWrapper = wrapperElement;
        },
        _APIClosure: () => {}
    };
    global._privs = privs;
    Wirecloud.Utils = {};
    Wirecloud.APIRequirements = {};
    const fn = function createAPIComponent(type, requirements, ComponentClass, wrapperElement, id, viewid, baseURL) {
        const container = {};
        privs._APIBootstrap(Wirecloud, Wirecloud.Utils, container, id, viewid);
        privs._WidgetAPI(container);
        privs._APICommon(container, window, wrapperElement, baseURL);
    };
    const wrapper = { data: 'w' };
    fn("widget", [], class {}, wrapper, 'w1', null, 'http://base/');
    assert.equal(capturedBaseURL, 'http://base/');
    assert.equal(capturedWrapper, wrapper);
});

const setupRealV2Bootstrap = () => {
    resetLegacyRuntime();
    const calls = {
        apiBootstrap: [],
        apiCommon: [],
        apiClosure: [],
        operators: [],
        requirements: [],
        widgets: [],
    };
    global.Wirecloud = { Utils: {} };
    global._privs = {
        _APIBootstrap(Wirecloud, utils, container, id, viewid) {
            calls.apiBootstrap.push({ Wirecloud, utils, container, id, viewid });
            container.MashupPlatform = { id, viewid };
        },
        _WidgetAPI(container) {
            calls.widgets.push(container);
            container.MashupPlatform.widget = {};
        },
        _OperatorAPI(container) {
            calls.operators.push(container);
            container.MashupPlatform.operator = {};
        },
        _APICommon(container, platform, wrapperElement, baseURL) {
            calls.apiCommon.push({ container, platform, wrapperElement, baseURL });
        },
        _APIClosure(container) {
            calls.apiClosure.push(container);
        },
        _StyledElements(container, platform, wrapperElement) {
            calls.requirements.push({ name: 'StyledElements', container, platform, wrapperElement });
        },
        _DashboardManagementAPI(container, platform, wrapperElement) {
            calls.requirements.push({ name: 'DashboardManagement', container, platform, wrapperElement });
        },
        _ComponentManagementAPI(container, platform, wrapperElement) {
            calls.requirements.push({ name: 'ComponentManagement', container, platform, wrapperElement });
        },
    };

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudAPIV2Bootstrap.js');
    return { calls, Wirecloud: global.Wirecloud };
};

test('WirecloudAPIV2Bootstrap production implementation creates API components', () => {
    const { calls, Wirecloud } = setupRealV2Bootstrap();
    const wrapper = { shadowRoot: { id: 'shadow' } };
    class WidgetComponent {
        constructor(MashupPlatform, shadowRoot, container) {
            this.MashupPlatform = MashupPlatform;
            this.shadowRoot = shadowRoot;
            this.container = container;
        }
    }
    class OperatorComponent {
        constructor(MashupPlatform, container) {
            this.MashupPlatform = MashupPlatform;
            this.container = container;
        }
    }

    const widget = Wirecloud.createAPIComponent(
        'widget',
        [{ name: 'StyledElements' }, { name: 'Unknown' }],
        WidgetComponent,
        wrapper,
        'widget-id',
        'view-id',
        'https://base/'
    );
    assert.ok(widget instanceof WidgetComponent);
    assert.equal(widget.MashupPlatform.id, 'widget-id');
    assert.equal(widget.shadowRoot, wrapper.shadowRoot);
    assert.equal(calls.widgets.length, 1);
    assert.equal(calls.requirements.length, 1);
    assert.equal(calls.apiCommon[0].baseURL, 'https://base/');
    assert.equal(calls.apiClosure[0], widget.container);

    const operator = Wirecloud.createAPIComponent(
        'operator',
        [{ name: 'DashboardManagement' }, { name: 'ComponentManagement' }],
        OperatorComponent,
        wrapper,
        'operator-id',
        undefined,
        'https://operator/'
    );
    assert.ok(operator instanceof OperatorComponent);
    assert.equal(operator.MashupPlatform.id, 'operator-id');
    assert.equal(calls.operators.length, 1);
    assert.deepEqual(calls.requirements.slice(1).map((entry) => entry.name), ['DashboardManagement', 'ComponentManagement']);

    const unknown = Wirecloud.createAPIComponent('other', [], class Other {}, wrapper, 'other-id');
    assert.equal(unknown, undefined);
});

test('WirecloudAPIV2Bootstrap production implementation registers component classes', () => {
    const { Wirecloud } = setupRealV2Bootstrap();
    class WidgetClass {}
    class OperatorClass {}

    assert.equal(typeof Wirecloud.APIRequirements.StyledElements, 'function');
    assert.equal(typeof Wirecloud.APIRequirements.DashboardManagement, 'function');
    assert.equal(typeof Wirecloud.APIRequirements.ComponentManagement, 'function');
    Wirecloud.registerWidgetClass({ dataset: { id: 'widget-script' } }, WidgetClass);
    Wirecloud.registerOperatorClass({ dataset: { id: 'operator-script' } }, OperatorClass);
    assert.equal(Wirecloud.APIComponents['widget-script'], WidgetClass);
    assert.equal(Wirecloud.APIComponents['operator-script'], OperatorClass);
    assert.equal(global._privs, undefined);
});
