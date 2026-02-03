// globals.js

// Domínio base do webhook
//export const DOMINIO =    'https://webhook.lglducci.com.br/webhook/';
export const DOMINIO = 'https://webhook-homolog.lglducci.com.br/webhook/'     
/**
 * Função helper para gerar URLs completas de webhooks
 * @param {string} path - Caminho do webhook (ex: 'consultasaldo')
 * @param {object} params - Objeto de parâmetros de query (ex: {inicio: '2025-11-01', fim: '2025-11-18'})
 * @returns {string} - URL completa
 */
export function buildWebhookUrl(path, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  return `${DOMINIO}${path}${queryString ? '?' + queryString : ''}`;
}
