const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.constants = {
        LOGGING: {
            ERROR_MSG: 1,
            WARN_MSG: 2,
            INFO_MSG: 3,
            DEBUG_MSG: 4
        },
        HTTP_STATUS_DESCRIPTIONS: {
            '404': 'Not Found',
            '500': 'Internal Server Error'
        },
        UNKNOWN_STATUS_CODE_DESCRIPTION: 'Unknown status code'
    };
    Wirecloud.GlobalLogManager = { log: () => {} };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/LogManager.js',
    ]);
});

test('LogManager constructor creates instance', () => {
    const lm = new Wirecloud.LogManager();

    assert.equal(lm.closed, false);
    assert.equal(lm.errorCount, 0);
    assert.equal(lm.totalCount, 0);
    assert.deepEqual(lm.entries, []);
    assert.equal(lm.parent, null);
});

test('LogManager constructor with parent', () => {
    const parent = new Wirecloud.LogManager();
    const lm = new Wirecloud.LogManager(parent);

    assert.equal(lm.parent, parent);
});

test('LogManager close marks as closed', () => {
    const lm = new Wirecloud.LogManager();
    lm.close();
    assert.equal(lm.closed, true);
});

test('LogManager log adds entry', () => {
    const lm = new Wirecloud.LogManager();
    lm.log('test message', { level: Wirecloud.constants.LOGGING.INFO_MSG, console: false });

    assert.equal(lm.totalCount, 1);
    assert.equal(lm.entries[0].msg, 'test message');
    assert.equal(lm.entries[0].level, Wirecloud.constants.LOGGING.INFO_MSG);
});

test('LogManager log error increments errorCount', () => {
    const lm = new Wirecloud.LogManager();
    lm.log('error', { level: Wirecloud.constants.LOGGING.ERROR_MSG, console: false });

    assert.equal(lm.errorCount, 1);
});

test('LogManager log backwards compatibility with number level', () => {
    const lm = new Wirecloud.LogManager();
    lm.log('msg', Wirecloud.constants.LOGGING.WARN_MSG);

    assert.equal(lm.entries[0].level, Wirecloud.constants.LOGGING.WARN_MSG);
});

test('LogManager log throws on closed', () => {
    const lm = new Wirecloud.LogManager();
    lm.close();
    assert.throws(() => lm.log('msg'), /Trying to log a message in a closed LogManager/);
});

test('LogManager log throws on invalid level', () => {
    const lm = new Wirecloud.LogManager();
    assert.throws(
        () => lm.log('msg', { level: 5 }),
        /Invalid level value/
    );
    assert.throws(
        () => lm.log('msg', { level: -1 }),
        /Invalid level value/
    );
    assert.throws(
        () => lm.log('msg', { level: 'bad' }),
        /Invalid level value/
    );
});

test('LogManager newCycle moves entries', () => {
    const lm = new Wirecloud.LogManager();
    lm.log('cycle1', { level: Wirecloud.constants.LOGGING.INFO_MSG, console: false });

    lm.newCycle();

    assert.equal(lm.totalCount, 0);
    assert.equal(lm.errorCount, 0);
    assert.equal(lm.previouscycles.length, 1);
});

test('LogManager newCycle throws on closed', () => {
    const lm = new Wirecloud.LogManager();
    lm.close();
    assert.throws(
        () => lm.newCycle(),
        /Trying to create a new cycle in a closed LogManager/
    );
});

test('LogManager reset clears entries', () => {
    const lm = new Wirecloud.LogManager();
    lm.log('msg1', { console: false });
    lm.log('msg2', { console: false });

    lm.reset();

    assert.equal(lm.totalCount, 0);
    assert.equal(lm.errorCount, 0);
    assert.equal(lm.previouscycles.length, 0);
});

test('LogManager reset throws on closed', () => {
    const lm = new Wirecloud.LogManager();
    lm.close();
    assert.throws(() => lm.reset(), /Closed LogManagers cannot be reset/);
});

test('LogManager parent propagates log entries', () => {
    const parent = new Wirecloud.LogManager();
    const child = new Wirecloud.LogManager(parent);

    child.log('child msg', { level: Wirecloud.constants.LOGGING.INFO_MSG, console: false });

    assert.equal(parent.totalCount, 1);
    assert.equal(parent.entries[0].msg, 'child msg');
});

test('LogManager parseErrorResponse with description', () => {
    const lm = new Wirecloud.LogManager();
    const msg = lm.parseErrorResponse({
        status: 404,
        responseText: JSON.stringify({ description: 'Resource not found' })
    });

    assert.equal(msg, 'Resource not found');
});

test('LogManager parseErrorResponse with no description uses status', () => {
    const lm = new Wirecloud.LogManager();
    const msg = lm.parseErrorResponse({
        status: 404,
        statusText: 'Not Found',
        responseText: 'not json'
    });

    assert.ok(msg.includes('404'));
    assert.ok(msg.includes('Not Found'));
});

test('LogManager parseErrorResponse with unknown status', () => {
    const lm = new Wirecloud.LogManager();
    const msg = lm.parseErrorResponse({
        status: 999,
        statusText: '',
        responseText: ''
    });

    assert.ok(msg.includes('999'));
    assert.ok(msg.includes('Unknown status code'));
});

test('LogManager parent cannot be set on closed parent', () => {
    const parent = new Wirecloud.LogManager();
    parent.close();
    assert.throws(
        () => new Wirecloud.LogManager(parent),
        Error
    );
});

test('GlobalLogManager is created', () => {
    assert.ok(Wirecloud.GlobalLogManager instanceof Wirecloud.LogManager);
});

test('LogManager formatException uses GUIBuilder with template', () => {
    const templateStr = '<s:styledgui xmlns:t="http://wirecloud.conwet.fi.upm.es/Template"><t:message/><t:stacktrace/></s:styledgui>';
    Wirecloud.currentTheme = {
        templates: {
            'wirecloud/logs/details': templateStr
        }
    };

    const parseResult = {};
    const OriginalGUIBuilder = StyledElements.GUIBuilder;

    StyledElements.GUIBuilder = class MockGUIBuilder {
        constructor() {}
        parse(template, data) {
            assert.equal(template, templateStr);
            assert.ok(data.message.includes('TestFormatError'));
            assert.ok(typeof data.stacktrace === 'string');
            return parseResult;
        }
    };

    const lm = new Wirecloud.LogManager();
    const err = new Error('TestFormatError');
    const result = lm.formatException(err);

    assert.equal(result, parseResult);

    StyledElements.GUIBuilder = OriginalGUIBuilder;
    delete Wirecloud.currentTheme;
});

test('LogManager parseErrorResponse with valid JSON missing description', () => {
    const lm = new Wirecloud.LogManager();
    const msg = lm.parseErrorResponse({
        status: 500,
        statusText: '',
        responseText: JSON.stringify({ error: 'error', code: 500 })
    });

    assert.ok(msg.includes('500'));
    assert.ok(msg.includes('Internal Server Error'));
});

test('GlobalLogManager.log adds entry', () => {
    Wirecloud.GlobalLogManager.log('global log msg', {
        level: Wirecloud.constants.LOGGING.INFO_MSG,
        console: false
    });

    assert.ok(Wirecloud.GlobalLogManager.totalCount > 0);
    const entry = Wirecloud.GlobalLogManager.entries[0];
    assert.equal(entry.msg, 'global log msg');
    assert.equal(entry.level, Wirecloud.constants.LOGGING.INFO_MSG);
});

test('LogManager log with ERROR_MSG hits console.error', () => {
    const origError = console.error;
    let errorCalled = false;
    let errorMsg = null;
    console.error = (msg) => { errorCalled = true; errorMsg = msg; };

    try {
        const lm = new Wirecloud.LogManager();
        const entry = lm.log('console error test', {
            level: Wirecloud.constants.LOGGING.ERROR_MSG,
            console: true
        }).entries[0];
        assert.equal(entry.level, Wirecloud.constants.LOGGING.ERROR_MSG);
        assert.equal(errorCalled, true);
        assert.equal(errorMsg, 'console error test');
    } finally {
        console.error = origError;
    }
});

test('LogManager log with INFO_MSG hits console.info', () => {
    const origInfo = console.info;
    let infoCalled = false;
    let infoMsg = null;
    console.info = (msg) => { infoCalled = true; infoMsg = msg; };

    try {
        const lm = new Wirecloud.LogManager();
        const entry = lm.log('console info test', {
            level: Wirecloud.constants.LOGGING.INFO_MSG,
            console: true
        }).entries[0];
        assert.equal(entry.level, Wirecloud.constants.LOGGING.INFO_MSG);
        assert.equal(infoCalled, true);
        assert.equal(infoMsg, 'console info test');
    } finally {
        console.info = origInfo;
    }
});

test('LogManager log with WARN_MSG hits console.warn', () => {
    const origWarn = console.warn;
    let warnCalled = false;
    let warnMsg = null;
    console.warn = (msg) => { warnCalled = true; warnMsg = msg; };

    try {
        const lm = new Wirecloud.LogManager();
        const entry = lm.log('console warn test', {
            level: Wirecloud.constants.LOGGING.WARN_MSG,
            console: true
        }).entries[0];
        assert.equal(entry.level, Wirecloud.constants.LOGGING.WARN_MSG);
        assert.equal(warnCalled, true);
        assert.equal(warnMsg, 'console warn test');
    } finally {
        console.warn = origWarn;
    }
});

test('LogManager log with DEBUG_MSG hits console.info', () => {
    const origInfo = console.info;
    let infoCalled = false;
    let infoMsg = null;
    console.info = (msg) => { infoCalled = true; infoMsg = msg; };

    try {
        const lm = new Wirecloud.LogManager();
        const entry = lm.log('console debug test', {
            level: Wirecloud.constants.LOGGING.DEBUG_MSG,
            console: true
        }).entries[0];
        assert.equal(entry.level, Wirecloud.constants.LOGGING.DEBUG_MSG);
        assert.equal(infoCalled, true);
        assert.equal(infoMsg, 'console debug test');
    } finally {
        console.info = origInfo;
    }
});
