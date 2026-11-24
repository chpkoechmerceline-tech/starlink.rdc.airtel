GEOFRYLITE setup
1. Upload all files and the public folder to your GitHub repository.
2. In Render, create a Web Service from that repository.
3. Build command: npm install
4. Start command: npm start
5. Add environment variables in Render:
   TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN
   TELEGRAM_CHAT_ID = TELEGRAM_CHAT_ID
   ADMIN_PASSWORD = choose_a_long_private_password
6. Create a Telegram bot with @BotFather: send /newbot, follow prompts, copy its token.
7. Get your numeric Telegram chat ID using a trusted bot such as @userinfobot, then set it in Render.
8. In your new bot chat, send /start. Only the configured chat ID can run admin commands.
Commands: /start, /help, /pending, /approve REQUEST_ID, /reject REQUEST_ID, /status REQUEST_ID.

Important:
- Do not commit .env or paste bot token into GitHub.
- The app is a request/preview demo. It does not deliver mobile data; connect an authorized mobile-network provider API for real fulfillment.
- This simple JSON-file storage is suitable for testing only. Render's local filesystem may reset on redeploy/restart unless you attach a persistent disk or replace storage with a database.
- The 4-digit entry is not a password or OTP. Never ask users for passwords or one-time codes.
