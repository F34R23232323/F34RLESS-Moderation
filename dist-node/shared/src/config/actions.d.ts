import { z } from 'zod';
export declare const messageFormatSchema: z.ZodEnum<["plain", "embed", "components_v2"]>;
export type MessageFormat = z.infer<typeof messageFormatSchema>;
export declare const actionChainStepSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"delete_message">;
}, "strict", z.ZodTypeAny, {
    type: "delete_message";
}, {
    type: "delete_message";
}>, z.ZodObject<{
    type: z.ZodLiteral<"send_channel_message">;
    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
    content: z.ZodString;
    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    type: "send_channel_message";
    format: "plain" | "embed" | "components_v2";
    content: string;
    delete_after_seconds: number;
}, {
    type: "send_channel_message";
    content: string;
    format?: "plain" | "embed" | "components_v2" | undefined;
    delete_after_seconds?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"dm_user">;
    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
    content: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "dm_user";
    format: "plain" | "embed" | "components_v2";
    content: string;
}, {
    type: "dm_user";
    content: string;
    format?: "plain" | "embed" | "components_v2" | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"warn">;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "warn";
    reason?: string | undefined;
}, {
    type: "warn";
    reason?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodEnum<["mute", "timeout", "ban"]>;
    duration: z.ZodDefault<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "mute" | "timeout" | "ban";
    duration: string;
    reason?: string | undefined;
}, {
    type: "mute" | "timeout" | "ban";
    duration?: string | undefined;
    reason?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"kick">;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "kick";
    reason?: string | undefined;
}, {
    type: "kick";
    reason?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"add_role">;
    role_id: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "add_role";
    role_id: string;
}, {
    type: "add_role";
    role_id: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"remove_role">;
    role_id: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "remove_role";
    role_id: string;
}, {
    type: "remove_role";
    role_id: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"run_escalation_check">;
}, "strict", z.ZodTypeAny, {
    type: "run_escalation_check";
}, {
    type: "run_escalation_check";
}>]>;
export declare const actionChainSchema: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"delete_message">;
}, "strict", z.ZodTypeAny, {
    type: "delete_message";
}, {
    type: "delete_message";
}>, z.ZodObject<{
    type: z.ZodLiteral<"send_channel_message">;
    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
    content: z.ZodString;
    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    type: "send_channel_message";
    format: "plain" | "embed" | "components_v2";
    content: string;
    delete_after_seconds: number;
}, {
    type: "send_channel_message";
    content: string;
    format?: "plain" | "embed" | "components_v2" | undefined;
    delete_after_seconds?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"dm_user">;
    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
    content: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "dm_user";
    format: "plain" | "embed" | "components_v2";
    content: string;
}, {
    type: "dm_user";
    content: string;
    format?: "plain" | "embed" | "components_v2" | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"warn">;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "warn";
    reason?: string | undefined;
}, {
    type: "warn";
    reason?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodEnum<["mute", "timeout", "ban"]>;
    duration: z.ZodDefault<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "mute" | "timeout" | "ban";
    duration: string;
    reason?: string | undefined;
}, {
    type: "mute" | "timeout" | "ban";
    duration?: string | undefined;
    reason?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"kick">;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "kick";
    reason?: string | undefined;
}, {
    type: "kick";
    reason?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"add_role">;
    role_id: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "add_role";
    role_id: string;
}, {
    type: "add_role";
    role_id: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"remove_role">;
    role_id: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "remove_role";
    role_id: string;
}, {
    type: "remove_role";
    role_id: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"run_escalation_check">;
}, "strict", z.ZodTypeAny, {
    type: "run_escalation_check";
}, {
    type: "run_escalation_check";
}>]>, "many">;
export type ActionChainStep = z.infer<typeof actionChainStepSchema>;
export type ActionChain = z.infer<typeof actionChainSchema>;
export declare const durationSchema: z.ZodString;
export declare const snowflakeSchema: z.ZodString;
