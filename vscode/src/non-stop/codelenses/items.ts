import * as vscode from 'vscode'

import { isRateLimitError } from '@sourcegraph/cody-shared'

import { isRunningInsideAgent } from '../../jsonrpc/isRunningInsideAgent'
import type { FixupTask } from '../FixupTask'
import { CodyTaskState } from '../utils'

// Create Lenses based on state
export function getLensesForTask(task: FixupTask): vscode.CodeLens[] {
    const codeLensRange = new vscode.Range(task.selectionRange.start, task.selectionRange.start)
    const isTest = task.intent === 'test'
    switch (task.state) {
        case CodyTaskState.pending:
        case CodyTaskState.working: {
            const title = getWorkingLens(codeLensRange)
            const cancel = getCancelLens(codeLensRange, task.id)
            return [title, cancel]
        }
        case CodyTaskState.inserting: {
            if (isTest) {
                return [getUnitTestLens(codeLensRange)]
            }
            return [getInsertingLens(codeLensRange), getCancelLens(codeLensRange, task.id)]
        }
        case CodyTaskState.applying: {
            const title = getApplyingLens(codeLensRange)
            const cancel = getCancelLens(codeLensRange, task.id)
            return [title, cancel]
        }
        case CodyTaskState.formatting: {
            const title = getFormattingLens(codeLensRange)
            const skip = getFormattingSkipLens(codeLensRange, task.id)
            return [title, skip]
        }
        case CodyTaskState.applied: {
            const accept = getAcceptLens(codeLensRange, task.id)
            const retry = getRetryLens(codeLensRange, task.id)
            const undo = getUndoLens(codeLensRange, task.id)
            const showDiff = getDiffLens(codeLensRange, task.id)
            if (isTest) {
                return [accept, undo]
            }
            return [accept, retry, undo, showDiff]
        }
        case CodyTaskState.error: {
            const title = getErrorLens(codeLensRange, task)
            const discard = getDiscardLens(codeLensRange, task.id)
            return [title, discard]
        }
        default:
            return []
    }
}

// List of lenses
function getErrorLens(codeLensRange: vscode.Range, task: FixupTask): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    if (isRateLimitError(task.error)) {
        if (task.error.upgradeIsAvailable) {
            lens.command = {
                title: '⚡️ Upgrade to Cody Pro',
                command: 'cody.show-rate-limit-modal',
                arguments: [
                    task.error.userMessage,
                    task.error.retryMessage,
                    task.error.upgradeIsAvailable,
                ],
            }
        } else {
            lens.command = {
                title: '$(warning) Rate Limit Exceeded',
                command: 'cody.show-rate-limit-modal',
                arguments: [
                    task.error.userMessage,
                    task.error.retryMessage,
                    task.error.upgradeIsAvailable,
                ],
            }
        }
    } else {
        lens.command = {
            title: '$(warning) Applying Edits Failed',
            command: 'cody.fixup.codelens.error',
            arguments: [task.id],
        }
    }
    return lens
}

function getWorkingLens(codeLensRange: vscode.Range): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    lens.command = {
        title: '$(sync~spin) Cody is working...',
        command: 'cody.focus',
    }
    return lens
}

function getInsertingLens(codeLensRange: vscode.Range): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    lens.command = {
        title: '$(sync~spin) Inserting...',
        command: 'cody.focus',
    }
    return lens
}

function getApplyingLens(codeLensRange: vscode.Range): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    lens.command = {
        title: '$(sync~spin) Applying...',
        command: 'cody.focus',
    }
    return lens
}

function getFormattingLens(codeLensRange: vscode.Range): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    lens.command = {
        title: '$(sync~spin) Formatting...',
        command: 'cody.focus',
    }
    return lens
}

function getFormattingSkipLens(codeLensRange: vscode.Range, id: string): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    lens.command = {
        title: 'Skip',
        command: 'cody.fixup.codelens.skip-formatting',
        arguments: [id],
    }
    return lens
}

function getCancelLens(codeLensRange: vscode.Range, id: string): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    const shortcut = isRunningInsideAgent() ? '' : ` (${process.platform === 'darwin' ? '⌥Z' : 'Alt+Z'})`
    lens.command = {
        title: `Cancel${shortcut}`,
        command: 'cody.fixup.codelens.cancel',
        arguments: [id],
    }
    return lens
}

function getDiscardLens(codeLensRange: vscode.Range, id: string): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    lens.command = {
        title: 'Discard',
        command: 'cody.fixup.codelens.cancel',
        arguments: [id],
    }
    return lens
}

function getDiffLens(codeLensRange: vscode.Range, id: string): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    lens.command = {
        title: 'Show Diff',
        command: 'cody.fixup.codelens.diff',
        arguments: [id],
    }
    return lens
}

function getRetryLens(codeLensRange: vscode.Range, id: string): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    const shortcut = isRunningInsideAgent() ? '' : ` (${process.platform === 'darwin' ? '⌥R' : 'Alt+R'})`
    lens.command = {
        title: `Edit & Retry${shortcut}`,
        command: 'cody.fixup.codelens.retry',
        arguments: [id],
    }
    return lens
}

function getUndoLens(codeLensRange: vscode.Range, id: string): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    const shortcut = isRunningInsideAgent() ? '' : ` (${process.platform === 'darwin' ? '⌥X' : 'Alt+X'})`
    lens.command = {
        title: `Undo${shortcut}`,
        command: 'cody.fixup.codelens.undo',
        arguments: [id],
    }
    return lens
}

function getAcceptLens(codeLensRange: vscode.Range, id: string): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    const shortcut = isRunningInsideAgent() ? '' : ` (${process.platform === 'darwin' ? '⌥A' : 'Alt+A'})`
    lens.command = {
        title: `$(cody-logo) Accept${shortcut}`,
        command: 'cody.fixup.codelens.accept',
        arguments: [id],
    }
    return lens
}

function getUnitTestLens(codeLensRange: vscode.Range): vscode.CodeLens {
    const lens = new vscode.CodeLens(codeLensRange)
    lens.command = {
        title: '$(sync~spin) Generating tests...',
        command: 'cody.focus',
    }
    return lens
}
