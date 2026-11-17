import { act, fakerChecksummedAddress, render, screen } from '@/tests/test-utils'
import type { MultiSend, TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import { TimelockOperation } from '.'

const calls: MultiSend[] = [
  {
    operation: Operation.CALL,
    to: fakerChecksummedAddress(),
    value: '0',
    data: '0x',
    dataDecoded: {
      method: 'addReservedNames',
      parameters: [{ name: 'names', type: 'string[]', value: ['coinbase'] }],
    },
  },
  {
    operation: Operation.CALL,
    to: fakerChecksummedAddress(),
    value: '0',
    data: '0x',
    dataDecoded: { method: 'setPublicSalesOpen', parameters: [{ name: 'open', type: 'bool', value: 'false' }] },
  },
]

const data: TransactionData = {
  to: { value: fakerChecksummedAddress() },
  value: '0',
  operation: Operation.CALL,
  hexData: '0x',
  dataDecoded: {
    method: 'scheduleBatch',
    parameters: [{ name: 'delay', type: 'uint256', value: '604800' }],
  },
}

const renderTimelockOperation = async (isConfirmationView: boolean) => {
  render(<TimelockOperation data={data} calls={calls} isConfirmationView={isConfirmationView} />)
  await act(async () => {})
}

describe('TimelockOperation', () => {
  it('lists each call of the operation expanded with its decoded parameters', async () => {
    await renderTimelockOperation(true)

    expect(screen.getByText('Nested transaction')).toBeInTheDocument()
    expect(screen.getAllByText('addReservedNames').length).toBeGreaterThan(0)
    expect(screen.getByText('coinbase')).toBeInTheDocument()
    expect(screen.getAllByText('setPublicSalesOpen').length).toBeGreaterThan(0)
    expect(screen.getByText('false')).toBeInTheDocument()
  })

  it('shows the timelock call above its calls outside the confirmation view', async () => {
    await renderTimelockOperation(false)

    expect(screen.getAllByText('scheduleBatch').length).toBeGreaterThan(0)
    expect(screen.getByText('604800')).toBeInTheDocument()
  })

  it('leaves the timelock call to the summary in the confirmation view', async () => {
    await renderTimelockOperation(true)

    expect(screen.queryByText('scheduleBatch')).not.toBeInTheDocument()
  })
})
