# Deployment handoff

The project has two deployable surfaces:

1. The Vite frontend is a static SPA. `vercel.json` builds `dist` and rewrites route requests to
   `index.html`. Set `VITE_REGISTRY_API_BASE_URL` to the public API origin, including the scheme
   and without a trailing slash.
2. The registry API is the Node service in `Dockerfile`. `render.yaml` is a portable Render
   handoff; the same container can run on another platform that supports a Docker web service.

The API must expose `/health` and bind to `0.0.0.0` in production. Set `CORS_ORIGIN` to the exact
frontend origin, for example `https://registry.example`, rather than using a wildcard for a
write-capable service. The API uses these canonical Intuition endpoints by default:

- GraphQL: `https://mainnet.intuition.sh/v1/graphql`
- JSON-RPC: `https://rpc.intuition.systems`
- Chain: `1155`

No production URL is claimed by this repository. A deployment is only complete after the
operator records the actual frontend and API URLs, checks `/health`, verifies a read-only
`/api/registry` response, and confirms that browser-wallet CORS preflight succeeds.

## Release checks

```bash
pnpm check
pnpm test
pnpm check:reference-enforcers
pnpm check:composability-seed
pnpm build
```

The frontend does not receive a private key. Submission and curation writes prompt the connected
browser wallet on Intuition mainnet; the API remains a read and verification service.
