'use client';

import Link from 'next/link';
import { useState } from 'react';

import { BotaoAtualizar, ProvedorAtualizacao, useApi } from '@/components/base';
import { ResumoMarketing, TabelaMarketing } from '@/components/TabelaMarketing';
import { hoje, parse } from '@/lib/dates';
import type { MarketingResposta } from '@/lib/marketing-tipos';

export default function Pagina() {
  return (
    <ProvedorAtualizacao>
      <Painel />
    </ProvedorAtualizacao>
  );
}

function Painel() {
  const anoAtual = parse(hoje()).y;
  const [ano, setAno] = useState(anoAtual);

  const estado = useApi<MarketingResposta>(`/api/marketing?ano=${ano}`);

  const anos = [anoAtual, anoAtual - 1, anoAtual - 2];

  return (
    <main className="pagina">
      <div className="topo">
        <div>
          <h1>Marketing Inbound</h1>
          <p className="sub">
            VOA Hotéis · Kinbox + Pipedrive + Windsor.ai ·{' '}
            <Link className="troca" href="/">
              ver metas de SDR
            </Link>{' '}
            ·{' '}
            <button
              className="sair"
              onClick={async () => {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login';
              }}
            >
              sair
            </button>
          </p>
        </div>

        <div className="filtro">
          {anos.map((a) => (
            <button key={a} data-ativo={ano === a} onClick={() => setAno(a)}>
              {a}
            </button>
          ))}
          <BotaoAtualizar />
        </div>
      </div>

      <div className="grade cheia">
        <ResumoMarketing estado={estado} />
      </div>

      <div className="grade cheia">
        <TabelaMarketing estado={estado} />
      </div>
    </main>
  );
}
