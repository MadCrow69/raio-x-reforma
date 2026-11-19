/** Tempo até liberar a URL do Blob depois do clique (o navegador já iniciou o download). */
const ATRASO_REVOGAR_MS = 1000;

/** Baixa um texto como arquivo (Blob + link temporário); nada vai para servidor. */
export function baixarTexto(nome: string, conteudo: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar na hora pode cancelar o download em alguns navegadores: espera o clique ser processado.
  setTimeout(() => URL.revokeObjectURL(url), ATRASO_REVOGAR_MS);
}
