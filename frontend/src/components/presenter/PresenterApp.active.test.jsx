import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import PresenterApp from './PresenterApp'
import { saveLog } from '../util/logStore.js'

const mocks = vi.hoisted(() => ({ room: null }))

vi.mock('livekit-client', () => ({
  Room: vi.fn(function Room() {
    return mocks.room
  }),
  RoomEvent: { LocalTrackUnpublished: 'localTrackUnpublished' },
}))

vi.mock('../config.js', () => ({
  initConfig: vi.fn(() => Promise.resolve()),
  getServerIP: vi.fn(() => '192.168.1.10'),
  getLivekitURI: vi.fn(() => 'ws://192.168.1.10:7880'),
  VIDEO_CFG: { resolution: { width: 1280, height: 720 } },
}))

vi.mock('../util/polyfill.js', () => ({}))
vi.mock('../util/logStore.js', () => ({ saveLog: vi.fn() }))
vi.mock('qrcode', () => ({ toCanvas: vi.fn() }))

vi.mock('../common/Header', () => ({
  default: ({ currentScreen }) => <div data-testid="header">{currentScreen}</div>,
}))
vi.mock('../common/Footer', () => ({ default: () => <div data-testid="footer" /> }))
vi.mock('./SplashScreen', () => ({
  default: ({ onStartSharing }) => (
    <div data-testid="splash">
      <button onClick={onStartSharing}>Share Screen</button>
    </div>
  ),
}))
vi.mock('./Dashboard', () => ({
  default: ({ viewers, messages, onEndSession, onOpenModal }) => (
    <div
      data-testid="dashboard"
      data-viewer-count={viewers.length}
      data-viewer-names={JSON.stringify(viewers.map((v) => v.name))}
      data-message-count={messages.length}
    >
      <button onClick={onEndSession}>End Session</button>
      <button onClick={() => onOpenModal('qr')}>open-qr</button>
    </div>
  ),
}))
vi.mock('./modals/QrModal', () => ({
  default: ({ viewerURL }) => <div data-testid="qr-modal">{viewerURL}</div>,
}))
vi.mock('./modals/ViewersModal', () => ({ default: () => <div data-testid="viewers-modal" /> }))
vi.mock('./modals/ChatModal', () => ({ default: () => <div data-testid="chat-modal" /> }))

function buildRoom() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    registerTextStreamHandler: vi.fn(),
    remoteParticipants: new Map(),
    localParticipant: {
      setScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
      getTrackPublication: vi.fn().mockReturnValue({
        videoTrack: { mediaStreamTrack: { kind: 'video' } },
      }),
    },
  }
}

describe('PresenterApp: Active Broadcast', () => {
  let participants
  let snapshotResponse
  let fetchMock
  let errorSpy
  let setIntervalSpy
  let clearIntervalSpy

  const urlsCalled = () => fetchMock.mock.calls.map(([url]) => String(url))

  // Runs one polling tick (the callback registered with the 3500 ms interval).
  const pollOnce = async () => {
    const [cb] = setIntervalSpy.mock.calls.find(([, delay]) => delay === 3500)
    await act(async () => {
      await cb()
    })
  }

  const startBroadcast = async () => {
    render(<PresenterApp />)
    fireEvent.click(await screen.findByRole('button', { name: 'Share Screen' }))
    return screen.findByTestId('dashboard')
  }

  beforeEach(() => {
    mocks.room = buildRoom()
    participants = []
    snapshotResponse = { ok: true, json: async () => ({ rows: [['r1']] }) }

    fetchMock = vi.fn(async (url) => {
      const u = String(url)
      if (u.startsWith('/token')) return { ok: true, text: async () => 'jwt-token' }
      if (u === '/participants') return { ok: true, json: async () => ({ participants }) }
      if (u === '/logs/snapshot') return snapshotResponse
      return { ok: true, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)

    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
  })

  afterEach(() => {
    errorSpy.mockRestore()
    setIntervalSpy.mockRestore()
    clearIntervalSpy.mockRestore()
  })

  // CASE-004
  describe('CASE-004: Active Broadcast screen', () => {
    it('opens with a viewer count of 0', async () => {
      const dashboard = await startBroadcast()
      await waitFor(() => expect(urlsCalled()).toContain('/participants'))
      expect(dashboard).toHaveAttribute('data-viewer-count', '0')
    })

    it('builds the viewer URL from the server IP and shows it in the QR modal', async () => {
      await startBroadcast()

      fireEvent.click(screen.getByText('open-qr'))

      expect(await screen.findByTestId('qr-modal')).toHaveTextContent(
        'http://192.168.1.10:8080/view',
      )
    })
  })

  // CASE-005
  describe('CASE-005: viewers join', () => {
    it('increases the viewer count on the next poll', async () => {
      const dashboard = await startBroadcast()
      await waitFor(() => expect(dashboard).toHaveAttribute('data-viewer-count', '0'))

      participants = [{ identity: 's1', name: 'Ana Cruz', attributes: { section: 'A' } }]
      await pollOnce()
      await waitFor(() => expect(dashboard).toHaveAttribute('data-viewer-count', '1'))

      participants = [
        ...participants,
        { identity: 's2', name: 'Ben Diaz', attributes: {} },
      ]
      await pollOnce()
      await waitFor(() => expect(dashboard).toHaveAttribute('data-viewer-count', '2'))
    })

    it('falls back to the identity when a participant has no name', async () => {
      const dashboard = await startBroadcast()
      participants = [{ identity: 'student-42' }]

      await pollOnce()

      await waitFor(() =>
        expect(dashboard).toHaveAttribute('data-viewer-names', JSON.stringify(['student-42'])),
      )
    })

    it('polls /participants with the presenter bearer token', async () => {
      await startBroadcast()
      await pollOnce()

      const calls = fetchMock.mock.calls.filter(([url]) => url === '/participants')
      expect(calls.length).toBeGreaterThanOrEqual(2)
      calls.forEach(([, opts]) =>
        expect(opts).toEqual({ headers: { Authorization: 'Bearer jwt-token' } }),
      )
    })

    it('keeps the previous count when a poll request fails', async () => {
      const dashboard = await startBroadcast()
      participants = [{ identity: 's1', name: 'Ana' }]
      await pollOnce()
      await waitFor(() => expect(dashboard).toHaveAttribute('data-viewer-count', '1'))

      fetchMock.mockImplementation(async (url) =>
        url === '/participants' ? { ok: false, status: 500 } : { ok: true, json: async () => ({}) },
      )
      await pollOnce()

      expect(errorSpy).toHaveBeenCalledWith('participant fetch failed', 500)
      expect(dashboard).toHaveAttribute('data-viewer-count', '1')
    })
  })

  // CASE-006
  describe('CASE-006: viewers close the browser', () => {
    it('decreases the viewer count on the next poll', async () => {
      const dashboard = await startBroadcast()
      participants = [
        { identity: 's1', name: 'Ana' },
        { identity: 's2', name: 'Ben' },
      ]
      await pollOnce()
      await waitFor(() => expect(dashboard).toHaveAttribute('data-viewer-count', '2'))

      participants = [{ identity: 's2', name: 'Ben' }]
      await pollOnce()
      await waitFor(() => expect(dashboard).toHaveAttribute('data-viewer-count', '1'))

      participants = []
      await pollOnce()
      await waitFor(() => expect(dashboard).toHaveAttribute('data-viewer-count', '0'))
    })
  })

  // CASE-007
  describe('CASE-007: host clicks "End Session"', () => {
    it('saves the log snapshot, disconnects the room and returns to the splash screen', async () => {
      await startBroadcast()

      fireEvent.click(screen.getByRole('button', { name: 'End Session' }))

      expect(await screen.findByTestId('splash')).toBeInTheDocument()
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument()
      expect(screen.getByTestId('header')).toHaveTextContent('splash')

      expect(urlsCalled()).toContain('/logs/snapshot')
      expect(saveLog).toHaveBeenCalledWith({ rows: [['r1']] })
      expect(mocks.room.localParticipant.setScreenShareEnabled).toHaveBeenLastCalledWith(false)
      expect(mocks.room.disconnect).toHaveBeenCalledTimes(1)
    })

    it('polls participants once more before saving so the last joins and leaves are recorded', async () => {
      await startBroadcast()
      await waitFor(() => expect(urlsCalled()).toContain('/participants'))
      const before = urlsCalled().filter((u) => u === '/participants').length

      fireEvent.click(screen.getByRole('button', { name: 'End Session' }))
      await screen.findByTestId('splash')

      const urls = urlsCalled()
      expect(urls.filter((u) => u === '/participants').length).toBe(before + 1)
      expect(urls.lastIndexOf('/participants')).toBeLessThan(urls.indexOf('/logs/snapshot'))
    })

    it('stops participant polling', async () => {
      await startBroadcast()
      const intervalId = setIntervalSpy.mock.results[
        setIntervalSpy.mock.calls.findIndex(([, d]) => d === 3500)
      ].value

      fireEvent.click(screen.getByRole('button', { name: 'End Session' }))
      await screen.findByTestId('splash')

      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId)
    })

    it('clears received messages', async () => {
      await startBroadcast()
      const [, handler] = mocks.room.registerTextStreamHandler.mock.calls[0]
      mocks.room.remoteParticipants.set('s1', { name: 'Ana Cruz' })
      await act(async () => {
        await handler({ readAll: async () => 'hello' }, { identity: 's1' })
      })
      expect(screen.getByTestId('dashboard')).toHaveAttribute('data-message-count', '1')

      fireEvent.click(screen.getByRole('button', { name: 'End Session' }))
      await screen.findByTestId('splash')

      // After a new session starts, there must be no leftover messages.
      fireEvent.click(screen.getByRole('button', { name: 'Share Screen' }))
      expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-message-count', '0')
    })

    it('still ends the session when the snapshot request is not ok', async () => {
      snapshotResponse = { ok: false, status: 500 }
      await startBroadcast()

      fireEvent.click(screen.getByRole('button', { name: 'End Session' }))

      expect(await screen.findByTestId('splash')).toBeInTheDocument()
      expect(saveLog).not.toHaveBeenCalled()
      expect(mocks.room.disconnect).toHaveBeenCalled()
    })

    it('still ends the session when saving the log throws', async () => {
      saveLog.mockRejectedValueOnce(new Error('db down'))
      await startBroadcast()

      fireEvent.click(screen.getByRole('button', { name: 'End Session' }))

      expect(await screen.findByTestId('splash')).toBeInTheDocument()
      expect(errorSpy).toHaveBeenCalledWith('Failed to save session log:', expect.any(Error))
      expect(mocks.room.disconnect).toHaveBeenCalled()
    })

    it('still returns to the splash screen when disconnecting fails', async () => {
      mocks.room.disconnect.mockRejectedValueOnce(new Error('socket closed'))
      await startBroadcast()

      fireEvent.click(screen.getByRole('button', { name: 'End Session' }))

      expect(await screen.findByTestId('splash')).toBeInTheDocument()
      expect(errorSpy).toHaveBeenCalledWith('Failed to stop sharing:', expect.any(Error))
    })

    it('disconnects the room when the component unmounts mid-broadcast', async () => {
      const { unmount } = render(<PresenterApp />)
      fireEvent.click(await screen.findByRole('button', { name: 'Share Screen' }))
      await screen.findByTestId('dashboard')

      unmount()

      expect(mocks.room.disconnect).toHaveBeenCalledTimes(1)
    })
  })
})