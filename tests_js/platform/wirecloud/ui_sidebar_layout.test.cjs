const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapStyledElementsBase,
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

const setup = () => {
    resetLegacyRuntime();
    bootstrapStyledElementsBase();

    global.Wirecloud = {
        Utils: StyledElements.Utils,
        ui: {},
    };
    Wirecloud.ui.MultiValuedSize = class MultiValuedSize {
        constructor(inPixels, inLU) {
            this.inPixels = inPixels;
            this.inLU = inLU;
        }
    };
    Wirecloud.ui.SmartColumnLayout = class SmartColumnLayout {
        constructor(dragboard, columns, cellHeight, verticalMargin, horizontalMargin, scrollbarSpace) {
            this.dragboard = dragboard;
            this.columns = columns;
            this.cellHeight = cellHeight;
            this.verticalMargin = verticalMargin;
            this.horizontalMargin = horizontalMargin;
            this.scrollbarSpace = scrollbarSpace;
            this.leftMargin = 3;
            this.widgets = {};
            this.matrix = [];
            this.initialized = false;
            this.resizeEvents = [];
        }
        addWidget(widget, affectsDragboard) {
            this.widgets[widget.id] = widget;
            this.matrix = [[widget]];
            this.lastAdd = { widget, affectsDragboard };
            return 'added';
        }
        removeWidget(widget, affectsDragboard) {
            delete this.widgets[widget.id];
            this.matrix = [Object.values(this.widgets)];
            this.lastRemove = { widget, affectsDragboard };
            return 'removed';
        }
        initialize() {
            this.initialized = true;
            return 'modified';
        }
        adaptColumnOffset(size, width) {
            return new Wirecloud.ui.MultiValuedSize(width ?? size, 11);
        }
        adaptRowOffset(size) {
            return new Wirecloud.ui.MultiValuedSize(size, 12);
        }
        adaptHeight(size) {
            return new Wirecloud.ui.MultiValuedSize(size, 13);
        }
        adaptWidth(size, width) {
            return new Wirecloud.ui.MultiValuedSize(width ?? size, 14);
        }
        getHeight() {
            return 222;
        }
        getWidth() {
            return 333;
        }
        getColumnOffset(position, width, css) {
            const value = `${position.x || 0}${width == null ? '' : ':' + width}`;
            return css ? `${value}px` : value;
        }
        getRowOffset(position, css) {
            return css ? `${position.y || 0}px` : position.y || 0;
        }
        getHeightInPixels(cells) {
            return cells * 10;
        }
        _notifyWindowResizeEvent(widthChanged, heightChanged) {
            this.resizeEvents.push({ widthChanged, heightChanged });
        }
    };

    loadLegacyScript('src/wirecloud/platform/static/js/wirecloud/ui/SidebarLayout.js');
};

const makeDragboard = () => ({
    leftMargin: 20,
});

const makeWidget = (id, x = 1, y = 2) => ({
    id,
    position: { x, y },
    wrapperElement: document.createElement('section'),
});

test('SidebarLayout validates options and initializes vertical sidebars', () => {
    setup();
    assert.throws(() => new Wirecloud.ui.SidebarLayout(makeDragboard(), { position: 'center' }), TypeError);

    const layout = new Wirecloud.ui.SidebarLayout(makeDragboard(), { position: 'left', active: true });
    assert.equal(layout.vertical, true);
    assert.equal(layout.position, 'left');
    assert.equal(layout.columns, 1);
    assert.equal(layout.cellHeight, 12);
    assert.equal(layout.handle.getAttribute('role'), 'button');
    assert.equal(layout.handleicon.className, 'fas fa-caret-left');

    layout.active = true;
    assert.equal(layout.resizeEvents.length, 0);
    layout.active = false;
    assert.equal(layout.handleicon.className, 'fas fa-caret-right');
    assert.deepEqual(layout.resizeEvents[0], { widthChanged: true, heightChanged: true });
    layout.handle.dispatchEvent({ type: 'click' });
    assert.equal(layout.active, true);
    assert.equal(layout.isActive(), true);
});

test('SidebarLayout appends, moves and removes the handle as widgets change', () => {
    setup();
    const layout = new Wirecloud.ui.SidebarLayout(makeDragboard(), { position: 'right' });
    const first = makeWidget('first');
    const second = makeWidget('second');

    assert.equal(layout.addWidget(first, true), 'added');
    assert.equal(layout.handle.classList.contains('hidden'), false);
    assert.equal(layout.handle.parentElement, null);

    layout.initialize();
    assert.equal(layout.handle.parentElement, first.wrapperElement);

    layout.widgets.second = second;
    layout.matrix = [[null, second], [first]];
    assert.equal(layout.addWidget(second, false), 'added');
    assert.equal(layout.handle.parentElement, second.wrapperElement);

    layout.widgets.first = first;
    layout.matrix = [[second], [first]];
    assert.equal(layout.removeWidget(first, true), 'removed');
    assert.equal(layout.handle.parentElement, second.wrapperElement);

    layout.removeWidget(second, false);
    assert.equal(layout.handle.classList.contains('hidden'), true);
    assert.equal(layout.handle.parentElement, null);
    layout.removeHandle();
    assert.equal(layout.handle.parentElement, null);
});

test('SidebarLayout initialize tolerates empty layouts', () => {
    setup();
    const layout = new Wirecloud.ui.SidebarLayout(makeDragboard(), { position: 'left' });

    assert.equal(layout.initialize(), 'modified');
    assert.equal(layout.handle.parentElement, null);

    layout.matrix = [[null], [null]];
    assert.equal(layout.initialize(), 'modified');
    assert.equal(layout.handle.parentElement, null);
});

test('SidebarLayout adapts sizes and positions vertical sidebars', () => {
    setup();
    const dragboard = makeDragboard();
    const widget = makeWidget('widget', 4, 5);
    const left = new Wirecloud.ui.SidebarLayout(dragboard, { position: 'left', active: false });
    const right = new Wirecloud.ui.SidebarLayout(dragboard, { position: 'right', active: true });

    assert.deepEqual(left.adaptColumnOffset(8, 9), new Wirecloud.ui.MultiValuedSize(0, 0));
    assert.deepEqual(left.adaptRowOffset(8), new Wirecloud.ui.MultiValuedSize(8, 12));
    assert.deepEqual(left.adaptHeight(8), new Wirecloud.ui.MultiValuedSize(8, 13));
    assert.deepEqual(left.adaptWidth(8, 9), new Wirecloud.ui.MultiValuedSize(9, 1));
    assert.deepEqual(left.adaptWidth(8), new Wirecloud.ui.MultiValuedSize(497, 1));
    assert.equal(left.getHeight(), 222);
    assert.equal(left.getWidth(), 497);
    assert.equal(left.getHeightInPixels(7), 70);

    const leftElement = document.createElement('div');
    left.updatePosition(widget, leftElement);
    assert.equal(leftElement.style.top, '5px');
    assert.equal(leftElement.style.left, '-480px');
    assert.equal(leftElement.style.right, '');

    const rightElement = document.createElement('div');
    right.updatePosition(widget, rightElement);
    assert.equal(rightElement.style.top, '5px');
    assert.equal(rightElement.style.right, '0px');
    assert.equal(rightElement.style.left, '');
});

test('SidebarLayout adapts sizes and positions horizontal sidebars', () => {
    setup();
    const widget = makeWidget('widget', 4, 5);
    const top = new Wirecloud.ui.SidebarLayout(makeDragboard(), { position: 'top', active: false });
    const bottom = new Wirecloud.ui.SidebarLayout(makeDragboard(), { position: 'bottom', active: true });

    assert.equal(top.vertical, false);
    assert.equal(top.columns, 10);
    assert.equal(top.cellHeight, 497);
    assert.equal(top.handleicon.className, 'fas fa-caret-down');
    assert.deepEqual(top.adaptColumnOffset(8, 9), new Wirecloud.ui.MultiValuedSize(9, 11));
    assert.deepEqual(top.adaptRowOffset(8), new Wirecloud.ui.MultiValuedSize(0, 0));
    assert.deepEqual(top.adaptHeight(8), new Wirecloud.ui.MultiValuedSize(497, 1));
    assert.deepEqual(top.adaptWidth(8, 9), new Wirecloud.ui.MultiValuedSize(9, 14));
    assert.equal(top.getHeight(), 497);
    assert.equal(top.getWidth(), 333);
    assert.equal(top.getHeightInPixels(7), 497);

    const topElement = document.createElement('div');
    top.updatePosition(widget, topElement);
    assert.equal(topElement.style.left, '4px');
    assert.equal(topElement.style.top, '-498px');
    assert.equal(topElement.style.bottom, '');

    const bottomElement = document.createElement('div');
    bottom.updatePosition(widget, bottomElement);
    assert.equal(bottomElement.style.left, '4px');
    assert.equal(bottomElement.style.bottom, '0px');
    assert.equal(bottomElement.style.top, '');

    bottom.active = false;
    assert.equal(bottom.handleicon.className, 'fas fa-caret-up');
});
