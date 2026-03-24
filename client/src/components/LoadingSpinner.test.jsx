import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from './LoadingSpinner.jsx'

describe('LoadingSpinner', () => {
  it('renders accessible status', () => {
    render(<LoadingSpinner label="Working" />)
    expect(screen.getByRole('status', { name: 'Working' })).toBeInTheDocument()
  })
})
