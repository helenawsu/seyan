"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sort = void 0;
/**
 * Sort tokens
 */
function sort(tokens) {
    return tokens.sort((a, b) => {
        if (a.range[0] !== b.range[0]) {
            return a.range[0] - b.range[0];
        }
        return a.range[1] - b.range[1];
    });
}
exports.sort = sort;
