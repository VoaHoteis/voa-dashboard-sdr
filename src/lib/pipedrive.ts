/**
 * Cliente REST do Pipedrive.
 *
 * Substitui a camada do prototipo, que pedia a um sub-agente Claude (via MCP)
 * para buscar e agregar os dados. Aqui as chamadas sao diretas e deterministicas:
 * o token nunca sai do servidor, nao ha limite de tokens para estourar e a
 * mesma pergunta sempre devolve o mesmo numero.
 */

import { FUNNEL_LABEL, PESSOAS, PIPELINES, SDR_FIELD_KEY } from './config';
import { addDias, type ISODate } from './dates';

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
    next_cursor?: string | null;
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
  /**
   * Quando a atividade foi marcada como concluida. Vem como "2026-09-05 14:03:00"
   * em UTC (ou null se ainda em aberto). E a base de contagem dos cards de
   * esforco: a pergunta e "quantas ligacoes a pessoa FEZ no dia", e o dia que
   * importa e o da realizacao, nao o que estava agendado na agenda.
   */
  marked_as_done_time: string | null;
  deal_id: number | null;
  user_id: number | null;
}

/**
 * Data de conclusao (`marked_as_done_time`), so a parte YYYY-MM-DD, ou null se
 * a atividade nao foi concluida.
 *
 * Como no resto do codigo (won_time, expected_close_date), comparamos so a parte
 * da data e aceitamos o fuso UTC: uma ligacao concluida perto da meia-noite pode
 * cair no dia vizinho. Para uma contagem diaria/mensal isso e aceitavel e evita
 * carregar conversao de fuso aqui.
 */
export function dataConclusao(a: Atividade): ISODate | null {
  const t = a.marked_as_done_time;
  if (!t) return null;
  return t.slice(0, 10) as ISODate;
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

  // A API v1 aceita um único tipo por chamada. Enviar uma lista separada por
  // vírgulas não aplica um filtro válido e pode ocultar todas as atividades.
  // O `end_date` da v1 não inclui o último dia: pedindo até 30/09, as reuniões
  // de 30/09 somem. Pedimos um dia a mais e recortamos por `due_date` aqui.
  const atividadesPorTipo = await Promise.all(
    [...new Set(opts.tipos)].map((type) =>
      buscarTudo<Atividade>(
        '/v1/activities',
        {
          user_id: opts.userId ?? 0,
          type,
          start_date: opts.inicio,
          end_date: addDias(opts.fim, 1),
          done: opts.concluidas ? 1 : 0,
        },
        100
      )
    )
  );

  const atividadesUnicas = new Map<number, Atividade>();
  for (const atividade of atividadesPorTipo.flat()) {
    const dia = atividade.due_date?.slice(0, 10);
    if (dia && (dia < opts.inicio || dia > opts.fim)) continue;
    atividadesUnicas.set(atividade.id, atividade);
  }

  return Array.from(atividadesUnicas.values());
}

function normalizarNome(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Chaves dos tipos de atividade de agendamento: as fixas mais qualquer tipo
 * cadastrado com o nome "Reunião de Apresentação". A chave de um tipo
 * personalizado é gerada pelo Pipedrive e pode não bater com a lista fixa.
 */
export async function resolverTiposAgendamento(fixos: readonly string[]): Promise<string[]> {
  if (modoMock()) return [...fixos];
  const tipos = await buscarTudo<{ key_string: string; name: string; active_flag: boolean }>(
    '/v1/activityTypes',
    {}
  );
  const porNome = tipos
    .filter((t) => normalizarNome(t.name ?? '') === 'reuniao de apresentacao')
    .map((t) => t.key_string);
  return [...new Set([...fixos, ...porNome])];
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
  await garantirOpcoesSdr();

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
  await garantirOpcoesSdr();

  const todos = await buscarTudo<Negocio>('/v1/deals', { status: 'won', user_id: 0 });
  return todos.filter((d) => {
    const wt = (d as { won_time?: string | null }).won_time;
    if (!wt) return false;
    const dia = wt.slice(0, 10);
    return dia >= opts.inicio && dia <= opts.fim;
  });
}

export interface DefinicaoCampoNegocio {
  key: string;
  options: { id: number; label: string }[];
}

/** Resolve um campo personalizado pelo rótulo exibido no Pipedrive. */
export async function buscarCampoNegocioPorNome(
  nome: string,
  negocios: Negocio[] = []
): Promise<DefinicaoCampoNegocio> {
  if (modoMock()) {
    const chavesMock: Record<string, string> = {
      CANAL: 'channel',
      CHANNEL: 'channel_manager_mock',
      PMS: 'pms_mock',
    };
    const key = chavesMock[nome.trim().toUpperCase()];
    if (key) return { key, options: [] };
    throw new PipedriveError(`O campo personalizado "${nome}" não foi encontrado nos dados de exemplo.`);
  }

  const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const campos = await buscarTudo<{
    key: string;
    name: string;
    options?: { id: number; label: string }[] | null;
  }>('/v1/dealFields', {}, 100);
  const correspondentes = campos.filter((item) => normalizar(item.name) === normalizar(nome));
  const idDaOpcao = (valor: unknown): number | null => {
    if (Array.isArray(valor)) {
      return valor.map(idDaOpcao).find((id): id is number => id !== null) ?? null;
    }
    if (typeof valor === 'number' && Number.isSafeInteger(valor)) return valor;
    if (typeof valor === 'string' && /^\d+$/.test(valor.trim())) return Number(valor.trim());
    if (valor && typeof valor === 'object') {
      const campo = valor as { id?: unknown; value?: unknown };
      return idDaOpcao(campo.id ?? campo.value);
    }
    return null;
  };
  const valorCampo = (negocio: Negocio, key: string): unknown => {
    const camposNegocio = negocio as Record<string, unknown>;
    const personalizados = camposNegocio.custom_fields as Record<string, unknown> | undefined;
    return camposNegocio[key] ?? personalizados?.[key];
  };
  const pontuacao = (campo: (typeof correspondentes)[number]) => {
    const ids = new Set((campo.options ?? []).map((opcao) => Number(opcao.id)));
    return negocios.reduce((total, negocio) => {
      const id = idDaOpcao(valorCampo(negocio, campo.key));
      return total + (id !== null && ids.has(id) ? 1 : 0);
    }, 0);
  };
  const campo = [...correspondentes].sort(
    (a, b) => pontuacao(b) - pontuacao(a) || (b.options?.length ?? 0) - (a.options?.length ?? 0)
  )[0];

  if (!campo) {
    throw new PipedriveError(`O campo personalizado "${nome}" não foi encontrado no Pipedrive.`);
  }

  return { key: campo.key, options: campo.options ?? [] };
}

function textoCampoOrigem(valor: unknown, opcoes: Map<number, string>): string | null {
  const comoTexto = (candidato: unknown): string | null => {
    if (typeof candidato === 'number') return opcoes.get(candidato) ?? String(candidato);
    if (typeof candidato !== 'string' || !candidato.trim()) return null;

    const texto = candidato.trim();
    const id = Number(texto);
    return Number.isSafeInteger(id) ? opcoes.get(id) ?? texto : texto;
  };

  const textoDireto = comoTexto(valor);
  if (textoDireto) return textoDireto;
  if (!valor || typeof valor !== 'object') return null;

  const campo = valor as { id?: unknown; name?: unknown; label?: unknown; value?: unknown };
  for (const candidato of [campo.name, campo.label, campo.value, campo.id]) {
    const texto = comoTexto(candidato);
    if (texto) return texto;
  }
  return null;
}

function valoresCampoNegocio(valor: unknown, opcoes: Map<number, string>): string[] {
  if (Array.isArray(valor)) return valor.flatMap((item) => valoresCampoNegocio(item, opcoes));

  if (valor && typeof valor === 'object') {
    const campo = valor as { value?: unknown; values?: unknown };
    if (Array.isArray(campo.value)) return valoresCampoNegocio(campo.value, opcoes);
    if (Array.isArray(campo.values)) return valoresCampoNegocio(campo.values, opcoes);
  }

  if (typeof valor === 'string' && valor.includes(',')) {
    return valor.split(',').flatMap((item) => valoresCampoNegocio(item, opcoes));
  }

  const texto = textoCampoOrigem(valor, opcoes);
  return texto ? [texto] : [];
}

/** Conta negócios com campo preenchido por opção ou texto personalizado. */
export async function contarNegociosPorCampo(
  negocios: Negocio[],
  nome: string
): Promise<Array<{ nome: string; quantidade: number }>> {
  const campo = await buscarCampoNegocioPorNome(nome, negocios);
  const opcoes = new Map(campo.options.map((opcao) => [Number(opcao.id), opcao.label]));
  const contagens = new Map<string, number>();

  for (const negocio of negocios) {
    const camposNegocio = negocio as Record<string, unknown>;
    const personalizados = camposNegocio.custom_fields as Record<string, unknown> | undefined;
    const valores = new Set(
      valoresCampoNegocio(camposNegocio[campo.key] ?? personalizados?.[campo.key], opcoes)
    );
    if (valores.size === 0) continue;

    for (const valor of valores) contagens.set(valor, (contagens.get(valor) ?? 0) + 1);
  }

  return [...contagens.entries()]
    .map(([valor, quantidade]) => ({ nome: valor, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Resolve o campo CANAL para cada negócio, usado como origem do lead nas listas. */
export async function buscarOrigensDosNegocios(
  negocios: Negocio[]
): Promise<Map<number, string | null>> {
  if (negocios.length === 0) return new Map();

  const campoCanal = await buscarCampoNegocioPorNome('CANAL', negocios);
  const opcoes = new Map(campoCanal.options.map((opcao) => [Number(opcao.id), opcao.label]));

  return new Map(
    negocios.map((negocio) => {
      const campos = negocio as Record<string, unknown>;
      const personalizados = campos.custom_fields as Record<string, unknown> | undefined;
      const origem = textoCampoOrigem(campos[campoCanal.key] ?? personalizados?.[campoCanal.key], opcoes);
      return [negocio.id, origem];
    })
  );
}

/**
 * Primeira e mais recente data de apresentação antes da assinatura de cada negócio.
 * A API v2 filtra por deal_id, então limitamos a concorrência e usamos cursor
 * para consultar todo o histórico sem varrer as atividades da conta.
 */
export async function buscarAgendamentosPorNegocio(
  negocios: Negocio[],
  tipos: readonly string[]
): Promise<Map<number, { primeiro: ISODate; maisRecente: ISODate }>> {
  const tiposUnicos = [...new Set(tipos)];
  if (modoMock()) return (await mock()).agendamentosPorNegocioFalsos(negocios);

  const resultado = new Map<number, { primeiro: ISODate; maisRecente: ISODate }>();
  let indice = 0;
  const trabalhadores = Array.from({ length: Math.min(4, negocios.length) }, async () => {
    while (indice < negocios.length) {
      const negocio = negocios[indice++];
      const assinatura = (negocio as { won_time?: string | null }).won_time?.slice(0, 10);
      if (!assinatura) continue;

      const chaveCache = '/v2/activities?deal_id=' + negocio.id + '&types=' + tiposUnicos.join(',') + '&won_time=' + assinatura + '&ciclo=2';
      const hit = cache.get(chaveCache);
      if (hit && Date.now() - hit.em < TTL_MS) {
        const datas = hit.valor as { primeiro: ISODate; maisRecente: ISODate } | null;
        if (datas) resultado.set(negocio.id, datas);
        continue;
      }

      let cursor: string | undefined;
      let primeira: ISODate | null = null;
      let maisRecente: ISODate | null = null;
      for (let pagina = 0; pagina < 60; pagina++) {
        const resposta = await chamar<Atividade>('/v2/activities', {
          deal_id: negocio.id,
          limit: 500,
          cursor,
        });
        for (const atividade of resposta.data ?? []) {
          const data = atividade.due_date?.slice(0, 10) as ISODate | undefined;
          if (!data || data > assinatura || !tiposUnicos.includes(atividade.type)) continue;
          if (!primeira || data < primeira) primeira = data;
          if (!maisRecente || data > maisRecente) maisRecente = data;
        }
        const proximoCursor = resposta.additional_data?.next_cursor;
        if (!proximoCursor) break;
        cursor = proximoCursor;
      }

      const datas = primeira && maisRecente ? { primeiro: primeira, maisRecente } : null;
      cache.set(chaveCache, { em: Date.now(), valor: datas });
      if (datas) resultado.set(negocio.id, datas);
    }
  });

  await Promise.all(trabalhadores);
  return resultado;
}

/**
 * Negocios PERDIDOS no periodo, para a contagem de hoteis perdidos no funil.
 *
 * Mesmo padrao da busca de ganhos: a v1 nao filtra por data de perda, entao
 * pedimos todos os `status=lost` (paginado, com o cache de 60s) e recortamos por
 * `lost_time` em memoria. `lost_time` vem como "2026-09-05 14:03:00" em UTC; como
 * no resto do codigo, comparamos so a parte da data -- perto da virada de dia uma
 * perda pode cair no dia vizinho, aceitavel para uma contagem mensal e evita
 * carregar conversao de fuso aqui.
 *
 * A v1 e de proposito: ela devolve `lost_time`, `pipeline_id` e o dono em
 * `user_id` (objeto), que e tudo de que a contagem por SDR precisa -- a
 * atribuicao no funil e pelo proprietario, igual as etapas.
 */
export async function buscarNegociosPerdidos(opts: {
  inicio: ISODate;
  fim: ISODate;
}): Promise<Negocio[]> {
  if (modoMock()) return (await mock()).negociosPerdidosFalsos(opts);
  await garantirOpcoesSdr();

  const todos = await buscarTudo<Negocio>('/v1/deals', { status: 'lost', user_id: 0 });
  return todos.filter((d) => {
    const lt = (d as { lost_time?: string | null }).lost_time;
    if (!lt) return false;
    const dia = lt.slice(0, 10);
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
  await garantirOpcoesSdr();
  return buscarTudo<Negocio>('/v1/deals', { status: 'open', user_id: 0 });
}

export interface MetricasEventoPortoSeguro {
  leads: number;
  negociosAbertos: number;
  negociosPorProprietario: Array<{ nome: string; total: number }>;
  negociosPorEtapa: Array<{ funil: string; etapa: string; ordem: number; total: number }>;
}

interface EntidadeComEtiquetas {
  label?: unknown;
  label_ids?: unknown;
  labels?: unknown;
  [campo: string]: unknown;
}

interface EtiquetaPipedrive {
  id?: string | number;
  name?: string;
  label?: string;
}

function valorTemEtiqueta(
  valor: unknown,
  ids: Set<string>,
  nomeNormalizado: string
): boolean {
  if (Array.isArray(valor)) {
    return valor.some((item) => valorTemEtiqueta(item, ids, nomeNormalizado));
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    const texto = String(valor).trim();
    return ids.has(texto) || normalizarNome(texto) === nomeNormalizado;
  }
  if (valor && typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>;
    return ['id', 'name', 'label', 'value', 'values'].some((chave) =>
      valorTemEtiqueta(objeto[chave], ids, nomeNormalizado)
    );
  }
  return false;
}

function entidadeTemEtiqueta(
  entidade: EntidadeComEtiquetas,
  ids: Set<string>,
  nomeNormalizado: string
): boolean {
  return [entidade.label_ids, entidade.label, entidade.labels].some((valor) =>
    valorTemEtiqueta(valor, ids, nomeNormalizado)
  );
}

/** Conta negócios etiquetados por proprietário e por etapa dos funis acompanhados. */
function resumirNegociosDoEvento(
  negocios: Negocio[],
  gruposEtapas: Array<{ funil: string; pipelineId: number; etapas: EtapaPipeline[] }>
): Pick<MetricasEventoPortoSeguro, 'negociosPorProprietario' | 'negociosPorEtapa'> {
  const contagemPorProprietario = new Map<string, number>();

  for (const negocio of negocios) {
    const nome = nomeDoProprietario(negocio) ?? 'Sem proprietário';
    contagemPorProprietario.set(nome, (contagemPorProprietario.get(nome) ?? 0) + 1);
  }

  return {
    negociosPorProprietario: [...contagemPorProprietario.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR')),
    negociosPorEtapa: gruposEtapas.flatMap(({ funil, pipelineId, etapas }) => {
      const porEtapa = new Map<string, { funil: string; etapa: string; ordem: number; total: number }>();

      for (const etapa of etapas) {
        const total = negocios.filter(
          (negocio) => negocio.pipeline_id === pipelineId && negocio.stage_id === etapa.id
        ).length;
        const existente = porEtapa.get(etapa.nome);

        if (existente) {
          existente.total += total;
        } else {
          porEtapa.set(etapa.nome, { funil, etapa: etapa.nome, ordem: etapa.ordem, total });
        }
      }

      return [...porEtapa.values()].sort((a, b) => a.ordem - b.ordem);
    }),
  };
}

/** Conta leads ativos e negócios abertos com a etiqueta do evento. */
export async function buscarMetricasEventoPortoSeguro(): Promise<MetricasEventoPortoSeguro> {
  if (modoMock()) {
    const [moduloMock, etapasNovosNegocios, etapasSalabim] = await Promise.all([
      mock(),
      buscarEtapasDoPipeline(PIPELINES.novosNegocios),
      buscarEtapasDoPipeline(PIPELINES.salabim),
    ]);
    const negociosDeExemplo = (await moduloMock.negociosAbertosFalsos()).slice(0, 6);
    const gruposEtapas = [
      {
        funil: FUNNEL_LABEL.novosNegocios,
        pipelineId: PIPELINES.novosNegocios,
        etapas: etapasNovosNegocios,
      },
      { funil: FUNNEL_LABEL.salabim, pipelineId: PIPELINES.salabim, etapas: etapasSalabim },
    ];

    return {
      leads: 14,
      negociosAbertos: negociosDeExemplo.length,
      ...resumirNegociosDoEvento(negociosDeExemplo, gruposEtapas),
    };
  }

  const nomeEtiqueta = 'EVENTO PORTO SEGURO';
  const nomeNormalizado = normalizarNome(nomeEtiqueta);
  const [leads, etiquetasLead, camposNegocio, negociosAbertos, etapasNovosNegocios, etapasSalabim] =
    await Promise.all([
      buscarTudo<(EntidadeComEtiquetas & { id: string | number })>('/v1/leads', {}, 100),
      buscarTudo<EtiquetaPipedrive>('/v1/leadLabels', {}, 100),
      buscarTudo<{
        key: string;
        options?: EtiquetaPipedrive[] | null;
      }>('/v1/dealFields', {}, 100),
      buscarNegociosAbertos(),
      buscarEtapasDoPipeline(PIPELINES.novosNegocios),
      buscarEtapasDoPipeline(PIPELINES.salabim),
    ]);

  const idsLead = new Set(
    etiquetasLead
      .filter((etiqueta) => normalizarNome(etiqueta.name ?? etiqueta.label ?? '') === nomeNormalizado)
      .map((etiqueta) => String(etiqueta.id ?? ''))
      .filter(Boolean)
  );
  const idsNegocio = new Set(
    camposNegocio
      .filter((campo) => campo.key === 'label' || campo.key === 'label_ids')
      .flatMap((campo) => campo.options ?? [])
      .filter((etiqueta) => normalizarNome(etiqueta.label ?? etiqueta.name ?? '') === nomeNormalizado)
      .map((etiqueta) => String(etiqueta.id ?? ''))
      .filter(Boolean)
  );

  const totalLeads = leads.filter((lead) => entidadeTemEtiqueta(lead, idsLead, nomeNormalizado)).length;
  const negociosComEtiqueta = negociosAbertos.filter((negocio) =>
    entidadeTemEtiqueta(negocio, idsNegocio, nomeNormalizado)
  );

  if (idsLead.size === 0 && idsNegocio.size === 0 && totalLeads === 0 && negociosComEtiqueta.length === 0) {
    throw new PipedriveError(`A etiqueta "${nomeEtiqueta}" não foi encontrada no Pipedrive.`);
  }

  const gruposEtapas = [
    {
      funil: FUNNEL_LABEL.novosNegocios,
      pipelineId: PIPELINES.novosNegocios,
      etapas: etapasNovosNegocios,
    },
    { funil: FUNNEL_LABEL.salabim, pipelineId: PIPELINES.salabim, etapas: etapasSalabim },
  ];

  return {
    leads: totalLeads,
    negociosAbertos: negociosComEtiqueta.length,
    ...resumirNegociosDoEvento(negociosComEtiqueta, gruposEtapas),
  };
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

export interface EtapaPipeline {
  id: number;
  nome: string;
  ordem: number;
}

export async function buscarEtapasDoPipeline(pipelineId: number): Promise<EtapaPipeline[]> {
  if (modoMock()) {
    const linhas = await (await mock()).etapasDoFunilFalsas(pipelineId);
    return linhas.map(({ id, name, order_nr }) => ({ id, nome: name, ordem: order_nr }));
  }

  const linhas = await buscarTudo<{
    id: number;
    name: string;
    pipeline_id: number;
    order_nr: number;
  }>('/v1/stages', { pipeline_id: pipelineId });

  return linhas
    .filter((etapa) => etapa.pipeline_id === pipelineId)
    .map(({ id, name, order_nr }) => ({ id, nome: name, ordem: order_nr }))
    .sort((a, b) => a.ordem - b.ordem);
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
  await garantirOpcoesSdr();

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
 *
 * Sobe TODO o bloco `custom_fields` para o topo do objeto (nao so o SDR): assim
 * campos como "Quantidade UH" tambem ficam legiveis pelo mesmo caminho da v1,
 * sem precisar saber cada chave aqui. As chaves sao hashes de 40 caracteres,
 * entao nao colidem com campos nativos como `id`/`title`.
 */
function normalizarNegocioV2(d: Negocio): Negocio {
  const custom = (d as { custom_fields?: Record<string, unknown> }).custom_fields;
  if (!custom) return d;
  return { ...d, ...custom };
}

// ------------------------------------------------------------ atribuicao SDR

const OPCAO_PARA_PESSOA = new Map<number, string>(
  PESSOAS.filter((p) => p.sdrOptionId !== undefined).map((p) => [p.sdrOptionId as number, p.key])
);

let opcoesSdrResolvidasEm = 0;

/**
 * Completa `OPCAO_PARA_PESSOA` para quem so tem `sdrOptionNome` (id da opcao
 * ainda desconhecido), buscando as opcoes do campo SDR em `/v1/dealFields` e
 * casando pelo rotulo (sem acento/caixa; aceita rotulo que comece pelo nome,
 * ex.: "Maria Eduarda Souza"). Cacheado por 5 min. Falha aqui nao derruba o
 * dashboard: a pessoa so fica sem atribuicao ate a proxima tentativa.
 */
export async function garantirOpcoesSdr(): Promise<void> {
  if (modoMock()) return;
  const pendentes = PESSOAS.filter((p) => p.sdrOptionNome && p.sdrOptionId === undefined);
  if (pendentes.length === 0) return;
  if (Date.now() - opcoesSdrResolvidasEm < 5 * 60_000) return;

  try {
    const campos = await buscarTudo<{
      key: string;
      options?: { id: number; label: string }[] | null;
    }>('/v1/dealFields', {}, 100);
    const opcoes = campos.find((c) => c.key === SDR_FIELD_KEY)?.options ?? [];

    for (const p of pendentes) {
      const alvo = normalizarNome(p.sdrOptionNome as string);
      const opcao =
        opcoes.find((o) => normalizarNome(o.label ?? '') === alvo) ??
        opcoes.find((o) => normalizarNome(o.label ?? '').startsWith(alvo));
      if (opcao) {
        OPCAO_PARA_PESSOA.set(opcao.id, p.key);
      } else {
        console.warn(`[sdr] Opção "${p.sdrOptionNome}" não encontrada no campo SDR do Pipedrive.`);
      }
    }
    opcoesSdrResolvidasEm = Date.now();
  } catch (e) {
    console.warn('[sdr] Falha ao resolver opções do campo SDR:', (e as Error).message);
  }
}

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

// ------------------------------------------------------------ quantidade UH

/**
 * Nome do campo personalizado de unidades habitacionais, como cadastrado no
 * Pipedrive. Confirmado com o time: "Quantidade UH".
 */
const NOME_CAMPO_UH = 'quantidade uh';

let chaveUhCache: { em: number; valor: string | null } | null = null;

/**
 * Chave interna do campo "Quantidade UH".
 *
 * Todo campo personalizado tem um hash de 40 caracteres como chave, que varia de
 * conta para conta -- por isso resolvemos pelo NOME em runtime (via
 * `/v1/dealFields`) em vez de cravar o hash no codigo. Cacheado por 5 min: a
 * definicao de campo quase nunca muda, entao nao vale uma chamada por request.
 * Devolve null se a conta nao tiver um campo com esse nome (a coluna some em vez
 * de quebrar).
 */
export async function resolverChaveCampoUh(): Promise<string | null> {
  if (modoMock()) return (await mock()).CHAVE_UH_MOCK;

  if (chaveUhCache && Date.now() - chaveUhCache.em < 5 * 60_000) return chaveUhCache.valor;

  const campos = await buscarTudo<{ key: string; name: string }>('/v1/dealFields', {}, 100);
  const alvo = campos.find((c) => (c.name ?? '').trim().toLowerCase() === NOME_CAMPO_UH);
  const valor = alvo?.key ?? null;
  chaveUhCache = { em: Date.now(), valor };
  return valor;
}

/**
 * Quantidade de U.Hs do negocio, ou null quando nao ha negocio, o campo esta
 * vazio ou a conta nao tem o campo. Aceita numero, string ("120") e o formato
 * objeto `{ value }` que a v2 as vezes usa para campo numerico.
 */
export function quantidadeUhDoNegocio(
  negocio: Negocio | undefined,
  uhKey: string | null
): number | null {
  if (!negocio || !uhKey) return null;
  const bruto = negocio[uhKey];
  if (bruto === null || bruto === undefined || bruto === '') return null;
  const cru =
    typeof bruto === 'object' && bruto !== null ? (bruto as { value?: unknown }).value : bruto;
  const n = Number(cru);
  return Number.isFinite(n) ? n : null;
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
