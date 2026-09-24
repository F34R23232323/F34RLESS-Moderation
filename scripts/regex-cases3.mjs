export const CASES = {
  'Emergency Staff Pin': {
    shouldMatch: ['<@&1485003903891275977>'],
    shouldNotMatch: ['<@&1485003903891275978>', 'hello @everyone', 'ping the staff', '<@1485003903891275977>'],
  },
  'Piracy': {
    shouldMatch: [
      'how to pirate software',
      'where to download free movies',
      'how to crack a game',
      'pirate bay',
      '1337x',
      'magnet: link',
      'nulled script',
      'bypass activation',
      'stolen software',
      'free crack',
      'downloading from torrent',
      'warez download',
      'reupload link for crack',
      'crack download',
    ],
    shouldNotMatch: [
      'how to crack an egg', 'how to get free advice', 'the pirate of the caribbean',
      'i need a crack for my phone screen', 'download link for my mod', 'how to bypass a level',
    ],
  },
  'Alt Account Promotion': {
    shouldMatch: [
      'use my alt account',
      'this is my backup account',
      'ban evading',
      'evading the ban',
      'smurf account',
      'i am on my alt right now',
      'switch to your alternate account',
      'avoid the ban with an alt',
    ],
    shouldNotMatch: [
      'i lost my account password', 'my backup drive failed', 'the account was compromised',
      'make a new account for the website', 'my secondary email address',
    ],
  },
  'Staff Impersonation': {
    shouldMatch: [
      'i am staff',
      "i'm an admin",
      'i am the mod',
      'i have the power to ban',
      'i work for discord',
      'i am owner',
      'i have authority to kick',
    ],
    shouldNotMatch: [
      'the staff is nice', 'i am tired', 'discord is a platform', 'i have a power bank',
      'he is a mod', 'i work hard', 'admin panel is broken',
    ],
  },
  'Advertising & DM Ads': {
    shouldMatch: [
      'free nitro',
      'free robux',
      'free vbucks now',
      'free steam keys',
      'giveaway click here',
      "i'm selling accounts",
      'my dms are open',
      'use my referral code',
      'prize click here',
      'giveaway enter now',
    ],
    shouldNotMatch: [
      'free stuff', 'the giveaway is today', 'i won a prize', 'my code works',
      'the crypto market crashed', 'i am selling my house',
    ],
  },
  'Bumping': {
    shouldMatch: ['bump', 'please bump', 'bumping', 'disboard', 'type !bump', 'bump this server'],
    shouldNotMatch: ['bumpy ride', 'i love this server', 'b u m p', 'jumping jacks', 'the big dog'],
  },
};
