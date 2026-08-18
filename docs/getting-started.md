# Getting started

Docker Compose is the shortest path to a complete WireCloud installation. It starts WireCloud, MongoDB, and Elasticsearch with persistent volumes.

## Requirements

- Docker Engine with the Compose plugin
- Git, if you are cloning the repository
- At least 1 GiB of memory available to Elasticsearch in addition to the application and database

## Start the stack

From the repository root:

```bash
cp docker/.env.example docker/.env
```

Open `docker/.env` and replace both placeholder keys before exposing the service outside your machine:

```text
WIRECLOUD_JWT_KEY=replace-with-a-long-random-value
WIRECLOUD_SECRET_KEY=replace-with-a-different-long-random-value
```

Generate suitable values with `python -c 'import secrets; print(secrets.token_urlsafe(48))'`. Run it twice; the two keys must be different.

Build and start the services:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Check that all three containers are running:

```bash
docker compose -f docker/docker-compose.yml ps
```

## Initialize WireCloud

Install the built-in landing page, home workspace, and bundled components:

```bash
docker compose -f docker/docker-compose.yml exec wirecloud \
  python -m manage populate
```

Create an administrator. Omitting the password option keeps the password out of shell history:

```bash
docker compose -f docker/docker-compose.yml exec wirecloud \
  python -m manage createsuperuser --username admin --email admin@example.com
```

Open <http://localhost:8000/> and sign in with the account you created. API documentation is available at <http://localhost:8000/docs>.

!!! note
    `WIRECLOUD_ALLOW_ANONYMOUS_ACCESS=true` lets visitors open public workspaces. An account and suitable permissions are still required to create or edit resources.

## Stop or update the stack

Stop the containers without deleting their data:

```bash
docker compose -f docker/docker-compose.yml down
```

After updating the source, rebuild and restart WireCloud:

```bash
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml exec wirecloud \
  python -m manage rebuildsearchindexes
```

Docker volumes named `wirecloud_data`, `mongo_data`, and `es_data` hold application files, MongoDB data, and Elasticsearch data. Back them up before an upgrade. Do not add `--volumes` to `docker compose down` unless you intend to delete the installation data.

## Troubleshooting the first run

View the application logs:

```bash
docker compose -f docker/docker-compose.yml logs -f wirecloud
```

If the root page reports that the landing or home workspace is missing, run `populate` again. The operation skips built-in resources that already exist.

If search returns errors after importing or restoring data, verify that Elasticsearch is healthy and run `rebuildsearchindexes`.
