const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLegacyScript, resetLegacyRuntime } = require('../../support/legacy-runtime.cjs');

const setupOperatorAPI = () => {
    if (global.Wirecloud == null) global.Wirecloud = {};
    global._privs = {};
};

test('_OperatorAPI sets up operator module with id, log, getVariable', () => {
    setupOperatorAPI();
    let logged = null;
    const iop = {
        id: 'op1',
        logManager: { log: (msg, level) => { logged = { msg, level }; } },
        properties: { p1: { get: () => 42, set: (v) => { this._v = v; } } },
        inputs: {},
        outputs: {}
    };
    const workspaceview = {
        model: { findOperator: () => iop }
    };
    const parent = { MashupPlatform: { priv: { workspaceview, id: 'op1' } } };

    const fn = function _OperatorAPI(parent) {
        const IOperatorVariable = function IOperatorVariable(variable) {
            this.set = function set(value) { variable.set(value); };
            this.get = function get() { return variable.get(); };
            Object.freeze(this);
        };
        const ioperator = parent.MashupPlatform.priv.workspaceview.model.findOperator(parent.MashupPlatform.priv.id);
        parent.MashupPlatform.priv.resource = ioperator;
        Object.defineProperty(parent.MashupPlatform, 'operator', {value: {}});
        Object.defineProperty(parent.MashupPlatform.operator, 'id', {value: parent.MashupPlatform.priv.id});
        Object.defineProperty(parent.MashupPlatform.operator, 'log', {
            value: function log(msg, level) { ioperator.logManager.log(msg, level); }
        });
        Object.defineProperty(parent.MashupPlatform.operator, 'getVariable', {
            value: function getVariable(name) {
                const variable = ioperator.properties[name];
                if (variable != null) { return new IOperatorVariable(variable); }
            }
        });
    };
    fn(parent);
    assert.equal(parent.MashupPlatform.operator.id, 'op1');
    parent.MashupPlatform.operator.log('test', 1);
    assert.equal(logged.msg, 'test');
    assert.equal(logged.level, 1);
    const v = parent.MashupPlatform.operator.getVariable('p1');
    assert.equal(v.get(), 42);
    assert.equal(parent.MashupPlatform.operator.getVariable('nonexistent'), undefined);
});

test('_OperatorAPI creates InputEndpoint and OutputEndpoint facades', () => {
    setupOperatorAPI();
    const iop = {
        id: 'op1',
        logManager: { log: () => {} },
        properties: {},
        inputs: { in1: { inputs: [] } },
        outputs: { out1: { propagate: () => {}, outputList: [] } }
    };
    const workspaceview = {
        model: { findOperator: () => iop }
    };
    const InputEndpoint = function InputEndpoint(real_endpoint) {
        this.real = real_endpoint;
    };
    const OutputEndpoint = function OutputEndpoint(real_endpoint) {
        this.real = real_endpoint;
    };
    const parent = { MashupPlatform: { priv: { workspaceview, id: 'op1', InputEndpoint, OutputEndpoint } } };

    const fn = function _OperatorAPI(parent) {
        const ioperator = parent.MashupPlatform.priv.workspaceview.model.findOperator(parent.MashupPlatform.priv.id);
        parent.MashupPlatform.priv.resource = ioperator;
        Object.defineProperty(parent.MashupPlatform, 'operator', {value: {}});
        const inputs = {};
        for (const endpoint_name in ioperator.inputs) {
            inputs[endpoint_name] = new parent.MashupPlatform.priv.InputEndpoint(ioperator.inputs[endpoint_name], true);
        }
        Object.defineProperty(parent.MashupPlatform.operator, 'inputs', {value: inputs});
        const outputs = {};
        for (const endpoint_name in ioperator.outputs) {
            outputs[endpoint_name] = new parent.MashupPlatform.priv.OutputEndpoint(ioperator.outputs[endpoint_name], true);
        }
        Object.defineProperty(parent.MashupPlatform.operator, 'outputs', {value: outputs});
    };
    fn(parent);
    assert.ok('in1' in parent.MashupPlatform.operator.inputs);
    assert.ok('out1' in parent.MashupPlatform.operator.outputs);
    assert.ok(parent.MashupPlatform.operator.inputs.in1 instanceof InputEndpoint);
    assert.ok(parent.MashupPlatform.operator.outputs.out1 instanceof OutputEndpoint);
});

test('_OperatorAPI IOperatorVariable is frozen', () => {
    const variable = { get: () => 1, set: (v) => {} };
    const IOperatorVariable = function IOperatorVariable(variable) {
        this.set = function set(value) { variable.set(value); };
        this.get = function get() { return variable.get(); };
        Object.freeze(this);
    };
    const iv = new IOperatorVariable(variable);
    assert.ok(Object.isFrozen(iv));
});

test('_OperatorAPI production implementation builds operator facade', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.window.parent = global.window;

    const calls = {
        endpointArgs: [],
        logs: [],
    };
    class InputEndpoint {
        constructor(endpoint, dynamic) {
            this.endpoint = endpoint;
            this.dynamic = dynamic;
            calls.endpointArgs.push({ type: 'input', endpoint, dynamic });
        }
    }
    class OutputEndpoint {
        constructor(endpoint, dynamic) {
            this.endpoint = endpoint;
            this.dynamic = dynamic;
            calls.endpointArgs.push({ type: 'output', endpoint, dynamic });
        }
    }
    let propertyValue = 1;
    const operator = {
        inputs: { in1: { id: 'in1' } },
        outputs: { out1: { id: 'out1' } },
        properties: {
            prop1: {
                get: () => propertyValue,
                set: (value) => { propertyValue = value; },
            }
        },
        logManager: {
            log(message, level) {
                calls.logs.push({ message, level });
            }
        }
    };
    const parent = {
        MashupPlatform: {
            priv: {
                id: 'operator-1',
                InputEndpoint,
                OutputEndpoint,
                workspaceview: {
                    model: {
                        findOperator(id) {
                            assert.equal(id, 'operator-1');
                            return operator;
                        }
                    }
                }
            }
        }
    };

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudOperatorAPI.js');
    window._privs._OperatorAPI(parent);

    assert.equal(parent.MashupPlatform.priv.resource, operator);
    assert.equal(parent.MashupPlatform.operator.id, 'operator-1');
    parent.MashupPlatform.operator.log('message', 3);
    assert.deepEqual(calls.logs, [{ message: 'message', level: 3 }]);

    const variable = parent.MashupPlatform.operator.getVariable('prop1');
    assert.equal(variable.get(), 1);
    variable.set(5);
    assert.equal(variable.get(), 5);
    assert.equal(Object.isFrozen(variable), true);
    assert.equal(parent.MashupPlatform.operator.getVariable('missing'), undefined);

    assert.equal(parent.MashupPlatform.operator.inputs.in1.dynamic, true);
    assert.equal(parent.MashupPlatform.operator.outputs.out1.dynamic, true);
    assert.deepEqual(calls.endpointArgs.map((entry) => entry.type), ['input', 'output']);
});

test('_OperatorAPI auto-initializes when loaded inside an iframe', () => {
    resetLegacyRuntime();
    global._privs = {};
    global.MashupPlatform = {
        priv: {
            id: 'operator-1',
            InputEndpoint: class InputEndpoint {},
            OutputEndpoint: class OutputEndpoint {},
            workspaceview: {
                model: {
                    findOperator: () => ({
                        inputs: {},
                        outputs: {},
                        properties: {},
                        logManager: { log() {} },
                    })
                }
            }
        }
    };
    global.window.parent = {};

    loadLegacyScript('src/wirecloud/platform/static/js/WirecloudAPI/WirecloudOperatorAPI.js');
    assert.equal(global.MashupPlatform.operator.id, 'operator-1');
});
