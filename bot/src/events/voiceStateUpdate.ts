import type { VoiceState } from 'discord.js';
import type { App } from '../core/context';

export async function handleVoiceStateUpdate(app: App, oldState: VoiceState, newState: VoiceState): Promise<void> {
  try {
    const memberId = newState.member?.id ?? oldState.member?.id;
    if (!memberId) return;
    const guildId = newState.guild.id ?? oldState.guild.id;
    const oldChannel = oldState.channel?.name ?? 'none';
    const newChannel = newState.channel?.name ?? 'none';
    if (oldChannel === newChannel) return;
    await app.logManager.log({
      event: 'voice_state_update',
      guildId,
      channelId: newState.channelId ?? oldState.channelId,
      targetId: memberId,
      message: `<@${memberId}> moved voice: ${oldChannel} -> ${newChannel}`,
      details: { oldChannel, newChannel },
    });
  } catch (err) {
    app.logger.error('voiceStateUpdate handler threw:', err);
  }
}

export default { name: 'voiceStateUpdate', run: handleVoiceStateUpdate };