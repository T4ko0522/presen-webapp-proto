/**
 * 操作履歴管理（Undo/Redo）
 *
 * - コマンドパターンで操作を抽象化
 * - 履歴上限を超えたら古いものから捨てる
 * - 新規コマンド実行時は redo スタックを破棄
 */

export interface Command {
  label?: string
  execute: () => void
  undo: () => void
}

export interface HistoryOptions {
  capacity?: number
}

const DEFAULT_CAPACITY = 100

export class HistoryManager {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private readonly capacity: number

  constructor(options: HistoryOptions = {}) {
    this.capacity = options.capacity ?? DEFAULT_CAPACITY
  }

  execute(command: Command): void {
    command.execute()
    this.undoStack.push(command)
    if (this.undoStack.length > this.capacity) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  undo(): void {
    const command = this.undoStack.pop()
    if (!command) return
    command.undo()
    this.redoStack.push(command)
  }

  redo(): void {
    const command = this.redoStack.pop()
    if (!command) return
    command.execute()
    this.undoStack.push(command)
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
