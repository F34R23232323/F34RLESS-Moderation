# Setup

1. Set `REDIS_URL`, start MySQL, and run migrations through normal bot startup.
2. Grant the bot View Audit Log, Manage Roles, Moderate Members, and View/Send Messages in private security channels.
3. Place the bot role above the quarantine role and all roles it may remove.
4. Run `/antinuke setup start`, inspect the preview, `/antinuke setup validate`, then `/antinuke setup finish confirm:true`.
5. Configure a permissionless quarantine role and private log/review channels before leaving dry-run.
6. Run simulations and review health before `/antinuke enable confirm:true`.

Setup never enables automatic kick, automatic ban, or Pending Review Quarantine.
