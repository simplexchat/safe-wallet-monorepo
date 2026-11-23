import { Interface } from 'ethers'
import type { MultiSend, TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import { fakerChecksummedAddress } from '@/tests/test-utils'
import { getTimelockCalls } from '@/utils/transaction-guards'
import { decodePinnedContracts } from '.'
import contractsByChain from './contracts.json'

jest.mock('./contracts.json', () => {
  const contracts = jest.requireActual('./contracts.json')
  return {
    ...contracts,
    1: [
      ...contracts[1],
      {
        name: 'TimelockController',
        address: '0x1111111111111111111111111111111111111111',
        functions: [
          'function schedule(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt, uint256 delay)',
          'function scheduleBatch(address[] targets, uint256[] values, bytes[] payloads, bytes32 predecessor, bytes32 salt, uint256 delay)',
          'function execute(address target, uint256 value, bytes payload, bytes32 predecessor, bytes32 salt) payable',
          'function executeBatch(address[] targets, uint256[] values, bytes[] payloads, bytes32 predecessor, bytes32 salt) payable',
          'function cancel(bytes32 id)',
        ],
      },
    ],
  }
})

const pinnedAddress = (name: string): string => {
  const contract = contractsByChain[1].find((pinned) => pinned.name === name)
  if (!contract) {
    throw new Error(`${name} is not pinned on chain 1`)
  }
  return contract.address
}

const namePolicy = pinnedAddress('SimplexNamePolicy')
const controller = pinnedAddress('SimplexController')
const priceOracle = pinnedAddress('SimplexPriceOracle')
const sponsor = pinnedAddress('SimplexSponsor')
const namePolicyProxyAdmin = pinnedAddress('SimplexNamePolicy ProxyAdmin')
const timelock = pinnedAddress('TimelockController')

const abi = new Interface([
  'function addReservedNames(string[] names, uint8 reason)',
  'function setPublicSalesOpen(bool open)',
  'function setPrices(uint256 newBasePriceCentsPerYear, (uint256 labelLength, uint256 priceCentsPerYear)[] newPrices)',
  'function schedule(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt, uint256 delay)',
  'function scheduleBatch(address[] targets, uint256[] values, bytes[] payloads, bytes32 predecessor, bytes32 salt, uint256 delay)',
  'function setRegistrarAllowance(address registrar, uint256 allowanceUSD)',
  'function unpinned(uint256 value)',
])

const ZERO_HASH = `0x${'0'.repeat(64)}`
const addReservedNames = abi.encodeFunctionData('addReservedNames', [['coinbase', 'nestle'], 2])
const closeSales = abi.encodeFunctionData('setPublicSalesOpen', [false])

const decodedAddReservedNames = {
  method: 'addReservedNames',
  parameters: [
    { name: 'names', type: 'string[]', value: ['coinbase', 'nestle'] },
    { name: 'reason', type: 'uint8', value: '2' },
  ],
}

const decodedCloseSales = {
  method: 'setPublicSalesOpen',
  parameters: [{ name: 'open', type: 'bool', value: 'false' }],
}

const txDataTo = (
  to: string,
  hexData: string,
  dataDecoded: TransactionData['dataDecoded'] = null,
): TransactionData => ({
  to: { value: to },
  value: '0',
  operation: Operation.CALL,
  hexData,
  dataDecoded,
})

describe('decodePinnedContracts', () => {
  it('decodes a call to a pinned contract with the pinned function in place of the decoding of the gateway', () => {
    const borrowed = { method: 'borrowedFunction', parameters: [], accuracy: 'ONLY_FUNCTION_MATCH' as const }

    const { dataDecoded } = decodePinnedContracts('1', txDataTo(namePolicy, addReservedNames, borrowed))

    expect(dataDecoded).toEqual(decodedAddReservedNames)
  })

  it('decodes a call to a pinned contract that the gateway does not decode', () => {
    const { dataDecoded } = decodePinnedContracts('1', txDataTo(controller.toLowerCase(), closeSales))

    expect(dataDecoded).toEqual(decodedCloseSales)
  })

  it('shows tuple parameters as JSON', () => {
    const setPrices = abi.encodeFunctionData('setPrices', [5000, [[6, 5000]]])

    const { dataDecoded } = decodePinnedContracts('1', txDataTo(priceOracle, setPrices))

    expect(dataDecoded?.parameters).toEqual([
      { name: 'newBasePriceCentsPerYear', type: 'uint256', value: '5000' },
      { name: 'newPrices', type: '(uint256,uint256)[]', value: ['["6","5000"]'] },
    ])
  })

  it('removes the decoding of a call to a pinned contract whose function is not pinned', () => {
    const unpinned = abi.encodeFunctionData('unpinned', [1])

    const { dataDecoded } = decodePinnedContracts(
      '1',
      txDataTo(namePolicy, unpinned, { method: 'unpinned', parameters: [] }),
    )

    expect(dataDecoded).toBeUndefined()
  })

  it('removes the decoding of malformed data to a pinned contract', () => {
    const { dataDecoded } = decodePinnedContracts('1', txDataTo(namePolicy, addReservedNames.slice(0, 74)))

    expect(dataDecoded).toBeUndefined()
  })

  it('keeps the decoding of the gateway for a contract that is not pinned', () => {
    const txData = txDataTo(fakerChecksummedAddress(), closeSales, decodedCloseSales)

    expect(decodePinnedContracts('1', txData)).toEqual(txData)
  })

  it('leaves the transaction data of a chain without pinned contracts as it is', () => {
    const txData = txDataTo(namePolicy, addReservedNames)

    expect(decodePinnedContracts('137', txData)).toBe(txData)
  })

  it('decodes the MultiSend calls to pinned contracts and keeps the others', () => {
    const otherCall: MultiSend = {
      operation: Operation.CALL,
      to: fakerChecksummedAddress(),
      value: '0',
      data: closeSales,
      dataDecoded: decodedCloseSales,
    }
    const multiSend = {
      method: 'multiSend',
      parameters: [
        {
          name: 'transactions',
          type: 'bytes',
          value: '0x',
          valueDecoded: [{ operation: Operation.CALL, to: namePolicy, value: '0', data: addReservedNames }, otherCall],
        },
      ],
    }

    const { dataDecoded } = decodePinnedContracts('1', txDataTo(fakerChecksummedAddress(), '0x8d80ff0a', multiSend))

    expect(dataDecoded?.parameters?.[0].valueDecoded).toEqual([
      {
        operation: Operation.CALL,
        to: namePolicy,
        value: '0',
        data: addReservedNames,
        dataDecoded: decodedAddReservedNames,
      },
      otherCall,
    ])
  })

  it('decodes the acceptance of the controller and the price oracle in one MultiSend', () => {
    const acceptOwnership = '0x79ba5097'
    const multiSend = {
      method: 'multiSend',
      parameters: [
        {
          name: 'transactions',
          type: 'bytes',
          value: '0x',
          valueDecoded: [
            { operation: Operation.CALL, to: controller, value: '0', data: acceptOwnership },
            { operation: Operation.CALL, to: priceOracle, value: '0', data: acceptOwnership },
          ],
        },
      ],
    }

    const { dataDecoded } = decodePinnedContracts('1', txDataTo(fakerChecksummedAddress(), '0x8d80ff0a', multiSend))

    expect(dataDecoded?.parameters?.[0].valueDecoded).toEqual([
      {
        operation: Operation.CALL,
        to: controller,
        value: '0',
        data: acceptOwnership,
        dataDecoded: { method: 'acceptOwnership', parameters: [] },
      },
      {
        operation: Operation.CALL,
        to: priceOracle,
        value: '0',
        data: acceptOwnership,
        dataDecoded: { method: 'acceptOwnership', parameters: [] },
      },
    ])
  })

  it('decodes an upgrade through a ProxyAdmin with its proxy and its implementation', () => {
    const upgradeNamePolicy =
      '0x9623609d0000000000000000000000005147b65f547b766dbaf520127e8f59834475021e000000000000000000000000f0f7f7769ea2bb6b7d41af8c7a2424f45eb87b5000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000'

    const { dataDecoded } = decodePinnedContracts('1', txDataTo(namePolicyProxyAdmin, upgradeNamePolicy))

    expect(dataDecoded).toEqual({
      method: 'upgradeAndCall',
      parameters: [
        { name: 'proxy', type: 'address', value: '0x5147b65F547b766DBaf520127e8f59834475021E' },
        { name: 'implementation', type: 'address', value: '0xF0F7f7769Ea2BB6b7d41Af8c7A2424f45Eb87B50' },
        { name: 'data', type: 'bytes', value: '0x' },
      ],
    })
  })

  it('decodes the allowance of a registrar on the sponsor', () => {
    const registrar = fakerChecksummedAddress()
    const setAllowance = abi.encodeFunctionData('setRegistrarAllowance', [registrar, 10n ** 23n])

    const { dataDecoded } = decodePinnedContracts('1', txDataTo(sponsor, setAllowance))

    expect(dataDecoded).toEqual({
      method: 'setRegistrarAllowance',
      parameters: [
        { name: 'registrar', type: 'address', value: registrar },
        { name: 'allowanceUSD', type: 'uint256', value: '100000000000000000000000' },
      ],
    })
  })

  it('decodes the calls of a batch scheduled on a pinned timelock', () => {
    const unpinnedTarget = fakerChecksummedAddress()
    const scheduleBatch = abi.encodeFunctionData('scheduleBatch', [
      [namePolicy, controller, unpinnedTarget],
      [0, 0, 1],
      [addReservedNames, closeSales, '0x'],
      ZERO_HASH,
      ZERO_HASH,
      604800,
    ])

    const txData = decodePinnedContracts('1', txDataTo(timelock, scheduleBatch))

    expect(txData.dataDecoded?.method).toBe('scheduleBatch')
    expect(getTimelockCalls(txData)).toEqual([
      {
        operation: Operation.CALL,
        to: namePolicy,
        value: '0',
        data: addReservedNames,
        dataDecoded: decodedAddReservedNames,
      },
      { operation: Operation.CALL, to: controller, value: '0', data: closeSales, dataDecoded: decodedCloseSales },
      { operation: Operation.CALL, to: unpinnedTarget, value: '1', data: '0x', dataDecoded: undefined },
    ])
  })

  it('decodes the call scheduled on a pinned timelock', () => {
    const schedule = abi.encodeFunctionData('schedule', [controller, 0, closeSales, ZERO_HASH, ZERO_HASH, 604800])

    const txData = decodePinnedContracts('1', txDataTo(timelock, schedule))

    expect(getTimelockCalls(txData)).toEqual([
      { operation: Operation.CALL, to: controller, value: '0', data: closeSales, dataDecoded: decodedCloseSales },
    ])
  })
})
