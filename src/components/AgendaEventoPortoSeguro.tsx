'use client';

import { useMemo } from 'react';
import { addDias } from '@/lib/dates';
import { useApi } from '@/components/base';
import type { AgendaEventoResposta, ItemAgendaEvento } from '@/lib/types';

function nomeDia(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(`${data}T12:00:00Z`));
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
  return `agenda-evento--${destino}`;
}

function horario(hora: string | null): string {
  return hora ?? 'Horário a confirmar';
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
          <p>Negócios com a etiqueta Evento Porto Seguro · 30 de novembro a 4 de dezembro</p>
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="evento-vazio agenda-semanal__vazio">Nenhum agendamento de negócio com essa etiqueta no período.</p>
      ) : (
        <div className="agenda-semanal__dias">
          {dias.map((dia) => {
            const itensDoDia = itens.filter((item) => item.data === dia);
            return (
              <section className="agenda-dia" key={dia} aria-label={`${nomeDia(dia)}, ${dataCurta(dia)}`}>
                <header className="agenda-dia__cabecalho">
                  <strong>{nomeDia(dia)}</strong>
                  <span>{dataCurta(dia)}</span>
                  <small>{itensDoDia.length} {itensDoDia.length === 1 ? 'agendamento' : 'agendamentos'}</small>
                </header>
                {itensDoDia.length > 0 ? (
                  <ul className="agenda-dia__lista">
                    {itensDoDia.map((item) => (
                      <li className={`agenda-evento ${classeDestino(item.destino)}`} key={item.atividadeId}>
                        <time className="agenda-evento__hora" dateTime={`${item.data}T${item.hora ?? '00:00'}`}>
                          {horario(item.hora)}
                        </time>
                        <div className="agenda-evento__texto">
                          <strong>{item.negocio || item.assunto}</strong>
                          {item.negocio && item.assunto !== item.negocio && <span>{item.assunto}</span>}
                          {item.local && <span>{item.local}</span>}
                        </div>
                        <span className="agenda-evento__destino">{nomeDestino(item.destino)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="agenda-dia__vazio">Sem agendamentos</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
