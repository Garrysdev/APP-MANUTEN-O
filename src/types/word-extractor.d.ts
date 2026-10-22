declare module 'word-extractor' {
  interface WordDocument {
    getBody(): string
    getHeaders(options?: { includeFooters?: boolean }): string
    getFooters(): string
  }
  export default class WordExtractor {
    extract(source: string | Buffer): Promise<WordDocument>
  }
}
