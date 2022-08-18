"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObject = void 0;
function isObject(it) {
    // This is necessary because:
    // typeof null === 'object'
    // typeof [] === 'object'
    // [] instanceof Object === true
    return Object.prototype.toString.call(it) === "[object Object]";
}
exports.isObject = isObject;
