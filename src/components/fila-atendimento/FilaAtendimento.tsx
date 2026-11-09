'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import type { QueueAction, QueueMember, QueueSnapshot } from '@/lib/fila-atendimento-types';
import { ActionDialog } from './ActionDialog';
import { ManagementDialog } from './ManagementDialog';
import { QueueHistory, QueueMetrics, QueueWaitingList } from './QueuePanels';

const snapshotKey = '/api/fila-atendimento';

async function fetchSnapshot(url: string): Promise<QueueSnapshot> {
  const response = await fetch(url, { cache: 'no-store' });
  const result = (await response.json().catch(() => ({}))) as QueueSnapshot & { erro?: string };
  if (!response.ok) throw new Error(result.erro ?? 'Não foi possível carregar os dados da fila.');
  return result;
}

export default function FilaAtendimento() {
  const { data, error, isLoading, mutate } = useSWR<QueueSnapshot>(snapshotKey, fetchSnapshot);
  const [actionDialog, setActionDialog] = useState<{
    action: QueueAction;
    member: QueueMember;
    queueVersion: string;
  } | null>(null);
  const [managementOpen, setManagementOpen] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);

  function openAction(action: QueueAction) {
    const member = data?.queue[0];
    if (!member || !data) return;
    setNotice(null);
    setActionDialog({ action, member, queueVersion: data.queueVersion });
  }

  async function refreshSnapshot() {
    try {
      await mutate();
      setNotice({ message: 'Fila, histórico e indicadores atualizados.' });
    } catch {
      setNotice({ message: 'Não foi possível atualizar. Os dados anteriores foram mantidos.', error: true });
    }
  }

  async function completeAction(action: QueueAction) {
    setActionDialog(null);
    try {
      await mutate();
      setNotice({
        message: action === 'assumir' ? 'Atendimento registrado e fila avançada.' : 'Vez passada e fila avançada.',
      });
    } catch {
      setNotice({
        message: 'A operação foi registrada, mas não foi possível atualizar a tela. Use Atualizar para conferir a fila.',
        error: true,
      });
    }
  }

  async function completeManagement() {
    setManagementOpen(false);
    try {
      await mutate();
      setNotice({ message: 'Composição da fila salva e atualizada.' });
    } catch {
      setNotice({
        message: 'A composição foi salva, mas a tela não atualizou. Use Atualizar para carregar os dados mais recentes.',
        error: true,
      });
    }
  }

  return (
    <main className="queue-page" aria-busy={isLoading}>
      <header className="queue-page__header">
        <div className="queue-page__title-group">
          <Link href="/" className="queue-back-link">← Voltar à área Comercial</Link>
          <p className="queue-eyebrow">VOA Hotéis · Comercial / SDR</p>
          <h1>Fila de Atendimento</h1>
          <p className="queue-page__description">Distribuição sequencial, registro de atendimentos e acompanhamento da equipe.</p>
        </div>
        <button type="button" className="queue-button queue-button--quiet" onClick={() => void refreshSnapshot()} disabled={isLoading}>
          {isLoading ? 'Carregando…' : 'Atualizar'}
        </button>
      </header>

      {notice && (
        <p className={`queue-message ${notice.error ? 'queue-message--error' : 'queue-message--success'}`} role={notice.error ? 'alert' : 'status'}>
          {notice.message}
        </p>
      )}
      {error && data && (
        <p className="queue-message queue-message--error" role="alert">
          A atualização mais recente falhou. Os dados anteriores continuam visíveis.
        </p>
      )}

      {!data && isLoading ? (
        <section className="queue-surface queue-loading" aria-live="polite">Carregando fila, histórico e indicadores…</section>
      ) : !data ? (
        <section className="queue-surface queue-load-error" role="alert">
          <h2>Não foi possível abrir a fila</h2>
          <p>{error?.message ?? 'Verifique sua conexão e tente novamente.'}</p>
          <button type="button" className="queue-button queue-button--primary" onClick={() => void refreshSnapshot()}>
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          <div className="queue-page__top-grid">
            <QueueWaitingList queue={data.queue} />
            <section className="queue-surface queue-actions" aria-labelledby="queue-actions-title">
              <header className="queue-section-heading">
                <div>
                  <p className="queue-eyebrow">Próxima etapa</p>
                  <h2 id="queue-actions-title">Ações da fila</h2>
                </div>
              </header>
              <p className="queue-actions__description">
                As ações são salvas junto com o avanço da fila em uma única transação.
              </p>
              <div className="queue-actions__buttons">
                <button
                  type="button"
                  className="queue-button queue-button--primary queue-button--large"
                  onClick={() => openAction('assumir')}
                  disabled={data.queue.length === 0}
                >Assumir Atendimento</button>
                <button
                  type="button"
                  className="queue-button queue-button--outline queue-button--large"
                  onClick={() => openAction('passar_vez')}
                  disabled={data.queue.length === 0}
                >Passar a Vez</button>
                <button
                  type="button"
                  className="queue-button queue-button--quiet"
                  onClick={() => {
                    setNotice(null);
                    setManagementOpen(true);
                  }}
                >Gestão Usuários</button>
              </div>
              {data.queue.length === 0 && <p className="queue-actions__hint">Adicione alguém à fila para habilitar as ações.</p>}
            </section>
          </div>

          <QueueMetrics
            atendimentos={data.metrics.atendimentos}
            passadas={data.metrics.passadas}
            pessoas={data.metrics.pessoas}
            considered={data.metrics.considered}
            limit={data.metrics.limit}
          />
          <QueueHistory events={data.events} onMessage={(message) => setNotice({ message })} />
        </>
      )}

      {actionDialog && (
        <ActionDialog
          action={actionDialog.action}
          member={actionDialog.member}
          queueVersion={actionDialog.queueVersion}
          onClose={() => setActionDialog(null)}
          onSuccess={completeAction}
          onConflict={() => { void mutate(); }}
        />
      )}
      {managementOpen && data && (
        <ManagementDialog
          members={data.members}
          queue={data.queue}
          queueVersion={data.queueVersion}
          onClose={() => setManagementOpen(false)}
          onSuccess={completeManagement}
          onConflict={() => { void mutate(); }}
        />
      )}
    </main>
  );
}
