# WireCloud

WireCloud is a web platform for building dashboards and application mashups from reusable components. Users place visual **widgets** in a workspace and connect them to widgets or non-visual **operators** through the wiring editor.

WireCloud keeps that mashup model and now uses a FastAPI backend. It stores
application data in MongoDB, uses Elasticsearch for search, and serves an
OpenAPI description of its HTTP API.

## Choose a path

- Follow [Getting started](getting-started.md) to run the complete stack with Docker Compose.
- Read the [User guide](user-guide.md) to create workspaces, install components, and wire them together.
- Use [Installation](installation.md) and [Configuration](configuration.md) when deploying an instance.
- Use [Migrating from WireCloud 1](migration.md) when moving data from a Django/SQL installation.
- Open [HTTP API](api.md) when integrating another application with WireCloud.
- Read [Component development](components.md) to build a `.wgt` package.
- Use [Creating themes](themes.md) to customize the interface, or the separate
  [plugin guide](plugins.md) when WireCloud itself needs new behavior.

## Main concepts

Workspace
: A dashboard owned by a user. A workspace can contain several tabs, widget instances, operator instances, preferences, and a wiring configuration.

Widget
: A browser-based visual component. Widgets are placed and resized on workspace tabs.

Operator
: A non-visual component used to obtain, transform, or send data.

Endpoint
: A named input or output declared by a widget or operator. Connections send values from an output endpoint to an input endpoint.

Local catalogue
: The **My Resources** area containing widgets, operators, and mashup templates available to the current user.

Marketplace
: A configured external source or destination for discoverable components.

## Documentation versions

These pages describe WireCloud's FastAPI and MongoDB architecture. The [legacy
WireCloud documentation](https://wirecloud.readthedocs.io/en/stable/) describes
the former Django and SQL architecture; use it only while operating an older
instance or interpreting legacy component concepts. Its deployment and
administration commands do not apply to the current WireCloud implementation.
