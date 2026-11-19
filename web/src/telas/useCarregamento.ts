import { useCallback, useEffect, useRef, useState } from 'react';

export type Carregamento<T> =
  | { situacao: 'carregando' }
  | { situacao: 'erro'; tentarDeNovo: () => void }
  | { situacao: 'pronto'; dados: T };

/** Carrega `carregar` ao montar; em erro devolve `tentarDeNovo`. Resposta de tentativa antiga é descartada. */
export function useCarregamento<T>(carregar: () => Promise<T>): Carregamento<T> {
  const [estado, setEstado] = useState<{ situacao: 'carregando' } | { situacao: 'erro' } | { situacao: 'pronto'; dados: T }>({
    situacao: 'carregando',
  });
  const [tentativa, setTentativa] = useState(0);
  const carregarRef = useRef(carregar);
  useEffect(() => {
    carregarRef.current = carregar;
  });

  useEffect(() => {
    let vigente = true;
    carregarRef
      .current()
      .then((dados) => vigente && setEstado({ situacao: 'pronto', dados }))
      .catch(() => vigente && setEstado({ situacao: 'erro' }));
    return () => {
      vigente = false;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ situacao: 'carregando' });
    setTentativa((n) => n + 1);
  }, []);

  return estado.situacao === 'erro' ? { situacao: 'erro', tentarDeNovo } : estado;
}
