import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { GuildMember } from 'discord.js';

// Random theme generators
const generateRandomGradient = (ctx: any, width: number, height: number) => {
  const gradients = [
    ['#ff9a9e', '#fecfef'], // Peach
    ['#a18cd1', '#fbc2eb'], // Purple
    ['#84fab0', '#8fd3f4'], // Green/Blue
    ['#fccb90', '#d57eeb'], // Orange/Pink
    ['#e0c3fc', '#8ec5fc'], // Light Purple/Blue
    ['#4facfe', '#00f2fe'], // Bright Blue
    ['#f093fb', '#f5576c'], // Pink/Red
    ['#43e97b', '#38f9d7'], // Green
    ['#fa709a', '#fee140'], // Pink/Yellow
    ['#30cfd0', '#330867'], // Dark Blue/Purple
  ];
  
  const colors = gradients[Math.floor(Math.random() * gradients.length)];
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  return gradient;
};

const drawSparkles = (ctx: any, width: number, height: number) => {
  const numSparkles = Math.floor(Math.random() * 20) + 10;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let i = 0; i < numSparkles; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 3 + 1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
};

export async function generateBoosterImage(member: GuildMember): Promise<Buffer> {
  const width = 800;
  const height = 250;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw background
  ctx.fillStyle = generateRandomGradient(ctx, width, height);
  ctx.fillRect(0, 0, width, height);
  drawSparkles(ctx, width, height);

  // Add a semi-transparent dark overlay for better text readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, width, height);

  // Draw Avatar
  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await loadImage(avatarUrl);
  
  const avatarX = 50;
  const avatarY = 50;
  const avatarSize = 150;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  // Draw avatar border
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#f47fff'; // Discord boost pinkish color
  ctx.stroke();

  // Texts
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('SERVER BOOSTED!', 230, 80);

  ctx.font = '30px sans-serif';
  const name = member.user.username;
  ctx.fillText(`Thank you, ${name}!`, 230, 130);

  // Boost calculation
  const guild = member.guild;
  const currentBoosts = guild.premiumSubscriptionCount || 0;
  let nextLevelBoosts = 2;
  let nextLevel = 1;

  if (currentBoosts < 2) {
    nextLevelBoosts = 2;
    nextLevel = 1;
  } else if (currentBoosts < 7) {
    nextLevelBoosts = 7;
    nextLevel = 2;
  } else if (currentBoosts < 14) {
    nextLevelBoosts = 14;
    nextLevel = 3;
  } else {
    nextLevelBoosts = currentBoosts; // Max level reached
    nextLevel = 3;
  }

  const boostsNeeded = Math.max(0, nextLevelBoosts - currentBoosts);
  
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#f47fff';
  
  const currentBoostText = `Current Boosts: ${currentBoosts}`;
  ctx.fillText(currentBoostText, 230, 180);

  if (currentBoosts < 14) {
    ctx.fillStyle = '#cccccc';
    ctx.font = '20px sans-serif';
    ctx.fillText(`${boostsNeeded} boosts until Level ${nextLevel}`, 230, 215);
  } else {
    ctx.fillStyle = '#cccccc';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Maximum Level Reached!`, 230, 215);
  }

  return canvas.toBuffer('image/png');
}
