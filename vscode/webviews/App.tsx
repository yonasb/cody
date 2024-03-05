import { useCallback, useEffect, useMemo, useState } from 'react'

import './App.css'

import {
    type ChatInputHistory,
    type ChatMessage,
    type Configuration,
    type ContextItem,
    type EnhancedContextContextT,
    GuardrailsPost,
    type ModelProvider,
    type TranscriptJSON,
} from '@sourcegraph/cody-shared'
import type { UserAccountInfo } from './Chat'
import { EnhancedContextEnabled } from './chat/components/EnhancedContext'

import type { AuthMethod, AuthStatus, LocalEnv } from '../src/chat/protocol'

import { Chat } from './Chat'
import {
    EnhancedContextContext,
    EnhancedContextEventHandlers,
} from './Components/EnhancedContextSettings'
import { LoadingPage } from './LoadingPage'
import type { View } from './NavBar'
import { Notices } from './Notices'
import { LoginSimplified } from './OnboardingExperiment'
import type { VSCodeWrapper } from './utils/VSCodeApi'
import { updateDisplayPathEnvInfoForWebview } from './utils/displayPathEnvInfo'
import { createWebviewTelemetryService } from './utils/telemetry'

export const App: React.FunctionComponent<{ vscodeAPI: VSCodeWrapper }> = ({ vscodeAPI }) => {
    const [config, setConfig] = useState<(Pick<Configuration, 'debugEnable'> & LocalEnv) | null>(null)
    const [view, setView] = useState<View | undefined>()
    // If the current webview is active (vs user is working in another editor tab)
    const [isWebviewActive, setIsWebviewActive] = useState<boolean>(true)
    const [messageInProgress, setMessageInProgress] = useState<ChatMessage | null>(null)
    const [messageBeingEdited, setMessageBeingEdited] = useState<number | undefined>(undefined)
    const [transcript, setTranscript] = useState<ChatMessage[]>([])

    const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
    const [userAccountInfo, setUserAccountInfo] = useState<UserAccountInfo>({
        isDotComUser: true,
        isCodyProUser: false,
    })

    const [formInput, setFormInput] = useState('')
    const [inputHistory, setInputHistory] = useState<ChatInputHistory[]>([])
    const [userHistory, setUserHistory] = useState<TranscriptJSON[]>([])
    const [chatIDHistory, setChatIDHistory] = useState<string[]>([])

    const [contextSelection, setContextSelection] = useState<ContextItem[] | null>(null)

    const [errorMessages, setErrorMessages] = useState<string[]>([])
    const [isTranscriptError, setIsTranscriptError] = useState<boolean>(false)

    const [chatModels, setChatModels] = useState<ModelProvider[]>()

    const [chatEnabled, setChatEnabled] = useState<boolean>(true)
    const [attributionEnabled, setAttributionEnabled] = useState<boolean>(false)

    const [enhancedContextEnabled, setEnhancedContextEnabled] = useState<boolean>(true)
    const [enhancedContextStatus, setEnhancedContextStatus] = useState<EnhancedContextContextT>({
        groups: [],
    })
    const onChooseRemoteSearchRepo = useCallback((): void => {
        vscodeAPI.postMessage({ command: 'context/choose-remote-search-repo' })
    }, [vscodeAPI])
    const onRemoveRemoteSearchRepo = useCallback(
        (id: string): void => {
            vscodeAPI.postMessage({ command: 'context/remove-remote-search-repo', repoId: id })
        },
        [vscodeAPI]
    )
    const onConsentToEmbeddings = useCallback((): void => {
        vscodeAPI.postMessage({ command: 'embeddings/index' })
    }, [vscodeAPI])
    const onShouldBuildSymfIndex = useCallback((): void => {
        vscodeAPI.postMessage({ command: 'symf/index' })
    }, [vscodeAPI])

    const guardrails = useMemo(() => {
        return new GuardrailsPost((snippet: string) => {
            vscodeAPI.postMessage({
                command: 'attribution-search',
                snippet,
            })
        })
    }, [vscodeAPI])

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally refresh on `view`
    useEffect(
        () =>
            vscodeAPI.onMessage(message => {
                switch (message.type) {
                    case 'transcript': {
                        if (message.isMessageInProgress) {
                            const msgLength = message.messages.length - 1
                            setTranscript(message.messages.slice(0, msgLength))
                            setMessageInProgress(message.messages[msgLength])
                            setIsTranscriptError(false)
                        } else {
                            setTranscript(message.messages)
                            setMessageInProgress(null)
                        }
                        setChatIDHistory([...chatIDHistory, message.chatID])
                        vscodeAPI.setState(message.chatID)
                        break
                    }
                    case 'config':
                        setConfig(message.config)
                        setAuthStatus(message.authStatus)
                        setUserAccountInfo({
                            isCodyProUser: !message.authStatus.userCanUpgrade,
                            // Receive this value from the extension backend to make it work
                            // with E2E tests where change the DOTCOM_URL via the env variable TESTING_DOTCOM_URL.
                            isDotComUser: message.authStatus.isDotCom,
                        })
                        setView(message.authStatus.isLoggedIn ? 'chat' : 'login')
                        updateDisplayPathEnvInfoForWebview(message.workspaceFolderUris)
                        // Get chat models
                        if (message.authStatus.isLoggedIn) {
                            vscodeAPI.postMessage({ command: 'get-chat-models' })
                        }
                        break
                    case 'setConfigFeatures':
                        setChatEnabled(message.configFeatures.chat)
                        setAttributionEnabled(message.configFeatures.attribution)
                        break
                    case 'history':
                        setInputHistory(message.localHistory?.input ?? [])
                        setUserHistory(Object.values(message.localHistory?.chat ?? {}))
                        break
                    case 'enhanced-context':
                        setEnhancedContextStatus(message.enhancedContextStatus)
                        break
                    case 'userContextFiles':
                        setContextSelection(message.userContextFiles)
                        break
                    case 'errors':
                        setErrorMessages([...errorMessages, message.errors].slice(-5))
                        break
                    case 'view':
                        setView(message.view)
                        break
                    case 'webview-state':
                        setIsWebviewActive(message.isActive)
                        break
                    case 'transcript-errors':
                        setIsTranscriptError(message.isTranscriptError)
                        break
                    case 'chatModels':
                        setChatModels(message.models)
                        break
                    case 'attribution':
                        if (message.attribution) {
                            guardrails.notifyAttributionSuccess(message.snippet, {
                                repositories: message.attribution.repositoryNames.map(name => {
                                    return { name }
                                }),
                                limitHit: message.attribution.limitHit,
                            })
                        }
                        if (message.error) {
                            guardrails.notifyAttributionFailure(
                                message.snippet,
                                new Error(message.error)
                            )
                        }
                        break
                }
            }),
        [errorMessages, view, vscodeAPI, guardrails]
    )

    useEffect(() => {
        // Notify the extension host that we are ready to receive events
        vscodeAPI.postMessage({ command: 'ready' })
    }, [vscodeAPI])

    useEffect(() => {
        if (!view) {
            vscodeAPI.postMessage({ command: 'initialized' })
        }
    }, [view, vscodeAPI])

    const loginRedirect = useCallback(
        (method: AuthMethod) => {
            // We do not change the view here. We want to keep presenting the
            // login buttons until we get a token so users don't get stuck if
            // they close the browser during an auth flow.
            vscodeAPI.postMessage({
                command: 'auth',
                authKind: 'simplified-onboarding',
                authMethod: method,
            })
        },
        [vscodeAPI]
    )

    const telemetryService = useMemo(() => createWebviewTelemetryService(vscodeAPI), [vscodeAPI])

    if (!view || !authStatus || !config) {
        return <LoadingPage />
    }

    return (
        <div className="outer-container">
            {view === 'login' || !authStatus.isLoggedIn ? (
                <LoginSimplified
                    simplifiedLoginRedirect={loginRedirect}
                    telemetryService={telemetryService}
                    uiKindIsWeb={config?.uiKindIsWeb}
                    vscodeAPI={vscodeAPI}
                />
            ) : (
                <>
                    <Notices
                        probablyNewInstall={
                            !userHistory.filter(chat => chat.interactions.length)?.length
                        }
                        vscodeAPI={vscodeAPI}
                    />
                    {errorMessages && (
                        <ErrorBanner errors={errorMessages} setErrors={setErrorMessages} />
                    )}
                    {view === 'chat' && (
                        <EnhancedContextEventHandlers.Provider
                            value={{
                                onChooseRemoteSearchRepo,
                                onConsentToEmbeddings,
                                onEnabledChange: (enabled): void => {
                                    if (enabled !== enhancedContextEnabled) {
                                        setEnhancedContextEnabled(enabled)
                                    }
                                },
                                onRemoveRemoteSearchRepo,
                                onShouldBuildSymfIndex,
                            }}
                        >
                            <EnhancedContextContext.Provider value={enhancedContextStatus}>
                                <EnhancedContextEnabled.Provider value={enhancedContextEnabled}>
                                    <Chat
                                        chatEnabled={chatEnabled}
                                        userInfo={userAccountInfo}
                                        messageInProgress={messageInProgress}
                                        messageBeingEdited={messageBeingEdited}
                                        setMessageBeingEdited={setMessageBeingEdited}
                                        transcript={transcript}
                                        contextSelection={contextSelection}
                                        setContextSelection={setContextSelection}
                                        formInput={formInput}
                                        setFormInput={setFormInput}
                                        inputHistory={inputHistory}
                                        setInputHistory={setInputHistory}
                                        vscodeAPI={vscodeAPI}
                                        telemetryService={telemetryService}
                                        isTranscriptError={isTranscriptError}
                                        chatModels={chatModels}
                                        setChatModels={setChatModels}
                                        welcomeMessage={getWelcomeMessageByOS(config?.os)}
                                        guardrails={attributionEnabled ? guardrails : undefined}
                                        chatIDHistory={chatIDHistory}
                                        isWebviewActive={isWebviewActive}
                                    />
                                </EnhancedContextEnabled.Provider>
                            </EnhancedContextContext.Provider>
                        </EnhancedContextEventHandlers.Provider>
                    )}
                </>
            )}
        </div>
    )
}

const ErrorBanner: React.FunctionComponent<{ errors: string[]; setErrors: (errors: string[]) => void }> =
    ({ errors, setErrors }) => (
        <div className="error-container">
            {errors.map((error, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: error strings might not be unique, so we have no natural id
                <div key={i} className="error">
                    <span>{error}</span>
                    <button
                        type="button"
                        className="close-btn"
                        onClick={() => setErrors(errors.filter(e => e !== error))}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    )

function getWelcomeMessageByOS(os: string): string {
    const welcomeMessageMarkdown = `Welcome to Cody! Start writing code and Cody will autocomplete lines and entire functions for you.

To run [Cody Commands](command:cody.menu.commands) use the keyboard shortcut <span class="keyboard-shortcut"><span>${
        os === 'darwin' ? '⌥' : 'Alt'
    }</span><span>C</span></span>, the <span class="cody-icons">A</span> button, or right-click anywhere in your code.

You can start a new chat at any time with <span class="keyboard-shortcut"><span>${
        os === 'darwin' ? '⌥' : 'Alt'
    }</span><span>/</span></span> or using the <span class="cody-icons">H</span> button.

For more tips and tricks, see the [Getting Started Guide](command:cody.welcome) and [docs](https://sourcegraph.com/docs/cody).
`
    return welcomeMessageMarkdown
}
