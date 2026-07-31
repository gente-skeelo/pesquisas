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

let pool = null;                 // conexão Postgres, quando houver
const quizzes = new Map();       // id -> quiz, sempre espelhado em memória

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
    .sort((a, b) => (b.atualizado || '').localeCompare(a.atualizado || ''))
    .map((q) => ({ id: q.id, titulo: q.titulo, emoji: q.emoji || '🎯', n: q.cartas.length }));
}

export const pegar = (id) => quizzes.get(id) || null;

export async function salvar(bruto) {
  const quiz = {
    id: bruto.id || randomUUID(),
    titulo: bruto.titulo,
    emoji: bruto.emoji || '🎯',
    cartas: bruto.cartas,
    atualizado: new Date().toISOString(),
  };
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
  return quiz;
}

export async function excluir(id) {
  if (!quizzes.delete(id)) return false;
  if (pool) await pool.query('DELETE FROM quizzes WHERE id = $1', [id]);
  else gravarArquivo();
  return true;
}

function gravarArquivo() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(ARQ, JSON.stringify([...quizzes.values()], null, 2));
}
