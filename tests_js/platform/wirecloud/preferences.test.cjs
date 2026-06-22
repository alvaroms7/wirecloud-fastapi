const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupPrefs = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.GlobalLogManager = {
        parseErrorResponse: (r) => r,
        log: () => {}
    };
    Wirecloud.ui = { InputInterfaceFactory: {
        parse: (type, value) => value,
        stringify: (type, value) => value
    }};

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/PlatformPref.js',
        'src/wirecloud/platform/static/js/wirecloud/Preferences.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupPrefs();
});

test('Preferences constructor throws without preferencesDef', () => {
    assert.throws(
        () => new Wirecloud.Preferences(null),
        /missing preferencesDef parameter/
    );
});

test('Preferences constructor with empty defaults', () => {
    const def = { preferences: {} };
    const prefs = new Wirecloud.Preferences(def);
    assert.equal(prefs.meta, def);
});

test('Preferences constructor builds PlatformPref with values', () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def, { theme: { value: 'dark', inherit: false } });

    assert.ok(prefs.preferences.theme instanceof Wirecloud.PlatformPref);
    assert.equal(prefs.preferences.theme.value, 'dark');
    assert.equal(prefs.preferences.theme.inherit, false);
});

test('Preferences constructor uses inheritByDefault when no values', () => {
    const def = {
        preferences: {
            lang: { name: 'lang', options: { type: 'text' }, default: 'en', inheritByDefault: true }
        }
    };
    const prefs = new Wirecloud.Preferences(def);

    assert.equal(prefs.preferences.lang.inherit, true);
    // Preferences is abstract, getParentValue is not defined.
    // PlatformPref stored the default as the value when no value given.
    assert.equal(prefs.preferences.lang.value, 'en');
});

test('Preferences get returns effective value', () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def, { theme: { value: 'dark', inherit: false } });

    assert.equal(prefs.get('theme'), 'dark');
});

test('Preferences get returns undefined for unknown preference', () => {
    const def = { preferences: {} };
    const prefs = new Wirecloud.Preferences(def);
    assert.equal(prefs.get('unknown'), undefined);
});

test('Preferences set with no changes returns resolved promise', async () => {
    const def = { preferences: {} };
    const prefs = new Wirecloud.Preferences(def);
    const result = await prefs.set({});
    assert.equal(result, undefined);
});

test('Preferences set with identical inherit skips that preference', async () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def, { theme: { value: 'light', inherit: false } });
    prefs.preferences.theme.inherit = false;

    prefs._build_save_url = () => '/api/prefs';
    Wirecloud.io = { makeRequest: (url, opts) => Promise.resolve({ status: 204 }) };

    // Setting inherit to the same value should not trigger persistence
    let preCommitFired = false;
    prefs.addEventListener('pre-commit', () => { preCommitFired = true; });

    await prefs.set({ theme: { inherit: false } });

    // pre-commit should NOT fire because nothing changed
    assert.equal(preCommitFired, false);
});

test('Preferences set with identical value skips that preference', async () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def, { theme: { value: 'dark', inherit: false } });
    prefs.preferences.theme.value = 'dark';

    prefs._build_save_url = () => '/api/prefs';
    Wirecloud.io = { makeRequest: (url, opts) => Promise.resolve({ status: 204 }) };

    let preCommitFired = false;
    prefs.addEventListener('pre-commit', () => { preCommitFired = true; });

    await prefs.set({ theme: { value: 'dark' } });

    // pre-commit should NOT fire because nothing changed
    assert.equal(preCommitFired, false);
});

test('Preferences set dispatches pre-commit and makes request on success', async () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def, { theme: { value: 'light', inherit: false } });

    const events = [];
    prefs.addEventListener('pre-commit', (vals) => events.push({ type: 'pre-commit', vals }));
    prefs.addEventListener('post-commit', (vals) => events.push({ type: 'post-commit', vals }));

    prefs._build_save_url = () => '/api/prefs';
    Wirecloud.io = { makeRequest: (url, opts) => Promise.resolve({ status: 204 }) };

    await prefs.set({ theme: { value: 'dark' } });

    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'pre-commit');
    assert.equal(events[1].type, 'post-commit');
});

test('Preferences set rejects on unexpected response', async () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def, { theme: { value: 'light', inherit: false } });

    prefs._build_save_url = () => '/api/prefs';
    Wirecloud.io = { makeRequest: (url, opts) => Promise.resolve({ status: 200 }) };

    await assert.rejects(
        prefs.set({ theme: { value: 'dark' } }),
        /Unexpected response from server/
    );
});

test('Preferences set rejects on error status', async () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def, { theme: { value: 'light', inherit: false } });

    prefs._build_save_url = () => '/api/prefs';
    Wirecloud.io = { makeRequest: (url, opts) => Promise.resolve({ status: 500 }) };

    // 500 status triggers parseErrorResponse which is mocked to return the response itself
    // The then chain rejects with it
    let errorCatched = false;
    try {
        await prefs.set({ theme: { value: 'dark' } });
    } catch (e) {
        errorCatched = true;
    }
    // The parseErrorResponse mock returns the response, which triggers a rejection
    // Since parseErrorResponse(result) !== undefined, Promise.reject is called
    assert.equal(errorCatched, true);
});

test('Preferences _handleParentChanges propagates inherited values', () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: true },
            lang: { name: 'lang', options: { type: 'text' }, default: 'en', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def);

    prefs.preferences.theme.inherit = true;
    prefs.preferences.lang.inherit = false;

    const propagatedValues = [];
    prefs.addEventListener('post-commit', function (vals) {
        propagatedValues.push(vals);
    });

    prefs._handleParentChanges(null, { theme: 'dark-value', lang: 'es' });

    assert.equal(propagatedValues.length, 1);
});

test('Preferences _handleParentChanges no-op when nothing to propagate', () => {
    const def = {
        preferences: {
            lang: { name: 'lang', options: { type: 'text' }, default: 'en', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def);

    prefs.preferences.lang.inherit = false;

    let propagated = null;
    prefs.addEventListener('post-commit', (vals) => { propagated = vals; });

    prefs._handleParentChanges(null, { lang: 'es' });

    assert.equal(propagated, null);
});

test('Preferences set with inherit change triggers persist and applies inherit', async () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: false }
        }
    };
    const prefs = new Wirecloud.Preferences(def, { theme: { value: 'light', inherit: false } });
    prefs.preferences.theme.inherit = false;
    prefs.preferences.theme.value = 'light';

    // Preferences is abstract; add getParentValue needed by PlatformPref.getEffectiveValue
    prefs.getParentValue = () => 'dashboard';

    const events = [];
    prefs.addEventListener('pre-commit', function (context, vals) {
        events.push({ type: 'pre-commit', vals });
    });
    prefs.addEventListener('post-commit', function (context, vals) {
        events.push({ type: 'post-commit', vals });
    });

    prefs._build_save_url = () => '/api/prefs';
    Wirecloud.io = { makeRequest: (url, opts) => Promise.resolve({ status: 204 }) };

    await prefs.set({ theme: { inherit: true } });

    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'pre-commit');
    assert.ok(events[0].vals.theme);
    assert.equal(events[0].vals.theme.inherit, true);
    assert.equal(events[1].type, 'post-commit');
    assert.equal(prefs.preferences.theme.inherit, true);
});

test('Preferences _handleParentChanges propagates changed inherited values', () => {
    const def = {
        preferences: {
            theme: { name: 'theme', options: { type: 'text' }, default: 'light', inheritByDefault: true }
        }
    };
    const prefs = new Wirecloud.Preferences(def);
    prefs.preferences.theme.inherit = true;

    const propagatedValues = [];
    prefs.addEventListener('post-commit', function (context, vals) {
        propagatedValues.push(vals);
    });

    prefs._handleParentChanges(null, { theme: 'new-dark-value' });

    assert.equal(propagatedValues.length, 1);
    assert.deepEqual(propagatedValues[0], { theme: 'new-dark-value' });
});
