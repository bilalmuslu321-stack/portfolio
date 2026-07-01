const TopluyoBOT = require('topluyo-bot');
const { Groq } = require('groq-sdk');
const { GoogleGenAI } = require('@google/genai');

// --- RENDER GÜVENLİK SİSTEMİNDEN ANAHTARLARI OTOMATİK ÇEKİYORUZ ---
// (Yani kodun içine açık açık key yazmıyoruz, Render panelinden okuyor)
const GROQ_KEY = process.env.GROQ_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;

const groq = new Groq({ apiKey: GROQ_KEY });
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
const SYSTEM_PROMPT = "Sen Topluyo platformunda çalışan eğlenceli, samimi ve biraz troll bir botsun. Cevaplarını kısa, öz ve net tut.";

async function getAIResponse(userMessage) {
    // 1. MOTOR: GROQ
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
        console.error("[HATA] Groq API hatası, Gemini'ye geçiliyor:", error.message);
    }

    // 2. MOTOR: GEMINI
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
        console.error("[HATA] Gemini API hatası, OpenRouter'a geçiliyor:", error.message);
    }

    // 3. MOTOR: OPENROUTER
    try {
        console.log("[AI] OpenRouter API tetikleniyor...");
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openrouter/auto-class-v1", // Otomatik en iyi ücretsiz modeli seçer
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
        console.error("[KRİTİK HATA] Tüm API servisleri çöktü!:", error.message);
    }

    return "Şu an beynim döndü kanka, hiçbir yapay zekaya ulaşamıyorum.";
}

// Botu Render üzerindeki token ile başlatıyoruz
const bot = TopluyoBOT(BOT_TOKEN);

bot.on('connected', function () {
    console.log('TopluyGPT_bot Sunucuya Başarıyla Bağlandı! ✅ Bot şu an aktif.');
});

bot.on('auth_problem', function () {
    console.error('❌ Bağlantı Reddedildi! Girdiğin Bot Tokenı geçersiz kanka.');
});

bot.on('message', async function (data) {
    if (data.action === 'post/add' && data.message && data.message.startsWith('!sor ')) {
        const soru = data.message.replace('!sor ', '');
        console.log(`[İSTEK] Soru geldi: ${soru}`);

        const aiCevap = await getAIResponse(soru);

        bot.post('/!api/post/add', {
            channel_id: data.channel_id,
            text: aiCevap
        }).then(res => {
            console.log('[BAŞARILI] Bot yanıtı gönderdi.');
        }).catch(err => {
            console.error('[HATA] Mesaj gönderilirken hata oluştu:', err.message);
        });
    }
});

bot.on('error', function (err) {
    console.error('WebSocket Hatası:', err.message);
});
