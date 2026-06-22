const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

// ── shared mock helpers ──────────────────────────────────────────────

const makeMockElement = () => document.createElement('div');

const makeBasicSelectors = () => {
    const div = makeMockElement();

    const wiringView = {};
    [
        'sidebar_input', 'sidebarcomponent_by_id', 'sidebarcomponentgroup_by_id',
        'behaviour_engine', 'endpoint_by_name', 'connection_engine',
        'create_behaviour_button', 'enable_behaviours_button',
        'show_behaviours_button', 'show_behaviour_prefs_button', 'component_by_id',
    ].forEach((name) => { wiringView[name] = () => () => div; });

    const workspaceView = {};
    ['widget_by_title', 'widget_element'].forEach((name) => {
        workspaceView[name] = () => () => div;
    });

    const bs = { wiringView, workspaceView };
    [
        'toolbar_button', 'mac_wallet_input', 'mac_wallet_resource',
        'mac_wallet_resource_mainbutton', 'element', 'menu_item', 'form_field',
        'button', 'back_button',
    ].forEach((name) => { bs[name] = () => () => div; });

    return bs;
};

const makeBasicActions = () => {
    const noop = () => () => {};
    const ba = {};
    [
        'switch_view', 'create_workspace', 'uploadComponent', 'sleep',
        'wait_transitions', 'click', 'input', 'scrollIntoView',
    ].forEach((name) => { ba[name] = () => noop; });

    ba.editorView = { wait_mac_wallet_ready: () => noop };
    ba.wiringView = { wait_sidebar_ready: () => noop };
    return ba;
};

const setupWirecloudBaseForTutorials = () => {
    bootstrapStyledElementsBase();

    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.activeWorkspace = {
        view: { widgets: [] },
        widgets: [],
    };
    Wirecloud.UserInterfaceManager = {
        currentWindowMenu: { form: { fieldInterfaces: {} } },
        views: { workspace: {}, wiring: {} },
        changeCurrentView() {},
    };
    Wirecloud.URLs = { LOCAL_REPOSITORY: '/repo' };
    Wirecloud.LocalCatalogue = {
        resourceExistsId() { return false; },
        addComponent() { return Promise.resolve(); },
    };
    Wirecloud.createWorkspace = () => Promise.resolve();
    Wirecloud.changeActiveWorkspace = () => Promise.resolve();
    global.utils = { gettext: (t) => t };
    Wirecloud.ui = Wirecloud.ui || {};
    Wirecloud.ui.Tutorial = {};

    loadLegacyScript('src/wirecloud/commons/static/js/wirecloud/ui/Tutorial.js');

    Wirecloud.ui.Tutorial.WidgetElement = class {};
    Wirecloud.ui.Tutorial.Utils = {
        basic_selectors: makeBasicSelectors(),
        basic_actions: makeBasicActions(),
    };

    class MockStep {
        constructor(tutorial, instruction) {
            this.tutorial = tutorial;
            this.instruction = instruction;
        }
        setLast() {}
        setNext() {}
        activate() {}
        destroy() {}
    }
    Wirecloud.ui.Tutorial.SimpleDescription = MockStep;
    Wirecloud.ui.Tutorial.UserAction = MockStep;
    Wirecloud.ui.Tutorial.FormAction = MockStep;
    Wirecloud.ui.Tutorial.AutoAction = MockStep;

    loadLegacyScript('src/wirecloud/commons/static/js/wirecloud/ui/TutorialCatalogue.js');
};

// ── BasicConcepts ────────────────────────────────────────────────────

test.beforeEach(() => { resetLegacyRuntime(); });

test('BasicConcepts tutorial is registered in TutorialCatalogue', () => {
    setupWirecloudBaseForTutorials();
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BasicConcepts.js');

    const tutorial = Wirecloud.TutorialCatalogue.get('basic-concepts');
    assert.ok(tutorial != null);
    assert.equal(tutorial.label, 'Basic concepts');
    assert.ok(Array.isArray(tutorial.instructions));
    assert.ok(tutorial.instructions.length > 0);
});

test('BasicConcepts tutorial instructions have expected step types', () => {
    setupWirecloudBaseForTutorials();
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BasicConcepts.js');

    const tutorial = Wirecloud.TutorialCatalogue.get('basic-concepts');
    const types = tutorial.instructions.map((step) => step.type);
    assert.ok(types.includes('simpleDescription'));
    assert.ok(types.includes('autoAction'));
    assert.ok(types.includes('userAction'));
    assert.ok(types.includes('formAction'));
});

test('BasicConcepts tutorial can start and has control layers', () => {
    setupWirecloudBaseForTutorials();
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BasicConcepts.js');

    const tutorial = Wirecloud.TutorialCatalogue.get('basic-concepts');
    tutorial.start();
    assert.equal(document.body.childNodes.includes(tutorial.controlLayer), true);
    assert.equal(tutorial.controlLayer.classList.contains('controlLayer'), true);
});

test('BasicConcepts tutorial helper callbacks resolve DOM targets and validators', async () => {
    setupWirecloudBaseForTutorials();
    const titleSpan = document.createElement('span');
    const menuButton = document.createElement('button');
    const heading = {
        getElementsByTagName(name) {
            return name === 'span' ? [titleSpan] : [];
        }
    };
    const wrapperElement = {
        getElementsByClassName(name) {
            if (name === 'wc-widget-heading') {
                return [heading];
            }
            if (name === 'wc-menu-button') {
                return [menuButton];
            }
            return [];
        }
    };
    Wirecloud.activeWorkspace.view.widgets = [{ wrapperElement }, { wrapperElement }];
    const menubar = document.createElement('div');
    const oldQuerySelector = document.querySelector || function () { return null; };
    document.querySelector = (selector) => selector === '.wiring-sidebar .we-panel-components' ? menubar : oldQuerySelector.call(document, selector);

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BasicConcepts.js');
    const tutorial = Wirecloud.TutorialCatalogue.get('basic-concepts');

    const functionElements = tutorial.instructions
        .map((instruction) => instruction.elem)
        .filter((elem) => typeof elem === 'function');
    assert.equal(functionElements.includes(titleSpan), false);
    assert.equal(functionElements.some((elem) => elem() === titleSpan), true);
    assert.equal(functionElements.some((elem) => elem() === menuButton), true);
    assert.equal(functionElements.some((elem) => elem() === menubar), true);

    const keypressInstruction = tutorial.instructions.find((instruction) => typeof instruction.eventFilterFunction === 'function');
    assert.equal(keypressInstruction.eventFilterFunction({ keyCode: 13 }), true);
    assert.equal(keypressInstruction.eventFilterFunction({ keyCode: 27 }), false);

    const formInstruction = tutorial.instructions.find((instruction) => instruction.type === 'formAction');
    assert.equal(formInstruction.actionElementsValidators[0]({ value: 'x' }), true);
    assert.equal(formInstruction.actionElementsValidators[0]({ value: '' }), false);

    const oldSetInterval = global.setInterval;
    const oldClearInterval = global.clearInterval;
    let intervalId = 0;
    global.setInterval = (callback) => {
        intervalId += 1;
        queueMicrotask(callback);
        return intervalId;
    };
    global.clearInterval = () => {};
    let form;
    formInstruction.form((value) => { form = value; });
    await Promise.resolve();
    assert.equal(form, Wirecloud.UserInterfaceManager.currentWindowMenu.form);
    global.setInterval = oldSetInterval;
    global.clearInterval = oldClearInterval;
    document.querySelector = oldQuerySelector;
});

// ── BehaviourOrientedWiring ──────────────────────────────────────────

test('BehaviourOrientedWiring tutorial is registered in TutorialCatalogue', () => {
    setupWirecloudBaseForTutorials();
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BehaviourOrientedWiring.js');

    const tutorial = Wirecloud.TutorialCatalogue.get('mashup-wiring-design');
    assert.ok(tutorial != null);
    assert.equal(tutorial.label, 'Behaviour Oriented Wiring');
    assert.ok(Array.isArray(tutorial.instructions));
    assert.ok(tutorial.instructions.length > 0);
});

test('BehaviourOrientedWiring tutorial instructions have expected step types', () => {
    setupWirecloudBaseForTutorials();
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BehaviourOrientedWiring.js');

    const tutorial = Wirecloud.TutorialCatalogue.get('mashup-wiring-design');
    const types = tutorial.instructions.map((step) => step.type);
    assert.ok(types.includes('simpleDescription'));
    assert.ok(types.includes('autoAction'));
    assert.ok(types.includes('userAction'));
});

test('BehaviourOrientedWiring tutorial can start and has control layers', () => {
    setupWirecloudBaseForTutorials();
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BehaviourOrientedWiring.js');

    const tutorial = Wirecloud.TutorialCatalogue.get('mashup-wiring-design');
    tutorial.start();
    assert.equal(document.body.childNodes.includes(tutorial.controlLayer), true);
    assert.equal(tutorial.controlLayer.classList.contains('controlLayer'), true);
});

test('BehaviourOrientedWiring tutorial helper callbacks resolve behaviour DOM and actions', () => {
    setupWirecloudBaseForTutorials();
    const elements = {};
    const make = (text) => {
        const element = document.createElement('div');
        element.textContent = text || '';
        element.clicked = false;
        element.click = () => { element.clicked = true; };
        return element;
    };
    const accept = make('accept');
    const behaviourTitle = make('Behaviour title');
    const behaviour = {
        querySelector(selector) {
            return selector === '.behaviour-title' ? behaviourTitle : make(selector);
        }
    };
    const operator = {
        classList: { contains: (name) => name === 'component-operator' },
        getAttribute: () => 'op1',
        querySelector(selector) {
            if (selector === '.panel-title' || selector === '.component-title') {
                return make('Technical Service');
            }
            return make(selector);
        }
    };
    const sourceWidget = {
        classList: { contains: (name) => name === 'component-widget' },
        getAttribute: () => 'w1',
        querySelector(selector) {
            if (selector === '.panel-title' || selector === '.component-title') {
                return make('Technician List');
            }
            return make(selector);
        }
    };
    const targetWidget = {
        classList: { contains: (name) => name === 'component-widget' },
        getAttribute: () => 'w2',
        querySelector(selector) {
            if (selector === '.panel-title' || selector === '.component-title') {
                return make('Technician Profile');
            }
            return make(selector);
        }
    };
    const connectionOptions = {
        getAttribute(name) {
            if (name === 'data-sourceid') {
                return 'operator/op1/technician';
            }
            if (name === 'data-targetid') {
                return 'widget/w1/technician';
            }
            return null;
        },
        querySelector: (selector) => make(selector)
    };
    const alertModal = {
        querySelector: (selector) => make(selector)
    };
    const behaviourPanel = {
        querySelector(selector) {
            elements[selector] = elements[selector] || make(selector);
            return elements[selector];
        }
    };

    const oldQuerySelector = document.querySelector || function () { return null; };
    const oldQuerySelectorAll = document.querySelectorAll;
    document.querySelector = (selector) => {
        if (selector === '.we-new-behaviour-modal' || selector === '.behaviour-update-form') {
            return { querySelector: () => accept };
        }
        if (selector === '.wiring-sidebar .behaviour-panel .btn-create-behaviour') {
            return make('create');
        }
        if (selector === '.wiring-sidebar .btn-display-operator-group') {
            return { click() { this.clicked = true; } };
        }
        if (selector === '.wiring-sidebar .behaviour-panel .btn-enable-behaviours') {
            return make('enable');
        }
        if (selector === '.wc-alert-modal') {
            return alertModal;
        }
        if (selector === '.wiring-sidebar .behaviour-panel') {
            return behaviourPanel;
        }
        return oldQuerySelector.call(document, selector);
    };
    document.querySelectorAll = (selector) => {
        if (selector === '.we-panel-behaviours .behaviour' || selector === '.wiring-sidebar .behaviour-panel .behaviour') {
            return [behaviour, behaviour];
        }
        if (selector === '.component-draggable.component-widget') {
            return [targetWidget, sourceWidget];
        }
        if (selector === '.wiring-sidebar .component-panel .component-operator') {
            return [operator];
        }
        if (selector === '.connection-options') {
            return [connectionOptions];
        }
        if (selector === '.component-draggable') {
            return [operator, sourceWidget, targetWidget];
        }
        return oldQuerySelectorAll.call(document, selector);
    };

    const connection = {
        targetComponent: { type: 'widget', title: 'Technician List' },
        target: { endpoint: { name: 'technician' } }
    };
    const locationConnection = {
        targetComponent: { type: 'widget', title: 'Technician Location' },
        target: { endpoint: { name: 'poiInputCenter' } }
    };
    const behaviourEngine = {
        updated: [],
        createBehaviour(data) {
            return {
                data,
                get() {
                    return data;
                }
            };
        },
        activate(value) {
            this.activated = value;
        },
        updateConnection(value, enabled) {
            this.updated.push({ value, enabled });
        },
        forEachComponent(callback) {
            callback({
                type: 'operator',
                title: 'Technical Service',
                getEndpoint() {
                    return {
                        forEachConnection(handler) {
                            handler(connection);
                            handler(locationConnection);
                        }
                    };
                }
            });
            callback({
                type: 'widget',
                title: 'Technician List',
                getEndpoint() {
                    return {
                        forEachConnection(handler) {
                            handler(locationConnection);
                        }
                    };
                }
            });
        }
    };
    Wirecloud.ui.Tutorial.Utils.basic_selectors.wiringView.behaviour_engine = () => () => behaviourEngine;

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BehaviourOrientedWiring.js');
    const tutorial = Wirecloud.TutorialCatalogue.get('mashup-wiring-design');
    const elems = tutorial.instructions.map((instruction) => instruction.elem).filter((elem) => typeof elem === 'function');

    assert.equal(elems.some((elem) => elem() === accept), true);
    assert.equal(elems.some((elem) => elem() === behaviourTitle), true);

    const autoCreate = elems.find((elem) => {
        const result = elem();
        return result && result.title === 'Locate technicians';
    });
    assert.ok(autoCreate);
    assert.equal(behaviourEngine.updated.some((entry) => entry.value === connection && entry.enabled === true), true);
    assert.equal(behaviourEngine.updated.some((entry) => entry.value === locationConnection && entry.enabled === true), true);

    document.querySelector = oldQuerySelector;
    document.querySelectorAll = oldQuerySelectorAll;
});

test('BehaviourOrientedWiring wiringView.accept_form returns a function that queries .btn-accept', () => {
    setupWirecloudBaseForTutorials();

    var acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn-accept';

    var acceptFormSelectorsHit = [];
    var oldQuerySelector = document.querySelector;
    var oldQuerySelectorAll = document.querySelectorAll || function () { return []; };
    document.querySelectorAll = function (selector) {
        if (selector === '.we-panel-behaviours .behaviour' || selector === '.wiring-sidebar .behaviour-panel .behaviour') {
            return [document.createElement('div'), document.createElement('div')];
        }
        if (selector === '.component-draggable.component-widget') {
            return [document.createElement('div'), document.createElement('div')];
        }
        if (selector === '.component-draggable.component-operator') {
            return [document.createElement('div')];
        }
        if (selector === '.connection-options') {
            return [];
        }
        if (selector === '.component-draggable') {
            return [document.createElement('div'), document.createElement('div'), document.createElement('div')];
        }
        if (selector === '.wiring-sidebar .component-panel .component-operator') {
            return [document.createElement('div')];
        }
        return oldQuerySelectorAll.call(document, selector);
    };
    document.querySelector = function (selector) {
        if (selector === '.we-new-behaviour-modal' || selector === '.behaviour-update-form') {
            acceptFormSelectorsHit.push(selector);
            return {
                querySelector: function (innerSelector) {
                    assert.strictEqual(innerSelector, '.btn-accept');
                    return acceptBtn;
                }
            };
        }
        return oldQuerySelector.call(document, selector);
    };

    // findConnection is used by auto_create_behaviour — mock behaviour_engine
    Wirecloud.ui.Tutorial.Utils.basic_selectors.wiringView.behaviour_engine = function () {
        return function () {
            return { forEachComponent: function () {} };
        };
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BehaviourOrientedWiring.js');

    var tutorial = Wirecloud.TutorialCatalogue.get('mashup-wiring-design');
    var elems = tutorial.instructions.map(function (instruction) { return instruction.elem; }).filter(function (elem) { return typeof elem === 'function'; });
    assert.ok(elems.length > 0);

    // accept_form is referenced by two userAction steps: one for .we-new-behaviour-modal
    // (line 216 in source) and one for .behaviour-update-form (line 236). Invoke them.
    var results = [];
    for (var i = 0; i < elems.length; i++) {
        try {
            results.push({ index: i, value: elems[i]() });
        } catch (_) {
            // some elem inner functions need a fuller DOM mock — skip them
        }
    }

    assert.ok(acceptFormSelectorsHit.length >= 2, 'accept_form should have been called twice during script load');
    assert.ok(acceptFormSelectorsHit.indexOf('.we-new-behaviour-modal') >= 0);
    assert.ok(acceptFormSelectorsHit.indexOf('.behaviour-update-form') >= 0);
    assert.ok(results.some(function (r) { return r.value === acceptBtn; }), 'at least one elem should return the acceptBtn');

    document.querySelector = oldQuerySelector;
    document.querySelectorAll = oldQuerySelectorAll;
});

test('BehaviourOrientedWiring helper selectors return null when matches are missing', () => {
    setupWirecloudBaseForTutorials();

    const unmatchedWidget = {
        classList: { contains: (name) => name === 'component-widget' },
        querySelector(selector) {
            if (selector === '.panel-title') {
                return { textContent: 'Another Widget' };
            }
            return document.createElement('div');
        }
    };
    const unmatchedOperator = {
        querySelector(selector) {
            if (selector === '.component-title') {
                return { textContent: 'Different Operator' };
            }
            return document.createElement('div');
        }
    };

    const oldQuerySelector = document.querySelector || function () { return null; };
    const oldQuerySelectorAll = document.querySelectorAll || function () { return []; };
    document.querySelector = function (selector) {
        if (selector === '.wiring-sidebar .btn-display-operator-group') {
            return { click() {} };
        }
        return oldQuerySelector.call(document, selector);
    };
    document.querySelectorAll = function (selector) {
        if (selector === '.component-draggable.component-widget') {
            return [unmatchedWidget];
        }
        if (selector === '.wiring-sidebar .component-panel .component-operator') {
            return [unmatchedOperator];
        }
        if (selector === '.we-panel-behaviours .behaviour' || selector === '.wiring-sidebar .behaviour-panel .behaviour') {
            return [];
        }
        if (selector === '.connection-options' || selector === '.component-draggable') {
            return [];
        }
        return oldQuerySelectorAll.call(document, selector);
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BehaviourOrientedWiring.js');

    const tutorial = Wirecloud.TutorialCatalogue.get('mashup-wiring-design');
    const elems = tutorial.instructions.map((instruction) => instruction.elem).filter((elem) => typeof elem === 'function');

    const resolvedValues = [];
    elems.forEach((elem) => {
        try {
            resolvedValues.push(elem());
        } catch (_) {}
    });

    assert.equal(resolvedValues.includes(null), true);

    document.querySelector = oldQuerySelector;
    document.querySelectorAll = oldQuerySelectorAll;
});

test('BehaviourOrientedWiring helper selectors cover behaviour action and detail elements', () => {
    setupWirecloudBaseForTutorials();

    const behaviourTitle = document.createElement('span');
    behaviourTitle.className = 'behaviour-title';
    const behaviourDescription = document.createElement('span');
    behaviourDescription.className = 'behaviour-description';
    const behaviourNode = {
        querySelector(selector) {
            if (selector === '.behaviour-title') {
                return behaviourTitle;
            }
            if (selector === '.behaviour-description') {
                return behaviourDescription;
            }
            return document.createElement('div');
        }
    };

    const oldQuerySelector = document.querySelector || function () { return null; };
    const oldQuerySelectorAll = document.querySelectorAll || function () { return []; };
    document.querySelector = function (selector) {
        if (selector === '.wiring-sidebar .btn-display-operator-group') {
            return { click() {} };
        }
        return oldQuerySelector.call(document, selector);
    };
    document.querySelectorAll = function (selector) {
        if (selector === '.wiring-sidebar .behaviour-panel .behaviour') {
            return [behaviourNode];
        }
        if (selector === '.we-panel-behaviours .behaviour') {
            return [behaviourNode];
        }
        if (selector === '.connection-options' || selector === '.component-draggable' || selector === '.component-draggable.component-widget' || selector === '.wiring-sidebar .component-panel .component-operator') {
            return [];
        }
        return oldQuerySelectorAll.call(document, selector);
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Tutorials/BehaviourOrientedWiring.js');

    const tutorial = Wirecloud.TutorialCatalogue.get('mashup-wiring-design');
    const elems = tutorial.instructions.map((instruction) => instruction.elem).filter((elem) => typeof elem === 'function');

    const resolvedValues = [];
    elems.forEach((elem) => {
        try {
            resolvedValues.push(elem());
        } catch (_) {}
    });

    assert.equal(resolvedValues.includes(behaviourTitle), true);

    document.querySelector = oldQuerySelector;
    document.querySelectorAll = oldQuerySelectorAll;
});

// ── PreferencesWindowMenu ────────────────────────────────────────────

const setupPreferencesWindowMenu = () => {
    bootstrapStyledElementsBase();

    class Button {
        constructor(opts) {
            this.opts = opts;
            this.classes = [];
            this.disabled = false;
        }
        addClassName(cls) { this.classes.push(cls); return this; }
        removeClassName(cls) { this.classes = this.classes.filter((c) => c !== cls); return this; }
        disable() { this.disabled = true; return this; }
        enable() { this.disabled = false; return this; }
    }

    class Form {
        constructor(fields, opts) {
            this.fields = fields;
            this.opts = opts;
            this.setdefaultsButton = new Button();
            this.cancelButton = new Button();
            this.acceptButton = new Button();
            this.events = {};
            this.parentNode = null;
        }
        insertInto(node) { this.parentNode = node; }
        addEventListener(name, handler) { this.events[name] = handler; }
    }

    class WindowMenu {
        constructor(title, extraClass) {
            this.title = title;
            this.extraClass = extraClass;
            this.windowContent = document.createElement('div');
            this.windowBottom = document.createElement('div');
            this.htmlElement = document.createElement('div');
            this.showParents = [];
            this.hideCount = 0;
        }
        show(parent) { this.showParents.push(parent); return this; }
        hide() { this.hideCount += 1; return this; }
    }

    global.StyledElements = Object.assign(StyledElements, { Form, Button });
    global.Wirecloud = {
        ui: { WindowMenu },
        Widget: {},
        Utils: { gettext: (t) => t },
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/Widget/PreferencesWindowMenu.js');
};

test('PreferencesWindowMenu constructor extends WindowMenu', () => {
    resetLegacyRuntime();
    setupPreferencesWindowMenu();

    const menu = new Wirecloud.Widget.PreferencesWindowMenu();
    assert.equal(menu.title, 'Settings');
    assert.equal(menu.extraClass, 'wc-component-preferences-modal');
});

test('PreferencesWindowMenu show creates Form with field interfaces', () => {
    resetLegacyRuntime();
    setupPreferencesWindowMenu();

    const menu = new Wirecloud.Widget.PreferencesWindowMenu();
    const widgetModel = {
        preferenceList: [
            {
                hidden: false,
                meta: { name: 'title' },
                getInterfaceDescription: () => ({ type: 'text', default: 'x' }),
            },
            {
                hidden: false,
                meta: { name: 'visible' },
                getInterfaceDescription: () => ({ type: 'boolean', default: true }),
            },
            {
                hidden: true,
                meta: { name: 'internal' },
                getInterfaceDescription: () => ({ type: 'text' }),
            },
        ],
        setPreferences() { return Promise.resolve(); },
    };

    menu.show(widgetModel, null);
    assert.ok(menu.form != null);
    assert.equal(Object.keys(menu.form.fields).length, 2);
    assert.equal('title' in menu.form.fields, true);
    assert.equal('visible' in menu.form.fields, true);
    assert.equal('internal' in menu.form.fields, false);
});

test('PreferencesWindowMenu show skips hidden preferences', () => {
    resetLegacyRuntime();
    setupPreferencesWindowMenu();

    const menu = new Wirecloud.Widget.PreferencesWindowMenu();
    const widgetModel = {
        preferenceList: [
            {
                hidden: true,
                meta: { name: 'secret' },
                getInterfaceDescription: () => ({ type: 'password' }),
            },
        ],
        setPreferences() { return Promise.resolve(); },
    };

    menu.show(widgetModel, null);
    assert.ok(menu.form != null);
    assert.equal(Object.keys(menu.form.fields).length, 0);
});

test('PreferencesWindowMenu show delegates to super class', () => {
    resetLegacyRuntime();
    setupPreferencesWindowMenu();

    const menu = new Wirecloud.Widget.PreferencesWindowMenu();
    const parentWindow = {};
    menu.show({ preferenceList: [], setPreferences() { return Promise.resolve(); } }, parentWindow);

    assert.equal(menu.showParents.length, 1);
    assert.equal(menu.showParents[0], parentWindow);
});

test('PreferencesWindowMenu show button area classes are assigned', () => {
    resetLegacyRuntime();
    setupPreferencesWindowMenu();

    const menu = new Wirecloud.Widget.PreferencesWindowMenu();
    menu.show({ preferenceList: [], setPreferences() { return Promise.resolve(); } }, null);

    assert.ok(menu.form.setdefaultsButton.classes.includes('btn-set-defaults'));
    assert.ok(menu.form.cancelButton.classes.includes('btn-cancel'));
    assert.ok(menu.form.acceptButton.classes.includes('btn-accept'));
});

test('PreferencesWindowMenu show registers submit and cancel listeners', () => {
    resetLegacyRuntime();
    setupPreferencesWindowMenu();

    const menu = new Wirecloud.Widget.PreferencesWindowMenu();
    menu.show({ preferenceList: [], setPreferences() { return Promise.resolve(); } }, null);

    assert.ok(menu.form.events.submit != null);
    assert.equal(typeof menu.form.events.submit, 'function');
    assert.ok(menu.form.events.cancel != null);
    assert.equal(typeof menu.form.events.cancel, 'function');
});

test('PreferencesWindowMenu _savePrefs disables accept button and adds busy class', () => {
    resetLegacyRuntime();
    setupPreferencesWindowMenu();

    const menu = new Wirecloud.Widget.PreferencesWindowMenu();
    menu.show({ preferenceList: [], setPreferences() { return Promise.resolve(); } }, null);

    menu._savePrefs({}, {});
    assert.equal(menu.form.acceptButton.disabled, true);
    assert.ok(menu.form.acceptButton.classes.includes('busy'));
});

test('PreferencesWindowMenu _savePrefs calls widgetModel.setPreferences', () => {
    resetLegacyRuntime();
    setupPreferencesWindowMenu();

    const menu = new Wirecloud.Widget.PreferencesWindowMenu();
    let savedValues = null;
    menu.show({
        preferenceList: [],
        setPreferences(values) { savedValues = values; return Promise.resolve(); },
    }, null);

    menu._savePrefs({}, { theme: 'dark' });
    assert.deepEqual(savedValues, { theme: 'dark' });
});
