import { http, HttpResponse } from 'msw'
import { createMockChain } from '@safe-global/test'
import { renderHook, waitFor } from '@/tests/test-utils'
import { server } from '@/tests/server'
import { GATEWAY_URL } from '@/config/gateway'
import { useChain } from '@/hooks/useChains'

jest.mock('@safe-global/utils/config/constants', () => ({
  ...jest.requireActual('@safe-global/utils/config/constants'),
  INFURA_TOKEN: 'test-infura-token',
}))

const SAFE_RPC = 'https://rpc.safe.global'

describe('chain list read by the web app with an Infura token', () => {
  beforeEach(() => {
    server.use(
      http.get(`${GATEWAY_URL}/v2/chains`, () =>
        HttpResponse.json({
          results: [
            createMockChain({ chainId: '1', rpcUri: `${SAFE_RPC}/1/` }),
            createMockChain({ chainId: '137', rpcUri: `${SAFE_RPC}/137/` }),
          ],
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
    expect(result.current?.rpcUri).toEqual({ authentication: 'NO_AUTHENTICATION', value: `${SAFE_RPC}/137/` })
  })
})
