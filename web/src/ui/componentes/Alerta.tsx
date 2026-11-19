import { CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import './Alerta.css';

export type TipoAlerta = 'info' | 'alerta' | 'erro';

export interface AlertaProps {
  tipo: TipoAlerta;
  children: ReactNode;
}

const ICONE: Record<TipoAlerta, LucideIcon> = { info: Info, alerta: TriangleAlert, erro: CircleAlert };

/** Faixa de aviso dentro da tela (ao lado do campo a que se refere). Erro é anunciado na hora; os demais, com calma. */
export default function Alerta({ tipo, children }: AlertaProps) {
  const Icone = ICONE[tipo];
  return (
    <div className={`alerta alerta--${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <Icone className="alerta__icone" size={18} aria-hidden />
      <p className="alerta__texto">{children}</p>
    </div>
  );
}
