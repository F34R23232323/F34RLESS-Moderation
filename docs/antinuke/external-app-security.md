# External App Security

Discord bots cannot inspect devices, detect arbitrary desktop/mobile software, reliably detect modified clients, or inspect private OAuth grants Discord does not expose. This module only uses gateway data and uniquely matching audit entries.

Normal application commands, mentions, replies, bot/webhook messages, proximity in time, and being an action target never identify a responsible human. Unresolved bot additions, webhooks, and integrations are alert-only. Only a uniquely attributed, explicitly prohibited action can become `confirmed_prohibited`; Pending Review Quarantine must also be enabled by the live root owner and defaults off.
