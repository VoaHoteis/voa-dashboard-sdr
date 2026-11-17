'use client';

import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CORES_FUNIL, FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import useSWR from 'swr';

export interface Estado<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

// ------------------------------------------------------- atualizacao global

interface Atualizacao {
  /** Identifica um novo snapshot após a invalidação compartilhada. */
  versao: number;
  atualizar: () => Promise<void>;
  emVoo: number;
  registrar: (delta: number) => void;
  concluidoEm: Date | null;
  preparando: boolean;
  erroAtualizacao: string | null;
}

const ContextoAtualizacao = createContext<Atualizacao>({
  versao: 0,
  atualizar: async () => {},
  emVoo: 0,
  registrar: () => {},
  concluidoEm: null,
  preparando: false,
  erroAtualizacao: null,
});

export function useAtualizacao(): Atualizacao {
  return useContext(ContextoAtualizacao);
}

export function ProvedorAtualizacao({ children }: { children: React.ReactNode }) {
  const [versao, setVersao] = useState(0);
  const [emVoo, setEmVoo] = useState(0);
  const [concluidoEm, setConcluidoEm] = useState<Date | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [erroAtualizacao, setErroAtualizacao] = useState<string | null>(null);

  const registrar = useCallback((delta: number) => {
    setEmVoo((n) => Math.max(0, n + delta));
  }, []);

  const atualizar = useCallback(async () => {
    if (preparando || emVoo > 0) return;

    setPreparando(true);
    setErroAtualizacao(null);
    try {
      const resposta = await fetch('/api/pipedrive-refresh', { method: 'POST', cache: 'no-store' });
      const corpo = await resposta.json().catch(() => ({ erro: 'resposta não é JSON' }));
      if (!resposta.ok) throw new Error(corpo?.erro ?? `HTTP ${resposta.status}`);
      setVersao((v) => v + 1);
    } catch (erro) {
      setErroAtualizacao(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setPreparando(false);
    }
  }, [preparando, emVoo]);

  const jaTeve = useRef(false);
  useEffect(() => {
    if (emVoo > 0) {
      jaTeve.current = true;
      return;
    }
    if (jaTeve.current) setConcluidoEm(new Date());
  }, [emVoo]);

  const valor = useMemo(
    () => ({ versao, atualizar, emVoo, registrar, concluidoEm, preparando, erroAtualizacao }),
    [versao, atualizar, emVoo, registrar, concluidoEm, preparando, erroAtualizacao]
  );

  return <ContextoAtualizacao.Provider value={valor}>{children}</ContextoAtualizacao.Provider>;
}

let requisicoesDoNavegador = 0;
const filaDoNavegador: Array<() => void> = [];

async function fetchComConcorrenciaLimitada(url: string): Promise<Response> {
  await new Promise<void>((resolver) => {
    const iniciar = () => {
      requisicoesDoNavegador += 1;
      resolver();
    };
    if (requisicoesDoNavegador < 3) iniciar();
    else filaDoNavegador.push(iniciar);
  });

  try {
    return await fetch(url, { cache: 'no-store' });
  } finally {
    requisicoesDoNavegador -= 1;
    filaDoNavegador.shift()?.();
  }
}

function esperaRetryAfter(resposta: Response, tentativa: number): number {
  const retryAfter = resposta.headers.get('retry-after');
  let esperaServidor = 0;

  if (retryAfter) {
    const segundos = Number(retryAfter);
    if (Number.isFinite(segundos)) esperaServidor = Math.max(0, segundos * 1000);
    else {
      const data = Date.parse(retryAfter);
      if (!Number.isNaN(data)) esperaServidor = Math.max(0, data - Date.now());
    }
  }

  return Math.max(1200 * 2 ** tentativa, esperaServidor) + Math.random() * 350;
}

async function buscarJson<T>(url: string): Promise<T> {
  for (let tentativa = 0; tentativa <= 2; tentativa += 1) {
    const resposta = await fetchComConcorrenciaLimitada(url);
    const corpo = await resposta.json().catch(() => ({ erro: 'resposta não é JSON' }));

    if (resposta.status === 429 && tentativa < 2) {
      await new Promise((resolver) => window.setTimeout(resolver, esperaRetryAfter(resposta, tentativa)));
      continue;
    }

    if (!resposta.ok) throw new Error(corpo?.erro ?? `HTTP ${resposta.status}`);
    return corpo as T;
  }

  throw new Error('O limite de requisições do Pipedrive continua ativo.');
}

export function useApi<T>(url: string, habilitado = true): Estado<T> {
  const [tick, setTick] = useState(0);
  const { versao, registrar } = useAtualizacao();
  const chave: readonly [string, number, number] | null = habilitado ? [url, versao, tick] : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    T,
    Error,
    readonly [string, number, number] | null
  >(chave, ([endpoint]) => buscarJson<T>(endpoint), {
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    dedupingInterval: 2000,
  });
  const recarregar = useCallback(() => {
    void mutate();
  }, [mutate]);
  const erro = error instanceof Error ? error.message : error ? String(error) : null;

  useEffect(() => {
    if (isValidating) registrar(1);
    return () => {
      if (isValidating) registrar(-1);
    };
  }, [isValidating, registrar]);

  return { dados: data ?? null, carregando: isLoading, erro, recarregar };
}

export function BotaoAtualizar() {
  const { atualizar, emVoo, concluidoEm, preparando, erroAtualizacao } = useAtualizacao();
  const ocupado = emVoo > 0 || preparando;

  return (
    <div className="atualizar">
      <button
        onClick={() => void atualizar()}
        disabled={ocupado}
        data-ocupado={ocupado}
        aria-busy={ocupado}
      >
        <span className="giro" aria-hidden="true" />
        {preparando ? 'Preparando atualização…' : ocupado ? 'Atualizando…' : 'Atualizar'}
      </button>
      <span className="carimbo" role={erroAtualizacao ? 'status' : undefined}>
        {erroAtualizacao
          ? erroAtualizacao
          : ocupado
            ? 'atualizando snapshot do Pipedrive'
            : concluidoEm
              ? 'atualizado às ' +
                concluidoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : ''}
      </span>
    </div>
  );
}

export function Painel<T>({
  titulo,
  periodo,
  estado,
  children,
}: {
  titulo: string;
  periodo?: string;
  estado: Estado<T>;
  children: (dados: T) => React.ReactNode;
}) {
  return (
    <section className="card">
      <header>
        <h2>{titulo}</h2>
        {periodo && <span className="periodo">{periodo}</span>}
      </header>

      {estado.dados !== null ? (
        <>
          {estado.erro && (
            <div className="estado aviso-cache" role="status">
              <strong>Exibindo os últimos dados disponíveis.</strong>
              <code>{estado.erro}</code>
              <button className="botao" onClick={estado.recarregar}>
                Tentar novamente
              </button>
            </div>
          )}
          {children(estado.dados)}
        </>
      ) : estado.erro ? (
        <div className="estado erro">
          <strong>Não foi possível carregar.</strong>
          <code>{estado.erro}</code>
          <button className="botao" onClick={estado.recarregar}>
            Tentar novamente
          </button>
        </div>
      ) : estado.carregando ? (
        <div className="esqueleto" />
      ) : (
        <div className="estado">Sem dados.</div>
      )}
    </section>
  );
}

/** Mostra dois cartões de SDR por página com controles acessíveis de navegação. */
export function CarrosselSdr({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [pagina, setPagina] = useState(0);
  const cards = Children.toArray(children);
  const totalPaginas = Math.ceil(cards.length / 2);
  const inicio = pagina * 2;
  const fim = Math.min(inicio + 2, cards.length);

  return (
    <section className="carrossel-sdr" aria-label={titulo} aria-roledescription="carrossel">
      <div className="carrossel-sdr__cabecalho">
        <span className="carrossel-sdr__status" aria-live="polite" aria-atomic="true">
          {cards.length > 0 ? `SDRs ${inicio + 1}–${fim} de ${cards.length}` : 'Nenhum SDR'}
        </span>
        <div className="carrossel-sdr__controles">
          <button
            type="button"
            className="carrossel-sdr__botao"
            aria-label={`Ver SDRs anteriores em ${titulo}`}
            onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
            disabled={pagina === 0}
          >
            ←
          </button>
          <button
            type="button"
            className="carrossel-sdr__botao"
            aria-label={`Ver próximos SDRs em ${titulo}`}
            onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))}
            disabled={pagina >= totalPaginas - 1}
          >
            →
          </button>
        </div>
      </div>
      <div className="carrossel-sdr__grade" role="group" aria-label={titulo}>
        {cards.slice(inicio, fim)}
      </div>
    </section>
  );
}

/** Barra de proporção entre os dois funis. */
export function BarraFunis({ salabim, novos }: { salabim: number; novos: number }) {
  const total = salabim + novos;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <div className="barra" role="presentation">
      <span style={{ width: `${pct(novos)}%`, background: CORES_FUNIL.novosNegocios }} />
      <span style={{ width: `${pct(salabim)}%`, background: CORES_FUNIL.salabim }} />
    </div>
  );
}

/**
 * Barra de progresso contra uma meta. Passa de 100% sem vazar do trilho.
 *
 * `marca` mostra a projeção das reuniões marcadas; `marcaHistorica` compara
 * com os agendamentos do mesmo dia útil no mês anterior.
 */
export function BarraMeta({
  valor,
  meta,
  cor,
  marca,
  marcaHistorica,
  dica,
  dicaHistorica,
}: {
  valor: number;
  meta: number;
  cor: string;
  marca?: number;
  marcaHistorica?: number;
  dica?: string;
  dicaHistorica?: string;
}) {
  const posicao = (n: number) => (meta > 0 ? Math.min(100, (n / meta) * 100) : 0);
  const pct = posicao(valor);

  // So vale a pena marcar o que ainda nao aconteceu: se a projecao ja esta
  // dentro do preenchido, o tracejado seria so ruido em cima da barra.
  const mostrarMarca = marca !== undefined && marca > valor && posicao(marca) > pct;

  return (
    <div
      className="barra"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={meta}
      title={dica && dicaHistorica ? `${dica} · ${dicaHistorica}` : dica ?? dicaHistorica}
    >
      <span style={{ width: `${pct}%`, background: cor }} />
      {mostrarMarca && (
        <i
          className="marca-projecao"
          style={{ left: `${posicao(marca)}%`, borderColor: cor }}
          aria-hidden="true"
        />
      )}
      {marcaHistorica !== undefined && (
        <i
          className="marca-historica"
          style={{ left: `${posicao(marcaHistorica)}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function LegendaFunis() {
  return (
    <div className="legenda">
      {(['novosNegocios', 'salabim'] as FunnelKey[]).map((f) => (
        <span key={f}>
          <i style={{ background: CORES_FUNIL[f] }} />
          {FUNNEL_LABEL[f]}
        </span>
      ))}
    </div>
  );
}

export function pct(n: number, casas = 0): string {
  return `${(n * 100).toFixed(casas).replace('.', ',')}%`;
}

export function numeroBR(n: number, casas = 1): string {
  return n.toFixed(casas).replace('.', ',');
}

// ------------------------------------------------------- modal de detalhe

/**
 * Modal simples. Fecha no Esc, no clique fora e no botao -- as tres saidas que
 * as pessoas tentam. Trava a rolagem do fundo enquanto esta aberto.
 */
export function Modal({
  titulo,
  subtitulo,
  aoFechar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', tecla);

    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    caixa.current?.focus();

    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = rolagem;
    };
  }, [aoFechar]);

  return (
    <div className="fundo-modal" onClick={aoFechar}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={caixa}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h3>{titulo}</h3>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar">
            ✕
          </button>
        </header>
        <div className="corpo-modal">{children}</div>
      </div>
    </div>
  );
}

/**
 * Numero que abre o detalhe ao ser clicado.
 *
 * Continua sendo um <button>, e nao uma <div> com onClick, para funcionar com
 * teclado e leitor de tela -- quem audita numero costuma navegar por Tab.
 */
export function NumeroClicavel({
  valor,
  classe = 'numero grande',
  cor,
  aoAbrir,
  titulo,
  ariaLabel,
  desabilitado,
}: {
  valor: React.ReactNode;
  classe?: string;
  cor?: string;
  aoAbrir: () => void;
  titulo: string;
  ariaLabel?: string;
  desabilitado?: boolean;
}) {
  if (desabilitado) {
    return (
      <span className={classe} style={{ color: cor }}>
        {valor}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`clicavel ${classe}`}
      style={{ color: cor }}
      onClick={aoAbrir}
      title={titulo}
      aria-label={ariaLabel}
    >
      {valor}
    </button>
  );
}
