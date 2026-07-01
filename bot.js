const TopluyoBOT = require('topluyo-bot');
const { Groq } = require('groq-sdk');
const { GoogleGenAI } = require('@google/genai');
const { HttpsProxyAgent } = require('https-proxy-agent');
const http = require('http');

// --- RENDER GÜVENLİK PANELİNDEN DEĞİŞKENLERİ ÇEKİYORUZ ---
const GROQ_KEY = process.env.GROQ_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;

const groq = new Groq({ apiKey: GROQ_KEY });
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
const SYSTEM_PROMPT = "Sen Topluyo platformunda çalışan eğlenceli, samimi ve biraz troll bir botsun. Cevaplarını kısa, öz ve net tut.";

// --- YAPAY ZEKA SORGULAMA MOTORU ---
async function getAIResponse(userMessage) {
    // 1. ŞANS: GROQ
    try {
        console.log("[AI] Groq API tetikleniyor...");
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userMessage }
            ]
        });
        if (chatCompletion.choices && chatCompletion.choices[0]) {
            return chatCompletion.choices[0].message.content;
        }
    } catch (error) {
        console.error("[HATA] Groq patladı, Gemini deneniyor:", error.message);
    }

    // 2. ŞANS: GEMINI
    try {
        console.log("[AI] Gemini API tetikleniyor...");
        const response = await ai.models.generateContent({
            contents: userMessage,
            config: { systemInstruction: SYSTEM_PROMPT }
        });
        if (response && response.text) {
            return response.text;
        }
    } catch (error) {
        console.error("[HATA] Gemini patladı, OpenRouter deneniyor:", error.message);
    }

    // 3. ŞANS: OPENROUTER
    try {
        console.log("[AI] OpenRouter API tetikleniyor...");
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openrouter/auto-class-v1",
                "messages": [
                    { "role": "system", "content": SYSTEM_PROMPT },
                    { "role": "user", "content": userMessage }
                ]
            })
        });
        const data = await response.json();
        if (data && data.choices && data.choices[0]) {
            return data.choices[0].message.content;
        }
    } catch (error) {
        console.error("[KRİTİK HATA] Tüm yapay zekalar çöktü!:", error.message);
    }

    return "Şu an beynim döndü kanka, hiçbir yapay zekaya ulaşamıyorum.";
}

// --- RENDER IP ENGELİNİ AŞMAK İÇİN PROXY AYARI ---
// Render'ın Frankfurt IP'sini gizlemek için araya aracı sunucu koyuyoruz
const proxyAgent = new HttpsProxyAgent('http://45.142.138.163:80'); 

// Botu token ve proxy ayarlarıyla ayağa kaldırıyoruz
const bot = TopluyoBOT(BOT_TOKEN, {
    ws: { agent: proxyAgent }
});

// --- BOT ETKİNLİKLERİ ---
bot.on('connected', function () {
    console.log('TopluyGPT_bot Sunucuya Başarıyla Bağlandı! ✅ Bot şu an aktif.');
});

bot.on('auth_problem', function () {
    console.error('❌ Bağlantı Reddedildi! Girdiğin BOT_TOKEN geçersiz kanka.');
});

bot.on('message', async function (data) {
    // Sohbet kanalına biri "!sor [mesaj]" yazarsa tetiklenir
    if (data.action === 'post/add' && data.message && data.message.startsWith('!sor ')) {
        const soru = data.message.replace('!sor ', '');
        console.log(`[İSTEK] Soru geldi: ${soru}`);

        const aiCevap = await getAIResponse(soru);

        bot.post('/!api/post/add', {
            channel_id: data.channel_id,
            text: aiCevap
        }).then(res => {
            console.log('[BAŞARILI] Yanıt kanala gönderildi.');
        }).catch(err => {
            console.error('[HATA] Mesaj gönderilemedi:', err.message);
        });
    }
});

bot.on('error', function (err) {
    console.error('WebSocket Bağlantı Hatası:', err.message);
});

// --- RENDER'I KANDIRAN SAHTE PORT DİNLEYİCİSİ ---
// Render'ın "Portumu bağlayamadım" diyerek deployu iptal etmesini engeller
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Topluyo Bot 7/24 Aktif Kanka!\n');
});

server.listen(PORT, () => {
    console.log(`[RENDER] Sahte web sunucusu ${PORT} portunda başarıyla çalışıyor.`);
});
