const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    bootstrapWirecloudVersion,
    loadLegacyScripts,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    bootstrapWirecloudVersion();

    Wirecloud.ui = { WiringEditor: {} };

    Wirecloud.currentTheme = {
        templates: {
            'wirecloud/wiring/component_group': null
        }
    };

    // Reset LocalCatalogue mock state
    Wirecloud.LocalCatalogue = {
        getResourceId: () => ({
            title: 'Test Component',
            description: 'A test description',
            image: '/test.png'
        })
    };

    // Mock Select
    let selectChangeHandlers = [];
    StyledElements.Select = class Select extends StyledElements.StyledElement {
        constructor(options) {
            super(['change', 'focus', 'blur']);
            this.wrapperElement = document.createElement('div');
            this._value = options.initialValue;
            Select._lastInstance = this;
            Select._lastOptions = options;
        }
        getValue() { return this._value; }
        setValue(v) { this._value = v; }
        addEventListener(name, handler) {
            if (name === 'change') {
                selectChangeHandlers.push(handler);
            }
            return this;
        }
        _simulateChange() {
            selectChangeHandlers.forEach((fn) => fn());
        }
    };
    StyledElements.Select._lastInstance = null;
    StyledElements.Select._lastOptions = null;
    selectChangeHandlers = [];
    StyledElements.Select._changeHandlers = selectChangeHandlers;

    // Mock Tooltip
    StyledElements.Tooltip = class Tooltip extends StyledElements.StyledElement {
        constructor(options) {
            super([]);
            this.options = Object.assign({ content: '' }, options);
            Tooltip._lastInstance = this;
        }
        bind(element) {
            this._boundElement = element;
        }
    };
    StyledElements.Tooltip._lastInstance = null;

    // Mock Button
    let buttonClickHandlers = [];
    StyledElements.Button = class Button extends StyledElements.StyledElement {
        constructor(options) {
            super(['blur', 'click', 'dblclick', 'focus', 'mouseenter', 'mouseleave']);
            this.wrapperElement = document.createElement('div');
            Button._lastInstance = this;
            Button._lastOptions = options;
        }
        addEventListener(name, handler) {
            if (name === 'click') {
                buttonClickHandlers.push({ handler: handler });
            }
            return this;
        }
        addIconClassName() { return this; }
        setLabel() { return this; }
        setTitle() { return this; }
    };
    StyledElements.Button._lastInstance = null;
    StyledElements.Button._lastOptions = null;
    StyledElements.Button.prototype.Tooltip = StyledElements.Tooltip;
    buttonClickHandlers = [];
    StyledElements.Button._clickHandlers = buttonClickHandlers;

    // Mock GUIBuilder to return a Fragment with a wrapper div and append
    // all tcomponents so they have proper parentElement relationships
    StyledElements.GUIBuilder = class GUIBuilder {
        parse(template, tcomponents) {
            const wrapper = document.createElement('div');
            wrapper.className = 'se-component-group';

            if (tcomponents) {
                Object.values(tcomponents).forEach((comp) => {
                    if (comp instanceof StyledElements.StyledElement) {
                        wrapper.appendChild(comp.wrapperElement || comp.get());
                    } else if (comp != null && comp.nodeType != null) {
                        wrapper.appendChild(comp);
                    } else if (comp != null) {
                        wrapper.appendChild(document.createTextNode(String(comp)));
                    }
                });
            }

            const fragment = new StyledElements.Fragment([document.createTextNode(''), wrapper]);
            return fragment;
        }
    };

    // Load Fragment needed by GUIBuilder mock
    loadLegacyScripts([
        'src/wirecloud/commons/static/js/StyledElements/Fragment.js',
    ]);
});

// Helper to create a default resource object
function createResource(overrides) {
    const version = new Wirecloud.Version('1.0');
    return Object.assign({
        version: version,
        others: [],
        vendor: 'TestVendor',
        name: 'TestComponent'
    }, overrides);
}

// ============================================================================
// Constructor tests
// ============================================================================

test('ComponentGroup constructor with default title', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    assert.ok(group instanceof Wirecloud.ui.WiringEditor.ComponentGroup);
    assert.ok(group instanceof StyledElements.StyledElement);
    assert.ok(group.titleElement instanceof global.Node);
    assert.equal(group.titleElement.tagName, 'SPAN');
    assert.ok(group.imageElement instanceof global.Node);
    assert.equal(group.imageElement.tagName, 'IMG');
    assert.ok(group.descriptionElement instanceof global.Node);
    assert.equal(group.descriptionElement.tagName, 'DIV');
    assert.equal(group.descriptionElement.className, 'text-muted');
    assert.equal(group.descriptionElement.getAttribute('role'), 'note');
    assert.deepStrictEqual(group.components, {});

    // tooltip was created and bound
    assert.ok(group.tooltip instanceof StyledElements.Tooltip);
    assert.equal(group.tooltip._boundElement, group.titleElement);

    // id is set via defineProperties
    assert.equal(group.id, 'TestVendor/TestComponent');

    // wrapperElement has data-id
    assert.equal(group.wrapperElement.getAttribute('data-id'), 'TestVendor/TestComponent');

    // Default title for button was "Create"
    assert.equal(StyledElements.Button._lastOptions.title, 'Create');

    // imageElement has alt attribute and onerror handler
    assert.equal(group.imageElement.getAttribute('alt'), 'Create');
    assert.equal(typeof group.imageElement.onerror, 'function');
});

test('ComponentGroup constructor with custom title', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource, 'Custom Title');

    assert.equal(StyledElements.Button._lastOptions.title, 'Custom Title');
    assert.equal(group.imageElement.getAttribute('alt'), 'Custom Title');
});

test('ComponentGroup constructor calls version_onchange immediately', () => {
    let getResourceIdCalls = [];
    Wirecloud.LocalCatalogue.getResourceId = (key) => {
        getResourceIdCalls.push(key);
        return { title: 'Loaded Meta', description: 'Meta Desc', image: '/meta.png' };
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    assert.equal(getResourceIdCalls.length, 1);
    assert.equal(getResourceIdCalls[0], 'TestVendor/TestComponent/1.0');
    assert.equal(group.titleElement.textContent, 'Loaded Meta');
    assert.equal(group.tooltip.options.content, 'Loaded Meta');
    assert.equal(group.descriptionElement.textContent, 'Meta Desc');
    assert.equal(group.imageElement.src, '/meta.png');
});

test('ComponentGroup constructor - meta.description is falsy shows fallback text', () => {
    Wirecloud.LocalCatalogue.getResourceId = () => ({
        title: 'No Desc',
        description: '',
        image: null
    });

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    assert.equal(group.descriptionElement.textContent, 'No description provided');
});

test('ComponentGroup constructor - null description shows fallback', () => {
    Wirecloud.LocalCatalogue.getResourceId = () => ({
        title: 'No Desc',
        description: null,
        image: '/img.png'
    });

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    assert.equal(group.descriptionElement.textContent, 'No description provided');
});

// ============================================================================
// setImage tests (called via version_onchange)
// ============================================================================

test('setImage with valid imageURL sets src attribute', () => {
    Wirecloud.LocalCatalogue.getResourceId = () => ({
        title: 'Test',
        description: 'Desc',
        image: '/valid-image.png'
    });

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    assert.equal(group.imageElement.src, '/valid-image.png');

    // Parent should NOT have se-thumbnail-missing class
    const parent = group.imageElement.parentElement;
    assert.ok(!parent.classList.contains('se-thumbnail-missing'));

    // Parent was cleared then image re-appended
    assert.equal(parent.childNodes.length, 1);
    assert.equal(parent.childNodes[0], group.imageElement);
});

test('setImage with null/undefined imageURL calls image_onerror', () => {
    Wirecloud.LocalCatalogue.getResourceId = () => ({
        title: 'Test',
        description: 'Desc',
        image: null
    });

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    const parent = group.imageElement.parentElement;
    assert.ok(parent.classList.contains('se-thumbnail-missing'));

    // Check "No image available" text node was appended
    const textNodes = parent.childNodes.filter((c) => c.nodeType === 3);
    assert.equal(textNodes.length, 1);
    assert.equal(textNodes[0].textContent, 'No image available');

    // Image has no src attribute
    assert.equal(group.imageElement.getAttribute('src'), null);
});

test('setImage with falsy string imageURL calls image_onerror', () => {
    Wirecloud.LocalCatalogue.getResourceId = () => ({
        title: 'Test',
        description: 'Desc',
        image: ''
    });

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    const parent = group.imageElement.parentElement;
    assert.ok(parent.classList.contains('se-thumbnail-missing'));
});

// ============================================================================
// image_onerror tests
// ============================================================================

test('image_onerror triggered by img onerror handler', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    // Reset parent state to simulate fresh error
    const parent = group.imageElement.parentElement;
    parent.classList.remove('se-thumbnail-missing');
    parent.innerHTML = '';
    parent.appendChild(group.imageElement);

    // Trigger onerror
    group.imageElement.onerror();

    assert.ok(parent.classList.contains('se-thumbnail-missing'));
    const textNodes = parent.childNodes.filter((c) => c.nodeType === 3);
    assert.equal(textNodes.length, 1);
    assert.equal(textNodes[0].textContent, 'No image available');
});

// ============================================================================
// orderVersions tests
// ============================================================================

test('orderVersions sorts versions descending and marks first as latest', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const v1 = new Wirecloud.Version('1.0');
    const v2 = new Wirecloud.Version('2.0');
    const v3 = new Wirecloud.Version('0.9');

    const resource = createResource({
        version: v1,
        others: [v2, v3]
    });
    new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    // Select options should have sorted versions
    // 2.0 (latest), 1.0, 0.9
    const options = StyledElements.Select._lastOptions.initialEntries;
    assert.equal(options.length, 3);
    assert.equal(options[0].label, '2.0 (latest)');
    assert.equal(options[0].value.text, '2.0');
    assert.equal(options[1].text, '1.0');
    assert.equal(options[2].text, '0.9');
});

test('orderVersions with single version marks as latest', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const v1 = new Wirecloud.Version('3.5');

    const resource = createResource({
        version: v1,
        others: []
    });
    new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    const options = StyledElements.Select._lastOptions.initialEntries;
    assert.equal(options.length, 1);
    assert.equal(options[0].label, '3.5 (latest)');
    assert.equal(options[0].value.text, '3.5');
});

test('orderVersions with pre-release versions sorts correctly', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const v1 = new Wirecloud.Version('1.0');
    const v2 = new Wirecloud.Version('1.0a1');
    const v3 = new Wirecloud.Version('1.0b2');

    const resource = createResource({
        version: v1,
        others: [v2, v3]
    });
    new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    // 1.0 should be latest (no pre-release), then b2, then a1
    const options = StyledElements.Select._lastOptions.initialEntries;
    assert.equal(options.length, 3);
    assert.equal(options[0].value.text, '1.0');
    assert.equal(options[1].text, '1.0b2');
    assert.equal(options[2].text, '1.0a1');
});

// ============================================================================
// version_onchange tests (triggered by select change)
// ============================================================================

test('version_onchange updates meta when select changes', () => {
    let getResourceIdCalls = [];
    Wirecloud.LocalCatalogue.getResourceId = (key) => {
        getResourceIdCalls.push(key);
        return { title: 'New Version Meta', description: 'Updated desc', image: '/new.png' };
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    // Constructor already called getResourceId once
    assert.equal(getResourceIdCalls.length, 1);

    // Trigger change with new version
    const selectInstance = StyledElements.Select._lastInstance;
    const newVersion = new Wirecloud.Version('2.0');
    selectInstance._value = newVersion;
    StyledElements.Select._changeHandlers.forEach((fn) => fn(selectInstance));

    assert.equal(getResourceIdCalls.length, 2);
    assert.equal(getResourceIdCalls[1], 'TestVendor/TestComponent/2.0');
    assert.equal(group.titleElement.textContent, 'New Version Meta');
    assert.equal(group.tooltip.options.content, 'New Version Meta');
    assert.equal(group.descriptionElement.textContent, 'Updated desc');
    assert.equal(group.imageElement.src, '/new.png');
});

test('version_onchange with falsy description shows fallback', () => {
    let callCount = 0;
    Wirecloud.LocalCatalogue.getResourceId = () => {
        callCount++;
        if (callCount === 1) {
            return { title: 'First', description: 'First desc', image: '/first.png' };
        }
        return { title: 'Second', description: null, image: '/second.png' };
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    // Trigger change
    const selectInstance = StyledElements.Select._lastInstance;
    const newVersion = new Wirecloud.Version('2.0');
    selectInstance._value = newVersion;
    StyledElements.Select._changeHandlers.forEach((fn) => fn(selectInstance));

    assert.equal(group.descriptionElement.textContent, 'No description provided');
    assert.equal(group.imageElement.src, '/second.png');
});

// ============================================================================
// version select configuration tests
// ============================================================================

test('Select is created with correct initialValue and version entries', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const vCurrent = new Wirecloud.Version('2.0');
    const vOther = new Wirecloud.Version('1.0');

    const resource = createResource({ version: vCurrent, others: [vOther] });
    new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    const options = StyledElements.Select._lastOptions;
    assert.equal(options.initialValue, vCurrent);
    assert.equal(options.initialEntries.length, 2);
});

// ============================================================================
// Button click handler tests
// ============================================================================

test('Button click dispatches btncreate.click event', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    let dispatched = false;
    let dispatchedButton = null;
    group.addEventListener('btncreate.click', (ctx, btn) => {
        dispatched = true;
        dispatchedButton = btn;
    });

    // Simulate button click
    const buttonInstance = StyledElements.Button._lastInstance;
    const clickHandlers = StyledElements.Button._clickHandlers;
    clickHandlers.forEach((entry) => entry.handler());

    assert.ok(dispatched);
    assert.equal(dispatchedButton, buttonInstance);
});

test('Button is created with correct options', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    const btnOptions = StyledElements.Button._lastOptions;
    assert.equal(btnOptions.class, 'btn-create wc-create-resource-component');
    assert.equal(btnOptions.iconClass, 'fas fa-plus');
    assert.equal(btnOptions.title, 'Create');
});

test('Button click handler is properly bound to group instance', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    let capturedThis = null;
    group.addEventListener('btncreate.click', function () {
        capturedThis = this;
    });

    StyledElements.Button._clickHandlers.forEach((entry) => entry.handler());

    assert.equal(capturedThis, group);
});

// ============================================================================
// addComponent tests
// ============================================================================

test('addComponent adds new component to wrapper and stores in dict', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    let appendToArg = null;
    const mockComponent = {
        id: 'comp-1',
        appendTo: function (target) {
            appendToArg = target;
            return this;
        }
    };

    const result = group.addComponent(mockComponent);

    assert.equal(result, group);
    assert.equal(appendToArg, group.wrapperElement);
    assert.equal(group.components['comp-1'], mockComponent);
});

test('addComponent returns the component stored by appendTo', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    const appendedResult = { id: 'comp-2', marker: true };
    const mockComponent = {
        id: 'comp-2',
        appendTo: function () {
            return appendedResult;
        }
    };

    group.addComponent(mockComponent);
    assert.equal(group.components['comp-2'], appendedResult);
});

test('addComponent does not re-add component if id already exists', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    let appendToCalls = 0;
    const mockComponent = {
        id: 'comp-3',
        appendTo: function () {
            appendToCalls++;
            return this;
        }
    };

    group.addComponent(mockComponent);
    assert.equal(appendToCalls, 1);

    // Second call should not call appendTo
    group.addComponent(mockComponent);
    assert.equal(appendToCalls, 1);

    // Component still stored
    assert.equal(group.components['comp-3'], mockComponent);
});

test('addComponent can add multiple different components', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    const comp1 = { id: 'a', appendTo: function () { return this; } };
    const comp2 = { id: 'b', appendTo: function () { return this; } };

    group.addComponent(comp1);
    group.addComponent(comp2);

    assert.equal(Object.keys(group.components).length, 2);
    assert.equal(group.components['a'], comp1);
    assert.equal(group.components['b'], comp2);
});

// ============================================================================
// Integration / lifecycle tests
// ============================================================================

test('ComponentGroup is a StyledElement with correct events', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    // Should have inherited events from StyledElement (hide, show) plus btncreate.click
    assert.ok('btncreate.click' in group.events);
    assert.ok('hide' in group.events);
    assert.ok('show' in group.events);

    // Should be able to dispatch the custom event
    assert.doesNotThrow(() => {
        group.dispatchEvent('btncreate.click', null);
    });
});

test('ComponentGroup wrapperElement className is from GUIBuilder', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    assert.equal(group.wrapperElement.className, 'se-component-group');
});

test('Tooltip is created and configured', () => {
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentGroup.js',
    ]);

    const resource = createResource();
    const group = new Wirecloud.ui.WiringEditor.ComponentGroup(resource);

    assert.ok(group.tooltip instanceof StyledElements.Tooltip);
    assert.equal(group.tooltip._boundElement, group.titleElement);
    assert.equal(typeof group.tooltip.options.content, 'string');
});
