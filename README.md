# Google Cloud Admin MCP

This MCP starts in **public setup mode**. It deliberately exposes only two non-administrative tools:

- `get_setup_status`
- `get_oauth_setup_instructions`

It cannot read, create, change, or delete Google Cloud resources until OAuth is configured and validated.

## Why setup mode is public

An unauthenticated service that can alter Google Cloud projects, IAM permissions, OAuth clients, APIs, or service accounts would be unsafe. The public phase is limited to deployment verification and setup guidance.

## OAuth configuration to enable next

1. Create a Google OAuth Web application client in the chosen Google Cloud project.
2. Add `${PUBLIC_BASE_URL}/oauth/google/callback` as its authorized redirect URI after `PUBLIC_BASE_URL` is set.
3. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_ALLOWED_EMAIL` in Render.
4. Deploy the OAuth release. Only then will Google Cloud administration tools be enabled.

## Planned authenticated capabilities

- Inspect project metadata and enabled APIs
- Enable explicitly requested Google APIs
- Inspect service accounts and IAM bindings
- Create scoped service accounts after explicit confirmation
- Inspect OAuth client configuration where the Google API supports it

No destructive delete or billing operations are planned by default.
