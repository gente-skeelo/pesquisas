/**
 * Biblioteca de quizzes — persistência.
 *
 * Com DATABASE_URL (o Postgres que já existe no projeto Railway), os quizzes
 * sobrevivem a redeploy. Sem ela, cai num arquivo JSON local — bom pra rodar
 * na máquina, mas no Railway o arquivo se perde a cada deploy.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { BARALHO } from './baralho.js';

const DIR = process.env.DADOS_DIR || './dados';
const ARQ = join(DIR, 'quizzes.json');

const DIAS_NA_LIXEIRA = 30;      // depois disso o quiz some de vez

let pool = null;                 // conexão Postgres, quando houver
const quizzes = new Map();       // id -> quiz, sempre espelhado em memória
                                 // (os da lixeira ficam aqui também, com excluidoEm)

const naLixeira = (q) => Boolean(q.excluidoEm);

export async function iniciar() {
  const url = process.env.DATABASE_URL || '';

  if (url) {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({
      connectionString: url,
      // a rede interna do Railway não fala TLS; o proxy público fala
      ssl: /railway\.internal/.test(url) ? false : { rejectUnauthorized: false },
    });
    await pool.query(
      'CREATE TABLE IF NOT EXISTS quizzes (id text PRIMARY KEY, dados jsonb NOT NULL)',
    );
    const r = await pool.query('SELECT dados FROM quizzes');
    for (const linha of r.rows) quizzes.set(linha.dados.id, linha.dados);
  } else if (existsSync(ARQ)) {
    for (const q of JSON.parse(readFileSync(ARQ, 'utf8'))) quizzes.set(q.id, q);
  }

  if (!quizzes.size) {
    await salvar({
      titulo: 'Festas Juninas pelo mundo',
      emoji: '🌽',
      cartas: BARALHO,
    });
  }

  return pool ? 'postgres' : 'arquivo';
}

export function listar() {
  return [...quizzes.values()]
    .filter((q) => !naLixeira(q))
    .sort((a, b) => (b.atualizado || '').localeCompare(a.atualizado || ''))
    .map((q) => ({ id: q.id, titulo: q.titulo, emoji: q.emoji || '🎯', n: q.cartas.length }));
}

/** Quizzes na lixeira, do excluído mais recente pro mais antigo, com os dias que restam. */
export function listarLixeira() {
  const agora = Date.now();
  return [...quizzes.values()]
    .filter(naLixeira)
    .sort((a, b) => b.excluidoEm.localeCompare(a.excluidoEm))
    .map((q) => ({
      id: q.id,
      titulo: q.titulo,
      emoji: q.emoji || '🎯',
      n: q.cartas.length,
      excluidoEm: q.excluidoEm,
      diasRestantes: Math.max(0, Math.ceil(
        (Date.parse(q.excluidoEm) + DIAS_NA_LIXEIRA * 86400000 - agora) / 86400000,
      )),
    }));
}

/** Só quizzes ativos: o que está na lixeira não abre, não edita e não duplica. */
export function pegar(id) {
  const q = quizzes.get(id);
  return q && !naLixeira(q) ? q : null;
}

export async function salvar(bruto) {
  const quiz = {
    id: bruto.id || randomUUID(),
    titulo: bruto.titulo,
    emoji: bruto.emoji || '🎯',
    cores: bruto.cores,
    cartas: bruto.cartas,
    atualizado: new Date().toISOString(),
  };
  await gravar(quiz);
  return quiz;
}

/** Manda pra lixeira: o quiz some do menu, mas dá pra restaurar por 30 dias. */
export async function excluir(id) {
  const q = quizzes.get(id);
  if (!q || naLixeira(q)) return false;
  await gravar({ ...q, excluidoEm: new Date().toISOString() });
  return true;
}

export async function restaurar(id) {
  const q = quizzes.get(id);
  if (!q || !naLixeira(q)) return false;
  const { excluidoEm, ...vivo } = q;
  await gravar(vivo);
  return true;
}

/** Apaga de verdade. Só vale pra quem já está na lixeira. */
export async function excluirDeVez(id) {
  const q = quizzes.get(id);
  if (!q || !naLixeira(q)) return false;
  await apagar(id);
  return true;
}

/** Esvazia o que passou do prazo. Devolve quantos foram embora. */
export async function limparLixeira(dias = DIAS_NA_LIXEIRA) {
  const limite = Date.now() - dias * 86400000;
  const vencidos = [...quizzes.values()]
    .filter((q) => naLixeira(q) && Date.parse(q.excluidoEm) <= limite);
  for (const q of vencidos) await apagar(q.id);
  return vencidos.length;
}

async function gravar(quiz) {
  quizzes.set(quiz.id, quiz);
  if (pool) {
    await pool.query(
      'INSERT INTO quizzes (id, dados) VALUES ($1, $2) ' +
        'ON CONFLICT (id) DO UPDATE SET dados = $2',
      [quiz.id, quiz],
    );
  } else {
    gravarArquivo();
  }
}

async function apagar(id) {
  quizzes.delete(id);
  if (pool) await pool.query('DELETE FROM quizzes WHERE id = $1', [id]);
  else gravarArquivo();
}

function gravarArquivo() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(ARQ, JSON.stringify([...quizzes.values()], null, 2));
}
