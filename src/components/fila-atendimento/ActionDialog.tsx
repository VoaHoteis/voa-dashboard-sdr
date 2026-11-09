'use client';

import { useId, useState, type FormEvent } from 'react';
import { isActionFormReady, QUEUE_REASONS } from '@/lib/fila-atendimento-core';
import type { QueueAction, QueueMember, QueueReason, QueueSource } from '@/lib/fila-atendimento-types';
import { QueueDialog } from './QueueDialog';

export function ActionDialog({
  action,
  member,
  queueVersion,
  onClose,
  onSuccess,
  onConflict,
}: {
  action: QueueAction;
  member: QueueMember;
  queueVersion: string;
  onClose: () => void;
  onSuccess: (action: QueueAction) => Promise<void>;
  onConflict: () => void;
}) {
  const sourceGroupId = useId();
  const [source, setSource] = useState<QueueSource | ''>('');
  const [link, setLink] = useState('');
  const [redirectedBy, setRedirectedBy] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [reason, setReason] = useState<QueueReason | ''>('');
  const [pending, setPending] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');

  const ready = isActionFormReady({ action, source, link, redirectedBy, hotelName, reason });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending || stale) return;

    setPending(true);
    setError('');
    const payload =
      action === 'assumir'
        ? source === 'kinbox'
          ? { action, expectedMemberKey: member.memberKey, expectedQueueVersion: queueVersion, source, link: link.trim() }
          : {
              action,
              expectedMemberKey: member.memberKey,
              expectedQueueVersion: queueVersion,
              source,
              redirectedBy: redirectedBy.trim(),
              hotelName: hotelName.trim(),
            }
        : { action, expectedMemberKey: member.memberKey, expectedQueueVersion: queueVersion, reason };

    try {
      const response = await fetch('/api/fila-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as { erro?: string };
      if (!response.ok) {
        setError(result.erro ?? 'Não foi possível registrar a ação. Ela não foi salva.');
        if (response.status === 409) {
          setStale(true);
          onConflict();
        }
        return;
      }
      await onSuccess(action);
    } catch {
      setError('Não foi possível confirmar o resultado. Atualize a fila antes de tentar novamente.');
      setStale(true);
      onConflict();
    } finally {
      setPending(false);
    }
  }

  return (
    <QueueDialog
      title={action === 'assumir' ? 'Assumir Atendimento' : 'Passar a Vez'}
      description={`Pessoa atualmente na vez: ${member.name}.`}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="queue-form" onSubmit={submit}>
        {action === 'assumir' ? (
          <fieldset className="queue-fieldset">
            <legend id={sourceGroupId}>Origem do atendimento</legend>
            <div className="queue-choice-list" role="radiogroup" aria-labelledby={sourceGroupId}>
              <label className="queue-choice">
                <input
                  type="radio"
                  name="source"
                  value="kinbox"
                  checked={source === 'kinbox'}
                  disabled={pending || stale}
                  onChange={() => {
                    setSource('kinbox');
                    setLink('');
                    setRedirectedBy('');
                    setHotelName('');
                    setError('');
                  }}
                />
                <span>Kinbox</span>
              </label>
              <label className="queue-choice">
                <input
                  type="radio"
                  name="source"
                  value="redirecionamento"
                  checked={source === 'redirecionamento'}
                  disabled={pending || stale}
                  onChange={() => {
                    setSource('redirecionamento');
                    setLink('');
                    setRedirectedBy('');
                    setHotelName('');
                    setError('');
                  }}
                />
                <span>Redirecionamento de outro setor</span>
              </label>
            </div>
          </fieldset>
        ) : (
          <label className="queue-field">
            <span>Motivo</span>
            <select value={reason} onChange={(event) => setReason(event.target.value as QueueReason | '')} required disabled={pending || stale}>
              <option value="" disabled>Selecione um motivo</option>
              {QUEUE_REASONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}

        {action === 'assumir' && source === 'kinbox' && (
          <label className="queue-field">
            <span>Link do atendimento</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="url"
              value={link}
              disabled={pending || stale}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://…"
              required
            />
          </label>
        )}

        {action === 'assumir' && source === 'redirecionamento' && (
          <>
            <label className="queue-field">
              <span>Quem direcionou</span>
              <input
                type="text"
                maxLength={160}
                value={redirectedBy}
                disabled={pending || stale}
                onChange={(event) => setRedirectedBy(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label className="queue-field">
              <span>Nome do hotel</span>
              <input
                type="text"
                maxLength={160}
                value={hotelName}
                disabled={pending || stale}
                onChange={(event) => setHotelName(event.target.value)}
                required
              />
            </label>
          </>
        )}

        <p className="queue-dialog__note">Responsável pela ação: Não informado.</p>
        {error && <p className="queue-message queue-message--error" role="alert">{error}</p>}
        <div className="queue-dialog__actions">
          <button type="button" className="queue-button queue-button--quiet" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" className="queue-button queue-button--primary" disabled={!ready || pending || stale}>
            {pending ? 'Salvando…' : 'Salvar e avançar fila'}
          </button>
        </div>
      </form>
    </QueueDialog>
  );
}
