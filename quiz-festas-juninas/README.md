# Quiz do Skee: Festas Juninas pelo mundo — servidor

Backend em Google Apps Script para um quiz ao vivo (estilo Kahoot) rodando como web app.
Sala única, baralho fixo, sem banco de dados: todo o estado vive no `CacheService` do script.

- Link normal → entra como **jogador**
- Link com `?k=CHAVE_HOST` → entra como **apresentador**

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `Code.gs` | servidor: `doGet`, funções `srv*` chamadas via `google.script.run` |
| `appsscript.json` | manifesto do projeto (web app público, executa como quem publicou) |
| `Index.html` | **ainda não versionado** — a interface (apresentador + jogador) |

> `doGet` faz `HtmlService.createTemplateFromFile('Index')`, então o projeto só sobe
> depois que existir um arquivo `Index.html` no mesmo projeto Apps Script.

## Configuração

No topo de `Code.gs`:

| Constante | O que é |
| --- | --- |
| `CHAVE_HOST` | senha na query string que libera o modo apresentador (`?k=arraia`) |
| `SALA` | prefixo das chaves de cache — troque para rodar duas partidas isoladas |
| `TTL` | 21600 s (6 h), o teto do `CacheService` |
| `PLANILHA_ID` | opcional; com um ID preenchido, `srvSalvarResultado` grava o ranking final |

## Publicação

1. Crie um projeto em [script.google.com](https://script.google.com) e cole `Code.gs`
   (ou use `clasp push` com estes arquivos).
2. Adicione o `Index.html`.
3. **Implantar → Nova implantação → App da Web**, executando como você e com acesso
   "qualquer pessoa" — é o que o `appsscript.json` já declara.
4. Compartilhe a URL da implantação com a galera; abra você mesmo a URL com `?k=arraia`.

Como o acesso é anônimo, `Session.getActiveUser().getEmail()` volta vazio e `meuNome()`
retorna `''` — o jogador digita o nome na entrada. Dentro de um domínio Workspace com
acesso restrito, o nome vem pré-preenchido pelo e-mail.

## Contrato com o cliente (`Index.html`)

O servidor não conhece as perguntas: o baralho e a lógica de rodada moram no cliente do
apresentador, que publica o estado atual e o jogador faz polling dele.

### Chamadas do apresentador

| Função | Assinatura | Efeito |
| --- | --- | --- |
| `srvAbrir` | `(sid, estadoJson)` | zera o roster daquela sessão e publica o estado inicial |
| `srvPublicar` | `(estadoJson)` | sobrescreve o estado atual (mudou de pergunta, revelou resposta, encerrou) |
| `srvRoster` | `(sid)` → JSON `[{pid, nome}]` | quem já entrou |
| `srvRespostas` | `(sid, q)` → JSON `[{pid, nome, e, ms}]` | respostas da pergunta `q` (`e` = índice escolhido, `ms` = tempo de reação) |
| `srvSalvarResultado` | `(lbJson)` com `[{n, s}]` | grava o ranking final na planilha, se `PLANILHA_ID` estiver setado |
| `srvUrlJogador` | `()` → URL | URL pública, para montar o QR code na tela |

### Chamadas do jogador

| Função | Assinatura | Efeito |
| --- | --- | --- |
| `srvEntrar` | `(nome)` → `{sid, pid, nome}` ou `{erro}` | registra no roster |
| `srvEstado` | `()` → `estadoJson` ou `''` | polling da tela atual |
| `srvResponder` | `(sid, q, escolha, ms, pid)` | grava a resposta |

Erros possíveis em `srvEntrar`: `sala` (nenhuma partida aberta), `nome` (vazio),
`ocupado` (não conseguiu o lock em 10 s).

### Estado (`estadoJson`)

O servidor guarda o estado como texto opaco e só lê `.sid`. O cliente é livre para o
resto do formato; o mínimo é:

```json
{ "sid": "1719800000000", "fase": "lobby", "q": 0 }
```

`sid` identifica a partida e separa roster e respostas entre rodadas — gere um novo a
cada `srvAbrir`.

## Limites conhecidos

- O `pid` é derivado do nome, então dois jogadores com o mesmo nome viram a mesma pessoa
  (compartilham pontuação). Suficiente para uma sala de festa junina, não para valer prêmio.
- `srvResponder` não valida se `q` é a pergunta corrente nem se já houve resposta —
  quem chamar de novo sobrescreve a anterior. A janela de tempo é controlada pelo cliente.
- Tudo expira em 6 horas (teto do `CacheService`). Uma partida precisa acontecer numa sessão só.
