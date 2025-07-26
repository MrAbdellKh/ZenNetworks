import fetch from 'node-fetch';
import readline from 'readline';

export async function generateSQLFromText(userPrompt, dbSchema) {
  const prompt = `${dbSchema}
Question utilisateur : """${userPrompt}"""

Réponds uniquement avec la requête SQL valide.
Pas de texte, pas d'intro, pas de guillemets, pas de commentaire.`;

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sqlcoder",
      prompt: prompt,
      stream: true
    })
  });

  const rl = readline.createInterface({
    input: response.body,
    crlfDelay: Infinity,
  });

  let fullText = "";

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.response) {
        fullText += parsed.response;
      }
    } catch (err) {
      console.error("Erreur JSON stream :", err.message);
    }
  }

  return fullText.replace(/["`]+/g, '').trim();
}
