# Contributing

WireCloud contains a Python/FastAPI backend and a TypeScript/JavaScript/Sass frontend bundled with Webpack.

## Development environment

Requirements:

- Python 3.9 or newer;
- Node.js and npm;
- MongoDB; and
- Elasticsearch.

Set up the repository:

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[test,migration]'
npm ci
npm run build
```

The default source settings live in `src/settings.py`. For a custom local environment, put another `settings.py` earlier on `PYTHONPATH` rather than committing credentials to the repository.

Initialize the development data and start the service:

```bash
PYTHONPATH=src python -m manage populate
PYTHONPATH=src python -m manage createsuperuser
PYTHONPATH=src python -m manage runserver --reload
```

## Frontend commands

The commands in `package.json` are:

| Command | Purpose |
| --- | --- |
| `npm run build` | Generate settings and build all frontend assets. |
| `npm run build:js` | Generate settings and build JavaScript assets. |
| `npm run build:css` | Generate settings and build Sass/CSS assets. |
| `npm run test:js` | Run JavaScript tests. |
| `npm run test:js:cov` | Run JavaScript tests with coverage. |

The prebuild step chooses Python from `PYTHON`, `./venv/bin/python`, the Windows virtual environment path, or a system Python, in that order. Set `PYTHON` explicitly if the selected interpreter does not have access to the intended settings.

## Python tests

Run the full Python suite:

```bash
pytest
```

Generate terminal and HTML coverage reports when needed:

```bash
pytest --cov
pytest --cov --cov-report=html
```

## Continuous integration

GitHub Actions runs the Python and JavaScript test suites with coverage on every
push and pull request. Pull requests from branches in this repository receive a
single coverage comment that is updated on each run. GitHub gives workflows from
fork and Dependabot pull requests a read-only token, so those runs publish the
same results in the workflow summary and as downloadable artifacts without
attempting to post a comment.

A separate package workflow builds and verifies the Python wheel on every push,
pull request, and published GitHub release. The wheel is retained as a workflow
artifact for normal CI runs and is also attached to published releases.

## Documentation

Install the pinned documentation tool and build in strict mode:

```bash
python -m pip install -r docs/requirements.txt
mkdocs build --strict
```

Preview changes locally:

```bash
mkdocs serve
```

The navigation is declared in `mkdocs.yml`. Add each new page there; strict builds reject broken internal links and configuration warnings. Read the Docs uses `.readthedocs.yaml` and installs only `docs/requirements.txt`, so documentation builds remain independent of the application and its external services.

## Translations

Extract messages for all configured languages or one language:

```bash
PYTHONPATH=src python -m manage gentranslations
PYTHONPATH=src python -m manage gentranslations --language es
```

Compile translations before testing them:

```bash
PYTHONPATH=src python -m manage compiletranslations
PYTHONPATH=src python -m manage compiletranslations --language es --verbose
```

Review generated catalogue changes carefully. Do not overwrite translators' work when updating source locations.
