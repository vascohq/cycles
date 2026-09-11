# ADR 0028: The MCP server accepts a Clerk API key beside an OAuth token

## Status

Accepted — extends the auth line in
[ADR 0003](0003-mcp-server-with-slug-paths-and-batch.md), which chose Clerk
OAuth with Dynamic Client Registration.

## Context

A person connects a client to the MCP server through Clerk OAuth. The browser
login gives the client a token that belongs to that person, and the server
reads the person's org memberships from it.

An agent on a server has no person and no browser. Stewart, the squad agent in
`vascohq/lisbon`, runs on Cloud Run and reads Cycles boards through this MCP.
It needs a credential that a service holds in a secret and sends as
`Authorization: Bearer <token>`.

Clerk issues API keys. A key belongs to a user, and `auth()` from
`@clerk/nextjs` verifies one when `acceptsToken` includes `api_key`. The
verified object carries the user id, so the same membership lookup works.
`verifyClerkToken` from `@clerk/mcp-tools` serves OAuth tokens only.

## Decision

**`verifyMcpToken` accepts `oauth_token` and `api_key`.**

- An OAuth token keeps its current path through `verifyClerkToken`.
- An API key skips `verifyClerkToken`. The server builds the same auth shape
  from the verified Clerk object: the token, the key id as `clientId`, empty
  `scopes`, and the user id. Nothing in this server reads `clientId` or
  `scopes`, so the stand-in values change no behavior.
- Both paths refuse a token with no user id or no org membership, and both hand
  the memberships to `resolveOrg`. A service user gets access to an org by
  being a member of it, the same way a person does.
- The route, the middleware, the metadata endpoints and `resolveOrg` do not
  change.

## Considered options

- **A shared secret in an env var.** Rejected. It names no user, so every write
  from the agent would carry no author, and one leaked value opens every org.
- **A Clerk machine-to-machine token.** Rejected. It belongs to a machine, not
  a user, so it has no org memberships and the org model would need a second
  path.
- **A long-lived OAuth token minted for the agent.** Rejected. OAuth tokens
  expire and there is no person to complete the refresh.

## Consequences

- A service account is a Clerk user with an API key. Its org memberships decide
  what it can read and write, and an admin removes access by removing the
  membership or revoking the key.
- Writes from the agent carry the service user's id, so the audit trail names
  it.
- API keys must be enabled in the Clerk dashboard for the key path to verify.
