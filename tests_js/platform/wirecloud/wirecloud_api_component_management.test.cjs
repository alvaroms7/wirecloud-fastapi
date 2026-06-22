const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLegacyScript, resetLegacyRuntime } = require('../../support/legacy-runtime.cjs');

const setupComponentManagement = () => {
    if (global.Wirecloud == null) global.Wirecloud = {};
    global._privs = {};
    Wirecloud.LocalCatalogue = {
        resources: {},
        resourceVersions: {},
        addComponent: () => Promise.resolve(),
        getResource: () => null,
        getResourceId: () => null,
        resourceExistsId: () => false,
        deleteResource: () => ({ then: (cb) => cb(), catch: () => {} })
    };
};

test('_ComponentManagementAPI install calls LocalCatalogue.addComponent', () => {
    setupComponentManagement();
    let installed = null;
    Wirecloud.LocalCatalogue.addComponent = (options) => {
        installed = options;
        return Promise.resolve();
    };
    const fn = function _ComponentManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const install = function install(options) { return Wirecloud.LocalCatalogue.addComponent(options); };
        const uninstall = function uninstall(vendor, name, version) {
            if (vendor == null) throw new TypeError("missing vendor parameter");
            if (name == null) throw new TypeError("missing name parameter");
            return new Promise(function (resolve) { resolve(); });
        };
        const isInstalled = function isInstalled(vendor, name, version) {
            if (version !== null) {
                return Wirecloud.LocalCatalogue.resourceExistsId([vendor, name, version].join('/'));
            } else {
                const mac = [vendor, name].join('/');
                const versions = Wirecloud.LocalCatalogue.resourceVersions[mac];
                return versions != null && versions.length > 0;
            }
        };
        parent.MashupPlatform.components = {};
        Object.defineProperties(parent.MashupPlatform.components, {
            install: {value: install},
            uninstall: {value: uninstall},
            isInstalled: {value: isInstalled}
        });
    };
    const platform = { Wirecloud };
    const parent = { MashupPlatform: {} };
    fn(parent, platform);
    parent.MashupPlatform.components.install({ url: 'http://example.com/widget.wgt' });
    assert.deepEqual(installed, { url: 'http://example.com/widget.wgt' });
});

test('_ComponentManagementAPI uninstall - missing params', () => {
    setupComponentManagement();
    const fn = function _ComponentManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const uninstall = function uninstall(vendor, name, version) {
            if (vendor == null) throw new TypeError("missing vendor parameter");
            if (name == null) throw new TypeError("missing name parameter");
        };
        parent.MashupPlatform.components = {};
        Object.defineProperties(parent.MashupPlatform.components, { uninstall: {value: uninstall} });
    };
    const parent = { MashupPlatform: {} };
    fn(parent, { Wirecloud });
    assert.throws(() => parent.MashupPlatform.components.uninstall(null, 'name'), /missing vendor/);
    assert.throws(() => parent.MashupPlatform.components.uninstall('vendor', null), /missing name/);
});

test('_ComponentManagementAPI uninstall - with version, component found', () => {
    setupComponentManagement();
    let deletedComponent = null;
    let deletedOptions = null;
    Wirecloud.LocalCatalogue.getResource = (v, n, ver) => ({ vendor: v, name: n, version: ver });
    Wirecloud.LocalCatalogue.deleteResource = (comp, opts) => {
        deletedComponent = comp;
        deletedOptions = opts;
        return { then: (cb) => { cb(); return { catch: () => {} }; } };
    };
    const fn = function _ComponentManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const uninstall = function uninstall(vendor, name, version) {
            if (vendor == null) throw new TypeError("missing vendor parameter");
            if (name == null) throw new TypeError("missing name parameter");
            return new Promise(function (resolve) {
                let component;
                const options = {};
                if (version) {
                    component = Wirecloud.LocalCatalogue.getResource(vendor, name, version);
                }
                if (component) {
                    Wirecloud.LocalCatalogue.deleteResource(component, options).then(resolve.bind(null, undefined));
                } else {
                    resolve();
                }
            });
        };
        parent.MashupPlatform.components = {};
        Object.defineProperties(parent.MashupPlatform.components, { uninstall: {value: uninstall} });
    };
    const parent = { MashupPlatform: {} };
    fn(parent, { Wirecloud });
    parent.MashupPlatform.components.uninstall('v', 'n', '1.0');
    assert.ok(deletedComponent);
});

test('_ComponentManagementAPI uninstall - no version, all versions', () => {
    setupComponentManagement();
    let deletedOptions = null;
    Wirecloud.LocalCatalogue.resourceVersions = { 'v/n': [{ vendor: 'v', name: 'n', version: '1.0' }] };
    Wirecloud.LocalCatalogue.deleteResource = (comp, opts) => {
        deletedOptions = opts;
        return { then: (cb) => { cb(); return { catch: () => {} }; } };
    };
    const fn = function _ComponentManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const uninstall = function uninstall(vendor, name, version) {
            if (vendor == null) throw new TypeError("missing vendor parameter");
            if (name == null) throw new TypeError("missing name parameter");
            return new Promise(function (resolve) {
                let component;
                const options = {};
                if (version) {
                    component = Wirecloud.LocalCatalogue.getResource(vendor, name, version);
                } else {
                    component = Wirecloud.LocalCatalogue.resourceVersions[[vendor, name].join('/')][0];
                    options.allVersions = true;
                }
                if (component) {
                    Wirecloud.LocalCatalogue.deleteResource(component, options).then(resolve.bind(null, undefined));
                } else {
                    resolve();
                }
            });
        };
        parent.MashupPlatform.components = {};
        Object.defineProperties(parent.MashupPlatform.components, { uninstall: {value: uninstall} });
    };
    const parent = { MashupPlatform: {} };
    fn(parent, { Wirecloud });
    parent.MashupPlatform.components.uninstall('v', 'n');
    assert.equal(deletedOptions.allVersions, true);
});

test('_ComponentManagementAPI isInstalled', () => {
    setupComponentManagement();
    Wirecloud.LocalCatalogue.resources = { 'v/n/1.0': { vendor: 'v', name: 'n', version: '1.0' } };
    Wirecloud.LocalCatalogue.resourceVersions = { 'v/n': [{}, {}] };
    Wirecloud.LocalCatalogue.resourceExistsId = (id) => id in Wirecloud.LocalCatalogue.resources;
    const fn = function _ComponentManagementAPI(parent, platform) {
        const Wirecloud = platform.Wirecloud;
        const isInstalled = function isInstalled(vendor, name, version) {
            if (version !== null) {
                return Wirecloud.LocalCatalogue.resourceExistsId([vendor, name, version].join('/'));
            } else {
                const mac = [vendor, name].join('/');
                const versions = Wirecloud.LocalCatalogue.resourceVersions[mac];
                return versions != null && versions.length > 0;
            }
        };
        parent.MashupPlatform.components = {};
        Object.defineProperties(parent.MashupPlatform.components, { isInstalled: {value: isInstalled} });
    };
    const parent = { MashupPlatform: {} };
    fn(parent, { Wirecloud });
    assert.equal(parent.MashupPlatform.components.isInstalled('v', 'n', '1.0'), true);
    assert.equal(parent.MashupPlatform.components.isInstalled('v', 'n', '2.0'), false);
    assert.equal(parent.MashupPlatform.components.isInstalled('v', 'n', null), true);
    assert.equal(parent.MashupPlatform.components.isInstalled('v', 'nonexist', null), false);
});

const setupRealComponentManagement = () => {
    resetLegacyRuntime();
    global._privs = {};
    global.window.parent = global.window;
    global.Wirecloud = {};

    const calls = {
        added: [],
        deleted: [],
    };

    const component = { vendor: 'vendor', name: 'name', version: '1.0' };
    global.Wirecloud.LocalCatalogue = {
        resourceVersions: {
            'vendor/name': [component],
            'empty/name': [],
        },
        addComponent(options) {
            calls.added.push(options);
            return Promise.resolve('added');
        },
        getResource(vendor, name, version) {
            return vendor === 'vendor' && name === 'name' && version === '1.0' ? component : null;
        },
        resourceExistsId(id) {
            return id === 'vendor/name/1.0';
        },
        deleteResource(resource, options) {
            calls.deleted.push({ resource, options });
            return Promise.resolve('deleted');
        }
    };

    const parent = { MashupPlatform: {} };
    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/ComponentManagementAPI.js');
    window._privs._ComponentManagementAPI(parent, { Wirecloud: global.Wirecloud });
    return { calls, component, parent };
};

test('_ComponentManagementAPI production implementation covers install and uninstall paths', async () => {
    const { calls, component, parent } = setupRealComponentManagement();
    const api = parent.MashupPlatform.components;

    assert.equal(await api.install({ url: 'https://example.test/widget.wgt' }), 'added');
    assert.deepEqual(calls.added, [{ url: 'https://example.test/widget.wgt' }]);

    assert.throws(() => api.uninstall(null, 'name'), /missing vendor parameter/);
    assert.throws(() => api.uninstall('vendor', null), /missing name parameter/);

    await api.uninstall('vendor', 'name', '1.0');
    assert.deepEqual(calls.deleted[0], { resource: component, options: {} });

    await api.uninstall('vendor', 'name');
    assert.deepEqual(calls.deleted[1], { resource: component, options: { allVersions: true } });

    await api.uninstall('missing', 'name', '1.0');
    assert.equal(calls.deleted.length, 2);

    assert.equal(api.isInstalled('vendor', 'name', '1.0'), true);
    assert.equal(api.isInstalled('vendor', 'name', '2.0'), false);
    assert.equal(api.isInstalled('vendor', 'name', null), true);
    assert.equal(api.isInstalled('empty', 'name', null), false);
});

test('_ComponentManagementAPI production implementation propagates delete failures', async () => {
    const { parent } = setupRealComponentManagement();
    const expected = new Error('delete failed');
    global.Wirecloud.LocalCatalogue.deleteResource = () => Promise.reject(expected);

    await assert.rejects(
        parent.MashupPlatform.components.uninstall('vendor', 'name', '1.0'),
        expected
    );
});

test('_ComponentManagementAPI auto-initializes when loaded inside an iframe', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.MashupPlatform = {};
    global.window.parent = {
        Wirecloud: {
            LocalCatalogue: {
                resourceVersions: { 'vendor/name': [{}] },
                addComponent: () => Promise.resolve(),
                getResource: () => null,
                resourceExistsId: () => true,
                deleteResource: () => Promise.resolve(),
            }
        }
    };

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/ComponentManagementAPI.js');
    assert.equal(typeof global.MashupPlatform.components.install, 'function');
});
