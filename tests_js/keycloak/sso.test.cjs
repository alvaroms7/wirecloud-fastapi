const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLegacyScript, resetLegacyRuntime } = require('../support/legacy-runtime.cjs');

const setup = (iframeUrl = 'https://sso.example.test/login-status') => {
    resetLegacyRuntime();

    const listeners = {};
    global.window.addEventListener = (type, listener) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(listener);
    };
    global.window.removeEventListener = (type, listener) => {
        listeners[type] = (listeners[type] || []).filter((current) => current !== listener);
    };

    const wirecloudListeners = {};
    global.Wirecloud = {
        URLs: {
            KEYCLOAK_LOGIN_STATUS_IFRAME: iframeUrl,
        },
        Utils: {
            gettext: (text) => text,
        },
        contextManager: {
            get(key) {
                const values = {
                    keycloak_client_id: 'client',
                    keycloak_session: 'session',
                    mode: 'classic',
                };
                return values[key] || '';
            },
        },
        ui: {
            MessageWindowMenu: class MessageWindowMenu {
                constructor(message, title) {
                    this.message = message;
                    this.title = title;
                }
                addEventListener(type, listener) {
                    this.listener = listener;
                    return this;
                }
                show() {
                    this.listener();
                    return this;
                }
            },
        },
        addEventListener(type, listener) {
            wirecloudListeners[type] = listener;
        },
        login: () => {},
        logout: () => {},
    };

    return { listeners, wirecloudListeners };
};

test('keycloak sso does nothing without login status iframe url', () => {
    setup('');

    loadLegacyScript('src/wirecloud/keycloak/static/js/keycloak/sso.js');

    assert.equal(document.body.childNodes.length, 0);
});

test('keycloak sso posts status checks and logs in on embedded changed session', () => {
    const { listeners, wirecloudListeners } = setup();
    const intervals = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    let cleared = null;
    let loginCalls = 0;

    global.setInterval = (callback, ms) => {
        intervals.push({ callback, ms });
        return 42;
    };
    global.clearInterval = (id) => {
        cleared = id;
    };
    Wirecloud.contextManager.get = (key) => {
        const values = {
            keycloak_client_id: 'client',
            keycloak_session: '',
            mode: 'embedded',
        };
        return values[key] || '';
    };
    Wirecloud.login = () => {
        loginCalls += 1;
    };

    try {
        loadLegacyScript('src/wirecloud/keycloak/static/js/keycloak/sso.js');
        const iframe = document.body.childNodes[0];
        const posted = [];
        iframe.contentWindow = {
            postMessage(message, origin) {
                posted.push({ message, origin });
            },
        };

        wirecloudListeners.loaded();
        intervals[0].callback();
        listeners.message[0]({
            origin: 'https://sso.example.test',
            source: iframe.contentWindow,
            data: 'changed',
        });

        assert.equal(intervals[0].ms, 1500);
        assert.deepEqual(posted[0], { message: 'client ', origin: 'https://sso.example.test' });
        assert.equal(cleared, 42);
        assert.equal(loginCalls, 1);
    } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
    }
});

test('keycloak sso verifies changed non-empty sessions', () => {
    const { listeners, wirecloudListeners } = setup();
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    let loginForced = false;

    global.setInterval = () => 7;
    global.clearInterval = () => {};
    Wirecloud.login = (force) => {
        loginForced = force;
    };

    try {
        loadLegacyScript('src/wirecloud/keycloak/static/js/keycloak/sso.js');
        const iframe = document.body.childNodes[0];
        const posted = [];
        iframe.contentWindow = {
            postMessage(message, origin) {
                posted.push({ message, origin });
            },
        };

        wirecloudListeners.loaded();
        listeners.message[0]({ origin: 'https://other.example.test', source: iframe.contentWindow, data: 'changed' });
        listeners.message[0]({ origin: 'https://sso.example.test', source: {}, data: 'changed' });
        listeners.message[0]({
            origin: 'https://sso.example.test',
            source: iframe.contentWindow,
            data: 'changed',
        });
        listeners.message[listeners.message.length - 1]({
            origin: 'https://other.example.test',
            source: iframe.contentWindow,
            data: 'changed',
        });
        listeners.message[listeners.message.length - 1]({
            origin: 'https://sso.example.test',
            source: {},
            data: 'changed',
        });
        listeners.message[listeners.message.length - 1]({
            origin: 'https://sso.example.test',
            source: iframe.contentWindow,
            data: 'changed',
        });

        assert.equal(posted[0].message, 'client ');
        assert.equal(loginForced, true);
    } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
    }
});

test('keycloak sso logs out on unchanged verification response', () => {
    const { listeners, wirecloudListeners } = setup();
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    let logoutCalls = 0;

    global.setInterval = () => 7;
    global.clearInterval = () => {};
    Wirecloud.logout = () => {
        logoutCalls += 1;
    };

    try {
        loadLegacyScript('src/wirecloud/keycloak/static/js/keycloak/sso.js');
        const iframe = document.body.childNodes[0];
        iframe.contentWindow = { postMessage() {} };

        wirecloudListeners.loaded();
        listeners.message[0]({
            origin: 'https://sso.example.test',
            source: iframe.contentWindow,
            data: 'changed',
        });
        listeners.message[listeners.message.length - 1]({
            origin: 'https://sso.example.test',
            source: iframe.contentWindow,
            data: 'unchanged',
        });

        assert.equal(logoutCalls, 1);
    } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
    }
});
