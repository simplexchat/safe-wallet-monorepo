import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@/tests/test-utils'
import { server } from '@/tests/server'
import { GATEWAY_URL } from '@/config/gateway'
import { chainBuilder } from '@/tests/builders/chains'
import { useChain } from '@/hooks/useChains'

jest.mock('@safe-global/utils/config/constants', () => ({
  ...jest.requireActual('@safe-global/utils/config/constants'),
  INFURA_TOKEN: '',
}))

const gatewayRpc = {
  authentication: 'NO_AUTHENTICATION' as const,
  value: 'https://rpc.safe.global/1/',
}

describe('chain list read by the web app without an Infura token', () => {
  it('should keep the gateway RPC of mainnet', async () => {
    server.use(
      http.get(`${GATEWAY_URL}/v2/chains`, () =>
        HttpResponse.json({ results: [chainBuilder().with({ chainId: '1', rpcUri: gatewayRpc }).build()], next: null }),
      ),
    )

    const { result } = renderHook(() => useChain('1'))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.rpcUri).toEqual(gatewayRpc)
  })
})
