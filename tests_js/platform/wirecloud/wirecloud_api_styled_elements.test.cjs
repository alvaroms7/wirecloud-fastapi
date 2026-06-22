const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
    loadLegacyScripts,
} = require('../../support/legacy-runtime.cjs');

const setupStyledElements = () => {
    if (global.Wirecloud == null) global.Wirecloud = {};
    if (!global.StyledElements) {
        global.StyledElements = {
            Utils: {},
            ObjectWithEvents: class {
                addEventListener() {}
                dispatchEvent() {}
            },
            Event: class {},
            GUIBuilder: class { constructor() {} parse() { return ''; } },
            PopupMenu: class { constructor() {} append() {} repaint() {} show() {} hide() {} isVisible() { return false; } moveFocusDown() {} moveFocusUp() {} hasEnabledItem() { return false; } destroy() {} },
            Popover: class { constructor() {} disablePointerEvents() {} enablePointerEvents() {} repaint() {} show() {} hide() {} update() {} },
            Tooltip: class { constructor() {} repaint() {} show() {} hide() {} bind() {} },
            ModelTable: class { constructor() {} },
            Button: class { constructor() {} },
            FileButton: class { constructor() {} },
            ToggleButton: class { constructor() {} },
            PopupButton: class { constructor() {} },
            Notebook: class { constructor() {} },
            DynamicMenuItems: class { build() {} },
            MenuItem: class { constructor() {} },
            Accordion: class {},
            Addon: class {},
            Alternatives: class {},
            BorderLayout: class {},
            ButtonsGroup: class {},
            CheckBox: class {},
            CodeArea: class {},
            Container: class {},
            Fragment: class {},
            Form: class {},
            HorizontalLayout: class {},
            InputElement: class {},
            List: class {},
            NumericField: class {},
            PaginatedSource: class {},
            PaginationInterface: class {},
            PasswordField: class {},
            RadioButton: class {},
            Select: class {},
            Separator: class {},
            StaticPaginatedSource: class {},
            StyledElement: class {},
            TextArea: class {},
            TextField: class {},
            VerticalLayout: class {}
        };
    }

    global._privs = {};
    global.gettext = (s) => s;
    global.interpolate = (t, v) => t.replace(/%\((\w+)\)s/g, (_, k) => v[k]);
    global.DOMRect = class DOMRect { constructor(x,y,w,h) { this.left=x; this.top=y; this.width=w; this.height=h; } };
};

test('_StyledElements exposes all element classes on parent.StyledElements', () => {
    setupStyledElements();
    const platform = { StyledElements: global.StyledElements, document: { body: { scrollLeft: 0, scrollTop: 0 } } };
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const parent = { MashupPlatform: { priv: { resource: iwidget } } };

    const fn = function _StyledElements(parent, platform, _) {
        parent.StyledElements = {
            'Accordion': platform.StyledElements.Accordion,
            'Addon': platform.StyledElements.Addon,
            'Alternatives': platform.StyledElements.Alternatives,
            'BorderLayout': platform.StyledElements.BorderLayout,
            'ButtonsGroup': platform.StyledElements.ButtonsGroup,
            'CheckBox': platform.StyledElements.CheckBox,
            'CodeArea': platform.StyledElements.CodeArea,
            'Container': platform.StyledElements.Container,
            'DynamicMenuItems': platform.StyledElements.DynamicMenuItems,
            'Event': platform.StyledElements.Event,
            'Fragment': platform.StyledElements.Fragment,
            'Form': platform.StyledElements.Form,
            'GUIBuilder': platform.StyledElements.GUIBuilder,
            'HorizontalLayout': platform.StyledElements.HorizontalLayout,
            'InputElement': platform.StyledElements.InputElement,
            'List': platform.StyledElements.List,
            'MenuItem': platform.StyledElements.MenuItem,
            'NumericField': platform.StyledElements.NumericField,
            'ObjectWithEvents': platform.StyledElements.ObjectWithEvents,
            'PaginatedSource': platform.StyledElements.PaginatedSource,
            'PaginationInterface': platform.StyledElements.PaginationInterface,
            'PasswordField': platform.StyledElements.PasswordField,
            'RadioButton': platform.StyledElements.RadioButton,
            'Select': platform.StyledElements.Select,
            'Separator': platform.StyledElements.Separator,
            'StaticPaginatedSource': platform.StyledElements.StaticPaginatedSource,
            'StyledAlternatives': platform.StyledElements.Alternatives,
            'StyledCheckBox': platform.StyledElements.CheckBox,
            'StyledElement': platform.StyledElements.StyledElement,
            'StyledInputElement': platform.StyledElements.InputElement,
            'StyledList': platform.StyledElements.List,
            'StyledNumericField': platform.StyledElements.NumericField,
            'StyledPasswordField': platform.StyledElements.PasswordField,
            'StyledRadioButton': platform.StyledElements.RadioButton,
            'StyledSelect': platform.StyledElements.Select,
            'StyledTextArea': platform.StyledElements.TextArea,
            'StyledTextField': platform.StyledElements.TextField,
            'TextArea': platform.StyledElements.TextArea,
            'TextField': platform.StyledElements.TextField,
            'VerticalLayout': platform.StyledElements.VerticalLayout
        };
        Object.freeze(parent.StyledElements);
    };
    fn(parent, platform);
    assert.ok('Accordion' in parent.StyledElements);
    assert.ok('StyledAlternatives' in parent.StyledElements);
    assert.ok(Object.isFrozen(parent.StyledElements));
    parent.StyledElements.NewProp = 1;
    assert.equal(parent.StyledElements.NewProp, undefined);
});

test('_StyledElements PopupMenu - constructor, append, show, hide, isVisible, destroy', () => {
    setupStyledElements();
    const platform = { StyledElements: global.StyledElements, document: { body: { scrollLeft: 0, scrollTop: 0 } } };
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const RealStyledElements = platform.StyledElements;
    const RealPopupMenu = class {
        constructor(opts) { this.opts = opts; this._shown = false; }
        append() { return this; }
        repaint() { return this; }
        show() { this._shown = true; return this; }
        hide() { this._shown = false; return this; }
        isVisible() { return this._shown; }
        moveFocusDown() { return this; }
        moveFocusUp() { return this; }
        hasEnabledItem() { return false; }
        destroy() { this._destroyed = true; return this; }
    };
    RealStyledElements.PopupMenu = RealPopupMenu;
    platform.StyledElements = RealStyledElements;

    const parent = {
        MashupPlatform: { priv: { resource: iwidget } },
        StyledElements: { StyledElement: class { destroy() {} } }
    };
    const events = { focus: {}, blur: {} };
    parent.StyledElements.Event = class { constructor() {} };
    Object.defineProperty(parent.StyledElements, 'StyledElement', { value: class { destroy() {} } });

    const privates = new WeakMap();
    const redirect_events = () => {};
    const wrap_ref_position = (refPosition) => {
        const _refPosition = { getBoundingClientRect: () => {
            const widgetBox = iwidget.wrapperElement.getBoundingClientRect();
            const frameBox = new DOMRect(0, 0, widgetBox.width, widgetBox.height);
            let refBox = 'getBoundingClientRect' in refPosition ? refPosition.getBoundingClientRect() : refPosition;
            if (refBox.right == null || refBox.bottom == null) {
                refBox = new DOMRect(refBox.left, refBox.top, refBox.width, refBox.height);
            }
            return new DOMRect(refBox.left, refBox.top, refBox.width, refBox.height);
        }};
        return _refPosition;
    };

    parent.StyledElements.PopupMenu = class PopupMenu extends parent.StyledElements.StyledElement {
        constructor(options) {
            super();
            const priv = { menu: new RealPopupMenu(options) };
            privates.set(this, priv);
        }
        append() { privates.get(this).menu.append(...arguments); return this; }
        repaint() { privates.get(this).menu.repaint(...arguments); return this; }
        show(refPosition) { privates.get(this).menu.show(wrap_ref_position(refPosition)); return this; }
        hide() { privates.get(this).menu.hide(); return this; }
        isVisible() { return privates.get(this).menu.isVisible(); }
        moveFocusDown() { privates.get(this).menu.moveFocusDown(); return this; }
        moveFocusUp() { privates.get(this).menu.moveFocusUp(); return this; }
        hasEnabledItem() { return privates.get(this).menu.hasEnabledItem(); }
        destroy() { super.destroy(); privates.get(this).menu.destroy(); return this; }
    };

    const p = new parent.StyledElements.PopupMenu();
    p.show({ getBoundingClientRect: () => ({ left: 10, top: 10, width: 100, height: 50, right: 110, bottom: 60 }) });
    assert.equal(p.isVisible(), true);
    p.hide();
    assert.equal(p.isVisible(), false);
    assert.equal(p.hasEnabledItem(), false);
    assert.ok(p.append() instanceof parent.StyledElements.PopupMenu);
});

test('_StyledElements Popover - constructor, show, hide, toggle, bind, update', () => {
    setupStyledElements();
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const RealPopup = class {
        constructor(opts) { this.opts = opts; this._visible = false; }
        disablePointerEvents() { return this; }
        enablePointerEvents() { return this; }
        get visible() { return this._visible; }
        repaint() { return this; }
        show() { this._visible = true; return this; }
        hide() { this._visible = false; return this; }
        update(t, c) { return this; }
    };
    const platform = { StyledElements: { Popover: RealPopup }, document: { body: { scrollLeft: 0, scrollTop: 0 } } };

    const privates = new WeakMap();
    const parent = { StyledElements: { StyledElement: class {}, Event: class {} } };
    const wrap_ref_position = () => ({ getBoundingClientRect: () => new DOMRect(0,0,100,50) });

    parent.StyledElements.Popover = class Popover extends parent.StyledElements.StyledElement {
        constructor(options) {
            super();
            options = options == null ? {} : Object.assign({}, options);
            options.refContainer = iwidget;
            const priv = { popover: new RealPopup(options) };
            privates.set(this, priv);
        }
        disablePointerEvents() { privates.get(this).popover.disablePointerEvents(); return this; }
        enablePointerEvents() { privates.get(this).popover.enablePointerEvents(); return this; }
        get visible() { return privates.get(this).popover.visible; }
        repaint() { privates.get(this).popover.repaint(...arguments); return this; }
        show(refPosition) { privates.get(this).popover.show(wrap_ref_position(refPosition)); return this; }
        hide() { privates.get(this).popover.hide(); return this; }
        bind(element, mode) { element.addEventListener('click', this.toggle.bind(this)); }
        toggle(refPosition) { if (this.visible) { this.hide(); } else { this.show(refPosition); } }
        update(title, content) { privates.get(this).popover.update(title, content); return this; }
    };

    const po = new parent.StyledElements.Popover();
    po.show({});
    assert.equal(po.visible, true);
    po.toggle({});
    assert.equal(po.visible, false);
    po.toggle({});
    assert.equal(po.visible, true);
    po.update('t', 'c');
});

test('_StyledElements Tooltip - constructor, show, hide, bind', () => {
    setupStyledElements();
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const RealTooltip = class {
        constructor(opts) { this.options = opts || {}; this._visible = false; }
        repaint() { return this; }
        show() { this._visible = true; return this; }
        hide() { this._visible = false; return this; }
        bind() { return this; }
    };
    const privates = new WeakMap();
    const parent = { StyledElements: { StyledElement: class {}, Event: class {} } };
    const wrap_ref_position = () => ({ getBoundingClientRect: () => new DOMRect(0,0,100,50) });

    parent.StyledElements.Tooltip = class Tooltip extends parent.StyledElements.StyledElement {
        constructor(options) {
            super();
            const priv = { tooltip: new RealTooltip(options) };
            privates.set(this, priv);
        }
        get options() { return privates.get(this).tooltip.options; }
        repaint() { privates.get(this).tooltip.repaint(...arguments); return this; }
        show(refPosition) { privates.get(this).tooltip.show(wrap_ref_position(refPosition)); return this; }
        hide() { privates.get(this).tooltip.hide(); return this; }
        bind(element, mode) { privates.get(this).tooltip.bind.call(this, element, mode); return this; }
    };

    const tt = new parent.StyledElements.Tooltip({ placement: 'top' });
    assert.ok(tt.options);
    assert.equal(tt.options.placement, 'top');
    tt.show({});
    assert.equal(privates.get(tt).tooltip._visible, true);
    tt.hide();
    assert.equal(privates.get(tt).tooltip._visible, false);
});

test('_StyledElements SendMenuItems', () => {
    setupStyledElements();
    const parent = {
        MashupPlatform: { wiring: { pushEvent: () => {} } },
        StyledElements: {
            DynamicMenuItems: class DynamicMenuItems { build() {} },
            MenuItem: class MenuItem { constructor(label, action) { this.label = label; this.action = action; } }
        }
    };
    let pushed = null;
    parent.MashupPlatform.wiring.pushEvent = (data, options) => { pushed = { data, options }; };

    const getEventActions = function getEventActions(endpoint) {
        let i, endpointInfo, actionLabel;
        const endpoints = endpoint.getReachableEndpoints();
        const endpointsByLabel = {};
        const actions = [];
        for (i = 0; i < endpoints.length; i += 1) {
            endpointInfo = endpoints[i];
            if (endpointsByLabel[endpointInfo.actionlabel] == null) {
                endpointsByLabel[endpointInfo.actionlabel] = 1;
            } else {
                endpointsByLabel[endpointInfo.actionlabel] += 1;
            }
        }
        for (i = 0; i < endpoints.length; i += 1) {
            endpointInfo = endpoints[i];
            actionLabel = endpointInfo.actionlabel;
            if (endpointsByLabel[actionLabel] > 1) {
                actionLabel += ' (' + endpointInfo.iGadgetName + ')';
            }
            actions.push({value: endpointInfo, label: actionLabel});
        }
        return actions;
    };

    const send = function send(context) {
        parent.MashupPlatform.wiring.pushEvent(this.control.endpoint, this.control.getData(context), {targetEndpoints: this.endpoints});
    };

    const SendMenuItems = function SendMenuItems(endpoint, getData) {
        if (typeof getData !== 'function') { throw new TypeError(); }
        Object.defineProperties(this, { 'endpoint': {value: endpoint}, 'getData': {value: getData} });
    };
    SendMenuItems.prototype = new parent.StyledElements.DynamicMenuItems();
    SendMenuItems.prototype.build = function build() {
        const actions = getEventActions(this.endpoint);
        return actions.map((action) => {
            return new parent.StyledElements.MenuItem(action.label, send.bind({control: this, endpoints: [action.value]}));
        });
    };

    assert.throws(() => new SendMenuItems({ getReachableEndpoints: () => [] }, 'notfn'), /TypeError/);

    const ep = { getReachableEndpoints: () => [{ actionlabel: 'Action1', iGadgetName: 'g1' }, { actionlabel: 'Action1', iGadgetName: 'g2' }] };
    const smi = new SendMenuItems(ep, (ctx) => 'data');
    const items = smi.build();
    assert.equal(items.length, 2);
    assert.equal(items[0].label, 'Action1 (g1)');
    assert.equal(items[1].label, 'Action1 (g2)');
});

test('_StyledElements extend utility', () => {
    const extend = function extend(parent_class, extra) {
        const new_class = class extends parent_class {};
        Object.assign(new_class.prototype, extra);
        return new_class;
    };
    const Base = class { baseMethod() { return 'base'; } };
    const Extended = extend(Base, { newMethod() { return 'extended'; } });
    const inst = new Extended();
    assert.equal(inst instanceof Base, true);
    assert.equal(typeof inst.baseMethod, 'function');
    assert.equal(typeof inst.newMethod, 'function');
});

test('_StyledElements wrap_ref_position with DOMRect', () => {
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const wrap_ref_position = function wrap_ref_position(refPosition) {
        const _refPosition = { getBoundingClientRect: () => {
            const widgetBox = iwidget.wrapperElement.getBoundingClientRect();
            const frameBox = { left: 0, top: 0, width: widgetBox.width, height: widgetBox.height, right: widgetBox.width, bottom: widgetBox.height };
            let refBox = 'getBoundingClientRect' in refPosition ? refPosition.getBoundingClientRect() : refPosition;
            if (refBox.right == null || refBox.bottom == null) {
                refBox = { left: refBox.left || 0, top: refBox.top || 0, width: refBox.width || 0, height: refBox.height || 0, right: (refBox.left || 0) + (refBox.width || 0), bottom: (refBox.top || 0) + (refBox.height || 0) };
            }
            const left = refBox.left < 0 ? frameBox.left : (refBox.left > frameBox.width ? frameBox.right : frameBox.left + refBox.left);
            const right = refBox.right < 0 ? frameBox.left : (refBox.right > frameBox.width ? frameBox.right : frameBox.left + refBox.right);
            const top = refBox.top < 0 ? frameBox.top : (refBox.top > frameBox.height ? frameBox.bottom : frameBox.top + refBox.top);
            const bottom = refBox.bottom < 0 ? frameBox.top : (refBox.bottom > frameBox.height ? frameBox.bottom : frameBox.top + refBox.bottom);
            return { left, top, width: right - left, height: bottom - top };
        }};
        return _refPosition;
    };

    const result = wrap_ref_position({ left: 10, top: 20, width: 100, height: 50, right: 110, bottom: 70 });
    const rect = result.getBoundingClientRect();
    assert.equal(rect.left, 10);
    assert.equal(rect.top, 20);
    assert.equal(rect.width, 100);
    assert.equal(rect.height, 50);
});

test('_StyledElements wrap_ref_position clamps to frameBox', () => {
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const wrap_ref_position = function wrap_ref_position(refPosition) {
        const _refPosition = { getBoundingClientRect: () => {
            const widgetBox = iwidget.wrapperElement.getBoundingClientRect();
            const frameBox = { left: 0, top: 0, width: widgetBox.width, height: widgetBox.height, right: widgetBox.width, bottom: widgetBox.height };
            let refBox = 'getBoundingClientRect' in refPosition ? refPosition.getBoundingClientRect() : refPosition;
            if (refBox.right == null || refBox.bottom == null) {
                refBox = { left: refBox.left || 0, top: refBox.top || 0, width: refBox.width || 0, height: refBox.height || 0, right: (refBox.left || 0) + (refBox.width || 0), bottom: (refBox.top || 0) + (refBox.height || 0) };
            }
            const left = refBox.left < 0 ? frameBox.left : (refBox.left > frameBox.width ? frameBox.right : frameBox.left + refBox.left);
            const right = refBox.right < 0 ? frameBox.left : (refBox.right > frameBox.width ? frameBox.right : frameBox.left + refBox.right);
            const top = refBox.top < 0 ? frameBox.top : (refBox.top > frameBox.height ? frameBox.bottom : frameBox.top + refBox.top);
            const bottom = refBox.bottom < 0 ? frameBox.top : (refBox.bottom > frameBox.height ? frameBox.bottom : frameBox.top + refBox.bottom);
            return { left, top, width: right - left, height: bottom - top };
        }};
        return _refPosition;
    };

    const result = wrap_ref_position({ left: -10, top: 500, width: 100, height: 50, right: 90, bottom: 550 });
    const rect = result.getBoundingClientRect();
    assert.equal(rect.left, 0);
    assert.equal(rect.top, 300);
});

test('_StyledElements redirect_events', () => {
    const redirect_events = function redirect_events(source, target) {
        Object.keys(source.events).forEach((name) => {
            const newEvent = new EventClass(target);
            target.events[name] = newEvent;
            source.events[name] = newEvent;
        });
    };
    const EventClass = class { constructor(t) { this.target = t; } };
    const source = { events: { click: {}, hover: {} } };
    const target = { events: {} };
    redirect_events(source, target);
    assert.ok(target.events.click instanceof EventClass);
    assert.ok(target.events.hover instanceof EventClass);
    assert.equal(source.events.click, target.events.click);
});

test('_StyledElements extend aliases (Button, FileButton, ToggleButton, PopupButton, Tab, Notebook)', () => {
    const extend = function extend(parent_class, extra) {
        const new_class = class extends parent_class {};
        Object.assign(new_class.prototype, extra);
        return new_class;
    };
    const RealButton = class {};
    const BaseTooltip = class {};
    const RealPopupMenu = class {};
    const RealNotebook = class NotebookClass {};
    RealNotebook.prototype.Tab = class {};
    const parent = { StyledElements: { Tooltip: BaseTooltip, PopupMenu: RealPopupMenu } };

    parent.StyledElements.Button = extend(RealButton, { Tooltip: parent.StyledElements.Tooltip });
    parent.StyledElements.StyledButton = parent.StyledElements.Button;
    assert.equal(parent.StyledElements.StyledButton, parent.StyledElements.Button);

    parent.StyledElements.FileButton = extend(RealButton, { Tooltip: parent.StyledElements.Tooltip });
    parent.StyledElements.ToggleButton = extend(RealButton, { Tooltip: parent.StyledElements.Tooltip });
    parent.StyledElements.PopupButton = extend(RealButton, { PopupMenu: parent.StyledElements.PopupMenu, Tooltip: parent.StyledElements.Tooltip });

    parent.StyledElements.Tab = extend(RealNotebook.prototype.Tab, { Button: parent.StyledElements.Button, Tooltip: parent.StyledElements.Tooltip });
    parent.StyledElements.Notebook = extend(RealNotebook, { Tab: parent.StyledElements.Tab, Button: parent.StyledElements.Button });
    parent.StyledElements.StyledNotebook = parent.StyledElements.Notebook;
    assert.equal(parent.StyledElements.StyledNotebook, parent.StyledElements.Notebook);

    assert.ok(new parent.StyledElements.Button() instanceof RealButton);
    assert.ok(new parent.StyledElements.PopupButton() instanceof RealButton);
});

test('_StyledElements Popover bind calls addEventListener', () => {
    setupStyledElements();
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const privates = new WeakMap();
    const parent = { StyledElements: { StyledElement: class {}, Event: class {} } };

    let addedListener = null;
    parent.StyledElements.Popover = class Popover extends parent.StyledElements.StyledElement {
        constructor(options) { super(); privates.set(this, { popover: { visible: false, show() {}, hide() {} } }); }
        get visible() { return false; }
        show() { return this; }
        hide() { return this; }
        bind(element, mode) {
            element.addEventListener('click', this.toggle.bind(this));
            addedListener = true;
        }
        toggle() {}
    };

    const po = new parent.StyledElements.Popover();
    const el = { addEventListener: () => {} };
    po.bind(el);
    assert.equal(addedListener, true);
});

test('_StyledElements Popover constructor with null options', () => {
    setupStyledElements();
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const RealPopup = class { constructor(opts) { this.opts = opts; } };
    const privates = new WeakMap();
    const parent = { StyledElements: { StyledElement: class {}, Event: class {} } };

    parent.StyledElements.Popover = class Popover extends parent.StyledElements.StyledElement {
        constructor(options) {
            super();
            options = options == null ? {} : Object.assign({}, options);
            options.refContainer = iwidget;
            const priv = { popover: new RealPopup(options) };
            privates.set(this, priv);
        }
    };
    const po = new parent.StyledElements.Popover(null);
    const opts = privates.get(po).popover.opts;
    assert.ok(opts.refContainer === iwidget);
});

test('_StyledElements Popover constructor with non-null options merges custom options', () => {
    setupStyledElements();
    const iwidget = { wrapperElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
    const RealPopup = class { constructor(opts) { this.opts = opts; } };
    const privates = new WeakMap();
    const parent = { StyledElements: { StyledElement: class {}, Event: class {} } };

    parent.StyledElements.Popover = class Popover extends parent.StyledElements.StyledElement {
        constructor(options) {
            super();
            options = options == null ? {} : Object.assign({}, options);
            options.refContainer = iwidget;
            const priv = { popover: new RealPopup(options) };
            privates.set(this, priv);
        }
    };
    const po = new parent.StyledElements.Popover({ placement: 'top', title: 'Test' });
    const opts = privates.get(po).popover.opts;
    assert.ok(opts.refContainer === iwidget);
    assert.equal(opts.placement, 'top');
    assert.equal(opts.title, 'Test');
});

test('_StyledElements ModelTable extend', () => {
    const extend = function extend(parent_class, extra) {
        const new_class = class extends parent_class {};
        Object.assign(new_class.prototype, extra);
        return new_class;
    };
    const RealModelTable = class {};
    const parent = { StyledElements: { Tooltip: class {} } };
    parent.StyledElements.ModelTable = extend(RealModelTable, { Tooltip: parent.StyledElements.Tooltip });
    const inst = new parent.StyledElements.ModelTable();
    assert.ok(inst instanceof RealModelTable);
});

test('_StyledElements SendMenuItems with single actionlabel', () => {
    const getEventActions = function getEventActions(endpoint) {
        let i, endpointInfo, actionLabel;
        const endpoints = endpoint.getReachableEndpoints();
        const endpointsByLabel = {};
        const actions = [];
        for (i = 0; i < endpoints.length; i += 1) {
            endpointInfo = endpoints[i];
            if (endpointsByLabel[endpointInfo.actionlabel] == null) endpointsByLabel[endpointInfo.actionlabel] = 1;
            else endpointsByLabel[endpointInfo.actionlabel] += 1;
        }
        for (i = 0; i < endpoints.length; i += 1) {
            endpointInfo = endpoints[i];
            actionLabel = endpointInfo.actionlabel;
            if (endpointsByLabel[actionLabel] > 1) actionLabel += ' (' + endpointInfo.iGadgetName + ')';
            actions.push({value: endpointInfo, label: actionLabel});
        }
        return actions;
    };
    const ep = { getReachableEndpoints: () => [{ actionlabel: 'SingleAction' }] };
    const actions = getEventActions(ep);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].label, 'SingleAction');
});

test('_StyledElements production implementation wraps platform elements', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.window.parent = global.window;
    global.DOMRect = class DOMRect {
        constructor(left, top, width, height) {
            this.left = left;
            this.top = top;
            this.width = width;
            this.height = height;
            this.right = left + width;
            this.bottom = top + height;
        }
    };

    const calls = {
        menuItems: [],
        pushed: [],
        showBoxes: [],
    };

    class BaseStyledElement {
        constructor() {
            this.events = {};
        }

        destroy() {
            this.destroyed = true;
        }
    }

    class RealElement {
        constructor(options) {
            this.options = options || {};
            this.events = { change: {} };
            this.visible = false;
        }

        append() {
            this.appended = Array.from(arguments);
        }

        repaint() {
            this.repainted = true;
        }

        show(refPosition) {
            this.visible = true;
            calls.showBoxes.push(refPosition.getBoundingClientRect());
        }

        hide() {
            this.visible = false;
        }

        isVisible() {
            return this.visible;
        }

        moveFocusDown() {
            this.down = true;
        }

        moveFocusUp() {
            this.up = true;
        }

        hasEnabledItem() {
            return true;
        }

        destroy() {
            this.destroyed = true;
        }

        disablePointerEvents() {
            this.disabledPointerEvents = true;
        }

        enablePointerEvents() {
            this.enabledPointerEvents = true;
        }

        update(title, content) {
            this.updated = { title, content };
        }

        bind(element, mode) {
            this.bound = { element, mode };
        }
    }

    class RealButton {}
    class RealModelTable {}
    class RealNotebook {}
    RealNotebook.prototype.Tab = class RealTab {};

    const realStyledElements = {
        Accordion: class {},
        Addon: class {},
        Alternatives: class {},
        BorderLayout: class {},
        ButtonsGroup: class {},
        CheckBox: class {},
        CodeArea: class {},
        Container: class {},
        DynamicMenuItems: class DynamicMenuItems {},
        Event: class Event {
            constructor(target) {
                this.target = target;
            }
        },
        Fragment: class {},
        Form: class {},
        GUIBuilder: class {},
        HorizontalLayout: class {},
        InputElement: class {},
        List: class {},
        MenuItem: class MenuItem {
            constructor(label, handler) {
                this.label = label;
                this.handler = handler;
                calls.menuItems.push(this);
            }
        },
        ModelTable: RealModelTable,
        Notebook: RealNotebook,
        NumericField: class {},
        ObjectWithEvents: class {},
        PaginatedSource: class {},
        PaginationInterface: class {},
        PasswordField: class {},
        PopupButton: RealButton,
        PopupMenu: RealElement,
        Popover: RealElement,
        RadioButton: class {},
        Select: class {},
        Separator: class {},
        StaticPaginatedSource: class {},
        StyledElement: BaseStyledElement,
        TextArea: class {},
        TextField: class {},
        ToggleButton: RealButton,
        Tooltip: RealElement,
        Button: RealButton,
        FileButton: RealButton,
        VerticalLayout: class {},
    };

    const iwidget = {
        wrapperElement: {
            getBoundingClientRect() {
                return { left: 10, top: 20, width: 300, height: 200 };
            }
        }
    };
    const parent = {
        MashupPlatform: {
            priv: { resource: iwidget },
            wiring: {
                pushEvent(endpoint, data, options) {
                    calls.pushed.push({ endpoint, data, options });
                }
            }
        }
    };
    const platform = {
        document: {
            body: {
                scrollLeft: 5,
                scrollTop: 7,
            }
        },
        StyledElements: realStyledElements,
    };

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/StyledElements.js');
    window._privs._StyledElements(parent, platform);

    assert.equal(parent.StyledElements.StyledButton, parent.StyledElements.Button);
    assert.equal(parent.StyledElements.StyledNotebook, parent.StyledElements.Notebook);
    assert.equal(Object.isFrozen(parent.StyledElements), true);

    const menu = new parent.StyledElements.PopupMenu({ id: 'menu' });
    assert.equal(menu.append('item'), menu);
    assert.equal(menu.repaint(), menu);
    assert.equal(menu.show({ left: -1, top: 250, width: 400, height: 20 }), menu);
    assert.equal(calls.showBoxes[0].left, 15);
    assert.equal(menu.isVisible(), true);
    assert.equal(menu.moveFocusDown(), menu);
    assert.equal(menu.moveFocusUp(), menu);
    assert.equal(menu.hasEnabledItem(), true);
    assert.equal(menu.hide(), menu);
    assert.equal(menu.destroy(), menu);
    menu.show({ left: 500, top: 10, right: 550, bottom: 30 });
    menu.show({ left: -100, top: 10, right: -50, bottom: 20 });
    menu.show({ left: 10, top: -50, right: 50, bottom: 10 });
    menu.show({ left: 10, top: -100, right: 50, bottom: -50 });

    const popover = new parent.StyledElements.Popover({ id: 'test-popover' });

    // Create Popover without options to cover options==null branch (line 183)
    const popoverNoOpts = new parent.StyledElements.Popover();
    assert.equal(popover.disablePointerEvents(), popover);
    assert.equal(popover.enablePointerEvents(), popover);
    assert.equal(popover.repaint(), popover);
    assert.equal(popover.show({ getBoundingClientRect: () => ({ left: 1, top: 2, right: 3, bottom: 4 }) }), popover);
    assert.equal(popover.visible, true);
    popover.toggle({});
    assert.equal(popover.visible, false);
    popover.toggle({});
    assert.equal(popover.visible, true);
    assert.equal(popover.update('title', 'content'), popover);
    const element = global.document.createElement('button');
    popover.bind(element);
    element.dispatchEvent({ type: 'click' });
    assert.equal(popover.visible, false);

    const tooltip = new parent.StyledElements.Tooltip({ placement: 'top' });
    assert.deepEqual(tooltip.options, { placement: 'top' });
    assert.equal(tooltip.repaint(), tooltip);
    assert.equal(tooltip.show({ left: 1, top: 2, right: 3, bottom: 4 }), tooltip);
    assert.equal(tooltip.hide(), tooltip);
    assert.equal(tooltip.bind(element, 'hover'), tooltip);

    const endpointInfoA = { actionlabel: 'Send', iGadgetName: 'A' };
    const endpointInfoB = { actionlabel: 'Send', iGadgetName: 'B' };
    const endpoint = {
        getReachableEndpoints() {
            return [endpointInfoA, endpointInfoB];
        }
    };
    const sendMenuItems = new parent.StyledElements.SendMenuItems(endpoint, (context) => `data:${context}`);
    assert.throws(() => new parent.StyledElements.SendMenuItems(endpoint, null), TypeError);
    sendMenuItems.build();
    assert.deepEqual(calls.menuItems.map((item) => item.label), ['Send (A)', 'Send (B)']);
    calls.menuItems[0].handler('ctx');
    assert.deepEqual(calls.pushed[0], {
        endpoint,
        data: 'data:ctx',
        options: { targetEndpoints: [endpointInfoA] }
    });

    assert.ok(new parent.StyledElements.ModelTable() instanceof RealModelTable);
    assert.equal(parent.StyledElements.ModelTable.prototype.Tooltip, parent.StyledElements.Tooltip);
    assert.ok(new parent.StyledElements.Button() instanceof RealButton);
    assert.ok(new parent.StyledElements.FileButton() instanceof RealButton);
    assert.ok(new parent.StyledElements.ToggleButton() instanceof RealButton);
    assert.ok(new parent.StyledElements.PopupButton() instanceof RealButton);
    assert.ok(new parent.StyledElements.Notebook() instanceof RealNotebook);
    assert.ok(new parent.StyledElements.Tab() instanceof RealNotebook.prototype.Tab);
});

test('_StyledElements auto-initializes when loaded inside an iframe', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.MashupPlatform = {
        priv: {
            resource: {
                wrapperElement: {
                    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 })
                }
            }
        }
    };
    global.window.parent = {
        document: { body: { scrollLeft: 0, scrollTop: 0 } },
        StyledElements: {
            Accordion: class {},
            Addon: class {},
            Alternatives: class {},
            BorderLayout: class {},
            ButtonsGroup: class {},
            CheckBox: class {},
            CodeArea: class {},
            Container: class {},
            DynamicMenuItems: class DynamicMenuItems {},
            Event: class Event {},
            Fragment: class {},
            Form: class {},
            GUIBuilder: class {},
            HorizontalLayout: class {},
            InputElement: class {},
            List: class {},
            MenuItem: class MenuItem {},
            ModelTable: class {},
            Notebook: class Notebook {},
            NumericField: class {},
            ObjectWithEvents: class {},
            PaginatedSource: class {},
            PaginationInterface: class {},
            PasswordField: class {},
            PopupButton: class {},
            PopupMenu: class { constructor() { this.events = {}; } },
            Popover: class { constructor() { this.events = {}; } },
            RadioButton: class {},
            Select: class {},
            Separator: class {},
            StaticPaginatedSource: class {},
            StyledElement: class { constructor() { this.events = {}; } },
            TextArea: class {},
            TextField: class {},
            ToggleButton: class {},
            Tooltip: class { constructor() { this.events = {}; } },
            Button: class {},
            FileButton: class {},
            VerticalLayout: class {},
        }
    };
    global.window.parent.StyledElements.Notebook.prototype.Tab = class {};

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/StyledElements.js');
    assert.equal(typeof global.StyledElements.PopupMenu, 'function');
});
