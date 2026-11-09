'use client';

import { useState, type FormEvent } from 'react';
import type { QueueMember } from '@/lib/fila-atendimento-types';
import { QueueDialog } from './QueueDialog';

export function ManagementDialog({
  members,
  queue,
  queueVersion,
  onClose,
  onSuccess,
  onConflict,
}: {
  members: QueueMember[];
  queue: QueueMember[];
  queueVersion: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  onConflict: () => void;
}) {
  const [orderedKeys, setOrderedKeys] = useState(() => queue.map(({ memberKey }) => memberKey));
  const [pending, setPending] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');

  const queueMembers = orderedKeys
    .map((key) => members.find((member) => member.memberKey === key))
    .filter((member): member is QueueMember => Boolean(member));
  const queuedKeys = new Set(orderedKeys);
  const availableMembers = members.filter((member) => member.isEligible && !queuedKeys.has(member.memberKey));

  function moveMember(index: number, direction: -1 | 1) {
    setOrderedKeys((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || stale) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/fila-atendimento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberKeys: orderedKeys, expectedQueueVersion: queueVersion }),
      });
      const result = (await response.json().catch(() => ({}))) as { erro?: string };
      if (!response.ok) {
        setError(result.erro ?? 'Não foi possível salvar a fila. Nenhuma alteração foi salva.');
        if (response.status === 409) {
          setStale(true);
          onConflict();
        }
        return;
      }
      await onSuccess();
    } catch {
      setError('Não foi possível confirmar o salvamento. A ordem escolhida foi preservada; atualize antes de tentar novamente.');
      setStale(true);
      onConflict();
    } finally {
      setPending(false);
    }
  }

  return (
    <QueueDialog
      title="Gestão de Usuários da Fila"
      description="Escolha quem participa da fila e organize a ordem da próxima vez."
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="queue-form" onSubmit={save}>
        <div className="queue-management__columns">
          <section className="queue-management__list" aria-labelledby="queue-selected-title">
            <header>
              <h3 id="queue-selected-title">Na fila</h3>
              <span>{queueMembers.length}</span>
            </header>
            {queueMembers.length === 0 ? (
              <p className="queue-empty queue-empty--small">Fila vazia. Adicione usuários ou salve assim para pausar a distribuição.</p>
            ) : (
              <ol className="queue-management__items">
                {queueMembers.map((member, index) => (
                  <li key={member.memberKey}>
                    <span className="queue-management__position">{index + 1}</span>
                    <span className="queue-management__name">{member.name}</span>
                    <div className="queue-management__controls">
                      <button
                        type="button"
                        className="queue-icon-button"
                        aria-label={`Mover ${member.name} para cima`}
                        onClick={() => moveMember(index, -1)}
                        disabled={pending || stale || index === 0}
                      >↑</button>
                      <button
                        type="button"
                        className="queue-icon-button"
                        aria-label={`Mover ${member.name} para baixo`}
                        onClick={() => moveMember(index, 1)}
                        disabled={pending || stale || index === queueMembers.length - 1}
                      >↓</button>
                      <button
                        type="button"
                        className="queue-icon-button queue-icon-button--remove"
                        disabled={pending || stale}
                        aria-label={`Remover ${member.name} da fila`}
                        onClick={() => setOrderedKeys((current) => current.filter((key) => key !== member.memberKey))}
                      >−</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="queue-management__list" aria-labelledby="queue-available-title">
            <header>
              <h3 id="queue-available-title">Disponíveis</h3>
              <span>{availableMembers.length}</span>
            </header>
            {availableMembers.length === 0 ? (
              <p className="queue-empty queue-empty--small">Todos os membros disponíveis já estão na fila.</p>
            ) : (
              <ul className="queue-management__items">
                {availableMembers.map((member) => (
                  <li key={member.memberKey}>
                    <span className="queue-management__name">{member.name}</span>
                    <button
                      type="button"
                      className="queue-button queue-button--quiet queue-button--small"
                      disabled={pending || stale}
                      onClick={() => setOrderedKeys((current) => [...current, member.memberKey])}
                    >Adicionar</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {error && <p className="queue-message queue-message--error" role="alert">{error}</p>}
        <div className="queue-dialog__actions">
          <button type="button" className="queue-button queue-button--quiet" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" className="queue-button queue-button--primary" disabled={pending || stale}>
            {pending ? 'Salvando…' : 'Salvar composição'}
          </button>
        </div>
      </form>
    </QueueDialog>
  );
}
