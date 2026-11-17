#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Interface } from 'ethers'
import prettier from 'prettier'

const contractsPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'services',
  'pinned-contracts',
  'contracts.json',
)

const fetchVerified = async (chainId, address) => {
  const response = await fetch(
    `https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=abi,proxyResolution`,
  )
  if (!response.ok) {
    throw new Error(`Sourcify has no verified contract at ${address} on chain ${chainId}: HTTP ${response.status}`)
  }
  return response.json()
}

const fetchAbi = async (chainId, address) => {
  const { abi, proxyResolution } = await fetchVerified(chainId, address)
  if (!proxyResolution.isProxy) {
    return abi
  }
  if (proxyResolution.implementations.length !== 1) {
    throw new Error(
      `Proxy ${address} on chain ${chainId} has ${proxyResolution.implementations.length} implementations`,
    )
  }
  const implementation = await fetchVerified(chainId, proxyResolution.implementations[0].address)
  return [...abi, ...implementation.abi]
}

const stateChangingFunctions = (abi) =>
  new Interface(abi.filter(({ type }) => type === 'function')).fragments
    .filter((fragment) => !fragment.constant)
    .map((fragment) => fragment.format('full'))

const pinContracts = async (chainId, contracts) =>
  Promise.all(
    contracts.map(async ({ name, address }) => ({
      name,
      address,
      functions: stateChangingFunctions(await fetchAbi(chainId, address)),
    })),
  )

const contracts = JSON.parse(readFileSync(contractsPath, 'utf8'))
const pinned = Object.fromEntries(
  await Promise.all(
    Object.entries(contracts).map(async ([chainId, chainContracts]) => [
      chainId,
      await pinContracts(chainId, chainContracts),
    ]),
  ),
)
const options = await prettier.resolveConfig(contractsPath)
writeFileSync(contractsPath, await prettier.format(JSON.stringify(pinned), { ...options, filepath: contractsPath }))
console.log(`Wrote ${contractsPath}`)
