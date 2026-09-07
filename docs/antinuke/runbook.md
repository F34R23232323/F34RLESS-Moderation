# Runbook

- **Missing audit access:** restore View Audit Log, run health, and treat all interim events as unresolved. Never manually assign an executor from proximity.
- **False positive:** remove only the quarantine role, preserve snapshots/evidence, mark false positive, and review thresholds.
- **Emergency safe mode:** disable anti-nuke enforcement; logging and evidence must remain intact.
- **Compromised extra owner:** the current Discord owner revokes the extra owner and reviews configuration history.
- **Broken quarantine role:** disable Pending Review Quarantine, release affected members carefully, create a permissionless manageable replacement, and validate it.
- **Inaccessible logs:** restore a private channel; use root-owner DM fallback only when configured and rate limited.
- **Database/Redis outage:** system is alert-only. Restore dependencies before reenabling mutation.
- **Duplicate enforcement report:** inspect the idempotency key and audit-entry uniqueness record; do not repeat punishment manually.
- **Ownership transfer:** live `guild.ownerId` becomes root authority immediately; audit extra-owner access.
- **Wrong quarantine:** lock the case, remove only the anti-nuke role, do not auto-restore dangerous roles, record reviewer and reason, and notify the member if enabled.
