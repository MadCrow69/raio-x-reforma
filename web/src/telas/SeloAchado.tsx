import type { Achado } from '../auditoria/auditar';
import { ROTULO_ACHADO } from '../auditoria/rotulos';
import './SeloAchado.css';

/** Status do achado sempre em cor + ponto + texto (padrão de interface §6); a cor sozinha não comunica. */
export default function SeloAchado({ achado }: { achado: Achado }) {
  return (
    <span className={`selo-achado selo-achado--${achado.toLowerCase()}`}>
      <span className="selo-achado__ponto" aria-hidden />
      {ROTULO_ACHADO[achado]}
    </span>
  );
}
