import { http, HttpResponse } from 'msw'
import { Interface } from 'ethers'
import { act, renderHook, waitFor, fakerChecksummedAddress } from '@/tests/test-utils'
import { server } from '@/tests/server'
import { GATEWAY_URL } from '@/config/gateway'
import { Operation, TransactionInfoType } from '@safe-global/store/gateway/types'
import {
  useTransactionsGetTransactionByIdV1Query,
  useTransactionsPreviewTransactionV1Mutation,
  type TransactionData,
  type TransactionDetails,
  type TransactionPreview,
} from '@safe-global/store/gateway/AUTO_GENERATED/transactions'

const NAME_POLICY = '0x5147b65F547b766DBaf520127e8f59834475021E'

const addReservedNames = new Interface(['function addReservedNames(string[] names, uint8 reason)']).encodeFunctionData(
  'addReservedNames',
  [['coinbase'], 2],
)

const txData: TransactionData = {
  to: { value: NAME_POLICY },
  value: '0',
  operation: Operation.CALL,
  hexData: addReservedNames,
  dataDecoded: null,
}

const txInfo: TransactionPreview['txInfo'] = {
  type: TransactionInfoType.CUSTOM,
  to: { value: NAME_POLICY },
  dataSize: '132',
  value: '0',
  isCancellation: false,
  methodName: null,
}

describe('decodeWithPinnedContracts', () => {
  it('decodes the preview of a call to a pinned contract', async () => {
    server.use(
      http.post(`${GATEWAY_URL}/v1/chains/:chainId/transactions/:safeAddress/preview`, () =>
        HttpResponse.json({ txInfo, txData }),
      ),
    )
    const { result } = renderHook(() => useTransactionsPreviewTransactionV1Mutation())

    await act(async () => {
      await result.current[0]({
        chainId: '1',
        safeAddress: fakerChecksummedAddress(),
        previewTransactionDto: { to: NAME_POLICY, data: addReservedNames, value: '0', operation: Operation.CALL },
      })
    })

    await waitFor(() => expect(result.current[1].data?.txData.dataDecoded?.method).toBe('addReservedNames'))
  })

  it('decodes the details of a queued call to a pinned contract', async () => {
    const details: TransactionDetails = {
      txInfo,
      txData,
      safeAddress: fakerChecksummedAddress(),
      txId: 'multisig_0x0_0x0',
      txStatus: 'AWAITING_CONFIRMATIONS',
    }
    server.use(http.get(`${GATEWAY_URL}/v1/chains/:chainId/transactions/:id`, () => HttpResponse.json(details)))

    const { result } = renderHook(() => useTransactionsGetTransactionByIdV1Query({ chainId: '1', id: details.txId }))

    await waitFor(() => expect(result.current.data?.txData?.dataDecoded?.parameters?.[0].value).toEqual(['coinbase']))
  })
})
