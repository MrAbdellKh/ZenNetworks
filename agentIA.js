import axios from 'axios';
import mysql from 'mysql2/promise';
import { RunnableSequence } from 'langchain/schema/runnable';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Génération SQL avec SQLCoder (Ollama)
async function getSQLFromLlama(question) {
  const response = await axios.post('http://localhost:11434/api/generate', {
    model: 'sqlcoder',
    prompt: question,
    stream: false
  });
  return response.data.response;
}

// Exécution SQL pour SQLite
async function executeSQL(sql) {
  // Ouvre la base (adapte le chemin si besoin)
  const db = await open({
    filename: './ma_base.sqlite', // Mets ici le chemin de ta base
    driver: sqlite3.Database
  });
  const rows = await db.all(sql);
  await db.close();
  return rows;
}

// Analyse multi-critères d’anomalies
function analyzeAnomalies(rows) {
  if (rows.length === 0) return '✅ Aucun comportement anormal détecté.';
  let anomalies = [];
  rows.forEach(row => {
    if (row.nb_connexions && row.nb_connexions > 100) {
      anomalies.push(`⚠️ Trop de connexions (${row.nb_connexions})`);
    }
    if (row.status && row.status === 'banni') {
      anomalies.push('⚠️ Utilisateur banni détecté');
    }
    // Ajoute d'autres critères ici
  });
  if (anomalies.length === 0) return '✅ Aucun comportement anormal détecté.';
  return anomalies.join('\n');
}

// Orchestration avec LangChain.js
const getSQL = async (input) => await getSQLFromLlama(input.question);
const runSQL = async (input) => await executeSQL(input.sql);
const analyze = async (input) => analyzeAnomalies(input.rows);

const chain = RunnableSequence.from([
  async (input) => ({ ...input, sql: await getSQL(input) }),
  async (input) => ({ ...input, rows: await runSQL(input) }),
  async (input) => ({ ...input, analysis: await analyze(input) }),
]);

async function agentIA(question) {
  const result = await chain.invoke({ question });
  return {
    question: result.question,
    sql: result.sql,
    rows: result.rows,
    analysis: result.analysis
  };
}

// Exemple d'utilisation
test();
async function test() {
  const question = "Détecter si l'utilisateur X contient une anomalie";
  const result = await agentIA(question);
  console.log('Question :', result.question);
  console.log('SQL généré :', result.sql);
  console.log('Résultat SQL :', result.rows);
  console.log('Analyse IA :', result.analysis);
} 