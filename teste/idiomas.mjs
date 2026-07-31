/**
 * Confere que os dicionários de interface têm os mesmos idiomas e as mesmas
 * chaves. Sem isso, um idioma pela metade derruba a tela em tempo de execução.
 */
import { readFileSync } from 'node:fs';

const IDIOMAS = ['pt', 'en', 'es'];
let falhas = 0;

for (const arquivo of ['public/host.js', 'public/jogador.js']) {
  const fonte = readFileSync(arquivo, 'utf8');
  const bloco = fonte.match(/^const T = \{[\s\S]*?\n\};/m)[0];
  const chavesDe = (lang) => {
    const parte = bloco.split(`  ${lang}: {`)[1];
    if (!parte) return null;
    return [...parte.split('\n  },')[0].matchAll(/^    (\w+):/gm)].map((x) => x[1]);
  };

  const base = chavesDe('pt');
  for (const lang of IDIOMAS) {
    const chaves = chavesDe(lang);
    if (!chaves) {
      console.log(`  FALHA ${arquivo}: idioma "${lang}" não existe`);
      falhas++;
      continue;
    }
    const faltam = base.filter((k) => !chaves.includes(k));
    if (faltam.length) {
      console.log(`  FALHA ${arquivo} [${lang}]: faltam ${faltam.join(', ')}`);
      falhas++;
    } else {
      console.log(`  ok   ${arquivo} [${lang}]: ${chaves.length} chaves`);
    }
  }
}

console.log(falhas === 0 ? '\nIdiomas completos.\n' : `\n${falhas} problema(s) de idioma.\n`);
process.exit(falhas === 0 ? 0 : 1);
