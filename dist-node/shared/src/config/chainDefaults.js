"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WARN_CHAIN = exports.DEFAULT_ACTION_CHAIN = void 0;
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
exports.DEFAULT_WARN_CHAIN = [
    { type: 'warn', reason: 'Automod: {rule}' },
    { type: 'run_escalation_check' },
];
//# sourceMappingURL=chainDefaults.js.map