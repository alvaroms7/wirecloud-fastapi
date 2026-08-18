# Administration

WireCloud management commands use the same settings module as the web application. In a source checkout run `python -m manage ...`; in Docker prefix commands as shown below.

## Command reference

| Command | Purpose |
| --- | --- |
| `populate` | Create the internal `wirecloud` user and install bundled resources and initial workspaces. |
| `createsuperuser` | Create a local active staff/superuser account. |
| `rebuildsearchindexes` | Recreate Elasticsearch indexes from application data. |
| `runserver` | Start the Uvicorn development server. |
| `gentranslations` | Extract or update translation catalogues. |
| `compiletranslations` | Compile `.po` catalogues to `.mo` files. |
| `migrate` | Import a WireCloud 1 Django/SQL instance. |

Show the current command list or options for one command with:

```bash
python -m manage --help
python -m manage createsuperuser --help
```

Inside the supplied Compose stack, use:

```bash
docker compose -f docker/docker-compose.yml exec wirecloud \
  python -m manage --help
```

## Initial data

Run `populate` once on a new database and again after an upgrade that adds bundled resources:

```bash
python -m manage populate
```

Existing bundled component versions are skipped, so the command is safe to repeat. It is not a substitute for backing up your data.

## Administrator accounts

Create a superuser interactively:

```bash
python -m manage createsuperuser --username admin --email admin@example.com
```

The command prompts for a password and refuses to overwrite an existing username. Passing `--password` is supported for controlled automation, but may expose the password through shell history or process inspection.

Staff users can open the user-management interface to manage users, groups, organizations, and permissions. Superuser status bypasses ordinary permission checks; grant it sparingly.

## Search maintenance

Rebuild all indexes after a bulk import, MongoDB restore, or a search mapping change:

```bash
python -m manage rebuildsearchindexes
```

This requires both MongoDB and Elasticsearch to be reachable. Normal resource and workspace operations update their corresponding indexes incrementally.

## Backups

A recoverable backup contains:

- a consistent MongoDB backup;
- `WIRECLOUD_CATALOGUE_MEDIA_ROOT`;
- `WIRECLOUD_WIDGET_DEPLOYMENT_DIR`;
- the deployed settings, secret references, and exact application version; and
- any external marketplace or identity-provider configuration needed to reconnect the instance.

Elasticsearch is derived from MongoDB and can be rebuilt, so it does not need to be the authoritative backup. Test restores regularly. Restore MongoDB and file data from the same point in time, start the services, and rebuild search indexes.

For the Compose deployment, list the volumes declared by the resolved configuration with:

```bash
docker compose -f docker/docker-compose.yml config --volumes
```

Use your platform's volume snapshot or backup tooling; stopping WireCloud writes during the snapshot makes consistency easier.

## Logs and health checks

The application writes logs to standard output:

```bash
docker compose -f docker/docker-compose.yml logs -f wirecloud
```

There is no dedicated health endpoint in this version. A practical service check requests `/docs` or `/openapi.json`, while a fuller readiness check also verifies login, resource search, and access to a known workspace.

## Upgrades

1. Read the release notes and back up MongoDB and persistent files.
2. Build or pull the new application image.
3. Restart the application against compatible MongoDB and Elasticsearch versions.
4. Run `populate` to add newly bundled resources.
5. Run `rebuildsearchindexes` when the release changes search mappings or after any data import.
6. Repeat the checks from [Installation](installation.md#service-checks).

Keep the previous image reference and backup until the new version has passed functional checks. A container rollback alone is insufficient if a release changes persisted data.
