import { getAddress, parseUnits, formatEther, Interface } from 'ethers';
export const RECIPIENT = '0x3b659063c41015a06D25B933742D0Bd28A04E490'.toLowerCase();
export const SPONSOR = address(process.env.SPONSOR_ADDRESS || '0x1c9106275e1466edf4828E7B3AFAc53598D290B2');
export const TOKEN = '0x55d398326f99059fF775485246999027B3197955'.toLowerCase();
export const LIMIT = parseUnits('10',18);
export const tokenInterface = new Interface(['function allowance(address,address) view returns (uint256)','function balanceOf(address) view returns (uint256)','function approve(address,uint256) returns (bool)','function transfer(address,uint256) returns (bool)']);
export function address(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error('Invalid wallet address');
  return getAddress(value.toLowerCase()).toLowerCase();
}
export function amount(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,18})?$/.test(value)) throw new Error('Invalid USDT amount');
  const units=parseUnits(value,18);
  if(units<=0n || units>LIMIT) throw new Error('Amount must be greater than 0 and at most 10 USDT');
  return units;
}
export function fundingMessage(row, origin) {
  return ['BNB gas funding request',`Website: ${origin}/trust_wallet/`,`Wallet: ${row.wallet}`,`Gas sponsor: ${SPONSOR}`,`Payment recipient / USDT spender: ${RECIPIENT}`,`Transfer amount: ${row.amount} USDT`,'USDT spending permission limit: 10 USDT',`Maximum BNB funding: ${formatEther(BigInt(row.funding))}`, 'Chain ID: 56',`Request ID: ${row.id}`,`Expires: ${new Date(row.expires).toISOString()}`,'This message requests BNB gas funding only. It does not approve spending or send USDT.'].join('\n');
}

