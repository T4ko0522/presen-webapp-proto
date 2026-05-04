import { describe, it, expect, beforeEach } from 'vitest'
import { HistoryManager, type Command } from './history'

function makeCounterCommand(state: { value: number }, delta: number): Command {
  return {
    label: `add ${delta}`,
    execute: () => { state.value += delta },
    undo: () => { state.value -= delta },
  }
}

describe('HistoryManager', () => {
  let history: HistoryManager
  let state: { value: number }

  beforeEach(() => {
    history = new HistoryManager()
    state = { value: 0 }
  })

  it('execute() runs the command and pushes it onto the stack', () => {
    history.execute(makeCounterCommand(state, 5))
    expect(state.value).toBe(5)
    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)
  })

  it('undo() reverts the last command', () => {
    history.execute(makeCounterCommand(state, 5))
    history.execute(makeCounterCommand(state, 3))
    expect(state.value).toBe(8)

    history.undo()
    expect(state.value).toBe(5)

    history.undo()
    expect(state.value).toBe(0)
  })

  it('redo() reapplies an undone command', () => {
    history.execute(makeCounterCommand(state, 7))
    history.undo()
    expect(state.value).toBe(0)
    history.redo()
    expect(state.value).toBe(7)
  })

  it('executing a new command after undo discards the redo stack', () => {
    history.execute(makeCounterCommand(state, 1))
    history.execute(makeCounterCommand(state, 2))
    history.undo()
    expect(history.canRedo()).toBe(true)

    history.execute(makeCounterCommand(state, 10))
    expect(history.canRedo()).toBe(false)
    expect(state.value).toBe(11)
  })

  it('respects the capacity limit by dropping oldest commands', () => {
    const limited = new HistoryManager({ capacity: 3 })
    for (let i = 1; i <= 5; i++) {
      limited.execute(makeCounterCommand(state, i))
    }
    expect(state.value).toBe(15)
    // Capacity 3 → only the last three commands (3, 4, 5) remain undoable
    limited.undo() // -5
    limited.undo() // -4
    limited.undo() // -3
    expect(state.value).toBe(3) // 1 + 2 still applied (dropped from history)
    expect(limited.canUndo()).toBe(false)
  })

  it('undo on empty stack is a no-op', () => {
    expect(history.canUndo()).toBe(false)
    history.undo()
    expect(state.value).toBe(0)
  })

  it('clear() empties both stacks', () => {
    history.execute(makeCounterCommand(state, 1))
    history.execute(makeCounterCommand(state, 2))
    history.undo()
    history.clear()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })
})
