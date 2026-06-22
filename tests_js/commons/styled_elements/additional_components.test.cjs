const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setupHiddenField = () => {
    class InputElement {
        constructor(initialValue, events) {
            this.initialValue = initialValue;
            this.events = events;
        }
    }

    global.StyledElements = {
        InputElement,
        Utils: {
            merge: (...objects) => Object.assign({}, ...objects),
            prependWord: (className, prefix) => className ? `${prefix} ${className}` : prefix,
        }
    };

    loadLegacyScript('src/wirecloud/commons/static/js/StyledElements/HiddenField.js');
    return StyledElements.HiddenField;
};

test('StyledElements.HiddenField applies defaults when options are missing', () => {
    resetLegacyRuntime();
    const HiddenField = setupHiddenField();
    const field = new HiddenField();

    assert.equal(field.wrapperElement.className, 'styled_hidden_field');
    assert.equal(field.inputElement.getAttribute('type'), 'hidden');
});

test('StyledElements.HiddenField sets name, id and initial value when provided', () => {
    resetLegacyRuntime();
    const HiddenField = setupHiddenField();
    const field = new HiddenField({
        class: 'custom',
        name: 'token',
        id: 'secret-id',
        initialValue: 'abc',
    });

    assert.equal(field.wrapperElement.className, 'styled_hidden_field custom');
    assert.equal(field.inputElement.getAttribute('name'), 'token');
    assert.equal(field.wrapperElement.getAttribute('id'), 'secret-id');
    assert.equal(field.inputElement.getAttribute('value'), 'abc');
});

const setupTextInputInterface = () => {
    class InputInterface {
        constructor(fieldId, options) {
            this.fieldId = fieldId;
            this.options = options;
        }

        validate() {
            this.validateCalls = (this.validateCalls || 0) + 1;
        }
    }

    class TextField {
        constructor(options) {
            this.options = options;
            this.listeners = {};
        }

        addEventListener(name, handler) {
            this.listeners[name] = handler;
        }
    }

    global.StyledElements = {
        InputInterface,
        TextField,
        Utils: {}
    };

    loadLegacyScript('src/wirecloud/commons/static/js/StyledElements/TextInputInterface.js');
    return StyledElements.TextInputInterface;
};

test('StyledElements.TextInputInterface wires change and blur listeners', () => {
    resetLegacyRuntime();
    const TextInputInterface = setupTextInputInterface();
    const input = new TextInputInterface('field', { placeholder: 'x' });

    assert.equal(typeof input.inputElement.listeners.change, 'function');
    assert.equal(typeof input.inputElement.listeners.blur, 'function');
});

test('StyledElements.TextInputInterface parse/stringify return same value', () => {
    resetLegacyRuntime();
    const TextInputInterface = setupTextInputInterface();

    assert.equal(TextInputInterface.parse('demo'), 'demo');
    assert.equal(TextInputInterface.stringify('demo'), 'demo');
});

test('StyledElements.TextInputInterface assignDefaultButton invokes button click on submit', () => {
    resetLegacyRuntime();
    const TextInputInterface = setupTextInputInterface();
    const input = new TextInputInterface('field', {});
    let clicks = 0;

    input.assignDefaultButton({
        click() {
            clicks += 1;
        }
    });
    input.inputElement.listeners.submit();

    assert.equal(clicks, 1);
});

test('StyledElements.TextInputInterface blur listener triggers validate immediately', () => {
    resetLegacyRuntime();
    const TextInputInterface = setupTextInputInterface();
    const input = new TextInputInterface('field', {});

    input.inputElement.listeners.blur();

    assert.equal(input.validateCalls, 1);
});

test('StyledElements.TextInputInterface change listener schedules validate and clears existing timeout', async () => {
    resetLegacyRuntime();
    const TextInputInterface = setupTextInputInterface();
    const input = new TextInputInterface('field', {});

    const clearedTimeouts = [];
    const realSetTimeout = global.setTimeout;
    const realClearTimeout = global.clearTimeout;
    global.setTimeout = (fn, ms) => {
        const id = { fn, ms };
        clearedTimeouts.push(id);
        fn();
        return id;
    };
    global.clearTimeout = (id) => {
        id.cleared = true;
    };
    input.timeout = global.setTimeout(() => {}, 1000);
    input.inputElement.listeners.change();

    assert.equal(clearedTimeouts[0].cleared, true);
    assert.equal(input.validateCalls, 1);

    global.setTimeout = realSetTimeout;
    global.clearTimeout = realClearTimeout;
});

const setupVersionInputInterface = () => {
    class TextInputInterface {
        constructor(fieldId, options) {
            this.fieldId = fieldId;
            this.options = options;
        }
    }

    global.StyledElements = {
        TextInputInterface,
        Utils: {},
        InputValidationError: {
            NO_ERROR: 0,
            VERSION_ERROR: 1,
        }
    };

    loadLegacyScript('src/wirecloud/commons/static/js/StyledElements/VersionInputInterface.js');
    return StyledElements.VersionInputInterface;
};

test('StyledElements.VersionInputInterface sets default placeholder', () => {
    resetLegacyRuntime();
    const VersionInputInterface = setupVersionInputInterface();
    const input = new VersionInputInterface('version', {});

    assert.equal(input.options.placeholder, '1.0');
});

test('StyledElements.VersionInputInterface respects custom placeholder', () => {
    resetLegacyRuntime();
    const VersionInputInterface = setupVersionInputInterface();
    const input = new VersionInputInterface('version', { placeholder: '2.0' });

    assert.equal(input.options.placeholder, '2.0');
});

test('StyledElements.VersionInputInterface accepts valid versions', () => {
    resetLegacyRuntime();
    const VersionInputInterface = setupVersionInputInterface();
    const input = new VersionInputInterface('version', {});

    assert.equal(input._checkValue('0'), 0);
    assert.equal(input._checkValue('1.2.3'), 0);
});

test('StyledElements.VersionInputInterface rejects invalid versions', () => {
    resetLegacyRuntime();
    const VersionInputInterface = setupVersionInputInterface();
    const input = new VersionInputInterface('version', {});

    assert.equal(input._checkValue('01.2'), 1);
    assert.equal(input._checkValue('1..2'), 1);
});

const setupVerticalLayout = () => {
    class StyledElement {
        constructor(events) {
            this.events = events;
        }
    }

    class Container {
        constructor(options) {
            this.options = options;
        }

        insertInto(parent) {
            parent.appendChild(document.createElement('section'));
            this.parent = parent;
        }

        repaint(temporal) {
            this.repaintArgs = temporal;
        }
    }

    global.StyledElements = {
        StyledElement,
        Container,
        Utils: {
            merge: (...objects) => Object.assign({}, ...objects),
            appendWord: (className, word) => className ? `${className} ${word}` : word,
        }
    };

    loadLegacyScript('src/wirecloud/commons/static/js/StyledElements/VerticalLayout.js');
    return StyledElements.VerticalLayout;
};

test('StyledElements.VerticalLayout creates wrapper and region containers', () => {
    resetLegacyRuntime();
    const VerticalLayout = setupVerticalLayout();
    const layout = new VerticalLayout({ class: 'custom' });

    assert.equal(layout.wrapperElement.className, 'custom se-vertical-layout');
    assert.equal(layout.north.options.class, 'se-vl-north-container');
    assert.equal(layout.center.options.class, 'se-vl-center-container');
    assert.equal(layout.south.options.class, 'se-vl-south-container');
});

test('StyledElements.VerticalLayout repaint delegates to all child containers', () => {
    resetLegacyRuntime();
    const VerticalLayout = setupVerticalLayout();
    const layout = new VerticalLayout();

    layout.repaint(true);

    assert.equal(layout.north.repaintArgs, true);
    assert.equal(layout.center.repaintArgs, true);
    assert.equal(layout.south.repaintArgs, true);
});
