import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@/tests/test-utils'
import { server } from '@/tests/server'
import { GATEWAY_URL } from '@/config/gateway'
import { chainBuilder } from '@/tests/builders/chains'
import { useChain } from '@/hooks/useChains'

jest.mock('@safe-global/utils/config/constants', () => ({
  ...jest.requireActual('@safe-global/utils/config/constants'),
  INFURA_TOKEN: 'test-infura-token',
}))

const gatewayRpc = (chainId: string) => ({
  authentication: 'NO_AUTHENTICATION' as const,
  value: `https://rpc.safe.global/${chainId}/`,
})

describe('chain list read by the web app with an Infura token', () => {
  beforeEach(() => {
    server.use(
      http.get(`${GATEWAY_URL}/v2/chains`, () =>
        HttpResponse.json({
          results: ['1', '137'].map((chainId) =>
            chainBuilder()
              .with({ chainId, rpcUri: gatewayRpc(chainId) })
              .build(),
          ),
          next: null,
        }),
      ),
    )
  })

  it('should read mainnet through Infura', async () => {
    const { result } = renderHook(() => useChain('1'))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.rpcUri).toEqual({ authentication: 'API_KEY_PATH', value: 'https://mainnet.infura.io/v3/' })
  })

  it('should keep the gateway RPC of other chains', async () => {
    const { result } = renderHook(() => useChain('137'))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.rpcUri).toEqual(gatewayRpc('137'))
  })
})
