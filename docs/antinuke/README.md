# Anti-Nuke

The anti-nuke subsystem is safety-first: Discord audit logs are the only supported source of human attribution. A destructive gateway event alone never identifies an executor. Unique action, target, timestamp, executor, deduplication, trust, threshold, dependency health, warm-up, and current configuration are checked before enforcement and checked again immediately before mutation.

The repository's existing authoritative datastore is MySQL. A Redis adapter is required for atomic thresholds and distributed locks; until one is configured, the system records evidence and remains alert-only.

Defaults are disabled, observation mode, dry-run, 60-second startup warm-up, 15-second audit window, 250/500/1000/2000 ms retries, confirmed attribution only, quarantine response, kicks and bans off, role trust off, and Pending Review Quarantine off.

Tests reduce risk but cannot prove mistakes are impossible. When evidence is uncertain, the system records an unresolved event and does not punish.
