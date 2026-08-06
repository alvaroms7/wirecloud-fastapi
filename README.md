<p align="center">
  <a href="https://wirecloud.readthedocs.io/">
    <img src="src/wirecloud/themes/defaulttheme/static/images/logos/wc1.png" width="240" alt="WireCloud">
  </a>
</p>

<h1 align="center">WireCloud</h1>

<p align="center">
  Build interactive dashboards and application mashups from reusable widgets,
  operators, and data sources.
</p>

<p align="center">
  <a href="https://github.com/ficodes/wirecloud/actions/workflows/ci.yml"><img alt="Tests and coverage" src="https://github.com/ficodes/wirecloud/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/ficodes/wirecloud/actions/workflows/package.yml"><img alt="Python package" src="https://github.com/ficodes/wirecloud/actions/workflows/package.yml/badge.svg"></a>
  <a href="https://wirecloud.readthedocs.io/"><img alt="Documentation" src="https://readthedocs.org/projects/wirecloud/badge/?version=latest"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg"></a>
</p>

<p align="center">
  <a href="docs/getting-started.md">Get started</a> ·
  <a href="docs/user-guide.md">User guide</a> ·
  <a href="docs/installation.md">Installation</a> ·
  <a href="docs/api.md">HTTP API</a> ·
  <a href="docs/development.md">Contributing</a>
</p>

WireCloud is an open-source, web-based platform for creating custom dashboards
without building every interface from scratch. Place visual **widgets** in a
workspace, connect them to data-processing **operators** in the wiring editor,
and turn heterogeneous services and data sources into a coherent application.

The application combines a FastAPI backend with a TypeScript/JavaScript
frontend, stores application data in MongoDB, and uses Elasticsearch for
search. WireCloud is part of the [FIWARE](https://www.fiware.org/) ecosystem.

## Quick start

The fastest way to run the complete stack is Docker Compose. It builds
WireCloud and starts MongoDB and Elasticsearch with persistent volumes:

```bash
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml exec wirecloud python -m manage populate
docker compose -f docker/docker-compose.yml exec wirecloud python -m manage createsuperuser
```

Open <http://localhost:8000/>. Before exposing the service, replace
`WIRECLOUD_JWT_KEY` and `WIRECLOUD_SECRET_KEY` in `docker/.env` with different,
secure random values.

For health checks, updates, persistent-storage guidance, and troubleshooting,
follow the complete [getting-started guide](docs/getting-started.md).

## Explore the documentation

| I want to… | Start here |
| --- | --- |
| Create workspaces and connect components | [User guide](docs/user-guide.md) |
| Deploy and configure an instance | [Installation](docs/installation.md) and [configuration](docs/configuration.md) |
| Operate, back up, and restore WireCloud | [Administration](docs/administration.md) |
| Build widgets, operators, or mashups | [Component development](docs/components.md) |
| Integrate with WireCloud over HTTP | [HTTP API](docs/api.md) |
| Customize the interface or backend | [Themes](docs/themes.md) and [plugins](docs/plugins.md) |
| Migrate an existing deployment | [Migration guide](docs/migration.md) |

Release wheels and the forthcoming PyPI package include the compiled frontend,
so Node.js is not required on the deployment host. See the
[installation guide](docs/installation.md) for all supported installation
paths and an example project-specific configuration.

## Development

WireCloud requires Python 3.9 or newer and Node.js with npm. To prepare a local
checkout:

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[test,migration]'
npm ci
npm run build
```

Run the Python and JavaScript test suites with coverage:

```bash
pytest --cov
npm run test:js:cov
```

The [contributor guide](docs/development.md) covers local services, frontend
commands, translations, packaging, continuous integration, and documentation
builds.

## Documentation

The documentation is built with MkDocs and published on
[Read the Docs](https://wirecloud.readthedocs.io/). Build it locally in strict
mode to catch broken links and configuration errors:

```bash
python -m pip install -r docs/requirements.txt
mkdocs build --strict
```

## License

WireCloud is distributed under the [GNU Affero General Public License,
version 3](LICENSE). Widgets, operators, and mashups running on the platform are
expressly excluded from the covered work and may use other licenses; see the
license file for the complete terms.
