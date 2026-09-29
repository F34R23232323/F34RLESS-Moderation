import { GuildMember, AttachmentBuilder, TextChannel } from 'discord.js';
import type { App } from '../core/context';
import { generateBoosterImage } from '../utils/boosterImage';


export async function handleBoosterEvent(app: App, member: GuildMember): Promise<void> {
  const guild = member.guild;
  const config = app.config;
  
  if (!config.booster?.enabled) return;
  if (!config.booster.channel_id) return;
  
  const channel = guild.channels.cache.get(config.booster.channel_id) as TextChannel;
  if (!channel || !channel.isTextBased()) return;

  try {
    const imageBuffer = await generateBoosterImage(member);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'booster.png' });
    
    let rawMsg = config.booster.message || 'Thank you for boosting, {mention}!';
    
    // Simple variable replacement
    rawMsg = rawMsg
      .replace(/{user}/g, member.user.username)
      .replace(/{mention}/g, `<@${member.id}>`)
      .replace(/{server}/g, guild.name)
      .replace(/{guild}/g, guild.name);
      
    // Send it. We'll use simple parsing if the bot uses parseStringAsV2 or just simple send.
    // Let's send the text and attachment.
    await channel.send({
      content: rawMsg,
      files: [attachment]
    });
  } catch (error) {
    app.logger.error('Failed to send booster message:', error);
  }
}
