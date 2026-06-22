const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadLegacyScript,
    resetLegacyRuntime,
} = require('../../../support/legacy-runtime.cjs');

test('Wirecloud.ui.UserTypeahead configures lookup and build helpers', async () => {
    resetLegacyRuntime();

    class Typeahead {
        constructor(config) {
            this.config = config;
        }
    }

    global.StyledElements = {
        Typeahead,
        Utils: {
            merge: (...objects) => Object.assign({}, ...objects),
        }
    };
    global.Wirecloud = {
        URLs: {
            SEARCH_SERVICE: '/search'
        },
        io: {
            makeRequest(url, options) {
                assert.equal(url, '/search');
                assert.deepEqual(options.parameters, { namespace: 'user', q: 'alice' });
                return Promise.resolve({
                    responseText: JSON.stringify({
                        results: [{ username: 'alice', fullname: 'Alice', organization: 'Acme' }]
                    })
                });
            }
        },
        ui: {}
    };

    loadLegacyScript('src/wirecloud/commons/static/js/wirecloud/ui/UserTypeahead.js');

    const typeahead = new Wirecloud.ui.UserTypeahead({ autocomplete: false });
    assert.equal(typeahead.config.autocomplete, false);

    const results = await typeahead.config.lookup('alice');
    assert.equal(results.length, 1);

    const built = typeahead.config.build(typeahead, results[0]);
    assert.deepEqual(built, {
        value: 'alice',
        title: 'Alice',
        description: 'alice',
        iconClass: 'fas fa-building',
        context: results[0]
    });
});

test('Wirecloud.ui.UserGroupTypeahead maps lookup results to identifiers and icons', async () => {
    resetLegacyRuntime();

    class Typeahead {
        constructor(config) {
            this.config = config;
        }
    }

    global.StyledElements = {
        Typeahead,
        Utils: {
            merge: (...objects) => Object.assign({}, ...objects),
        }
    };
    global.Wirecloud = {
        URLs: {
            SEARCH_SERVICE: '/search'
        },
        io: {
            makeRequest(url, options) {
                assert.equal(url, '/search');
                assert.deepEqual(options.parameters, { namespace: 'usergroup', q: 'team' });
                return Promise.resolve({
                    responseText: JSON.stringify({
                        results: [
                            { type: 'user', username: 'alice', fullname: 'Alice User' },
                            { type: 'group', name: 'team-a', fullname: 'Team A' },
                            { type: 'organization', name: 'org-a' },
                        ]
                    })
                });
            }
        },
        ui: {}
    };

    loadLegacyScript('src/wirecloud/commons/static/js/wirecloud/ui/UserGroupTypeahead.js');

    const typeahead = new Wirecloud.ui.UserGroupTypeahead();
    assert.equal(typeahead.config.autocomplete, true);

    const results = await typeahead.config.lookup('team');
    assert.equal(results.length, 3);
    assert.deepEqual(typeahead.config.build(typeahead, results[0]), {
        value: 'alice',
        title: 'Alice User',
        description: 'alice',
        iconClass: 'fas fa-user',
        context: results[0]
    });
    assert.deepEqual(typeahead.config.build(typeahead, results[1]), {
        value: 'team-a',
        title: 'Team A',
        description: 'team-a',
        iconClass: 'fas fa-users',
        context: results[1]
    });
    assert.deepEqual(typeahead.config.build(typeahead, results[2]), {
        value: 'org-a',
        title: 'org-a',
        description: 'org-a',
        iconClass: 'fas fa-building',
        context: results[2]
    });
});

test('Wirecloud.TutorialCatalogue registers tutorials and builds tutorial links', () => {
    resetLegacyRuntime();

    class Tutorial {}
    class Fragment {
        constructor(nodes) {
            this.nodes = nodes;
        }
    }

    let started = 0;
    class DemoTutorial extends Tutorial {
        constructor(label) {
            super();
            this.label = label;
        }

        start() {
            started += 1;
        }
    }

    global.StyledElements = { Fragment };
    global.Wirecloud = {
        ui: { Tutorial },
        Utils: {
            gettext: (text) => text,
            interpolate: (template, context) => template.replace('%(tutorial)s', context.tutorial),
        }
    };

    loadLegacyScript('src/wirecloud/commons/static/js/wirecloud/ui/TutorialCatalogue.js');

    assert.throws(() => Wirecloud.TutorialCatalogue.add('bad', {}), /must be an instance/);

    const tutorial = new DemoTutorial('Demo');
    Wirecloud.TutorialCatalogue.add('demo', tutorial);
    assert.equal(Wirecloud.TutorialCatalogue.get('demo'), tutorial);
    assert.deepEqual(Wirecloud.TutorialCatalogue.tutorials, [tutorial]);

    const fragment = Wirecloud.TutorialCatalogue.buildTutorialReferences(['demo']);
    assert.equal(fragment.nodes.length, 2);
    assert.equal(fragment.nodes[0].tagName, 'P');
    assert.equal(fragment.nodes[1].tagName, 'UL');

    const link = fragment.nodes[1].firstChild.firstChild;
    const event = {
        type: 'click',
        stopPropagation() {},
        preventDefault() {},
    };
    link.dispatchEvent(event);
    assert.equal(started, 1);
});

test('Wirecloud.ui.HTMLWindowMenu loads html content and handles failures', () => {
    resetLegacyRuntime();

    class WindowMenu {
        constructor(title, extraClass) {
            this.title = title;
            this.extraClass = extraClass;
            this.windowBottom = document.createElement('div');
            this.windowContent = document.createElement('div');
            this._closeListener = () => {
                this.closed = true;
            };
            this.baseShowCalls = 0;
        }

        show() {
            this.baseShowCalls += 1;
        }

        repaint() {
            this.repaintCalls = (this.repaintCalls || 0) + 1;
        }
    }

    class Button {
        constructor(options) {
            this.options = options;
        }

        insertInto(node) {
            this.parentNode = node;
        }

        addEventListener(name, handler) {
            this.eventName = name;
            this.handler = handler;
        }
    }

    let mode = 'success';
    global.StyledElements = { Button };
    global.Wirecloud = {
        Utils: {
            gettext: (text) => text,
        },
        io: {
            makeRequest(url, options) {
                assert.equal(url, '/docs');
                if (mode === 'success') {
                    options.onSuccess({ responseText: '<strong>ok</strong>' });
                } else {
                    options.onFailure({});
                }
                options.onComplete();
            }
        },
        ui: { WindowMenu }
    };

    loadLegacyScript('src/wirecloud/commons/static/js/wirecloud/ui/HTMLWindowMenu.js');

    const menu = new Wirecloud.ui.HTMLWindowMenu('/docs', 'Documentation', 'extra');
    assert.equal(menu.extraClass, 'wc-html-window-menu extra');
    assert.equal(menu.button.options.text, 'Close');
    assert.equal(menu.button.parentNode, menu.windowBottom);
    assert.equal(menu.button.eventName, 'click');
    assert.equal(menu.button.handler, menu._closeListener);

    menu.show();
    assert.equal(menu.baseShowCalls, 1);
    assert.equal(menu.windowContent.innerHTML, '<strong>ok</strong>');
    assert.equal(menu.repaintCalls, 1);
    assert.equal(menu.windowContent.classList.contains('disabled'), false);

    mode = 'failure';
    menu.show();
    assert.equal(
        menu.windowContent.innerHTML,
        '<div class="alert alert-danger">Error processing resource documentation</div>'
    );
});
