# Mainnet reads through Infura

## Problem

On GitHub Pages, mainnet reads through the RPC of the production gateway's chain list fail: the CORS pre-flight of that RPC, `https://rpc.safe.global/1/`, is answered for the Pages origin with 403 and without `Access-Control-Allow-Origin`.

Readers of the mainnet `rpcUri`:

- the read-only provider: ENS names
- the read-only provider: RPC balance reads
- the read-only provider: nonce reads
- the ENS hub provider
- the sanctions check
- the module guard
- Safe creation
- policies
- the Safe scope provider
- the mainnet chain of hardware wallets and the private-key wallet
- the RPC calls of Safe Apps
- the RPC settings placeholder
- RPC error attribution

## Decisions

- The mainnet `rpcUri` is replaced in the result of the `getChainsConfigV2` query function.
- Replacement:
  - authentication: `API_KEY_PATH`
  - value: `https://mainnet.infura.io/v3/`
- Condition:
  - `IS_PRODUCTION` is true
  - `INFURA_TOKEN` is non-empty
- Set up: once, in `apps/web/src/pages/_app.tsx`, before its store is created; the TanStack runtime evaluates the same module through `apps/web-tanstack/src/routes/__root.tsx`.
- Unchanged:
  - other chains
  - the mobile app
  - builds with `IS_PRODUCTION` false, including the isolated end-to-end stack
  - precedence of the user's custom RPC
- Changed for users:
  - the RPC calls of Safe Apps on mainnet are sent to Infura with `SAFE_APPS_INFURA_TOKEN`, which is `INFURA_TOKEN` when unset
  - the mainnet placeholder of Settings → Environment variables → RPC provider is `https://mainnet.infura.io/v3/`
  - RPC errors of the mainnet read-only provider are attributed to `infura`

## Mechanics

| Part                                           | Change                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/src/store/api/gateway/mainnetRpc.ts` | `replaceMainnetRpc()` wraps the `queryFn` of `getChainsConfigV2`              |
| wrapper                                        | `chainsAdapter.updateOne` sets `rpcUri` of chain `1` in a successful result   |
| `apps/web/src/pages/_app.tsx`                  | `if (IS_PRODUCTION && INFURA_TOKEN) replaceMainnetRpc()` before `makeStore()` |

```mermaid
flowchart LR
  CGW["gateway /v2/chains"] --> Q["getChainsConfigV2 queryFn"]
  Q --> E{"successful result?"}
  E -- no --> C
  E -- yes --> W{"chain 1 present?"}
  W -- yes --> R["rpcUri := API_KEY_PATH<br/>https://mainnet.infura.io/v3/"]
  W -- no --> C
  R --> C["RTK Query cache"]
  C --> H["useChains / useChain"]
  C --> D["direct cache readers<br/>sanctions check, module guard"]
  H --> P["provider builders"]
  D --> P
  P -- "custom RPC, where the builder accepts one" --> CU["custom RPC URL"]
  P -- otherwise --> K{"provider"}
  K -- "read-only, wallets" --> U["value + INFURA_TOKEN"]
  K -- "Safe Apps" --> S["value + SAFE_APPS_INFURA_TOKEN"]
  U --> I["https://mainnet.infura.io/v3/&lt;token&gt;"]
  S --> I
```

## Acceptance

- The `rpcUri` of chain `1` is `API_KEY_PATH` `https://mainnet.infura.io/v3/`.
- The `rpcUri` of chain `137` is unchanged.
- The `eth_call` of the sanctions check is sent to `https://mainnet.infura.io/v3/<token>`.
- A failed chain list is returned unchanged.
- At `26dc12bf`, the test of chain `1`'s `rpcUri` fails on the code of `main`: https://github.com/simplexchat/safe-wallet-monorepo/actions/runs/44273529603
- Untested:
  - the line in `_app.tsx`: a test would load the entry module with its styles and observability setup
  - the `throw` in `mainnetRpc.ts`: `getChainsConfigV2` is defined with a `queryFn`
  - TanStack coverage: it depends on `__root.tsx` importing `@/pages/_app`
