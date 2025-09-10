// index.js
import express from "express";
import fetch from "node-fetch";

const app = express();

// ===== GEMINI =====
async function askGemini(userInput) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    process.env.GEMINI_API_KEY;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Kamu adalah chatbot ramah di live chat YouTube.
Jawablah singkat, santai, informatif, sedikit humor, maksimal 2 kalimat.
Input user: ${userInput}`
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "<no body>");
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.output ||
    ""
  );
}

// ===== GROQ =====
async function askGroq(userInput) {
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content:
          "Kamu adalah chatbot ramah untuk live chat YouTube. Jawablah singkat, santai, informatif, dengan sedikit humor, maksimal 2 kalimat."
      },
      { role: "user", content: userInput }
    ],
    max_tokens: 200,
    temperature: 0.6
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "<no body>");
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return (
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "Maaf, aku bingung 😅"
  );
}

// ===== Nightbot Endpoint =====
app.get("/", async (req, res) => {
  const userInput = req.query.prompt || req.query.q;
  if (!userInput) return res.send("katakan sesuatu setelah ketik halo <isi chat>");

  try {
    let reply;

    try {
      // Coba pakai Gemini dulu
      reply = await askGemini(userInput);
    } catch (err) {
      console.error("Gemini gagal, fallback ke Groq:", err.message);
      reply = await askGroq(userInput);
    }

    // Bersihkan teks & batasi
    reply = reply
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/#+/g, "")
      .replace(/\n+/g, " ")
      .trim();

    // Max 400 karakter (batas Nightbot / YouTube)
    if (reply.length > 400) reply = reply.slice(0, 397) + "...";

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
