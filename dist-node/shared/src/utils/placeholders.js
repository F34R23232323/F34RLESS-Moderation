"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPlaceholders = renderPlaceholders;
exports.listMissingPlaceholders = listMissingPlaceholders;
function renderPlaceholders(template, ctx) {
    return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (match, key) => {
        const value = ctx[key];
        if (value === undefined || value === null)
            return match;
        return String(value);
    });
}
function listMissingPlaceholders(template, ctx) {
    const missing = [];
    template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (match, key) => {
        if (ctx[key] === undefined || ctx[key] === null)
            missing.push(key);
        return match;
    });
    return missing;
}
//# sourceMappingURL=placeholders.js.map