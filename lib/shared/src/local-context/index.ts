import type { URI } from 'vscode-uri'

import type { ContextItem, ContextItemFile } from '../codebase-context/messages'
import type { EmbeddingsSearchResult } from '../sourcegraph-api/graphql/client'

export type ContextResult = ContextItem & {
    repoName?: string
    revision?: string
    content: string
}

export interface FilenameContextFetcher {
    getContext(query: string, numResults: number): Promise<ContextResult[]>
}

export interface LocalEmbeddingsFetcher {
    getContext(query: string, numResults: number): Promise<EmbeddingsSearchResult[]>
}

// Minimal interface so inline edit can use remote search for context.
export interface IRemoteSearch {
    setWorkspaceUri(uri: URI): Promise<void>
    search(query: string): Promise<ContextItemFile[]>
}

interface Point {
    row: number
    col: number
}

interface Range {
    startByte: number
    endByte: number
    startPoint: Point
    endPoint: Point
}

export interface Result {
    fqname: string
    name: string
    type: string
    doc: string
    exported: boolean
    lang: string
    file: URI
    range: Range
    summary: string
}

export interface IndexedKeywordContextFetcher {
    getResults(query: string, scopeDirs: URI[]): Promise<Promise<Result[]>[]>
}

/**
 * File result that renders in the search panel webview
 */
export interface SearchPanelFile {
    uri: URI
    snippets: SearchPanelSnippet[]
}

/**
 * Snippet result that renders in the search panel webview
 */
export interface SearchPanelSnippet {
    contents: string
    range: {
        start: {
            line: number
            character: number
        }
        end: {
            line: number
            character: number
        }
    }
}
