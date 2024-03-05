import type { URI } from 'vscode-uri'
import { ProgrammingLanguage, languageFromFilename } from '../common/languages'
import type { Configuration } from '../configuration'
import type {
    IRemoteSearch,
    IndexedKeywordContextFetcher,
    LocalEmbeddingsFetcher,
} from '../local-context'
import { populateCodeContextTemplate, populateMarkdownContextTemplate } from '../prompt/templates'
import type { EmbeddingsSearchResult } from '../sourcegraph-api/graphql/client'

import type { RangeData } from '../common/range'
import {
    type ContextFileSource,
    type ContextItem,
    type ContextMessage,
    getContextMessageWithResponse,
} from './messages'

interface ContextSearchOptions {
    numCodeResults: number
    numTextResults: number
}

export class CodebaseContext {
    constructor(
        private config: Pick<Configuration, 'useContext'>,
        private codebase: string | undefined,
        public readonly localEmbeddings: LocalEmbeddingsFetcher | undefined,
        _symf: IndexedKeywordContextFetcher | undefined,
        private readonly remoteSearch: IRemoteSearch | undefined
    ) {}

    public onConfigurationChange(newConfig: typeof this.config): void {
        this.config = newConfig
    }

    /**
     * Returns list of context messages for a given query, sorted in *reverse* order of importance (that is,
     * the most important context message appears *last*)
     */
    public async getContextMessages(
        workspaceFolderUri: URI,
        query: string,
        options: ContextSearchOptions
    ): Promise<ContextMessage[]> {
        switch (this.config.useContext) {
            case 'embeddings':
                return this.getEmbeddingsContextMessages(query, options)
            case 'keyword':
                return this.getKeywordContextMessages(workspaceFolderUri, query, options)
            case 'none':
                return []
            default: {
                return (
                    // TODO: Implement blending when https://github.com/sourcegraph/cody/pull/2804 lands.
                    (
                        await Promise.all([
                            this.getKeywordContextMessages(workspaceFolderUri, query, options),
                            this.getEmbeddingsContextMessages(query, options),
                        ])
                    ).flat()
                )
            }
        }
    }

    private async getKeywordContextMessages(
        workspaceFolderUri: URI,
        query: string,
        options: ContextSearchOptions
    ): Promise<ContextMessage[]> {
        // TODO: Add symf here for local keyword context.
        if (this.remoteSearch) {
            await this.remoteSearch.setWorkspaceUri(workspaceFolderUri)
            const files = (await this.remoteSearch.search(query)).slice(
                0,
                options.numCodeResults + options.numTextResults
            )
            return files.flatMap(file =>
                getContextMessageWithResponse(
                    populateCodeContextTemplate(file.content || '', file.uri, file.repoName),
                    file
                )
            )
        }
        return []
    }

    // We split the context into multiple messages instead of joining them into a single giant message.
    // We can gradually eliminate them from the prompt, instead of losing them all at once with a single large messeage
    // when we run out of tokens.
    private async getEmbeddingsContextMessages(
        query: string,
        options: ContextSearchOptions
    ): Promise<ContextMessage[]> {
        return groupResultsByFile(
            (await this.localEmbeddings?.getContext(query, options.numCodeResults)) || []
        )
            .reverse() // Reverse results so that they appear in ascending order of importance (least -> most).
            .flatMap(groupedResults => CodebaseContext.makeContextMessageWithResponse(groupedResults))
            .map(message => contextMessageWithSource(message, 'embeddings', this.codebase))
    }

    public static makeContextMessageWithResponse(groupedResults: {
        file: ContextItem & Required<Pick<ContextItem, 'uri'>>
        results: string[]
    }): ContextMessage[] {
        const contextTemplateFn =
            languageFromFilename(groupedResults.file.uri) === ProgrammingLanguage.Markdown
                ? populateMarkdownContextTemplate
                : populateCodeContextTemplate

        return groupedResults.results.flatMap<ContextMessage>(text =>
            getContextMessageWithResponse(
                contextTemplateFn(text, groupedResults.file.uri, groupedResults.file.repoName),
                groupedResults.file
            )
        )
    }
}

function groupResultsByFile(
    results: EmbeddingsSearchResult[]
): { file: ContextItem & Required<Pick<ContextItem, 'uri'>>; results: string[] }[] {
    const originalFileOrder: (ContextItem & Required<Pick<ContextItem, 'uri'>>)[] = []
    for (const result of results) {
        if (
            !originalFileOrder.find(
                (ogFile: ContextItem) => ogFile.uri.toString() === result.uri.toString()
            )
        ) {
            originalFileOrder.push({
                uri: result.uri,
                repoName: result.repoName,
                revision: result.revision,
                range: createContextFileRange(result),
                source: 'embeddings',
                type: 'file',
                content: '',
            })
        }
    }

    const resultsGroupedByFile = new Map<string /* resultUri.toString() */, EmbeddingsSearchResult[]>()
    for (const result of results) {
        const results = resultsGroupedByFile.get(result.uri.toString())
        if (results === undefined) {
            resultsGroupedByFile.set(result.uri.toString(), [result])
        } else {
            resultsGroupedByFile.set(result.uri.toString(), results.concat([result]))
        }
    }

    return originalFileOrder.map(file => ({
        file,
        results: mergeConsecutiveResults(resultsGroupedByFile.get(file.uri.toString())!),
    }))
}

function mergeConsecutiveResults(results: EmbeddingsSearchResult[]): string[] {
    const sortedResults = results.sort((a, b) => a.startLine - b.startLine)
    const mergedResults = [results[0].content]

    for (let i = 1; i < sortedResults.length; i++) {
        const result = sortedResults[i]
        const previousResult = sortedResults[i - 1]

        if (result.startLine === previousResult.endLine) {
            mergedResults[mergedResults.length - 1] = mergedResults.at(-1)! + result.content
        } else {
            mergedResults.push(result.content)
        }
    }

    return mergedResults
}

function contextMessageWithSource(
    message: ContextMessage,
    source: ContextFileSource,
    codebase?: string
): ContextMessage {
    if (message.file) {
        message.file.source = source
        message.file.repoName = codebase ?? message.file.repoName
    }
    return message
}

function createContextFileRange(result: EmbeddingsSearchResult): RangeData {
    return {
        start: {
            line: result.startLine,
            character: 0,
        },
        end: {
            line: result.endLine,
            character: 0,
        },
    }
}
