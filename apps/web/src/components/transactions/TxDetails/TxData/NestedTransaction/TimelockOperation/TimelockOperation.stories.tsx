import type { Meta, StoryObj } from '@storybook/react'
import type { MultiSend, TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import { StoreDecorator } from '@/stories/storeDecorator'
import { TimelockOperation } from './index'

const meta = {
  title: 'Components/Transactions/TimelockOperation',
  component: TimelockOperation,
  decorators: [
    (Story) => (
      <StoreDecorator initialState={{}}>
        <div className="p-4">
          <Story />
        </div>
      </StoreDecorator>
    ),
  ],
  tags: ['autodocs', '!test'],
} satisfies Meta<typeof TimelockOperation>

export default meta
type Story = StoryObj<typeof meta>

const data: TransactionData = {
  to: { value: '0x1111111111111111111111111111111111111111' },
  value: '0',
  operation: Operation.CALL,
  hexData: '0x',
  dataDecoded: {
    method: 'scheduleBatch',
    parameters: [{ name: 'delay', type: 'uint256', value: '604800' }],
  },
}

const calls: MultiSend[] = [
  {
    operation: Operation.CALL,
    to: '0x5147b65F547b766DBaf520127e8f59834475021E',
    value: '0',
    data: '0x',
    dataDecoded: {
      method: 'addReservedNames',
      parameters: [
        { name: 'names', type: 'string[]', value: ['coinbase', 'nestle'] },
        { name: 'reason', type: 'uint8', value: '2' },
      ],
    },
  },
  {
    operation: Operation.CALL,
    to: '0x68Fab655A0204865a2f3AB3a607037e09648c92B',
    value: '0',
    data: '0x',
    dataDecoded: { method: 'setPublicSalesOpen', parameters: [{ name: 'open', type: 'bool', value: 'false' }] },
  },
]

export const Default: Story = {
  args: { data, calls, isConfirmationView: false },
}

export const ConfirmationView: Story = {
  args: { data, calls, isConfirmationView: true },
}
