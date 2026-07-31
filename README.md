# Quiz do Skee: Festas Juninas pelo mundo

Quiz ao vivo estilo Kahoot: o apresentador projeta a tela grande com QR code,
a galera entra pelo celular, responde contra o relógio e o pódio sai no final.
Bilíngue PT-BR/EN, com troca de idioma ao vivo.

Um processo Node, estado em memória, sem banco e sem build step — sobe direto
em Railway, Render, Fly ou qualquer lugar que rode `npm start`.

## Rodando

```bash
npm install
npm start          # http://localhost:3000
```

- **Jogador:** abre a raiz (`/`), digita o nome e espera.
- **Apresentador:** abre `/host?k=arraia` (a chave vem de `CHAVE_HOST`).
  A tela mostra o QR de entrada; o botão principal conduz a partida inteira
  (espaço ou Enter também avançam).

## Configuração

Variáveis de ambiente (veja `.env.example`):

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `PORT` | `3000` | porta HTTP — Railway/Render injetam sozinhos |
| `CHAVE_HOST` | `arraia` | chave do modo apresentador; **troque em produção**, o repo é público |
| `URL_PUBLICA` | — | força a URL do QR code (útil atrás de domínio próprio) |

## Fluxo da partida

```
lobby → pergunta → revelação → placar → … → fim
```

- Pontuação: 500 por acertar + até 500 pela rapidez (proporcional ao tempo restante).
- A revelação dispara sozinha quando o tempo acaba ou quando todos os conectados respondem.
- A primeira resposta de cada jogador é a que vale.
- O idioma (PT/EN) muda na barra do apresentador e reflete em todas as telas na hora.
- Se o celular travar ou recarregar, o jogador volta com o mesmo nome e pontuação
  (token no `localStorage`).
- **Reiniciar** zera pontos e volta ao lobby mantendo quem já está na sala.

## Perguntas

O baralho está em `baralho.js`: 15 perguntas fornecidas pela organização (PT
canônico, EN traduzido), com alternativas na mesma ordem nos dois idiomas e
curiosidade opcional exibida na revelação. Para editar, é só mexer no array —
nenhuma outra parte do código conhece o conteúdo.

## Arquitetura

| Arquivo | Papel |
| --- | --- |
| `server.js` | Express + WebSocket; máquina de estados, relógio e pontuação vivem aqui |
| `baralho.js` | as perguntas |
| `views/host.html` + `public/host.js` | tela do apresentador (servida só com a chave) |
| `public/index.html` + `public/jogador.js` | tela do jogador |
| `public/estilo.css` | visual compartilhado (bandeirinhas incluídas) |
| `teste/partida.js` | teste de fumaça que joga uma partida completa |

O servidor é a fonte da verdade: clientes só mandam intenções (`entrar`,
`responder`, `proxima`…) e recebem o estado já filtrado por papel — o jogador
nunca recebe a resposta correta antes da revelação.

Estado em memória significa: **uma sala por instância** e a partida morre se o
processo reiniciar. Para uma festa, é exatamente o suficiente.

## Teste

```bash
npm run teste
```

Sobe o servidor numa porta de teste e verifica o fluxo completo: entrada, chave
errada, nome duplicado, rodadas, pontuação por rapidez, troca de idioma,
reconexão e reinício.

## Deploy (Railway/Render)

1. Conecte o repositório e o branch.
2. Defina `CHAVE_HOST` nas variáveis de ambiente do serviço.
3. Build padrão de Node já serve: `npm install` + `npm start`.
4. Abra `https://SEU-APP/host?k=SUA_CHAVE` na tela grande e pronto.
