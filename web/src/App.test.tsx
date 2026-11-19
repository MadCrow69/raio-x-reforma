import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('abre no passo "Enviar" com a marca, as etapas e o rodapé de independência', () => {
    render(<App />)
    expect(screen.getByText('Raio-X da Reforma')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Envie as notas da empresa' })).toBeTruthy()
    const etapas = screen.getByRole('list', { name: 'Etapas' })
    expect(etapas.querySelector('[aria-current="step"]')?.textContent).toContain('Enviar')
    expect(
      screen.getByText(
        'Cálculos feitos com os motores open source da Receita Federal (licença MIT). Projeto independente, sem vínculo com a Receita Federal.',
      ),
    ).toBeTruthy()
  })
})
