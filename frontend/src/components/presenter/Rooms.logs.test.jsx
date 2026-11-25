import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Rooms from './Rooms'
import { loadLogs } from '../util/logStore.js'

vi.mock('../util/logStore.js', () => ({ loadLogs: vi.fn() }))

vi.mock('./Logs', () => ({
  default: ({ isOpen, log, onClose }) => (
    <div data-testid="logs-modal" data-open={String(isOpen)} data-label={log?.label ?? ''}>
      <button onClick={onClose}>close-logs</button>
    </div>
  ),
}))

const SAVED_LOGS = [
  { id: 1, label: 'Oct 3, 2026', fieldValues: ['BSIT 4C', 'IT-ELEC 3', ''] },
  { id: 2, label: 'Oct 5, 2026', fieldValues: ['BSIT 4D'] },
]

describe('Rooms: Logs section', () => {
  beforeEach(() => {
    // /rooms is not under test here; return an empty list.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => [] })),
    )
  })

  // CASE-011
  describe('CASE-011: no saved logs', () => {
    it('shows "No saved logs yet." when the server has no logs', async () => {
      loadLogs.mockResolvedValue([])
      render(<Rooms />)

      expect(await screen.findByText('No saved logs yet.')).toBeInTheDocument()
    })

    it('shows the same message when loading the logs failed (loadLogs returns [])', async () => {
      loadLogs.mockResolvedValue([])
      render(<Rooms />)

      expect(await screen.findByText('No saved logs yet.')).toBeInTheDocument()
      expect(screen.getByTestId('logs-modal')).toHaveAttribute('data-open', 'false')
    })

    it('does not show the empty message while the logs are still loading', async () => {
      let release
      loadLogs.mockReturnValue(new Promise((r) => (release = r)))
      render(<Rooms />)

      expect(screen.getByRole('heading', { name: 'Logs' })).toBeInTheDocument()
      expect(screen.queryByText('No saved logs yet.')).not.toBeInTheDocument()

      release([])
      expect(await screen.findByText('No saved logs yet.')).toBeInTheDocument()
    })
  })

  describe('saved log list', () => {
    it('lists each saved log with its label and non-empty field values', async () => {
      loadLogs.mockResolvedValue(SAVED_LOGS)
      render(<Rooms />)

      expect(await screen.findByText('Oct 3, 2026')).toBeInTheDocument()
      expect(screen.getByText('Oct 5, 2026')).toBeInTheDocument()
      expect(screen.getByText('BSIT 4C')).toBeInTheDocument()
      expect(screen.getByText('IT-ELEC 3')).toBeInTheDocument()
      expect(screen.getByText('BSIT 4D')).toBeInTheDocument()
      expect(screen.queryByText('No saved logs yet.')).not.toBeInTheDocument()
    })

    it('opens the Logs modal for the clicked entry and closes it again', async () => {
      const user = userEvent.setup()
      loadLogs.mockResolvedValue(SAVED_LOGS)
      render(<Rooms />)

      await user.click(await screen.findByText('Oct 5, 2026'))

      const modal = screen.getByTestId('logs-modal')
      expect(modal).toHaveAttribute('data-open', 'true')
      expect(modal).toHaveAttribute('data-label', 'Oct 5, 2026')

      await user.click(screen.getByText('close-logs'))
      await waitFor(() => expect(modal).toHaveAttribute('data-open', 'false'))
    })
  })
})