'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CORES_FUNIL, FUNNEL_LABEL, type FunnelKey } from '@/lib/config';

export interface Estado<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

// ------------------------------------------------------- atualizacao global

interface Atualizacao {
  /** Sobe a cada clique em "Atualizar"; todo card observa e refaz a busca. */
  versao: number;
  atualizar: () => void;
  /** Quantas buscas estao em voo agora, para o botao saber quando parar de girar. */
  emVoo: number;
  registrar: (delta: number) => void;
  concluidoEm: Date | null;
}

const ContextoAtualizacao = createContext<Atualizacao>({
  versao: 0,
  atualizar: () => {},
  emVoo: 0,
  registrar: () => {},
  concluidoEm: null,
});

export function useAtualizacao(): Atualizacao {
  return useContext(ContextoAtualizacao);
}

export function ProvedorAtualizacao({ children }: { children: React.ReactNode }) {
  const [versao, setVersao] = useState(0);
  const [emVoo, setEmVoo] = useState(0);
  const [concluidoEm, setConcluidoEm] = useState<Date | null>(null);

  const registrar = useCallback((delta: number) => {
    setEmVoo((n) => Math.max(0, n + delta));
  }, []);

  const atualizar = useCallback(() => setVersao((v) => v + 1), []);

  // Marca a hora quando a ultima busca em voo termina -- assim o rodape diz
  // quando os numeros na tela foram lidos, nao quando o botao foi clicado.
  const jaTeve = useRef(false);
  useEffect(() => {
    if (emVoo > 0) {
      jaTeve.current = true;
      return;
    }
    if (jaTeve.current) setConcluidoEm(new Date());
  }, [emVoo]);

  const valor = useMemo(
    () => ({ versao, atualizar, emVoo, registrar, concluidoEm }),
    [versao, atualizar, emVoo, registrar, concluidoEm]
  );

  return <ContextoAtualizacao.Provider value={valor}>{children}</ContextoAtualizacao.Provider>;
}

/**
 * Busca de dados com estado explicito.
 *
 * O prototipo usava `catch (e) {}` -- qualquer falha virava card zerado, sem
 * aviso nenhum, e foi assim que os cards 3 a 6 passaram dias mostrando zero.
 * Aqui o erro sempre aparece na tela com o motivo e um botao de tentar de novo.
 */
export function useApi<T>(url: string): Estado<T> {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const { versao, registrar } = useAtualizacao();
  const versaoVista = useRef(versao);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelado = false;

    // Só um pedido explícito de atualização derruba o cache do servidor. Uma
    // troca de filtro aproveita o que já está em memória.
    const manual = versaoVista.current !== versao;
    versaoVista.current = versao;
    const alvo = manual ? url + (url.includes('?') ? '&' : '?') + 'atualizar=1' : url;

    setCarregando(true);
    setErro(null);
    registrar(1);

    fetch(alvo, { cache: 'no-store' })
      .then(async (r) => {
        const corpo = await r.json().catch(() => ({ erro: 'resposta não é JSON' }));
        if (!r.ok) throw new Error(corpo?.erro ?? `HTTP ${r.status}`);
        return corpo as T;
      })
      .then((d) => {
        if (!cancelado) setDados(d);
      })
      .catch((e: Error) => {
        if (!cancelado) setErro(e.message);
      })
      .finally(() => {
        registrar(-1);
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [url, tick, versao, registrar]);

  return { dados, carregando, erro, recarregar };
}

/** Botao unico que refaz a busca de todos os cards. */
export function BotaoAtualizar() {
  const { atualizar, emVoo, concluidoEm } = useAtualizacao();
  const ocupado = emVoo > 0;

  return (
    <div className="atualizar">
      <button onClick={atualizar} disabled={ocupado} data-ocupado={ocupado}>
        <span className="giro" aria-hidden="true" />
        {ocupado ? 'Atualizando…' : 'Atualizar'}
      </button>
      <span className="carimbo">
        {ocupado
          ? 'buscando no Pipedrive'
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

      {estado.erro ? (
        <div className="estado erro">
          <strong>Não foi possível carregar.</strong>
          <code>{estado.erro}</code>
          <button className="botao" onClick={estado.recarregar}>
            Tentar novamente
          </button>
        </div>
      ) : estado.carregando && !estado.dados ? (
        <div className="esqueleto" />
      ) : estado.dados ? (
        children(estado.dados)
      ) : (
        <div className="estado">Sem dados.</div>
      )}
    </section>
  );
}

/** Barra de proporcao entre os dois funis. */
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
 * `marca` desenha um tracejado discreto onde a barra chegaria num cenario
 * hipotetico -- hoje, se os agendamentos ja marcados forem confirmados.
 */
export function BarraMeta({
  valor,
  meta,
  cor,
  marca,
  dica,
}: {
  valor: number;
  meta: number;
  cor: string;
  marca?: number;
  dica?: string;
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
      title={dica}
    >
      <span style={{ width: `${pct}%`, background: cor }} />
      {mostrarMarca && (
        <i
          className="marca-projecao"
          style={{ left: `${posicao(marca)}%`, borderColor: cor }}
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
  desabilitado,
}: {
  valor: React.ReactNode;
  classe?: string;
  cor?: string;
  aoAbrir: () => void;
  titulo: string;
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
    <button className={`clicavel ${classe}`} style={{ color: cor }} onClick={aoAbrir} title={titulo}>
      {valor}
    </button>
  );
}
