"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ACTION_CHAIN = exports.DEFAULT_CONFIG_PARTIAL = void 0;
exports.createDefaultConfig = createDefaultConfig;
const schema_1 = require("./schema");
exports.DEFAULT_CONFIG_PARTIAL = {
    bot: {
        prefixes: ['!'],
        owner_ids: ['000000000000000000'],
    },
};
function createDefaultConfig() {
    return schema_1.configSchema.parse(exports.DEFAULT_CONFIG_PARTIAL);
}
exports.DEFAULT_ACTION_CHAIN = [
    { type: 'delete_message' },
    {
        type: 'send_channel_message',
        format: 'components_v2',
        content: '{user}, your message was removed in {channel}.',
        delete_after_seconds: 15,
    },
    { type: 'warn', reason: 'Automod: {rule}' },
    { type: 'run_escalation_check' },
];
//# sourceMappingURL=defaults.js.map