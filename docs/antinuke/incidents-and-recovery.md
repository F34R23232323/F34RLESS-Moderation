# Incidents And Recovery

Incidents retain normalized events, immutable JSON evidence, audit IDs, correlation IDs, configuration versions, threshold/risk decisions, enforcement attempts, snapshots, and failures. Enforcement keys prevent the same incident/action/target from running twice.

Recovery must always produce a dry-run plan first. Categories precede child channels and roles precede overwrites. Administrator and dangerous permissions require a separate root-owner confirmation and are never restored automatically.
