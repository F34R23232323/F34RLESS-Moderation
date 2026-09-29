import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import { buildIgnoreAllConfirmation } from '../src/components/reports';
import reportHandlers from '../src/components/reports';
import { v2Result, v2Ephemeral } from '../src/utils/v2';

describe('Reports Components V2 compatibility', () => {
  test('buildIgnoreAllConfirmation produces Components V2 payload without content', () => {
    const res = buildIgnoreAllConfirmation(5, '123456789012345678', true);
    assert.equal((res as any).content, undefined, 'Must not contain legacy content field');
    assert.ok(Array.isArray(res.components), 'Must contain components array');
    assert.equal(res.components.length, 1, 'Must contain 1 container component');
    assert.ok((res.flags & MessageFlags.IsComponentsV2) !== 0, 'Must have IsComponentsV2 flag');
    assert.ok((res.flags & MessageFlags.Ephemeral) !== 0, 'Must have Ephemeral flag when ephemeral=true');
  });

  test('buildIgnoreAllConfirmation non-ephemeral produces Components V2 payload without content', () => {
    const res = buildIgnoreAllConfirmation(3, '123456789012345678', false);
    assert.equal((res as any).content, undefined, 'Must not contain legacy content field');
    assert.ok((res.flags & MessageFlags.IsComponentsV2) !== 0, 'Must have IsComponentsV2 flag');
    assert.equal(res.flags & MessageFlags.Ephemeral, 0, 'Must not have Ephemeral flag when ephemeral=false');
  });

  test('v2Result and v2Ephemeral never have a top-level content field', () => {
    const result = v2Result('Action completed', 0x57f287);
    assert.equal((result as any).content, undefined);
    assert.ok(Array.isArray(result.components));
    assert.equal((result.flags & MessageFlags.IsComponentsV2), MessageFlags.IsComponentsV2);

    const eph = v2Ephemeral('Ephemeral message');
    assert.equal((eph as any).content, undefined);
    assert.ok(Array.isArray(eph.components));
    assert.ok((eph.flags & MessageFlags.IsComponentsV2) !== 0);
    assert.ok((eph.flags & MessageFlags.Ephemeral) !== 0);
  });

  test('ignoreAll confirm handler updates via v2 container without content field', async () => {
    const ignoreAllHandler = reportHandlers.find((h) => h.id === 'report:ignore-all:');
    assert.ok(ignoreAllHandler, 'Must export report:ignore-all: handler');

    let deferred = false;
    let editReplyPayload: any = null;
    let ignoredActorId = '';

    const mockApp: any = {
      config: { reports: { action_roles: [] } },
      reporting: {
        async ignoreAllOpen(_guildId: string, actorId: string) {
          ignoredActorId = actorId;
          return 5;
        },
      },
    };

    const mockInteraction: any = {
      customId: 'report:ignore-all:confirm:1075077561454973020',
      user: { id: '1075077561454973020' },
      guild: { id: 'guild123' },
      member: {
        permissions: { has: (perm: string) => perm === 'ModerateMembers' },
        roles: { cache: { some: () => false } },
      },
      async deferUpdate() {
        deferred = true;
      },
      async editReply(payload: any) {
        editReplyPayload = payload;
      },
    };

    await (ignoreAllHandler as any).run(mockApp, mockInteraction);

    assert.equal(deferred, true, 'Interaction must be deferred with deferUpdate()');
    assert.equal(ignoredActorId, '1075077561454973020', 'Must call ignoreAllOpen with the actor ID');
    assert.ok(editReplyPayload, 'Must call editReply with a result payload');
    assert.equal(editReplyPayload.content, undefined, 'editReply payload MUST NOT contain legacy content field');
    assert.ok(Array.isArray(editReplyPayload.components), 'editReply payload must contain components array');
    assert.ok(editReplyPayload.components.length > 0, 'editReply payload components array must not be empty');
    assert.ok((editReplyPayload.flags & MessageFlags.IsComponentsV2) !== 0, 'editReply payload must have IsComponentsV2 flag');
  });

  test('ignoreAll cancel handler updates via v2 container without content field', async () => {
    const ignoreAllHandler = reportHandlers.find((h) => h.id === 'report:ignore-all:');
    assert.ok(ignoreAllHandler);

    let updatePayload: any = null;

    const mockApp: any = {
      config: { reports: { action_roles: [] } },
    };

    const mockInteraction: any = {
      customId: 'report:ignore-all:cancel:1075077561454973020',
      user: { id: '1075077561454973020' },
      guild: { id: 'guild123' },
      member: {
        permissions: { has: (perm: string) => perm === 'ModerateMembers' },
        roles: { cache: { some: () => false } },
      },
      async update(payload: any) {
        updatePayload = payload;
      },
    };

    await (ignoreAllHandler as any).run(mockApp, mockInteraction);

    assert.ok(updatePayload, 'Must call update with a payload on cancel');
    assert.equal(updatePayload.content, undefined, 'update payload MUST NOT contain legacy content field');
    assert.ok(Array.isArray(updatePayload.components), 'update payload must contain components array');
    assert.ok(updatePayload.components.length > 0, 'update payload components array must not be empty');
    assert.ok((updatePayload.flags & MessageFlags.IsComponentsV2) !== 0, 'update payload must have IsComponentsV2 flag');
  });
});
