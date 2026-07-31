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

1. **Central de quizzes** — cards com os quizzes salvos: ▶ Apresentar, Editar, ✕ Excluir,
   ou ＋ Novo quiz.
2. **Editor** — título, emoji e perguntas: enunciado, 4 alternativas (bolinha marca a
   correta), tempo (5–120 s), curiosidade opcional e tradução EN opcional (sem tradução,
   a pergunta cai no PT quando o idioma do jogo é EN).
3. **Lobby** — QR code + quem já chegou (clique num nome pra remover a pessoa).
4. **Partida** — botão principal (ou barra de espaço) conduz: Revelar → Placar → Próxima.
   Seletor PT/EN ao vivo no canto.
5. **Fim** — pódio animado (3º, 2º, 1º com coroa e confete), "Jogar de novo" repete o
   mesmo quiz com a sala mantida; "Menu" volta pra central.

### Pontuação

Acertou: **500** + até **500** proporcionais ao tempo restante. Errou ou não respondeu: 0.
Uma resposta por pergunta, a primeira vale. A rodada fecha no tempo ou quando todos
respondem.

## Rodar local

```bash
npm install
npm start            # http://localhost:3000 · /host?k=arraia
npm run teste        # teste de fumaça (50 verificações)
```

## Variáveis de ambiente

| Variável | O que faz |
| --- | --- |
| `CHAVE_HOST` | chave do modo apresentador (`?k=...`). Padrão `arraia` — troque em produção |
| `PORT` | porta HTTP (o Railway injeta sozinho) |
| `DATABASE_URL` | Postgres pra biblioteca sobreviver a deploy (no Railway: Variables → Add Reference → Postgres) |
| `URL_PUBLICA` | força a URL do QR code atrás de domínio próprio (opcional) |
| `DADOS_DIR` | pasta do fallback em arquivo (padrão `./dados`) |

## Deploy no Railway

`railway.json` já fixa `npm start` e o healthcheck em `/api/saude`. Gere o domínio em
**Settings → Networking** apontando pra porta que aparece no log de deploy. A paleta da
marca fica em `public/estilo.css` (`:root`), num painel só de variáveis.
