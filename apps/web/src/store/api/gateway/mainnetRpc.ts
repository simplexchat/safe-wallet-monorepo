import type { EntityState } from '@reduxjs/toolkit'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { apiSliceWithChainsConfig, chainsAdapter } from '@safe-global/store/gateway/chains'
import chains from '@safe-global/utils/config/chains'

const setMainnetRpc = (configs: EntityState<Chain, string>): EntityState<Chain, string> =>
  chainsAdapter.updateOne(configs, {
    id: chains.eth,
    changes: { rpcUri: { authentication: 'API_KEY_PATH', value: 'https://mainnet.infura.io/v3/' } },
  })

export const replaceMainnetRpc = () =>
  apiSliceWithChainsConfig.enhanceEndpoints({
    endpoints: {
      getChainsConfigV2: (definition) => {
        const { queryFn } = definition
        if (!queryFn) throw new Error('getChainsConfigV2 is defined without a queryFn')
        definition.queryFn = async (...args) => {
          const result = await queryFn(...args)
          return result.data ? { ...result, data: setMainnetRpc(result.data) } : result
        }
      },
    },
  })
