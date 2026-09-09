/**
 * Datas, feriados e dias uteis.
 *
 * Tudo circula como string 'YYYY-MM-DD' de proposito: o servidor pode rodar em
 * UTC e o time trabalha em Sao Paulo, e `new Date('2026-09-01')` em UTC-3 volta
 * para 31/08. String de data nao tem fuso, entao nao tem esse bug.
 */

export const TZ = 'America/Sao_Paulo';

export type ISODate = string; // 'YYYY-MM-DD'

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Hoje no fuso de Sao Paulo, nao no fuso do servidor. */
export function hoje(): ISODate {
  return fmt.format(new Date());
}

export function parse(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Dia da semana: 0 = domingo ... 6 = sabado. */
export function diaDaSemana(iso: ISODate): number {
  const { y, m, d } = parse(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDias(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parse(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function primeiroDiaDoMes(iso: ISODate): ISODate {
  const { y, m } = parse(iso);
  return toISO(y, m, 1);
}

export function ultimoDiaDoMes(iso: ISODate): ISODate {
  const { y, m } = parse(iso);
  return toISO(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}

export function listarDias(inicio: ISODate, fim: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = inicio; d <= fim; d = addDias(d, 1)) out.push(d);
  return out;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function nomeDoMes(iso: ISODate): string {
  return MESES[parse(iso).m - 1];
}

export function formatarBR(iso: ISODate): string {
  const { y, m, d } = parse(iso);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/**
 * Domingo de Pascoa pelo algoritmo de Meeus/Jones/Butcher (calendario
 * gregoriano). Dele saem Carnaval, Sexta-feira Santa e Corpus Christi, que sao
 * os feriados que mudam de data todo ano.
 */
function pascoa(ano: number): ISODate {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(ano, mes, dia);
}

const cacheFeriados = new Map<number, Set<ISODate>>();

/**
 * Feriados nacionais + estaduais/municipais do Rio de Janeiro, calculados para
 * qualquer ano. O prototipo tinha essa lista chumbada so para 2026; derivar da
 * Pascoa evita que o dashboard passe a mentir em 01/01/2027.
 *
 * Nao inclui pontos facultativos (quarta-feira de cinzas, vespera de Natal).
 */
export function feriados(ano: number): Set<ISODate> {
  const cached = cacheFeriados.get(ano);
  if (cached) return cached;

  const p = pascoa(ano);
  const set = new Set<ISODate>([
    toISO(ano, 1, 1),    // Confraternização Universal
    addDias(p, -48),     // Carnaval (segunda)
    addDias(p, -47),     // Carnaval (terça)
    addDias(p, -2),      // Sexta-feira Santa
    toISO(ano, 4, 21),   // Tiradentes
    toISO(ano, 4, 23),   // São Jorge (RJ)
    toISO(ano, 5, 1),    // Dia do Trabalho
    addDias(p, 60),      // Corpus Christi
    toISO(ano, 9, 7),    // Independência
    toISO(ano, 10, 12),  // Nossa Senhora Aparecida
    toISO(ano, 11, 2),   // Finados
    toISO(ano, 11, 15),  // Proclamação da República
    toISO(ano, 11, 20),  // Consciência Negra
    toISO(ano, 12, 25),  // Natal
  ]);

  cacheFeriados.set(ano, set);
  return set;
}

export function ehDiaUtil(iso: ISODate): boolean {
  const dow = diaDaSemana(iso);
  if (dow === 0 || dow === 6) return false;
  return !feriados(parse(iso).y).has(iso);
}

export function contarDiasUteis(inicio: ISODate, fim: ISODate): number {
  if (fim < inicio) return 0;
  return listarDias(inicio, fim).filter(ehDiaUtil).length;
}

export interface RitmoDoMes {
  totais: number;
  /** Dias uteis ja vividos, incluindo hoje. */
  decorridos: number;
  /** Dias uteis de hoje ate o fim do mes, incluindo hoje. */
  restantes: number;
  inicio: ISODate;
  fim: ISODate;
}

/**
 * Hoje conta como decorrido e como restante ao mesmo tempo, de proposito: o dia
 * ja comecou (o esperado ate agora ja o inclui) mas ainda da para trabalhar
 * nele (o ritmo necessario tambem).
 */
export function ritmoDoMes(ref: ISODate = hoje()): RitmoDoMes {
  const inicio = primeiroDiaDoMes(ref);
  const fim = ultimoDiaDoMes(ref);
  return {
    totais: contarDiasUteis(inicio, fim),
    decorridos: contarDiasUteis(inicio, ref < fim ? ref : fim),
    restantes: contarDiasUteis(ref > inicio ? ref : inicio, fim),
    inicio,
    fim,
  };
}

export interface Semana {
  label: string;
  inicio: ISODate;
  fim: ISODate;
}

/** Semanas do mes, quebradas na segunda-feira e recortadas nas bordas do mes. */
export function semanasDoMes(ref: ISODate = hoje()): Semana[] {
  const inicio = primeiroDiaDoMes(ref);
  const fim = ultimoDiaDoMes(ref);
  const out: Semana[] = [];

  let cursor = inicio;
  while (cursor <= fim) {
    const dow = diaDaSemana(cursor);
    const diasAteDomingo = dow === 0 ? 0 : 7 - dow;
    const candidato = addDias(cursor, diasAteDomingo);
    const semanaFim = candidato > fim ? fim : candidato;
    out.push({
      label: `${parse(cursor).d}–${parse(semanaFim).d}`,
      inicio: cursor,
      fim: semanaFim,
    });
    cursor = addDias(semanaFim, 1);
  }
  return out;
}
