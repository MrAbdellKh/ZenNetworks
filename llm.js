// On importe "spawn" pour lancer un processus externe (ici : Ollama CLI)
// et "sanitizeSQL" pour nettoyer/la sécuriser la requête SQL renvoyée par le LLM.
import { spawn } from 'child_process';
import { sanitizeSQL } from './utils/sanitize.js';

/**
 * Lance Ollama en CLI avec un modèle et un prompt, et retourne sa sortie texte.
 * @param {string} model - nom du modèle (ex : "gemma3")
 * @param {string} prompt - instruction qu’on envoie au LLM
 * @returns {Promise<string>} - sortie brute du LLM (texte)
 */
function runOllama(model, prompt) {
  // On crée et retourne une promesse parce que l'appel est asynchrone.
  return new Promise((resolve, reject) => {
    // Construction de l'argument de ligne de commande : ollama run <model> <prompt>
    const args = ['run', model, prompt];

    // On lance le binaire "ollama" avec les arguments.
    // stdio : on ignore stdin, on capture stdout et stderr.
    const proc = spawn('ollama', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    // Variables pour accumuler les sorties au fur et à mesure qu'elles arrivent.
    let stdout = '';
    let stderr = '';

    // Quand Ollama écrit sur sa sortie standard, on l'ajoute à stdout.
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });

    // Quand Ollama écrit une erreur ou un avertissement, on l'ajoute à stderr.
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    // Quand le processus se termine...
    proc.on('close', (code) => {
      // Si le code de sortie est différent de zéro, c'est une erreur : on rejette.
      if (code !== 0) {
        return reject(new Error(`Ollama exited ${code} stderr=${stderr.trim()}`));
      }
      // Sinon on résout avec la sortie nettoyée (trim pour supprimer espaces en trop).
      resolve(stdout.trim());
    });

    // Si lancer le process échoue (ex : binaire introuvable), on rejette aussi.
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Génère une requête SQL à partir d'une question en langage naturel et d'un schéma.
 * @param {string} question - ce que l'utilisateur veut savoir ("Quel est le CA ?")
 * @param {string} schema - description du schéma de la base (tables, colonnes)
 * @returns {Promise<string>} - requête SQL propre (une ligne) ou chaîne vide si échec
 */
export async function generateSQLFromText(question, schema) {
  // On construit le prompt envoyé au LLM. On lui donne :
  // - le schéma,
  // - la question,
  // - des règles strictes pour n'avoir que la requête SQL.
  const promptSQL = `
Tu es un générateur SQL. Voici le schéma :
${schema}

Question : "${question}"

Règles :
- Répond uniquement avec une requête SQL valide.
- Pas de commentaires, pas d'explications, pas de guillemets autour.
- Pas d'opérations destructrices (DROP, DELETE, UPDATE, ALTER, TRUNCATE).
Donne la requête.
`.trim(); // trim() enlève les sauts de ligne inutiles au début/fin.

  try {
    // On appelle Ollama avec le modèle et le prompt, on attend sa réponse.
    const rawOutput = await runOllama('gemma3', promptSQL);

    // On nettoie la sortie brute : suppression de choses bizarres, sécurisation minimale.
    const cleaned = sanitizeSQL(rawOutput);

    // On découpe en lignes, on tronque chaque ligne, et on prend la première non vide.
    // C'est supposé être la requête SQL.
    const line = cleaned
      .split('\n')          // sépare par ligne
      .map(l => l.trim())   // enlève espaces au début/fin de chaque ligne
      .find(l => l.length > 0); // prend la première ligne qui n'est pas vide

    // Retourne la requête trouvée, ou chaîne vide si rien.
    return line || '';
  } catch (err) {
    // Si quelque chose a planté (Ollama indisponible, timeout, etc.), on logue et on retourne vide.
    console.error("Erreur génération SQL par LLM :", err.message);
    return '';
  }
}
