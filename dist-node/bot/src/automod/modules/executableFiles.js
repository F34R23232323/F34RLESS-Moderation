"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExecutableFilesModule = createExecutableFilesModule;
function createExecutableFilesModule() {
    return {
        name: 'executable_files',
        async check(ctx) {
            const cfg = ctx.app.config.automod.modules.executable_files;
            if (!ctx.message)
                return null;
            for (const attachment of ctx.message.attachments.values()) {
                const name = attachment.name.toLowerCase();
                for (const ext of cfg.blocked_extensions) {
                    if (name.endsWith(ext)) {
                        return {
                            module: 'executable_files',
                            rule: 'executable_files',
                            reason: `executable file: ${attachment.name}`,
                            content: ctx.content || attachment.name,
                        };
                    }
                }
            }
            return null;
        },
    };
}
//# sourceMappingURL=executableFiles.js.map