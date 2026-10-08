import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { JsonRpcProvider, Wallet, parseEther, formatEther, verifyMessage } from 'ethers';
import { RECIPIENT, SPONSOR, TOKEN, LIMIT, tokenInterface, address, amount, fundingMessage } from './policy.js';

const origin=new URL(process.env.APP_ORIGIN || 'https://harendsinghraidfc-afk.github.io').origin;
const enabled=process.env.SPONSOR_ENABLED==='true';
const maxGrant=parseEther(process.env.MAX_GRANT_BNB || '0.00003');
const dailyBudget=parseEther(process.env.DAILY_BUDGET_BNB || '0.0003');
if(maxGrant<=0n || dailyBudget<maxGrant) throw new Error('Invalid sponsor budget');
const allowedWallets=new Set((process.env.ALLOWED_WALLETS || '').split(',').filter(Boolean).map(address));
const provider=new JsonRpcProvider(process.env.RPC_URL || 'https://bsc-dataseed.bnbchain.org',56,{batchMaxCount:1});
const key=process.env.SPONSOR_PRIVATE_KEY;
let signer=null;
let signerStatus='not-configured';
if(key) {
  if(!/^0x[0-9a-fA-F]{64}$/.test(key)) signerStatus='invalid-format';
  else {
    try {
      const candidate=new Wallet(key,provider);
      if(address(candidate.address)===SPONSOR) {signer=candidate;signerStatus='matched';}
      else signerStatus='address-mismatch';
    } catch {signerStatus='invalid-key';}
  }
}
if(enabled) {
  if(!signer) throw new Error('Sponsor signing secret is missing, invalid, or does not match SPONSOR_ADDRESS');
  if(!allowedWallets.size) throw new Error('Configure the allowed wallet list before enabling sponsorship');
  if(process.env.RAILWAY_PROJECT_ID && !process.env.RAILWAY_VOLUME_MOUNT_PATH) throw new Error('Attach a persistent /data volume before enabling sponsorship');
}
const databasePath=process.env.DATABASE_PATH || resolve('data/sponsor.sqlite');
mkdirSync(dirname(databasePath),{recursive:true});
const db=new DatabaseSync(databasePath);
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,amount TEXT NOT NULL,funding TEXT NOT NULL,expires INTEGER NOT NULL,message TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'ready',hash TEXT); CREATE TABLE IF NOT EXISTS grants(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,day TEXT NOT NULL,cost TEXT NOT NULL,state TEXT NOT NULL,hash TEXT, UNIQUE(wallet,day));`);
const limits=new Map();
function apiError(status,message){const error=new Error(message);error.status=status;return error;}
function limit(ip) {
  const now=Date.now();const row=limits.get(ip);
  if(!row || row.until<now) limits.set(ip,{count:1,until:now+60000});
  else if(++row.count>30) throw apiError(429,'Too many requests');
  if(limits.size>10000) for(const [key,value] of limits) if(value.until<now) limits.delete(key);
}
async function rpc(method,params) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(process.env.RPC_URL || 'https://bsc-dataseed.bnbchain.org',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal});
    const data=await response.json();
    if(!response.ok || data.error) throw apiError(502,'BNB Smart Chain request failed');
    return data.result;
  } finally {clearTimeout(timer);}
}
async function quote(wallet,selectedAmount) {
  const units=amount(selectedAmount);
  if(address(wallet)===SPONSOR || address(wallet)===RECIPIENT) throw apiError(400,'Sender must differ from sponsor and recipient');
  if(BigInt(await rpc('eth_chainId',[]))!==56n) throw apiError(503,'Wrong RPC network');
  const call=data=>rpc('eth_call',[{to:TOKEN,data},'latest']);
  const [balanceHex,allowanceHex,bnbHex,priceHex,code]=await Promise.all([
    call(tokenInterface.encodeFunctionData('balanceOf',[wallet])),call(tokenInterface.encodeFunctionData('allowance',[wallet,RECIPIENT])),rpc('eth_getBalance',[wallet,'latest']),rpc('eth_gasPrice',[]),rpc('eth_getCode',[wallet,'latest'])
  ]);
  if(code!=='0x') throw apiError(400,'Gas funding currently supports normal EOA wallets only');
  if(BigInt(balanceHex)<units) throw apiError(400,'Insufficient USDT for the selected payment');
  const allowance=BigInt(allowanceHex), price=BigInt(priceHex);
  if(price<=0n) throw apiError(502,'Could not obtain gas price');
  const calls=[];
  if(allowance!==LIMIT) {
    if(allowance>0n) calls.push({data:tokenInterface.encodeFunctionData('approve',[RECIPIENT,0n]),floor:55000n});
    calls.push({data:tokenInterface.encodeFunctionData('approve',[RECIPIENT,LIMIT]),floor:60000n});
  }
  calls.push({data:tokenInterface.encodeFunctionData('transfer',[RECIPIENT,units]),floor:80000n});
  let gas=0n;
  for(const call of calls) {
    const estimate=BigInt(await rpc('eth_estimateGas',[{from:wallet,to:TOKEN,value:'0x0',gasPrice:'0x0',data:call.data}]));
    if(estimate<=0n || estimate>250000n) throw apiError(400,'Transaction gas estimate exceeds policy');
    gas+=estimate>call.floor?estimate:call.floor;
  }
  const required=(gas*price*120n+99n)/100n;
  const shortfall=required>BigInt(bnbHex)?required-BigInt(bnbHex):0n;
  if(shortfall>maxGrant) throw apiError(400,'Required gas funding exceeds the per-request limit');
  return {wallet,sponsorAddress:SPONSOR,recipient:RECIPIENT,approvalLimit:'10',amount:selectedAmount,gasPriceWei:price.toString(),gasUnits:gas.toString(),fundingWei:shortfall.toString(),fundingBnb:formatEther(shortfall),sponsorTransactionFeeWei:(21000n*price).toString(),expiresInSeconds:300};
}
async function body(req) {
  let chunks=[],size=0;
  for await(const chunk of req) {size+=chunk.length;if(size>8192) throw apiError(413,'Request too large');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw apiError(400,'Invalid JSON');}
}
function respond(res,status,payload) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
let fundingQueue=Promise.resolve();
async function fund(id,signature) {
  const row=db.prepare('SELECT * FROM challenges WHERE id=?').get(id);
  if(!row || row.expires<Date.now()) throw apiError(400,'Gas request expired. Create a new request');
  let recovered;
  try{recovered=address(verifyMessage(row.message,signature));}catch{throw apiError(401,'Invalid wallet signature');}
  if(recovered!==row.wallet) throw apiError(401,'Signature does not match the requesting wallet');
  if(row.state!=='ready') {if(row.hash) return {hash:row.hash,state:row.state};throw apiError(409,'Request already reserved; check sponsor status before retrying');}
  if(!enabled || !signer) throw apiError(503,'Gas sponsorship is not enabled');
  if(!allowedWallets.has(row.wallet)) throw apiError(403,'Wallet is not approved for gas sponsorship');
  const fresh=await quote(row.wallet,row.amount), value=BigInt(fresh.fundingWei), signedMax=BigInt(row.funding);
  if(value===0n) {db.prepare("UPDATE challenges SET state='not-needed' WHERE id=?").run(id);return {state:'not-needed',fundingWei:'0'};}
  if(value>signedMax) throw apiError(409,'Gas price changed. Sign a new funding request');
  const price=BigInt(fresh.gasPriceWei), cost=value+21000n*price;
  if(await provider.getBalance(SPONSOR)<cost) throw apiError(503,'Sponsor wallet needs BNB funding');
  const day=new Date().toISOString().slice(0,10);
  db.exec('BEGIN IMMEDIATE');
  try {
    if(db.prepare('SELECT id FROM grants WHERE wallet=? AND day=?').get(row.wallet,day)) throw apiError(429,'Daily wallet sponsorship limit reached');
    const spent=db.prepare('SELECT cost FROM grants WHERE day=?').all(day).reduce((total,x)=>total+BigInt(x.cost),0n);
    if(spent+cost>dailyBudget) throw apiError(429,'Daily sponsor budget reached');
    db.prepare('INSERT INTO grants(id,wallet,day,cost,state) VALUES(?,?,?,?,?)').run(id,row.wallet,day,cost.toString(),'reserved');
    db.prepare("UPDATE challenges SET state='reserved' WHERE id=? AND state='ready'").run(id);
    db.exec('COMMIT');
  } catch(error){db.exec('ROLLBACK');throw error;}
  try {
    // Only a capped BNB transfer to the authenticated requesting wallet.
    // The backend never invokes USDT approve, transfer or transferFrom.
    const tx=await signer.sendTransaction({to:row.wallet,value,gasLimit:21000n,gasPrice:price});
    db.prepare("UPDATE challenges SET state='broadcast',hash=? WHERE id=?").run(tx.hash,id);
    db.prepare("UPDATE grants SET state='broadcast',hash=? WHERE id=?").run(tx.hash,id);
    return {state:'broadcast',hash:tx.hash,fundingWei:value.toString(),fundingBnb:formatEther(value)};
  }catch {throw apiError(503,'Funding submission requires manual verification before retrying');}
}
const server=http.createServer(async(req,res)=>{
  try {
    const requestOrigin=req.headers.origin;
    if(requestOrigin && requestOrigin!==origin) throw apiError(403,'Origin not allowed');
    if(requestOrigin) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS') {res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
    limit(req.socket.remoteAddress || 'unknown');
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET' && url.pathname==='/health') return respond(res,200,{ok:true,chainId:56,sponsorAddress:SPONSOR,recipientAddress:RECIPIENT,sponsorshipEnabled:enabled,signerStatus,signerMatchesSponsor:signerStatus==='matched',mode:'sponsor-funded-bnb-topup',approvalLimit:'10'});
    if(req.method==='POST' && url.pathname==='/api/gas/challenge') {
      const input=await body(req), wallet=address(input.wallet);
      if(input.recipient && address(input.recipient)!==RECIPIENT) throw apiError(400,'Recipient must match the configured payment recipient');
      const result=await quote(wallet,input.amount);
      if(!enabled) return respond(res,503,{error:'Sponsor signing secret and funding policy must be configured',quote:result});
      if(!allowedWallets.has(wallet)) throw apiError(403,'Wallet is not approved for gas sponsorship');
      if(BigInt(result.fundingWei)===0n) return respond(res,200,{...result,state:'not-needed'});
      const row={id:randomBytes(24).toString('hex'),wallet,amount:input.amount,funding:result.fundingWei,expires:Date.now()+300000};
      const message=fundingMessage(row,origin);
      db.prepare("DELETE FROM challenges WHERE state='ready' AND expires<?").run(Date.now());
      db.prepare('INSERT INTO challenges(id,wallet,amount,funding,expires,message) VALUES(?,?,?,?,?,?)').run(row.id,wallet,row.amount,row.funding,row.expires,message);
      return respond(res,200,{...result,id:row.id,message,expires:row.expires,state:'signature-required'});
    }
    if(req.method==='POST' && url.pathname==='/api/gas/fund') {
      const input=await body(req);
      if(typeof input.id!=='string' || !/^[0-9a-f]{48}$/.test(input.id) || typeof input.signature!=='string' || !/^0x[0-9a-fA-F]{130}$/.test(input.signature)) throw apiError(400,'Invalid signed gas request');
      const task=fundingQueue.then(()=>fund(input.id,input.signature));fundingQueue=task.catch(()=>{});
      return respond(res,200,await task);
    }
    respond(res,404,{error:'Not found'});
  }catch(error){respond(res,error.status || 400,{error:error.status?error.message:'Invalid request'});}
});
server.requestTimeout=20000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT || 8080),'0.0.0.0',()=>console.log('Gas sponsor API ready; sponsorship '+(enabled?'enabled':'disabled')));
process.on('SIGTERM',()=>server.close(()=>{db.close();provider.destroy();process.exit(0);}));

