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
exports.ComponentRegistry = void 0;
exports.loadComponents = loadComponents;
exports.dispatchComponent = dispatchComponent;
const path = __importStar(require("path"));
const fs_1 = require("../utils/fs");
class ComponentRegistry {
    handlers = new Map();
    register(handler) {
        this.handlers.set(`${handler.type}:${handler.id}`, handler);
    }
    resolve(type, customId) {
        const exact = this.handlers.get(`${type}:${customId}`);
        if (exact)
            return exact;
        for (const [key, handler] of this.handlers) {
            if (!key.startsWith(`${type}:`))
                continue;
            const id = key.slice(type.length + 1);
            if (customId.startsWith(id))
                return handler;
        }
        return undefined;
    }
}
exports.ComponentRegistry = ComponentRegistry;
async function loadComponents(app) {
    const dir = path.join(__dirname, '../components');
    const handlers = await (0, fs_1.importFiles)(dir);
    let count = 0;
    for (const raw of handlers) {
        const list = Array.isArray(raw) ? raw : [raw];
        for (const h of list) {
            if (!h || !h.id || typeof h.run !== 'function')
                continue;
            app.components.register(h);
            count++;
        }
    }
    app.logger.info(`Registered ${count} component handlers`);
}
async function dispatchComponent(app, type, interaction) {
    try {
        const handler = app.components.resolve(type, interaction.customId);
        if (!handler)
            return;
        await handler.run(app, interaction);
    }
    catch (err) {
        app.logger.error(`Component ${type} ${interaction.customId} threw:`, err);
        await app.logManager.reportError(`Component ${type} ${interaction.customId}`, err);
    }
}
//# sourceMappingURL=componentLoader.js.map