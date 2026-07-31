/**
 * Tradução automática das perguntas via API da Anthropic.
 *
 * Só funciona com ANTHROPIC_API_KEY no ambiente (no Railway: Variables).
 * Sem a chave, o editor continua aceitando tradução manual — o botão
 * apenas avisa que o recurso está desligado.
 */

import Anthropic from '@anthropic-ai/sdk';

const IDIOMAS = {
  en: { nome: 'inglês', codigo: 'English' },
  es: { nome: 'espanhol', codigo: 'Spanish (neutral Latin American)' },
};

/** As alternativas precisam sair na mesma ordem, senão o gabarito quebra. */
const ESQUEMA = {
  type: 'object',
  properties: {
    cartas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          enunciado: { type: 'string' },
          opcoes: { type: 'array', items: { type: 'string' } },
          curiosidade: { type: 'string' },
        },
        required: ['enunciado', 'opcoes', 'curiosidade'],
        additionalProperties: false,
      },
    },
  },
  required: ['cartas'],
  additionalProperties: false,
};

export const traducaoDisponivel = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * Traduz as cartas em português para o idioma pedido.
 * Devolve um array na mesma ordem, com { enunciado, opcoes[4], curiosidade }.
 */
export async function traduzir(cartas, idioma) {
  const alvo = IDIOMAS[idioma];
  if (!alvo) throw new Error('idioma não suportado');
  if (!traducaoDisponivel()) throw new Error('sem chave');

  const cliente = new Anthropic();

  const entrada = cartas.map((c) => ({
    enunciado: c.pt.enunciado,
    opcoes: c.pt.opcoes,
    curiosidade: c.pt.curiosidade || '',
  }));

  const resposta = await cliente.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: ESQUEMA },
    },
    system:
      `You translate quiz questions from Brazilian Portuguese into ${alvo.codigo}. ` +
      'Keep the exact same number of cards and, within each card, the exact same ' +
      'number of options in the exact same order — the answer key is an index, so ' +
      'reordering breaks the quiz. Translate naturally rather than literally, but ' +
      'never change which option is correct. Keep proper nouns, festival names and ' +
      'dish names in their original form when they have no common equivalent, adding ' +
      'a short gloss only if the meaning would be lost. Preserve an empty string for ' +
      'an empty "curiosidade".',
    messages: [
      {
        role: 'user',
        content: `Translate these quiz cards:\n\n${JSON.stringify(entrada, null, 2)}`,
      },
    ],
  });

  if (resposta.stop_reason === 'refusal') throw new Error('recusado');

  const bloco = resposta.content.find((b) => b.type === 'text');
  if (!bloco) throw new Error('resposta vazia');

  const saida = JSON.parse(bloco.text).cartas;
  if (!Array.isArray(saida) || saida.length !== cartas.length) {
    throw new Error('tradução veio com número de perguntas diferente');
  }
  saida.forEach((c, i) => {
    if (!Array.isArray(c.opcoes) || c.opcoes.length !== cartas[i].pt.opcoes.length) {
      throw new Error('tradução veio com número de alternativas diferente');
    }
  });

  return saida;
}
