const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadLegacyScript,
    resetLegacyRuntime,
    loadLegacyScripts,
} = require('../../support/legacy-runtime.cjs');

const setupCommon = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    if (!global.StyledElements) {
        global.StyledElements = {
            GUIBuilder: class { constructor() {} parse() { return ''; } },
            DEFAULT_OPENING: '',
            DEFAULT_CLOSING: ''
        };
    }

    Wirecloud.io = {
        buildProxyURL: (url, opts) => url.toString(),
        makeRequest: () => Promise.resolve({ status: 200, responseText: '{}' })
    };
    Wirecloud.PreferenceDoesNotExistError = class extends Error { constructor(msg) { super(msg); } };
    Wirecloud.wiring = {
        EndpointDoesNotExistError: class extends Error { constructor(msg) { super(msg); } },
        EndpointTypeError: class extends Error { constructor(msg) { super(msg); } },
        EndpointValueError: class extends Error { constructor(msg) { super(msg); } }
    };
    Wirecloud.GlobalLogManager = { log: () => {} };
    Wirecloud.Widget = class Widget { constructor() { this.id = 'w1'; } };
    global._privs = {};
    global.gettext = (text) => text;
    global.interpolate = (text, vars) => text.replace(/%\((\w+)\)s/g, (_, k) => vars[k]);
};

test('_APICommon sets up http module', () => {
    setupCommon();
    const platform = { Wirecloud, StyledElements: global.StyledElements, interpolate: global.interpolate, gettext: global.gettext };
    const workspaceview = { model: { contextManager: { getAvailableContext: () => ({}), get: () => null, modify: () => {} } } };
    const comp = { id: 'w1', meta: { preferences: {} }, preferences: {}, inputs: {}, outputs: {}, registerContextAPICallback: () => {}, registerPrefCallback: () => {}, logManager: { log: () => {} } };
    const parent = { MashupPlatform: { priv: { workspaceview, resource: comp }, mashup: {} } };

    const fn = function _APICommon(parent, platform, DOMElement, baseURL) {
        const Wirecloud = platform.Wirecloud;
        const component = parent.MashupPlatform.priv.resource;
        const componentType = "widget";
        Object.defineProperty(parent.MashupPlatform, 'http', {value: {}});
        Object.defineProperty(parent.MashupPlatform.http, 'buildProxyURL', {value: Wirecloud.io.buildProxyURL});
        Object.defineProperty(parent.MashupPlatform.http, 'makeRequest', {
            value: function makeRequest(url, options) {
                if (!options.requestHeaders) { options.requestHeaders = {}; }
                options.requestHeaders["wirecloud-component-type"] = componentType;
                options.requestHeaders["wirecloud-component-id"] = component.id;
                return Wirecloud.io.makeRequest(url, options);
            }
        });
        Object.preventExtensions(parent.MashupPlatform.http);
    };
    fn(parent, platform, null, 'http://base/');
    assert.equal(typeof parent.MashupPlatform.http.makeRequest, 'function');
});

test('_APICommon context module - getAvailableContext and get', () => {
    setupCommon();
    const platform = { Wirecloud, StyledElements: global.StyledElements, interpolate: global.interpolate, gettext: global.gettext };
    const ctx = { testKey: 'testVal' };
    Wirecloud.contextManager = { getAvailableContext: () => ctx, get: (k) => ctx[k] };
    const workspaceview = { model: { contextManager: Wirecloud.contextManager } };
    const comp = { id: 'w1', meta: { preferences: {} }, preferences: {}, inputs: {}, outputs: {}, registerContextAPICallback: () => {}, registerPrefCallback: () => {}, logManager: { log: () => {} } };
    const parent = { MashupPlatform: { priv: { workspaceview, resource: comp }, mashup: {} } };

    const fn = function _APICommon(parent, platform, DOMElement, baseURL) {
        const Wirecloud = platform.Wirecloud;
        const component = parent.MashupPlatform.priv.resource;
        Object.defineProperty(parent.MashupPlatform, 'context', {value: {}});
        Object.defineProperty(parent.MashupPlatform.context, 'getAvailableContext', {
            value: function getAvailableContext() { return Wirecloud.contextManager.getAvailableContext(); }
        });
        Object.defineProperty(parent.MashupPlatform.context, 'get', {
            value: function get(name) { return Wirecloud.contextManager.get(name); }
        });
        Object.defineProperty(parent.MashupPlatform.context, 'registerCallback', {
            value: function registerCallback(callback) {
                if (typeof callback !== "function") { throw new TypeError('callback must be a function'); }
                component.registerContextAPICallback('platform', callback);
            }
        });
        Object.preventExtensions(parent.MashupPlatform.context);
    };
    fn(parent, platform, null, 'http://base/');
    assert.equal(parent.MashupPlatform.context.get('testKey'), 'testVal');
    assert.throws(() => parent.MashupPlatform.context.registerCallback('notfn'), /callback must be a function/);
});

test('_APICommon preferences module', () => {
    setupCommon();
    const platform = { Wirecloud, StyledElements: global.StyledElements, interpolate: global.interpolate, gettext: global.gettext };
    const comp = {
        id: 'w1',
        meta: { preferences: { pref1: { default: '' } } },
        preferences: { pref1: { value: 'ok' } },
        inputs: {}, outputs: {},
        registerContextAPICallback: () => {},
        registerPrefCallback: () => {},
        setPreferences: () => {},
        logManager: { log: () => {} }
    };
    const workspaceview = { model: { contextManager: { getAvailableContext: () => ({}), get: () => null } } };
    const parent = { MashupPlatform: { priv: { workspaceview, resource: comp }, mashup: {} } };

    const fn = function _APICommon(parent, platform, DOMElement, baseURL) {
        const Wirecloud = platform.Wirecloud;
        const component = parent.MashupPlatform.priv.resource;
        Object.defineProperty(parent.MashupPlatform, 'prefs', {value: {}});
        Object.defineProperty(parent.MashupPlatform.prefs, 'get', {
            value: function get(key) {
                if (key in component.meta.preferences) {
                    return component.preferences[key].value;
                } else {
                    const exception_msg = platform.interpolate('"%(pref)s" is not a valid preference name', {pref: key}, true);
                    throw new parent.MashupPlatform.prefs.PreferenceDoesNotExistError(exception_msg);
                }
            }
        });
        Object.defineProperty(parent.MashupPlatform.prefs, 'set', {
            value: function set(key, value) {
                const newValues = typeof key === "string" ? {[key]: value} : arguments[0];
                if (newValues == null || typeof newValues !== "object") { throw new TypeError(); }
                Object.keys(newValues).forEach((key) => {
                    if (!(key in component.meta.preferences)) {
                        const msg = platform.interpolate('"%(pref)s" is not a valid preference name', {pref: key}, true);
                        throw new parent.MashupPlatform.prefs.PreferenceDoesNotExistError(msg);
                    }
                });
                component.setPreferences(newValues);
            }
        });
        Object.defineProperty(parent.MashupPlatform.prefs, 'registerCallback', {
            value: function registerCallback(callback) {
                if (typeof callback !== "function") { throw new TypeError('callback must be a function'); }
                component.registerPrefCallback(callback);
            }
        });
        Object.defineProperty(parent.MashupPlatform.prefs, 'PreferenceDoesNotExistError', {value: Wirecloud.PreferenceDoesNotExistError});
        Object.preventExtensions(parent.MashupPlatform.prefs);
    };
    fn(parent, platform, null, 'http://base/');
    assert.equal(parent.MashupPlatform.prefs.get('pref1'), 'ok');
    assert.throws(() => parent.MashupPlatform.prefs.get('unknown'), /not a valid preference/);
    assert.throws(() => parent.MashupPlatform.prefs.set('unknown', 'val'), /not a valid preference/);
    assert.throws(() => parent.MashupPlatform.prefs.set(null), /TypeError/);
    assert.throws(() => parent.MashupPlatform.prefs.registerCallback('notfn'), /callback must be a function/);
});

test('_APICommon wiring module - registerCallback', () => {
    setupCommon();
    const platform = { Wirecloud, StyledElements: global.StyledElements, interpolate: global.interpolate, gettext: global.gettext };
    const comp = {
        id: 'w1',
        meta: { preferences: {} },
        preferences: {},
        inputs: { in1: { callback: null } },
        outputs: {},
        registerContextAPICallback: () => {},
        registerPrefCallback: () => {},
        logManager: { log: () => {} }
    };
    const workspaceview = { model: { contextManager: { getAvailableContext: () => ({}), get: () => null } } };
    const parent = { MashupPlatform: { priv: { workspaceview, resource: comp }, mashup: {} } };

    const fn = function _APICommon(parent, platform, DOMElement, baseURL) {
        const Wirecloud = platform.Wirecloud;
        const component = parent.MashupPlatform.priv.resource;
        Object.defineProperty(parent.MashupPlatform, 'wiring', {value: {}});
        Object.defineProperty(parent.MashupPlatform.wiring, 'registerCallback', {
            value: function registerCallback(inputName, callback) {
                if (typeof callback !== "function") { throw new TypeError('callback must be a function'); }
                if (inputName in component.inputs) {
                    component.inputs[inputName].callback = callback;
                } else {
                    const exception_msg = platform.interpolate('"%(endpoint)s" is not a valid input endpoint', {endpoint: inputName}, true);
                    throw new parent.MashupPlatform.wiring.EndpointDoesNotExistError(exception_msg);
                }
            }
        });
        Object.defineProperty(parent.MashupPlatform.wiring, 'EndpointDoesNotExistError', {value: Wirecloud.wiring.EndpointDoesNotExistError});
        Object.preventExtensions(parent.MashupPlatform.wiring);
    };
    fn(parent, platform, null, 'http://base/');
    const cb = () => 'ok';
    parent.MashupPlatform.wiring.registerCallback('in1', cb);
    assert.equal(comp.inputs.in1.callback, cb);
    assert.throws(() => parent.MashupPlatform.wiring.registerCallback('in1', 'notfn'), /callback must be a function/);
    assert.throws(() => parent.MashupPlatform.wiring.registerCallback('bad', cb), /not a valid input endpoint/);
});

test('_APICommon wiring module - pushEvent and connections', () => {
    setupCommon();
    const platform = { Wirecloud, StyledElements: global.StyledElements, interpolate: global.interpolate, gettext: global.gettext };
    const pushed = {};
    const comp = {
        id: 'w1', meta: { preferences: {} }, preferences: {},
        inputs: { in1: { inputs: [] } },
        outputs: { out1: { propagate: (d, o) => { pushed.data = d; pushed.options = o; }, outputList: [1], getReachableEndpoints: () => [] } },
        registerContextAPICallback: () => {}, registerPrefCallback: () => {}, logManager: { log: () => {} }
    };
    const workspaceview = { model: { contextManager: { getAvailableContext: () => ({}), get: () => null } } };
    const parent = { MashupPlatform: { priv: { workspaceview, resource: comp }, mashup: {} } };

    const fn = function _APICommon(parent, platform, DOMElement, baseURL) {
        const Wirecloud = platform.Wirecloud;
        const component = parent.MashupPlatform.priv.resource;
        Object.defineProperty(parent.MashupPlatform, 'wiring', {value: {}});
        Object.defineProperty(parent.MashupPlatform.wiring, 'pushEvent', {
            value: function pushEvent(outputName, data, options) {
                if (outputName in component.outputs) {
                    component.outputs[outputName].propagate(data, options);
                } else {
                    throw new parent.MashupPlatform.wiring.EndpointDoesNotExistError('');
                }
            }
        });
        Object.defineProperty(parent.MashupPlatform.wiring, 'hasInputConnections', {
            value: function hasInputConnections(inputName) {
                if (inputName in component.inputs) return component.inputs[inputName].inputs.length > 0;
                throw new parent.MashupPlatform.wiring.EndpointDoesNotExistError('');
            }
        });
        Object.defineProperty(parent.MashupPlatform.wiring, 'hasOutputConnections', {
            value: function hasOutputConnections(outputName) {
                if (outputName in component.outputs) return component.outputs[outputName].outputList.length > 0;
                throw new parent.MashupPlatform.wiring.EndpointDoesNotExistError('');
            }
        });
        Object.defineProperty(parent.MashupPlatform.wiring, 'getReachableEndpoints', {
            value: function getReachableEndpoints(outputName) {
                if (outputName in component.outputs) return component.outputs[outputName].getReachableEndpoints();
                throw new parent.MashupPlatform.wiring.EndpointDoesNotExistError('');
            }
        });
        Object.defineProperty(parent.MashupPlatform.wiring, 'EndpointDoesNotExistError', {value: Wirecloud.wiring.EndpointDoesNotExistError});
        Object.preventExtensions(parent.MashupPlatform.wiring);
    };
    fn(parent, platform, null, 'http://base/');
    parent.MashupPlatform.wiring.pushEvent('out1', 'hello', { target: 1 });
    assert.equal(pushed.data, 'hello');
    assert.equal(parent.MashupPlatform.wiring.hasInputConnections('in1'), false);
    assert.equal(parent.MashupPlatform.wiring.hasOutputConnections('out1'), true);
});

test('_APICommon wiring registerStatusCallback', () => {
    setupCommon();
    const platform = { Wirecloud, StyledElements: global.StyledElements, interpolate: global.interpolate, gettext: global.gettext };
    let addedCb = null;
    const wiringObj = { addEventListener: (evt, cb) => { addedCb = cb; } };
    const comp = {
        id: 'w1', meta: { preferences: {} }, preferences: {}, inputs: {}, outputs: {},
        wiring: wiringObj, registerContextAPICallback: () => {}, registerPrefCallback: () => {}, logManager: { log: () => {} }
    };
    const workspaceview = { model: { contextManager: { getAvailableContext: () => ({}), get: () => null } } };
    const parent = { MashupPlatform: { priv: { workspaceview, resource: comp }, mashup: {} } };

    const fn = function _APICommon(parent, platform, DOMElement, baseURL) {
        const Wirecloud = platform.Wirecloud;
        const component = parent.MashupPlatform.priv.resource;
        Object.defineProperty(parent.MashupPlatform, 'wiring', {value: {}});
        Object.defineProperty(parent.MashupPlatform.wiring, 'registerStatusCallback', {
            value: function registerCallback(callback) {
                let wiring;
                if (typeof callback !== "function") { throw new TypeError('callback must be a function'); }
                if ('wiring' in component) { wiring = component.wiring; }
                else { wiring = component.tab.workspace.wiring; }
                wiring.addEventListener('load', callback);
            }
        });
        Object.preventExtensions(parent.MashupPlatform.wiring);
    };
    fn(parent, platform, null, 'http://base/');
    const cb = () => {};
    parent.MashupPlatform.wiring.registerStatusCallback(cb);
    assert.equal(addedCb, cb);
    assert.throws(() => parent.MashupPlatform.wiring.registerStatusCallback('notfn'), /callback must be a function/);
});

test('_APICommon mashup context module', () => {
    setupCommon();
    const platform = { Wirecloud, StyledElements: global.StyledElements, interpolate: global.interpolate, gettext: global.gettext };
    const mashupCtx = { k1: 'v1' };
    const spaceview = { model: { contextManager: { getAvailableContext: () => mashupCtx, get: (k) => mashupCtx[k] } } };
    const comp = { id: 'w1', meta: { preferences: {} }, preferences: {}, inputs: {}, outputs: {}, registerContextAPICallback: () => {}, registerPrefCallback: () => {}, logManager: { log: () => {} } };
    const parent = { MashupPlatform: { priv: { workspaceview: spaceview, resource: comp }, mashup: {} } };

    const fn = function _APICommon(parent, platform, DOMElement, baseURL) {
        const Wirecloud = platform.Wirecloud;
        const workspaceview = parent.MashupPlatform.priv.workspaceview;
        const component = parent.MashupPlatform.priv.resource;
        Object.defineProperty(parent.MashupPlatform, 'mashup', {value: {}});
        Object.defineProperty(parent.MashupPlatform.mashup, 'context', {value: {}});
        Object.defineProperty(parent.MashupPlatform.mashup.context, 'getAvailableContext', {
            value: function getAvailableContext() { return workspaceview.model.contextManager.getAvailableContext(); }
        });
        Object.defineProperty(parent.MashupPlatform.mashup.context, 'get', {
            value: function get(name) { return workspaceview.model.contextManager.get(name); }
        });
        Object.defineProperty(parent.MashupPlatform.mashup.context, 'registerCallback', {
            value: function registerCallback(callback) {
                if (typeof callback !== "function") { throw new TypeError('callback must be a function'); }
                component.registerContextAPICallback('mashup', callback);
            }
        });
        Object.preventExtensions(parent.MashupPlatform.mashup.context);
    };
    fn(parent, platform, null, 'http://base/');
    assert.equal(parent.MashupPlatform.mashup.context.get('k1'), 'v1');
    assert.throws(() => parent.MashupPlatform.mashup.context.registerCallback('notfn'), /callback must be a function/);
});

test('_APICommon sets location on MashupPlatform', () => {
    setupCommon();
    const platform = { Wirecloud, StyledElements: global.StyledElements, interpolate: global.interpolate, gettext: global.gettext };
    const workspaceview = { model: { contextManager: { getAvailableContext: () => ({}), get: () => null, modify: () => {} } } };
    const comp = { id: 'w1', meta: { preferences: {} }, preferences: {}, inputs: {}, outputs: {}, registerContextAPICallback: () => {}, registerPrefCallback: () => {}, logManager: { log: () => {} } };
    const parent = { MashupPlatform: { priv: { workspaceview, resource: comp }, mashup: {} } };

    const fn = function _APICommon(parent, platform, DOMElement, baseURL) {
        Object.defineProperty(parent.MashupPlatform, 'location', {value: baseURL});
    };
    fn(parent, platform, null, 'http://mybase/');
    assert.equal(parent.MashupPlatform.location, 'http://mybase/');
});

const setupRealAPICommon = (componentOverrides = {}) => {
    setupCommon();
    resetLegacyRuntime();

    const calls = {
        contextCallbacks: [],
        prefCallbacks: [],
        preferences: [],
        propagated: [],
        requests: [],
        logs: [],
        wiringListeners: [],
    };

    global._privs = {};
    global.location = new URL('https://widget.example/base/index.html');
    global.window.location = global.location;
    global.window.parent = global.window;
    global.Wirecloud = {};
    const Wirecloud = global.Wirecloud;

    Wirecloud.io = {
        buildProxyURL: (url) => `proxy:${url}`,
        makeRequest(url, options) {
            calls.requests.push({ url: String(url), options });
            return Promise.resolve({ status: 200, responseText: '{}' });
        }
    };
    Wirecloud.contextManager = {
        getAvailableContext: () => ({ platform: true }),
        get: (name) => `platform:${name}`,
    };
    Wirecloud.PreferenceDoesNotExistError = class PreferenceDoesNotExistError extends Error {};
    Wirecloud.wiring = {
        EndpointDoesNotExistError: class EndpointDoesNotExistError extends Error {},
        EndpointTypeError: class EndpointTypeError extends Error {},
        EndpointValueError: class EndpointValueError extends Error {},
    };
    Wirecloud.Widget = class Widget {};

    global.StyledElements = {
        GUIBuilder: class GUIBuilder {
            constructor() {
                this.DEFAULT_OPENING = '<root>';
                this.DEFAULT_CLOSING = '</root>';
            }

            parse(template, values) {
                return { template, values };
            }
        }
    };

    const workspaceWiring = {
        addEventListener(name, callback) {
            calls.wiringListeners.push({ name, callback });
        }
    };
    const workspaceview = {
        model: {
            contextManager: {
                getAvailableContext: () => ({ mashup: true }),
                get: (name) => `mashup:${name}`,
            },
            wiring: workspaceWiring,
        }
    };

    const component = Object.assign(new Wirecloud.Widget(), {
        id: 'component-1',
        meta: {
            base_url: 'https://widget.example/base/',
            preferences: { pref1: {} },
        },
        preferences: { pref1: { value: 'value1' } },
        inputs: { input1: { inputs: [1], callback: null } },
        outputs: {
            output1: {
                outputList: [1],
                propagate(data, options) {
                    calls.propagated.push({ data, options });
                },
                getReachableEndpoints() {
                    return [{ id: 'target' }];
                }
            }
        },
        tab: { workspace: { wiring: workspaceWiring } },
        registerContextAPICallback(scope, callback) {
            calls.contextCallbacks.push({ scope, callback });
        },
        registerPrefCallback(callback) {
            calls.prefCallbacks.push(callback);
        },
        setPreferences(values) {
            calls.preferences.push(values);
        },
        logManager: {
            log(message, options) {
                calls.logs.push({ message, options });
            }
        }
    }, componentOverrides);

    const parent = {
        MashupPlatform: {
            priv: { workspaceview, resource: component },
            mashup: {},
        }
    };
    const platform = {
        document: global.document,
        gettext: global.gettext,
        interpolate: global.interpolate,
        StyledElements: global.StyledElements,
        URL,
        Wirecloud,
    };

    const domElement = global.document.createElement('iframe');
    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudAPICommon.js');
    window._privs._APICommon(parent, platform, domElement, 'https://widget.example/base/');

    return { calls, component, domElement, parent };
};

test('_APICommon production implementation wires public modules', async () => {
    const { calls, component, parent } = setupRealAPICommon();
    const api = parent.MashupPlatform;

    assert.equal(api.location, 'https://widget.example/base/');
    assert.equal(api.http.buildProxyURL('https://example.test'), 'proxy:https://example.test');

    await api.http.makeRequest('/path', {});
    assert.equal(calls.requests[0].options.requestHeaders['wirecloud-component-type'], 'widget');
    assert.equal(calls.requests[0].options.requestHeaders['wirecloud-component-id'], 'component-1');

    assert.deepEqual(api.context.getAvailableContext(), { platform: true });
    assert.equal(api.context.get('tenant'), 'platform:tenant');
    assert.deepEqual(api.mashup.context.getAvailableContext(), { mashup: true });
    assert.equal(api.mashup.context.get('workspace'), 'mashup:workspace');

    const cb = () => {};
    api.context.registerCallback(cb);
    api.mashup.context.registerCallback(cb);
    api.prefs.registerCallback(cb);
    assert.deepEqual(calls.contextCallbacks.map((entry) => entry.scope), ['platform', 'mashup']);
    assert.equal(calls.prefCallbacks[0], cb);

    assert.equal(api.prefs.get('pref1'), 'value1');
    api.prefs.set('pref1', 'next');
    api.prefs.set({ pref1: 'bulk' });
    assert.deepEqual(calls.preferences, [{ pref1: 'next' }, { pref1: 'bulk' }]);

    api.wiring.registerCallback('input1', cb);
    assert.equal(component.inputs.input1.callback, cb);
    api.wiring.registerStatusCallback(cb);
    assert.equal(calls.wiringListeners[0].name, 'load');
    api.wiring.pushEvent('output1', 'payload', { targetEndpoints: [] });
    assert.deepEqual(calls.propagated[0], { data: 'payload', options: { targetEndpoints: [] } });
    assert.equal(api.wiring.hasInputConnections('input1'), true);
    assert.equal(api.wiring.hasOutputConnections('output1'), true);
    assert.deepEqual(api.wiring.getReachableEndpoints('output1'), [{ id: 'target' }]);
});

test('_APICommon production implementation validates callbacks and names', () => {
    const { parent } = setupRealAPICommon();
    const api = parent.MashupPlatform;

    assert.throws(() => api.context.registerCallback(null), TypeError);
    assert.throws(() => api.mashup.context.registerCallback(null), TypeError);
    assert.throws(() => api.prefs.registerCallback(null), TypeError);
    assert.throws(() => api.prefs.get('missing'), global.Wirecloud.PreferenceDoesNotExistError);
    assert.throws(() => api.prefs.set(null), TypeError);
    assert.throws(() => api.prefs.set('missing', 'value'), global.Wirecloud.PreferenceDoesNotExistError);
    assert.throws(() => api.wiring.registerCallback('input1', null), TypeError);
    assert.throws(() => api.wiring.registerCallback('missing', () => {}), global.Wirecloud.wiring.EndpointDoesNotExistError);
    assert.throws(() => api.wiring.registerStatusCallback(null), TypeError);
    assert.throws(() => api.wiring.pushEvent('missing', 'payload'), global.Wirecloud.wiring.EndpointDoesNotExistError);
    assert.throws(() => api.wiring.hasInputConnections('missing'), global.Wirecloud.wiring.EndpointDoesNotExistError);
    assert.throws(() => api.wiring.hasOutputConnections('missing'), global.Wirecloud.wiring.EndpointDoesNotExistError);
    assert.throws(() => api.wiring.getReachableEndpoints('missing'), global.Wirecloud.wiring.EndpointDoesNotExistError);
});

test('_APICommon production implementation handles operator components and DOM errors', async () => {
    setupCommon();
    resetLegacyRuntime();

    const logs = [];
    global._privs = {};
    global.location = new URL('https://operator.example/base/index.html');
    global.window.location = global.location;
    global.window.parent = global.window;
    global.Wirecloud = {};
    const Wirecloud = global.Wirecloud;
    Wirecloud.Widget = class Widget {};
    Wirecloud.io = {
        buildProxyURL: (url) => url,
        makeRequest(url, options) {
            return Promise.resolve({ url, options });
        }
    };
    Wirecloud.contextManager = { getAvailableContext: () => ({}), get: () => null };
    Wirecloud.PreferenceDoesNotExistError = class PreferenceDoesNotExistError extends Error {};
    Wirecloud.wiring = {
        EndpointDoesNotExistError: class EndpointDoesNotExistError extends Error {},
        EndpointTypeError: class EndpointTypeError extends Error {},
        EndpointValueError: class EndpointValueError extends Error {},
    };
    global.StyledElements = {
        GUIBuilder: class GUIBuilder {
            constructor() {
                this.DEFAULT_OPENING = '';
                this.DEFAULT_CLOSING = '';
            }

            parse(template, values) {
                return { template, values };
            }
        }
    };

    const component = {
        id: 'operator-1',
        meta: { base_url: 'https://operator.example/base/', preferences: {} },
        preferences: {},
        inputs: {},
        outputs: {},
        wiring: { addEventListener() {} },
        registerContextAPICallback() {},
        registerPrefCallback() {},
        logManager: {
            log(message, options) {
                logs.push({ message, options });
            }
        }
    };
    const parent = {
        MashupPlatform: {
            priv: {
                workspaceview: { model: { contextManager: { getAvailableContext: () => ({}), get: () => null } } },
                resource: component,
            },
            mashup: {},
        }
    };
    const platform = {
        document: global.document,
        gettext: global.gettext,
        interpolate: global.interpolate,
        StyledElements: global.StyledElements,
        URL,
        Wirecloud,
    };

    const domElement = global.document.createElement('iframe');
    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudAPICommon.js');
    window._privs._APICommon(parent, platform, domElement, 'https://operator.example/base/');
    const response = await parent.MashupPlatform.http.makeRequest('/path', {});
    assert.equal(response.options.requestHeaders['wirecloud-component-type'], 'operator');
    const statusCallback = () => {};
    parent.MashupPlatform.wiring.registerStatusCallback(statusCallback);

    let stopped = false;
    domElement.dispatchEvent({
        type: 'error',
        error: new Error('boom'),
        filename: 'https://operator.example/base/main.js',
        lineno: 4,
        message: 'Boom',
        stopPropagation() {
            stopped = true;
        }
    });
    assert.equal(stopped, true);
    assert.equal(logs[0].message, 'Boom');
    assert.deepEqual(logs[0].options.details.values, { file: 'main.js', line: 4 });
});

test('_APICommon auto-initializes when loaded inside an iframe', () => {
    resetLegacyRuntime();

    const calls = [];
    global._privs = {};
    global.Wirecloud = {};
    global.location = new URL('https://host.example/a/b/c/d/e/f/g/h/i.html');
    global.window.location = global.location;
    global.window.addEventListener = (name) => calls.push(name);

    class Widget {}
    const resource = new Widget();
    Object.assign(resource, {
        id: 'auto-widget',
        meta: { base_url: 'https://host.example/a/b/c/d/e/f/g/h/', preferences: {} },
        preferences: {},
        inputs: {},
        outputs: {},
        tab: { workspace: { wiring: { addEventListener() {} } } },
        registerContextAPICallback() {},
        registerPrefCallback() {},
        logManager: { log() {} },
    });

    const platform = {
        document: global.document,
        gettext: global.gettext,
        interpolate: global.interpolate,
        URL,
        StyledElements: {
            GUIBuilder: class GUIBuilder {
                parse() {
                    return {};
                }
            }
        },
        Wirecloud: {
            Widget,
            contextManager: { getAvailableContext: () => ({}), get: () => null },
            io: { buildProxyURL: () => '', makeRequest: () => Promise.resolve({}) },
            PreferenceDoesNotExistError: class PreferenceDoesNotExistError extends Error {},
            wiring: {
                EndpointDoesNotExistError: class EndpointDoesNotExistError extends Error {},
                EndpointTypeError: class EndpointTypeError extends Error {},
                EndpointValueError: class EndpointValueError extends Error {},
            }
        },
    };

    global.MashupPlatform = {
        priv: {
            workspaceview: {
                model: { contextManager: { getAvailableContext: () => ({}), get: () => null } }
            },
            resource,
        },
        mashup: {},
    };
    global.window.parent = platform;

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudAPICommon.js');
    assert.equal(global.MashupPlatform.location, 'https://host.example/a/b/c/d/e');
    assert.equal(calls.includes('error'), true);
});
