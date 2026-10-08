# Recipient-funded BNB gas sponsor

Node 24 backend for Railway. The configured sponsor is the To/spender wallet `0x3b659063c41015a06D25B933742D0Bd28A04E490`.

## How funding works

Ordinary USDT approvals and transfers still charge the connected wallet in BNB. The recipient-owned sponsor covers that cost by sending a bounded BNB top-up to the connected wallet first. The sponsor also pays the top-up transaction's gas.

The backend sends only BNB funding. It never calls USDT approve, transfer or transferFrom, and never receives a connected user's seed phrase or private key. The user still approves exactly 10 USDT in Trust Wallet and separately approves their selected USDT transfer.

## Controls

- An expiring wallet-signed funding message identifies the wallet, recipient and maximum grant.
- Only wallets in ALLOWED_WALLETS can receive funds; an empty list denies funding.
- Defaults: 0.00003 BNB per grant, one grant per wallet per UTC day, and 0.0003 BNB total daily cost including top-up gas.
- Persistent SQLite records prevent request reuse and duplicate funding after uncertain broadcasts.
- Sponsorship is disabled by default. Health/quotes can be deployed without a signing key.

## Railway setup

Deploy this server directory as the service root. The Dockerfile uses Railway's PORT; health check is /health.

Before enabling funding:

1. Attach a persistent volume at /data and set DATABASE_PATH=/data/sponsor.sqlite.
2. Set SPONSOR_PRIVATE_KEY as a **sealed Railway variable** for the recipient wallet, directly in Railway. Do not place it in chat or committed files. The server checks that its address matches the fixed recipient.
3. Configure ALLOWED_WALLETS and review MAX_GRANT_BNB / DAILY_BUDGET_BNB.
4. Fund the recipient wallet with BNB, then set SPONSOR_ENABLED=true.
5. Keep one service replica with this SQLite volume.

The frontend sponsorApiUrl points to https://trust-wallet-gas-server-production.up.railway.app. APP_ORIGIN must match the website origin. Enable the frontend sponsorFundingEnabled flag only after the user asks to activate funding; it is currently false at the user's request.

## API

- GET /health: chain, sponsor and funding enabled state.
- POST /api/gas/challenge: wallet, recipient and amount; returns a grant quote and message to sign. While disabled it returns 503 with the quote.
- POST /api/gas/fund: request id and signature; verifies ownership and submits a capped BNB top-up, or returns the previous funding hash.

Run npm ci, npm test, npm start. Tests use generated wallets and never spend BNB.

