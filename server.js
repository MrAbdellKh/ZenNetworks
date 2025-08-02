import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import axios from 'axios';
import { generateSQLFromText } from './llm.js';
import { isSafeSQL, sanitizeSQL } from './utils/sanitize.js';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Chemin vers ta base SQLite
const dbPath = path.resolve('./ma_base.db');
let db;

// Schéma injecté dans les prompts pour que le LLM sache quelles tables existent
const dbSchema = `
Tables :
- users(id, name, email, created_at)
- orders(id, user_id, product, price, created_at)
`;

// Connexion à la base et démarrage HTTP
(async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(5000, () => {
      console.log('🚀 Serveur en écoute sur http://localhost:5000');
    });
  } catch (err) {
    console.error('❌ Erreur de connexion à la base :', err.message);
    process.exit(1);
  }
})();

/**
 * Point d'entrée Slack (slash command) - version sans analyse.
 * Flux :
 * 1. Ack immédiat (réponse 200) pour éviter timeout Slack.
 * 2. Génération SQL et exécution sur la base.
 * 3. Résultat brut envoyé sur Slack.
 */
app.post('/slack', async (req, res) => {
  const question = req.body?.text;
  const responseUrl = req.body?.response_url;

  if (!question || !responseUrl) {
    return res.status(400).json({
      status: 'error',
      message: 'Payload invalide : il faut `text` et `response_url`.'
    });
  }

  // 1. Ack immédiat (Slack attend réponse <3s)
  res.status(200).json({
    text: '✅ Reçu. Génération de la requête SQL...'
  });

  try {
    // 2. Générer la requête SQL via LLM
    const rawSQL = await generateSQLFromText(question, dbSchema);
    //console.log('🔍 Raw SQL from LLM:', rawSQL);

    // Nettoyer la requête
    const sql = sanitizeSQL(rawSQL);
    console.log('----------------✅ Cleaned SQL to execute:', sql);

    if (!sql) {
      await axios.post(responseUrl, {
        text: `❌ Échec : la requête SQL générée est vide ou invalide après nettoyage.\nRequête brute : \`${rawSQL}\``
      });
      return;
    }

    if (!isSafeSQL(sql)) {
      await axios.post(responseUrl, {
        text: `❌ Requête interdite détectée (DROP/DELETE/UPDATE/etc.) : \`${sql}\``
      });
      return;
    }

    // 3. Exécuter la requête SQL
    let result;
    try {
      result = await db.all(sql);
    } catch (dbErr) {
      console.error('Erreur exécution SQL :', dbErr.message);
      await axios.post(responseUrl, {
        text: `❌ Erreur lors de l'exécution de la requête SQL : \`${dbErr.message}\`\nRequête : \`${sql}\``
      });
      return;
    }

    // 4. Envoyer seulement le résultat brut
    await axios.post(responseUrl, {
      text: `Résultat pour : *${question}*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Requête SQL exécutée :*\n\`\`\`\n${sql}\n\`\`\``
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Résultat brut :*\n\`\`\`${JSON.stringify(result, null, 2)}\`\`\``
          }
        }
      ]
    });

  } catch (err) {
    console.error('Erreur pipeline Slack :', err);
    await axios.post(responseUrl, {
      text: `❌ Erreur interne pendant le traitement : ${err.message}`
    });
  }
});
