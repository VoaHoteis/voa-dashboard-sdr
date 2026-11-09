'use client';

import { useState } from 'react';
import { QUEUE_REASONS } from '@/lib/fila-atendimento-core';
import type { QueueEvent, QueueMember, QueuePersonMetrics } from '@/lib/fila-atendimento-types';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const reasonLabels = Object.fromEntries(QUEUE_REASONS.map(({ value, label }) => [value, label]));

export function QueueWaitingList({ queue }: { queue: QueueMember[] }) {
  return (
    <section className="queue-surface" aria-labelledby="queue-waiting-title">
      <header className="queue-section-heading">
        <div>
          <p className="queue-eyebrow">Distribuição sequencial</p>
          <h2 id="queue-waiting-title">Fila de espera</h2>
        </div>
        <span className="queue-count">{queue.length} {queue.length === 1 ? 'pessoa' : 'pessoas'}</span>
      </header>
      {queue.length === 0 ? (
        <p className="queue-empty">A fila está vazia. Use “Gestão Usuários” para adicionar pessoas.</p>
      ) : (
        <ol className="queue-waiting-list">
          {queue.map((member, index) => (
            <li key={member.memberKey} data-current={index === 0}>
              <span className="queue-waiting-list__position">{String(index + 1).padStart(2, '0')}</span>
              <span className="queue-waiting-list__name">{member.name}</span>
              {index === 0 && <span className="queue-turn-badge">Na vez</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function QueueHistory({ events, onMessage }: { events: QueueEvent[]; onMessage: (message: string) => void }) {
  const [copyingId, setCopyingId] = useState<number | null>(null);

  async function copyLink(event: QueueEvent) {
    if (!event.link) return;
    setCopyingId(event.id);
    try {
      await navigator.clipboard.writeText(event.link);
      onMessage('Link Kinbox copiado.');
    } catch {
      onMessage('Não foi possível copiar o link neste navegador.');
    } finally {
      setCopyingId(null);
    }
  }

  return (
    <section className="queue-surface" aria-labelledby="queue-history-title">
      <header className="queue-section-heading">
        <div>
          <p className="queue-eyebrow">Registro cronológico</p>
          <h2 id="queue-history-title">Histórico da fila</h2>
        </div>
        <span className="queue-count">{events.length} / 100</span>
      </header>
      {events.length === 0 ? (
        <p className="queue-empty">Nenhum evento registrado. As próximas ações aparecerão aqui.</p>
      ) : (
        <ol className="queue-history-list">
          {events.map((event) => (
            <li key={event.id} className="queue-history-item">
              <div className="queue-history-item__mark" aria-hidden="true" />
              <div className="queue-history-item__body">
                <div className="queue-history-item__topline">
                  <strong>{event.queueMemberName}</strong>
                  <time dateTime={event.createdAt}>{dateFormatter.format(new Date(event.createdAt))}</time>
                </div>
                <p>
                  <span className="queue-history-item__action">
                    {event.action === 'assumir' ? 'Atendimento assumido' : 'Vez passada'}
                  </span>
                  {' · Responsável: '}{event.actorName?.trim() || 'Não informado'}
                </p>
                {event.action === 'assumir' && event.source === 'kinbox' && event.link && (
                  <div className="queue-history-item__details">
                    <span>Origem: Kinbox</span>
                    <a href={event.link} target="_blank" rel="noopener noreferrer">Abrir atendimento</a>
                    <button type="button" onClick={() => void copyLink(event)} disabled={copyingId === event.id}>
                      {copyingId === event.id ? 'Copiando…' : 'Copiar link'}
                    </button>
                  </div>
                )}
                {event.action === 'assumir' && event.source === 'redirecionamento' && (
                  <p className="queue-history-item__details">
                    Redirecionamento/Indicação · De: {event.redirectedBy} · Hotel: {event.hotelName}
                  </p>
                )}
                {event.action === 'passar_vez' && event.reason && (
                  <p className="queue-history-item__details">
                    Motivo: {reasonLabels[event.reason] ?? event.reason}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function QueueMetrics({
  atendimentos,
  passadas,
  pessoas,
  considered,
  limit,
}: {
  atendimentos: number;
  passadas: number;
  pessoas: QueuePersonMetrics[];
  considered: number;
  limit: number;
}) {
  return (
    <section className="queue-surface" aria-labelledby="queue-metrics-title">
      <header className="queue-section-heading">
        <div>
          <p className="queue-eyebrow">Desempenho por pessoa</p>
          <h2 id="queue-metrics-title">Painel de atendimento</h2>
        </div>
        <span className="queue-count">{considered} eventos</span>
      </header>
      <div className="queue-metric-totals">
        <article>
          <span>Atendimentos realizados</span>
          <strong>{atendimentos}</strong>
        </article>
        <article>
          <span>Passadas de vez</span>
          <strong>{passadas}</strong>
        </article>
      </div>
      <p className="queue-metrics-note">Indicadores calculados sobre os {limit.toLocaleString('pt-BR')} eventos mais recentes.</p>
      {considered === 0 ? (
        <p className="queue-empty">Ainda não há eventos suficientes para montar o painel.</p>
      ) : (
        <div className="queue-table-wrap" role="region" aria-label="Indicadores por pessoa; deslize horizontalmente em telas pequenas" tabIndex={0}>
          <table className="queue-metrics-table">
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Atendimentos</th>
                <th scope="col">Kinbox</th>
                <th scope="col">Redirecionamento/Indicação</th>
                <th scope="col">Passadas</th>
                <th scope="col">Ausência</th>
                <th scope="col">Folga</th>
                <th scope="col">Férias</th>
                <th scope="col">Vez Cedida</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((person) => (
                <tr key={person.memberKey}>
                  <th scope="row">{person.name}</th>
                  <td>{person.atendimentos}</td>
                  <td>{person.kinbox}</td>
                  <td>{person.redirecionamentos}</td>
                  <td>{person.passadas}</td>
                  <td>{person.motivos.ausencia}</td>
                  <td>{person.motivos.folga}</td>
                  <td>{person.motivos.ferias}</td>
                  <td>{person.motivos.vez_cedida}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
