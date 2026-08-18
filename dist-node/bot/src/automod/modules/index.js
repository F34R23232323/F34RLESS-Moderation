"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAutomodModules = registerAutomodModules;
const tracker_1 = require("../tracker");
const inviteResolver_1 = require("../inviteResolver");
const spam_1 = require("./spam");
const crossChannel_1 = require("./crossChannel");
const linkFilter_1 = require("./linkFilter");
const imageSpam_1 = require("./imageSpam");
const executableFiles_1 = require("./executableFiles");
const massImages_1 = require("./massImages");
const invites_1 = require("./invites");
const emojiSpam_1 = require("./emojiSpam");
const lineSpam_1 = require("./lineSpam");
const pollSpam_1 = require("./pollSpam");
const regexEngine_1 = require("./regexEngine");
const typingSpeed_1 = require("../heuristics/typingSpeed");
const massIdenticalJoins_1 = require("../heuristics/massIdenticalJoins");
const newAccountVelocity_1 = require("../heuristics/newAccountVelocity");
function registerAutomodModules(app, manager) {
    const tracker = new tracker_1.MessageTracker();
    const invites = new inviteResolver_1.InviteResolver(app.client);
    const modules = [
        (0, spam_1.createSpamModule)(tracker),
        (0, crossChannel_1.createCrossChannelModule)(),
        (0, linkFilter_1.createLinkFilterModule)(),
        (0, imageSpam_1.createImageSpamModule)(),
        (0, executableFiles_1.createExecutableFilesModule)(),
        (0, massImages_1.createMassImagesModule)(),
        (0, invites_1.createInvitesModule)(invites),
        (0, emojiSpam_1.createEmojiSpamModule)(),
        (0, lineSpam_1.createLineSpamModule)(),
        (0, pollSpam_1.createPollSpamModule)(),
        (0, regexEngine_1.createRegexEngineModule)(),
        (0, typingSpeed_1.createTypingSpeedModule)(),
    ];
    for (const m of modules) {
        manager.registerModule(m);
        if (m.name === 'regex_engine') {
            app.ruleVersioning.saveVersion(app.config.bot.owner_ids[0] ?? '0', 'regex_engine', 'engine', app.config.regex_engine).catch(() => undefined);
        }
    }
    manager.registerJoinModule((0, massIdenticalJoins_1.createMassIdenticalJoinsModule)());
    manager.registerJoinModule((0, newAccountVelocity_1.createNewAccountVelocityModule)());
}
//# sourceMappingURL=index.js.map