import { nomeDaPessoa, PESSOAS, SDR_FIELD_KEY } from './config';
import type { ISODate } from './dates';
import type { Atividade, Negocio } from './pipedrive-types';

const OPCOES_SDR = new Map<number, string>(
  PESSOAS.filter((pessoa) => pessoa.sdrOptionId !== undefined).map((pessoa) => [
    pessoa.sdrOptionId as number,
    pessoa.key,
  ])
);

const USUARIO_PARA_PESSOA = new Map<number, string>(
  PESSOAS.filter((pessoa) => pessoa.userId !== undefined).map((pessoa) => [
    pessoa.userId as number,
    pessoa.key,
  ])
);

export function registrarOpcaoSdr(id: number, pessoa: string): void {
  OPCOES_SDR.set(id, pessoa);
}

/** Usa o dia em que a atividade foi marcada como concluída, não a data agendada. */
export function dataConclusao(atividade: Atividade): ISODate | null {
  const marcadaEm = atividade.marked_as_done_time;
  return marcadaEm ? (marcadaEm.slice(0, 10) as ISODate) : null;
}

/** Um negócio associado a várias SDRs conta integralmente para cada uma. */
export function pessoasDoCampoSdr(negocio: Negocio | undefined): string[] {
  if (!negocio) return [];
  const bruto = negocio[SDR_FIELD_KEY];
  if (bruto === null || bruto === undefined || bruto === '') return [];

  const ids: number[] = Array.isArray(bruto)
    ? bruto.map((valor) => Number(typeof valor === 'object' && valor !== null ? (valor as { id?: unknown }).id : valor))
    : String(bruto)
        .split(',')
        .map((valor) => Number(valor.trim()));

  const pessoas: string[] = [];
  for (const id of ids) {
    const pessoa = OPCOES_SDR.get(id);
    if (pessoa && !pessoas.includes(pessoa)) pessoas.push(pessoa);
  }
  return pessoas;
}

/** Lê o proprietário nas formas v1 (objeto user_id) e v2 (owner_id numérico). */
export function donoDoNegocio(negocio: Negocio | undefined): number | null {
  if (!negocio) return null;

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

export function pessoaDoProprietario(negocio: Negocio | undefined): string | null {
  const id = donoDoNegocio(negocio);
  return id === null ? null : (USUARIO_PARA_PESSOA.get(id) ?? null);
}

export function nomeDoProprietario(negocio: Negocio | undefined): string | null {
  if (!negocio) return null;
  const pessoa = pessoaDoProprietario(negocio);
  if (pessoa) return nomeDaPessoa(pessoa);

  const bruto = (negocio as { user_id?: unknown }).user_id;
  if (bruto && typeof bruto === 'object') {
    const nome = (bruto as { name?: unknown }).name;
    if (typeof nome === 'string' && nome.trim()) return nome.trim();
  }
  return null;
}
