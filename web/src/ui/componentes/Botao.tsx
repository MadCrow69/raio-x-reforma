import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import './Botao.css';

export type VarianteBotao = 'primario' | 'secundario' | 'simples';

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primario = ação principal da tela (1 por tela) · secundario = cinza preenchido · simples = só texto azul */
  variante?: VarianteBotao;
  icone?: LucideIcon;
  /** Ícone depois do texto (ex.: seta de "Continuar"). */
  iconeDepois?: boolean;
}

export default function Botao({
  variante = 'secundario',
  icone: Icone,
  iconeDepois = false,
  className,
  children,
  type = 'button',
  ...resto
}: BotaoProps) {
  const icone = Icone ? <Icone size={16} aria-hidden /> : null;
  return (
    <button type={type} className={['botao', `botao--${variante}`, className].filter(Boolean).join(' ')} {...resto}>
      {!iconeDepois && icone}
      {children}
      {iconeDepois && icone}
    </button>
  );
}
