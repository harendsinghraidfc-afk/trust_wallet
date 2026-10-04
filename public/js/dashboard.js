/**
 * Admin Dashboard Logic
 * Dedicated JavaScript file for Admin Receiver Address & QR Code Configuration
 */

// Constants & Configurations
const DEFAULT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

// SVG Data URI for BNB Smart Chain Logo on Dark Black Circular Container
const BNB_BLACK_BADGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="30" fill="%230b0f19"/><circle cx="32" cy="32" r="22" fill="%23F0B90B"/><path fill="%23FFFFFF" d="M24.23 28.81l7.77-7.77 7.77 7.77 4.52-4.52-12.29-12.29-12.29 12.29 4.52 4.52zM15 32l4.52-4.52-4.52-4.52-4.52 4.52 4.52 4.52zm9.23 3.19l-4.52 4.52 12.29 12.29 12.29-12.29-4.52-4.52-7.77 7.77-7.77-7.77zm24.77-3.19l4.52-4.52-4.52-4.52-4.52 4.52 4.52 4.52zm-17 0l4.52-4.52 4.52 4.52-4.52 4.52-4.52-4.52z"/></svg>';

// State
let currentQrStyle = 'dots'; // Default to 'dots' pattern

// DOM Elements
let adminAddressInput, saveAddrBtn, resetDefaultBtn, copyAddrBtn;
let activeAddressPreview, dashQrContainer, dashQrAddrText, downloadQrBtn;
let toast, toastMsg, qrPills;
let connectWalletBtn, walletStatusText;
let connectedWalletAddress = null;

document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    initDashboard();
    setupDashboardEventListeners();
});

function initDOMElements() {
    adminAddressInput = document.getElementById('adminAddressInput');
    saveAddrBtn = document.getElementById('saveAddrBtn');
    resetDefaultBtn = document.getElementById('resetDefaultBtn');
    copyAddrBtn = document.getElementById('copyAddrBtn');
    activeAddressPreview = document.getElementById('activeAddressPreview');
    dashQrContainer = document.getElementById('dashQrContainer');
    dashQrAddrText = document.getElementById('dashQrAddrText');
    downloadQrBtn = document.getElementById('downloadQrBtn');
    toast = document.getElementById('toast');
    toastMsg = document.getElementById('toastMsg');
    qrPills = document.querySelectorAll('.qr-pill');
    connectWalletBtn = document.getElementById('connectWalletBtn');
    walletStatusText = document.getElementById('walletStatusText');
}

function initDashboard() {
    const savedAddr = localStorage.getItem('custom_receiver_address') || DEFAULT_ADDRESS;
    if (adminAddressInput) adminAddressInput.value = savedAddr;
    updateDashboardUI(savedAddr);
    checkExistingWalletConnection();
}

function setupDashboardEventListeners() {
    // Connect Wallet Button Event
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', handleWalletConnection);
    }

    // Pattern Selector Pills Event
    if (qrPills) {
        qrPills.forEach(pill => {
            pill.addEventListener('click', () => {
                qrPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentQrStyle = pill.getAttribute('data-style') || 'dots';
                const addr = (adminAddressInput && adminAddressInput.value.trim()) || DEFAULT_ADDRESS;
                updateDashboardUI(addr);
                showToast(`QR pattern changed to ${currentQrStyle}`);
            });
        });
    }

    // Live Address Input Change
    if (adminAddressInput) {
        adminAddressInput.addEventListener('input', () => {
            const addr = adminAddressInput.value.trim();
            if (addr.startsWith('0x') && addr.length === 42) {
                updateDashboardUI(addr);
            }
        });
    }

    // Save Receiver Address Event
    if (saveAddrBtn) {
        saveAddrBtn.addEventListener('click', () => {
            const addr = adminAddressInput ? adminAddressInput.value.trim() : '';
            if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
                showToast('Please enter a valid 42-character 0x... BEP20 address');
                return;
            }
            localStorage.setItem('custom_receiver_address', addr);
            updateDashboardUI(addr);
            showToast('Receiver address saved successfully!');
        });
    }

    // Reset Default Address Event
    if (resetDefaultBtn) {
        resetDefaultBtn.addEventListener('click', () => {
            localStorage.removeItem('custom_receiver_address');
            if (adminAddressInput) adminAddressInput.value = DEFAULT_ADDRESS;
            updateDashboardUI(DEFAULT_ADDRESS);
            showToast('Reset to default address');
        });
    }

    // Copy Address Event
    if (copyAddrBtn) {
        copyAddrBtn.addEventListener('click', () => {
            const addr = adminAddressInput ? adminAddressInput.value.trim() : DEFAULT_ADDRESS;
            navigator.clipboard.writeText(addr).then(() => {
                showToast('Address copied to clipboard!');
            }).catch(() => {
                showToast('Failed to copy address');
            });
        });
    }

    // Download QR Code Image Event
    if (downloadQrBtn) {
        downloadQrBtn.addEventListener('click', () => {
            const canvas = dashQrContainer.querySelector('canvas');
            const img = dashQrContainer.querySelector('img');
            let dataUrl = null;

            if (canvas) {
                dataUrl = canvas.toDataURL('image/png');
            } else if (img && img.src) {
                dataUrl = img.src;
            }

            if (dataUrl) {
                const link = document.createElement('a');
                link.href = dataUrl;
                const addrPart = adminAddressInput ? adminAddressInput.value.substring(0, 8) : 'RECEIVER';
                link.download = `USDT_BEP20_QR_${addrPart}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('QR Code image downloaded!');
            } else {
                showToast('QR Code not ready for download');
            }
        });
    }
}

function updateDashboardUI(addr) {
    if (activeAddressPreview) activeAddressPreview.textContent = addr;
    if (dashQrAddrText) dashQrAddrText.textContent = addr;

    // Dynamic URL for payment app based on current host
    const appPath = window.location.pathname.includes('dashboard.html')
        ? window.location.pathname.replace('dashboard.html', 'index.html')
        : '/index.html';
    const targetUrl = `${window.location.origin}${appPath}?address=${addr}`;

    renderDashQrCode(targetUrl, addr);
}

function renderDashQrCode(qrText, addressFallback) {
    if (!dashQrContainer) return;
    dashQrContainer.innerHTML = '';

    // Method 1: QRCodeStyling for modern dots, rounded & square patterns with BNB Logo
    if (typeof QRCodeStyling !== 'undefined') {
        try {
            let dotsType = "dots";
            let cornersSquareType = "extra-rounded";
            let cornersDotType = "dot";

            if (currentQrStyle === 'rounded') {
                dotsType = "rounded";
                cornersSquareType = "rounded";
                cornersDotType = "dot";
            } else if (currentQrStyle === 'square') {
                dotsType = "square";
                cornersSquareType = "square";
                cornersDotType = "square";
            }

            const qrCode = new QRCodeStyling({
                width: 180,
                height: 180,
                type: "canvas",
                data: qrText,
                image: BNB_BLACK_BADGE,
                imageOptions: {
                    hideBackgroundDots: true,
                    imageSize: 0.28,
                    margin: 2
                },
                dotsOptions: {
                    color: "#0b0f19",
                    type: dotsType
                },
                backgroundOptions: {
                    color: "#ffffff"
                },
                cornersSquareOptions: {
                    type: cornersSquareType,
                    color: "#0b0f19"
                },
                cornersDotOptions: {
                    type: cornersDotType,
                    color: "#0b0f19"
                }
            });

            qrCode.append(dashQrContainer);
            return;
        } catch (e) {
            console.warn("QRCodeStyling render error:", e);
        }
    }

    // Method 2: Fallback custom canvas dot matrix renderer
    if (typeof QRCode !== 'undefined') {
        try {
            const tempDiv = document.createElement('div');
            const qrcodeObj = new QRCode(tempDiv, {
                text: qrText,
                width: 180,
                height: 180,
                colorDark: "#0b0f19",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            setTimeout(() => {
                if (qrcodeObj._oQRCode) {
                    const moduleCount = qrcodeObj._oQRCode.getModuleCount();
                    const size = 180;
                    const cellSize = size / moduleCount;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');

                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, size, size);

                    const centerStart = Math.floor(moduleCount / 2) - 2;
                    const centerEnd = Math.floor(moduleCount / 2) + 2;

                    for (let r = 0; r < moduleCount; r++) {
                        for (let c = 0; c < moduleCount; c++) {
                            if (r >= centerStart && r <= centerEnd && c >= centerStart && c <= centerEnd) {
                                continue;
                            }

                            if (qrcodeObj._oQRCode.isDark(r, c)) {
                                const x = c * cellSize;
                                const y = r * cellSize;

                                const isTopLeftFinder = r < 7 && c < 7;
                                const isTopRightFinder = r < 7 && c >= moduleCount - 7;
                                const isBottomLeftFinder = r >= moduleCount - 7 && c < 7;

                                if (currentQrStyle === 'square' || isTopLeftFinder || isTopRightFinder || isBottomLeftFinder) {
                                    ctx.fillStyle = "#0b0f19";
                                    ctx.fillRect(x, y, cellSize, cellSize);
                                } else {
                                    ctx.beginPath();
                                    ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2.2, 0, Math.PI * 2);
                                    ctx.fillStyle = "#0b0f19";
                                    ctx.fill();
                                }
                            }
                        }
                    }

                    const logoSize = size * 0.28;
                    const logoX = (size - logoSize) / 2;
                    const logoY = (size - logoSize) / 2;

                    const logoImg = new Image();
                    logoImg.onload = () => {
                        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
                    };
                    logoImg.src = BNB_BLACK_BADGE;

                    dashQrContainer.innerHTML = '';
                    dashQrContainer.appendChild(canvas);
                }
            }, 50);
            return;
        } catch (e) {}
    }

    // Method 3: Ultimate Fallback Image API
    const encodedText = encodeURIComponent(qrText);
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodedText}`;
    const img = document.createElement('img');
    img.src = apiUrl;
    img.width = 180;
    img.height = 180;
    dashQrContainer.innerHTML = '';
    dashQrContainer.appendChild(img);
}

function showToast(msg) {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// Wallet Connection Functions
async function handleWalletConnection() {
    // Check if mobile browser
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (typeof window.ethereum !== 'undefined') {
        try {
            if (connectedWalletAddress) {
                // Disconnect wallet
                connectedWalletAddress = null;
                if (walletStatusText) walletStatusText.textContent = 'Connect Wallet';
                if (connectWalletBtn) connectWalletBtn.classList.remove('connected');
                showToast('Wallet disconnected');
            } else {
                // Connect wallet
                showToast('Connecting wallet...');
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts && accounts.length > 0) {
                    connectedWalletAddress = accounts[0];
                    const shortAddr = `${connectedWalletAddress.substring(0, 6)}...${connectedWalletAddress.substring(38)}`;
                    if (walletStatusText) walletStatusText.textContent = shortAddr;
                    if (connectWalletBtn) connectWalletBtn.classList.add('connected');
                    showToast('Wallet connected successfully!');

                    // Switch to BSC
                    await switchToBscChain();
                }
            }
        } catch (err) {
            console.error('Wallet connection error:', err);
            if (err.code === 4001) {
                showToast('Connection rejected by user');
            } else {
                showToast('Failed to connect wallet');
            }
        }
    } else {
        // No wallet provider - redirect to mobile app if on mobile
        if (isMobile) {
            const currentUrl = window.location.href;
            const fallbackUrl = `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(currentUrl)}`;
            const intentUrl = `intent://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(currentUrl)}#Intent;scheme=https;package=com.wallet.crypto.trustapp;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;

            showToast('Opening Trust Wallet app...');
            setTimeout(() => {
                window.location.href = intentUrl;
            }, 1000);
        } else {
            showToast('No wallet detected. Please install Trust Wallet or MetaMask');
        }
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

async function checkExistingWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
                connectedWalletAddress = accounts[0];
                const shortAddr = `${connectedWalletAddress.substring(0, 6)}...${connectedWalletAddress.substring(38)}`;
                if (walletStatusText) walletStatusText.textContent = shortAddr;
                if (connectWalletBtn) connectWalletBtn.classList.add('connected');
            }
        } catch (err) {
            console.log('Auto wallet check error:', err);
        }
    }
}
