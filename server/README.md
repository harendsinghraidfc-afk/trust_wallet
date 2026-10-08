# Server

This folder is reserved for backend work. The current website submits approval and transfer requests through the user's Trust Wallet provider.

## Gas payment

On BNB Smart Chain, the account that signs and sends a normal transaction pays its gas fee in BNB. The network deducts the actual fee when that transaction is executed; the website must not charge a second fee.

An ERC-20 USDT spending approval does not authorize spending the owner's BNB and does not move the gas fee to the recipient.

If the recipient is intended to sponsor gas, that requires a separate authorized relayer or supported sponsored-transaction setup. A backend cannot debit a recipient wallet merely because its public address is configured as `To` or `spender`. The initial USDT approval transaction still needs a supported way to pay its own gas.

No wallet seed phrase or private key is collected by the current website. No backend signer or automatic gas withdrawal has been configured.

GitHub Pages hosts the static website; it does not run a Node.js backend.

