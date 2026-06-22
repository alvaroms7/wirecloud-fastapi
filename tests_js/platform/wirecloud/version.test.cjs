const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bootstrapWirecloudVersion,
    resetLegacyRuntime,
} = require('../../support/legacy-runtime.cjs');

test.beforeEach(() => {
    resetLegacyRuntime();
    bootstrapWirecloudVersion();
});

test('Wirecloud.Version parses valid versions and normalizes dev strings', () => {
    const version = new Wirecloud.Version('1.2.0rc3-devalice');

    assert.deepEqual(version.array, [1, 2, 0]);
    assert.deepEqual(version.pre_version_array, ['rc', 3]);
    assert.equal(version.dev, true);
    assert.equal(version.devtext, 'alice');
    assert.equal(version.toString(), '1.2.0rc3-dev');
});

test('Wirecloud.Version compares release, prerelease, and dev builds correctly', () => {
    assert.equal(new Wirecloud.Version('1.0').compareTo('1.0'), 0);
    assert.equal(new Wirecloud.Version('1.0').compareTo('1.0rc1'), 1);
    assert.equal(new Wirecloud.Version('1.0a1').compareTo('1.0b1'), -1);
    assert.equal(new Wirecloud.Version('1.0rc1').compareTo('1.0b2'), 1);
    assert.equal(new Wirecloud.Version('1.0-devalice').compareTo('1.0'), -1);
});

test('Wirecloud.Version rejects malformed versions', () => {
    assert.throws(() => new Wirecloud.Version('invalid'), /is not a valid version/);
    assert.throws(() => new Wirecloud.Version(null), /missing or invalid version parameter/);
    assert.throws(() => new Wirecloud.Version('1.0').compareTo('bad'), /invalid version parameter/);
});

test('Wirecloud.Version compareTo handles different array lengths', () => {
    // 1.0.0 vs 1.0 — second has fewer segments, null coalesce uses 0
    assert.equal(new Wirecloud.Version('1.0.0').compareTo('1.0'), 0);
    // 1.0.1 vs 1.0 — patch version 1 > 0
    assert.equal(new Wirecloud.Version('1.0.1').compareTo('1.0'), 1);
    // 1.0 vs 1.0.1 — 0 < 1
    assert.equal(new Wirecloud.Version('1.0').compareTo('1.0.1'), -1);
});

test('Wirecloud.Version compareTo dev versions with different devtext', () => {
    // Both dev, different devtext → returns 1
    assert.equal(new Wirecloud.Version('1.0-devalice').compareTo('1.0-devbob'), 1);
});

test('Wirecloud.Version compareTo dev versions with same devtext returns 0', () => {
    assert.equal(new Wirecloud.Version('1.0-devalice').compareTo('1.0-devalice'), 0);
});

test('Wirecloud.Version compareTo both non-dev (null devtext) returns 0', () => {
    assert.equal(new Wirecloud.Version('1.0').compareTo('1.0'), 0);
});

test('Wirecloud.Version compareTo non-dev version is higher than dev version', () => {
    assert.equal(new Wirecloud.Version('1.0').compareTo('1.0-devalice'), 1);
});
