# PostgreSQL migrations

Add versioned PostgreSQL SQL files using `{version}_{name}.up.sql`.

Every migration declares `engine`, `transactional`, `reversible`, and `rollback` metadata. Add `{version}_{name}.down.sql` only for a tested, bounded, data-preserving `down-migration`; otherwise use `forward-fix` or `restore-cutover`.
