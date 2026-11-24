require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "requests.json");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readRequests() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return []; }
}
function saveRequests(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
}
let requests = readRequests();
const bundles = [
  { id: "500MB", label: "500 MB", price: "Choose on request" },
  { id: "1GB", label: "1 GB", price: "Choose on request" },
  { id: "2GB", label: "2 GB", price: "Choose on request" },
  { id: "5GB", label: "5 GB", price: "Choose on request" }
];

const token = process.env.TELEGRAM_BOT_TOKEN;
const ownerChatId = process.env.TELEGRAM_CHAT_ID;
let bot = null;

function ownerOnly(chatId) {
  return ownerChatId && String(chatId) === String(ownerChatId);
}
async function notifyOwner(message) {
  if (bot && ownerChatId) {
    try { await bot.sendMessage(ownerChatId, message); }
    catch (e) { console.error("Telegram notification failed:", e.message); }
  }
}
function findRequest(id) {
  return requests.find(r => r.id === String(id));
}
function requestSummary(r) {
  return `Request #${r.id}
Bundle: ${r.bundleLabel}
Phone: ${r.phone}
Lucky digits: ${r.luckyDigits}
Status: ${r.status}`;
}

app.get("/api/bundles", (req, res) => res.json(bundles));

app.post("/api/requests", async (req, res) => {
  const { phone, bundleId, luckyDigits } = req.body || {};
  const cleanPhone = String(phone || "").replace(/[\s-]/g, "");
  if (!/^\+?[0-9]{9,15}$/.test(cleanPhone))
    return res.status(400).json({ error: "Enter a valid phone number." });
  if (!/^\d{4}$/.test(String(luckyDigits || "")))
    return res.status(400).json({ error: "Lucky entry must contain exactly 4 digits." });
  const bundle = bundles.find(b => b.id === bundleId);
  if (!bundle) return res.status(400).json({ error: "Choose a listed bundle." });

  const r = {
    id: String(Date.now()),
    phone: cleanPhone,
    bundleId: bundle.id,
    bundleLabel: bundle.label,
    luckyDigits: String(luckyDigits),
    status: "pending",
    createdAt: new Date().toISOString(),
    retryAllowedAt: null
  };
  requests.unshift(r);
  saveRequests(requests);
  await notifyOwner(`🆕 GEOFRYLITE request received\n\n${requestSummary(r)}\n\nReply with /approve ${r.id} or /reject ${r.id}`);
  res.json({ id: r.id, status: r.status });
});

app.get("/api/requests/:id", (req, res) => {
  const r = findRequest(req.params.id);
  if (!r) return res.status(404).json({ error: "Request not found." });
  res.json({
    id: r.id, status: r.status, bundleLabel: r.bundleLabel,
    retryAllowedAt: r.retryAllowedAt
  });
});

app.post("/api/requests/:id/verify", (req, res) => {
  const r = findRequest(req.params.id);
  if (!r) return res.status(404).json({ error: "Request not found." });
  if (r.status !== "approved") return res.status(403).json({ error: "This request has not been approved." });
  const lastFour = String(req.body.lastFour || "");
  const phoneDigits = r.phone.replace(/\D/g, "");
  if (!/^\d{4}$/.test(lastFour) || phoneDigits.slice(-4) !== lastFour)
    return res.status(400).json({ error: "Those four digits do not match the phone number." });
  r.status = "verified-preview";
  saveRequests(requests);
  res.json({ ok: true, bundleLabel: r.bundleLabel });
});

app.post("/api/requests/:id/retry", async (req, res) => {
  const r = findRequest(req.params.id);
  if (!r) return res.status(404).json({ error: "Request not found." });
  if (r.status !== "verified-preview") return res.status(403).json({ error: "Complete the verification step first." });
  const now = Date.now();
  if (!r.retryAllowedAt || now < r.retryAllowedAt)
    return res.status(429).json({ error: "Please wait until the 60-second timer finishes." });
  r.status = "trial-requested";
  r.retryAllowedAt = null;
  saveRequests(requests);
  await notifyOwner(`🔁 GEOFRYLITE trial requested again\n\n${requestSummary(r)}`);
  res.json({ ok: true });
});

// Optional protected JSON admin view. Set ADMIN_PASSWORD in Render environment variables.
app.get("/api/admin/requests", (req, res) => {
  if (!process.env.ADMIN_PASSWORD || req.get("x-admin-password") !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: "Unauthorized." });
  res.json(requests);
});

if (token) {
  bot = new TelegramBot(token, { polling: true });
  bot.on("polling_error", e => console.error("Telegram polling error:", e.message));
  bot.on("message", async msg => {
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    if (!ownerOnly(chatId)) {
      return bot.sendMessage(chatId, "This bot is private. Ask the GEOFRYLITE administrator for access.");
    }
    if (text === "/start" || text === "/help") {
      return bot.sendMessage(chatId,
        "GEOFRYLITE admin commands:\n/pending - list pending requests\n/approve REQUEST_ID - approve\n/reject REQUEST_ID - reject\n/status REQUEST_ID - view status\n/help - show help");
    }
    if (text === "/pending") {
      const pending = requests.filter(r => r.status === "pending");
      return bot.sendMessage(chatId, pending.length
        ? pending.map(requestSummary).join("\n\n")
        : "No pending requests.");
    }
    const match = text.match(/^\/(approve|reject|status)\s+(\d+)$/);
    if (match) {
      const [, action, id] = match;
      const r = findRequest(id);
      if (!r) return bot.sendMessage(chatId, "Request not found.");
      if (action === "status") return bot.sendMessage(chatId, requestSummary(r));
      if (action === "approve") {
        r.status = "approved";
        r.retryAllowedAt = null;
        saveRequests(requests);
        await bot.sendMessage(chatId, `✅ Approved. Request #${id}`);
        return;
      }
      r.status = "rejected";
      saveRequests(requests);
      await bot.sendMessage(chatId, `❌ Rejected. Request #${id}. The user will see the rejected status.`);
      return;
    }
    bot.sendMessage(chatId, "Unknown command. Send /help for commands.");
  });
}

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`GEOFRYLITE running on port ${PORT}`));
