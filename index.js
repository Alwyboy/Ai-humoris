import express from "express";
import fetch from "node-fetch";

const app = express();

// Memori percakapan sementara (user → history chat)
const conversationHistory = {};

/**
 * Panggil Gemini API dengan gaya "teman humoris & pintar"
 */
async function askGemini(userId, userInput) {
  // Ambil history lama (jika ada)
  const history = conversationHistory[userId] || [];

  // Gabungkan history jadi konteks
  const context = history
    .map((h, i) => `${h.role === "user" ? "User" : "Bot"}: ${h.text}`)
    .join("\n");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Kamu adalah teman pintar, asyik, informatif. 
Gunakan bahasa santai + sedikit bercanda, maksimal 2 kalimat. 
Ingat percakapan sebelumnya. 

History:
${context}

Input user: ${userInput}`
              }
            ]
          }
        ]
      })
    }
  );

  const data = await response.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Simpan ke memori history
  if (!conversationHistory[userId]) conversationHistory[userId] = [];
  conversationHistory[userId].push({ role: "user", text: userInput });
  conversationHistory[userId].push({ role: "bot", text: reply });

  // Batasi history biar ga numpuk
  if (conversationHistory[userId].length > 10) {
    conversationHistory[userId] = conversationHistory[userId].slice(-10);
  }

  return reply;
}

/**
 * Endpoint Nightbot
 */
app.get("/", async (req, res) => {
  const userInput = req.query.q;
  const userId = req.query.user || "global"; // bisa pake nama user Nightbot

  if (!userInput) return res.send("❌ Ketik sesuatu setelah 'Nightbot'");

  try {
    let reply = await askGemini(userId, userInput);

    // Kalau terlalu panjang → ringkas
    if (reply.length > 400) {
      reply = await askGemini(
        userId,
        `Ringkas jawaban berikut jadi 1-3 kalimat:\n\n${reply}`
      );
    }

    // Bersihkan format
    reply = reply
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/#+/g, "")
      .replace(/\n+/g, " ")
      .trim();

    res.send(reply.substring(0, 400));
  } catch (err) {
    res.send("⚠️ Error: " + err.message);
  }
});

// Jalankan lokal
app.listen(3000, () => {
  console.log("✅ Server jalan di http://localhost:3000");
});
