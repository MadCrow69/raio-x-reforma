import { LucideProvider, ScanLine } from 'lucide-react'
import './App.css'
import { useFluxo, type Passo } from './fluxo/estado'
import Enviar from './telas/Enviar'
import Botao from './ui/componentes/Botao'

const ETAPAS: { rotulo: string; passos: Passo[] }[] = [
  { rotulo: 'Enviar', passos: ['ENVIAR'] },
  { rotulo: 'Confirmar', passos: ['CONFIRMAR'] },
  { rotulo: 'Resultado', passos: ['CALCULANDO', 'RESULTADO'] },
]

const RODAPE =
  'Cálculos feitos com os motores open source da Receita Federal (licença MIT). Projeto independente, sem vínculo com a Receita Federal.'

export default function App() {
  const [estado, despachar] = useFluxo()

  return (
    <LucideProvider strokeWidth={1.75} size={18}>
      <div className="app">
        <header className="app__topo">
          <p className="marca">
            <span className="marca__simbolo" aria-hidden>
              <ScanLine size={18} />
            </span>
            Raio-X da Reforma
          </p>
          <ol className="etapas" aria-label="Etapas">
            {ETAPAS.map((etapa, i) => {
              const atual = etapa.passos.includes(estado.passo)
              return (
                <li key={etapa.rotulo} className="etapas__item" aria-current={atual ? 'step' : undefined}>
                  <span className="etapas__numero" aria-hidden>
                    {i + 1}
                  </span>
                  {etapa.rotulo}
                </li>
              )
            })}
          </ol>
        </header>

        <main className="app__conteudo">
          {estado.passo === 'ENVIAR' ? (
            <Enviar aoContinuar={(leitura) => despachar({ tipo: 'ARQUIVOS_LIDOS', leitura })} />
          ) : (
            // Passos 2 e 3 chegam nas próximas tarefas (Confirmar empresa, Resultado).
            <section className="em-construcao">
              <h1 className="em-construcao__titulo">Confirmar empresa</h1>
              <p className="em-construcao__texto">Esta etapa ainda está em construção.</p>
              <Botao variante="secundario" onClick={() => despachar({ tipo: 'NOVA_ANALISE' })}>
                Nova análise
              </Botao>
            </section>
          )}
        </main>

        <footer className="app__rodape">
          <p>{RODAPE}</p>
        </footer>
      </div>
    </LucideProvider>
  )
}
