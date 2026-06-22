const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const addMissingBrowserFeatures = () => {
    if (!global.EventSource) {
        global.EventSource = class EventSource {};
    }
    if (!global.customElements) {
        global.customElements = {};
    }
    if (!global.MutationObserver) {
        global.MutationObserver = class MutationObserver {};
    }
    if (!global.fetch) {
        global.fetch = () => Promise.resolve({});
    }
    if (!HTMLElement.prototype.attachShadow) {
        HTMLElement.prototype.attachShadow = () => ({});
    }
    // Ensure history API is available
    if (!global.window.history) {
        const doc = global.document;
        doc.defaultView.history = {
            pushState: () => {},
            replaceState: () => {}
        };
        global.window.history = doc.defaultView.history;
    }
    // Ensure pointerEvents style
    global.document.documentElement.style.pointerEvents = 'auto';
};

test.beforeEach(() => {
    resetLegacyRuntime();
    addMissingBrowserFeatures();
    bootstrapStyledElementsBase();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/BaseRequirements.js');
});

test('check_basic_requirements passes with all browser features available', () => {
    assert.doesNotThrow(() => Wirecloud.check_basic_requirements());
});

test('check_basic_requirements throws when JSON is missing', () => {
    const orig = global.JSON;
    try {
        delete global.JSON;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing JSON support/
        );
    } finally {
        global.JSON = orig;
    }
});

test('check_basic_requirements throws when Object.create is missing', () => {
    const orig = Object.create;
    try {
        delete Object.create;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing Object.create support/
        );
    } finally {
        Object.create = orig;
    }
});

test('check_basic_requirements throws when Object.defineProperty is missing', () => {
    const orig = Object.defineProperty;
    try {
        delete Object.defineProperty;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing Object.defineProperty support/
        );
    } finally {
        Object.defineProperty = orig;
    }
});

test('check_basic_requirements throws when Object.defineProperties is missing', () => {
    const orig = Object.defineProperties;
    try {
        delete Object.defineProperties;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing Object.defineProperties support/
        );
    } finally {
        Object.defineProperties = orig;
    }
});

test('check_basic_requirements throws when Promise is missing', () => {
    const orig = global.Promise;
    try {
        delete global.Promise;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing Promise support/
        );
    } finally {
        global.Promise = orig;
    }
});

test('check_basic_requirements throws when WeakMap is missing', () => {
    const orig = global.WeakMap;
    try {
        delete global.WeakMap;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing WeakMap support/
        );
    } finally {
        global.WeakMap = orig;
    }
});

test('check_basic_requirements throws when classList is missing', () => {
    const orig = document.documentElement.classList;
    try {
        // classList is an own property; delete removes it from the instance
        delete document.documentElement.classList;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing Element.classList support/
        );
    } finally {
        document.documentElement.classList = orig;
    }
});

test('check_basic_requirements throws when addEventListener is missing', () => {
    const dd = document.documentElement;
    const origProto = Object.getPrototypeOf(dd);
    try {
        Object.setPrototypeOf(dd, Node.prototype);
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing basic DOM event support/
        );
    } finally {
        Object.setPrototypeOf(dd, origProto);
    }
});

test('check_basic_requirements throws when fetch is missing', () => {
    const orig = global.fetch;
    try {
        delete global.fetch;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing Fetch API support/
        );
    } finally {
        global.fetch = orig;
    }
});

test('check_basic_requirements throws on arrow functions eval failure', () => {
    const origEval = global.eval;
    try {
        global.eval = () => { throw new SyntaxError('arrow functions not supported'); };
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing arrow functions support/
        );
    } finally {
        global.eval = origEval;
    }
});

test('check_basic_requirements throws when Object.freeze is missing', () => {
    const orig = Object.freeze;
    try {
        delete Object.freeze;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing Object.freeze support/
        );
    } finally {
        Object.freeze = orig;
    }
});

test('check_basic_requirements throws when history API is missing', () => {
    const origHistory = global.window.history;
    try {
        delete global.window.history;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing HTML5's history API support/
        );
    } finally {
        global.window.history = origHistory;
    }
});

test('check_basic_requirements throws when pointerEvents is missing', () => {
    const orig = document.documentElement.style.pointerEvents;
    try {
        delete document.documentElement.style.pointerEvents;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing pointer-events support/
        );
    } finally {
        document.documentElement.style.pointerEvents = orig;
    }
});

test('check_basic_requirements throws when EventSource is missing', () => {
    const orig = global.EventSource;
    try {
        delete global.EventSource;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing EventSource support/
        );
    } finally {
        global.EventSource = orig;
    }
});

test('check_basic_requirements throws when customElements is missing', () => {
    const hadFalse = 'false' in global.window;
    try {
        global.window.false = true;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing web components support/
        );
    } finally {
        if (!hadFalse) {
            delete global.window.false;
        }
    }
});

test('check_basic_requirements throws when attachShadow is missing', () => {
    const orig = HTMLElement.prototype.attachShadow;
    try {
        delete HTMLElement.prototype.attachShadow;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing shadow DOM support/
        );
    } finally {
        HTMLElement.prototype.attachShadow = orig;
    }
});

test('check_basic_requirements throws when MutationObserver is missing', () => {
    const orig = global.MutationObserver;
    try {
        delete global.MutationObserver;
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing MutationObserver support/
        );
    } finally {
        global.MutationObserver = orig;
    }
});

test('check_basic_requirements throws when Object.defineProperty lacks proper support', () => {
    const origDefineProperty = Object.defineProperty;
    try {
        Object.defineProperty = function () { throw new Error('not supported properly'); };
        assert.throws(
            () => Wirecloud.check_basic_requirements(),
            /Missing proper Object.defineProperty support/
        );
    } finally {
        Object.defineProperty = origDefineProperty;
    }
});
