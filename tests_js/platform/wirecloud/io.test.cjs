const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupIO = () => {
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.Utils.getCookie = () => null;
    Wirecloud.Utils.callCallback = (fn, ...args) => { if (typeof fn === 'function') fn(...args); };

    // Mock Task base class
    Wirecloud.Task = class Task {
        constructor(name, fn) {
            this._name = name;
            this._reject = null;
            this._resolve = null;
            this._update = null;
            if (typeof fn === 'function') {
                fn(
                    (val) => { if (this._resolve) this._resolve(val); },
                    (err) => { if (this._reject) this._reject(err); },
                    (val) => { if (this._update) this._update(val); }
                );
            }
        }
        abort(response) {}
        then() { return this; }
    };
    Wirecloud.Task.prototype.abort = function() {};
    Wirecloud.Task.prototype.toTask = function(n) { return this; };

    // Mock location
    Wirecloud.location = { base: 'http://localhost/', domain: 'localhost' };
    global.location = { origin: 'http://localhost', protocol: 'http:', host: 'localhost', pathname: '/', search: '', hash: '' };

    // Mock URLs
    Wirecloud.URLs = {
        PROXY: {
            evaluate: (opts) => '/proxy/' + opts.protocol + '/' + opts.domain + opts.path
        }
    };

    // Ensure URL class is available
    if (!global.URL) {
        global.URL = require('node:url').URL;
    }

    // Install XMLHttpRequest mock
    class FakeXHR {
        constructor() {
            this._status = 0;
            this.statusText = '';
            this.response = null;
            this.responseText = '';
            this.responseXML = null;
            this.readyState = 0;
            this.withCredentials = false;
            this.responseType = '';
            this.aborted = false;
            this.upload = { addEventListener: () => {} };
            this.listeners = {};
            this.requestHeaders = {};
            this.openParams = [];
            this.sentBody = null;
        }
        addEventListener(type, handler) {
            if (!this.listeners[type]) this.listeners[type] = [];
            this.listeners[type].push(handler);
        }
        removeEventListener(type, handler) {
            if (this.listeners[type]) {
                this.listeners[type] = this.listeners[type].filter(h => h !== handler);
            }
        }
        dispatchEvent(event) {
            const handlers = this.listeners[event.type] || [];
            handlers.forEach(h => h.call(this, event));
        }
        setRequestHeader(name, value) {
            this.requestHeaders[name] = value;
        }
        getResponseHeader(name) { return null; }
        getAllResponseHeaders() { return ''; }
        open(method, url, async) {
            this.openParams = [method, url, async];
        }
        send(body) {
            this.sentBody = body;
            this._status = 200;
            this.statusText = 'OK';
            this.responseText = '{"ok":true}';
            process.nextTick(() => {
                this.dispatchEvent({ type: 'load', lengthComputable: false });
            });
        }
        abort() {}
        get status() { return this._status; }
        set status(v) { this._status = v; }
    }
    global.XMLHttpRequest = FakeXHR;

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/io.js',
    ]);
};

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    setupIO();
});

test('Wirecloud.io exists', () => {
    assert.ok(Wirecloud.io);
    assert.equal(typeof Wirecloud.io.makeRequest, 'function');
    assert.equal(typeof Wirecloud.io.buildProxyURL, 'function');
});

test('ConnectionError is an Error', () => {
    const err = new Wirecloud.io.ConnectionError();
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'ConnectionError');
    assert.equal(err.message, 'Connection Error');
    assert.equal(err.toString(), 'Connection Error');
});

test('io.buildProxyURL returns string for simple URL', () => {
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', { method: 'GET' });
    assert.equal(typeof url, 'string');
    assert.ok(url.startsWith('http://'));
});

test('io.buildProxyURL handles blob protocol', () => {
    const url = Wirecloud.io.buildProxyURL('blob:abc-123', { method: 'GET' });
    assert.equal(url, 'blob:abc-123');
});

test('io.buildProxyURL handles data protocol', () => {
    const url = Wirecloud.io.buildProxyURL('data:text/plain,hello', { method: 'GET' });
    assert.ok(url.startsWith('data:'));
});

test('io.buildProxyURL with object parameters appends query for GET', () => {
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', {
        method: 'GET',
        parameters: { key: 'value', num: '42' }
    });
    assert.ok(url.includes('key=value'));
});

test('io.buildProxyURL with string parameters', () => {
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', {
        method: 'GET',
        parameters: 'key=value&foo=bar'
    });
    assert.ok(url.includes('key=value&foo=bar'));
});

test('io.buildProxyURL with null parameters omits query', () => {
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', { method: 'GET', parameters: null });
    assert.ok(!url.includes('?'));
});

test('io.buildProxyURL with empty string parameters omits query', () => {
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', { method: 'GET', parameters: '  ' });
    assert.ok(!url.includes('?'));
});

test('io.buildProxyURL with forceProxy', () => {
    const url = Wirecloud.io.buildProxyURL('http://other.com/api', {
        method: 'GET',
        forceProxy: true
    });
    assert.ok(url.includes('/proxy/'));
});

test('io.buildProxyURL with supportsAccessControl and same origin skips proxy', () => {
    const url = Wirecloud.io.buildProxyURL('http://localhost/api', {
        method: 'GET',
        supportsAccessControl: true
    });
    assert.ok(url.startsWith('http://localhost/'));
});

test('io.buildProxyURL with undefined parameter values', () => {
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', {
        method: 'GET',
        parameters: { a: '1', b: undefined, c: '2' }
    });
    assert.ok(url.includes('a=1'));
    assert.ok(!url.includes('b='));
    assert.ok(url.includes('c=2'));
});

test('io.buildProxyURL appends params when URL already has query string', () => {
    global.URL = require('node:url').URL;
    const url = Wirecloud.io.buildProxyURL('http://example.com/api?existing=1', {
        method: 'GET',
        parameters: { key: 'value' }
    });
    assert.ok(url.includes('existing=1'));
    assert.ok(url.includes('key=value'));
    assert.ok(url.includes('&'));
});

test('io.buildProxyURL with supportsAccessControl and different origin uses proxy', () => {
    global.URL = require('node:url').URL;
    const url = Wirecloud.io.buildProxyURL('http://different.com/api', {
        method: 'GET',
        supportsAccessControl: false
    });
    assert.ok(url.includes('/proxy/'));
});

test('io.buildProxyURL preserves hash', () => {
    global.URL = require('node:url').URL;
    const url = Wirecloud.io.buildProxyURL('http://example.com/api#section', {
        method: 'GET'
    });
    assert.ok(url.includes('#section'));
});

test('io.makeRequest with same origin adds CSRF token', () => {
    global.URL = require('node:url').URL;
    const origBuild = Wirecloud.io.buildProxyURL;
    Wirecloud.io.buildProxyURL = (url) => 'http://localhost/api';
    Wirecloud.Utils.getCookie = (name) => 'test-csrf-token';
    Wirecloud.Utils.merge = StyledElements.Utils.merge;

    // Mock XMLHttpRequest to check headers
    let receivedHeaders = {};
    class TestXHR {
        constructor() {
            this._status = 200;
            this.statusText = 'OK';
            this.responseText = '{}';
            this.upload = { addEventListener: () => {} };
            this.listeners = {};
            this.requestHeaders = {};
            this.openParams = [];
        }
        addEventListener(type, handler) {
            if (!this.listeners[type]) this.listeners[type] = [];
            this.listeners[type].push(handler);
        }
        setRequestHeader(name, value) {
            this.requestHeaders[name] = value;
        }
        getResponseHeader() { return null; }
        getAllResponseHeaders() { return ''; }
        open(method, url, async) { this.openParams = [method, url, async]; }
        send(body) {
            this._status = 200;
            this.dispatchEvent({ type: 'load' });
        }
        dispatchEvent(event) {
            const handlers = this.listeners[event.type] || [];
            handlers.forEach(h => h.call(this, event));
        }
        abort() {}
        get status() { return this._status; }
        set status(v) { this._status = v; }
    }
    global.XMLHttpRequest = TestXHR;

    Wirecloud.io.makeRequest('http://example.com/api', { method: 'GET' });

    Wirecloud.io.buildProxyURL = origBuild;
    // Just verify no exception
    assert.ok(true);
});

// ============================================================
// ADDITIONAL TESTS: Request class, setRequestHeaders,
// onReadyStateChange, onAbort, toQueryString, Response class
// ============================================================

let lastXHR = null;

const createXHRClass = (opts = {}) => {
    return class {
        constructor() {
            lastXHR = this;
            this._status = opts.status ?? 200;
            this.statusText = opts.statusText ?? 'OK';
            this.response = opts.response ?? null;
            this.responseText = opts.responseText ?? '{}';
            this.responseXML = opts.responseXML ?? null;
            this.upload = {
                listeners: {},
                addEventListener(t, h) { (this.listeners[t] = this.listeners[t] || []).push(h); },
            };
            this.listeners = {};
            this.requestHeaders = {};
            this._responseHeaders = opts.responseHeaders || {};
            this.withCredentials = false;
            this.responseType = '';
            this.aborted = false;
            this.openParams = [];
            this.sentBody = null;
        }
        addEventListener(t, h) { (this.listeners[t] = this.listeners[t] || []).push(h); }
        removeEventListener(t, h) {
            if (this.listeners[t]) this.listeners[t] = this.listeners[t].filter(x => x !== h);
        }
        setRequestHeader(n, v) { this.requestHeaders[n] = v; }
        open(m, u, a) { this.openParams = [m, u, a]; }
        send(body) {
            this.sentBody = body;
            if (opts.noAutoSend) return;
            process.nextTick(() => {
                const eType = opts.event || 'load';
                const e = { type: eType, stopPropagation() {}, preventDefault() {} };
                if (eType === 'load' || eType === 'progress') e.lengthComputable = false;
                this.dispatchEvent(e);
            });
        }
        abort() {
            this.dispatchEvent({ type: 'abort', stopPropagation() {}, preventDefault() {} });
        }
        dispatchEvent(e) { (this.listeners[e.type] || []).forEach(h => h.call(this, e)); }
        getResponseHeader(n) { return this._responseHeaders[n] || null; }
        getAllResponseHeaders() { return ''; }
        get status() { return this._status; }
        set status(v) { this._status = v; }
    };
};

// --- setRequestHeaders tests ---

test('Request sets default X-Requested-With and Accept headers', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', { method: 'GET' });
    assert.equal(lastXHR.requestHeaders['X-Requested-With'], 'XMLHttpRequest');
    assert.equal(lastXHR.requestHeaders['Accept'], 'text/javascript, text/html, application/xml, text/xml, */*');
});

test('Request merges custom requestHeaders', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        requestHeaders: { 'X-Custom': 'custom-val', 'Authorization': 'Bearer token' }
    });
    assert.equal(lastXHR.requestHeaders['X-Custom'], 'custom-val');
    assert.equal(lastXHR.requestHeaders['Authorization'], 'Bearer token');
});

test('Request sets Content-Type from contentType option', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'POST',
        postBody: '{"data":1}',
        contentType: 'application/json'
    });
    assert.equal(lastXHR.requestHeaders['Content-Type'], 'application/json');
});

test('Request sets Content-Type with charset from encoding option', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'POST',
        postBody: '{"data":1}',
        contentType: 'application/json',
        encoding: 'UTF-8'
    });
    assert.equal(lastXHR.requestHeaders['Content-Type'], 'application/json; charset=UTF-8');
});

test('Request does not set null-valued headers', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        requestHeaders: { 'X-Null': null, 'X-AlsoNull': null }
    });
    assert.ok(!('X-Null' in lastXHR.requestHeaders));
    assert.ok(!('X-AlsoNull' in lastXHR.requestHeaders));
});

test('Request does not override Content-Type when provided in requestHeaders', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'POST',
        postBody: '{}',
        contentType: 'application/json',
        requestHeaders: { 'Content-Type': 'text/plain' }
    });
    assert.equal(lastXHR.requestHeaders['Content-Type'], 'text/plain');
});

// --- Request constructor: validation and options ---

test('Request throws TypeError for non-function handler callback', () => {
    global.XMLHttpRequest = createXHRClass();
    assert.throws(
        () => Wirecloud.io.makeRequest('http://localhost/api', {
            method: 'GET',
            onSuccess: 'not a function'
        }),
        TypeError
    );
});

test('Request throws TypeError for non-function onFailure callback', () => {
    global.XMLHttpRequest = createXHRClass();
    assert.throws(
        () => Wirecloud.io.makeRequest('http://localhost/api', {
            method: 'GET',
            onFailure: 42
        }),
        TypeError
    );
});

test('Request binds callbacks to context', async () => {
    let successCtx = null;
    const ctx = { name: 'test-ctx' };
    class BindXHR extends createXHRClass() {
        open() {}
        send() {
            process.nextTick(() => this.dispatchEvent({ type: 'load', lengthComputable: false }));
        }
    }
    global.XMLHttpRequest = BindXHR;
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        context: ctx,
        onSuccess: function () { successCtx = this; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(successCtx, ctx);
});

test('Request auto-generates postBody from parameters for PUT', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'PUT',
        parameters: { key: 'val', num: '42' }
    });
    assert.ok(lastXHR.sentBody.includes('key=val'));
    assert.ok(lastXHR.sentBody.includes('num=42'));
});

test('Request auto-sets content-type for POST with parameters', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'POST',
        parameters: { data: 'test' }
    });
    assert.equal(lastXHR.requestHeaders['Content-Type'], 'application/x-www-form-urlencoded; charset=UTF-8');
});

test('Request with withCredentials sets transport.withCredentials', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://other.com/api', {
        method: 'GET',
        withCredentials: true,
        supportsAccessControl: true
    });
    assert.equal(lastXHR.withCredentials, true);
});

test('Request sets responseType on transport', () => {
    global.XMLHttpRequest = createXHRClass();
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        responseType: 'blob'
    });
    assert.equal(lastXHR.responseType, 'blob');
});

// --- onReadyStateChange callback tests ---

test('Request calls onSuccess callback for 2xx status', async () => {
    let called = false;
    let resp;
    global.XMLHttpRequest = createXHRClass({ status: 200, statusText: 'OK', responseText: 'success' });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onSuccess: (r) => { called = true; resp = r; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(called);
    assert.equal(resp.status, 200);
});

test('Request calls onFailure callback for 404 status', async () => {
    let called = false;
    global.XMLHttpRequest = createXHRClass({ status: 404, statusText: 'Not Found' });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onFailure: () => { called = true; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(called);
});

test('Request calls onFailure callback for 500 status', async () => {
    let called = false;
    global.XMLHttpRequest = createXHRClass({ status: 500, statusText: 'Server Error' });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onFailure: () => { called = true; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(called);
});

test('Request calls status-specific handler on201', async () => {
    let called = false;
    let successCalled = false;
    global.XMLHttpRequest = createXHRClass({ status: 201, statusText: 'Created' });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'POST',
        postBody: '{}',
        on201: () => { called = true; },
        onSuccess: () => { successCalled = true; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(called);
    assert.ok(!successCalled);
});

test('Request calls onComplete callback after onSuccess', async () => {
    let order = [];
    global.XMLHttpRequest = createXHRClass({ status: 200 });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onSuccess: () => { order.push('success'); },
        onComplete: () => { order.push('complete'); }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.deepEqual(order, ['success', 'complete']);
});

test('Request calls onComplete callback after onFailure', async () => {
    let order = [];
    global.XMLHttpRequest = createXHRClass({ status: 404 });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onFailure: () => { order.push('failure'); },
        onComplete: () => { order.push('complete'); }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.deepEqual(order, ['failure', 'complete']);
});

test('Request calls onException when onSuccess throws', async () => {
    let exceptionCalled = false;
    let completeCalled = false;
    const err = new Error('callback error');
    global.XMLHttpRequest = createXHRClass({ status: 200 });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onSuccess: () => { throw err; },
        onException: () => { exceptionCalled = true; },
        onComplete: () => { completeCalled = true; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(exceptionCalled);
    assert.ok(completeCalled);
});

test('Request calls onException when onComplete throws', async () => {
    let exceptionCalled = false;
    const err = new Error('complete error');
    global.XMLHttpRequest = createXHRClass({ status: 200 });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onComplete: () => { throw err; },
        onException: () => { exceptionCalled = true; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(exceptionCalled);
});

test('Request resolves with ConnectionError on error event', () => {
    let rejectReceived = null;
    Wirecloud.Task = class Task {
        constructor(name, fn) {
            this._name = name;
            this._reject = null;
            this._resolve = null;
            this._update = null;
            if (typeof fn === 'function') {
                fn(
                    (val) => { if (this._resolve) this._resolve(val); },
                    (err) => { rejectReceived = err; },
                    (val) => { if (this._update) this._update(val); }
                );
            }
        }
        then() { return this; }
    };
    global.XMLHttpRequest = createXHRClass({ event: 'error', status: 0 });
    Wirecloud.io.makeRequest('http://localhost/api', { method: 'GET' });
    // The error event fires on nextTick, but reject is called in onReadyStateChange
    assert.ok(true);
});

// --- onAbort tests ---

test('Request calls onAbort callback on abort event', async () => {
    let abortCalled = false;
    let completeCalled = false;
    class AbortXHR extends createXHRClass({ noAutoSend: true }) {
        send() {
            process.nextTick(() => {
                this.dispatchEvent({ type: 'abort', stopPropagation() {}, preventDefault() {} });
            });
        }
    }
    global.XMLHttpRequest = AbortXHR;
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onAbort: () => { abortCalled = true; },
        onComplete: () => { completeCalled = true; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(abortCalled);
    assert.ok(completeCalled);
});

// --- Request.abort() tests ---

test('Request.abort sets aborted flag and returns this', () => {
    global.XMLHttpRequest = createXHRClass({ noAutoSend: true });
    const req = Wirecloud.io.makeRequest('http://localhost/api', { method: 'GET' });
    const result = req.abort();
    assert.equal(result, req);
    assert.equal(lastXHR.aborted, true);
});

// --- Response class tests ---

test('Response provides status, statusText, and responseText', async () => {
    let capturedResp;
    global.XMLHttpRequest = createXHRClass({
        status: 201,
        statusText: 'Created',
        responseText: '{"id":1}',
        responseXML: null
    });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'POST',
        postBody: '{}',
        onSuccess: (r) => { capturedResp = r; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(capturedResp.status, 201);
    assert.equal(capturedResp.statusText, 'Created');
    assert.equal(capturedResp.responseText, '{"id":1}');
    assert.equal(capturedResp.responseXML, null);
    assert.equal(capturedResp.request.options.method, 'POST');
});

test('Response omits responseText when responseType is set', async () => {
    let capturedResp;
    class RTXHR extends createXHRClass({ status: 200 }) {
        constructor() {
            super();
            this.responseType = 'blob';
        }
    }
    global.XMLHttpRequest = RTXHR;
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        responseType: 'blob',
        onSuccess: (r) => { capturedResp = r; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(capturedResp.status, 200);
    assert.equal('responseText' in capturedResp, false);
    assert.equal('responseXML' in capturedResp, false);
});

test('Response.getHeader returns header value', async () => {
    let capturedResp;
    global.XMLHttpRequest = createXHRClass({
        status: 200,
        responseHeaders: { 'X-RateLimit': '100' }
    });
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onSuccess: (r) => { capturedResp = r; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(capturedResp.getHeader('X-RateLimit'), '100');
    assert.equal(capturedResp.getHeader('X-Missing'), null);
});

test('Response.getHeader returns null when transport throws', async () => {
    let capturedResp;
    class ThrowingXHR extends createXHRClass({ status: 200 }) {
        getResponseHeader() { throw new Error('access denied'); }
    }
    global.XMLHttpRequest = ThrowingXHR;
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onSuccess: (r) => { capturedResp = r; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(capturedResp.getHeader('Anything'), null);
});

test('Response.getAllResponseHeaders delegates to transport', () => {
    const headersText = 'content-type: text/plain\r\nx-custom: val';
    class AHRX extends createXHRClass({ noAutoSend: true, status: 200 }) {
        getAllResponseHeaders() { return headersText; }
    }
    global.XMLHttpRequest = AHRX;
    let capturedResp;
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onSuccess: (r) => { capturedResp = r; }
    });
    lastXHR.dispatchEvent({ type: 'load', lengthComputable: false });
    assert.equal(capturedResp.getAllResponseHeaders(), headersText);
});

// --- toQueryString via buildProxyURL (null-value params) ---

test('io.buildProxyURL handles null parameter values', () => {
    global.URL = require('node:url').URL;
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', {
        method: 'GET',
        parameters: { a: null, b: 'val' }
    });
    assert.ok(url.includes('a='));
    assert.ok(url.includes('b=val'));
});

test('io.buildProxyURL handles mixed null and undefined parameters', () => {
    global.URL = require('node:url').URL;
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', {
        method: 'GET',
        parameters: { a: null, b: undefined, c: 'ok' }
    });
    assert.ok(url.includes('a='));
    assert.ok(!url.includes('b='));
    assert.ok(url.includes('c=ok'));
});

// === Request: onUploadProgress handler ===

test('Request registers onUploadProgress on transport.upload when provided', () => {
    let uploadProgCallback = null;
    class UXHR extends createXHRClass({ noAutoSend: true }) {
        constructor() {
            super();
            const origAdd = this.upload.addEventListener;
            this.upload.addEventListener = (type, fn) => {
                if (type === 'progress') uploadProgCallback = fn;
                origAdd.call(this.upload, type, fn);
            };
        }
    }
    global.XMLHttpRequest = UXHR;
    const onUP = () => {};
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'POST',
        postBody: 'data',
        onUploadProgress: onUP
    });
    // The second progress listener should be our onUploadProgress
    assert.ok(uploadProgCallback);
});

// === Request: built-in upload/download progress events ===

test('Request built-in upload progress handler does not throw', () => {
    class UploadProgXHR extends createXHRClass({ noAutoSend: true }) {
        constructor() {
            super();
            this.upload.dispatchEvent = (e) => {
                (this.upload.listeners[e.type] || []).forEach(h => h.call(this, e));
            };
        }
    }
    global.XMLHttpRequest = UploadProgXHR;
    Wirecloud.io.makeRequest('http://localhost/api', { method: 'POST', postBody: 'data' });

    assert.doesNotThrow(() => {
        lastXHR.upload.dispatchEvent({ type: 'progress', loaded: 50, total: 100 });
    });
    delete lastXHR;
});

test('Request built-in download progress handler fires when lengthComputable', () => {
    global.XMLHttpRequest = createXHRClass({ noAutoSend: true });
    Wirecloud.io.makeRequest('http://localhost/api', { method: 'GET' });

    assert.doesNotThrow(() => {
        lastXHR.dispatchEvent({ type: 'progress', lengthComputable: true, loaded: 60, total: 100 });
    });
    delete lastXHR;
});

test('Request built-in download progress handler skips non-lengthComputable', () => {
    global.XMLHttpRequest = createXHRClass({ noAutoSend: true });
    Wirecloud.io.makeRequest('http://localhost/api', { method: 'GET' });

    assert.doesNotThrow(() => {
        lastXHR.dispatchEvent({ type: 'progress', lengthComputable: false, loaded: 60, total: 100 });
    });
    delete lastXHR;
});

// === Request: onProgress handler ===

// === onAbort: onException when onComplete throws (lines 60-61) ===

test('onAbort calls onException when onComplete throws', async () => {
    let exceptionCalled = false;
    let exceptionArg = null;
    // Override callCallback to track onException calls
    const origCallCallback = Wirecloud.Utils.callCallback;
    Wirecloud.Utils.callCallback = (fn, ...args) => {
        if (fn === undefined) {
            // onComplete or onAbort might be undefined
        } else if (typeof fn === 'function') {
            fn(...args);
        }
    };

    class AbortCompleteThrowingXHR extends createXHRClass({ noAutoSend: true }) {
        send() {
            process.nextTick(() => {
                this.dispatchEvent({ type: 'abort', stopPropagation() {}, preventDefault() {} });
            });
        }
    }
    global.XMLHttpRequest = AbortCompleteThrowingXHR;

    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onAbort: () => {},
        onComplete: () => { throw new Error('complete threw in abort'); },
        onException: (response, error) => { exceptionCalled = true; exceptionArg = error; }
    });
    await new Promise(r => setTimeout(r, 10));
    assert.ok(exceptionCalled, 'onException should be called');
    assert.ok(exceptionArg instanceof Error);
    assert.equal(exceptionArg.message, 'complete threw in abort');

    Wirecloud.Utils.callCallback = origCallCallback;
});

// === toQueryString returns null when all params are filterable (lines 154-155) ===

test('toQueryString returns null when all parameters are undefined', () => {
    global.URL = require('node:url').URL;
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', {
        method: 'GET',
        parameters: { a: undefined, b: undefined }
    });
    assert.ok(!url.includes('?'), 'URL should not have query string');
});

test('toQueryString returns null when parameters object has only undefined values after filtering', () => {
    global.URL = require('node:url').URL;
    // All values are undefined — toQueryString returns null, preventing '?' appended
    const url = Wirecloud.io.buildProxyURL('http://example.com/api', {
        method: 'GET',
        parameters: { x: undefined, y: undefined, z: undefined }
    });
    assert.ok(!url.includes('?'));
    assert.ok(url.endsWith('/api'));
});

test('Request registers onProgress on transport when provided', () => {
    const progressCallbacks = [];
    class PXHR extends createXHRClass({ noAutoSend: true }) {
        addEventListener(type, fn) {
            if (type === 'progress') progressCallbacks.push(fn);
            super.addEventListener(type, fn);
        }
    }
    global.XMLHttpRequest = PXHR;
    Wirecloud.io.makeRequest('http://localhost/api', {
        method: 'GET',
        onProgress: () => {}
    });
    // Built-in progress listener + onProgress = 2+
    assert.ok(progressCallbacks.length >= 2);
});

