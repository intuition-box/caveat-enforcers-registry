# Deployment handoff

The project has two deployable surfaces:

1. The Vite frontend is a static SPA. `vercel.json` builds `dist` and rewrites route requests to
   `index.html`. Set `VITE_REGISTRY_API_BASE_URL` to the public API origin, including the scheme
   and without a trailing slash. Set `VITE_WALLETCONNECT_PROJECT_ID` to a WalletConnect Cloud
   project ID to enable RainbowKit QR/mobile connections. When it is omitted, RainbowKit still
   connects installed EIP-6963 browser wallets through Wagmi.
2. The registry API is the Node service in `Dockerfile`. `render.yaml` is a portable Render
   handoff; the same container can run on another platform that supports a Docker web service.

The API must expose `/health` and bind to `0.0.0.0` in production. Set `CORS_ORIGIN` to the exact
frontend origin, for example `https://registry.example`. Preview deployments can use a scoped
subdomain pattern such as `https://*.registry.example`; broad `*` access is not appropriate for a
write-capable service. The API uses these canonical Intuition endpoints by default:

- GraphQL: `https://mainnet.intuition.sh/v1/graphql`
- JSON-RPC: `https://rpc.intuition.systems/http`
- Chain: `1155`

Current public deployment:

- Frontend: `https://caveats-registry.intuition.box`
- Read API: `https://caveats-registry-api.intuition.box`

The release is verified when `/health` reports chain `1155` with no ontology issues,
`/api/registry` returns the seeded membership records, and browser-wallet CORS preflight from
the frontend origin succeeds. The frontend never receives a private key.

Run the public production smoke check without a wallet:

```bash
pnpm check:production
```

After the reviewed enrichment, composability, and curation writes are indexed and the API is
redeployed, run the strict acceptance check:

```bash
pnpm check:production:final
```

The strict mode additionally requires the reference record's domain, operation, terms, audit,
and usage evidence; every planned relationship/context/ordering/evidence triple; and the funded
counter-vault proof. It reads the public frontend, API, and Intuition GraphQL endpoint directly.

## Release checks

```bash
pnpm check
pnpm test
pnpm check:reference-enforcers
pnpm check:composability-seed
pnpm build
```

The frontend does not receive a private key. Wagmi and RainbowKit own wallet discovery,
connection, account state, and Intuition network selection. Submission and curation writes then
pass the connected EIP-1193 provider into the registry's existing simulation and signing adapter;
the API remains a read and verification service.
