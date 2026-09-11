'use client';

import {
  STATUS_LABEL,
  type MarketingResposta,
  type MesMarketing,
} from '@/lib/marketing-tipos';
import { Painel, type Estado } from './base';

const MES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// ------------------------------------------------------------- formatadores

const fmtBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const fmtInt = new Intl.NumberFormat('pt-BR');

function brl(n: number): string {
  return n > 0 ? fmtBRL.format(n) : '—';
}
function inteiro(n: number): string {
  return n > 0 ? fmtInt.format(n) : '—';
}
function pctual(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
function razao(numerador: number, denominador: number): number {
  return denominador > 0 ? numerador / denominador : 0;
}

/** Cor do % de qualificados, imitando o semáforo da planilha. */
function corQualif(pct: number): string {
  if (pct >= 0.2) return 'var(--salabim)';
  if (pct >= 0.1) return 'var(--atencao)';
  return 'var(--alerta)';
}

// --------------------------------------------------------------- derivação

interface Derivado {
  cpl: number;
  pctQualif: number;
  custoLeadQualif: number;
  custoReuniao: number;
  custoContrato: number;
  /** Meses de MRR para pagar o investimento do mês (payback). */
  paybackMeses: number;
}

function derivar(m: MesMarketing): Derivado {
  return {
    cpl: razao(m.investimento, m.leads.total),
    pctQualif: razao(m.leads.status.qualificado, m.leads.total),
    custoLeadQualif: razao(m.investimento, m.leads.status.qualificado),
    custoReuniao: razao(m.investimento, m.reunioes),
    custoContrato: razao(m.investimento, m.contratos),
    paybackMeses: razao(m.investimento, m.mrr),
  };
}

// ---------------------------------------------------------------- resumo

export function ResumoMarketing({ estado }: { estado: Estado<MarketingResposta> }) {
  return (
    <Painel titulo="Resumo do ano" estado={estado}>
      {(d) => {
        const mostrados = mesesVisiveis(d);
        const totalLeads = soma(mostrados, (m) => m.leads.total);
        const totalQualif = soma(mostrados, (m) => m.leads.status.qualificado);
        const totalInvest = soma(mostrados, (m) => m.investimento);
        const totalReunioes = soma(mostrados, (m) => m.reunioes);
        const totalContratos = soma(mostrados, (m) => m.contratos);

        const kpis: Array<{ rotulo: string; valor: string; cor?: string; sub?: string }> = [
          { rotulo: 'Total de leads', valor: inteiro(totalLeads) },
          {
            rotulo: 'Qualificados',
            valor: inteiro(totalQualif),
            cor: corQualif(razao(totalQualif, totalLeads)),
            sub: pctual(razao(totalQualif, totalLeads)) + ' do total',
          },
          { rotulo: 'Investimento', valor: brl(totalInvest) },
          {
            rotulo: 'Custo / lead qualif.',
            valor: brl(Math.round(razao(totalInvest, totalQualif))),
          },
          { rotulo: 'Reuniões', valor: inteiro(totalReunioes) },
          { rotulo: 'Contratos', valor: inteiro(totalContratos), cor: 'var(--novos)' },
        ];

        return (
          <div className="kpis-marketing">
            {kpis.map((k) => (
              <div key={k.rotulo} className="kpi">
                <span className="rotulo">{k.rotulo}</span>
                <strong className="numero" style={{ color: k.cor }}>
                  {k.valor}
                </strong>
                {k.sub && <span className="kpi-sub">{k.sub}</span>}
              </div>
            ))}
          </div>
        );
      }}
    </Painel>
  );
}

// ----------------------------------------------------------------- tabela

export function TabelaMarketing({ estado }: { estado: Estado<MarketingResposta> }) {
  return (
    <Painel
      titulo="Marketing Inbound · mensal"
      periodo="leads → pré-qualificação → reunião → contrato"
      estado={estado}
    >
      {(d) => {
        const meses = mesesVisiveis(d);

        const tot = {
          leads: soma(meses, (m) => m.leads.total),
          duplicado: soma(meses, (m) => m.leads.status.duplicado),
          semRetorno: soma(meses, (m) => m.leads.status.semRetorno),
          emContato: soma(meses, (m) => m.leads.status.emContato),
          desqualificado: soma(meses, (m) => m.leads.status.desqualificado),
          desqTempo: soma(meses, (m) => m.leads.status.desqualificadoTempoLimite),
          qualificado: soma(meses, (m) => m.leads.status.qualificado),
          reunioes: soma(meses, (m) => m.reunioes),
          contratos: soma(meses, (m) => m.contratos),
          mrr: soma(meses, (m) => m.mrr),
          investimento: soma(meses, (m) => m.investimento),
        };

        return (
          <>
            <Fontes fontes={d.fontes} />

            <div className="rolagem-x">
              <table className="tabela-marketing">
                <thead>
                  <tr>
                    <th className="sticky-col">Mês</th>
                    <th>Total leads</th>
                    <th>CPL</th>
                    <th>{STATUS_LABEL.duplicado}</th>
                    <th>{STATUS_LABEL.semRetorno}</th>
                    <th>{STATUS_LABEL.emContato}</th>
                    <th>{STATUS_LABEL.desqualificado}</th>
                    <th>{STATUS_LABEL.desqualificadoTempoLimite}</th>
                    <th>{STATUS_LABEL.qualificado}</th>
                    <th>% Qualif.</th>
                    <th>Qualif. vs A-1</th>
                    <th className="sep">Reuniões</th>
                    <th>Contratos</th>
                    <th>MRR contratos</th>
                    <th className="sep">Investimento</th>
                    <th>Custo lead qualif.</th>
                    <th>Custo / reunião</th>
                    <th>Custo / contrato</th>
                    <th>Payback (meses)</th>
                  </tr>
                </thead>

                <tbody>
                  {meses.map((m, i) => {
                    const der = derivar(m);
                    const anterior = i > 0 ? meses[i - 1] : null;
                    const vsA1 =
                      anterior === null
                        ? null
                        : m.leads.status.qualificado - anterior.leads.status.qualificado;

                    return (
                      <tr key={m.mes}>
                        <td className="sticky-col">{MES_ABREV[m.mes - 1]}</td>
                        <td className="forte">{inteiro(m.leads.total)}</td>
                        <td>{brl(Math.round(der.cpl))}</td>
                        <td>{inteiro(m.leads.status.duplicado)}</td>
                        <td>{inteiro(m.leads.status.semRetorno)}</td>
                        <td>{inteiro(m.leads.status.emContato)}</td>
                        <td>{inteiro(m.leads.status.desqualificado)}</td>
                        <td>{inteiro(m.leads.status.desqualificadoTempoLimite)}</td>
                        <td className="forte">{inteiro(m.leads.status.qualificado)}</td>
                        <td style={{ color: corQualif(der.pctQualif) }}>
                          {m.leads.total > 0 ? pctual(der.pctQualif) : '—'}
                        </td>
                        <td style={{ color: corDelta(vsA1) }}>{textoDelta(vsA1)}</td>
                        <td className="sep forte">{inteiro(m.reunioes)}</td>
                        <td className="forte" style={{ color: 'var(--novos)' }}>
                          {inteiro(m.contratos)}
                        </td>
                        <td>{brl(m.mrr)}</td>
                        <td className="sep">{brl(m.investimento)}</td>
                        <td>{brl(Math.round(der.custoLeadQualif))}</td>
                        <td>{brl(Math.round(der.custoReuniao))}</td>
                        <td>{brl(Math.round(der.custoContrato))}</td>
                        <td>{der.paybackMeses > 0 ? der.paybackMeses.toFixed(1).replace('.', ',') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="sticky-col">Total</td>
                    <td className="forte">{inteiro(tot.leads)}</td>
                    <td>{brl(Math.round(razao(tot.investimento, tot.leads)))}</td>
                    <td>{inteiro(tot.duplicado)}</td>
                    <td>{inteiro(tot.semRetorno)}</td>
                    <td>{inteiro(tot.emContato)}</td>
                    <td>{inteiro(tot.desqualificado)}</td>
                    <td>{inteiro(tot.desqTempo)}</td>
                    <td className="forte">{inteiro(tot.qualificado)}</td>
                    <td style={{ color: corQualif(razao(tot.qualificado, tot.leads)) }}>
                      {tot.leads > 0 ? pctual(razao(tot.qualificado, tot.leads)) : '—'}
                    </td>
                    <td>—</td>
                    <td className="sep forte">{inteiro(tot.reunioes)}</td>
                    <td className="forte" style={{ color: 'var(--novos)' }}>
                      {inteiro(tot.contratos)}
                    </td>
                    <td>{brl(tot.mrr)}</td>
                    <td className="sep">{brl(tot.investimento)}</td>
                    <td>{brl(Math.round(razao(tot.investimento, tot.qualificado)))}</td>
                    <td>{brl(Math.round(razao(tot.investimento, tot.reunioes)))}</td>
                    <td>{brl(Math.round(razao(tot.investimento, tot.contratos)))}</td>
                    <td>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        );
      }}
    </Painel>
  );
}

// ----------------------------------------------------------------- auxiliares

/** Meses com algum dado ou já decorridos no ano corrente — esconde o futuro vazio. */
function mesesVisiveis(d: MarketingResposta): MesMarketing[] {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  return d.meses.filter((m) => {
    const temDado =
      m.leads.total > 0 || m.reunioes > 0 || m.contratos > 0 || m.investimento > 0;
    const jaPassou = d.ano < anoAtual || (d.ano === anoAtual && m.mes <= mesAtual);
    return temDado || jaPassou;
  });
}

function soma(meses: MesMarketing[], seletor: (m: MesMarketing) => number): number {
  return meses.reduce((s, m) => s + seletor(m), 0);
}

function corDelta(delta: number | null): string {
  if (delta === null || delta === 0) return 'var(--texto-fraco)';
  return delta > 0 ? 'var(--salabim)' : 'var(--alerta)';
}

function textoDelta(delta: number | null): string {
  if (delta === null) return '—';
  if (delta === 0) return '0';
  return delta > 0 ? `+${delta}` : String(delta);
}

function Fontes({ fontes }: { fontes: MarketingResposta['fontes'] }) {
  const itens: Array<{ nome: string; origem: 'live' | 'mock'; via: string }> = [
    { nome: 'Funil de leads', origem: fontes.leads, via: 'Kinbox' },
    { nome: 'Reuniões, contratos e MRR', origem: fontes.pipedrive, via: 'Pipedrive' },
    { nome: 'Investimento', origem: fontes.investimento, via: 'Windsor.ai' },
  ];
  return (
    <div className="fontes">
      {itens.map((it) => (
        <span key={it.nome} className="fonte" data-origem={it.origem}>
          <i aria-hidden="true" />
          {it.nome}: {it.origem === 'live' ? `ao vivo · ${it.via}` : `estimado · ${it.via} não conectado`}
        </span>
      ))}
    </div>
  );
}
