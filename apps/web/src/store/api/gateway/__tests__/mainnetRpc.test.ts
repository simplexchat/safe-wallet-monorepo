import { AbiCoder } from 'ethers'
import { http, HttpResponse } from 'msw'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { useGetChainsConfigV2Query } from '@safe-global/store/gateway'
import { fakerChecksummedAddress, renderHook, waitFor } from '@/tests/test-utils'
import { server } from '@/tests/server'
import { chainBuilder } from '@/tests/builders/chains'
import { GATEWAY_URL } from '@/config/gateway'
import { CONFIG_SERVICE_KEY } from '@/config/constants'
import { useChain } from '@/hooks/useChains'
import { useGetIsSanctionedQuery } from '@/store/api/ofac'
import { replaceMainnetRpc } from '../mainnetRpc'

jest.mock('@safe-global/utils/config/constants', () => ({
  ...jest.requireActual('@safe-global/utils/config/constants'),
  INFURA_TOKEN: 'test-infura-token',
}))

type RpcRequest = { id: number; method: string }

const gatewayRpc = (chainId: string) => ({
  authentication: 'NO_AUTHENTICATION' as const,
  value: `https://rpc.safe.global/${chainId}/`,
})

const serveChains = (chains: Chain[]) => {
  server.use(http.get(`${GATEWAY_URL}/v2/chains`, () => HttpResponse.json({ results: chains, next: null })))
}

const serveInfuraMainnet = (): string[] => {
  const methods: string[] = []
  const answer = ({ id, method }: RpcRequest) => {
    methods.push(method)
    return { jsonrpc: '2.0', id, result: AbiCoder.defaultAbiCoder().encode(['bool'], [false]) }
  }
  server.use(
    http.post('https://mainnet.infura.io/v3/test-infura-token', async ({ request }) => {
      const body = (await request.json()) as RpcRequest | RpcRequest[]
      return HttpResponse.json(Array.isArray(body) ? body.map(answer) : answer(body))
    }),
  )
  return methods
}

describe('replaceMainnetRpc', () => {
  beforeAll(() => {
    replaceMainnetRpc()
  })

  beforeEach(() => {
    serveChains(
      ['1', '137'].map((chainId) =>
        chainBuilder()
          .with({ chainId, rpcUri: gatewayRpc(chainId) })
          .build(),
      ),
    )
  })

  it('should set the Infura RPC of mainnet in the chain list', async () => {
    const { result } = renderHook(() => useChain('1'))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.rpcUri).toEqual({ authentication: 'API_KEY_PATH', value: 'https://mainnet.infura.io/v3/' })
  })

  it('should keep the gateway RPC of other chains', async () => {
    const { result } = renderHook(() => useChain('137'))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.rpcUri).toEqual(gatewayRpc('137'))
  })

  it('should send a mainnet read of a direct cache reader to Infura with the token', async () => {
    const methods = serveInfuraMainnet()

    const { result } = renderHook(() => useGetIsSanctionedQuery(fakerChecksummedAddress()))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
    expect(methods).toContain('eth_call')
  })

  it('should return a failed chain list unchanged', async () => {
    serveChains([])

    const { result } = renderHook(() => useGetChainsConfigV2Query(CONFIG_SERVICE_KEY))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual({ status: 'CUSTOM_ERROR', error: 'Empty chains result' })
  })
})
