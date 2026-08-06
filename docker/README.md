# Docker deployment

This directory contains a complete Docker setup for WireCloud:

- `Dockerfile`: multi-stage image build (frontend assets + python wheel)
- `settings.py`: environment-driven runtime settings
- `entrypoint.sh`: initializes writable directories and starts the app
- `docker-compose.yml`: Wirecloud + MongoDB + Elasticsearch stack
- `.env.example`: environment variable template

## Quick start

1. Create the environment file:

```bash
cp docker/.env.example docker/.env
```

2. Replace `WIRECLOUD_JWT_KEY` and `WIRECLOUD_SECRET_KEY` in `docker/.env`
   with different random values.

3. Start the stack from the repository root:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

4. Install the bundled resources and create an administrator:

```bash
docker compose -f docker/docker-compose.yml exec wirecloud python -m manage populate
docker compose -f docker/docker-compose.yml exec wirecloud python -m manage createsuperuser
```

5. Open <http://localhost:8000/>.

## Notes

- `settings.py` is loaded through `PYTHONPATH=/app/docker` in the image.
- Persistent application, MongoDB, and Elasticsearch data are stored in named
  volumes. Do not run `docker compose down --volumes` unless you intend to
  delete them.
- The complete procedure, configuration reference, backup notes, and production
  checklist are in the [installation documentation](../docs/installation.md).
