import { ShardingManager } from 'discord.js';
import * as path from 'path';

const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
  token: process.env.DISCORD_TOKEN,
  totalShards: 'auto',
  respawn: true,
});

manager.on('shardCreate', (shard) => console.log(`Shard ${shard.id} launched`));
manager.spawn().catch((err) => {
  console.error('Failed to spawn shards:', err);
  process.exit(1);
});