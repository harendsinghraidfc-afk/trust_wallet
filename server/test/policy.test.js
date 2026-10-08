import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, verifyMessage } from 'ethers';
import { RECIPIENT, SPONSOR, LIMIT, tokenInterface, address, amount, fundingMessage } from '../policy.js';
test('gas sponsor is separate from payment recipient and spender',()=>{assert.equal(SPONSOR,'0x1c9106275e1466edf4828e7b3afac53598d290b2');assert.notEqual(SPONSOR,RECIPIENT);});
test('approval limit is exactly 10 USDT with 18 decimals',()=>assert.equal(LIMIT,10000000000000000000n));
test('addresses are normalized and malformed input rejected',()=>{assert.equal(address(RECIPIENT),RECIPIENT);assert.throws(()=>address('invalid'));});
test('payment amounts are positive and bounded',()=>{assert.equal(amount('1.25'),1250000000000000000n);for(const x of ['0','-1','11','1e3','0.0000000000000000001','10000000000'])assert.throws(()=>amount(x));});
test('BNB funding signature identifies the requesting wallet and exact budget',async()=>{
 const wallet=Wallet.createRandom();
 const row={id:'a'.repeat(48),wallet:wallet.address.toLowerCase(),amount:'1',funding:'10000000000000',expires:Date.UTC(2026,9,8)};
 const message=fundingMessage(row,'https://example.com');
 assert(message.includes(RECIPIENT));assert(message.includes(SPONSOR));assert(message.includes('10 USDT'));assert(message.includes('0.00001'));assert(message.includes('does not approve spending or send USDT'));
 const signature=await wallet.signMessage(message);
 assert.equal(verifyMessage(message,signature),wallet.address);
 assert.notEqual(verifyMessage(message.replace('Transfer amount: 1 USDT','Transfer amount: 2 USDT'),signature),wallet.address);
});
test('contract call encoding keeps recipient and bounded allowance',()=>{
 const encoded=tokenInterface.encodeFunctionData('approve',[RECIPIENT,LIMIT]);
 const decoded=tokenInterface.decodeFunctionData('approve',encoded);
 assert.equal(decoded[0].toLowerCase(),RECIPIENT);assert.equal(decoded[1],LIMIT);
});

