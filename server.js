import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const dbPath = path.resolve('./ma_base.db');
let db;

// 🔁 Schéma SQL global (à réutiliser dans d'autres endpoints si besoin)
const dbSchema = `
Tu es un générateur SQL. Voici les tables disponibles :
- users(id, name, email, created_at)
- orders(id, user_id, product, price, created_at)

Ta mission : Génère uniquement une requête SQL correcte.
- Pas d'explication.
- Pas de blabla.
- Pas de guillemets autour du résultat.
- Pas de commentaires.

Le résultat attendu est une requête SQL pure, exécutable, comme :
SELECT * FROM users;
`;

// Fonction factice pour générer une requête SQL à partir d'une question
function generateSQLFromText(question, schema) {
  if (/user/i.test(question)) return 'SELECT * FROM users;';
  if (/order/i.test(question)) return 'SELECT * FROM orders;';
  return '';
}

// Connexion à la base SQLite
(async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(5000, () => {
      console.log('🚀 Serveur en écoute sur http://localhost:5000');
    });
  } catch (err) {
    console.error("❌ Erreur de connexion à la base :", err.message);
  }
})();

// Endpoint Slack
app.post('/slack', async (req, res) => {
  const question = req.body?.text;

  if (!question) {
    return res.status(400).json({
      status: 'error',
      message: 'La requête Slack ne contient pas de texte.'
    });
  }

  try {
    const sql = await generateSQLFromText(question, dbSchema);

    console.log('\n------------------------------------');
    console.log('📩 Question Slack :', question);
    console.log('📤 Requête SQL générée :', sql);
    console.log('------------------------------------');

    // 💥 Protection simple : rejet des requêtes dangereuses (DROP, DELETE, etc.)
    if (/drop|delete|update/i.test(sql)) {
      return res.status(403).json({
        status: 'error',
        message: 'Requête SQL interdite détectée (DROP, DELETE, etc.)'
      });
    }

    const result = await db.all(sql);
    res.json({ status: 'ok', sql, result });

  } catch (err) {
    console.error("❌ Erreur de traitement :", err.message);
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors du traitement de la requête',
      error: err.message
    });
  }
});
