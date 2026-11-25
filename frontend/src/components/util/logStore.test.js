import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadLogs, saveLog } from './logStore.js'

describe('logStore', () => {
  let fetchMock
  let errorSpy

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  describe('loadLogs', () => {
    it('returns the saved logs from /logs/saved', async () => {
      const logs = [{ id: 1, label: 'a' }]
      fetchMock.mockResolvedValue({ ok: true, json: async () => logs })

      await expect(loadLogs()).resolves.toEqual(logs)
      expect(fetchMock).toHaveBeenCalledWith('/logs/saved')
    })

    it('returns an empty list when there are no logs', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
      await expect(loadLogs()).resolves.toEqual([])
    })

    it('returns an empty list when the server response is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 })
      await expect(loadLogs()).resolves.toEqual([])
    })

    it('returns an empty list when the payload is not an array', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ detail: 'oops' }) })
      await expect(loadLogs()).resolves.toEqual([])
    })

    it('returns an empty list and logs the error when the request throws', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))

      await expect(loadLogs()).resolves.toEqual([])
      expect(errorSpy).toHaveBeenCalledWith('Failed to load logs:', expect.any(Error))
    })
  })

  describe('saveLog', () => {
    const snapshot = {
      columns: ['Date', 'Time Stamp', 'Status', 'Name'],
      rows: [['2026-10-03', '10:00:00', 'Entered', 'Ana']],
      field_values: ['BSIT 4C'],
      max_size: 30,
    }

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a snapshot without rows', { columns: ['a'] }],
      ['a snapshot with empty rows', { columns: ['a'], rows: [] }],
    ])('returns null without calling the server for %s', async (_label, input) => {
      await expect(saveLog(input)).resolves.toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('posts columns, rows and field_values to /logs/saved', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ entry: { id: 7 } }) })

      const result = await saveLog(snapshot)

      expect(result).toEqual({ id: 7 })
      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toBe('/logs/saved')
      expect(opts.method).toBe('POST')
      expect(opts.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(opts.body)).toEqual({
        columns: snapshot.columns,
        rows: snapshot.rows,
        field_values: ['BSIT 4C'],
      })
    })

    it('defaults field_values to an empty list', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ entry: { id: 1 } }) })
      const { field_values, ...rest } = snapshot

      await saveLog(rest)

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).field_values).toEqual([])
    })

    it('returns null when the server does not return an entry', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ saved: false }) })
      await expect(saveLog(snapshot)).resolves.toBeNull()
    })

    it('returns null and logs the error when the server response is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400 })

      await expect(saveLog(snapshot)).resolves.toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Failed to save log:', expect.any(Error))
    })

    it('returns null and logs the error when the request throws', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))

      await expect(saveLog(snapshot)).resolves.toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Failed to save log:', expect.any(Error))
    })
  })
})