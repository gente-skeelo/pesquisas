/**
 * Lixeira da biblioteca, direto no armazém (modo arquivo): o excluído persiste
 * marcado, restaurar limpa a marca e a limpeza por prazo apaga só o vencido.
 */
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DADOS_DIR = join(tmpdir(), 'quiz-lixeira-' + Date.now());
process.env.DATABASE_URL = '';

const armazem = await import('../armazem.js');
const ARQ = join(process.env.DADOS_DIR, 'quizzes.json');
const noArquivo = () => JSON.parse(readFileSync(ARQ, 'utf8'));

let falhas = 0;
const conferir = (d, ok, det = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${d}${!ok && det ? ` — ${det}` : ''}`);
  if (!ok) falhas++;
};

console.log('\nLixeira (armazém em arquivo)');
await armazem.iniciar();
const carta = { correta: 0, segundos: 20, pt: { enunciado: 'x?', opcoes: ['a', 'b', 'c', 'd'] } };
const a = await armazem.salvar({ titulo: 'A', cartas: [carta] });
const b = await armazem.salvar({ titulo: 'B', cartas: [carta] });

conferir('excluir devolve true', await armazem.excluir(a.id));
conferir('excluir de novo devolve false', !(await armazem.excluir(a.id)));
conferir('some do menu', armazem.listar().every((q) => q.id !== a.id));
conferir('aparece na lixeira', armazem.listarLixeira().some((q) => q.id === a.id));
conferir('pegar ignora quem está na lixeira', armazem.pegar(a.id) === null);
conferir('arquivo guarda a marca excluidoEm',
         noArquivo().some((q) => q.id === a.id && typeof q.excluidoEm === 'string'));
conferir('excluirDeVez recusa quem não está na lixeira', !(await armazem.excluirDeVez(b.id)));
conferir('restaurar quem não está na lixeira devolve false', !(await armazem.restaurar(b.id)));

conferir('restaurar devolve true', await armazem.restaurar(a.id));
conferir('restaurado volta ao menu', armazem.listar().some((q) => q.id === a.id));
conferir('arquivo perde a marca', noArquivo().every((q) => !('excluidoEm' in q)));

await armazem.excluir(a.id);
await armazem.excluir(b.id);
conferir('limpeza com prazo de 30 dias não apaga o recém-excluído', (await armazem.limparLixeira()) === 0);
conferir('limpeza com prazo zero apaga os vencidos', (await armazem.limparLixeira(0)) === 2);
conferir('vencidos somem do arquivo', noArquivo().every((q) => q.id !== a.id && q.id !== b.id));
conferir('lixeira vazia no fim', armazem.listarLixeira().length === 0);

console.log(falhas === 0 ? '\nLixeira ok.\n' : `\n${falhas} problema(s) na lixeira.\n`);
process.exit(falhas === 0 ? 0 : 1);
