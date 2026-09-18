/**
 * GIOVINCO — Telegram bot backend
 * -----------------------------
 * Bu skript ikkita vazifani bajaradi:
 * 1) Telegram bot sifatida ishlaydi (/start buyrug'i)
 * 2) Kichik web-server sifatida ishlaydi — Mini App'dan (passo-miniapp.html)
 *    kelgan buyurtmalarni internet orqali qabul qilib, ADMIN_CHAT_ID'ga
 *    (ya'ni sizga) to'liq ma'lumot — jumladan mijoz yozgan IZOH bilan
 *    birga — xabar qilib yuboradi.
 *
 * Buyurtma qanday tugma orqali ochilishidan qat'iy nazar (Menu Button,
 * inline tugma, va h.k.) ishlaydi — Telegram'ning sendData cheklovidan
 * mustaqil.
 *
 * O'RNATISH:
 *   1) npm init -y
 *   2) npm install node-telegram-bot-api express
 *   3) Railway'da BOT_TOKEN va ADMIN_CHAT_ID muhit o'zgaruvchilarini kiriting
 *   4) node passo-bot.js
 *
 * ADMIN_CHAT_ID'ni qanday topish mumkin:
 *   Telegram'da @userinfobot'ga /start yozing — u sizga "Id" raqamingizni
 *   ko'rsatadi (masalan 123456789). Shu raqamni pastga qo'ying.
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error('XATOLIK: BOT_TOKEN va ADMIN_CHAT_ID muhit o\'zgaruvchilari kiritilmagan!');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Har bir foydalanuvchi tanlagan tilni vaqtincha xotirada saqlab turamiz
// (server qayta ishga tushsa, tozalanadi — bu oddiy yechim)
const userLangs = {};

const HERO_IMAGE_URL = 'https://raw.githubusercontent.com/tayvanchik/GIOVINCO1/main/GIOVINCOO.jpg';
const MINI_APP_URL = 'https://tayvanchik.github.io/GIOVINCO1/';

const WELCOME_TEXTS = {
  uz:
    "Bu <b>GIOVINCO</b> — erkaklar oyoq kiyimlari.\n\n" +
    "Sizga yoqqan modelni tanlaysiz — biz esa buyurtmangiz asosida olib kelamiz.\n\n" +
    "✅ Sifatli mahsulotlar\n" +
    "✅ Zamonaviy modellar\n" +
    "✅ Turli xil razmerlar\n" +
    "✅ Buyurtma asosida olib kelish\n\n" +
    "Siz tanlang — biz olib kelamiz.\n\n" +
    "Kerakli modelni tanlang va buyurtma berish uchun pastdagi tugmani bosing 👇",
  ru:
    "Это <b>GIOVINCO</b> — мужская обувь.\n\n" +
    "Вы выбираете понравившуюся модель — мы доставляем по вашему заказу.\n\n" +
    "✅ Качественная продукция\n" +
    "✅ Современные модели\n" +
    "✅ Разные размеры\n" +
    "✅ Доставка под заказ\n\n" +
    "Выбирайте вы — привезём мы.\n\n" +
    "Выберите нужную модель и нажмите кнопку ниже, чтобы сделать заказ 👇",
  en:
    "This is <b>GIOVINCO</b> — men's footwear.\n\n" +
    "You pick the model you like — we deliver it to you.\n\n" +
    "✅ Quality products\n" +
    "✅ Modern models\n" +
    "✅ Various sizes\n" +
    "✅ Made-to-order delivery\n\n" +
    "You choose — we deliver.\n\n" +
    "Pick the model you want and tap the button below to place your order 👇"
};

const OPEN_SHOP_BTN = {
  uz: "🛍 Do'konni ochish",
  ru: "🛍 Открыть магазин",
  en: "🛍 Open shop"
};

// /start — avval til tanlash tugmalari chiqadi
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🌐 Tilni tanlang / Выберите язык / Choose language:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" }],
        [{ text: "🇷🇺 Русский", callback_data: "lang_ru" }],
        [{ text: "🇬🇧 English", callback_data: "lang_en" }]
      ]
    }
  });
});

// Til tanlangandan keyin — shu tilda xush kelibsiz xabarini yuboramiz
bot.on('callback_query', async (query) => {
  const data = query.data;
  if (!data || !data.startsWith('lang_')) return;

  const lang = data.replace('lang_', ''); // uz | ru | en
  const chatId = query.message.chat.id;
  userLangs[chatId] = lang;

  bot.answerCallbackQuery(query.id).catch(() => {});

  const caption = WELCOME_TEXTS[lang] || WELCOME_TEXTS.uz;
  const options = {
    caption,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{
        text: (OPEN_SHOP_BTN[lang] || OPEN_SHOP_BTN.uz),
        web_app: { url: MINI_APP_URL }
      }]]
    }
  };

  if (HERO_IMAGE_URL) {
    bot.sendPhoto(chatId, HERO_IMAGE_URL, options).catch(() => {});
  } else {
    bot.sendMessage(chatId, caption, options).catch(() => {});
  }
});

// Yandex yoki Google Maps havolasidan koordinatalarni (kenglik, uzunlik) ajratib olish
function parseMapLink(url) {
  try {
    const decoded = decodeURIComponent(url);
    // Yandex: ll=UZUNLIK,KENGLIK
    let m = decoded.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
    // Yandex: whatshere[point]=UZUNLIK,KENGLIK
    m = decoded.match(/point\]?=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
    // Google: @KENGLIK,UZUNLIK
    m = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
    // Google: q=KENGLIK,UZUNLIK
    m = decoded.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  } catch (e) {}
  return null;
}

// Agar havolada koordinata to'g'ridan-to'g'ri ko'rinmasa (masalan kompyuterdan
// tashlangan "tashkilot" havolasi), sahifaning o'zini ochib, ichidan
// koordinatalarni qidiramiz.
async function resolveCoordinatesFromLink(url) {
  const direct = parseMapLink(url);
  if (direct) return direct;

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000)
    });

    // Ba'zan sahifa qayta yo'naltirilgandan keyingi manzilning o'zida koordinata bo'ladi
    if (res.url) {
      const fromFinalUrl = parseMapLink(res.url);
      if (fromFinalUrl) return fromFinalUrl;
    }

    const html = await res.text();

    // Sahifa ichidagi "latitude"/"longitude" maydonlari (schema.org ma'lumotlari)
    const latM = html.match(/"latitude"\s*:\s*"?(-?\d+\.\d+)"?/);
    const lonM = html.match(/"longitude"\s*:\s*"?(-?\d+\.\d+)"?/);
    if (latM && lonM) return { lat: parseFloat(latM[1]), lon: parseFloat(lonM[1]) };

    // Sahifa ichida ko'milgan ll=UZUNLIK,KENGLIK (statik xarita rasmi manzilida bo'lishi mumkin)
    const llM = html.match(/ll=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) || html.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llM) return { lon: parseFloat(llM[1]), lat: parseFloat(llM[2]) };

  } catch (err) {
    console.error('Lokatsiya havolasini ochishda xatolik:', err.message);
  }
  return null;
}

async function processOrder(data, customer, replyChatId) {
  const customerName = customer?.first_name || data.address?.name || 'Mijoz';
  const customerUsername = customer?.username ? `@${customer.username}` : (data.source === 'website' ? 'sayt orqali' : "username yo'q");
  const customerProfileLink = customer?.username
    ? `https://t.me/${customer.username}`
    : (customer?.id ? `tg://user?id=${customer.id}` : null);
  const customerNameLinked = customerProfileLink
    ? `<a href="${customerProfileLink}">${customerName}</a>`
    : customerName;

  let total = 0;
  let itemsText = '';

  data.items.forEach((item, i) => {
    const lineTotal = item.price * item.qty;
    total += lineTotal;
    itemsText += `\n${i + 1}. 👟 <b>${item.name}</b>\n`;
    itemsText += `   O'lcham: ${item.size}   Soni: ${item.qty}\n`;
    itemsText += `   Narx: ${item.price.toLocaleString('ru-RU')} so'm\n`;
    if (item.comment && item.comment.trim() !== '') {
      itemsText += `   💬 <b>Izoh:</b> ${item.comment}\n`;
    }
  });

  let addressText = '';
  if (data.address && (data.address.name || data.address.phone || data.address.address)) {
    addressText += `\n📍 <b>Yetkazib berish ma'lumoti:</b>\n`;
    if (data.address.name) addressText += `   Ism: ${data.address.name}\n`;
    if (data.address.phone) addressText += `   Tel: ${data.address.phone}\n`;
    if (data.address.address) addressText += `   Manzil: ${data.address.address}\n`;
  }

  const sourceTag = data.source === 'website' ? `\n🌐 Manba: Veb-sayt` : '';

  const adminMessage =
    `🆕 <b>Yangi buyurtma — GIOVINCO</b>\n` +
    `👤 Mijoz: ${customerNameLinked} (${customerUsername})\n` +
    (replyChatId ? `🆔 Chat ID: <code>${replyChatId}</code>\n` : '') +
    sourceTag +
    itemsText +
    addressText +
    `\n💰 <b>Jami: ${total.toLocaleString('ru-RU')} so'm</b>`;

  // Admin (siz)ga yuboriladi
  bot.sendMessage(ADMIN_CHAT_ID, adminMessage, { parse_mode: 'HTML' });

  // Lokatsiya bo'lsa — haqiqiy Telegram pin (joylashuv) sifatida alohida yuboriladi
  if (data.address && data.address.location) {
    const coords = await resolveCoordinatesFromLink(data.address.location);
    if (coords) {
      bot.sendLocation(ADMIN_CHAT_ID, coords.lat, coords.lon).catch(() => {});
    } else {
      // koordinatalarni ajratib bo'lmasa, havolani matn sifatida yuboramiz
      bot.sendMessage(ADMIN_CHAT_ID, `🗺 Lokatsiya havolasi: ${data.address.location}`).catch(() => {});
    }
  }

  // Mijozga tasdiq xabari (agar chat ID mavjud bo'lsa)
  if (replyChatId) {
    bot.sendMessage(replyChatId, "✅ Buyurtmangiz qabul qilindi! Tez orada operatorimiz siz bilan bog'lanadi.")
      .catch(() => {}); // agar mijoz botni bloklagan bo'lsa, xatolikni e'tiborsiz qoldiramiz
  }
}

// Eski usul: Reply Keyboard orqali ochilgan Mini App'lar uchun (agar bo'lsa)
bot.on('message', async (msg) => {
  if (!msg.web_app_data) return;
  try {
    const data = JSON.parse(msg.web_app_data.data);
    if (data.type !== 'order') return;
    await processOrder(data, msg.from, msg.chat.id);
  } catch (err) {
    console.error('Buyurtmani qayta ishlashda xatolik:', err);
  }
});

// ---------- Web-server (Mini App'dan to'g'ridan-to'g'ri kelgan buyurtmalar uchun) ----------
const app = express();
app.use(express.json());

// CORS — Netlify saytidan so'rov yuborishga ruxsat berish
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => {
  res.send('GIOVINCO bot server ishlayapti.');
});

app.post('/api/order', (req, res) => {
  try {
    const { items, address, user } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: "Mahsulotlar ro'yxati bo'sh" });
    }
    // Mijozga tezroq javob qaytarish uchun, buyurtmani fonda qayta ishlaymiz
    processOrder({ items, address }, user, user?.id).catch(err => {
      console.error('API orqali buyurtmani qayta ishlashda xatolik:', err);
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('API orqali buyurtmani qayta ishlashda xatolik:', err);
    res.status(500).json({ ok: false, error: 'Server xatoligi' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GIOVINCO server ${PORT}-portda ishga tushdi...`);
});

console.log('GIOVINCO bot ishga tushdi...');

