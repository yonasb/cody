import * as vscode from 'vscode'

import {
    CodebaseContext,
    type ConfigurationWithAccessToken,
    type ContextGroup,
    type ContextStatusProvider,
    type Editor,
    type IndexedKeywordContextFetcher,
} from '@sourcegraph/cody-shared'

import { getFullConfig } from '../configuration'
import { getEditor } from '../editor/active-editor'
import type { VSCodeEditor } from '../editor/vscode-editor'
import { ContextStatusAggregator } from '../local-context/enhanced-context-status'
import type { LocalEmbeddingsController } from '../local-context/local-embeddings'
import { logDebug } from '../log'
import { getCodebaseFromWorkspaceUri, gitDirectoryUri } from '../repository/repositoryHelpers'
import type { AuthProvider } from '../services/AuthProvider'
import { getProcessInfo } from '../services/LocalAppDetector'
import { logPrefix, telemetryService } from '../services/telemetry'
import { telemetryRecorder } from '../services/telemetry-v2'
import { AgentEventEmitter } from '../testutils/AgentEventEmitter'

import type { RemoteSearch } from '../context/remote-search'
import type { SidebarChatWebview } from './chat-view/SidebarViewController'
import type { AuthStatus, ConfigurationSubsetForWebview, LocalEnv } from './protocol'

export type Config = Pick<
    ConfigurationWithAccessToken,
    | 'codebase'
    | 'serverEndpoint'
    | 'debugEnable'
    | 'debugFilter'
    | 'debugVerbose'
    | 'customHeaders'
    | 'accessToken'
    | 'useContext'
    | 'codeActions'
    | 'experimentalGuardrails'
    | 'commandCodeLenses'
    | 'experimentalSimpleChatContext'
    | 'experimentalSymfContext'
    | 'editorTitleCommandIcon'
    | 'internalUnstable'
    | 'experimentalChatContextRanker'
>

enum ContextEvent {
    Auth = 'auth',
}

export class ContextProvider implements vscode.Disposable, ContextStatusProvider {
    // We fire messages from ContextProvider to the sidebar webview.
    // TODO(umpox): Should we add support for showing context in other places (i.e. within inline chat)?
    public webview?: SidebarChatWebview

    // Fire event to let subscribers know that the configuration has changed
    public configurationChangeEvent = new vscode.EventEmitter<void>()

    // Codebase-context-related state
    public currentWorkspaceRoot: vscode.Uri | undefined

    protected disposables: vscode.Disposable[] = []

    private statusAggregator: ContextStatusAggregator = new ContextStatusAggregator()
    private statusEmbeddings: vscode.Disposable | undefined = undefined

    constructor(
        public config: Omit<Config, 'codebase'>, // should use codebaseContext.getCodebase() rather than config.codebase
        private editor: VSCodeEditor,
        private symf: IndexedKeywordContextFetcher | undefined,
        private authProvider: AuthProvider,
        public readonly localEmbeddings: LocalEmbeddingsController | undefined,
        private readonly remoteSearch: RemoteSearch | undefined
    ) {
        this.disposables.push(this.configurationChangeEvent)

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(async () => {
                await this.updateCodebaseContext()
            }),
            vscode.workspace.onDidChangeWorkspaceFolders(async () => {
                await this.updateCodebaseContext()
            }),
            this.statusAggregator,
            this.statusAggregator.onDidChangeStatus(() => {
                this.contextStatusChangeEmitter.fire(this)
            }),
            this.contextStatusChangeEmitter
        )

        if (this.localEmbeddings) {
            this.disposables.push(
                this.localEmbeddings.onChange(() => {
                    void this.forceUpdateCodebaseContext()
                })
            )
        }

        if (this.remoteSearch) {
            this.disposables.push(this.remoteSearch)
        }
    }

    // Initializes context provider state. This blocks extension activation and
    // chat startup. Despite being called 'init', this is called multiple times:
    // - Once on extension activation.
    // - With every MessageProvider, including ChatPanelProvider.
    public async init(): Promise<void> {
        await this.updateCodebaseContext()
    }

    public onConfigurationChange(newConfig: Config): Promise<void> {
        logDebug('ContextProvider:onConfigurationChange', 'using codebase', newConfig.codebase)
        this.config = newConfig
        const authStatus = this.authProvider.getAuthStatus()
        if (authStatus.endpoint) {
            this.config.serverEndpoint = authStatus.endpoint
        }

        if (this.configurationChangeEvent instanceof AgentEventEmitter) {
            // NOTE: we must return a promise here from the event handlers to
            // allow the agent to await on changes to authentication
            // credentials.
            return this.configurationChangeEvent.cody_fireAsync(null)
        }

        this.configurationChangeEvent.fire()
        return Promise.resolve()
    }

    private async forceUpdateCodebaseContext(): Promise<void> {
        this.currentWorkspaceRoot = undefined
        return this.syncAuthStatus()
    }

    private async updateCodebaseContext(): Promise<void> {
        if (!this.editor.getActiveTextEditor() && vscode.window.visibleTextEditors.length !== 0) {
            // these are ephemeral
            return
        }
        const workspaceRoot = this.editor.getWorkspaceRootUri()
        if (!workspaceRoot || workspaceRoot.toString() === this.currentWorkspaceRoot?.toString()) {
            return
        }
        this.currentWorkspaceRoot = workspaceRoot

        const codebaseContext = await getCodebaseContext(
            this.config,
            this.authProvider.getAuthStatus(),
            this.symf,
            this.editor,
            this.localEmbeddings,
            this.remoteSearch
        )
        if (!codebaseContext) {
            return
        }
        // After await, check we're still hitting the same workspace root.
        if (
            this.currentWorkspaceRoot &&
            this.currentWorkspaceRoot.toString() !== workspaceRoot.toString()
        ) {
            return
        }

        this.statusEmbeddings?.dispose()
        if (this.localEmbeddings) {
            this.statusEmbeddings = this.statusAggregator.addProvider(this.localEmbeddings)
        }
    }

    /**
     * Save, verify, and sync authStatus between extension host and webview
     * activate extension when user has valid login
     */
    public async syncAuthStatus(): Promise<void> {
        const authStatus = this.authProvider.getAuthStatus()
        // Update config to the latest one and fire configure change event to update external services
        const newConfig = await getFullConfig()
        await this.publishConfig()
        await this.onConfigurationChange(newConfig)
        // When logged out, user's endpoint will be set to null
        const isLoggedOut = !authStatus.isLoggedIn && !authStatus.endpoint
        const eventValue = isLoggedOut ? 'disconnected' : authStatus.isLoggedIn ? 'connected' : 'failed'
        switch (ContextEvent.Auth) {
            case 'auth':
                telemetryService.log(`${logPrefix(newConfig.agentIDE)}:Auth:${eventValue}`, undefined, {
                    agent: true,
                })
                telemetryRecorder.recordEvent('cody.auth', eventValue)
                break
        }
    }

    /**
     * Publish the config to the webview.
     */
    private async publishConfig(): Promise<void> {
        const send = async (): Promise<void> => {
            this.config = await getFullConfig()

            // check if the new configuration change is valid or not
            const authStatus = this.authProvider.getAuthStatus()
            const localProcess = getProcessInfo()
            const configForWebview: ConfigurationSubsetForWebview & LocalEnv = {
                ...localProcess,
                debugEnable: this.config.debugEnable,
                serverEndpoint: this.config.serverEndpoint,
                experimentalGuardrails: this.config.experimentalGuardrails,
            }
            const workspaceFolderUris =
                vscode.workspace.workspaceFolders?.map(folder => folder.uri.toString()) ?? []

            // update codebase context on configuration change
            await this.updateCodebaseContext()
            await this.webview?.postMessage({
                type: 'config',
                config: configForWebview,
                authStatus,
                workspaceFolderUris,
            })

            logDebug('Cody:publishConfig', 'configForWebview', { verbose: configForWebview })
        }

        await send()
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose()
        }
        this.disposables = []
    }

    // ContextStatusProvider implementation
    private contextStatusChangeEmitter = new vscode.EventEmitter<ContextStatusProvider>()

    public get status(): ContextGroup[] {
        return this.statusAggregator.status
    }

    public onDidChangeStatus(callback: (provider: ContextStatusProvider) => void): vscode.Disposable {
        return this.contextStatusChangeEmitter.event(callback)
    }
}

/**
 * Gets codebase context for the current workspace.
 * @returns CodebaseContext if a codebase can be determined, else null
 */
async function getCodebaseContext(
    config: Config,
    authStatus: AuthStatus,
    symf: IndexedKeywordContextFetcher | undefined,
    editor: Editor,
    localEmbeddings: LocalEmbeddingsController | undefined,
    remoteSearch: RemoteSearch | undefined
): Promise<CodebaseContext | null> {
    const workspaceRoot = editor.getWorkspaceRootUri()
    if (!workspaceRoot) {
        return null
    }
    const currentFile = getEditor()?.active?.document?.uri
    // Get codebase from config or fallback to getting codebase name from current file URL
    // Always use the codebase from config as this is manually set by the user
    const codebase =
        config.codebase || (currentFile ? getCodebaseFromWorkspaceUri(currentFile) : config.codebase)
    if (!codebase) {
        return null
    }

    const isConsumer = authStatus.isDotCom

    // TODO(dpc): Support multiple workspace roots when
    // https://github.com/sourcegraph/bfg-private/issues/145 is fixed and
    // cody-engine local embeddings can consume them.
    const repoDirUri = gitDirectoryUri(workspaceRoot)
    const hasLocalEmbeddings = repoDirUri ? localEmbeddings?.load(repoDirUri) : false

    return new CodebaseContext(
        config,
        codebase,
        // Use local embeddings if we have them.
        isConsumer && (await hasLocalEmbeddings) ? localEmbeddings : undefined,
        // TODO(dpc): This should query index availability before passing symf.
        isConsumer ? symf : undefined,
        isConsumer ? undefined : remoteSearch
    )
}
