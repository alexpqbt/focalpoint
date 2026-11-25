import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Logs from './Logs'

const LOG = {
  id: 1,
  label: 'Section A / IT-ELEC 3',
  columns: ['Date', 'Time Stamp', 'Status', 'First Name', 'Last Name', 'Section'],
  rows: [
    ['2026-10-03', '10:00:01', 'Entered', 'Ana', 'Cruz', 'BSIT 4C'],
    ['2026-10-03', '10:30:12', 'Left', 'Ana', 'Cruz', 'BSIT 4C'],
  ],
  fieldValues: ['BSIT 4C', 'IT-ELEC 3'],
  maxSize: 30,
}

const okResponse = (blob = new Blob(['data'])) => ({ ok: true, blob: async () => blob })

describe('Logs modal', () => {
  let fetchMock
  let anchorClicks
  let clickSpy

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)

    URL.createObjectURL = vi.fn(() => 'blob:fake-url')
    URL.revokeObjectURL = vi.fn()

    anchorClicks = []
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      anchorClicks.push({
        download: this.getAttribute('download'),
        href: this.href,
        attachedToDom: document.body.contains(this),
      })
    })
  })

  afterEach(() => {
    clickSpy.mockRestore()
  })

  describe('visibility', () => {
    it('renders nothing when closed', () => {
      render(<Logs isOpen={false} log={LOG} />)
      expect(screen.queryByText('Logs')).not.toBeInTheDocument()
    })

    it('renders nothing when there is no log', () => {
      render(<Logs isOpen log={null} />)
      expect(screen.queryByText('Logs')).not.toBeInTheDocument()
    })

    it('renders the title, label, field values and download buttons when open', () => {
      render(<Logs isOpen log={LOG} />)

      expect(screen.getByRole('heading', { name: 'Logs' })).toBeInTheDocument()
      expect(screen.getByText('Section A / IT-ELEC 3')).toBeInTheDocument()
      expect(screen.getByText('IT-ELEC 3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument()
    })

    it('falls back to "Log" when the log has no label', () => {
      render(<Logs isOpen log={{ ...LOG, label: '' }} />)
      expect(screen.getByText('Log')).toBeInTheDocument()
    })
  })

  describe('table', () => {
    it('renders every column header and row cell', () => {
      render(<Logs isOpen log={LOG} />)

      LOG.columns.forEach((c) =>
        expect(screen.getByRole('columnheader', { name: c })).toBeInTheDocument(),
      )
      expect(screen.getAllByRole('row')).toHaveLength(1 + LOG.rows.length)
      expect(screen.getByText('10:00:01')).toBeInTheDocument()
      expect(screen.getByText('Left')).toBeInTheDocument()
    })

    it('renders an empty body for a log without rows', () => {
      render(<Logs isOpen log={{ ...LOG, rows: [] }} />)
      expect(screen.getAllByRole('row')).toHaveLength(1)
    })
  })

  // CASE-009
  describe('CASE-009: PDF button', () => {
    it('posts the table to /logs/render as PDF', async () => {
      const user = userEvent.setup()
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'PDF' }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toBe('/logs/render?format=pdf')
      expect(opts.method).toBe('POST')
      expect(opts.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(opts.body)).toEqual({
        columns: LOG.columns,
        rows: LOG.rows,
        field_count: 2,
        max_size: 30,
      })
    })

    it('downloads the result as a sanitised .pdf file and releases the object URL', async () => {
      const user = userEvent.setup()
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'PDF' }))

      await waitFor(() => expect(anchorClicks).toHaveLength(1))
      expect(anchorClicks[0]).toEqual({
        download: 'Section_A___IT_ELEC_3.pdf',
        href: 'blob:fake-url',
        attachedToDom: true,
      })
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
      expect(document.querySelector('a[download]')).toBeNull()
    })
  })

  // CASE-010
  describe('CASE-010: CSV button', () => {
    it('posts the table to /logs/render as CSV', async () => {
      const user = userEvent.setup()
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'CSV' }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      expect(fetchMock.mock.calls[0][0]).toBe('/logs/render?format=csv')
    })

    it('downloads the result as a .csv file', async () => {
      const user = userEvent.setup()
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'CSV' }))

      await waitFor(() => expect(anchorClicks).toHaveLength(1))
      expect(anchorClicks[0].download).toBe('Section_A___IT_ELEC_3.csv')
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    })

    it('uses "log" as the file name when the label is empty', async () => {
      const user = userEvent.setup()
      render(<Logs isOpen log={{ ...LOG, label: '' }} />)

      await user.click(screen.getByRole('button', { name: 'CSV' }))

      await waitFor(() => expect(anchorClicks).toHaveLength(1))
      expect(anchorClicks[0].download).toBe('log.csv')
    })

    it('sends max_size as null when the log has none', async () => {
      const user = userEvent.setup()
      const { maxSize, ...withoutMax } = LOG
      render(<Logs isOpen log={withoutMax} />)

      await user.click(screen.getByRole('button', { name: 'CSV' }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_size).toBeNull()
    })
  })

  describe('download state and errors', () => {
    it('disables both buttons while a download is in progress', async () => {
      const user = userEvent.setup()
      let release
      fetchMock.mockReturnValueOnce(new Promise((r) => (release = r)))
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'CSV' }))

      expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled()

      release(okResponse())
      await waitFor(() => expect(screen.getByRole('button', { name: 'CSV' })).toBeEnabled())
      expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled()
    })

    it('shows the status and server message when the server rejects the request', async () => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Table too large',
        blob: async () => new Blob(),
      })
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'PDF' }))

      expect(await screen.findByText('Server returned 400: Table too large')).toBeInTheDocument()
      expect(anchorClicks).toHaveLength(0)
      expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled()
    })

    it('shows only the status when the error body cannot be read', async () => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => {
          throw new Error('stream failed')
        },
      })
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'CSV' }))

      expect(await screen.findByText('Server returned 403')).toBeInTheDocument()
    })

    it('shows the error message when the network request fails', async () => {
      const user = userEvent.setup()
      fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'))
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'CSV' }))

      expect(await screen.findByText('Failed to fetch')).toBeInTheDocument()
    })

    it('clears a previous error when the next download starts', async () => {
      const user = userEvent.setup()
      fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'))
      render(<Logs isOpen log={LOG} />)

      await user.click(screen.getByRole('button', { name: 'CSV' }))
      await screen.findByText('Failed to fetch')

      await user.click(screen.getByRole('button', { name: 'CSV' }))

      await waitFor(() => expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument())
      await waitFor(() => expect(anchorClicks).toHaveLength(1))
    })
  })

  describe('closing', () => {
    it('closes from the X button', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Logs isOpen log={LOG} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'Close modal' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes when the backdrop is clicked but not when the card is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Logs isOpen log={LOG} onClose={onClose} />)

      await user.click(screen.getByRole('heading', { name: 'Logs' }))
      expect(onClose).not.toHaveBeenCalled()

      const backdrop = screen.getByRole('heading', { name: 'Logs' }).closest('.fixed')
      await user.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})