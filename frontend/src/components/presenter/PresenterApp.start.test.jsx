import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PresenterApp from './PresenterApp'
import { initConfig, VIDEO_CFG } from '../config.js'

// ---------------------------------------------------------------------------
// Shared mock state (hoisted so vi.mock factories can reach it)
// ---------------------------------------------------------------------------
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

// Child components are replaced so only PresenterApp's own logic is under test.
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
  default: ({ isSharing, viewers }) => (
    <div data-testid="dashboard" data-sharing={String(isSharing)} data-viewers={viewers.length} />
  ),
}))
vi.mock('./modals/QrModal', () => ({ default: () => <div data-testid="qr-modal" /> }))
vi.mock('./modals/ViewersModal', () => ({ default: () => <div data-testid="viewers-modal" /> }))
vi.mock('./modals/ChatModal', () => ({ default: () => <div data-testid="chat-modal" /> }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function installFetch() {
  const fetchMock = vi.fn(async (url) => {
    if (String(url).startsWith('/token')) return { ok: true, text: async () => 'jwt-token' }
    if (url === '/participants') return { ok: true, json: async () => ({ participants: [] }) }
    return { ok: true, json: async () => ({}) }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function renderReady() {
  const user = userEvent.setup()
  render(<PresenterApp />)
  const splash = await screen.findByTestId('splash')
  return { user, splash }
}

const urlsCalled = (fetchMock) => fetchMock.mock.calls.map(([url]) => String(url))

// ---------------------------------------------------------------------------
describe('PresenterApp: Start Broadcast', () => {
  let fetchMock
  let errorSpy

  beforeEach(() => {
    mocks.room = buildRoom()
    fetchMock = installFetch()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('shows a loading state until the config is initialised', async () => {
    let release
    initConfig.mockImplementationOnce(() => new Promise((r) => (release = r)))

    render(<PresenterApp />)
    expect(screen.getByText(/Loading/)).toBeInTheDocument()
    expect(screen.queryByTestId('splash')).not.toBeInTheDocument()

    release()
    expect(await screen.findByTestId('splash')).toBeInTheDocument()
  })

  // CASE-001
  describe('CASE-001: host clicks "Share Screen"', () => {
    it('requests the browser screen-share dialog with the configured video settings', async () => {
      const { user } = await renderReady()

      await user.click(screen.getByRole('button', { name: 'Share Screen' }))

      await waitFor(() =>
        expect(mocks.room.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(
          true,
          VIDEO_CFG,
        ),
      )
    })

    it('requests a presenter token and resets the session log before connecting', async () => {
      const { user } = await renderReady()

      await user.click(screen.getByRole('button', { name: 'Share Screen' }))
      await waitFor(() => expect(mocks.room.connect).toHaveBeenCalled())

      expect(urlsCalled(fetchMock)).toContain('/token?role=presenter&identity=presenter')
      const resetCall = fetchMock.mock.calls.find(([url]) => url === '/logs/reset')
      expect(resetCall[1]).toMatchObject({
        method: 'POST',
        headers: { Authorization: 'Bearer jwt-token' },
      })
      expect(mocks.room.connect).toHaveBeenCalledWith('ws://192.168.1.10:7880', 'jwt-token')
    })

    it('ignores further clicks while a screen-share request is pending', async () => {
      mocks.room.localParticipant.setScreenShareEnabled.mockReturnValue(new Promise(() => {}))
      const { user } = await renderReady()
      const button = screen.getByRole('button', { name: 'Share Screen' })

      await user.click(button)
      await waitFor(() =>
        expect(mocks.room.localParticipant.setScreenShareEnabled).toHaveBeenCalledTimes(1),
      )
      await user.click(button)

      expect(mocks.room.localParticipant.setScreenShareEnabled).toHaveBeenCalledTimes(1)
    })
  })

  // CASE-002
  describe('CASE-002: host selects a screen and confirms permission', () => {
    it('moves to the Active Broadcast (dashboard) screen', async () => {
      const { user } = await renderReady()

      await user.click(screen.getByRole('button', { name: 'Share Screen' }))

      const dashboard = await screen.findByTestId('dashboard')
      expect(dashboard).toHaveAttribute('data-sharing', 'true')
      expect(screen.queryByTestId('splash')).not.toBeInTheDocument()
      expect(screen.getByTestId('header')).toHaveTextContent('dashboard')
    })

    it('registers the student-message handler and the track-unpublished listener', async () => {
      const { user } = await renderReady()

      await user.click(screen.getByRole('button', { name: 'Share Screen' }))
      await screen.findByTestId('dashboard')

      expect(mocks.room.registerTextStreamHandler).toHaveBeenCalledWith(
        'student-message',
        expect.any(Function),
      )
      expect(mocks.room.on).toHaveBeenCalledWith('localTrackUnpublished', expect.any(Function))
    })

    it('starts polling participants with the presenter token', async () => {
      const { user } = await renderReady()

      await user.click(screen.getByRole('button', { name: 'Share Screen' }))
      await screen.findByTestId('dashboard')

      await waitFor(() => expect(urlsCalled(fetchMock)).toContain('/participants'))
      const call = fetchMock.mock.calls.find(([url]) => url === '/participants')
      expect(call[1]).toEqual({ headers: { Authorization: 'Bearer jwt-token' } })
    })
  })

  // CASE-003
  describe('CASE-003: host denies permission or cancels the dialog', () => {
    beforeEach(() => {
      mocks.room.localParticipant.setScreenShareEnabled.mockRejectedValue(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
      )
    })

    it('stays on the Start Broadcast screen', async () => {
      const { user } = await renderReady()

      await user.click(screen.getByRole('button', { name: 'Share Screen' }))
      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('Failed to start sharing:', expect.any(Error)),
      )

      expect(screen.getByTestId('splash')).toBeInTheDocument()
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument()
      expect(screen.getByTestId('header')).toHaveTextContent('splash')
    })

    it('does not start participant polling or publish a stream', async () => {
      const { user } = await renderReady()

      await user.click(screen.getByRole('button', { name: 'Share Screen' }))
      await waitFor(() => expect(errorSpy).toHaveBeenCalled())

      expect(urlsCalled(fetchMock)).not.toContain('/participants')
      expect(mocks.room.localParticipant.getTrackPublication).not.toHaveBeenCalled()
      expect(mocks.room.registerTextStreamHandler).not.toHaveBeenCalled()
    })

    it('resets the sharing flag so the host can try again', async () => {
      const { user } = await renderReady()
      const button = screen.getByRole('button', { name: 'Share Screen' })

      await user.click(button)
      await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1))
      await user.click(button)
      await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(2))

      expect(mocks.room.localParticipant.setScreenShareEnabled).toHaveBeenCalledTimes(2)
    })

    it('stays on the Start screen when no screen-share video track is published', async () => {
      mocks.room.localParticipant.setScreenShareEnabled.mockResolvedValue(undefined)
      mocks.room.localParticipant.getTrackPublication.mockReturnValue(undefined)
      const { user } = await renderReady()

      await user.click(screen.getByRole('button', { name: 'Share Screen' }))
      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('Failed to start sharing:', expect.any(Error)),
      )

      expect(screen.getByTestId('splash')).toBeInTheDocument()
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument()
    })

    // Known gap in PresenterApp.startSharing: the LiveKit room is connected (and the
    // log reset) before the screen-share prompt. On denial the catch block does not
    // disconnect the room. Enable this test after adding `roomRef.current?.disconnect()`
    // to the catch block.
    it.todo('disconnects the LiveKit room after a denied permission (not implemented in source)')
  })
})