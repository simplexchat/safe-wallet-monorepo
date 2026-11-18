import type { RpcUri } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { apiSliceWithChainsConfig, chainsAdapter } from '@safe-global/store/gateway/chains'
import chains from '@safe-global/utils/config/chains'

const INFURA_MAINNET_RPC: RpcUri = { authentication: 'API_KEY_PATH', value: 'https://mainnet.infura.io/v3/' }

export const replaceMainnetRpc = () =>
  apiSliceWithChainsConfig.enhanceEndpoints({
    endpoints: {
      getChainsConfigV2: (definition) => {
        const { queryFn } = definition
        if (!queryFn) throw new Error('getChainsConfigV2 is defined without a queryFn')
        definition.queryFn = async (...args) => {
          const result = await queryFn(...args)
          if (!result.data) return result
          return {
            ...result,
            data: chainsAdapter.updateOne(result.data, { id: chains.eth, changes: { rpcUri: INFURA_MAINNET_RPC } }),
          }
        }
      },
    },
  })
