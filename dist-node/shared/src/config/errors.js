"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigValidationError = void 0;
class ConfigValidationError extends Error {
    issues;
    constructor(issues) {
        super(`Config validation failed with ${issues.length} issue(s)`);
        this.name = 'ConfigValidationError';
        this.issues = issues;
    }
    formatHumanReadable() {
        const lines = this.issues.map((i) => `  - ${i.path}\n      expected: ${i.expected}\n      found:    ${i.found}`);
        return `Invalid configuration:\n${lines.join('\n')}`;
    }
}
exports.ConfigValidationError = ConfigValidationError;
//# sourceMappingURL=errors.js.map