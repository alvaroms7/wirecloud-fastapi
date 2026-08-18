# HTTP API

WireCloud exposes a FastAPI-generated OpenAPI document and two interactive viewers on every running instance:

| Path | Content |
| --- | --- |
| `/openapi.json` | Machine-readable OpenAPI schema. |
| `/docs` | Swagger UI for exploring and calling operations. |
| `/redoc` | ReDoc reference view. |

The schema is the authoritative endpoint reference for the exact installed version. Operations are grouped into areas including authentication, local catalogue, workspaces, widget instances, wiring, preferences, administration, markets, themes, context, and proxying.

## Authentication

Browser sessions use an HTTP-only `token` cookie and a separate CSRF token. API clients can request a bearer token by posting JSON or form data to `/api/auth/login`:

```bash
curl --request POST \
  --header 'Content-Type: application/json' \
  --data '{"username":"admin","password":"example"}' \
  https://wirecloud.example.com/api/auth/login
```

A successful response has this shape:

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

Send the token in the standard header:

```bash
curl --header 'Authorization: Bearer eyJ...' \
  https://wirecloud.example.com/api/workspaces/
```

API login tokens are issued without the browser-session CSRF requirement. They expire after `SESSION_AGE` seconds and can be invalidated server-side. Do not put tokens in URLs unless an endpoint specifically requires it; URLs are commonly retained in logs and browser history.

## Browser-session CSRF

State-changing calls made with the login cookie must also provide the CSRF token in the `X-CSRF-Token` header (or, for compatibility, the `csrf_token` query parameter). The token is available to the browser as the `csrf_token` cookie. Bearer tokens returned by `/api/auth/login` do not require this second token.

## Content negotiation and errors

Many endpoints validate their accepted request and response media types. JSON is the normal API format, while selected legacy-compatible endpoints also return XML, HTML, XHTML, or plain text according to the `Accept` header.

JSON errors contain a description and may contain structured details. Common status codes are:

| Status | Meaning |
| --- | --- |
| `400` | Invalid value or malformed operation. |
| `401` | Authentication is missing or invalid. |
| `403` | The user lacks permission for the resource. |
| `404` | The resource does not exist. |
| `406` | The requested response media type is unavailable. |
| `409` | The operation conflicts with existing state. |
| `415` | The request media type is unsupported. |
| `422` | Request data failed validation. |

## Stable integrations

- Generate clients from `/openapi.json` for the version you deploy.
- Use endpoint names and documented fields rather than copying browser-internal requests.
- Expect resource identifiers to be strings representing MongoDB object IDs unless the schema says otherwise.
- Reauthenticate after rotating `JWT_KEY` or after a token expires.
- Give integration accounts only the permissions required for their operations.
- Pin WireCloud versions and compare OpenAPI documents during upgrades.
