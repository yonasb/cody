// TODO: use implements vscode.XXX on mocked classes to ensure they match the real vscode API.
import fspromises from 'fs/promises'

import type * as vscode_types from 'vscode'
import type {
    InlineCompletionTriggerKind as VSCodeInlineCompletionTriggerKind,
    Location as VSCodeLocation,
    Position as VSCodePosition,
    Range as VSCodeRange,
} from 'vscode'

import { type Configuration, type FeatureFlag, FeatureFlagProvider } from '@sourcegraph/cody-shared'

import { AgentEventEmitter as EventEmitter } from './AgentEventEmitter'
import { Uri } from './uri'

export { Uri } from './uri'

export { AgentEventEmitter as EventEmitter } from './AgentEventEmitter'
export { AgentWorkspaceEdit as WorkspaceEdit } from './AgentWorkspaceEdit'
export { Disposable } from './Disposable'
import { AgentWorkspaceEdit as WorkspaceEdit } from './AgentWorkspaceEdit'

/**
 * This module defines shared VSCode mocks for use in every Vitest test.
 * Tests requiring no custom mocks will automatically apply the mocks defined in this file.
 * This is made possible via the `setupFiles` property in the Vitest configuration.
 */

export enum InlineCompletionTriggerKind {
    // biome-ignore lint/style/useLiteralEnumMembers: want satisfies typecheck
    Invoke = 0 satisfies VSCodeInlineCompletionTriggerKind.Invoke,
    // biome-ignore lint/style/useLiteralEnumMembers: want satisfies typecheck
    Automatic = 1 satisfies VSCodeInlineCompletionTriggerKind.Automatic,
}

export enum QuickPickItemKind {
    Separator = -1,
    Default = 0,
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3,
}

export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
}

export enum LogLevel {
    Off = 0,
    Trace = 1,
    Debug = 2,
    Info = 3,
    Warning = 4,
    Error = 5,
}
export enum ExtensionKind {
    UI = 1,
    Workspace = 2,
}

export enum CommentThreadCollapsibleState {
    Collapsed = 0,
    Expanded = 1,
}

export enum OverviewRulerLane {
    Left = 1,
    Center = 2,
    Right = 4,
    Full = 7,
}

export class CodeLens {
    public readonly isResolved = true
    constructor(
        public readonly range: Range,
        public readonly command?: vscode_types.Command
    ) {}
}
export class ThemeColor {
    constructor(public readonly id: string) {}
}

export class ThemeIcon {
    static readonly File = new ThemeIcon('file')
    static readonly Folder = new ThemeIcon('folder')
    constructor(
        public readonly id: string,
        public readonly color?: ThemeColor
    ) {}
}

export enum ColorThemeKind {
    Light = 1,
    Dark = 2,
    HighContrast = 3,
    HighContrastLight = 4,
}

export class MarkdownString implements vscode_types.MarkdownString {
    constructor(public readonly value: string) {}
    isTrusted?: boolean | { readonly enabledCommands: readonly string[] } | undefined
    supportThemeIcons?: boolean | undefined
    supportHtml?: boolean | undefined
    baseUri?: vscode_types.Uri | undefined
    appendText(): vscode_types.MarkdownString {
        throw new Error('Method not implemented.')
    }
    appendMarkdown(): vscode_types.MarkdownString {
        throw new Error('Method not implemented.')
    }
    appendCodeblock(): vscode_types.MarkdownString {
        throw new Error('Method not implemented.')
    }
}

export enum TextEditorRevealType {
    Default = 0,
    InCenter = 1,
    InCenterIfOutsideViewport = 2,
    AtTop = 3,
}

export enum CommentMode {
    Editing = 0,
    Preview = 1,
}

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2,
}
export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3,
}
export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
}
export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
}
export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
}
export class CodeAction {
    edit?: WorkspaceEdit
    diagnostics?: vscode_types.Diagnostic[]
    command?: vscode_types.Command
    isPreferred?: boolean
    disabled?: {
        readonly reason: string
    }
    constructor(
        public readonly title: string,
        public readonly kind?: vscode_types.CodeActionKind
    ) {}
}
export class CodeActionKind {
    static readonly Empty = new CodeActionKind('Empty')
    static readonly QuickFix = new CodeActionKind('')
    static readonly Refactor = new CodeActionKind('')
    static readonly RefactorExtract = new CodeActionKind('')
    static readonly RefactorInline = new CodeActionKind('')
    static readonly RefactorMove = new CodeActionKind('')
    static readonly RefactorRewrite = new CodeActionKind('')
    static readonly Source = new CodeActionKind('')
    static readonly SourceOrganizeImports = new CodeActionKind('')

    static readonly SourceFixAll = new CodeActionKind('')

    constructor(public readonly value: string) {}
}
// biome-ignore lint/complexity/noStaticOnlyClass: mock
export class QuickInputButtons {
    public static readonly Back: vscode_types.QuickInputButton = {
        iconPath: Uri.parse('file://foobar'),
    }
}

export class TreeItem {
    constructor(
        public readonly resourceUri: vscode_types.Uri,
        public readonly collapsibleState?: TreeItemCollapsibleState
    ) {}
}

export class RelativePattern implements vscode_types.RelativePattern {
    public baseUri: Uri
    public base: string
    constructor(
        _base: vscode_types.WorkspaceFolder | vscode_types.Uri | string,
        public readonly pattern: string
    ) {
        this.baseUri =
            typeof _base === 'string'
                ? Uri.file(_base)
                : 'uri' in _base
                  ? Uri.from(_base.uri)
                  : Uri.from(_base)
        this.base = _base.toString()
    }
}

export class Position implements VSCodePosition {
    public line: number
    public character: number

    constructor(line: number, character: number) {
        this.line = line
        this.character = character
    }

    public isAfter(other: Position): boolean {
        return other.line < this.line || (other.line === this.line && other.character < this.character)
    }
    public isAfterOrEqual(other: Position): boolean {
        return this.isAfter(other) || this.isEqual(other)
    }
    public isBefore(other: Position): boolean {
        return !this.isAfterOrEqual(other)
    }
    public isBeforeOrEqual(other: Position): boolean {
        return !this.isAfter(other)
    }
    public isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character
    }
    public translate(change: {
        lineDelta?: number
        characterDelta?: number
    }): VSCodePosition
    public translate(lineDelta?: number, characterDelta?: number): VSCodePosition
    public translate(
        arg?: number | { lineDelta?: number; characterDelta?: number },
        characterDelta?: number
    ): VSCodePosition {
        const lineDelta = typeof arg === 'number' ? arg : arg?.lineDelta
        characterDelta = arg && typeof arg !== 'number' ? arg.characterDelta : characterDelta
        return new Position(this.line + (lineDelta || 0), this.character + (characterDelta || 0))
    }

    public with(line?: number, character?: number): VSCodePosition
    public with(change: { line?: number; character?: number }): VSCodePosition
    public with(
        arg?: number | { line?: number; character?: number },
        character?: number
    ): VSCodePosition {
        const newLine = typeof arg === 'number' ? arg : arg?.line
        const newCharacter = arg && typeof arg !== 'number' ? arg?.character : character
        return new Position(newLine ?? this.line, newCharacter ?? this.character)
    }

    public compareTo(other: VSCodePosition): number {
        return this.isBefore(other) ? -1 : this.isAfter(other) ? 1 : 0
    }
}

export class Location implements VSCodeLocation {
    public range: VSCodeRange

    constructor(
        public readonly uri: vscode_types.Uri,
        rangeOrPosition: VSCodeRange | VSCodePosition
    ) {
        if ('line' in rangeOrPosition && 'character' in rangeOrPosition) {
            this.range = new Range(rangeOrPosition, rangeOrPosition)
        } else {
            this.range = rangeOrPosition
        }
    }
}

export class Range implements VSCodeRange {
    public start: Position
    public end: Position

    constructor(
        startLine: number | Position,
        startCharacter: number | Position,
        endLine?: number,
        endCharacter?: number
    ) {
        if (typeof startLine !== 'number' && typeof startCharacter !== 'number') {
            this.start = startLine
            this.end = startCharacter
        } else if (
            typeof startLine === 'number' &&
            typeof startCharacter === 'number' &&
            typeof endLine === 'number' &&
            typeof endCharacter === 'number'
        ) {
            this.start = new Position(startLine, startCharacter)
            this.end = new Position(endLine, endCharacter)
        } else {
            throw new TypeError('this version of the constructor is not implemented')
        }
    }

    public with(start?: VSCodePosition, end?: VSCodePosition): VSCodeRange
    public with(change: {
        start?: VSCodePosition
        end?: VSCodePosition
    }): VSCodeRange
    public with(
        arg?: VSCodePosition | { start?: VSCodePosition; end?: VSCodePosition },
        end?: VSCodePosition
    ): VSCodeRange {
        const start = arg && ('start' in arg || 'end' in arg) ? arg.start : (arg as VSCodePosition)
        end = arg && 'end' in arg ? arg.end : end
        return new Range(start || this.start, end || this.end)
    }
    public get startLine(): number {
        return this.start.line
    }
    public get startCharacter(): number {
        return this.start.character
    }
    public get endLine(): number {
        return this.end.line
    }
    public get endCharacter(): number {
        return this.end.character
    }
    public isEqual(other: VSCodeRange): boolean {
        return this.start.isEqual(other.start) && this.end.isEqual(other.end)
    }
    public get isEmpty(): boolean {
        return this.start.isEqual(this.end)
    }
    public get isSingleLine(): boolean {
        return this.start.line === this.end.line
    }
    public contains(positionOrRange: Position | Range): boolean {
        if ('line' in positionOrRange) {
            return (
                positionOrRange.line >= this.start.line &&
                positionOrRange.line <= this.end.line &&
                positionOrRange.character >= this.start.character &&
                positionOrRange.character <= this.end.character
            )
        }

        throw new Error('not implemented')
    }
    public intersection(): VSCodeRange | undefined {
        throw new Error('not implemented')
    }
    public union(): VSCodeRange {
        throw new Error('not implemented')
    }
}

export class Selection extends Range {
    public readonly anchor: Position
    public readonly active: Position
    constructor(
        anchorLine: number | Position,
        anchorCharacter: number | Position,
        activeLine?: number,
        activeCharacter?: number
    ) {
        if (
            typeof anchorLine === 'number' &&
            typeof anchorCharacter === 'number' &&
            typeof activeLine === 'number' &&
            typeof activeCharacter === 'number'
        ) {
            super(anchorLine, anchorCharacter, activeLine, activeCharacter)
        } else if (typeof anchorLine === 'object' && typeof anchorCharacter === 'object') {
            super(anchorLine, anchorCharacter)
        } else {
            throw new TypeError('this version of the constructor is not implemented')
        }
        this.anchor = this.start
        this.active = this.end
    }

    /**
     * Create a selection from four coordinates.
     * @param anchorLine A zero-based line value.
     * @param anchorCharacter A zero-based character value.
     * @param activeLine A zero-based line value.
     * @param activeCharacter A zero-based character value.
     */
    // constructor(anchorLine: number, anchorCharacter: number, activeLine: number, activeCharacter: number) {}

    /**
     * A selection is reversed if its {@link Selection.anchor anchor} is the {@link Selection.end end} position.
     */
    isReversed = false
}

export enum FoldingRangeKind {
    Comment = 1,
    Imports = 2,
    Region = 3,
}

export class FoldingRange {
    constructor(
        public start: number,
        public end: number,
        public kind?: FoldingRangeKind
    ) {}
}

export class InlineCompletionItem {
    public insertText: string
    public range: Range | undefined
    constructor(content: string, range?: Range) {
        this.insertText = content
        this.range = range
    }
}

// TODO(abeatrix): Implement delete and insert mocks
export enum EndOfLine {
    LF = 1,
    CRLF = 2,
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

export class CancellationToken implements vscode_types.CancellationToken {
    public isCancellationRequested = false
    public emitter = new EventEmitter<void>()
    constructor() {
        this.emitter.event(() => {
            this.isCancellationRequested = true
        })
    }
    onCancellationRequested = this.emitter.event
}
// @cody refactor
export class CancellationTokenSource implements vscode_types.CancellationTokenSource {
    public token = new CancellationToken()
    cancel(): void {
        if (!this.token.isCancellationRequested) {
            this.token.emitter.fire()
        }
    }
    dispose(): void {
        this.token.emitter.dispose()
    }
}

export const workspaceFs: typeof vscode_types.workspace.fs = {
    stat: async uri => {
        const stat = await fspromises.stat(uri.fsPath)
        const type = stat.isFile()
            ? FileType.File
            : stat.isDirectory()
              ? FileType.Directory
              : stat.isSymbolicLink()
                  ? FileType.SymbolicLink
                  : FileType.Unknown

        return {
            type,
            ctime: stat.ctimeMs,
            mtime: stat.mtimeMs,
            size: stat.size,
        }
    },
    readDirectory: async uri => {
        const entries = await fspromises.readdir(uri.fsPath, {
            withFileTypes: true,
        })

        return entries.map(entry => {
            const type = entry.isFile()
                ? FileType.File
                : entry.isDirectory()
                  ? FileType.Directory
                  : entry.isSymbolicLink()
                      ? FileType.SymbolicLink
                      : FileType.Unknown

            return [entry.name, type]
        })
    },
    createDirectory: async uri => {
        await fspromises.mkdir(uri.fsPath, { recursive: true })
    },
    readFile: async uri => {
        try {
            const content = await fspromises.readFile(uri.fsPath)
            return new Uint8Array(content.buffer)
        } catch (error) {
            throw new Error(`no such file: ${uri}`, { cause: error })
        }
    },
    writeFile: async (uri, content) => {
        await fspromises.writeFile(uri.fsPath, content)
    },
    delete: async (uri, options) => {
        await fspromises.rm(uri.fsPath, {
            recursive: options?.recursive ?? false,
        })
    },
    rename: async (source, target, options) => {
        if (options?.overwrite ?? false) {
            await fspromises.unlink(target.fsPath)
        }
        await fspromises.link(source.fsPath, target.fsPath)
        await fspromises.unlink(source.fsPath)
    },
    copy: async (source, target, options) => {
        const mode = options?.overwrite ? 0 : fspromises.constants.COPYFILE_EXCL
        await fspromises.copyFile(source.fsPath, target.fsPath, mode)
    },
    isWritableFileSystem: scheme => {
        if (scheme === 'file') {
            return true
        }
        return false
    },
}

const languages: Partial<typeof vscode_types.languages> = {
    // Copied from the `console.log(vscode.languages.getLanguages())` output.
    getLanguages() {
        return Promise.resolve([
            'plaintext',
            'code-text-binary',
            'Log',
            'log',
            'scminput',
            'bat',
            'clojure',
            'coffeescript',
            'jsonc',
            'json',
            'c',
            'cpp',
            'cuda-cpp',
            'csharp',
            'css',
            'dart',
            'diff',
            'dockerfile',
            'ignore',
            'fsharp',
            'git-commit',
            'git-rebase',
            'go',
            'groovy',
            'handlebars',
            'hlsl',
            'html',
            'ini',
            'properties',
            'java',
            'javascriptreact',
            'javascript',
            'jsx-tags',
            'jsonl',
            'snippets',
            'julia',
            'juliamarkdown',
            'tex',
            'latex',
            'bibtex',
            'cpp_embedded_latex',
            'markdown_latex_combined',
            'less',
            'lua',
            'makefile',
            'markdown',
            'markdown-math',
            'wat',
            'objective-c',
            'objective-cpp',
            'perl',
            'perl6',
            'php',
            'powershell',
            'jade',
            'python',
            'r',
            'razor',
            'restructuredtext',
            'ruby',
            'rust',
            'scss',
            'search-result',
            'shaderlab',
            'shellscript',
            'sql',
            'swift',
            'typescript',
            'typescriptreact',
            'vb',
            'xml',
            'xsl',
            'dockercompose',
            'yaml',
            'tailwindcss',
            'editorconfig',
            'graphql',
            'vue',
            'go.mod',
            'go.work',
            'go.sum',
            'gotmpl',
            'govulncheck',
            'kotlin',
            'kotlinscript',
            'lisp',
            'toml',
            'jinja',
            'pip-requirements',
            'raw',
            'prisma',
            'starlark',
            'bazel',
            'bazelrc',
            'vimrc',
        ])
    },
}

export enum TextDocumentChangeReason {
    Undo = 1,
    Redo = 2,
}
export enum UIKind {
    Desktop = 1,
    Web = 2,
}

export const vsCodeMocks = {
    FileType,
    Range,
    Position,
    InlineCompletionItem,
    EventEmitter,
    EndOfLine,
    CancellationTokenSource,
    ThemeColor,
    ThemeIcon,
    TreeItem,
    WorkspaceEdit,
    UIKind,
    QuickInputButtons,
    Uri,
    languages,
    env: {
        uiKind: 1 satisfies vscode_types.UIKind.Desktop,
    },
    window: {
        showInformationMessage: () => undefined,
        showWarningMessage: () => undefined,
        showQuickPick: () => undefined,
        showInputBox: () => undefined,
        createOutputChannel() {
            return null
        },
        showErrorMessage(message: string) {
            console.error(message)
        },
        activeTextEditor: {
            document: { uri: { scheme: 'not-cody' } },
            options: { tabSize: 4 },
        },
        onDidChangeActiveTextEditor() {},
        createTextEditorDecorationType: () => ({
            key: 'foo',
            dispose: () => {},
        }),
        visibleTextEditors: [],
        tabGroups: { all: [] },
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
    },
    workspace: {
        fs: workspaceFs,
        getConfiguration() {
            return {
                get(key: string) {
                    switch (key) {
                        case 'cody.debug.filter':
                            return '.*'
                        default:
                            return ''
                    }
                },
                update(): void {},
            }
        },
        openTextDocument: (uri: string) => ({
            getText: () => 'foo\nbar\nfoo',
            save: () => true,
        }),
        applyEdit: (edit: WorkspaceEdit) => true,
        save: () => true,
        asRelativePath(path: string | vscode_types.Uri) {
            return path.toString()
        },
        onDidChangeTextDocument() {},
        onDidRenameFiles() {},
        onDidDeleteFiles() {},
    },
    ConfigurationTarget: {
        Global: undefined,
    },
    extensions: {
        getExtension() {
            return undefined
        },
    },
    InlineCompletionTriggerKind,
    SymbolKind,
    FoldingRange,
    FoldingRangeKind,
    CodeActionKind,
    DiagnosticSeverity,
    ViewColumn,
} as const

export enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15,
}

export class MockFeatureFlagProvider extends FeatureFlagProvider {
    constructor(private readonly enabledFlags: Set<FeatureFlag>) {
        super(null as any)
    }

    public evaluateFeatureFlag(flag: FeatureFlag): Promise<boolean> {
        return Promise.resolve(this.enabledFlags.has(flag))
    }

    public getFromCache(flag: FeatureFlag): boolean {
        return this.enabledFlags.has(flag)
    }

    public syncAuthStatus(): Promise<void> {
        return Promise.resolve()
    }
}

export const emptyMockFeatureFlagProvider = new MockFeatureFlagProvider(new Set<FeatureFlag>())

export const DEFAULT_VSCODE_SETTINGS = {
    proxy: null,
    codebase: '',
    customHeaders: {},
    chatPreInstruction: '',
    useContext: 'embeddings',
    autocomplete: true,
    autocompleteLanguages: {
        '*': true,
    },
    commandCodeLenses: false,
    editorTitleCommandIcon: true,
    experimentalGuardrails: false,
    experimentalSimpleChatContext: true,
    experimentalSymfContext: true,
    experimentalTracing: false,
    codeActions: true,
    commandHints: false,
    isRunningInsideAgent: false,
    agentIDE: undefined,
    debugEnable: false,
    debugVerbose: false,
    debugFilter: null,
    telemetryLevel: 'all',
    internalUnstable: false,
    autocompleteAdvancedProvider: null,
    autocompleteAdvancedModel: null,
    autocompleteCompleteSuggestWidgetSelection: true,
    autocompleteFormatOnAccept: true,
    autocompleteDisableInsideComments: false,
    autocompleteExperimentalDynamicMultilineCompletions: false,
    autocompleteExperimentalHotStreak: false,
    autocompleteExperimentalGraphContext: null,
    autocompleteExperimentalSmartThrottle: false,
    autocompleteExperimentalOllamaOptions: {
        model: 'codellama:7b-code',
        url: 'http://localhost:11434',
    },
    autocompleteTimeouts: {
        multiline: undefined,
        singleline: undefined,
    },
    testingLocalEmbeddingsEndpoint: undefined,
    testingLocalEmbeddingsIndexLibraryPath: undefined,
    testingLocalEmbeddingsModel: undefined,
    experimentalChatContextRanker: false,
} satisfies Configuration
