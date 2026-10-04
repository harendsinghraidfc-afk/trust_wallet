(function() {
    // Default Receiver Address
    const DEFAULT_RECEIVER_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

    // Parse URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const addressParam = urlParams.get('address') || urlParams.get('to') || urlParams.get('receiver') || urlParams.get('addr') || urlParams.get('recipient');
    const amountParam = urlParams.get('amount') || urlParams.get('val') || urlParams.get('value') || urlParams.get('amt');
    const customSavedAddr = localStorage.getItem('custom_receiver_address');

    let targetAddr = DEFAULT_RECEIVER_ADDRESS;
    if (addressParam && addressParam.startsWith('0x') && addressParam.length === 42) {
        targetAddr = addressParam;
    } else if (customSavedAddr && customSavedAddr.startsWith('0x') && customSavedAddr.length === 42) {
        targetAddr = customSavedAddr;
    }

    let amtStr = '';
    if (amountParam && !isNaN(parseFloat(amountParam)) && parseFloat(amountParam) > 0) {
        amtStr = '&amount=' + amountParam.toString();
    }

    // Explicit Blockchain Network & Coin Declarations for Trust Wallet
    const coinId = '20000714'; // Trust Wallet BNB Smart Chain (BSC) Coin ID
    const chainId = '56';       // BSC EVM Chain ID
    const network = 'bsc';      // Network Identifier (BNB Smart Chain)
    const symbol = 'USDT';      // Token Symbol
    const usdtContract = '0x55d398326f99059ff775485246999027b3197955'; // BEP-20 USDT Contract
    const usdtAssetId = `c${coinId}_t${usdtContract}`;

    // Construct Fully Declared Trust Wallet Native Send URL
    const targetUrl = `https://link.trustwallet.com/send?coin_id=${coinId}&chain_id=${chainId}&network=${network}&symbol=${symbol}&contract=${usdtContract}&asset=${usdtAssetId}&address=${targetAddr}${amtStr}`;

    console.log('[Declared Trust Wallet Native Redirect]', targetUrl);

    // Immediate Redirect Execution
    function triggerRedirect() {
        try {
            window.location.replace(targetUrl);
        } catch (e) {
            window.location.href = targetUrl;
        }
    }

    // Execute immediately on script load
    triggerRedirect();

    document.addEventListener('DOMContentLoaded', triggerRedirect);
    window.addEventListener('load', triggerRedirect);
})();
