import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('exibe o título do produto', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Raio-X da Reforma' }),
    ).toBeTruthy()
  })
})
