/**
 * Cliente REST do Pipedrive.
 *
 * Substitui a camada do prototipo, que pedia a um sub-agente Claude (via MCP)
 * para buscar e agregar os dados. Aqui as chamadas sao diretas e deterministicas:
 * o token nunca sai do servidor, nao ha limite de tokens para estourar e a
 * mesma pergunta sempre devolve o mesmo numero.
 */

import { PESSOAS, SDR_FIELD_KEY } from './config';
import type { ISODate } from './dates';

const BASE_PADRAO = 'https://voahoteis2.pipedrive.com/api';

/**
 * `||` e nao `??` de proposito: uma variavel de ambiente cadastrada VAZIA no
 * painel da Vercel chega como '' -- que passa direto pelo `??` e faz o
 * `new URL()` quebrar com um "Invalid URL" que nao explica nada. Aqui, vazio
 * cai no padrao, como se nao existisse.
 */
function baseUrl(): string {
  return (process.env.PIPEDRIVE_BASE_URL?.trim() || BASE_PADRAO).replace(/\/+$/, '');
}

export function modoMock(): boolean {
  return process.env.PIPEDRIVE_MOCK === '1';
}

export class PipedriveError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PipedriveError';
    this.status = status;
  }
}

function token(): string {
  const t = process.env.PIPEDRIVE_API_TOKEN;
  if (!t) {
    throw new PipedriveError(
      'PIPEDRIVE_API_TOKEN não está definido. Copie .env.example para .env e cole o token, ' +
        'ou rode com PIPEDRIVE_MOCK=1 para usar dados de exemplo.'
    );
  }
  return t;
}

/** Cache em memoria. Corta rajadas de refresh sem esconder mudanca real por muito tempo. */
const TTL_MS = 60_000;
const cache = new Map<string, { em: number; valor: unknown }>();

export function limparCache(): void {
  cache.clear();
}

interface RespostaPipedrive<T> {
  success: boolean;
  data: T[] | null;
  error?: string;
  additional_data?: {
    pagination?: { start: number; limit: number; more_items_in_collection: boolean; next_start?: number };
  };
}

async function chamar<T>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<RespostaPipedrive<T>> {
  const base = baseUrl();
  let url: URL;
  try {
    url = new URL(base + path);
  } catch {
    // Sem esta mensagem o card mostraria so "Invalid URL", que nao diz onde olhar.
    throw new PipedriveError(
      'Endereço da API do Pipedrive inválido: "' + base + '". Verifique a variável ' +
        'PIPEDRIVE_BASE_URL — se ela não for necessária, apague-a em vez de deixá-la em branco.'
    );
  }
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  url.searchParams.set('api_token', token());

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  } catch (e) {
    throw new PipedriveError('Falha de rede ao chamar o Pipedrive: ' + (e as Error).message);
  }

  if (res.status === 429) {
    throw new PipedriveError(
      'Pipedrive respondeu 429 (limite de requisições). Tente de novo em alguns segundos.',
      429
    );
  }
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new PipedriveError(
      'Pipedrive respondeu ' + res.status + ' em ' + path + '. ' + corpo.slice(0, 300),
      res.status
    );
  }

  const json = (await res.json()) as RespostaPipedrive<T>;
  if (json.success === false) {
    throw new PipedriveError('Pipedrive recusou ' + path + ': ' + (json.error ?? 'motivo não informado'));
  }
  return json;
}

/** Percorre todas as paginas de um endpoint v1. */
async function buscarTudo<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  limite = 500
): Promise<T[]> {
  const chaveCache = path + '?' + JSON.stringify(params);
  const hit = cache.get(chaveCache);
  if (hit && Date.now() - hit.em < TTL_MS) return hit.valor as T[];

  const out: T[] = [];
  let start = 0;

  // Guarda contra loop infinito se a paginacao vier torta.
  for (let pagina = 0; pagina < 60; pagina++) {
    const json = await chamar<T>(path, { ...params, start, limit: limite });
    if (json.data && json.data.length) out.push(...json.data);

    const p = json.additional_data?.pagination;
    if (!p?.more_items_in_collection) break;
    start = p.next_start ?? start + limite;
  }

  cache.set(chaveCache, { em: Date.now(), valor: out });
  return out;
}

// ---------------------------------------------------------------- entidades

export interface Atividade {
  id: number;
  type: string;
  subject: string;
  done: boolean;
  due_date: ISODate | null;
  deal_id: number | null;
  user_id: number | null;
}

export interface Negocio {
  id: number;
  title: string;
  pipeline_id: number;
  stage_id: number;
  status: string;
  undone_activities_count: number;
  next_activity_date: ISODate | null;
  [campoPersonalizado: string]: unknown;
}

/**
 * Atividades no periodo, filtradas por tipo.
 *
 * `user_id: 0` e o jeito do Pipedrive de dizer "todos os usuarios" -- sem isso
 * a API devolve so as do dono do token, que e um jeito facil de o dashboard
 * voltar numero baixo demais sem reclamar de nada.
 */
export async function buscarAtividades(opts: {
  inicio: ISODate;
  fim: ISODate;
  tipos: readonly string[];
  concluidas: boolean;
  userId?: number;
}): Promise<Atividade[]> {
  if (modoMock()) return (await mock()).atividadesFalsas(opts);

  return buscarTudo<Atividade>(
    '/v1/activities',
    {
      user_id: opts.userId ?? 0,
      type: opts.tipos.join(','),
      start_date: opts.inicio,
      end_date: opts.fim,
      done: opts.concluidas ? 1 : 0,
    },
    100
  );
}

/**
 * Negocios abertos de uma etapa.
 *
 * Aqui e a v1 de proposito, apesar de a v2 ter filtro de pipeline: so a v1
 * devolve `undone_activities_count` e `next_activity_date`, que sao os dois
 * campos de que a saude do negocio depende. A v2 simplesmente os omite.
 *
 * O filtro e por `stage_id`, nunca por `pipeline_id`: a v1 **ignora**
 * `pipeline_id` em silencio (verificado na conta -- pedindo pipeline 6 ou 10 ela
 * devolve a base inteira, incluindo o pipeline 1). Como cada etapa pertence a um
 * unico funil, filtrar por etapa da o mesmo recorte e de fato funciona.
 */
export async function buscarNegociosDaEtapa(stageId: number): Promise<Negocio[]> {
  if (modoMock()) return (await mock()).negociosFalsosDaEtapa(stageId);

  return buscarTudo<Negocio>('/v1/deals', {
    stage_id: stageId,
    status: 'open',
    user_id: 0,
  });
}

/**
 * Negocios GANHOS no periodo, para o card de Fechamentos.
 *
 * A v1 nao filtra por data de ganho, entao pedimos todos os `status=won`
 * (paginado, com o mesmo cache de 60s dos outros endpoints) e recortamos por
 * `won_time` em memoria. `won_time` vem como "2026-09-05 14:03:00" em UTC; como
 * o resto do codigo, comparamos so a parte da data -- perto da virada de dia um
 * fechamento pode cair no dia vizinho, o que e aceitavel para uma contagem
 * mensal e evita o trabalho de converter fuso aqui.
 *
 * A v1 e de proposito: ela devolve `value`, `won_time`, `pipeline_id` e o dono
 * em `user_id` (objeto) no topo do negocio, que e tudo de que este card precisa.
 */
export async function buscarNegociosGanhos(opts: {
  inicio: ISODate;
  fim: ISODate;
}): Promise<Negocio[]> {
  if (modoMock()) return (await mock()).negociosGanhosFalsos(opts);

  const todos = await buscarTudo<Negocio>('/v1/deals', { status: 'won', user_id: 0 });
  return todos.filter((d) => {
    const wt = (d as { won_time?: string | null }).won_time;
    if (!wt) return false;
    const dia = wt.slice(0, 10);
    return dia >= opts.inicio && dia <= opts.fim;
  });
}

/**
 * Todos os negocios ABERTOS da conta, para o card de Forecast.
 *
 * Sem filtro de etapa de proposito: a definicao do forecast e "todo negocio
 * aberto com Data de fechamento esperada no mes", em QUALQUER etapa -- restringir
 * pelas etapas do funil (como o card de saude faz) descartava justamente os
 * negocios em negociacao avancada, que sao os que tem previsao de fechamento. O
 * recorte por funil e por data roda depois, em memoria.
 *
 * Mesmo formato da busca de ganhos: a v1 traz `value`, `expected_close_date`,
 * `pipeline_id` e `stage_id` no topo de cada negocio.
 */
export async function buscarNegociosAbertos(): Promise<Negocio[]> {
  if (modoMock()) return (await mock()).negociosAbertosFalsos();
  return buscarTudo<Negocio>('/v1/deals', { status: 'open', user_id: 0 });
}

/**
 * Etapas da conta (id -> nome), para o forecast rotular a etapa de cada negocio
 * sem depender do STAGES fixo (que so cobre as 4 etapas acompanhadas). Como o
 * forecast pega negocios de qualquer etapa, precisa do nome de todas.
 */
export async function buscarEtapas(): Promise<Map<number, string>> {
  if (modoMock()) return (await mock()).etapasFalsas();
  const linhas = await buscarTudo<{ id: number; name: string }>('/v1/stages', {});
  const m = new Map<number, string>();
  for (const s of linhas) if (typeof s.id === 'number') m.set(s.id, s.name);
  return m;
}

/**
 * Negocios por id, para resolver funil e SDR das atividades do periodo.
 *
 * Aqui e a v2, que aceita lote por `ids` -- sao poucas dezenas de negocios por
 * mes, entao isso e uma chamada em vez de varrer os 17 mil negocios da conta.
 * A v2 nao traz os campos de saude, mas este caminho nao precisa deles.
 */
export async function buscarNegociosPorIds(ids: number[]): Promise<Map<number, Negocio>> {
  const unicos = [...new Set(ids.filter((n) => Number.isFinite(n)))];
  if (unicos.length === 0) return new Map();
  if (modoMock()) return (await mock()).negociosFalsosPorIds(unicos);

  const mapa = new Map<number, Negocio>();

  for (let i = 0; i < unicos.length; i += 100) {
    const lote = unicos.slice(i, i + 100);
    const json = await chamar<Negocio>('/v2/deals', { ids: lote.join(','), limit: 100 });
    const vieram = json.data ?? [];

    // A v2 aninha campo personalizado em `custom_fields`. Se um dia parar de
    // mandar esse bloco, `sdrsDoNegocio` devolveria lista vazia e o dashboard
    // mostraria zero agendamento por SDR sem erro nenhum na tela -- que e
    // justamente a falha silenciosa que este projeto veio consertar. Melhor
    // quebrar alto.
    if (vieram.length > 0 && !vieram.some((d) => 'custom_fields' in d)) {
      throw new PipedriveError(
        'A API v2 devolveu negócios sem o bloco `custom_fields`, então não dá para saber ' +
          'de qual SDR é cada agendamento. Sem isso os cards por SDR mostrariam zero sem motivo ' +
          'aparente, então a consulta foi interrompida.'
      );
    }

    for (const d of vieram) mapa.set(d.id, normalizarNegocioV2(d));
  }
  return mapa;
}

/**
 * A v2 devolve campo personalizado aninhado em `custom_fields` e como array de
 * ids (`[645]`); a v1 devolve no topo do objeto e como string ("645,680"). O
 * resto do codigo le sempre pelo formato da v1.
 */
function normalizarNegocioV2(d: Negocio): Negocio {
  const custom = (d as { custom_fields?: Record<string, unknown> }).custom_fields;
  if (custom && SDR_FIELD_KEY in custom) {
    return { ...d, [SDR_FIELD_KEY]: custom[SDR_FIELD_KEY] };
  }
  return d;
}

// ------------------------------------------------------------ atribuicao SDR

const OPCAO_PARA_PESSOA = new Map<number, string>(
  PESSOAS.filter((p) => p.sdrOptionId !== undefined).map((p) => [p.sdrOptionId as number, p.key])
);

const USUARIO_PARA_PESSOA = new Map<number, string>(
  PESSOAS.filter((p) => p.userId !== undefined).map((p) => [p.userId as number, p.key])
);

/**
 * Pessoas nomeadas no campo personalizado "SDR" do negocio.
 *
 * O valor chega como "645,680" (v1) ou como array de ids (v2). Negocio com duas
 * pessoas marcadas conta inteiro para as duas -- nao ha divisao de fracao.
 */
export function pessoasDoCampoSdr(negocio: Negocio | undefined): string[] {
  if (!negocio) return [];
  const bruto = negocio[SDR_FIELD_KEY];
  if (bruto === null || bruto === undefined || bruto === '') return [];

  const ids: number[] = Array.isArray(bruto)
    ? bruto.map((v) => Number(typeof v === 'object' && v !== null ? (v as { id?: unknown }).id : v))
    : String(bruto)
        .split(',')
        .map((s) => Number(s.trim()));

  const out: string[] = [];
  for (const id of ids) {
    const k = OPCAO_PARA_PESSOA.get(id);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Mantido para o card de funil, que atribui por dono e so olha as duas SDRs. */
export function sdrsDoNegocio(negocio: Negocio | undefined): string[] {
  return pessoasDoCampoSdr(negocio);
}


/**
 * Proprietario do negocio. A v1 devolve `user_id` como objeto ({id, name, ...}),
 * a v2 como numero -- dai as duas leituras.
 *
 * E este campo, e nao o campo personalizado "SDR", que diz de quem e o negocio
 * no **funil**. Conferido com o Joao em 08/09/2026: as seis contagens de etapa
 * batem exatamente pelo proprietario e nao batem pelo campo SDR, que esta vazio
 * em 91% dos negocios da Pre Qualificacao.
 */
export function donoDoNegocio(negocio: Negocio | undefined): number | null {
  if (!negocio) return null;

  // Terceira divergencia entre as versoes: a v1 chama o dono de `user_id` e o
  // entrega como objeto ({id, name, ...}); a v2 chama de `owner_id` e entrega
  // como numero. Ler so `user_id` fazia a regra de reserva pelo proprietario
  // nunca disparar nos cards que usam a v2 -- 14 agendamentos de julho ficavam
  // sem responsavel sendo que o dono era o Joao ou o Bruno.
  for (const bruto of [
    (negocio as { user_id?: unknown }).user_id,
    (negocio as { owner_id?: unknown }).owner_id,
  ]) {
    if (typeof bruto === 'number') return bruto;
    if (bruto && typeof bruto === 'object') {
      const id = (bruto as { id?: unknown }).id;
      if (typeof id === 'number') return id;
    }
  }
  return null;
}

/** Proprietario traduzido para uma pessoa conhecida, quando houver. */
export function pessoaDoProprietario(negocio: Negocio | undefined): string | null {
  const id = donoDoNegocio(negocio);
  return id === null ? null : (USUARIO_PARA_PESSOA.get(id) ?? null);
}

/**
 * Nome de exibicao do dono, direto do objeto `user_id` da v1 ({id, name, ...}).
 *
 * Serve para o forecast, que lista negocios de qualquer dono -- inclusive quem
 * nao esta em PESSOAS. Quando o dono e uma pessoa conhecida, prefira
 * `pessoaDoProprietario` + `nomeDaPessoa` para o nome sair padronizado; este
 * aqui e o fallback com o nome cru que a conta cadastrou.
 */
export function nomeDoProprietario(negocio: Negocio | undefined): string | null {
  if (!negocio) return null;
  const bruto = (negocio as { user_id?: unknown }).user_id;
  if (bruto && typeof bruto === 'object') {
    const name = (bruto as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
}

// -------------------------------------------------------------------- mock

type ModuloMock = typeof import('./mock');
let mockCarregado: ModuloMock | null = null;

async function mock(): Promise<ModuloMock> {
  if (!mockCarregado) mockCarregado = await import('./mock');
  return mockCarregado;
}
