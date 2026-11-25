import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom does not implement MediaStream; PresenterApp builds one from the screen-share track.
export class FakeMediaStream {
  constructor(tracks = []) {
    this.tracks = tracks
  }
  getTracks() {
    return this.tracks
  }
}
globalThis.MediaStream = FakeMediaStream