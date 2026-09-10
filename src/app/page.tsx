'use client';

import { useMemo, useState } from 'react';
import { UNIDADE_PADRAO, type UnidadeContagem } from '@/lib/config';
import {
  addDias,
  formatarBR,
  hoje,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
  type ISODate,
} from '@/lib/dates';
import { BotaoAtualizar, ProvedorAtualizacao, useApi } from '@/components/base';
import { CardAgendamentoPorSdr, CardAgendamentosTotais } from '@/components/CardsAgendamentos';
import { CardDetalhamentoSdr, CardFunilSdr } from '@/components/CardsSdr';
import { CardFechamentos } from '@/components/CardFechamentos';
import { CardForecast } from '@/components/CardForecast';
import { CardNoShows } from '@/components/CardNoShows';
import {
  CardAgendamentosFuturos,
  CardsAtividadesSemana,
} from '@/components/CardsFuturosAtividades';
import type { AgendamentosResposta, FuturosResposta } from '@/lib/types';

type Atalho = 'este-mes' | 'mes-passado' | 'ultimos-30' | 'custom';

function intervalo(atalho: Atalho, ref: ISODate): { inicio: ISODate; fim: ISODate } {
  switch (atalho) {
    case 'mes-passado': {
      const fim = addDias(primeiroDiaDoMes(ref), -1);
      return { inicio: primeiroDiaDoMes(fim), fim };
    }
    case 'ultimos-30':
      return { inicio: addDias(ref, -29), fim: ref };
    default:
      return { inicio: primeiroDiaDoMes(ref), fim: ultimoDiaDoMes(ref) };
  }
}

export default function Pagina() {
  // O provedor precisa envolver todos os cards para o botao unico alcancar
  // tambem os que fazem a propria busca (funil, futuros, atividades).
  return (
    <ProvedorAtualizacao>
      <Painel />
    </ProvedorAtualizacao>
  );
}

function Painel() {
  const ref = hoje();
  const [atalho, setAtalho] = useState<Atalho>('este-mes');
  const [custom, setCustom] = useState(() => intervalo('este-mes', ref));
  const [unidade, setUnidade] = useState<UnidadeContagem>(UNIDADE_PADRAO);

  const periodo = atalho === 'custom' ? custom : intervalo(atalho, ref);

  const urlFiltro = `/api/agendamentos?inicio=${periodo.inicio}&fim=${periodo.fim}&unidade=${unidade}`;

  // No-shows seguem o filtro do topo, como os cards 1 e 2: e uma metrica de
  // periodo, e so assim da para compara-la com os agendamentos do mesmo recorte.
  const urlNoShows = `/api/no-shows?inicio=${periodo.inicio}&fim=${periodo.fim}`;

  // Cards 3 a 6 ignoram o filtro do topo: a meta e mensal, entao ritmo, funil,
  // projecao e esforco so fazem sentido contra o mes corrente.
  const urlMes = useMemo(
    () =>
      `/api/agendamentos?inicio=${primeiroDiaDoMes(ref)}&fim=${ultimoDiaDoMes(ref)}&unidade=${unidade}`,
    [ref, unidade]
  );

  const mes = useApi<AgendamentosResposta>(urlMes);
  // Uma busca so, dividida entre o card 5 e a marca de projecao do card 2.
  const futuros = useApi<FuturosResposta>('/api/agendamentos-futuros');
  const ehMesCorrente = periodo.inicio === primeiroDiaDoMes(ref) && periodo.fim === ultimoDiaDoMes(ref);

  return (
    <main className="pagina">
      <div className="topo">
        <div>
          <h1>Metas do time de SDR</h1>
          <p className="sub">
            VOA Hotéis · dados do Pipedrive · hoje é {formatarBR(ref)} ·{' '}
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
          {(
            [
              ['este-mes', 'Este mês'],
              ['mes-passado', 'Mês passado'],
              ['ultimos-30', 'Últimos 30 dias'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} data-ativo={atalho === k} onClick={() => setAtalho(k)}>
              {label}
            </button>
          ))}

          <input
            type="date"
            value={periodo.inicio}
            max={periodo.fim}
            onChange={(e) => {
              setCustom({ inicio: e.target.value, fim: periodo.fim });
              setAtalho('custom');
            }}
            aria-label="Início do período"
          />
          <input
            type="date"
            value={periodo.fim}
            min={periodo.inicio}
            onChange={(e) => {
              setCustom({ inicio: periodo.inicio, fim: e.target.value });
              setAtalho('custom');
            }}
            aria-label="Fim do período"
          />

          <button
            data-ativo={unidade === 'negocios'}
            onClick={() => setUnidade(unidade === 'atividades' ? 'negocios' : 'atividades')}
            title="Alterna entre contar cada reunião e contar negócios distintos"
          >
            {unidade === 'atividades' ? 'Contando reuniões' : 'Contando negócios'}
          </button>

          <BotaoAtualizar />
        </div>
      </div>

      {!ehMesCorrente && (
        <p className="aviso">
          O filtro está em {formatarBR(periodo.inicio)}–{formatarBR(periodo.fim)}. Os cards de
          Agendamentos Totais, por SDR e No-shows seguem esse período; Fechamentos, Detalhamento,
          Funil, Futuros e Atividades continuam no mês corrente, porque as metas são mensais.
        </p>
      )}

      <div className="grade">
        <CardAgendamentosTotais url={urlFiltro} />
        <CardAgendamentoPorSdr
          url={urlFiltro}
          futuros={ehMesCorrente ? futuros.dados : null}
        />
      </div>

      <div className="grade">
        <CardDetalhamentoSdr estado={mes} />
      </div>

      <div className="grade cheia">
        <CardNoShows url={urlNoShows} />
      </div>

      <div className="grade">
        <CardFunilSdr />
      </div>

      <div className="grade cheia">
        <CardAgendamentosFuturos mes={mes.dados} estado={futuros} />
      </div>

      <div className="grade">
        <CardsAtividadesSemana />
      </div>

      <div className="grade cheia">
        <CardFechamentos />
      </div>

      <div className="grade cheia">
        <CardForecast />
      </div>
    </main>
  );
}
