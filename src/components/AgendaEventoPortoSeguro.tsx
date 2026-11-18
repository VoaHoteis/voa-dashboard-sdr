'use client';

import { useMemo } from 'react';
import { addDias } from '@/lib/dates';
import { useApi } from '@/components/base';
import type { AgendaEventoResposta, ItemAgendaEvento } from '@/lib/types';

const HORA_INICIO = 7;
const HORA_FIM = 19;
const ALTURA_HORA = 54;
const DURACAO_PADRAO = 60;

function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function duracaoEmMinutos(duracao: string | null): number {
  if (!duracao) return DURACAO_PADRAO;
  const [horas, minutosRestantes] = duracao.split(':').map(Number);
  const total = horas * 60 + minutosRestantes;
  return Number.isFinite(total) && total > 0 ? total : DURACAO_PADRAO;
}

function horaExibida(hora: string | null, duracao: string | null): string {
  if (!hora) return 'Horário a confirmar';
  const inicio = minutos(hora);
  const fim = inicio + duracaoEmMinutos(duracao);
  const horaFim = `${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`;
  return `${hora}–${horaFim}`;
}

function nomeDia(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${data}T12:00:00Z`))
    .replace('.', '')
    .toLocaleUpperCase('pt-BR');
}

function dataCurta(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${data}T12:00:00Z`)).replace('.', '');
}

function nomeDestino(destino: ItemAgendaEvento['destino']): string {
  if (destino === 'porto-seguro') return 'Porto Seguro';
  if (destino === 'arraial-dajuda') return "Arraial d’Ajuda";
  return 'Local a confirmar';
}

function classeDestino(destino: ItemAgendaEvento['destino']): string {
  return destino === 'nao-definido' ? 'agenda-evento--indefinido' : `agenda-evento--${destino}`;
}

function distribuirFaixas(itens: ItemAgendaEvento[]) {
  const comHorario = itens.filter((item) => item.hora).sort((a, b) => a.hora!.localeCompare(b.hora!));
  const faixas: Array<{ fim: number; itens: Array<{ item: ItemAgendaEvento; inicio: number; duracao: number }> }> = [];
  const resultado: Array<{ item: ItemAgendaEvento; inicio: number; duracao: number; faixa: number }> = [];

  for (const item of comHorario) {
    const inicio = minutos(item.hora!);
    const duracao = duracaoEmMinutos(item.duracao);
    let faixa = faixas.findIndex((candidata) => candidata.fim <= inicio);
    if (faixa < 0) {
      faixa = faixas.length;
      faixas.push({ fim: 0, itens: [] });
    }
    faixas[faixa].fim = inicio + duracao;
    faixas[faixa].itens.push({ item, inicio, duracao });
    resultado.push({ item, inicio, duracao, faixa });
  }

  const totalFaixas = Math.max(faixas.length, 1);
  return resultado.map((item) => ({ ...item, totalFaixas }));
}

function BlocoEvento({ item, faixa, totalFaixas }: {
  item: ItemAgendaEvento;
  faixa?: number;
  totalFaixas?: number;
}) {
  const faixaAtual = faixa ?? 0;
  const quantidadeFaixas = totalFaixas ?? 1;
  const hora = horaExibida(item.hora, item.duracao);

  return (
    <article
      className={`agenda-evento ${classeDestino(item.destino)}`}
      style={faixa === undefined ? undefined : {
        top: `${Math.max(0, Math.min(12 * 60, minutos(item.hora!) - HORA_INICIO * 60)) / 60 * ALTURA_HORA}px`,
        height: `${Math.max(38, duracaoEmMinutos(item.duracao) / 60 * ALTURA_HORA)}px`,
        left: `${faixaAtual / quantidadeFaixas * 100}%`,
        width: `${100 / quantidadeFaixas}%`,
      }}
      title={`${item.assunto}${item.negocio ? ` · ${item.negocio}` : ''} · ${hora}${item.local ? ` · ${item.local}` : ''}`}
    >
      <span className="agenda-evento__hora">{hora}</span>
      <strong>{item.assunto}</strong>
      {item.negocio && item.negocio !== item.assunto && <span>{item.negocio}</span>}
      {item.local && <span className="agenda-evento__local">{item.local}</span>}
    </article>
  );
}

export function AgendaEventoPortoSeguro() {
  const estado = useApi<AgendaEventoResposta>('/api/evento-porto-seguro/agenda');
  const dias = useMemo(() => {
    if (!estado.dados) return [];
    const lista: string[] = [];
    for (let data = estado.dados.inicio; data <= estado.dados.fim; data = addDias(data, 1)) {
      lista.push(data);
    }
    return lista;
  }, [estado.dados]);

  if (estado.carregando && !estado.dados) {
    return <section className="evento-distribuicao agenda-semanal" aria-label="Agenda do evento" aria-busy="true">
      <p className="evento-vazio">Carregando a agenda do evento…</p>
    </section>;
  }

  if (estado.erro && !estado.dados) {
    return <section className="evento-distribuicao agenda-semanal" aria-label="Agenda do evento">
      <div className="evento-vazio" role="alert">
        Não foi possível carregar os agendamentos. <button className="botao" onClick={estado.recarregar}>Tentar novamente</button>
      </div>
    </section>;
  }

  const itens = estado.dados?.itens ?? [];

  return (
    <section className="evento-distribuicao agenda-semanal" aria-labelledby="agenda-evento-titulo">
      <div className="evento-distribuicao__cabecalho agenda-semanal__cabecalho">
        <div>
          <h3 id="agenda-evento-titulo">Agenda do evento</h3>
          <p>Reuniões e atividades agendadas · 30 de novembro a 4 de dezembro de 2026</p>
        </div>
        <div className="agenda-legenda" aria-label="Legenda de destinos">
          <span><i className="agenda-legenda__cor agenda-legenda__cor--porto" />Porto Seguro</span>
          <span><i className="agenda-legenda__cor agenda-legenda__cor--arraial" />Arraial d’Ajuda</span>
          <span><i className="agenda-legenda__cor agenda-legenda__cor--indefinido" />A confirmar</span>
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="evento-vazio agenda-semanal__vazio">Nenhum agendamento encontrado para este período no Pipedrive.</p>
      ) : (
        <div className="agenda-semanal__rolagem" role="region" aria-label="Calendário de segunda a sexta-feira" tabIndex={0}>
          <div className="agenda-semanal__dias">
            {dias.map((dia) => {
              const itensDoDia = itens.filter((item) => item.data === dia);
              const comHorario = distribuirFaixas(itensDoDia);
              const semHorario = itensDoDia.filter((item) => !item.hora);
              return (
                <section className="agenda-dia" key={dia} aria-label={`${nomeDia(dia)}, ${dataCurta(dia)}`}>
                  <header className="agenda-dia__cabecalho">
                    <span>{nomeDia(dia)}</span>
                    <strong>{dataCurta(dia)}</strong>
                    <small>{itensDoDia.length} {itensDoDia.length === 1 ? 'agendamento' : 'agendamentos'}</small>
                  </header>
                  <div className="agenda-dia__corpo">
                    <div className="agenda-dia__horas" aria-hidden="true">
                      {Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, indice) => (
                        <span key={indice} style={{ top: `${indice * ALTURA_HORA - 7}px` }}>
                          {String(HORA_INICIO + indice).padStart(2, '0')}:00
                        </span>
                      ))}
                    </div>
                    <div className="agenda-dia__linha-tempo" style={{ height: `${(HORA_FIM - HORA_INICIO) * ALTURA_HORA}px` }}>
                      {comHorario.map(({ item, faixa, totalFaixas }) => (
                        <BlocoEvento key={item.atividadeId} item={item} faixa={faixa} totalFaixas={totalFaixas} />
                      ))}
                    </div>
                  </div>
                  {semHorario.length > 0 && (
                    <div className="agenda-dia__sem-horario">
                      <span className="agenda-dia__sem-horario-titulo">Horário a confirmar</span>
                      {semHorario.map((item) => <BlocoEvento key={item.atividadeId} item={item} />)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
