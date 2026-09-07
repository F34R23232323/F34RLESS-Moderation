# Commands

Implemented command surface: `/antinuke status`, `/antinuke health`, `/antinuke enable`, `/antinuke disable`, `/antinuke mode`, `/antinuke setup start`, `/antinuke setup validate`, `/antinuke setup finish`, `/antinuke apps status`, and Pending Review Quarantine enable/disable.

Sensitive commands are ephemeral, root-owner gated where required, validated through Zod, and version checked. The broader command contract in the design specification remains intentionally unclaimed until each operation has an implemented transaction, authorization policy, and recovery path.
