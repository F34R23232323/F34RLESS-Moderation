# Discord API Limitations

Kicks are inferred only after a matching MemberKick audit entry; an ordinary leave is not a kick. Prunes are aggregate and monitor-only. Integration executors are sometimes absent. Webhook messages identify a webhook, not necessarily a human. Voice disconnect attribution and application-command responsibility are not consistently exposed. Reorder events are often represented as update audit entries. Soundboard and some community/vanity changes vary by gateway and audit-log support.

Only protections present in the declarative registry are claimed. Unsupported or partially observable behavior stays alert-only.
