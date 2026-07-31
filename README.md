# Quiz do Skee — centralizador de quizzes da Skeelo

App de quiz ao vivo estilo Kahoot: o apresentador projeta a tela grande, a galera joga
pelo celular via QR code. Vários quizzes ficam salvos numa biblioteca — dá pra criar,
editar e reapresentar quantas vezes quiser.

- **Jogadores:** `https://SEU-DOMINIO/`
- **Apresentador:** `https://SEU-DOMINIO/host?k=CHAVE_HOST`
- **Saúde:** `https://SEU-DOMINIO/api/saude`

## Como funciona

Node + Express + WebSocket, sem build step. A partida em andamento vive em memória
(um redeploy derruba a sala — não faça deploy durante o jogo). A **biblioteca de
quizzes** persiste:

- com `DATABASE_URL` definida → **Postgres** (tabela `quizzes`, criada sozinha);
- sem ela → arquivo `dados/quizzes.json` (bom localmente; no Railway se perde a cada deploy).

No primeiro boot com a biblioteca vazia, o quiz **Festas Juninas pelo mundo**
(15 perguntas, `baralho.js`) é semeado automaticamente.

### Fluxo do apresentador

1. **Central de quizzes** — cards com os quizzes salvos: ▶ Apresentar, Editar, Duplicar,
   ✕ Excluir, ou ＋ Novo quiz.
2. **Editor** — título, emoji, **paleta das alternativas** (5 presets ou 4 cores livres,
   com prévia e cor de texto calculada automaticamente pelo contraste) e as perguntas:
   enunciado, 4 alternativas (✓ marca a correta), tempo, curiosidade opcional e versões
   em **inglês e espanhol** — manuais ou por **tradução automática**. Sem tradução, a
   pergunta cai no português.
3. **Lobby** — **PIN de 6 dígitos** em destaque + QR code (que já leva o PIN embutido) e
   quem já chegou (clique num nome pra remover a pessoa). Cada partida gera um PIN novo.
4. **Partida** — botão principal (ou barra de espaço) conduz: Revelar → Placar → Próxima.
   Seletor PT/EN/ES ao vivo no canto.
5. **Fim** — pódio animado (3º, 2º, 1º com coroa e confete), "Jogar de novo" repete o
   mesmo quiz com a sala mantida; "Menu" volta pra central.

### Pontuação

Acertou: **500** + até **500** proporcionais ao tempo restante + **bônus de sequência**
(100 por acerto seguido, teto de 500). Errou ou não respondeu: 0 e a sequência zera.
Uma resposta por pergunta, a primeira vale. A rodada fecha no tempo ou quando todos
respondem.

## Rodar local

```bash
npm install
npm start            # http://localhost:3000 · /host?k=arraia
npm run teste        # teste de fumaça (72 verificações)
```

## Variáveis de ambiente

| Variável | O que faz |
| --- | --- |
| `CHAVE_HOST` | chave do modo apresentador (`?k=...`). Padrão `arraia` — troque em produção |
| `PORT` | porta HTTP (o Railway injeta sozinho) |
| `DATABASE_URL` | Postgres pra biblioteca sobreviver a deploy (no Railway: Variables → Add Reference → Postgres) |
| `URL_PUBLICA` | força a URL do QR code atrás de domínio próprio (opcional) |
| `DADOS_DIR` | pasta do fallback em arquivo (padrão `./dados`) |
| `ANTHROPIC_API_KEY` | liga a tradução automática no editor (opcional; sem ela o botão só avisa) |

## Como os jogadores entram

Pela raiz do site, digitando o **PIN** que está na tela do apresentador — ou escaneando o
QR, que abre a página com o PIN já preenchido. Sem sala aberta, ninguém entra.

## Tradução automática

Com `ANTHROPIC_API_KEY` no ambiente, o editor ganha botões de tradução — um por pergunta
e um para o quiz inteiro. O servidor manda as perguntas em português para a API da
Anthropic (`claude-opus-5`, saída estruturada por JSON Schema) e devolve as alternativas
**na mesma ordem**, para o índice do gabarito continuar valendo. Sem a chave, nada quebra:
o botão avisa que o recurso está desligado e a tradução manual segue disponível.

## Responsividade

Testado em três larguras (1440 px, 800 px e 390 px). A tela do apresentador encolhe
pergunta, relógio e blocos juntos; o celular ganha alvos de toque maiores, respeita a área
segura de aparelhos com entalhe e não tem hover fantasma. Nenhuma das telas rola na
horizontal.

## Logo da marca

A barra do topo procura por **`public/marca.svg`**. Se o arquivo existir, ele é exibido
(a versão da barra escura recebe `filter: brightness(0) invert(1)`, então funciona com
logo monocromático); se não existir, aparece a palavra "skeelo" em texto.

Pra colocar o oficial: suba o arquivo como `public/marca.svg` — pelo GitHub dá pra fazer
em **Add file → Upload files**, sem precisar de terminal. PNG também serve, é só ajustar
o `src` nas duas telas (`views/host.html` e `public/index.html`).

## Deploy no Railway

`railway.json` já fixa `npm start` e o healthcheck em `/api/saude`. Gere o domínio em
**Settings → Networking** apontando pra porta que aparece no log de deploy. A paleta da
marca fica em `public/estilo.css` (`:root`), num painel só de variáveis.
