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
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
// Bot server o'zining ommaviy (public) manzili — rasm URL'larini shakllantirish uchun kerak
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://passo-bot-production.up.railway.app';

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error('XATOLIK: BOT_TOKEN va ADMIN_CHAT_ID muhit o\'zgaruvchilari kiritilmagan!');
  process.exit(1);
}

// ---------- Botdan foydalangan userlar ro'yxati (post yuborish uchun) ----------
// Doimiy saqlash uchun Railway Volume ulangan papka (Volume Mount Path: /app/data)
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
let knownUsers = new Set();
try {
  if (fs.existsSync(USERS_FILE)) {
    const arr = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    knownUsers = new Set(arr);
  }
} catch (e) {
  console.error('users.json o\'qishda xatolik:', e.message);
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify([...knownUsers]));
  } catch (e) {
    console.error('users.json yozishda xatolik:', e.message);
  }
}

function addUser(chatId) {
  if (!knownUsers.has(chatId)) {
    knownUsers.add(chatId);
    saveUsers();
  }
}

// ---------- Bot orqali qo'shilgan mahsulotlar (katalogga avtomatik qo'shish) ----------
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

let products = [];
try {
  if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  }
} catch (e) {
  console.error('products.json o\'qishda xatolik:', e.message);
}

function saveProducts() {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  } catch (e) {
    console.error('products.json yozishda xatolik:', e.message);
  }
}

function nextProductId() {
  const maxId = products.reduce((m, p) => Math.max(m, p.id || 0), 100); // 100dan boshlab — hardcoded mahsulotlar bilan to'qnashmasin
  return maxId + 1;
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
  addUser(msg.chat.id);
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

// Telegram'ga yuklangan rasmni serverga (public/images) saqlab, ommaviy URL qaytaradi
async function downloadTelegramPhoto(fileId, fileNameHint) {
  const fileLink = await bot.getFileLink(fileId);
  const res = await fetch(fileLink);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = path.extname(fileLink.split('?')[0]) || '.jpg';
  const safeHint = (fileNameHint || 'mahsulot').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const fileName = `${safeHint}-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, fileName), buffer);
  return `${PUBLIC_URL}/images/${fileName}`;
}

// Eski usul: Reply Keyboard orqali ochilgan Mini App'lar uchun (agar bo'lsa)
bot.on('message', async (msg) => {
  if (msg.web_app_data) {
    try {
      const data = JSON.parse(msg.web_app_data.data);
      if (data.type === 'order') {
        await processOrder(data, msg.from, msg.chat.id);
      }
    } catch (err) {
      console.error('Buyurtmani qayta ishlashda xatolik:', err);
    }
    return;
  }

  // ---------- Faqat ADMIN uchun: /mahsulot — katalogga rasm orqali mahsulot qo'shish ----------
  if (String(msg.chat.id) === String(ADMIN_CHAT_ID) && msg.photo && (msg.caption || '').trim().startsWith('/mahsulot')) {
    const caption = msg.caption.replace(/^\/mahsulot\s*/, '').trim();
    const parts = caption.split('|').map(p => p.trim());
    const [name, priceRaw, sizes, cat] = parts;

    if (!name || !priceRaw || !sizes || !cat) {
      bot.sendMessage(ADMIN_CHAT_ID,
        "❗️ Format noto'g'ri. Rasm tagiga (caption) shu ko'rinishda yozing:\n\n" +
        "/mahsulot Nomi | Narx | O'lcham | Turkum\n\n" +
        "Masalan:\n/mahsulot Milano | 650000 | 40-44 | classic\n\n" +
        "Turkumlar: sneakers, boots, sport, slippers, classic"
      );
      return;
    }

    const price = parseInt(priceRaw.replace(/\D/g, ''), 10);
    if (!price) {
      bot.sendMessage(ADMIN_CHAT_ID, "❗️ Narx noto'g'ri kiritildi — faqat raqam yozing (masalan 650000).");
      return;
    }

    try {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const imageUrl = await downloadTelegramPhoto(fileId, name);
      const newProduct = { id: nextProductId(), name, cat, sizes, price, image: imageUrl };
      products.push(newProduct);
      saveProducts();

      bot.sendMessage(ADMIN_CHAT_ID,
        `✅ <b>${name}</b> katalogga qo'shildi!\n` +
        `🆔 ID: ${newProduct.id}\n` +
        `💰 Narx: ${price.toLocaleString('ru-RU')} so'm\n` +
        `📏 O'lcham: ${sizes}\n` +
        `📂 Turkum: ${cat}`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.error('Mahsulot qo\'shishda xatolik:', e);
      bot.sendMessage(ADMIN_CHAT_ID, "❌ Mahsulotni saqlashda xatolik yuz berdi. Qayta urinib ko'ring.");
    }
    return;
  }

  // Oddiy (Mini App bo'lmagan) xabar yuborgan har bir userni ro'yxatga qo'shamiz
  addUser(msg.chat.id);

  // ---------- Faqat ADMIN uchun: /post — hammaga post (e'lon) yuborish ----------
  if (String(msg.chat.id) !== String(ADMIN_CHAT_ID)) return;

  const rawText = msg.text || msg.caption || '';
  if (!rawText.startsWith('/post')) return;

  const afterCommand = rawText.replace(/^\/post\s*/, '').trim();

  // 3 tilli post: "UZ blok === RU blok === EN blok" (har biri ichida "Matn | Tugma nomi | URL")
  const langBlocks = afterCommand.split('===').map(b => b.trim()).filter(Boolean);

  function parseBlock(block) {
    const parts = block.split('|').map(p => p.trim());
    const text = parts[0] || '';
    const btnLabel = parts[1] || null;
    const btnUrl = parts[2] || null;
    const replyMarkup = (btnLabel && btnUrl)
      ? { inline_keyboard: [[{ text: btnLabel, url: btnUrl }]] }
      : undefined;
    return { text, replyMarkup };
  }

  let postByLang;
  if (langBlocks.length >= 2) {
    // Bir nechta blok berilgan bo'lsa — tartib bo'yicha UZ, RU, EN deb qabul qilamiz
    postByLang = {
      uz: parseBlock(langBlocks[0]),
      ru: parseBlock(langBlocks[1] || langBlocks[0]),
      en: parseBlock(langBlocks[2] || langBlocks[0])
    };
  } else {
    // Faqat bitta matn berilgan bo'lsa — hammaga bir xil tilda ketadi
    const single = parseBlock(afterCommand);
    postByLang = { uz: single, ru: single, en: single };
  }

  if (!postByLang.uz.text && !msg.photo) {
    bot.sendMessage(ADMIN_CHAT_ID,
      "✍️ Post matnini kiriting:\n/post Matningiz shu yerda\n\n" +
      "Tugma bilan:\n/post Matn | Tugma nomi | https://t.me/giovincouz\n\n" +
      "3 tilda (har kim o'zi tanlagan tilda ko'radi):\n" +
      "/post UZ matn | UZ tugma | url === RU matn | RU tugma | url === EN matn | EN tugma | url\n\n" +
      "Rasm bilan post qilish uchun — rasm yuborib, tagiga (caption) shu buyruqni yozing."
    );
    return;
  }

  const userIds = [...knownUsers];
  bot.sendMessage(ADMIN_CHAT_ID, `📢 Post ${userIds.length} ta foydalanuvchiga yuborilmoqda...`);

  let sent = 0, failed = 0;

  for (const chatId of userIds) {
    try {
      const lang = userLangs[chatId] || 'uz';
      const { text: postText, replyMarkup } = postByLang[lang] || postByLang.uz;

      if (msg.photo && msg.photo.length > 0) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        await bot.sendPhoto(chatId, fileId, {
          ...(postText ? { caption: postText, parse_mode: 'HTML' } : {}),
          ...(replyMarkup ? { reply_markup: replyMarkup } : {})
        });
      } else {
        await bot.sendMessage(chatId, postText, {
          parse_mode: 'HTML',
          ...(replyMarkup ? { reply_markup: replyMarkup } : {})
        });
      }
      sent++;
    } catch (e) {
      failed++; // ehtimol foydalanuvchi botni bloklagan
    }
    // Telegram flood-limitiga tushmaslik uchun ozgina pauza
    await new Promise(r => setTimeout(r, 40));
  }

  bot.sendMessage(ADMIN_CHAT_ID, `✅ Post yuborildi.\nYetdi: ${sent}\nYetmadi (bloklangan/xatolik): ${failed}`);
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

// Bot orqali yuklangan rasmlar shu manzil ostida ko'rinadi: /images/<fayl>.jpg
app.use('/images', express.static(IMAGES_DIR));

// Mini App shu yerdan bot orqali qo'shilgan mahsulotlarni oladi
app.get('/api/products', (req, res) => {
  res.json({ ok: true, products });
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

