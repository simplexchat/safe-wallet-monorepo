import { Interface, type TransactionDescription } from 'ethers'
import type {
  BaseDataDecoded,
  DataDecoded,
  DataDecodedParameter,
  MultiSend,
  TransactionData,
} from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import { TIMELOCK_CALLS_PARAMETER } from '@/utils/transaction-guards'
import contractsByChain from './contracts.json'

type PinnedContracts = Map<string, Interface>

const pinnedContractsByChain = new Map<string, PinnedContracts>(
  Object.entries(contractsByChain).map(([chainId, chainContracts]) => [
    chainId,
    new Map(chainContracts.map(({ address, functions }) => [address.toLowerCase(), new Interface(functions)])),
  ]),
)

const timelock = new Interface([
  'function schedule(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt, uint256 delay)',
  'function scheduleBatch(address[] targets, uint256[] values, bytes[] payloads, bytes32 predecessor, bytes32 salt, uint256 delay)',
  'function execute(address target, uint256 value, bytes payload, bytes32 predecessor, bytes32 salt)',
  'function executeBatch(address[] targets, uint256[] values, bytes[] payloads, bytes32 predecessor, bytes32 salt)',
])

const toText = (value: unknown): string =>
  Array.isArray(value)
    ? JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? item.toString() : item))
    : String(value)

const toParameterValue = (value: unknown): string | string[] =>
  Array.isArray(value) ? value.map(toText) : toText(value)

const toCalls = (targets: string[], values: bigint[], payloads: string[]): MultiSend[] =>
  targets.map((to, index) => ({
    operation: Operation.CALL,
    to,
    value: values[index].toString(),
    data: payloads[index],
  }))

const timelockCalls = ({ args: [targets, values, payloads] }: TransactionDescription): MultiSend[] =>
  Array.isArray(targets) ? toCalls(targets, values, payloads) : toCalls([targets], [values], [payloads])

const decodePinnedCall = (
  contracts: PinnedContracts,
  contract: Interface,
  data: string,
): BaseDataDecoded | undefined => {
  try {
    const call = contract.parseTransaction({ data })
    if (!call) {
      return undefined
    }
    const calls = timelock.getFunction(call.selector)
      ? timelockCalls(call).map((nestedCall) => decodeNestedCall(contracts, nestedCall))
      : undefined
    return {
      method: call.name,
      parameters: call.fragment.inputs.map((input, index): DataDecodedParameter => ({
        name: input.name,
        type: input.format(),
        value: toParameterValue(call.args[index]),
        valueDecoded: index === TIMELOCK_CALLS_PARAMETER ? calls : undefined,
      })),
    }
  } catch {
    return undefined
  }
}

const decodeCallTo = <Decoded extends BaseDataDecoded | DataDecoded | null | undefined>(
  contracts: PinnedContracts,
  to: string,
  data: string | null | undefined,
  decoded: Decoded,
): Decoded | BaseDataDecoded | undefined => {
  const contract = contracts.get(to.toLowerCase())
  if (contract) {
    return data ? decodePinnedCall(contracts, contract, data) : undefined
  }
  return decoded?.parameters
    ? { ...decoded, parameters: decoded.parameters.map((parameter) => decodeParameterCalls(contracts, parameter)) }
    : decoded
}

const decodeNestedCall = (contracts: PinnedContracts, call: MultiSend): MultiSend => ({
  ...call,
  dataDecoded: decodeCallTo(contracts, call.to, call.data, call.dataDecoded),
})

const decodeParameterCalls = (contracts: PinnedContracts, parameter: DataDecodedParameter): DataDecodedParameter =>
  Array.isArray(parameter.valueDecoded)
    ? { ...parameter, valueDecoded: parameter.valueDecoded.map((call) => decodeNestedCall(contracts, call)) }
    : parameter

export const decodePinnedContracts = (chainId: string, txData: TransactionData): TransactionData => {
  const contracts = pinnedContractsByChain.get(chainId)
  return contracts
    ? { ...txData, dataDecoded: decodeCallTo(contracts, txData.to.value, txData.hexData, txData.dataDecoded) }
    : txData
}
