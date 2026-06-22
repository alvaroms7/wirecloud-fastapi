'use strict';

const Module = require('node:module');

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'yargs/yargs') {
        return originalLoad.call(this, 'yargs', parent, isMain);
    }

    return originalLoad.call(this, request, parent, isMain);
};
