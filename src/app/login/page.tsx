'use client';

import { useState } from 'react';

export default function Login() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      if (r.ok) {
        // Recarga completa para o middleware revalidar e os cards buscarem.
        window.location.href = '/';
        return;
      }
      const corpo = await r.json().catch(() => ({}));
      setErro(corpo.erro ?? `Não foi possível entrar (HTTP ${r.status}).`);
    } catch {
      setErro('Falha de rede ao tentar entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="tela-login">
      <form className="card caixa-login" onSubmit={entrar}>
        <h1>Metas do time de SDR</h1>
        <p className="sub">VOA Hotéis · acesso restrito</p>

        <label htmlFor="senha">Senha do time</label>
        <input
          id="senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoFocus
          autoComplete="current-password"
          required
        />

        {erro && <p className="erro-login">{erro}</p>}

        <button className="botao entrar" type="submit" disabled={enviando || senha.length === 0}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
