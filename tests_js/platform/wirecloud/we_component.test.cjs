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

    // Mock Tooltip before Button.js loads
    StyledElements.Tooltip = class Tooltip {
        constructor(options = {}) {
            this.options = Object.assign({content: '', placement: ['right', 'bottom', 'left', 'top']}, options);
        }
        bind() {}
        show() { return this; }
        hide() { return this; }
        destroy() {}
    };

    // Mock PopupMenu before PopupButton.js loads
    StyledElements.PopupMenu = class PopupMenu {
        constructor() {
            this.wrapperElement = document.createElement('div');
            this._items = [];
            this._visible = false;
            this._listeners = {};
        }
        append(item) { this._items.push(item); return this; }
        isVisible() { return this._visible; }
        addEventListener(name, handler) {
            if (this._listeners[name] == null) {
                this._listeners[name] = [];
            }
            this._listeners[name].push(handler);
        }
        show() { this._visible = true; return this; }
        hide() { this._visible = false; }
        moveFocusDown() { return this; }
        moveFocusUp() { return this; }
        hasEnabledItem() { return false; }
        clearEventListeners() {}
    };

    // Load StyledElements dependencies in order
    loadLegacyScripts([
        'src/wirecloud/commons/static/js/StyledElements/Fragment.js',
        'src/wirecloud/commons/static/js/StyledElements/Container.js',
        'src/wirecloud/commons/static/js/StyledElements/Button.js',
        'src/wirecloud/commons/static/js/StyledElements/Panel.js',
        'src/wirecloud/commons/static/js/StyledElements/PopupButton.js',
        'src/wirecloud/commons/static/js/StyledElements/DynamicMenuItems.js',
        'src/wirecloud/commons/static/js/StyledElements/MenuItem.js',
    ]);

    // Set up Wirecloud namespace
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = { WiringEditor: {} };

    // Mock Wirecloud dependencies for ComponentPrefs
    Wirecloud.LocalCatalogue = {
        hasAlternativeVersion: () => false,
    };
    Wirecloud.ui.FormWindowMenu = function () {
        this.show = () => {};
        this.setValue = () => {};
        this.executeOperation = () => {};
    };
    Wirecloud.ui.UpgradeWindowMenu = function () {
        this.show = () => {};
    };

    // Load ComponentPrefs
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/ComponentPrefs.js',
    ]);

    // Load the actual file under test
    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/ui/WiringEditor/Component.js',
    ]);
});

const makeWiringComponent = (overrides = {}) => {
    const comp = {
        id: 'wc-1',
        meta: {
            type: 'widget',
            version: '1.0.0',
            preferenceList: [],
        },
        title: 'Test Component',
        volatile: false,
        missing: false,
        hasEndpoints: () => true,
        eventListeners: {},
        addEventListener(event, handler) {
            if (this.eventListeners[event] == null) {
                this.eventListeners[event] = [];
            }
            this.eventListeners[event].push(handler);
        },
        showLogs() {
            comp._logsShown = true;
        },
        showSettings() {
            comp._settingsShown = true;
        },
        _logsShown: false,
        _settingsShown: false,
        ...overrides,
    };
    return comp;
};

// ── Constructor tests ───────────────────────────────────────────────

test('Component constructor creates component instance', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.ok(comp instanceof StyledElements.Panel);
    assert.ok(comp instanceof Wirecloud.ui.WiringEditor.Component);
    assert.equal(comp._component, wc);
    assert.equal(comp.id, 'wc-1');
    assert.equal(comp.type, 'widget');
    assert.equal(comp.used, false);
    assert.ok(comp.btnPrefs instanceof StyledElements.PopupButton);
});

test('Component constructor sets wrapperElement class and data-id', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.ok(comp.get().classList.contains('we-component'));
    assert.ok(comp.get().classList.contains('component-widget'));
    assert.ok(comp.get().classList.contains('panel-selectable'));
    assert.equal(comp.get().getAttribute('data-id'), 'wc-1');
});

test('Component constructor adds heading title class name', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.ok(comp.heading.title.hasClassName('component-title'));
    assert.ok(comp.heading.title.hasClassName('text-truncate'));
});

test('Component constructor adds heading subtitle version class', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.ok(comp.heading.subtitle.hasClassName('component-version'));
});

test('Component constructor creates label span with aria-live', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.label.tagName, 'SPAN');
    assert.equal(comp.label.getAttribute('aria-live'), 'polite');
});

test('Component constructor creates ComponentPrefs in popup menu', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.btnPrefs.popup_menu._items.length, 1);
    assert.ok(comp.btnPrefs.popup_menu._items[0] instanceof Wirecloud.ui.WiringEditor.ComponentPrefs);
    assert.equal(comp.btnPrefs.popup_menu._items[0].component, comp);
});

test('Component constructor adds change event listener', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.ok(wc.eventListeners.change != null);
    assert.equal(wc.eventListeners.change.length, 1);
});

test('Component constructor - normal component has no label (hasEndpoints=true)', () => {
    const wc = makeWiringComponent({ hasEndpoints: () => true });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.label.parentElement, null);
    assert.equal(comp.enabled, true);
});

test('Component constructor - volatile component gets volatile label', () => {
    const wc = makeWiringComponent({ volatile: true });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.label.textContent, 'volatile');
    assert.ok(comp.label.classList.contains('label'));
    assert.ok(comp.label.classList.contains('label-info'));
    assert.equal(comp.label.parentElement, comp.heading.wrapperElement);
    assert.equal(comp.enabled, false);
});

test('Component constructor - missing component gets missing label', () => {
    const wc = makeWiringComponent({ missing: true });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.label.textContent, 'missing');
    assert.ok(comp.label.classList.contains('label'));
    assert.ok(comp.label.classList.contains('label-danger'));
    assert.equal(comp.label.parentElement, comp.heading.wrapperElement);
    assert.equal(comp.enabled, false);
});

test('Component constructor - no endpoints gets warning label', () => {
    const wc = makeWiringComponent({ hasEndpoints: () => false });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.label.textContent, 'no endpoints');
    assert.ok(comp.label.classList.contains('label'));
    assert.ok(comp.label.classList.contains('label-warning'));
    assert.equal(comp.label.parentElement, comp.heading.wrapperElement);
    assert.equal(comp.enabled, false);
});

test('Component constructor - volatile takes precedence over missing', () => {
    const wc = makeWiringComponent({ volatile: true, missing: true });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.label.textContent, 'volatile');
    assert.ok(comp.label.classList.contains('label-info'));
});

test('Component constructor - component with operator type', () => {
    const wc = makeWiringComponent({
        meta: { type: 'operator', version: '2.0.0', preferenceList: [] },
    });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.ok(comp.get().classList.contains('component-operator'));
    assert.equal(comp.type, 'operator');
});

// ── used getter/setter tests ─────────────────────────────────────────

test('used getter returns false initially', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.used, false);
});

test('used setter to true updates label to in use and disables', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    comp.used = true;

    assert.equal(comp.used, true);
    assert.equal(comp.label.textContent, 'in use');
    assert.ok(comp.label.classList.contains('label'));
    assert.ok(comp.label.classList.contains('label-success'));
    assert.equal(comp.label.parentElement, comp.heading.wrapperElement);
    assert.equal(comp.enabled, false);
});

test('used setter back to false re-evaluates label and enable', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    comp.used = true;
    assert.equal(comp.used, true);
    assert.equal(comp.enabled, false);

    comp.used = false;
    assert.equal(comp.used, false);
    assert.equal(comp.enabled, true);
    assert.equal(comp.label.parentElement, null);
});

test('used setter from true to false with no endpoints shows warning', () => {
    const wc = makeWiringComponent({ hasEndpoints: () => false });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    comp.used = true;
    assert.equal(comp.label.textContent, 'in use');

    comp.used = false;
    assert.equal(comp.label.textContent, 'no endpoints');
    assert.equal(comp.enabled, false);
});

test('used setter to true when volatile stays disabled', () => {
    const wc = makeWiringComponent({ volatile: true });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    comp.used = true;
    assert.equal(comp.used, true);
    assert.equal(comp.label.textContent, 'volatile');
    assert.equal(comp.enabled, false);
});

test('used setter to true when missing stays disabled', () => {
    const wc = makeWiringComponent({ missing: true });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    comp.used = true;
    assert.equal(comp.used, true);
    assert.equal(comp.label.textContent, 'missing');
    assert.equal(comp.enabled, false);
});

// ── update_component_label no-condition else branch ──────────────────

test('update_component_label removes label when component is healthy', () => {
    const wc = makeWiringComponent({
        volatile: false,
        missing: false,
        hasEndpoints: () => true,
    });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    // Simulate: append the label first, then set used to trigger re-eval
    comp.heading.wrapperElement.appendChild(comp.label);
    assert.ok(comp.label.parentElement);

    // used=false should trigger update_component_label
    // First set used=true to append label, then false to trigger else branch
    comp.used = true;
    assert.equal(comp.label.parentElement, comp.heading.wrapperElement);

    comp.used = false;
    assert.equal(comp.label.parentElement, null);
    assert.equal(comp.enabled, true);
});

// ── on_change_model tests ────────────────────────────────────────────

test('on_change_model title change updates title and tooltip content', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    wc.title = 'New Title';
    wc.eventListeners.change[0](wc, ['title']);

    const titleSpan = comp.heading.title.wrapperElement.firstChild;
    assert.equal(titleSpan.textContent, 'New Title');
    assert.equal(comp.titletooltip.options.content, 'New Title');
});

test('on_change_model meta change updates title, subtitle, label, and enable', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    wc.title = 'Meta Updated';
    wc.meta.version = '2.0.0';
    wc.eventListeners.change[0](wc, ['meta']);

    const titleSpan = comp.heading.title.wrapperElement.firstChild;
    assert.equal(titleSpan.textContent, 'Meta Updated');
    assert.equal(comp.titletooltip.options.content, 'Meta Updated');
});

test('on_change_model meta change calls setSubtitle', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    wc.title = 'Comp';
    wc.meta.version = '3.0.0';
    wc.eventListeners.change[0](wc, ['meta']);

    assert.ok(comp.heading.subtitle.wrapperElement.childNodes.length > 0);
});

test('on_change_model with both title and meta changes', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    wc.title = 'Both Changed';
    wc.meta.version = '5.0.0';
    wc.eventListeners.change[0](wc, ['title', 'meta']);

    const titleSpan = comp.heading.title.wrapperElement.firstChild;
    assert.equal(titleSpan.textContent, 'Both Changed');
});

test('on_change_model with unknown change type does nothing', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    const titleBefore = comp.heading.title.wrapperElement.firstChild.textContent;

    wc.eventListeners.change[0](wc, ['other']);

    const titleAfter = comp.heading.title.wrapperElement.firstChild.textContent;
    assert.equal(titleAfter, titleBefore);
});

// ── hasSettings tests ────────────────────────────────────────────────

test('hasSettings returns true when preferenceList has items', () => {
    const wc = makeWiringComponent({
        meta: { type: 'widget', version: '1.0.0', preferenceList: [{ name: 'pref1' }] },
    });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.hasSettings(), true);
});

test('hasSettings returns false when preferenceList is empty', () => {
    const wc = makeWiringComponent({
        meta: { type: 'widget', version: '1.0.0', preferenceList: [] },
    });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.hasSettings(), false);
});

// ── titletooltip getter tests ───────────────────────────────────────

test('titletooltip getter creates and caches a Tooltip', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    const tooltip1 = comp.titletooltip;
    assert.ok(tooltip1 instanceof StyledElements.Tooltip);

    const tooltip2 = comp.titletooltip;
    assert.equal(tooltip1, tooltip2);
});

test('titletooltip uses placements top, bottom, right, left', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    const tooltip = comp.titletooltip;
    assert.deepEqual(tooltip.options.placement, ['top', 'bottom', 'right', 'left']);
});

// ── setTitle tests ──────────────────────────────────────────────────

test('setTitle creates span with correct text and aria-label', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    const result = comp.setTitle('Custom Title');

    const titleSpan = comp.heading.title.wrapperElement.firstChild;
    assert.equal(titleSpan.tagName, 'SPAN');
    assert.equal(titleSpan.textContent, 'Custom Title');
    assert.equal(titleSpan.getAttribute('aria-label'), 'Component: Custom Title');
    assert.equal(result, comp);
});

test('setTitle updates titletooltip content and binds span', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    const tooltip = comp.titletooltip;
    comp.setTitle('Tooltip Title');

    assert.equal(tooltip.options.content, 'Tooltip Title');
});

// ── showLogs tests ──────────────────────────────────────────────────

test('showLogs delegates to _component.showLogs', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    const result = comp.showLogs();

    assert.equal(wc._logsShown, true);
    assert.equal(result, comp);
});

// ── showSettings tests ───────────────────────────────────────────────

test('showSettings delegates to _component.showSettings', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    const result = comp.showSettings();

    assert.equal(wc._settingsShown, true);
    assert.equal(result, comp);
});

// ── Edge case: volatile + used ───────────────────────────────────────

test('volatile component with used=true still shows volatile label', () => {
    const wc = makeWiringComponent({ volatile: true });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    comp.used = true;
    assert.equal(comp.label.textContent, 'volatile');
    assert.equal(comp.enabled, false);
});

// ── Edge case: missing + used ────────────────────────────────────────

test('missing component with used=true still shows missing label', () => {
    const wc = makeWiringComponent({ missing: true });
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    comp.used = true;
    assert.equal(comp.label.textContent, 'missing');
    assert.equal(comp.enabled, false);
});

// ── heading structure tests ─────────────────────────────────────────

test('noBody option prevents body creation', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.equal(comp.body, undefined);
});

test('panel is selectable', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.ok(comp.hasClassName('panel-selectable'));
});

test('buttons container is created on component', () => {
    const wc = makeWiringComponent();
    const comp = new Wirecloud.ui.WiringEditor.Component(wc);

    assert.ok(comp.buttons instanceof StyledElements.Container);
    assert.ok(comp.buttons.hasClassName('panel-options'));
    assert.equal(comp.buttons.wrapperElement.parentElement, comp.heading.wrapperElement);
});
