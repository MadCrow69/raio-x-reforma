import { useEffect, useState } from 'react';

const CONSULTA = '(max-width: 767px)';

/** Janela de celular (< 768 px, faixa do padrão de interface): listas de filtro viram folha de baixo. */
export function useCelular(): boolean {
  const [celular, setCelular] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(CONSULTA).matches);
  useEffect(() => {
    const m = window.matchMedia?.(CONSULTA);
    if (!m) return;
    const atualizar = () => setCelular(m.matches);
    atualizar();
    m.addEventListener('change', atualizar);
    return () => m.removeEventListener('change', atualizar);
  }, []);
  return celular;
}
