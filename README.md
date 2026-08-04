# WireCloud 2

WireCloud is a web platform for creating application mashups and dashboards from reusable widgets and operators. This version uses FastAPI, MongoDB, and Elasticsearch.

## Quick start

```bash
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml exec wirecloud python -m manage populate
docker compose -f docker/docker-compose.yml exec wirecloud python -m manage createsuperuser
```

Open <http://localhost:8000/>. Change `WIRECLOUD_JWT_KEY` and `WIRECLOUD_SECRET_KEY` in `docker/.env` before exposing the instance.

## Documentation

The documentation source is in [`docs/`](docs/index.md) and is ready for Read the Docs through `.readthedocs.yaml` and `mkdocs.yml`.

Build it locally with:

```bash
python -m pip install -r docs/requirements.txt
mkdocs build --strict
```

See the [getting-started guide](docs/getting-started.md), [installation guide](docs/installation.md), and [contributor guide](docs/development.md) for full instructions.
