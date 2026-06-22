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
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    bootstrapWirecloudVersion();
    Wirecloud.Utils = StyledElements.Utils;

    // Mock location for base_url
    global.location = { origin: 'http://localhost' };

    // Mock URLs for base_url
    Wirecloud.URLs = {
        MAC_BASE_URL: {
            evaluate: (opts) => '/mac/' + opts.vendor + '/' + opts.name + '/' + opts.version + '/'
        }
    };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/UserPrefDef.js',
        'src/wirecloud/platform/static/js/wirecloud/MashableApplicationComponent.js',
    ]);
});

test('MashableApplicationComponent constructor creates component', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget',
        macversion: 2,
        vendor: 'TestVendor',
        name: 'TestWidget',
        version: '1.0.0',
        title: 'Test Widget',
        description: 'A test widget',
        preferences: [],
        requirements: [],
        wiring: {}
    });

    assert.equal(comp.vendor, 'TestVendor');
    assert.equal(comp.name, 'TestWidget');
    assert.equal(comp.uri, 'TestVendor/TestWidget/1.0.0');
    assert.equal(comp.group_id, 'TestVendor/TestWidget');
    assert.equal(comp.type, 'widget');
    assert.equal(comp.missing, false);
    assert.equal(comp.macversion, 2);
    assert.ok(comp.version instanceof Wirecloud.Version);
});

test('MashableApplicationComponent constructor with missing=true', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        vendor: 'Vendor',
        name: 'Name',
        version: '1.0',
        type: 'widget',
        missing: true,
        preferences: [],
        requirements: [],
        wiring: {}
    });

    assert.equal(comp.missing, true);
    assert.equal(comp.macversion, undefined);
});

test('MashableApplicationComponent throws on null desc', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent(null),
        /missing mashable application component description parameter/
    );
});

test('MashableApplicationComponent throws on missing macversion when not missing', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            type: 'widget', vendor: 'V', name: 'N', version: '1.0',
            preferences: [], requirements: [], wiring: {}
        }),
        /missing macversion/
    );
});

test('MashableApplicationComponent throws on invalid macversion type', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            type: 'widget', vendor: 'V', name: 'N', version: '1.0', macversion: 'not-number',
            preferences: [], requirements: [], wiring: {}
        }),
        /invalid macversion: must be a number/
    );
});

test('MashableApplicationComponent throws on invalid macversion value', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            type: 'widget', vendor: 'V', name: 'N', version: '1.0', macversion: 3,
            preferences: [], requirements: [], wiring: {}
        }),
        /invalid macversion: must be 1 or 2/
    );
});

test('MashableApplicationComponent throws on missing vendor', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            type: 'widget', macversion: 2, name: 'N', version: '1.0',
            preferences: [], requirements: [], wiring: {}
        }),
        /missing vendor/
    );
});

test('MashableApplicationComponent throws on empty vendor', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            type: 'widget', macversion: 2, vendor: '  ', name: 'N', version: '1.0',
            preferences: [], requirements: [], wiring: {}
        }),
        /missing vendor/
    );
});

test('MashableApplicationComponent throws on missing name', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            type: 'widget', macversion: 2, vendor: 'V', version: '1.0',
            preferences: [], requirements: [], wiring: {}
        }),
        /missing name/
    );
});

test('MashableApplicationComponent throws on missing version', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            type: 'widget', macversion: 2, vendor: 'V', name: 'N',
            preferences: [], requirements: [], wiring: {}
        }),
        /missing version/
    );
});

test('MashableApplicationComponent title defaults to name', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'WidgetName', version: '1.0',
        preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.title, 'WidgetName');
});

test('MashableApplicationComponent hasEndpoints returns false when none', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.hasEndpoints(), false);
});

test('MashableApplicationComponent hasPreferences returns false when none', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.hasPreferences(), false);
});

test('MashableApplicationComponent is returns true for same component', () => {
    const comp1 = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp1.is(comp1), true);
});

test('MashableApplicationComponent is returns false for null', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.is(null), false);
});

test('MashableApplicationComponent with wiring inputs/outputs', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        preferences: [],
        requirements: [],
        wiring: {
            inputs: [{ name: 'in1' }],
            outputs: [{ name: 'out1' }, { name: 'out2' }]
        }
    });

    assert.equal(comp.inputList.length, 1);
    assert.equal(comp.outputList.length, 2);
    assert.equal(comp.hasEndpoints(), true);
});

test('MashableApplicationComponent with preferences builds pref list', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget',
        macversion: 2,
        vendor: 'V',
        name: 'N',
        version: '1.0',
        title: 'Test',
        preferences: [
            { name: 'pref1', type: 'text', label: 'Preference 1' },
            { name: 'pref2', type: 'boolean', label: 'Preference 2', default: 'false' }
        ],
        requirements: [],
        wiring: {}
    });

    assert.equal(comp.hasPreferences(), true);
    assert.equal(comp.preferenceList.length, 2);
    assert.equal(comp.preferences.pref1.name, 'pref1');
    assert.equal(comp.preferences.pref2.name, 'pref2');
    assert.ok(Object.isFrozen(comp.preferences));
    assert.ok(Object.isFrozen(comp.preferenceList));
});

test('MashableApplicationComponent title falls back to name when title is empty', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'WidgetName', version: '1.0',
        title: '   ',
        preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.title, 'WidgetName');
});

test('MashableApplicationComponent with wiring=null defaults to empty', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget',
        macversion: 2,
        vendor: 'V',
        name: 'N',
        version: '1.0',
        preferences: [],
        requirements: [],
        wiring: null
    });

    assert.equal(comp.inputList.length, 0);
    assert.equal(comp.outputList.length, 0);
    assert.equal(comp.hasEndpoints(), false);
});

test('MashableApplicationComponent throws on missing type', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            macversion: 2, vendor: 'V', name: 'N', version: '1.0',
            preferences: [], requirements: [], wiring: {}
        }),
        /missing type/
    );
});

test('MashableApplicationComponent throws on non-string type', () => {
    assert.throws(
        () => new Wirecloud.MashableApplicationComponent({
            type: 123, macversion: 2, vendor: 'V', name: 'N', version: '1.0',
            preferences: [], requirements: [], wiring: {}
        }),
        /missing type/
    );
});

test('MashableApplicationComponent with null image defaults to null', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        image: null, preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.image, null);
});

test('MashableApplicationComponent with null description defaults to empty string', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        description: null, preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.description, '');
});

test('MashableApplicationComponent with null doc defaults to empty string', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        doc: null, preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.doc, '');
});

test('MashableApplicationComponent with null changelog defaults to empty string', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        changelog: null, preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.changelog, '');
});

test('MashableApplicationComponent with non-null image uses provided value', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        image: 'icon.png', preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.image, 'icon.png');
});

test('MashableApplicationComponent with description sets value', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        description: 'A description', preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.description, 'A description');
});

test('MashableApplicationComponent with doc sets value', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        doc: 'docs/readme.html', preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.doc, 'docs/readme.html');
});

test('MashableApplicationComponent with changelog sets value', () => {
    const comp = new Wirecloud.MashableApplicationComponent({
        type: 'widget', macversion: 2, vendor: 'V', name: 'N', version: '1.0',
        changelog: 'v1.0 - initial', preferences: [], requirements: [], wiring: {}
    });
    assert.equal(comp.changelog, 'v1.0 - initial');
});
