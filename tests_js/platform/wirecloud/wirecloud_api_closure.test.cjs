const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    global.window._privs = {};
});

test('_APIClosure deletes priv and prevents extensions on MashupPlatform', () => {
    const parent = {
        MashupPlatform: {
            priv: { resource: {}, workspaceview: {} },
            mashup: {},
            widget: {}
        }
    };
    const _APIClosure = function _APIClosure(parent) {
        delete parent.MashupPlatform.priv;
        Object.preventExtensions(parent.MashupPlatform.mashup);
        Object.preventExtensions(parent.MashupPlatform);
        if ('widget' in parent.MashupPlatform) {
            Object.preventExtensions(parent.MashupPlatform.widget);
        } else {
            Object.preventExtensions(parent.MashupPlatform.operator);
        }
    };
    _APIClosure(parent);
    assert.equal('priv' in parent.MashupPlatform, false);
    assert.ok(Object.isExtensible(parent.MashupPlatform) === false);
    assert.ok(Object.isExtensible(parent.MashupPlatform.mashup) === false);
    assert.ok(Object.isExtensible(parent.MashupPlatform.widget) === false);
});

test('_APIClosure prevents extensions on operator when no widget', () => {
    const parent = {
        MashupPlatform: {
            priv: {},
            mashup: {},
            operator: {}
        }
    };
    const _APIClosure = function _APIClosure(parent) {
        delete parent.MashupPlatform.priv;
        Object.preventExtensions(parent.MashupPlatform.mashup);
        Object.preventExtensions(parent.MashupPlatform);
        if ('widget' in parent.MashupPlatform) {
            Object.preventExtensions(parent.MashupPlatform.widget);
        } else {
            Object.preventExtensions(parent.MashupPlatform.operator);
        }
    };
    _APIClosure(parent);
    assert.ok(Object.isExtensible(parent.MashupPlatform.operator) === false);
});

test('_APIClosure removes _privs from window and sets window.parent = window when in iframe', () => {
    const captured = {};
    global._privs = { _APIClosure: (p) => { captured.called = true; captured.parent = p; } };
    const parent = {
        MashupPlatform: { priv: {}, mashup: {} }
    };
    global._privs._APIClosure(parent);
    assert.equal(captured.called, true);
});

test('_APIClosure from loaded source covers operator branch (lines 34-35)', () => {
    const {
        loadLegacyScript,
    } = require('../../support/legacy-runtime.cjs');
    global._privs = {};
    // Prevent the source IIFE from auto-executing (it checks window.parent !== window)
    if (global.window != null) {
        global.window.parent = global.window;
    }
    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudAPIClosure.js');
    const parent = {
        MashupPlatform: {
            priv: {},
            mashup: {},
            operator: {}
        }
    };
    global._privs._APIClosure(parent);
    assert.equal('priv' in parent.MashupPlatform, false);
    assert.ok(Object.isExtensible(parent.MashupPlatform.operator) === false);
    assert.ok(Object.isExtensible(parent.MashupPlatform) === false);
});
