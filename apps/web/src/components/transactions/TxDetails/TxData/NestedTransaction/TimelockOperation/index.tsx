import type { MultiSend, TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import SingleTxDecoded from '@/components/transactions/TxDetails/TxData/DecodedData/SingleTxDecoded'
import { NestedTransaction } from '../NestedTransaction'

export const TimelockOperation = ({
  data,
  calls,
  isConfirmationView = false,
}: {
  data: TransactionData
  calls: MultiSend[]
  isConfirmationView?: boolean
}) => (
  <NestedTransaction txData={data} isConfirmationView={isConfirmationView}>
    <div className="flex flex-col divide-y divide-border">
      {calls.map((call, index) => (
        <SingleTxDecoded
          key={`${call.data ?? call.to}-${index}`}
          tx={call}
          txData={data}
          actionTitle={`${index + 1}`}
          variant="elevation"
          radius="none"
          expanded
        />
      ))}
    </div>
  </NestedTransaction>
)
