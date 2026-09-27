import * as monaco from 'monaco-editor'

export const setupPromQLLanguage = (monacoInst: typeof monaco) => {
  monacoInst.languages.register({ id: 'promql' })

  // Syntax Highlighting
  monacoInst.languages.setMonarchTokensProvider('promql', {
    ignoreCase: false,
    defaultToken: 'invalid',

    keywords: [
      'by', 'without', 'on', 'ignoring', 'group_left', 'group_right',
      'bool', 'offset', 'at'
    ],

    operators: [
      'and', 'or', 'unless', '==', '!=', '>', '<', '>=', '<=', '=~', '!~',
      '+', '-', '*', '/', '%', '^'
    ],

    functions: [
      'abs', 'absent', 'absent_over_time', 'avg_over_time', 'ceil', 'changes',
      'clamp', 'clamp_max', 'clamp_min', 'count_over_time', 'days_in_month',
      'day_of_month', 'day_of_week', 'day_of_year', 'delta', 'deriv', 'drop_common_labels',
      'exp', 'floor', 'histogram_count', 'histogram_fraction', 'histogram_quantile',
      'histogram_sum', 'holt_winters', 'hour', 'idelta', 'increase', 'irate',
      'label_join', 'label_replace', 'ln', 'log10', 'log2', 'max_over_time',
      'min_over_time', 'minute', 'month', 'predict_linear', 'quantile_over_time',
      'rate', 'resets', 'round', 'scalar', 'sgn', 'sort', 'sort_desc',
      'sqrt', 'stddev_over_time', 'stdvar_over_time', 'sum_over_time', 'time',
      'timestamp', 'vector', 'year'
    ],

    aggregations: [
      'sum', 'min', 'max', 'avg', 'group', 'stddev', 'stdvar', 'count', 'count_values',
      'bottomk', 'topk', 'quantile'
    ],

    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        // identifiers and keywords
        [/[a-zA-Z_:][a-zA-Z0-9_:]*/, {
          cases: {
            '@keywords': 'keyword',
            '@functions': 'predefined',
            '@aggregations': 'predefined',
            '@default': 'identifier'
          }
        }],

        // whitespace
        { include: '@whitespace' },

        // strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
        [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        [/`/, 'string', '@string_backtick'],

        // durations
        [/[0-9]+(ms|s|m|h|d|w|y)/, 'number.float'],

        // numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],

        // delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }]
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/#.*$/, 'comment'],
      ],

      string_double: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop']
      ],

      string_single: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop']
      ],

      string_backtick: [
        [/[^\\`]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/`/, 'string', '@pop']
      ],
    }
  })

  // Theme
  monacoInst.editor.defineTheme('promql-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'predefined', foreground: '56B6C2' },
      { token: 'identifier', foreground: 'E5C07B' },
      { token: 'keyword', foreground: 'C678DD', fontStyle: 'bold' },
      { token: 'operator', foreground: 'C678DD' },
      { token: 'string', foreground: '98C379' },
      { token: 'number', foreground: 'D19A66' },
      { token: 'comment', foreground: '5C6370', fontStyle: 'italic' },
      { token: 'number.float', foreground: 'D19A66', fontStyle: 'bold' } // durations
    ],
    colors: {
      'editor.background': '#0f172a',
      'editor.lineHighlightBackground': '#1e293b',
    }
  })

  // Autocomplete
  monacoInst.languages.registerCompletionItemProvider('promql', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      const suggestions: monaco.languages.CompletionItem[] = []

      const funcs = ['rate', 'irate', 'increase', 'sum', 'avg', 'min', 'max', 'histogram_quantile']
      
      funcs.forEach(f => {
        suggestions.push({
          label: f,
          kind: monacoInst.languages.CompletionItemKind.Function,
          insertText: f + '($1)',
          insertTextRules: monacoInst.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range
        })
      })

      return { suggestions }
    }
  })
}
