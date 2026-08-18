"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEvents = loadEvents;
const path = __importStar(require("path"));
const fs_1 = require("../utils/fs");
async function loadEvents(app) {
    const dir = path.join(__dirname, '../events');
    const events = await (0, fs_1.importFiles)(dir);
    let count = 0;
    for (const ev of events) {
        if (!ev || !ev.name || typeof ev.run !== 'function')
            continue;
        try {
            if (ev.once) {
                app.client.once(ev.name, (...args) => void runEvent(app, ev.name, ev.run, args));
            }
            else {
                app.client.on(ev.name, (...args) => void runEvent(app, ev.name, ev.run, args));
            }
            count++;
        }
        catch (err) {
            app.logger.error(`Failed to register event ${ev.name}:`, err);
        }
    }
    app.logger.info(`Registered ${count} event handlers`);
}
async function runEvent(app, name, run, args) {
    try {
        await run(...args);
    }
    catch (err) {
        app.logger.error(`Event ${name} threw:`, err);
        await app.logManager.reportError(`Event ${name} threw`, err);
    }
}
//# sourceMappingURL=eventLoader.js.map