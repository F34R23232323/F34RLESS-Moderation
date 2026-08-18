"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteResolver = void 0;
const index_1 = require("../../../shared/src/index");
const CONFUSABLE = {
    'Ｇ': 'g', 'ｇ': 'g', 'Ⅴ': 'v', 'Ⅰ': 'i', 'ｖ': 'v', 'ｉ': 'i',
    'ⓓ': 'd', 'ⓒ': 'c', 'ⓝ': 'n', 'ⅹ': 'x', 'ｘ': 'x', '０': '0',
    'Ｏ': 'o', 'ｏ': 'o', 'Ｌ': 'l', 'ｌ': 'l', 'Ｉ': 'i', 'Ⅱ': 'ii',
};
class InviteResolver {
    client;
    constructor(client) {
        this.client = client;
    }
    extractCodes(content) {
        const normalized = (0, index_1.stripZeroWidth)(content)
            .split('')
            .map((ch) => CONFUSABLE[ch] ?? ch)
            .join('');
        const codes = new Set();
        const patterns = [
            /(?:discord\.(?:gg|com\/invite)\/)([A-Za-z0-9_-]+)/g,
            /(?:dsc\.gg\/)([A-Za-z0-9_-]+)/g,
            /(?:discord\.me\/)([A-Za-z0-9_-]+)/g,
        ];
        for (const re of patterns) {
            let match;
            while ((match = re.exec(normalized)) !== null) {
                codes.add(match[1]);
            }
        }
        return [...codes];
    }
    async resolve(code) {
        try {
            const invite = await this.client.fetchInvite(code);
            return {
                code: invite.code,
                guildId: invite.guild?.id ?? 'unknown',
                guildName: invite.guild?.name ?? 'unknown',
                inviterId: invite.inviter?.id ?? null,
                channelName: invite.channel?.name ?? undefined,
                uses: invite.uses ?? undefined,
            };
        }
        catch {
            return null;
        }
    }
}
exports.InviteResolver = InviteResolver;
//# sourceMappingURL=inviteResolver.js.map