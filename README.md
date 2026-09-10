# Dashboard de Metas do Time de SDR — VOA Hotéis

Acompanhamento da meta do time de SDR (Juliana e Bárbara) com dados do Pipedrive
da conta `voahoteis2`.

## O que mudou em relação ao protótipo

O protótipo (`dashboard-metas-sdr.jsx`, artifact do Claude.ai) não falava com o
Pipedrive: cada card chamava a API da Anthropic passando o MCP do Pipedrive e
pedia a um sub-agente Claude para buscar e agregar os dados. Isso só funcionava
dentro do sandbox de Artifacts, era lento e instável, e foi a causa dos cards
3–6 aparecerem zerados.

Aqui a camada de dados é um backend de verdade:

| Protótipo | Agora |
|---|---|
| `fetch` para a API da Anthropic com `mcp_servers` | Rotas `/api/*` no servidor Next.js |
| LLM interpretando um prompt em linguagem natural | Chamadas REST diretas (`/v1/activities`, `/v1/deals`) |
| Resposta cortada por `max_tokens` | Paginação completa, sem limite de tokens |
| Token injetado pelo sandbox | `PIPEDRIVE_API_TOKEN` no servidor, nunca no browser |
| Mesma pergunta dava número diferente | Agregação determinística em `src/lib/metrics.ts` |
| `catch (e) {}` → card zerado em silêncio | Erro na tela com o motivo e botão de tentar de novo |

## Como rodar

```bash
npm install
```

Copie `.env.example` para `.env` e cole o token do Pipedrive:

```bash
cp .env.example .env
```

O token fica em **Pipedrive → foto do perfil → Preferências pessoais → API →
"Seu token de API pessoal"**. Ele dá acesso de leitura e escrita à conta inteira,
então trate como senha: o `.env` já está no `.gitignore` e o token nunca é
enviado ao browser — só o servidor fala com o Pipedrive.

```bash
npm run dev     # http://localhost:3300
```

### Sem token ainda

`PIPEDRIVE_MOCK=1` no `.env` roda tudo com dados falsos determinísticos
(`src/lib/mock.ts`), úteis para conferir layout e regra de agregação. Os números
não têm relação com a operação real.

## Publicar (Vercel)

**Artefato do Claude.ai não serve** para este projeto: o token do Pipedrive
precisa ficar no servidor, e o sandbox de artefatos ainda bloqueia chamadas a
hosts externos. Seria voltar ao beco do protótipo.

```bash
npx vercel        # primeiro deploy (preview)
npx vercel --prod # publica
```

No painel da Vercel, em **Settings → Environment Variables**, defina para
Production e Preview:

| Variável | Valor |
|---|---|
| `PIPEDRIVE_API_TOKEN` | o token da conta `voahoteis2` |
| `DASHBOARD_SENHA` | a senha que o time vai digitar |
| `PIPEDRIVE_MOCK` | `0` (ou não defina) |

Nenhuma delas tem prefixo `NEXT_PUBLIC_`, então ficam só no servidor — o token
nunca chega ao navegador.

### Acesso por senha

Um middleware protege **tudo**, inclusive as rotas `/api/*`. Proteger só a página
deixaria os números a um `curl` de distância.

- O cookie de sessão guarda apenas a validade e uma assinatura HMAC dela: ele
  precisa ser inforjável, não secreto. Cookie inventado no console do navegador
  é rejeitado.
- Dura 30 dias. Trocar `DASHBOARD_SENHA` invalida todas as sessões abertas.
- **Falha fechada**: sem `DASHBOARD_SENHA` em produção o dashboard responde 503 em
  vez de abrir. Esquecer a variável no painel não pode publicar os dados do time.
- Em desenvolvimento local, sem a variável, o login é dispensado.

Verificado: sem sessão as cinco rotas de API devolvem 401 e a página redireciona
para `/login`; senha errada, cookie forjado, cookie expirado e logout também
devolvem 401.

### Tempo de resposta

A rota `/api/funil` leva ~4s (lê ~2.400 negócios abertos). Cabe no limite de 10s
do plano Hobby, mas com pouca folga se a conta crescer — se começar a estourar,
aumente `maxDuration` na rota (exige plano Pro) ou reduza o escopo da consulta.

## Botão "Atualizar"

Um clique refaz a busca de **todos** os cards de uma vez, inclusive os que fazem
a própria consulta (funil, futuros, atividades) — eles se coordenam por um
contexto React, não por uma pilha de callbacks.

O botão manda `?atualizar=1`, que derruba o cache de 60s do servidor. Sem isso um
clique dentro da janela de cache devolveria exatamente os mesmos números, o que é
pior do que não ter botão: passa a impressão de que o dado foi conferido agora.
Trocar o filtro de data **não** derruba o cache — só o pedido explícito.

O carimbo ao lado marca a hora em que a última busca terminou, não a do clique.

## Card de No-shows

Conta atividades concluídas do tipo `registro_de_no_show` no período do filtro,
quebradas por funil. **Só entram as que têm negócio vinculado** num dos dois
funis — mesma regra dos agendamentos, por decisão do João em 09/09/2026.

Os lançamentos sem vínculo ficam fora do total, mas continuam na tela numa linha
discreta ("+ N sem negócio vinculado, fora da conta") que abre a lista. Não é
enfeite: são 15% a 25% dos lançamentos, e em setembro metade deles.

| mês | com negócio (contados) | sem vínculo (fora) |
|---|---|---|
| jun/26 | 22 | 1 |
| jul/26 | 22 | 8 |
| ago/26 | 16 | 4 |
| set/26 | 2 | 2 |

Um dos dois de setembro é "Santa Vista Boutique + VOA HOTÉIS" — o hotel existe na
base e teve agendamento no mês, então é só vincular no Pipedrive que ele passa a
contar sozinho.

## Marca de projeção (card Agendamento por SDR)

Cada barra tem um tracejado discreto marcando onde ela chegaria se as reuniões
**já marcadas** daquela SDR naquele funil forem confirmadas. Passe o mouse para
ver o número.

Três regras evitam que ela minta:

- **Só aparece no mês corrente.** Os futuros são sempre "de hoje até o fim do
  mês"; projetá-los sobre "mês passado" seria enganoso, então a página manda
  `null` e a marca some.
- **Só aparece se houver algo a projetar.** Sem reunião marcada, ou com a
  projeção já dentro do preenchido, o tracejado seria ruído em cima da barra.
- **A projeção conta a união, não a soma.** `contarProjecao` junta as duas listas
  antes de deduplicar: na unidade "negócios distintos", um hotel que já teve
  reunião e tem outra marcada vale 1, não 2. Somar as contagens separadas daria
  o número errado.

A busca dos futuros vive em `page.tsx` e é dividida entre este card e o de
Agendamentos Futuros — uma requisição, não duas.

## Modal de detalhe

Os números principais dos cards de Agendamentos Totais, Agendamento por SDR,
Detalhamento e Agendamentos Futuros são clicáveis: abrem a lista dos negócios que
formam aquele número, cada linha com link direto para o negócio no Pipedrive —
quem abre esse modal quase sempre quer conferir ou corrigir algo lá.

Número zerado não é clicável (não há o que listar). Fecha no Esc, no clique fora
e no ✕.

**A lista não é uma segunda consulta.** As rotas devolvem os itens crus junto com
as contagens, e `src/lib/detalhe.ts` recorta em memória. Se o detalhe fosse
buscar de novo no Pipedrive, ele poderia discordar do número exibido — que é a
pior coisa que uma tela de conferência pode fazer.

Por isso `filtrarItens` espelha `contarPorFunil` de `metrics.ts`, inclusive na
deduplicação da unidade "negócios distintos". **Mudou um, muda o outro.** Há uma
verificação que compara os 24 recortes (2 unidades × cards 1, 2, 3 + card 5)
contra as contagens da API; rode-a depois de mexer em qualquer um dos dois.

## Estrutura

```
src/lib/config.ts     Todo o conhecimento de domínio: pipelines, stage_ids,
                      tipos de atividade, campo SDR, metas, cores.
src/lib/dates.ts      Feriados, dias úteis, semanas do mês.
src/lib/pipedrive.ts  Cliente REST: paginação, cache, erros, atribuição de SDR.
src/lib/metrics.ts    Agregações puras (sem rede) — a parte conferível no papel.
src/lib/detalhe.ts    Recorte dos itens por trás de cada número (espelha metrics).
src/lib/mock.ts       Dados falsos para rodar sem token.
src/app/api/*         Uma rota por grupo de cards.
src/components/*      UI.
```

Mudou meta, etapa de funil ou tipo de atividade? `src/lib/config.ts` é o único
arquivo a mexer.

## Duas armadilhas da API do Pipedrive

Descobertas testando contra a conta real. Quem for mexer no cliente precisa
saber, porque as duas falham **em silêncio**, devolvendo dados errados com
HTTP 200:

**`GET /v1/deals` ignora `pipeline_id`.** Pedindo `pipeline_id=6` ou
`pipeline_id=10` ela devolve exatamente a mesma coisa: a base inteira, 17.139
negócios, incluindo o pipeline 1. Não dá erro, não avisa. O filtro que funciona é
`stage_id` — e como cada etapa pertence a um funil só, o recorte sai igual. Por
isso `buscarNegociosDaEtapa` consulta por etapa, nunca por funil.

**A v2 não devolve `undone_activities_count` nem `next_activity_date`**, que são
os dois campos de que a saúde do negócio depende — vêm `undefined`. Em compensação
é a única que aceita lote por `ids` e que honra `pipeline_id`. Daí o uso
das duas versões:

| Para quê | Versão | Por quê |
|---|---|---|
| Negócios de uma etapa (card 4) | v1 + `stage_id` | só ela traz os campos de saúde |
| Negócios por id (cards 1, 2, 3, 5) | v2 + `ids` | uma chamada em vez de varrer 17 mil |
| Atividades | v1 | `user_id=0` traz as de todo mundo |

Se a v2 um dia parar de mandar o bloco `custom_fields`, `buscarNegociosPorIds`
lança erro em vez de deixar a atribuição por SDR virar zero calado.

**Terceira divergência entre as versões: o proprietário do negócio.** A v1 chama
`user_id` e entrega um objeto (`{id, name, ...}`); a v2 chama `owner_id` e entrega
um número. Ler só `user_id` fazia a regra de reserva nunca disparar nos cards que
usam a v2 — 14 agendamentos de julho ficavam sem responsável sendo que o dono era
o João ou o Bruno. `donoDoNegocio` lê os dois nomes.

## Regras de negócio implementadas

**Agendamento** = atividade concluída de um dos 3 tipos
(`reuniao_de_apresentacao_gc`, `meeting`, `visita_presencial`) **com negócio
vinculado num pipeline 6 ou 10**. O filtro de funil não é detalhe: `meeting`
também é usado nas reuniões internas do time (alinhamento, checkpoint, almoço),
que quase nunca têm negócio vinculado. O tipo inativo duplicado
`apresentacao_institucional` fica de fora, por decisão do João.

### Regra de atribuição dos agendamentos

O **campo SDR do negócio é soberano**: se estiver preenchido, vale ele — mesmo
nomeando quem já saiu do time. Só quando o campo está vazio a atribuição cai para
o **proprietário** do negócio. Decisão do João em 09/09/2026.

Quem aparece está em `PESSOAS` (`config.ts`), com um papel:

| papel | quem | efeito |
|---|---|---|
| `sdr` | Juliana, Bárbara | têm meta; aparecem nos cards por SDR, funil e atividades |
| `closer` | Bruno, João | contam no total e aparecem nos modais, sem meta |
| `inativo` | Mariana, Daniela, Marcela, Pedro, Bot, Jéssica | contam no total, marcados em âmbar |

Sem essa lista, um agendamento de closer ou de quem saiu virava "sem SDR" — o que
é factualmente errado, porque o campo está preenchido. O efeito era grande: em
julho, 25 dos 46 agendamentos eram de Bruno, João, Mariana ou Daniela.

**Atribuição por SDR — são três campos diferentes, de propósito.** Isso parece
inconsistência e não é; cada card faz uma pergunta distinta:

| Card | Campo | Por quê |
|---|---|---|
| 1, 2, 3, 5 (agendamentos) | campo personalizado **SDR** do negócio | depois da reunião o negócio passa para um closer, e só esse campo preserva quem originou |
| 4 (funil) | **proprietário** do negócio (`user_id`) | nas etapas iniciais o negócio ainda está com a própria SDR |
| 6 (atividades) | **executor** da atividade (`user_id` da atividade) | a pergunta é quanto esforço a pessoa fez, não de quem é a carteira |

O handoff mandava usar o campo SDR também no funil. Está errado, e o erro é
grande: o campo SDR está **vazio em 91% dos negócios** da Pré Qualificação, então
a Juliana aparecia com 6 hotéis onde tem 77. Conferido com o João em 08/09/2026 —
as seis contagens de etapa batem exatamente pelo proprietário.

**Saúde do negócio**: dos campos nativos `undone_activities_count` e
`next_activity_date`. A Pré Qualificação / Disparo Enviado fica fora do cálculo.

**Conferido contra a conta real** (08/09/2026): os 8 `stage_id`, as 9 chaves de
tipo de atividade e o campo SDR (tipo `set`, opções 645 Juliana / 680 Barbara)
batem com o handoff. Em setembro havia 14 atividades concluídas dos 3 tipos; 3
foram descartadas por não terem negócio vinculado — "Checkpoint Comercial" e
"Alinhamento Semanal - Time Comercial" (2x), exatamente as reuniões internas que
a regra existe para excluir. Sobraram 11, que é o que o card 1 mostra.

**Feriados**: o protótipo tinha a lista chumbada só para 2026 — em 01/01/2027 o
cálculo de dias úteis passaria a mentir sem avisar. Agora Carnaval, Sexta-feira
Santa e Corpus Christi são derivados da Páscoa (Meeus/Jones/Butcher), então vale
para qualquer ano. Conferido: os 14 feriados calculados para 2026 batem
exatamente com a lista do handoff.

**Fuso**: as datas circulam como string `YYYY-MM-DD` e "hoje" é calculado em
`America/Sao_Paulo`. Num servidor em UTC, `new Date('2026-09-01')` voltaria para
31/08 e o mês inteiro sairia deslocado.

## Pendências com o João

Cinco decisões foram assumidas na sessão anterior sem confirmação dele. Todas
estão implementadas do jeito que o protótipo fazia, e todas são de uma linha
para mudar:

0. ~~Salabim usa "Disparo Enviado" como Pré Qualificação~~ — **resolvido em
   08/09/2026**: o João confirmou que essa etapa não existe no Salabim. A tabela
   agora mostra "—" ali, não zero. Fica em aberto o que fazer com os ~378
   negócios abertos no "Disparo Enviado", que hoje não entram em etapa nenhuma.
1. **Unidade de contagem** (`UNIDADE_PADRAO` em `config.ts`). Hoje cada reunião
   conta 1 — dois encontros com o mesmo hotel no período contam 2. O dashboard
   tem um botão que alterna para "negócios distintos", e o card 1 avisa quando os
   dois números divergem, para a conversa com ele ser sobre números concretos.
2. **Follow-ups marcados como reunião**: alguns lançamentos desses 3 tipos são
   "verificar retorno", não reunião de fato, e inflam a contagem. Não resolvido —
   exigiria um critério novo (duração mínima, ou um tipo de atividade próprio).
3. **Índice de saúde** (% em dia) e as **margens de ±10%** da temperatura de
   ritmo são definição do Claude, não do João. Ficam em `RITMO_ACIMA` /
   `RITMO_NO_RITMO`.
4. **Cards 3–6 sempre no mês corrente**, ignorando o filtro do topo. Quando o
   filtro sai do mês, um aviso âmbar explica isso na tela em vez de deixar o
   usuário achar que os cards travaram.
5. **Negócio com duas SDRs** conta inteiro para as duas, sem fração — então a
   soma por SDR pode passar do total do time. O card 2 diz isso na nota.

## Limites conhecidos

- O cache em memória (60s) é por instância. Em serverless com várias instâncias
  cada uma tem o seu; é otimização de rajada, não fonte de verdade.
- Não há autenticação: quem abrir a URL vê os números. Antes de publicar fora da
  rede interna, coloque um login na frente.
- O card 6 faz uma chamada por SDR. Com mais SDRs no time, vale paralelizar.
- O card 4 (funil) faz 9 consultas e lê ~2.400 negócios abertos; leva uns 5s. Os
  outros cards respondem em cerca de 1s.
