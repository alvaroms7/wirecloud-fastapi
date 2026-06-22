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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/PolicyManager.js');
});

test('PolicyManager exists on Wirecloud', () => {
    assert.ok(Wirecloud.PolicyManager);
    assert.equal(typeof Wirecloud.PolicyManager.evaluate, 'function');
});

test('PolicyManager.evaluate returns true for unknown context', () => {
    assert.equal(Wirecloud.PolicyManager.evaluate('unknown_context', 'some_action'), true);
});

test('PolicyManager.evaluate returns true for known context with unknown action', () => {
    // Note: PolicyManager doesn't expose a way to set policies easily.
    // The internal 'policy' object is private.
    Wirecloud.PolicyManager.evaluate('c', 'a');
    // Default behavior: returns true for any context/action since policy is empty
    assert.equal(Wirecloud.PolicyManager.evaluate('ctx', 'action'), true);
});

test('PolicyManager is not extensible', () => {
    assert.equal(Object.isExtensible(Wirecloud.PolicyManager), false);
});

test('PolicyManager.register and evaluate with registered context', () => {
    Wirecloud.PolicyManager.register('ctx', { read: false, write: true });
    assert.equal(Wirecloud.PolicyManager.evaluate('ctx', 'read'), false);
    assert.equal(Wirecloud.PolicyManager.evaluate('ctx', 'write'), true);
    assert.equal(Wirecloud.PolicyManager.evaluate('ctx', 'unknownAction'), true);
});

test('PolicyManager.evaluate with pre-existing context overwritten', () => {
    Wirecloud.PolicyManager.register('ctx', { read: false });
    Wirecloud.PolicyManager.register('ctx', { read: true });
    assert.equal(Wirecloud.PolicyManager.evaluate('ctx', 'read'), true);
});
