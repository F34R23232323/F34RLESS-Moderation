"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('calculator')
    .setDescription('Evaluate a math expression')
    .addStringOption((o) => o.setName('expression').setDescription('Expression, e.g. 2+2*10').setRequired(true));
async function execute(interaction, app) {
    const expr = interaction.options.getString('expression', true);
    const result = safeEval(expr);
    await (0, v2_1.v2Reply)(interaction, `\`${expr}\` = **${result}**`, { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const expr = args.join(' ');
    if (!expr) {
        await message.reply({ content: 'Usage: `!calc <expression>`' });
        return;
    }
    await message.reply({ content: `\`${expr}\` = **${safeEval(expr)}**` });
}
function safeEval(expr) {
    const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
    if (!sanitized)
        return 'invalid expression';
    try {
        const value = Function(`"use strict"; return (${sanitized});`)();
        if (typeof value !== 'number' || !Number.isFinite(value))
            return 'invalid result';
        return String(Math.round(value * 1e6) / 1e6);
    }
    catch {
        return 'invalid expression';
    }
}
const command = {
    name: 'calculator',
    category: 'utility',
    description: 'Evaluate a math expression',
    data,
    permissions: [],
    aliases: ['calc'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=calculator.js.map