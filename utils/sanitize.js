/**
 * Vérifie que la requête SQL ne contient pas d'opérations destructrices interdites.
 * @param {string} sql 
 * @returns {boolean}
 */
export function isSafeSQL(sql) {
  const forbidden = /\b(drop|delete|update|alter|truncate)\b/i;
  return !forbidden.test(sql);
}

/**
 * Nettoie et extrait la vraie requête SQL d'une sortie de LLM.
 * Enlève les fences Markdown, puis isole à partir du premier mot-clé SQL valide.
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeSQL(raw) {
  if (!raw || typeof raw !== 'string') return '';

  // 1. Supprimer les balises Markdown comme ```sql``` ou ```
  let cleaned = raw.replace(/```(sql)?/gi, '');

  // 2. Chercher la première requête SQL commençant par SELECT, WITH, INSERT, etc.
  const match = cleaned.match(/\b(SELECT|WITH|INSERT|REPLACE|UPDATE|DELETE)\b[\s\S]*/i);
  if (match) {
    cleaned = match[0];
  }

  // 3. Trim et retourner
  return cleaned.trim();
}
