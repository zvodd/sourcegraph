# Ideas

- Dependency injection of an instance of internalClient into each Source implementation.
- Make githubConnection.listAllRepositores return errors instead of aborting.
- Abstract RepoSource interface implemented by each code host connection. Composable.
- Use Postgres as a queue and for all other state? We could then make repo-updater stateless.

  - https://brandur.org/job-drain
  - https://brandur.org/idempotency-keys
  - https://brandur.org/postgres-queues
  - https://github.com/bgentry/que-go
  - https://www.pgcon.org/2016/schedule/attachments/414_queues-pgcon-2016.pdf

- Decouple repo-updater from frontend API
