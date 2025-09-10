// index.js
import express from "express";
import fetch from "node-fetch";

const app = express();

// Simpan history obrolan sementara (in-memory)
let chatHistories = {}; // { username: [ {role, content}, ... ] }

/**
 * Fungsi untuk tanya Gemini
 */
async function askGemini(messages) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    process.env.GEMINI_API_KEY;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: messages })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "<no body>");
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  let reply =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.output ||
    "";

  return reply.trim();
}

/**
 * Endpoint untuk Nightbot
 */
app.get("/", async (req, res) => {
  const userInput = req.query.prompt || req.query.q;
  // Default "anon" kalau Nightbot nggak ngirim &user
  const username = req.query.user ? String(req.query.user).toLowerCase() : "anon";

  if (!userInput) {
    return res.send("❌ Cara pakai: ketik Nightbot <isi chatmu>");
  }

  try {
    // Inisialisasi history user
    if (!chatHistories[username]) chatHistories[username] = [];

    // Tambah pertanyaan user
    chatHistories[username].push({ role: "user", parts: [{ text: userInput }] });

    // Batasi history biar nggak kebanyakan
    if (chatHistories[username].length > 10) {
      chatHistories[username] = chatHistories[username].slice(-10);
    }

    // Tambahkan system prompt + history
    const messages = [
      {
        role: "user",
        parts: [
          {
            text: `Kamu adalah chatbot ramah di live chat YouTube. 
Jawablah singkat, santai, informatif, dengan sedikit humor kalau bisa. 
Maksimal 2 kalimat.`
          }
        ]
      },
      ...chatHistories[username]
    ];

    let reply = await askGemini(messages);

    if (!reply) reply = "Hmm... aku agak bingung jawabnya 😅";

    // Kalau terlalu panjang → ringkas
    if (reply.length > 400) {
      reply = await askGemini([
        {
          role: "user",
          parts: [
            {
              text: `Ringkas jawaban berikut jadi 1-2 kalimat singkat untuk live chat:\n\n${reply}`
            }
          ]
        }
      ]);
    }

    // Bersihkan format aneh
    reply = reply
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/#+/g, "")
      .replace(/\n+/g, " ")
      .trim();

    // Batasi 400 karakter
    reply = reply.substring(0, 400);

    // Simpan jawaban ke history
    chatHistories[username].push({ role: "model", parts: [{ text: reply }] });

    res.send(reply);
  } catch (err) {
    console.error("Handler error:", err);
    res.send("⚠️ Error: " + err.message);
  }
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});
