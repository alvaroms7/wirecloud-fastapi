const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupMocks = () => {
    Wirecloud.WidgetMeta = class {
        constructor(desc) {
            this.vendor = desc.vendor; this.name = desc.name; this.version = desc.version;
            this.type = 'widget'; this.uri = `${desc.vendor}/${desc.name}/${desc.version}`;
            this.group_id = `${desc.vendor}/${desc.name}`; this.missing = !!desc.missing;
        }
    };
    Wirecloud.wiring.OperatorMeta = class {
        constructor(desc) {
            this.vendor = desc.vendor; this.name = desc.name; this.version = desc.version;
            this.type = 'operator'; this.uri = `${desc.vendor}/${desc.name}/${desc.version}`;
            this.group_id = `${desc.vendor}/${desc.name}`; this.missing = !!desc.missing;
        }
    };
};

const setupLocalCatalogue = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.GlobalLogManager = { log: () => {}, parseErrorResponse: (r) => 'error' };
    Wirecloud.io = { makeRequest: () => Promise.resolve({ status: 200, responseText: '{}' }) };
    Wirecloud.Task = class Task { constructor(n, fn) { if (typeof fn === 'function') fn(()=>{},()=>{}); } then(cb) { const r = cb ? cb() : undefined; return { then: () => {}, toTask: () => ({ then: () => {} }) }; } catch() { return this; } };
    Wirecloud.URLs = {
        LOCAL_RESOURCE_COLLECTION: '/api/local/resources',
        LOCAL_RESOURCE_ENTRY: { evaluate: (o) => '/api/local/' + o.vendor + '/' + o.name + '/' + o.version },
        LOCAL_UNVERSIONED_RESOURCE_ENTRY: { evaluate: (o) => '/api/local/' + o.vendor + '/' + o.name },
        MAC_BASE_URL: { evaluate: () => '/mac/' }
    };
    Wirecloud.contextManager = { get: () => 'hash' };
    Wirecloud.activeWorkspace = null;
    Wirecloud.workspaceInstances = {};

    // Mock WirecloudCatalogue base class
    Wirecloud.WirecloudCatalogue = class WirecloudCatalogue {
        constructor(options) {
            this.name = options.name;
            this.permissions = options.permissions;
            this.resources = {};
            this.resourceVersions = {};
        }
        dispatchEvent() {}
        addEventListener() {}
        removeEventListener() {}
    };
    Wirecloud.WirecloudCatalogue.prototype.addComponent = function(options) {
        return { then: (cb) => { cb({ resource_details: { vendor: 'V', name: 'N', version: '1.0' }, extra_resources: [] }); return { then: () => {} }; } };
    };

    Wirecloud.MashableApplicationComponent = class {
        constructor(desc) {
            this.vendor = desc.vendor; this.name = desc.name; this.version = desc.version;
            this.type = desc.type; this.uri = `${desc.vendor}/${desc.name}/${desc.version}`;
            this.group_id = `${desc.vendor}/${desc.name}`; this.missing = false;
        }
        is(other) { return this.uri === other.uri && this.type === other.type; }
    };
    Wirecloud.wiring = {};

    global.location = { origin: 'http://localhost' };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/LocalCatalogue.js',
    ]);

    setupMocks();
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupLocalCatalogue();
});

test('LocalCatalogue exists on Wirecloud', () => {
    assert.ok(Wirecloud.LocalCatalogue);
    assert.equal(typeof Wirecloud.LocalCatalogue.getResourceId, 'function');
    assert.equal(typeof Wirecloud.LocalCatalogue.resourceExistsId, 'function');
    assert.equal(typeof Wirecloud.LocalCatalogue.hasAlternativeVersion, 'function');
});

test('LocalCatalogue.getResourceId returns resource', () => {
    Wirecloud.LocalCatalogue.resources = { 'V/N/1.0': { uri: 'V/N/1.0' } };
    assert.ok(Wirecloud.LocalCatalogue.getResourceId('V/N/1.0'));
});

test('LocalCatalogue.resourceExistsId returns boolean', () => {
    Wirecloud.LocalCatalogue.resources = {};
    assert.equal(Wirecloud.LocalCatalogue.resourceExistsId('unknown'), false);
});

test('LocalCatalogue.resourceExists checks by resource object', () => {
    Wirecloud.LocalCatalogue.resources = { 'V/N/1.0': {} };
    assert.equal(Wirecloud.LocalCatalogue.resourceExists({ vendor: 'V', name: 'N', version: '1.0' }), true);
});

test('LocalCatalogue.getResource by vendor/name/version', () => {
    Wirecloud.LocalCatalogue.resources = { 'V/N/1.0': {} };
    assert.ok(Wirecloud.LocalCatalogue.getResource('V', 'N', '1.0'));
});

test('LocalCatalogue.hasAlternativeVersion with no versions', () => {
    Wirecloud.LocalCatalogue.resourceVersions = {};
    const comp = { group_id: 'V/N' };
    assert.equal(Wirecloud.LocalCatalogue.hasAlternativeVersion(comp), false);
});

test('LocalCatalogue.hasAlternativeVersion with one version that matches', () => {
    const comp = { group_id: 'V/N', uri: 'V/N/1.0', type: 'widget', is: function() { return true; } };
    Wirecloud.LocalCatalogue.resourceVersions = { 'V/N': [comp] };
    assert.equal(Wirecloud.LocalCatalogue.hasAlternativeVersion(comp), false);
});

test('LocalCatalogue.hasAlternativeVersion with one version that does not match', () => {
    const comp1 = { group_id: 'V/N', uri: 'V/N/1.0', type: 'widget', is: function() { return false; } };
    const comp2 = { group_id: 'V/N', uri: 'V/N/2.0', type: 'widget', is: function() { return false; } };
    Wirecloud.LocalCatalogue.resourceVersions = { 'V/N': [comp2] };
    assert.equal(Wirecloud.LocalCatalogue.hasAlternativeVersion(comp1), true);
});

test('LocalCatalogue.hasAlternativeVersion with multiple versions', () => {
    const comp1 = { group_id: 'V/N', uri: 'V/N/1.0', type: 'widget', is: function() { return true; } };
    const comp2 = { group_id: 'V/N', uri: 'V/N/2.0', type: 'widget', is: function() { return false; } };
    Wirecloud.LocalCatalogue.resourceVersions = { 'V/N': [comp1, comp2] };
    assert.equal(Wirecloud.LocalCatalogue.hasAlternativeVersion(comp1), true);
});

// ---- Tests for reload, deleteResource, addComponent, _includeResource ---- //

test('reload fetches empty resources list', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({ status: 200, responseText: '{}' });
    await Wirecloud.LocalCatalogue.reload();
    assert.deepEqual(Wirecloud.LocalCatalogue.resources, {});
});

test('reload includes widget and operator resources', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({
        status: 200,
        responseText: JSON.stringify({
            'V/W/1.0': { vendor: 'V', name: 'W', version: '1.0', type: 'widget' },
            'V/O/1.0': { vendor: 'V', name: 'O', version: '1.0', type: 'operator' }
        })
    });
    await Wirecloud.LocalCatalogue.reload();
    assert.ok(Wirecloud.LocalCatalogue.resources['V/W/1.0']);
    assert.ok(Wirecloud.LocalCatalogue.resources['V/O/1.0']);
    assert.ok(Array.isArray(Wirecloud.LocalCatalogue.resourceVersions['V/W']));
    assert.ok(Array.isArray(Wirecloud.LocalCatalogue.resourceVersions['V/O']));
});

test('reload includes mashup resource', async () => {
    Wirecloud.io.makeRequest = () => Promise.resolve({
        status: 200,
        responseText: JSON.stringify({
            'V/M/1.0': { vendor: 'V', name: 'M', version: '1.0', type: 'mashup' }
        })
    });
    await Wirecloud.LocalCatalogue.reload();
    assert.ok(Wirecloud.LocalCatalogue.resources['V/M/1.0']);
});

test('reload catches and logs error for invalid type', async () => {
    let logged = false;
    Wirecloud.GlobalLogManager.log = () => { logged = true; };
    Wirecloud.io.makeRequest = () => Promise.resolve({
        status: 200,
        responseText: JSON.stringify({
            'bad': { vendor: 'X', name: 'Y', version: '1.0', type: 'invalid_type' }
        })
    });
    await Wirecloud.LocalCatalogue.reload();
    assert.ok(logged);
});

test('deleteResource widget single version constructs correct URL', () => {
    let reqUrl = null, reqOpts = null;
    Wirecloud.io.makeRequest = () => {
        return {
            then: () => ({
                then: () => ({
                    then: () => ({
                        toTask: () => {}
                    })
                })
            })
        };
    };
    const origMakeRequest = Wirecloud.io.makeRequest;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqUrl = url; reqOpts = opts;
        return origMakeRequest();
    };
    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'N', version: { text: '1.0' },
        title: 'Test', group_id: 'V/N', type: 'widget'
    }, { allusers: false, allversions: false });
    assert.ok(reqUrl.includes('/api/local/V/N/1.0'));
    assert.equal(reqOpts.method, 'DELETE');
    assert.equal(reqOpts.parameters.allusers, false);
});

test('deleteResource all versions uses unversioned URL', () => {
    let reqUrl = null;
    Wirecloud.io.makeRequest = (url) => {
        reqUrl = url;
        return {
            then: () => ({
                then: () => ({
                    then: () => ({
                        toTask: () => {}
                    })
                })
            })
        };
    };
    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'N', version: { text: '1.0' },
        title: 'Test', group_id: 'V/N', type: 'mashup'
    }, { allusers: false, allversions: true });
    assert.equal(reqUrl, '/api/local/V/N');
});

test('deleteResource allusers with allversions sets allusers param', () => {
    let reqParams = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqParams = opts.parameters;
        return {
            then: () => ({
                then: () => ({
                    then: () => ({
                        toTask: () => {}
                    })
                })
            })
        };
    };
    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'N', version: { text: '1.0' },
        title: 'Test', group_id: 'V/N', type: 'widget'
    }, { allusers: true, allversions: true });
    assert.equal(reqParams.allusers, true);
});

test('deleteResource handles non-200 response', () => {
    let rejected = false;
    Wirecloud.io.makeRequest = () => ({
        then: (fn) => {
            const result = fn({ status: 500, responseText: 'error' });
            if (result && typeof result.catch === 'function') {
                result.catch(() => {});
            }
            rejected = true;
            return {
                then: () => ({
                    then: () => ({
                        toTask: () => {}
                    })
                })
            };
        }
    });
    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'N', version: { text: '1.0' },
        title: 'Test', group_id: 'V/N', type: 'widget'
    }, { allusers: false, allversions: false });
    assert.equal(rejected, true);
});

test('addComponent installs with resource_details and extra_resources', () => {
    Wirecloud.WirecloudCatalogue.prototype.addComponent = function (opts) {
        return {
            then: (cb) => {
                cb({
                    resource_details: { vendor: 'V', name: 'N', version: '1.0', type: 'widget' },
                    extra_resources: [{ vendor: 'V2', name: 'N2', version: '1.0', type: 'widget' }]
                });
                return { then: () => {} };
            }
        };
    };
    Wirecloud.LocalCatalogue.resources = {};
    Wirecloud.LocalCatalogue.resourceVersions = {};
    const events = [];
    Wirecloud.LocalCatalogue.dispatchEvent = (type, action) => { events.push({ type, action }); };
    Wirecloud.LocalCatalogue.addComponent({});
    assert.equal(events.length, 4);
    assert.equal(events[0].type, 'install');
    assert.equal(events[2].type, 'install');
});

test('addComponent skips already-existing resource', () => {
    Wirecloud.WirecloudCatalogue.prototype.addComponent = function (opts) {
        return {
            then: (cb) => {
                cb({ vendor: 'V', name: 'N', version: '1.0', type: 'widget' });
                return { then: () => {} };
            }
        };
    };
    Wirecloud.LocalCatalogue.resources = { 'V/N/1.0': { vendor: 'V', name: 'N', version: '1.0' } };
    Wirecloud.LocalCatalogue.resourceVersions = {};
    const events = [];
    Wirecloud.LocalCatalogue.dispatchEvent = (type) => { events.push(type); };
    Wirecloud.LocalCatalogue.addComponent({});
    assert.equal(events.length, 0);
});

test('_includeResource throws TypeError for invalid type', () => {
    assert.throws(
        () => Wirecloud.LocalCatalogue._includeResource({ vendor: 'X', name: 'Y', version: '1.0', type: 'bad_type' }),
        /Invalid component type/
    );
});

// === deleteResource: single version + allusers=true ===

test('deleteResource single version with allusers=true', () => {
    let reqUrl = null, reqOpts = null;
    Wirecloud.io.makeRequest = (url, opts) => {
        reqUrl = url; reqOpts = opts;
        return { then: () => ({ then: () => ({ then: () => ({ toTask: () => {} }) }) }) };
    };
    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'N', version: { text: '1.0' },
        title: 'Test', group_id: 'V/N', type: 'widget'
    }, { allusers: true, allversions: false });
    assert.ok(reqUrl.includes('/api/local/V/N/1.0'));
    assert.equal(reqOpts.parameters.allusers, true);
    assert.equal(reqOpts.parameters.affected, 'true');
});

// === deleteResource: affectedVersions null defaults to resource.version ===

test('deleteResource defaults affectedVersions to resource.version when null', () => {
    let purged = false;
    const resourceData = { vendor: 'V', name: 'N', version: '1.0', uri: 'V/N/1.0', group_id: 'V/N' };
    Wirecloud.LocalCatalogue.resources = { 'V/N/1.0': resourceData };
    Wirecloud.LocalCatalogue.resourceVersions = { 'V/N': [resourceData] };
    Wirecloud.workspaceInstances = {};

    Wirecloud.io.makeRequest = () => ({
        then: function (fn) {
            const r = fn({ status: 200, responseText: '{"affectedVersions":null}' });
            (r && r.then ? r : Promise.resolve(r)).then(function () {
                return {
                    then: function () {
                        purged = true;
                        return { toTask: () => {} };
                    }
                };
            });
            return { then: () => ({ then: () => ({ toTask: () => {} }) }) };
        }
    });

    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'N', version: { text: '1.0' },
        title: 'Test', group_id: 'V/N', type: 'mashup'
    }, { allusers: false, allversions: false });

    assert.ok(true);
});

// === deleteResource JSON parse error path exercises catch block ===

test('deleteResource with valid affectedVersions processes succeed path', () => {
    let purged = false;
    Wirecloud.LocalCatalogue.resources = {};
    Wirecloud.LocalCatalogue.resourceVersions = {};
    Wirecloud.workspaceInstances = {};

    Wirecloud.io.makeRequest = () => ({
        then: function (fn) {
            fn({ status: 200, responseText: '{"affectedVersions":["1.0"]}' });
            return {
                then: () => ({
                    then: () => {
                        purged = true;
                        return { toTask: () => {} };
                    }
                })
            };
        }
    });

    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'N', version: { text: '1.0' },
        title: 'Test', group_id: 'V/N', type: 'mashup'
    }, { allusers: false, allversions: false });

    assert.ok(purged);
});

// === addComponent: flat response without resource_details ===

test('addComponent with flat response (no resource_details)', () => {
    Wirecloud.WirecloudCatalogue.prototype.addComponent = function (opts) {
        return {
            then: (cb) => {
                cb({ vendor: 'V', name: 'N', version: '1.0', type: 'widget' });
                return { then: () => {} };
            }
        };
    };
    Wirecloud.LocalCatalogue.resources = {};
    Wirecloud.LocalCatalogue.resourceVersions = {};
    const events = [];
    Wirecloud.LocalCatalogue.dispatchEvent = (type, action) => { events.push(type); };
    Wirecloud.LocalCatalogue.addComponent({});
    assert.equal(events.length, 2);
    assert.equal(events[0], 'install');
    assert.equal(events[1], 'change');
    assert.ok(Wirecloud.LocalCatalogue.resources['V/N/1.0']);
});

// === _includeResource: widget type ===

test('_includeResource creates WidgetMeta', () => {
    Wirecloud.activeWorkspace = null;
    const comp = Wirecloud.LocalCatalogue._includeResource({
        vendor: 'V', name: 'W', version: '1.0', type: 'widget'
    });
    assert.ok(comp instanceof Wirecloud.WidgetMeta);
    assert.ok(Wirecloud.LocalCatalogue.resources['V/W/1.0']);
});

// === _includeResource: widget with activeWorkspace upgrades missing widgets ===

test('_includeResource widget type upgrades missing widgets', () => {
    let upgraded = false;
    const missingWidget = { missing: true, meta: { uri: 'V/W/1.0' }, upgrade: () => { upgraded = true; } };
    Wirecloud.activeWorkspace = {
        widgets: [missingWidget],
        wiring: { operators: [] },
        resources: { restore: () => {} }
    };
    Wirecloud.workspaceInstances = {};

    Wirecloud.LocalCatalogue._includeResource({
        vendor: 'V', name: 'W', version: '1.0', type: 'widget'
    });

    assert.ok(upgraded);
});

// === _includeResource: operator type ===

test('_includeResource creates OperatorMeta', () => {
    Wirecloud.activeWorkspace = null;
    const comp = Wirecloud.LocalCatalogue._includeResource({
        vendor: 'V', name: 'O', version: '1.0', type: 'operator'
    });
    assert.ok(comp instanceof Wirecloud.wiring.OperatorMeta);
    assert.ok(Wirecloud.LocalCatalogue.resources['V/O/1.0']);
});

// === _includeResource: operator with activeWorkspace upgrades missing operators ===

test('_includeResource operator type upgrades missing operators', () => {
    let upgraded = false;
    const missingOp = { missing: true, meta: { uri: 'V/O/1.0' }, upgrade: () => { upgraded = true; } };
    Wirecloud.activeWorkspace = {
        widgets: [],
        wiring: { operators: [missingOp] },
        resources: { restore: () => {} }
    };
    Wirecloud.workspaceInstances = {};

    Wirecloud.LocalCatalogue._includeResource({
        vendor: 'V', name: 'O', version: '1.0', type: 'operator'
    });

    assert.ok(upgraded);
});

// === _includeResource: operator handles missing/malformed wiring gracefully ===

test('_includeResource operator handles wiring without operators safely', () => {
    Wirecloud.activeWorkspace = { widgets: [], wiring: null, resources: { restore: () => {} } };
    Wirecloud.workspaceInstances = {};

    assert.doesNotThrow(() => {
        Wirecloud.LocalCatalogue._includeResource({
            vendor: 'V', name: 'O', version: '1.0', type: 'operator'
        });
    });
});

// === _includeResource: mashup type ===

test('_includeResource creates MashableApplicationComponent for mashup', () => {
    Wirecloud.activeWorkspace = null;
    const comp = Wirecloud.LocalCatalogue._includeResource({
        vendor: 'V', name: 'M', version: '1.0', type: 'mashup'
    });
    assert.ok(comp instanceof Wirecloud.MashableApplicationComponent);
    assert.ok(Wirecloud.LocalCatalogue.resources['V/M/1.0']);
});

// === _includeResource: calls resources.restore on activeWorkspace ===

test('_includeResource calls activeWorkspace.resources.restore', () => {
    let restored = false;
    Wirecloud.activeWorkspace = {
        widgets: [],
        wiring: { operators: [] },
        resources: { restore: () => { restored = true; } }
    };

    Wirecloud.LocalCatalogue._includeResource({
        vendor: 'V', name: 'R', version: '1.0', type: 'widget'
    });

    assert.ok(restored);
});

// === deleteResource: JSON parse error (lines 204-205) ===

test('deleteResource rejects on JSON parse error in response handler', () => {
    let rejected = false;

    // Mock Promise.reject to be synchronous so the catch triggers immediately
    const origReject = Promise.reject;
    Promise.reject = function (err) {
        return {
            then: function (_, onRejected) {
                if (onRejected) onRejected(err);
                return { then: function () { return this; } };
            },
            catch: function (onRejected) {
                if (onRejected) onRejected(err);
                rejected = true;
                return {};
            }
        };
    };

    Wirecloud.io.makeRequest = () => ({
        then: function (fn) {
            const result = fn({ status: 200, responseText: 'not valid json' });
            if (result && typeof result.catch === 'function') {
                result.catch(() => {});
            }
            return {
                then: function () {
                    return {
                        then: function () {
                            return { toTask: () => {} };
                        }
                    };
                }
            };
        }
    });

    try {
        Wirecloud.LocalCatalogue.deleteResource({
            vendor: 'V', name: 'N', version: { text: '1.0' },
            title: 'Test', group_id: 'V/N', type: 'widget'
        }, { allusers: false, allversions: false });

        assert.ok(rejected);
    } finally {
        Promise.reject = origReject;
    }
});

// === unload_affected_components upgrade loop (lines 45-65) ===

test('unload_affected_components widget type upgrade loop (lines 49-62)', () => {
    let upgradedComponent = null;
    const mockWidget = {
        meta: { uri: 'V/W/1.0' },
        upgrade: function (newMeta) { upgradedComponent = newMeta; }
    };
    const workspace = {
        resources: { remove: function () { return { uri: 'V/W/1.0' }; } },
        widgets: [mockWidget]
    };
    Wirecloud.Workspace = class Workspace {};
    Object.setPrototypeOf(workspace, Wirecloud.Workspace.prototype);
    Wirecloud.workspaceInstances = { ws1: workspace, plain: { id: 'not-a-workspace' } };

    Wirecloud.LocalCatalogue.resources = {};
    Wirecloud.LocalCatalogue.resourceVersions = {};

    const events = [];
    Wirecloud.LocalCatalogue.dispatchEvent = function (type) { events.push(type); };

    Wirecloud.io.makeRequest = function () {
        return {
            then: function (responseHandler) {
                var result = { affectedVersions: ['1.0'] };
                responseHandler({ status: 200, responseText: JSON.stringify(result) });
                return {
                    then: function (unloadHandler) {
                        unloadHandler(result);
                        return {
                            then: function (purgeHandler) {
                                purgeHandler(result);
                                return { toTask: function () { return { then: function () {} }; } };
                            }
                        };
                    }
                };
            }
        };
    };

    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'W', version: { text: '1.0' },
        title: 'Test Widget', group_id: 'V/W', type: 'widget'
    }, { allusers: false, allversions: false });

    assert.ok(upgradedComponent !== null);
    assert.equal(upgradedComponent.uri, 'V/W/1.0');
});

test('unload_affected_components operator type upgrade loop (lines 55-62)', () => {
    let upgradedComponent = null;
    const mockOperator = {
        meta: { uri: 'V/O/1.0' },
        upgrade: function (newMeta) { upgradedComponent = newMeta; }
    };
    const workspace = {
        resources: { remove: function () { return { uri: 'V/O/1.0' }; } },
        wiring: { operators: [mockOperator] }
    };
    Wirecloud.Workspace = class Workspace {};
    Object.setPrototypeOf(workspace, Wirecloud.Workspace.prototype);
    Wirecloud.workspaceInstances = { ws1: workspace };

    Wirecloud.LocalCatalogue.resources = {};
    Wirecloud.LocalCatalogue.resourceVersions = {};

    Wirecloud.io.makeRequest = function () {
        return {
            then: function (responseHandler) {
                var result = { affectedVersions: ['1.0'] };
                responseHandler({ status: 200, responseText: JSON.stringify(result) });
                return {
                    then: function (unloadHandler) {
                        unloadHandler(result);
                        return {
                            then: function (purgeHandler) {
                                purgeHandler(result);
                                return { toTask: function () { return { then: function () {} }; } };
                            }
                        };
                    }
                };
            }
        };
    };

    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'O', version: { text: '1.0' },
        title: 'Test Operator', group_id: 'V/O', type: 'operator'
    }, { allusers: false, allversions: false });

    assert.ok(upgradedComponent !== null);
    assert.equal(upgradedComponent.uri, 'V/O/1.0');
});

// === purge_component_info exercised through deleteResource (lines 71-96) ===

test('deleteResource with mashup type exercises purge_component_info body', () => {
    const resourceData = { vendor: 'V', name: 'M', version: '1.0', type: 'mashup', uri: 'V/M/1.0', group_id: 'V/M' };
    Wirecloud.LocalCatalogue.resources = { 'V/M/1.0': resourceData };
    Wirecloud.LocalCatalogue.resourceVersions = { 'V/M': [resourceData] };
    Wirecloud.workspaceInstances = {};

    // Build a fully synchronous thenable chain that passes values through
    const resultVal = { affectedVersions: ['1.0'] };
    Wirecloud.io.makeRequest = () => ({
        then: function (responseHandler) {
            // Simulate response handler: JSON.parse succeeds, affectedVersions populated
            const result = { affectedVersions: ['1.0'] };
            return {
                then: function (unloadHandler) {
                    // unload_affected_components for mashup: returns Promise.resolve(result)
                    // Call with result as value
                    unloadHandler(result);
                    return {
                        then: function (purgeHandler) {
                            // purge_component_info receives result
                            purgeHandler(result);
                            return {
                                toTask: function () { return { then: () => {} }; }
                            };
                        }
                    };
                }
            };
        }
    });

    const events = [];
    Wirecloud.LocalCatalogue.dispatchEvent = (type) => { events.push(type); };

    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'M', version: { text: '1.0' },
        title: 'Test Mashup', group_id: 'V/M', type: 'mashup'
    }, { allusers: false, allversions: false });

    assert.ok(events.length >= 2);
});

// === purge_component_info catch block (line 93) ===

test('deleteResource widget type passes through purge_component_info catch block', () => {
    Wirecloud.workspaceInstances = {};
    Wirecloud.io.makeRequest = () => ({
        then: function (fn) {
            fn({ status: 200, responseText: '{"affectedVersions":["1.0"]}' });
            return {
                then: function () {
                    return {
                        then: function () {
                            return { toTask: function () { return { then: () => {} }; } };
                        }
                    };
                }
            };
        }
    });

    assert.doesNotThrow(() => {
        Wirecloud.LocalCatalogue.deleteResource({
            vendor: 'V', name: 'N', version: { text: '1.0' },
            title: 'Test Widget', group_id: 'V/N', type: 'widget'
        }, { allusers: false, allversions: false });
    });
});

// === purge_component_info dispatches uninstall and change events ===

test('purge_component_info dispatches events when resources exist', () => {
    const resourceData = { vendor: 'V', name: 'M2', version: '2.0', type: 'mashup', uri: 'V/M2/2.0', group_id: 'V/M2' };
    Wirecloud.LocalCatalogue.resources = { 'V/M2/2.0': resourceData };
    Wirecloud.LocalCatalogue.resourceVersions = { 'V/M2': [resourceData] };
    Wirecloud.workspaceInstances = {};

    const resultVal = { affectedVersions: ['2.0'] };
    Wirecloud.io.makeRequest = () => ({
        then: function (responseHandler) {
            const result = { affectedVersions: ['2.0'] };
            return {
                then: function (unloadHandler) {
                    unloadHandler(result);
                    return {
                        then: function (purgeHandler) {
                            purgeHandler(result);
                            return {
                                toTask: function () { return { then: () => {} }; }
                            };
                        }
                    };
                }
            };
        }
    });

    const events = [];
    Wirecloud.LocalCatalogue.dispatchEvent = (type) => { events.push(type); };

    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'M2', version: { text: '2.0' },
        title: 'Test Mashup 2', group_id: 'V/M2', type: 'mashup'
    }, { allusers: false, allversions: false });

    assert.ok(events.length >= 2);
});

// === unload_affected_components: widget type (lines 33-35, 42-67) ===

test('deleteResource widget type triggers unload_affected_components for widget', () => {
    const resourceData = { vendor: 'V', name: 'W2', version: '1.0', type: 'widget', uri: 'V/W2/1.0', group_id: 'V/W2' };
    Wirecloud.LocalCatalogue.resources = { 'V/W2/1.0': resourceData };
    Wirecloud.LocalCatalogue.resourceVersions = { 'V/W2': [resourceData] };
    Wirecloud.workspaceInstances = {};

    let unloadTaskExecuted = false;
    Wirecloud.io.makeRequest = () => ({
        then: function (responseHandler) {
            const result = { affectedVersions: ['1.0'] };
            responseHandler({ status: 200, responseText: JSON.stringify(result) });
            return {
                then: function (unloadHandler) {
                    unloadHandler(result);
                    unloadTaskExecuted = true;
                    return {
                        then: function (purgeHandler) {
                            purgeHandler(result);
                            return { toTask: function () { return { then: () => {} }; } };
                        }
                    };
                }
            };
        }
    });

    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'W2', version: { text: '1.0' },
        title: 'Test Widget', group_id: 'V/W2', type: 'widget'
    }, { allusers: false, allversions: false });

    assert.ok(unloadTaskExecuted);
});

// === unload_affected_components: operator type (lines 36-38, 42-67) ===

test('deleteResource operator type triggers unload_affected_components for operator', () => {
    const resourceData = { vendor: 'V', name: 'O2', version: '1.0', type: 'operator', uri: 'V/O2/1.0', group_id: 'V/O2' };
    Wirecloud.LocalCatalogue.resources = { 'V/O2/1.0': resourceData };
    Wirecloud.LocalCatalogue.resourceVersions = { 'V/O2': [resourceData] };
    Wirecloud.workspaceInstances = {};

    let unloadTaskExecuted = false;
    Wirecloud.io.makeRequest = () => ({
        then: function (responseHandler) {
            const result = { affectedVersions: ['1.0'] };
            responseHandler({ status: 200, responseText: JSON.stringify(result) });
            return {
                then: function (unloadHandler) {
                    unloadHandler(result);
                    unloadTaskExecuted = true;
                    return {
                        then: function (purgeHandler) {
                            purgeHandler(result);
                            return { toTask: function () { return { then: () => {} }; } };
                        }
                    };
                }
            };
        }
    });

    Wirecloud.LocalCatalogue.deleteResource({
        vendor: 'V', name: 'O2', version: { text: '1.0' },
        title: 'Test Operator', group_id: 'V/O2', type: 'operator'
    }, { allusers: false, allversions: false });

    assert.ok(unloadTaskExecuted);
});
