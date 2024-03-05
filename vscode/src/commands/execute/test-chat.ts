import { type ContextItem, logDebug, logError } from '@sourcegraph/cody-shared'
import { getEditor } from '../../editor/active-editor'
import type { ChatCommandResult } from '../../main'
import { telemetryService } from '../../services/telemetry'
import { telemetryRecorder } from '../../services/telemetry-v2'
import { getContextFileFromCursor } from '../context/selection'
import { getContextFilesForTestCommand } from '../context/unit-test-chat'
import type { CodyCommandArgs } from '../types'
import { type ExecuteChatArguments, executeChat } from './ask'

import type { Span } from '@opentelemetry/api'
import { wrapInActiveSpan } from '@sourcegraph/cody-shared/src/tracing'

/**
 * Generates the prompt and context files with arguments for the '/test' command in Chat.
 *
 * Context: Test files, current selection, and current file
 */
async function unitTestCommand(
    span: Span,
    args?: Partial<CodyCommandArgs>
): Promise<ExecuteChatArguments> {
    let prompt =
        "Review the shared code context and configurations to identify the test framework and libraries in use. Then, generate a suite of multiple unit tests for the functions in <selected> using the detected test framework and libraries. Be sure to import the function being tested. Follow the same patterns as any shared context. Only add packages, imports, dependencies, and assertions if they are used in the shared code. Pay attention to the file path of each shared context to see if test for <selected> already exists. If one exists, focus on generating new unit tests for uncovered cases. If none are detected, import common unit test libraries for {languageName}. Focus on validating key functionality with simple and complete assertions. Only include mocks if one is detected in the shared code. Before writing the tests, identify which test libraries and frameworks to import, e.g. 'No new imports needed - using existing libs' or 'Importing test framework that matches shared context usage' or 'Importing the defined framework', etc. Then briefly summarize test coverage and any limitations. At the end, enclose the full completed code for the new unit tests, including all necessary imports, in a single markdown codeblock. No fragments or TODO. The new tests should validate expected functionality and cover edge cases for <selected> with all required imports, including importing the function being tested. Do not repeat existing tests."

    if (args?.additionalInstruction) {
        prompt = `${prompt} ${args.additionalInstruction}`
    }

    const editor = getEditor()?.active
    const document = editor?.document
    const contextFiles: ContextItem[] = []

    if (document) {
        try {
            const cursorContext = await getContextFileFromCursor()
            contextFiles.push(...cursorContext)

            contextFiles.push(...(await getContextFilesForTestCommand(document.uri)))
        } catch (error) {
            logError('testCommand', 'failed to fetch context', { verbose: error })
        }
    }

    return {
        text: prompt,
        contextFiles,
        addEnhancedContext: false,
        source: 'test',
        submitType: 'user-newchat',
    }
}

/**
 * Executes the /test command for generating unit tests in Chat for selected code.
 *
 * NOTE: Currently used by agent until inline test command is added to agent.
 */
export async function executeTestChatCommand(
    args?: Partial<CodyCommandArgs>
): Promise<ChatCommandResult | undefined> {
    return wrapInActiveSpan('command.test-chat', async span => {
        span.setAttribute('sampled', true)
        logDebug('executeTestEditCommand', 'executing', { args })
        telemetryService.log('CodyVSCodeExtension:command:test:executed', {
            useCodebaseContex: false,
            requestID: args?.requestID,
            source: args?.source,
            traceId: span.spanContext().traceId,
        })
        telemetryRecorder.recordEvent('cody.command.test', 'executed', {
            metadata: {
                useCodebaseContex: 0,
            },
            interactionID: args?.requestID,
            privateMetadata: {
                requestID: args?.requestID,
                source: args?.source,
                traceId: span.spanContext().traceId,
            },
        })

        return {
            type: 'chat',
            session: await executeChat(await unitTestCommand(span, args)),
        }
    })
}
