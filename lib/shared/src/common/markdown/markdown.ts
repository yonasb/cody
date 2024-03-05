import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify'
import { highlight, highlightAuto } from 'highlight.js/lib/core'
import { marked } from 'marked'

// TODO(sqs): copied from sourcegraph/sourcegraph. should dedupe.

/**
 * Escapes HTML by replacing characters like `<` with their HTML escape sequences like `&lt;`
 */
const escapeHTML = (html: string): string => {
    const span = document.createElement('span')
    span.textContent = html
    return span.innerHTML
}

/**
 * Attempts to syntax-highlight the given code.
 * If the language is not given, it is auto-detected.
 * If an error occurs, the code is returned as plain text with escaped HTML entities
 * @param code The code to highlight
 * @param language The language of the code, if known
 * @returns Safe HTML
 */
const highlightCodeSafe = (code: string, language?: string): string => {
    try {
        if (language === 'plaintext' || language === 'text') {
            return escapeHTML(code)
        }
        if (language === 'sourcegraph') {
            return code
        }
        if (language) {
            return highlight(code, { language, ignoreIllegals: true }).value
        }
        return highlightAuto(code).value
    } catch (error) {
        console.error('Error syntax-highlighting hover markdown code block', error)
        return escapeHTML(code)
    }
}

export interface MarkdownOptions {
    /** Whether to render line breaks as HTML `<br>`s */
    breaks?: boolean
    /** Whether to disable autolinks. Explicit links using `[text](url)` are still allowed. */
    disableAutolinks?: boolean
    renderer?: marked.Renderer
    headerPrefix?: string
    /** Strip off any HTML and return a plain text string, useful for previews */
    plainText?: boolean
    dompurifyConfig?: DOMPurifyConfig & { RETURN_DOM_FRAGMENT?: false; RETURN_DOM?: false }
    noDomPurify?: boolean

    /**
     * Add target="_blank" and rel="noopener" to all <a> links that have a
     * href value. This affects all markdown-formatted links and all inline
     * HTML links.
     */
    addTargetBlankToAllLinks?: boolean

    /**
     * Wrap all <a> links that have a href value with the _cody.vscode.open
     * command that will open the links with the editor link handler.
     */
    wrapLinksWithCodyCommand?: boolean
}

/**
 * Renders the given markdown to HTML, highlighting code and sanitizing dangerous HTML.
 * Can throw an exception on parse errors.
 * @param markdown The markdown to render
 */
export const renderMarkdown = (markdown: string, options: MarkdownOptions = {}): string => {
    const tokenizer = new marked.Tokenizer()
    if (options.disableAutolinks) {
        // Why the odd double-casting below?
        // Because returning undefined is the recommended way to easily disable autolinks
        // but the type definition does not allow it.
        // More context here: https://github.com/markedjs/marked/issues/882
        tokenizer.url = () => undefined as unknown as marked.Tokens.Link
    }

    const rendered = marked(markdown, {
        gfm: true,
        breaks: options.breaks,
        highlight: (code, language) => highlightCodeSafe(code, language),
        renderer: options.renderer,
        headerPrefix: options.headerPrefix ?? '',
        tokenizer,
    })

    const dompurifyConfig: DOMPurifyConfig & { RETURN_DOM_FRAGMENT?: false; RETURN_DOM?: false } =
        typeof options.dompurifyConfig === 'object'
            ? options.dompurifyConfig
            : options.plainText
              ? {
                      ALLOWED_TAGS: [],
                      ALLOWED_ATTR: [],
                      KEEP_CONTENT: true,
                  }
              : {
                      USE_PROFILES: { html: true },
                      FORBID_TAGS: ['style', 'form', 'input', 'button'],
                      FORBID_ATTR: ['rel', 'style', 'method', 'action'],
                  }

    if (options.addTargetBlankToAllLinks) {
        // Add a hook that adds target="_blank" and rel="noopener" to all links. DOMPurify does not
        // support setting hooks per individual call to sanitize() so we have to
        // temporarily add the hook on the global module. This hook is removed
        // after the call to sanitize().
        DOMPurify.addHook('afterSanitizeAttributes', node => {
            if (node.tagName.toLowerCase() === 'a' && node.getAttribute('href')) {
                node.setAttribute('target', '_blank')
                node.setAttribute('rel', 'noopener')
            }
        })
    }

    // Wrap non-command links with the '_cody.vscode.open' command
    if (options.wrapLinksWithCodyCommand) {
        DOMPurify.addHook('afterSanitizeAttributes', node => {
            const link = node.getAttribute('href')
            if (node.tagName.toLowerCase() === 'a' && link && !link.startsWith('command:')) {
                const encodedLink = encodeURIComponent(JSON.stringify(link))
                node.setAttribute('href', `command:_cody.vscode.open?${encodedLink}`)
            }
        })
    }

    const result = options.noDomPurify ? rendered : DOMPurify.sanitize(rendered, dompurifyConfig).trim()

    if (options.addTargetBlankToAllLinks || options.wrapLinksWithCodyCommand) {
        // Because DOMPurify doesn't have a way to set hooks per individual call
        // to sanitize(), we have to clean up by removing the hook that we added
        // for addTargetBlankToAllLinks or wrapLinksWithCodyCommand.
        DOMPurify.removeHook('afterSanitizeAttributes')
    }

    return result
}
