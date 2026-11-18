# Mainnet reads through Infura

## Problem

On GitHub Pages, mainnet reads through the RPC of the gateway's chain list fail. In the production gateway's chain list, the mainnet `rpcUri` is `https://rpc.safe.global/1/`, without authentication. The CORS pre-flight of that host is answered:

- from `https://laughing-carnival-w9n8mnm.pages.github.io`: 403
- from `https://app.safe.global`: 204
- from `http://localhost:3000`: 204

Readers of this value:

- the read-only provider: ENS names, RPC balance and nonce reads
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

- The mainnet `rpcUri` is replaced where the chain list enters the web store.
- Replacement:
  - authentication: `API_KEY_PATH`
  - value: `https://mainnet.infura.io/v3/`
- Condition: the build has `NEXT_PUBLIC_INFURA_TOKEN`.
- Set up: at each runtime entry, before its store is created.
- Unchanged:
  - other chains
  - the mobile app
  - precedence of the user's custom RPC
- Changed for users:
  - the RPC calls of Safe Apps on mainnet go to Infura with `NEXT_PUBLIC_SAFE_APPS_INFURA_TOKEN`, which is the build's Infura token when unset
  - the mainnet placeholder of Settings → Environment variables → RPC provider is `https://mainnet.infura.io/v3/`
  - RPC errors on mainnet are attributed to `infura`

## Mechanics

| Part                                           | Change                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/web/src/store/api/gateway/mainnetRpc.ts` | `replaceMainnetRpc()` wraps the `queryFn` of `getChainsConfigV2`            |
| wrapper                                        | `chainsAdapter.updateOne` sets `rpcUri` of chain `1` in a successful result |
| `apps/web/src/pages/_app.tsx`                  | `if (INFURA_TOKEN) replaceMainnetRpc()` before `makeStore()`                |
| `apps/web-tanstack/src/routes/__root.tsx`      | `if (INFURA_TOKEN) replaceMainnetRpc()` before `makeStore()`                |

```mermaid
flowchart LR
  CGW["gateway /v2/chains"] --> Q["getChainsConfigV2 queryFn"]
  Q --> W{"chain 1 present?"}
  W -- yes --> R["rpcUri := API_KEY_PATH<br/>https://mainnet.infura.io/v3/"]
  W -- no --> C
  R --> C["RTK Query cache"]
  C --> H["useChains / useChain"]
  C --> D["direct cache readers<br/>sanctions check, module guard"]
  H --> X{"custom RPC set?"}
  X -- yes --> CU["custom RPC URL"]
  X -- no --> P["provider builders"]
  D --> P
  P --> U["read-only provider, wallets<br/>value + INFURA_TOKEN"]
  P --> S["Safe Apps<br/>value + SAFE_APPS_INFURA_TOKEN"]
  U --> I["https://mainnet.infura.io/v3/&lt;token&gt;"]
  S --> I
```

## Acceptance

- `useChain('1').rpcUri` is `API_KEY_PATH` `https://mainnet.infura.io/v3/`.
- Chain `137` keeps the gateway's `rpcUri`.
- A sanctions check sends its `eth_call` to `https://mainnet.infura.io/v3/<token>`.
- A failed chain list is returned unchanged.
- The first test, at the commit before the fix, fails on the code of `main`.
