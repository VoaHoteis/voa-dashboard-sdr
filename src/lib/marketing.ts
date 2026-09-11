/**
 * Camada de dados do dashboard de Marketing Inbound.
 *
 * Junta as tres fontes da operacao numa unica tabela mensal, igual a planilha
 * "Mensal Marketing Inbound" que o time preenchia a mao:
 *
 *   - topo de funil + status de pre-qualificacao -> Kinbox
 *   - reunioes, contratos e MRR                   -> Pipedrive
 *   - investimento em midia (Meta Ads)            -> Windsor.ai / Looker
 *
 * Cada fonte tem um conector proprio. O Pipedrive ja esta ligado (o mesmo token
 * do dashboard de SDR), entao reuniao/contrato/MRR sao numeros reais. Kinbox e
 * Windsor.ai ainda nao tem credencial: enquanto a variavel de ambiente de cada
 * um estiver ausente, o conector cai num mock deterministico -- assim o
 * dashboard roda inteiro hoje -- e a resposta marca a origem (`live`/`mock`)
 * para a tela nunca deixar um numero estimado se passar por real.
 *
 * Todas as agregacoes do Pipedrive reaproveitam o cache e as regras (funis,
 * atribuicao) do resto do projeto -- nenhuma consulta nova ao Pipedrive alem
 * das que os cards de SDR ja fazem.
 */

import { TIPOS_AGENDAMENTO } from './config';
import { resolverFechamentos } from './metrics';
import { buscarAtividades, buscarNegociosGanhos, modoMock } from './pipedrive';
import type {
  LeadsDoMes,
  MarketingResposta,
  MesMarketing,
  Origem,
  StatusLead,
} from './marketing-tipos';

/** Mes (1..12) da parte YYYY-MM de uma data ISO, ou null se vier torta. */
function mesDe(iso: string): number | null {
  const m = Number(iso.slice(5, 7));
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
}

function vetor12(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

// ------------------------------------------------------------- Pipedrive

/**
 * Reunioes, contratos e MRR por mes, do ano inteiro.
 *
 * Faz duas buscas para o ano todo (uma de atividades, uma de ganhos) e
 * distribui em memoria pelos 12 meses -- e o mesmo padrao do card de
 * Fechamentos, que puxa todos os ganhos e recorta por `won_time`.
 *
 * - Reuniao realizada = atividade concluida de um dos tipos de agendamento com
 *   negocio vinculado (o `deal_id` filtra as reunioes internas do time, que nao
 *   tem negocio). Contada pela data de vencimento (`due_date`).
 * - Contrato = negocio ganho num dos dois funis (o recorte de `resolverFechamentos`),
 *   contado pela data do ganho.
 * - MRR = soma do `value` dos contratos ganhos no mes.
 */
async function pipedrivePorMes(ano: number): Promise<{
  reunioes: number[];
  contratos: number[];
  mrr: number[];
  origem: Origem;
}> {
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;

  const reunioes = vetor12();
  const contratos = vetor12();
  const mrr = vetor12();

  // Uma falha do Pipedrive não pode zerar a tabela inteira: leads (Kinbox) e
  // investimento (Windsor) são fontes independentes. Se o Pipedrive cair,
  // devolvemos zeros e marcamos a origem como estimada, sem derrubar a rota.
  let atividades: Awaited<ReturnType<typeof buscarAtividades>>;
  let ganhos: Awaited<ReturnType<typeof buscarNegociosGanhos>>;
  try {
    [atividades, ganhos] = await Promise.all([
      buscarAtividades({ inicio, fim, tipos: TIPOS_AGENDAMENTO, concluidas: true }),
      buscarNegociosGanhos({ inicio, fim }),
    ]);
  } catch (e) {
    console.log('[v0] Pipedrive indisponível para o marketing:', (e as Error).message);
    return { reunioes, contratos, mrr, origem: 'mock' };
  }

  for (const a of atividades) {
    if (!a.deal_id || !a.due_date) continue;
    const m = mesDe(a.due_date);
    if (m) reunioes[m - 1] += 1;
  }

  for (const f of resolverFechamentos(ganhos)) {
    if (!f.data) continue;
    const m = mesDe(f.data);
    if (!m) continue;
    contratos[m - 1] += 1;
    mrr[m - 1] += f.valor;
  }

  return { reunioes, contratos, mrr, origem: modoMock() ? 'mock' : 'live' };
}

// -------------------------------------------------------- Investimento (mídia)

/**
 * Investimento em midia por mes.
 *
 * Fonte real: Windsor.ai (que ja alimenta o Looker com o Meta Ads). Quando
 * `WINDSOR_API_KEY` estiver definida, busca o gasto por dia no conector "all"
 * e soma por mes; qualquer falha cai no mock e marca a origem como estimada,
 * sem derrubar o dashboard.
 */
async function investimentoPorMes(ano: number): Promise<{ valores: number[]; origem: Origem }> {
  const chave = process.env.WINDSOR_API_KEY?.trim();
  if (chave) {
    try {
      return { valores: await windsorInvestimento(ano, chave), origem: 'live' };
    } catch (e) {
      console.log('[v0] Windsor.ai indisponível, usando estimativa:', (e as Error).message);
    }
  }
  return { valores: investimentoMock(ano), origem: 'mock' };
}

/**
 * Conector Windsor.ai. A API "all" devolve linhas por data; pedimos `spend`
 * (gasto) e somamos por mes. O nome do campo pode variar conforme a conexao
 * configurada no Windsor -- se a sua usar outro nome (ex.: `cost`), e so trocar
 * aqui.
 */
async function windsorInvestimento(ano: number, apiKey: string): Promise<number[]> {
  const url = new URL('https://connectors.windsor.ai/all');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('date_from', `${ano}-01-01`);
  url.searchParams.set('date_to', `${ano}-12-31`);
  url.searchParams.set('fields', 'date,spend');
  url.searchParams.set('_renderer', 'json');

  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);

  const json = (await res.json()) as { data?: Array<{ date?: string; spend?: number | string }> };
  const valores = vetor12();
  for (const linha of json.data ?? []) {
    if (!linha.date) continue;
    const m = mesDe(linha.date);
    if (!m) continue;
    valores[m - 1] += Number(linha.spend) || 0;
  }
  return valores;
}

// -------------------------------------------------------------- Kinbox (leads)

/**
 * Topo de funil e status de pre-qualificacao por mes.
 *
 * Fonte real: Kinbox. Quando `KINBOX_API_TOKEN` estiver definido, o conector
 * abaixo busca os leads do ano e agrupa por mes e status. Como o contrato exato
 * da API do Kinbox ainda nao foi mapeado, o conector real fica preparado mas
 * lanca ate ser preenchido -- e enquanto o token nao existe, o dashboard usa a
 * estimativa deterministica.
 */
async function leadsPorMes(ano: number): Promise<{ meses: LeadsDoMes[]; origem: Origem }> {
  const token = process.env.KINBOX_API_TOKEN?.trim();
  if (token) {
    try {
      return { meses: await kinboxLeads(ano, token), origem: 'live' };
    } catch (e) {
      console.log('[v0] Kinbox indisponível, usando estimativa:', (e as Error).message);
    }
  }
  return { meses: leadsMock(ano), origem: 'mock' };
}

/**
 * Conector Kinbox (a preencher).
 *
 * Assim que tivermos o endpoint e o formato dos leads do Kinbox, este e o unico
 * ponto a implementar: buscar os leads do ano, ler a data de entrada e o status
 * de pre-qualificacao de cada um, e mapear o status para uma das chaves de
 * `StatusLead`. As UTMs da campanha vem junto de cada lead e entrarao aqui
 * quando abrirmos o recorte por campanha.
 */
async function kinboxLeads(_ano: number, _token: string): Promise<LeadsDoMes[]> {
  throw new Error(
    'Conector do Kinbox ainda não implementado — falta o endpoint e o mapeamento de status.'
  );
}

// ------------------------------------------------------------------ montagem

export async function montarMarketing(ano: number): Promise<MarketingResposta> {
  const [pd, inv, lead] = await Promise.all([
    pipedrivePorMes(ano),
    investimentoPorMes(ano),
    leadsPorMes(ano),
  ]);

  const meses: MesMarketing[] = [];
  for (let i = 0; i < 12; i++) {
    meses.push({
      ano,
      mes: i + 1,
      leads: lead.meses[i],
      reunioes: pd.reunioes[i],
      contratos: pd.contratos[i],
      mrr: pd.mrr[i],
      investimento: inv.valores[i],
    });
  }

  return {
    ano,
    meses,
    fontes: { leads: lead.origem, pipedrive: pd.origem, investimento: inv.origem },
  };
}

// --------------------------------------------------------------------- mock

/**
 * Base ilustrativa ancorada na planilha "Mensal Marketing Inbound".
 *
 * Cada linha e [duplicado, semRetorno, emContato, desqualificado,
 * desqualificadoTempoLimite, qualificado]; o total do mes e a soma. Serve so
 * para o dashboard mostrar a cara final enquanto Kinbox e Windsor nao estao
 * ligados -- por isso a resposta marca esses numeros como estimados.
 */
const BASE_STATUS: number[][] = [
  [4, 0, 0, 51, 49, 19], // jan
  [2, 0, 0, 62, 118, 22], // fev
  [5, 0, 0, 53, 60, 19], // mar
  [0, 0, 0, 25, 14, 12], // abr
  [0, 0, 0, 54, 18, 12], // mai
  [0, 0, 6, 8, 1, 12], // jun
  [0, 0, 0, 0, 1, 3], // jul
  [1, 0, 0, 10, 8, 6], // ago
  [1, 0, 2, 6, 4, 7], // set
  [0, 0, 0, 0, 0, 0], // out
  [0, 0, 0, 0, 0, 0], // nov
  [0, 0, 0, 0, 0, 0], // dez
];

const BASE_INVESTIMENTO = [
  14671, 16420, 18906, 8854, 11226, 1874, 0, 3200, 2600, 0, 0, 0,
];

function leadsMock(_ano: number): LeadsDoMes[] {
  return BASE_STATUS.map((linha) => {
    const [duplicado, semRetorno, emContato, desqualificado, desqualificadoTempoLimite, qualificado] =
      linha;
    const status: Record<StatusLead, number> = {
      duplicado,
      semRetorno,
      emContato,
      desqualificado,
      desqualificadoTempoLimite,
      qualificado,
    };
    const total = linha.reduce((s, n) => s + n, 0);
    return { total, status };
  });
}

function investimentoMock(_ano: number): number[] {
  return [...BASE_INVESTIMENTO];
}
