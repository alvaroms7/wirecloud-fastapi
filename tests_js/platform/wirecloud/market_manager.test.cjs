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
    if (global.Wirecloud == null) {
        global.Wirecloud = {};
    }
    Wirecloud.Utils = StyledElements.Utils;

    // Mock dependencies
    Wirecloud.GlobalLogManager = { parseErrorResponse: (r) => r };
    Wirecloud.io = { makeRequest: () => Promise.resolve({}) };
    Wirecloud.Task = class Task {
        constructor(name, fn) { this._fn = fn; }
        then(fn) { return { toTask: (n) => ({ then: () => {} }) }; }
    };
    Wirecloud.URLs = {
        MARKET_COLLECTION: '/api/market',
        MARKET_ENTRY: { evaluate: (o) => '/api/market/' + o.user + '/' + o.market }
    };
    Wirecloud.ui = { CatalogueView: class {} };

    loadLegacyScripts([
        'src/wirecloud/platform/static/js/wirecloud/MarketManager.js',
    ]);
});

test('MarketManager exists on Wirecloud', () => {
    assert.ok(Wirecloud.MarketManager);
    assert.equal(typeof Wirecloud.MarketManager.getMarkets, 'function');
    assert.equal(typeof Wirecloud.MarketManager.deleteMarket, 'function');
    assert.equal(typeof Wirecloud.MarketManager.addMarket, 'function');
});

test('MarketManager.getMarketTypes returns types', () => {
    const types = Wirecloud.MarketManager.getMarketTypes();
    assert.equal(types.length, 1);
    assert.equal(types[0].label, 'Wirecloud');
    assert.equal(types[0].value, 'wirecloud');
});

test('MarketManager.addMarketType adds new type', () => {
    Wirecloud.MarketManager.addMarketType('custom', 'Custom', class MyView {});
    const types = Wirecloud.MarketManager.getMarketTypes();
    assert.equal(types.length, 2);
});

test('MarketManager.getMarketViewClass returns class for known type', () => {
    const cls = Wirecloud.MarketManager.getMarketViewClass('wirecloud');
    assert.ok(cls === Wirecloud.ui.CatalogueView);
});

test('MarketManager.getMarketViewClass returns null for unknown type', () => {
    const cls = Wirecloud.MarketManager.getMarketViewClass('unknown-type');
    assert.equal(cls, null);
});

test.describe('getMarkets', () => {
    test.beforeEach(() => {
        loadLegacyScripts([
            'src/wirecloud/commons/static/js/wirecloud/Task.js',
        ]);
    });

    test('resolves with filtered data on 200', async () => {
        Wirecloud.io.makeRequest = () => {
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({
                    status: 200,
                    responseText: JSON.stringify({
                        m1: { name: 'Market 1', url: 'http://m1.com' },
                        m2: { name: 'Market 2', url: null },
                    }),
                });
            });
        };

        const task = Wirecloud.MarketManager.getMarkets();
        assert.ok(task instanceof Wirecloud.Task);

        const result = await task;
        assert.deepEqual(result, { m1: { name: 'Market 1', url: 'http://m1.com' } });
    });

    test('rejects on error status 401', async () => {
        Wirecloud.io.makeRequest = () => {
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({ status: 401, responseText: '{}' });
            });
        };

        await assert.rejects(
            () => Wirecloud.MarketManager.getMarkets(),
        );
    });

    test('rejects on unexpected status', async () => {
        Wirecloud.io.makeRequest = () => {
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({ status: 418, responseText: '{}' });
            });
        };

        await assert.rejects(
            () => Wirecloud.MarketManager.getMarkets(),
        );
    });
});

test.describe('deleteMarket', () => {
    test.beforeEach(() => {
        loadLegacyScripts([
            'src/wirecloud/commons/static/js/wirecloud/Task.js',
        ]);
    });

    test('resolves with marketplace on 204', async () => {
        const marketplace = { user: 'u1', name: 'm1' };

        Wirecloud.io.makeRequest = (url, options) => {
            assert.equal(options.method, 'DELETE');
            assert.deepEqual(options.requestHeaders, { Accept: 'application/json' });
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({ status: 204 });
            });
        };

        const task = Wirecloud.MarketManager.deleteMarket(marketplace);
        assert.ok(task instanceof Wirecloud.Task);

        const result = await task;
        assert.deepEqual(result, marketplace);
    });

    test('rejects on error status 403', async () => {
        Wirecloud.io.makeRequest = () => {
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({ status: 403, responseText: '{}' });
            });
        };

        await assert.rejects(
            () => Wirecloud.MarketManager.deleteMarket({ user: 'u1', name: 'm1' }),
        );
    });

    test('rejects on unexpected status', async () => {
        Wirecloud.io.makeRequest = () => {
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({ status: 418, responseText: '{}' });
            });
        };

        await assert.rejects(
            () => Wirecloud.MarketManager.deleteMarket({ user: 'u1', name: 'm1' }),
        );
    });
});

test.describe('addMarket', () => {
    test.beforeEach(() => {
        loadLegacyScripts([
            'src/wirecloud/commons/static/js/wirecloud/Task.js',
        ]);
    });

    test('resolves with market_info on 201', async () => {
        const marketInfo = { name: 'NewMarket', url: 'http://new.com' };

        Wirecloud.io.makeRequest = (url, options) => {
            assert.equal(options.method, 'POST');
            assert.equal(options.contentType, 'application/json');
            assert.equal(options.postBody, JSON.stringify(marketInfo));
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({ status: 201 });
            });
        };

        const task = Wirecloud.MarketManager.addMarket(marketInfo);
        assert.ok(task instanceof Wirecloud.Task);

        const result = await task;
        assert.deepEqual(result, marketInfo);
    });

    test('rejects on error status 409', async () => {
        Wirecloud.io.makeRequest = () => {
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({ status: 409, responseText: '{}' });
            });
        };

        await assert.rejects(
            () => Wirecloud.MarketManager.addMarket({ name: 'test' }),
        );
    });

    test('rejects on unexpected status', async () => {
        Wirecloud.io.makeRequest = () => {
            return new Wirecloud.Task('Mock', (resolve) => {
                resolve({ status: 418, responseText: '{}' });
            });
        };

        await assert.rejects(
            () => Wirecloud.MarketManager.addMarket({ name: 'test' }),
        );
    });
});
