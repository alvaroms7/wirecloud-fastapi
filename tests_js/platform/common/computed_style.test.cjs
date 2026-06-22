const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    delete window.CSSColorComponentValue;
    delete window.getComputedStyle;
});

function loadScriptIEPath() {
    delete window.getComputedStyle;
    loadLegacyScript('src/wirecloud/platform/static/js/common/ComputedStyle.js');
}

function loadScriptFallbackPath() {
    window.getComputedStyle = document.defaultView.getComputedStyle;
    var originalGCS = document.defaultView.getComputedStyle;
    document.defaultView.getComputedStyle = function (element, pseudo) {
        var native = originalGCS(element, pseudo);
        return {
            getPropertyValue: function (prop) { return native.getPropertyValue(prop); },
            getPropertyCSSValue: function () { throw new Error('not implemented'); }
        };
    };
    loadLegacyScript('src/wirecloud/platform/static/js/common/ComputedStyle.js');
}

function loadScriptNativePath() {
    window.getComputedStyle = document.defaultView.getComputedStyle;
    loadLegacyScript('src/wirecloud/platform/static/js/common/ComputedStyle.js');
}

test('native path: internal classes are not created when native getPropertyCSSValue/getFloatValue works', () => {
    loadScriptNativePath();
    assert.strictEqual(window.CSSColorComponentValue, undefined);
    assert.strictEqual(window.CSSPrimitiveValue.CSS_PX, 0);
});

test('IE path: internal implementations are created when window.getComputedStyle is undefined', () => {
    loadScriptIEPath();
    assert.notStrictEqual(window.CSSPrimitiveValue, undefined);
    assert.notStrictEqual(window.CSSColorComponentValue, undefined);
    assert.notStrictEqual(window.getComputedStyle, undefined);
    assert.strictEqual(window.CSSPrimitiveValue.CSS_PX, 1);
    // IE path also sets document.defaultView = window when undefined
});

test('fallback path: internal implementations are created when getPropertyCSSValue throws', () => {
    loadScriptFallbackPath();
    assert.notStrictEqual(window.CSSPrimitiveValue, undefined);
    assert.notStrictEqual(window.CSSColorComponentValue, undefined);
    assert.notStrictEqual(window.getComputedStyle, undefined);
    assert.strictEqual(window.CSSPrimitiveValue.CSS_PX, 1);
});

test('CSSPrimitiveValue no-arg constructor returns early', () => {
    loadScriptIEPath();
    var val = new window.CSSPrimitiveValue();
    assert.strictEqual(val.cssText, undefined);
    assert.strictEqual(val._element, undefined);
});

test('CSSPrimitiveValue constructor populates cssText from _internalGetCurrentStyle', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {width: '100px'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'width', 'width');
    assert.strictEqual(val.cssText, '100px');
    assert.strictEqual(val._element, el);
    assert.strictEqual(val._property, 'width');
    assert.strictEqual(val._ieProperty, 'width');
});

test('getFloatValue returns 0 when cssText is empty', () => {
    loadScriptIEPath();
    var val = new window.CSSPrimitiveValue();
    val.cssText = '';
    assert.strictEqual(val.getFloatValue(window.CSSPrimitiveValue.CSS_PX), 0);
});

test('getFloatValue parses px values directly without DOM measurement', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {width: '100px'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'width', 'width');
    assert.strictEqual(val.getFloatValue(window.CSSPrimitiveValue.CSS_PX), 100);
});

test('getFloatValue with em units inserts test element and reads offsetHeight', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {height: '2em'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'height', 'height');
    // FakeElement offsetHeight defaults to 0
    assert.strictEqual(val.getFloatValue(window.CSSPrimitiveValue.CSS_PX), 0);
});

test('getFloatValue returns 0 for border when border style is "none"', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {
        borderTopWidth: 'medium',
        borderTopStyle: 'none'
    };
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'border-top-width', 'borderTopWidth');
    assert.strictEqual(val.getFloatValue(window.CSSPrimitiveValue.CSS_PX), 0);
});

test('getFloatValue for border with non-none style creates extra element and measures', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {
        borderRightWidth: 'medium',
        borderRightStyle: 'solid'
    };
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'border-right-width', 'borderRightWidth');
    // FakeElement offsetHeight defaults to 0
    assert.strictEqual(val.getFloatValue(window.CSSPrimitiveValue.CSS_PX), 0);
});

test('getFloatValue with px in border-width returns parsed integer', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {
        borderLeftWidth: '5px',
        borderLeftStyle: 'solid'
    };
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'border-left-width', 'borderLeftWidth');
    assert.strictEqual(val.getFloatValue(window.CSSPrimitiveValue.CSS_PX), 5);
});

test('getFloatValue throws for unsupported unit type', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {width: '100px'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'width', 'width');
    assert.throws(function () {
        val.getFloatValue(999);
    }, Error);
});

test('getFloatValue throws when cssText has no numeric measurement and is not a border property', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    // 'red' has no digits, so _ValueRegExp won't match it
    el.currentStyle = {color: 'red'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'color', 'color');
    assert.throws(function () {
        val.getFloatValue(window.CSSPrimitiveValue.CSS_PX);
    }, Error);
});

test('getRGBColorValue parses rgb(10, 20, 30) into color components', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {color: 'rgb(10, 20, 30)'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'color', 'color');
    var result = val.getRGBColorValue();

    assert.strictEqual(result.red.getFloatValue(), 10);
    assert.strictEqual(result.green.getFloatValue(), 20);
    assert.strictEqual(result.blue.getFloatValue(), 30);
    assert.strictEqual(result.alpha.getFloatValue(), 1);
});

test('getRGBColorValue parses rgba(10, 20, 30, 0) into color components', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {color: 'rgba(10, 20, 30, 0)'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'color', 'color');
    var result = val.getRGBColorValue();

    assert.strictEqual(result.red.getFloatValue(), 10);
    assert.strictEqual(result.green.getFloatValue(), 20);
    assert.strictEqual(result.blue.getFloatValue(), 30);
    // rgba regex only matches integer alpha (not decimal)
    assert.strictEqual(result.alpha.getFloatValue(), 0);
});

test('getRGBColorValue parses #FF0A0B hex into color components', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {color: '#FF0A0B'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'color', 'color');
    var result = val.getRGBColorValue();

    assert.strictEqual(result.red.getFloatValue(), 255);
    assert.strictEqual(result.green.getFloatValue(), 10);
    assert.strictEqual(result.blue.getFloatValue(), 11);
    assert.strictEqual(result.alpha.getFloatValue(), 1);
});

test('getRGBColorValue works for background-color property', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {backgroundColor: 'rgb(1, 2, 3)'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'background-color', 'backgroundColor');
    var result = val.getRGBColorValue();

    assert.strictEqual(result.red.getFloatValue(), 1);
    assert.strictEqual(result.green.getFloatValue(), 2);
    assert.strictEqual(result.blue.getFloatValue(), 3);
});

test('getRGBColorValue throws for properties other than color and background-color', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {width: '100px'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'width', 'width');
    assert.throws(function () {
        val.getRGBColorValue();
    }, Error);
});

test('getRGBColorValue throws when hex parsing fails via table bgColor fallback', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    // named color like "red" — won't match hex regex directly
    // falls through to table element bgColor, which is undefined in fake DOM
    el.currentStyle = {color: 'red'};
    document.body.appendChild(el);

    var val = new window.CSSPrimitiveValue(el, 'color', 'color');
    assert.throws(function () {
        val.getRGBColorValue();
    }, /Error on getRGBColorValue/);
});

test('_getIEProperty converts "float" to "styleFloat"', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {};
    document.body.appendChild(el);
    var style = window.getComputedStyle(el, null);

    assert.strictEqual(style._getIEProperty('float'), 'styleFloat');
});

test('_getIEProperty converts dashed CSS properties to camelCase', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {};
    document.body.appendChild(el);
    var style = window.getComputedStyle(el, null);

    assert.strictEqual(style._getIEProperty('border-top-width'), 'borderTopWidth');
    assert.strictEqual(style._getIEProperty('background-color'), 'backgroundColor');
    assert.strictEqual(style._getIEProperty('margin-left'), 'marginLeft');
});

test('_getIEProperty returns property unchanged when it has no dash', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {};
    document.body.appendChild(el);
    var style = window.getComputedStyle(el, null);

    assert.strictEqual(style._getIEProperty('width'), 'width');
    assert.strictEqual(style._getIEProperty('color'), 'color');
});

test('getPropertyValue returns the currentStyle value via _internalGetCurrentStyle', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {width: '200px', borderTopWidth: '3px'};
    document.body.appendChild(el);
    var style = window.getComputedStyle(el, null);

    assert.strictEqual(style.getPropertyValue('width'), '200px');
    assert.strictEqual(style.getPropertyValue('border-top-width'), '3px');
});

test('getPropertyValue falls back to runtimeStyle when currentStyle returns "auto"', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {width: 'auto'};
    el.runtimeStyle = {width: '300px'};
    document.body.appendChild(el);
    var style = window.getComputedStyle(el, null);

    assert.strictEqual(style.getPropertyValue('width'), '300px');
});

test('getPropertyCSSValue returns a CSSPrimitiveValue instance with correct cssText', () => {
    loadScriptIEPath();
    var el = document.createElement('div');
    el.currentStyle = {width: '200px'};
    document.body.appendChild(el);
    var style = window.getComputedStyle(el, null);

    var cssVal = style.getPropertyCSSValue('width');
    assert.ok(cssVal instanceof window.CSSPrimitiveValue);
    assert.strictEqual(cssVal.cssText, '200px');
});

test('getComputedStyle throws for null element', () => {
    loadScriptIEPath();
    assert.throws(function () {
        window.getComputedStyle(null);
    }, Error);
});

test('CSSColorComponentValue constructor stores value as string in cssText', () => {
    loadScriptIEPath();
    var comp = new window.CSSColorComponentValue(42);
    assert.strictEqual(comp.cssText, '42');
});

test('CSSColorComponentValue inherits from CSSPrimitiveValue', () => {
    loadScriptIEPath();
    var comp = new window.CSSColorComponentValue(255);
    assert.ok(comp instanceof window.CSSColorComponentValue);
    assert.ok(comp instanceof window.CSSPrimitiveValue);
});

test('CSSColorComponentValue getFloatValue ignores unit and returns parseInt', () => {
    loadScriptIEPath();
    var comp = new window.CSSColorComponentValue(128);
    assert.strictEqual(comp.getFloatValue(), 128);
    assert.strictEqual(comp.getFloatValue(window.CSSPrimitiveValue.CSS_PX), 128);
    assert.strictEqual(comp.getFloatValue(999), 128);
});

test('CSSPrimitiveValue.CSS_PX equals 1', () => {
    loadScriptIEPath();
    assert.strictEqual(window.CSSPrimitiveValue.CSS_PX, 1);
});

// ── Fallback path (_internalGetCurrentStyle from catch block) ─────────

test('fallback path: getPropertyValue calls catch-block _internalGetCurrentStyle', () => {
    loadScriptFallbackPath();
    var el = document.createElement('div');
    el.style.width = '250px';
    document.body.appendChild(el);

    var style = window.getComputedStyle(el, null);
    assert.strictEqual(style.getPropertyValue('width'), '250px');
});

test('fallback path: CSSPrimitiveValue constructor calls catch-block _internalGetCurrentStyle', () => {
    loadScriptFallbackPath();
    var el = document.createElement('div');
    el.style.color = 'rgb(5, 10, 15)';
    document.body.appendChild(el);

    var style = window.getComputedStyle(el, null);
    var cssVal = style.getPropertyCSSValue('color');
    assert.ok(cssVal instanceof window.CSSPrimitiveValue);
    assert.strictEqual(cssVal.cssText, 'rgb(5, 10, 15)');
});
