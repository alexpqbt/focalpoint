import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ViewersModal from './ViewersModal'

const ANA = {
  identity: 's1',
  name: 'Ana Cruz',
  attributes: { 'First Name': 'Ana', 'Last Name': 'Cruz' },
}
const BEN = {
  identity: 's2',
  name: 'Ben Diaz',
  attributes: { 'First Name': 'Ben' }, // no Last Name answer
}

let fetchMock
let config

function setup(props = {}) {
  const onRemoveViewer = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <ViewersModal viewers={[]} onRemoveViewer={onRemoveViewer} onClose={onClose} {...props} />,
  )
  const rerenderWith = (next) =>
    utils.rerender(
      <ViewersModal viewers={[]} onRemoveViewer={onRemoveViewer} onClose={onClose} {...next} />,
    )
  return { ...utils, onRemoveViewer, onClose, rerenderWith }
}

const removeButtons = () => screen.queryAllByRole('button', { name: 'Remove' })
const heading = (n) => screen.getByRole('heading', { name: `Viewers: ${n}` })

beforeEach(() => {
  config = { user_inputs: [], fields: [] }
  fetchMock = vi.fn(() => Promise.resolve({ json: async () => config }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
describe('CASE-031: no viewers connected', () => {
  it('shows a connection count of zero', () => {
    setup()
    expect(heading(0)).toBeInTheDocument()
  })

  it('shows an empty list: no viewer rows and no Remove buttons', () => {
    setup()
    expect(removeButtons()).toHaveLength(0)
  })

  it('still shows the Name and Action column headers', () => {
    setup()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  it('loads the room configuration once when it opens', async () => {
    setup()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/room-config')
  })
})

// ---------------------------------------------------------------------------
describe('CASE-032: viewers connected', () => {
  it('shows the total count, every viewer name and a Remove button per viewer', () => {
    setup({ viewers: [ANA, BEN] })

    expect(heading(2)).toBeInTheDocument()
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
    expect(screen.getByText('Ben Diaz')).toBeInTheDocument()
    expect(removeButtons()).toHaveLength(2)
  })

  it('shows one column per user input, filled from each viewer\'s answers', async () => {
    config = { user_inputs: ['First Name', 'Last Name'], fields: [] }
    setup({ viewers: [ANA, BEN] })

    expect(await screen.findByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Last Name')).toBeInTheDocument()
    expect(screen.queryByText('Name')).not.toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Cruz')).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
    // The combined display name is not shown when the room defines its own inputs
    expect(screen.queryByText('Ana Cruz')).not.toBeInTheDocument()
  })

  it('leaves the cell blank when a viewer has no answer for a label', async () => {
    config = { user_inputs: ['First Name', 'Last Name'], fields: [] }
    setup({ viewers: [BEN] })
    await screen.findByText('Last Name')

    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.queryByText('Diaz')).not.toBeInTheDocument()
    expect(removeButtons()).toHaveLength(1)
  })

  it('shows the session fields above the list, with an em dash for an empty value', async () => {
    config = {
      user_inputs: [],
      fields: [
        { name: 'Section', value: 'BSIT 4C' },
        { name: 'Subject', value: '' },
      ],
    }
    setup({ viewers: [ANA] })

    expect(await screen.findByText('Section')).toBeInTheDocument()
    expect(screen.getByText('BSIT 4C')).toBeInTheDocument()
    expect(screen.getByText('Subject')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows no session field bar when the room has no fields', async () => {
    setup({ viewers: [ANA] })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('falls back to a single Name column when the configuration cannot be loaded', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    setup({ viewers: [ANA] })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
  })

  it('falls back to a single Name column when the configuration has no inputs key', async () => {
    config = {}
    setup({ viewers: [ANA] })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The code labels this button "Remove" (the appendix calls it "Disconnect").
describe('CASE-033: Remove a viewer', () => {
  it('calls onRemoveViewer with that viewer\'s identity', () => {
    const { onRemoveViewer } = setup({ viewers: [ANA, BEN] })

    fireEvent.click(removeButtons()[1])

    expect(onRemoveViewer).toHaveBeenCalledTimes(1)
    expect(onRemoveViewer).toHaveBeenCalledWith('s2')
  })

  it('does not close the overlay when Remove is clicked', () => {
    const { onClose } = setup({ viewers: [ANA] })

    fireEvent.click(removeButtons()[0])

    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not drop the row by itself: the parent owns the list', () => {
    setup({ viewers: [ANA, BEN] })

    fireEvent.click(removeButtons()[0])

    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
    expect(heading(2)).toBeInTheDocument()
  })

  it('removes the row and lowers the count once the parent sends the updated list', () => {
    const { rerenderWith } = setup({ viewers: [ANA, BEN] })

    rerenderWith({ viewers: [BEN] })

    expect(heading(1)).toBeInTheDocument()
    expect(screen.queryByText('Ana Cruz')).not.toBeInTheDocument()
    expect(screen.getByText('Ben Diaz')).toBeInTheDocument()
    expect(removeButtons()).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
describe('CASE-034: remove the last remaining viewer', () => {
  it('empties the list and shows a count of zero', () => {
    const { rerenderWith } = setup({ viewers: [ANA] })
    expect(heading(1)).toBeInTheDocument()

    rerenderWith({ viewers: [] })

    expect(heading(0)).toBeInTheDocument()
    expect(screen.queryByText('Ana Cruz')).not.toBeInTheDocument()
    expect(removeButtons()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
describe('CASE-035: dismiss the overlay', () => {
  it('closes from the X button', () => {
    const { onClose } = setup({ viewers: [ANA] })

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked', () => {
    const { onClose, container } = setup({ viewers: [ANA] })

    fireEvent.click(container.firstChild)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open when the card itself is clicked', () => {
    const { onClose } = setup({ viewers: [ANA] })

    fireEvent.click(heading(1))
    fireEvent.click(screen.getByText('Ana Cruz'))

    expect(onClose).not.toHaveBeenCalled()
  })
})