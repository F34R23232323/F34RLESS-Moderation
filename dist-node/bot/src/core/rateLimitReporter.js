"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installRateLimitReporter = installRateLimitReporter;
function installRateLimitReporter(app) {
    app.client.on('rateLimit', (info) => {
        void app.logManager.reportRateLimit({
            route: info.route ?? info.path ?? 'unknown',
            method: info.method ?? 'UNKNOWN',
            timeout: info.timeout ?? info.retryAfter ?? 0,
            global: info.global ?? false,
            bucket: info.bucket ?? null,
        });
    });
    app.client.rest.on('rateLimited', (info) => {
        void app.logManager.reportRateLimit({
            route: info.route,
            method: info.method,
            timeout: info.retryAfter,
            global: info.global,
        });
    });
}
//# sourceMappingURL=rateLimitReporter.js.map