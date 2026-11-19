import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import type Big from 'big.js';
import { formatarNumeroBR, parseNumeroBR } from '../formatar';
import './Campo.css';

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'prefix'> {
  rotulo: string;
  value: string;
  onChange: (texto: string) => void;
  /** Explicação sempre visível abaixo do campo. */
  ajuda?: ReactNode;
  /** Mensagem de erro (troca a cor da borda e é ligada ao campo por aria-describedby). */
  erro?: string;
  /** Selo ao lado do rótulo (ex.: "estimado"). */
  selo?: string;
  /** Texto fixo antes do valor (ex.: "R$"). */
  prefixo?: string;
  /** Texto fixo depois do valor (ex.: "%"). */
  sufixo?: string;
}

/** Campo de texto com rótulo, ajuda e erro. */
export default function Campo({ rotulo, value, onChange, ajuda, erro, selo, prefixo, sufixo, id, ...resto }: CampoProps) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idAjuda = `${idCampo}-ajuda`;
  const idErro = `${idCampo}-erro`;
  const descricao = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="campo">
      <div className="campo__topo">
        <label htmlFor={idCampo} className="campo__rotulo">
          {rotulo}
        </label>
        {selo && <span className="campo__selo">{selo}</span>}
      </div>
      <div className={['campo__caixa', erro && 'campo__caixa--erro'].filter(Boolean).join(' ')}>
        {prefixo && <span className="campo__afixo">{prefixo}</span>}
        <input
          {...resto}
          id={idCampo}
          className="campo__entrada"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao}
          autoComplete="off"
        />
        {sufixo && <span className="campo__afixo">{sufixo}</span>}
      </div>
      {ajuda && (
        <p id={idAjuda} className="campo__ajuda">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} className="campo__erro">
          {erro}
        </p>
      )}
    </div>
  );
}

export interface CampoNumeroProps extends Omit<CampoProps, 'value' | 'onChange' | 'inputMode'> {
  /** Texto inicial (ex.: "40"). */
  textoInicial?: string;
  /** Valor lido em pt-BR como Big; null quando vazio ou inválido. */
  aoMudar: (valor: Big | null) => void;
}

/**
 * Número/moeda em pt-BR ("3.600.000,00"): lê o texto como Big (nunca number). Com prefixo "R$" reformata
 * ao sair do campo; digitar "3600000" também vale R$ 3.600.000,00.
 */
export function CampoNumero({ textoInicial = '', aoMudar, erro, ...resto }: CampoNumeroProps) {
  const [texto, setTexto] = useState(textoInicial);
  const invalido = texto.trim() !== '' && parseNumeroBR(texto) === null;
  return (
    <Campo
      {...resto}
      inputMode="decimal"
      value={texto}
      onChange={(t) => {
        setTexto(t);
        aoMudar(parseNumeroBR(t));
      }}
      onBlur={() => {
        const v = parseNumeroBR(texto);
        if (v && resto.prefixo === 'R$') setTexto(formatarNumeroBR(v));
      }}
      erro={erro ?? (invalido ? 'Digite só números, como 3.600.000,00.' : undefined)}
    />
  );
}
