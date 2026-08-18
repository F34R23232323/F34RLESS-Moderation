export declare const DEFAULT_ACTION_CHAIN: readonly [{
    readonly type: "delete_message";
}, {
    readonly type: "send_channel_message";
    readonly format: "components_v2";
    readonly content: "{user}, your message was removed in {channel}.";
    readonly delete_after_seconds: 15;
}, {
    readonly type: "warn";
    readonly reason: "Automod: {rule}";
}, {
    readonly type: "run_escalation_check";
}];
export declare const DEFAULT_WARN_CHAIN: readonly [{
    readonly type: "warn";
    readonly reason: "Automod: {rule}";
}, {
    readonly type: "run_escalation_check";
}];
