const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { repoRoot } = require('../support/legacy-runtime.cjs');

const makeTempProject = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wirecloud-js-tests-'));

test('run-js-tests exits with failure when no test files are found', () => {
    const projectDir = makeTempProject();
    fs.mkdirSync(path.join(projectDir, 'tests_js'));

    const result = spawnSync(process.execPath, [
        path.join(repoRoot, 'scripts/run-js-tests.mjs')
    ], {
        cwd: projectDir,
        encoding: 'utf8'
    });

    assert.equal(result.status, 1);
});

test('run-js-tests discovers nested .test.cjs files and runs them', () => {
    const projectDir = makeTempProject();
    const testsDir = path.join(projectDir, 'tests_js', 'nested');
    fs.mkdirSync(testsDir, { recursive: true });

    fs.writeFileSync(path.join(projectDir, 'tests_js', 'top.test.cjs'), `
        const test = require('node:test');
        test('top', () => {});
    `);
    fs.writeFileSync(path.join(testsDir, 'inner.test.cjs'), `
        const test = require('node:test');
        test('inner', () => {});
    `);

    const result = spawnSync(process.execPath, [
        path.join(repoRoot, 'scripts/run-js-tests.mjs')
    ], {
        cwd: projectDir,
        encoding: 'utf8'
    });

    assert.equal(result.status, 0);
});

test('run-js-tests rethrows spawnSync errors from the child process launcher', () => {
    const projectDir = makeTempProject();
    fs.mkdirSync(path.join(projectDir, 'tests_js'));
    fs.writeFileSync(path.join(projectDir, 'tests_js', 'dummy.test.cjs'), `
        const test = require('node:test');
        test('dummy', () => {});
    `);

    const preloadPath = path.join(projectDir, 'mock-spawn-error.cjs');
    fs.writeFileSync(preloadPath, `
        const childProcess = require('node:child_process');
        const { syncBuiltinESMExports } = require('node:module');
        childProcess.spawnSync = () => ({ error: new Error('synthetic spawn failure') });
        syncBuiltinESMExports();
    `);

    const result = spawnSync(process.execPath, [
        '--require',
        preloadPath,
        path.join(repoRoot, 'scripts/run-js-tests.mjs')
    ], {
        cwd: projectDir,
        encoding: 'utf8'
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /synthetic spawn failure/);
});

test('run-js-tests falls back to exit code 1 when child status is null', () => {
    const projectDir = makeTempProject();
    fs.mkdirSync(path.join(projectDir, 'tests_js'));
    fs.writeFileSync(path.join(projectDir, 'tests_js', 'dummy.test.cjs'), `
        const test = require('node:test');
        test('dummy', () => {});
    `);

    const preloadPath = path.join(projectDir, 'mock-spawn-null-status.cjs');
    fs.writeFileSync(preloadPath, `
        const childProcess = require('node:child_process');
        const { syncBuiltinESMExports } = require('node:module');
        childProcess.spawnSync = () => ({ status: null });
        syncBuiltinESMExports();
    `);

    const result = spawnSync(process.execPath, [
        '--require',
        preloadPath,
        path.join(repoRoot, 'scripts/run-js-tests.mjs')
    ], {
        cwd: projectDir,
        encoding: 'utf8'
    });

    assert.equal(result.status, 1);
});
