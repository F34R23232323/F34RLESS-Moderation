import { friendlyEventName, formatDetails, logAccent } from '../bot/src/core/logFormatter';
import { buildRichV2 } from '../bot/src/utils/v2';

const msg = 'Message deleted in <#1466990156199362878> by <@1075077561454973020>';
const details = {
  channelId: '1466990156199362878',
  messageId: '1538998438186975282',
  authorId: '1075077561454973020',
  createdAt: '<t:1690000000:f>',
  content: '<t:1786996218:t>',
  attachments: 0,
};
const lines = [msg, ...formatDetails(details, null)];
console.log('--- rendered fields ---');
lines.forEach((l) => console.log(' ', l));

const rich = buildRichV2({
  accentColor: logAccent('message_delete'),
  header: friendlyEventName('message_delete'),
  text: lines.join('\n'),
  footer: '<t:1690000000:f>',
});
console.log('--- valid V2 payload? ---', JSON.stringify(rich.components).slice(0, 100));
console.log('mentions preserved (rendered, pings disabled at send time):', /<@|<#/.test(lines.join('\n')));