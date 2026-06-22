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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ContextManager.js');
});

test('ContextManager throws with invalid context_description', () => {
    assert.throws(
        () => new Wirecloud.ContextManager({}, null),
        /invalid context_description parameter/
    );
    assert.throws(
        () => new Wirecloud.ContextManager({}, 'not-object'),
        /invalid context_description parameter/
    );
});

test('ContextManager constructor builds context', () => {
    const cm = new Wirecloud.ContextManager({ id: 'instance' }, {
        title: { label: 'Title', description: 'Title desc', value: 'My Title' },
        visible: { label: 'Visible', description: 'Visibility', value: true }
    });

    assert.equal(cm.instance.id, 'instance');
    assert.equal(cm.get('title'), 'My Title');
    assert.equal(cm.get('visible'), true);
});

test('ContextManager get returns null for key without value', () => {
    const cm = new Wirecloud.ContextManager({}, {
        status: { label: 'Status', description: 'Status' }
    });

    assert.equal(cm.get('status'), null);
});

test('ContextManager getAvailableContext returns frozen description', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'v' }
    });

    const available = cm.getAvailableContext();
    assert.ok(available.title);
    assert.equal(available.title.name, 'title');
    assert.equal(Object.isFrozen(available.title), true);
});

test('ContextManager addCallback adds callback', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'v' }
    });

    let called = false;
    cm.addCallback(() => { called = true; });

    cm.modify({ title: 'new' });
    assert.equal(called, true);
});

test('ContextManager addCallback rejects non-function', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'v' }
    });
    assert.throws(() => cm.addCallback('not-function'), TypeError);
});

test('ContextManager removeCallback removes callback', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'v' }
    });

    let called = false;
    const cb = () => { called = true; };
    cm.addCallback(cb);
    cm.removeCallback(cb);

    cm.modify({ title: 'new' });
    assert.equal(called, false);
});

test('ContextManager removeCallback rejects non-function', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'v' }
    });
    assert.throws(() => cm.removeCallback('not-function'), TypeError);
});

test('ContextManager removeCallback with unregistered callback is no-op', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'v' }
    });
    assert.doesNotThrow(() => cm.removeCallback(() => {}));
});

test('ContextManager modify throws on non-object', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'v' }
    });
    assert.throws(() => cm.modify('string'), TypeError);
});

test('ContextManager modify throws on unknown key', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'v' }
    });
    assert.throws(() => cm.modify({ unknown: 'val' }), /unknown/);
});

test('ContextManager modify updates values', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'old' }
    });

    cm.modify({ title: 'new-title' });
    assert.equal(cm.get('title'), 'new-title');
});

test('ContextManager modify with no change does not call handlers', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'old' }
    });

    let called = false;
    cm.addCallback(() => { called = true; });

    cm.modify({ title: 'old' });
    assert.equal(called, false);
});

test('ContextManager modify handler errors are swallowed', () => {
    const cm = new Wirecloud.ContextManager({}, {
        title: { label: 'T', description: 'D', value: 'old' },
        count: { label: 'C', description: 'C', value: 0 }
    });

    let secondCalled = false;
    cm.addCallback(() => { throw new Error('fail'); });
    cm.addCallback(() => { secondCalled = true; });

    cm.modify({ count: 1 });
    assert.equal(secondCalled, true);
});

test('ContextManager constructor deletes non-object entries then throws', () => {
    // The code deletes non-object keys but then tries to access .name on the
    // deleted entry, which throws.
    assert.throws(
        () => new Wirecloud.ContextManager({}, {
            title: { label: 'T', description: 'D', value: 'v' },
            concept: 'not-an-object'
        }),
        TypeError
    );
});


