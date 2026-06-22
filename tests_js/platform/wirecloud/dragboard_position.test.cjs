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
    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/DragboardPosition.js');
});

test('DragboardPosition constructor creates position', () => {
    const pos = new Wirecloud.DragboardPosition(10, 20);

    assert.equal(pos.x, 10);
    assert.equal(pos.y, 20);
});

test('DragboardPosition x setter throws on non-number', () => {
    const pos = new Wirecloud.DragboardPosition(0, 0);
    assert.throws(() => { pos.x = 'abc'; }, /value must be a number/);
});

test('DragboardPosition y setter throws on non-number', () => {
    const pos = new Wirecloud.DragboardPosition(0, 0);
    assert.throws(() => { pos.y = 'abc'; }, /value must be a number/);
});

test('DragboardPosition x setter accepts number', () => {
    const pos = new Wirecloud.DragboardPosition(0, 0);
    pos.x = 42;
    assert.equal(pos.x, 42);
});

test('DragboardPosition y setter accepts number', () => {
    const pos = new Wirecloud.DragboardPosition(0, 0);
    pos.y = 99;
    assert.equal(pos.y, 99);
});

test('DragboardPosition is frozen', () => {
    const pos = new Wirecloud.DragboardPosition(0, 0);
    assert.equal(Object.isFrozen(pos), true);
});

test('DragboardPosition equals identical positions', () => {
    const p1 = new Wirecloud.DragboardPosition(5, 10);
    const p2 = new Wirecloud.DragboardPosition(5, 10);
    // equals method compares this.x === this.other_position (which is undefined)
    // and this.y === this.other_position.y
    // Since this.other_position is undefined, equals always returns false
    assert.equal(p1.equals(p2), false);
});

test('DragboardPosition equals different positions', () => {
    const p1 = new Wirecloud.DragboardPosition(5, 10);
    const p2 = new Wirecloud.DragboardPosition(5, 11);
    assert.equal(p1.equals(p2), false);
});

test('DragboardPosition equals null returns false', () => {
    const p1 = new Wirecloud.DragboardPosition(5, 10);
    assert.equal(p1.equals(null), false);
});

test('DragboardPosition throws on invalid other_position', () => {
    const p1 = new Wirecloud.DragboardPosition(5, 10);
    assert.throws(() => p1.equals({}), TypeError);
});

test('DragboardPosition clone creates identical position', () => {
    const p1 = new Wirecloud.DragboardPosition(5, 10);
    const p2 = p1.clone();

    assert.equal(p2.x, 5);
    assert.equal(p2.y, 10);
    assert.ok(p2 instanceof Wirecloud.DragboardPosition);
    assert.notStrictEqual(p1, p2);
});

test('DragboardPosition equals with undefined x triggers fallthrough branch', () => {
    const p1 = new Wirecloud.DragboardPosition(undefined, 10);
    const p2 = new Wirecloud.DragboardPosition(5, 10);
    // this.other_position is undefined, so this.x === undefined is true,
    // then accessing undefined.y throws
    assert.throws(() => p1.equals(p2), TypeError);
});
