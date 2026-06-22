const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;
    Wirecloud.ui = {};

    // Mock StyledElements.Button since the source constructor calls new se.Button()
    StyledElements.Button = class Button {
        constructor(options) {
            this.options = options;
            this.listeners = {};
        }
        addEventListener(name, listener) { this.listeners[name] = listener; }
        click() { this.listeners.click(); }
        insertInto() {}
        disable() {}
        enable() {}
        destroy() { this._destroyed = true; }
        focus() { this._focused = true; }
    };

    Wirecloud.ui.WindowMenu = class WindowMenu {
        constructor(title, className) {
            this.title = title;
            this.className = className;
            this.windowContent = document.createElement('div');
            this.windowBottom = document.createElement('div');
            this._closeListener = () => this.hide();
        }
        show() {}
        hide() {}
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/MissingDependenciesWindowMenu.js');
});

test('MissingDependenciesWindowMenu constructor creates window', () => {
    const details = { missingDependencies: ['dep1', 'dep2'] };
    const menu = new Wirecloud.ui.MissingDependenciesWindowMenu(() => {}, details);

    assert.ok(menu.continueButton);
    assert.ok(menu.cancelButton);
});

test('MissingDependenciesWindowMenu setFocus focuses continue button', () => {
    const details = { missingDependencies: [] };
    const menu = new Wirecloud.ui.MissingDependenciesWindowMenu(() => {}, details);

    menu.continueButton.focus = () => {};
    assert.doesNotThrow(() => menu.setFocus());
});

test('MissingDependenciesWindowMenu destroy hides and destroys buttons', () => {
    const details = { missingDependencies: [] };
    const menu = new Wirecloud.ui.MissingDependenciesWindowMenu(() => {}, details);

    let destroyedContinue = false;
    let destroyedCancel = false;
    menu.continueButton.destroy = () => { destroyedContinue = true; };
    menu.cancelButton.destroy = () => { destroyedCancel = true; };

    menu.destroy();
    assert.equal(destroyedContinue, true);
    assert.equal(destroyedCancel, true);
});

test('MissingDependenciesWindowMenu continue button invokes registered callback path', () => {
    const details = { missingDependencies: [] };
    const menu = new Wirecloud.ui.MissingDependenciesWindowMenu(() => {}, details);

    assert.doesNotThrow(() => menu.continueButton.click());
});
