# Permissions

View Audit Log is mandatory for attribution. Its absence forces alert-only behavior. Manage Roles is needed for snapshots, dangerous-role removal, and quarantine. Kick Members and Ban Members are only needed if the root owner separately enables those actions. The bot needs private-channel access for logs; it never posts sensitive evidence to an arbitrary public channel.

Administrator permission does not make a member an anti-nuke owner. Discord's live `guild.ownerId` is immutable root authority.
