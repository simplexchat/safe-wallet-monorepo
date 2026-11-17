import { cgwApi } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import type {
  TransactionData,
  TransactionDetails,
  TransactionPreview,
} from '@safe-global/store/gateway/AUTO_GENERATED/transactions'

const decodeTxData = async <Response extends { txData?: TransactionData | null }>(
  response: Response,
  chainId: string,
): Promise<Response> => {
  if (!response.txData) {
    return response
  }
  const { decodePinnedContracts } = await import('@/services/pinned-contracts')
  return { ...response, txData: decodePinnedContracts(chainId, response.txData) }
}

export const decodeWithPinnedContracts = () =>
  cgwApi.enhanceEndpoints({
    endpoints: {
      transactionsGetTransactionByIdV1: {
        transformResponse: (details: TransactionDetails, _meta, { chainId }) => decodeTxData(details, chainId),
      },
      transactionsPreviewTransactionV1: {
        transformResponse: (preview: TransactionPreview, _meta, { chainId }) => decodeTxData(preview, chainId),
      },
    },
  })
