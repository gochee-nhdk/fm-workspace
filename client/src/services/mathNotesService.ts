/**
 * Math Notes Service - Safely and intelligently calculates inline mathematical expressions
 * Inspired by Apple Math Notes (iPadOS 18 / macOS Sequoia)
 * 
 * Features:
 * - Smart operators: +, -, *, /, x, X, ×, ·, :, ÷, ^, %
 * - Smart percentage: 200 + 10% = 220, 100 - 15% = 85, 500 * 10% = 50
 * - Vietnamese currency & suffixes: 50k = 50,000, 2.5tr = 2,500,000
 * - Strips currency/measurement words: đ, vnđ, $, kg, cái, món...
 * - Thousand separator normalization: 1.200.000 or 1,200,000
 * - Built-in functions: sum/tong, avg/tb, sqrt/can, min, max, abs, round
 * - Variable memory: e.g. gia = 50k; soluong = 4 -> gia * soluong = 200,000
 * - Continuous chaining: 11 + 2 = 13 + 5 = 18 * 2 = 36
 * - Safe from backspace loops: only triggers on explicit user '=' entry
 */

// Format numbers with commas (1,234,567.89)
export const formatMathNumber = (val: number): string => {
  if (isNaN(val) || !isFinite(val)) return '';
  if (Number.isInteger(val)) {
    return new Intl.NumberFormat('en-US').format(val);
  }
  const fixed = parseFloat(val.toFixed(4));
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(fixed);
};

/**
 * Extracts defined variables from text (e.g. "gia = 50k", "soluong = 3")
 */
export const extractVariablesFromText = (fullText: string): Record<string, string> => {
  const vars: Record<string, string> = {};
  if (!fullText) return vars;

  const lines = fullText.split(/[\r\n]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    // Match: varName = expression (single = not ending in another =)
    const match = trimmed.match(/^([a-zA-Z\u00C0-\u1EF9_][a-zA-Z0-9\u00C0-\u1EF9_]*)\s*=\s*([^=]+)$/);
    if (match) {
      const varName = match[1].trim();
      const expr = match[2].trim();
      if (expr && !/^[a-zA-Z\u00C0-\u1EF9]+$/.test(expr)) {
        vars[varName] = expr;
      }
    }
  }
  return vars;
};

/**
 * Preprocesses a mathematical expression string for safe evaluation
 */
export const preprocessMathExpression = (
  expr: string,
  variables: Record<string, string> = {}
): string => {
  let s = expr.trim();

  // 1. Strip prefix like "Tổng tiền: " or "Tiền hàng: " or bullets "- [ ] "
  s = s.replace(/^[a-zA-Z\u00C0-\u1EF9\s]+:\s*/i, '');
  s = s.replace(/^[-*•]\s*(?:\[[ xX]\]\s*)?/, '');

  // 2. Replace variables if present (longer names first to avoid partial collision)
  const varNames = Object.keys(variables).sort((a, b) => b.length - a.length);
  for (const v of varNames) {
    const regex = new RegExp(`\\b${v}\\b`, 'gi');
    s = s.replace(regex, `(${variables[v]})`);
  }

  // 3. Suffixes: k / K = 1,000
  s = s.replace(/([0-9.,]+)\s*[kK]\b/g, '($1 * 1000)');

  // 4. Suffixes: tr, củ, cu, m, M = 1,000,000
  s = s.replace(/([0-9.,]+)\s*(?:tr|củ|cu|[mM])\b/gi, '($1 * 1000000)');

  // 5. Strip currency and units: $, đ, vnđ, vnd, cái, kg, chiếc...
  s = s.replace(/[$₫]/g, '');
  s = s.replace(/\b(?:vnđ|vnd|đ)\b/gi, '');
  s = s.replace(/\b(?:cái|kg|chiếc|sp|món|hộp|gói|bịch)\b/gi, '');

  // 6. Thousand separators: 1.200.000 or 1,200,000
  s = s.replace(/(?<=\d)\.(?=\d{3}(?:\D|$))/g, '');
  s = s.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '');

  // 7. Decimal comma: 12,5 -> 12.5
  s = s.replace(/(?<=\d),(?=\d+)/g, '.');

  // 8. Math functions: sum/tong, avg/tb, sqrt/can, min, max, abs, round
  s = s.replace(/\b(?:sum|tong)\(([^)]+)\)/gi, (_, args) => {
    const parts = args.split(/[,;]/).map((p: string) => `(${p.trim()})`);
    return `(${parts.join(' + ')})`;
  });

  s = s.replace(/\b(?:avg|tb)\(([^)]+)\)/gi, (_, args) => {
    const parts = args.split(/[,;]/).map((p: string) => `(${p.trim()})`);
    return `((${parts.join(' + ')}) / ${parts.length})`;
  });

  s = s.replace(/\b(?:sqrt|can)\(([^)]+)\)/gi, 'Math.sqrt($1)');
  s = s.replace(/\bmin\(([^)]+)\)/gi, 'Math.min($1)');
  s = s.replace(/\bmax\(([^)]+)\)/gi, 'Math.max($1)');
  s = s.replace(/\babs\(([^)]+)\)/gi, 'Math.abs($1)');
  s = s.replace(/\bround\(([^)]+)\)/gi, 'Math.round($1)');

  // 9. Multiplication symbols: x, X, ×, ·
  s = s.replace(/×|·/g, '*');
  s = s.replace(/(?<=[0-9).])\s*[xX]\s*(?=[0-9(.])/g, ' * ');

  // 10. Implicit multiplication: 5(10 + 2) -> 5 * (10 + 2)
  s = s.replace(/(?<=[0-9)])\s*\(/g, ' * (');
  s = s.replace(/\)\s*(?=[0-9])/g, ') * ');

  // 11. Division: : or ÷
  s = s.replace(/÷/g, '/');
  s = s.replace(/(?<=[0-9).])\s*:\s*(?=[0-9(.])/g, ' / ');

  // 12. Power: ^
  s = s.replace(/\^/g, '**');

  // 13. Smart percentage:
  // A + B% -> A + (A * (B / 100))
  s = s.replace(/([0-9.]+)\s*\+\s*([0-9.]+)%/g, '($1 + ($1 * ($2 / 100)))');
  // A - B% -> A - (A * (B / 100))
  s = s.replace(/([0-9.]+)\s*-\s*([0-9.]+)%/g, '($1 - ($1 * ($2 / 100)))');
  // A * B% or standalone B% -> (B / 100)
  s = s.replace(/([0-9.]+)%/g, '($1 / 100)');

  return s;
};

// ──────────────────────────────────────────────
// ZERO-EVAL MATHEMATICAL RECURSIVE DESCENT EVALUATOR
// Fully satisfies CSP & Cloudflare security standards: eliminates new Function / eval sinks
// ──────────────────────────────────────────────

interface MathToken {
  type: 'NUMBER' | 'OP' | 'IDENT' | 'LPAREN' | 'RPAREN' | 'COMMA';
  value: string;
}

function tokenizeMathExpression(input: string): MathToken[] | null {
  const tokens: MathToken[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    const ch = s[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < s.length && /[0-9]/.test(s[i + 1]))) {
      let numStr = '';
      let hasDot = false;
      while (i < s.length && (/[0-9]/.test(s[i]) || (s[i] === '.' && !hasDot))) {
        if (s[i] === '.') hasDot = true;
        numStr += s[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    if (ch === '*' && s[i + 1] === '*') {
      tokens.push({ type: 'OP', value: '**' });
      i += 2;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^') {
      tokens.push({ type: 'OP', value: ch === '^' ? '**' : ch });
      i++;
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < s.length && /[a-zA-Z0-9_.]/.test(s[i])) {
        ident += s[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    return null;
  }

  return tokens;
}

class SafeMathAstParser {
  private tokens: MathToken[];
  private pos = 0;

  constructor(tokens: MathToken[]) {
    this.tokens = tokens;
  }

  private peek(): MathToken | undefined {
    return this.tokens[this.pos];
  }

  private consume(): MathToken {
    return this.tokens[this.pos++];
  }

  parse(): number {
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected extra tokens');
    }
    return result;
  }

  private parseExpression(): number {
    let left = this.parseTerm();
    while (this.peek() && this.peek()!.type === 'OP' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.consume().value;
      const right = this.parseTerm();
      if (op === '+') left = left + right;
      else left = left - right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseExponent();
    while (
      this.peek() &&
      this.peek()!.type === 'OP' &&
      (this.peek()!.value === '*' || this.peek()!.value === '/' || this.peek()!.value === '%')
    ) {
      const op = this.consume().value;
      const right = this.parseExponent();
      if (op === '*') left = left * right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        left = left / right;
      } else if (op === '%') {
        left = left % right;
      }
    }
    return left;
  }

  private parseExponent(): number {
    let left = this.parseUnary();
    if (this.peek() && this.peek()!.type === 'OP' && this.peek()!.value === '**') {
      this.consume();
      const right = this.parseExponent();
      return Math.pow(left, right);
    }
    return left;
  }

  private parseUnary(): number {
    if (this.peek() && this.peek()!.type === 'OP' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.consume().value;
      const factor = this.parseUnary();
      return op === '-' ? -factor : factor;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === 'NUMBER') {
      this.consume();
      const val = parseFloat(tok.value);
      if (isNaN(val)) throw new Error('Invalid number');
      return val;
    }

    if (tok.type === 'LPAREN') {
      this.consume();
      const expr = this.parseExpression();
      if (!this.peek() || this.peek()!.type !== 'RPAREN') {
        throw new Error('Missing closing parenthesis');
      }
      this.consume();
      return expr;
    }

    if (tok.type === 'IDENT') {
      const fnName = this.consume().value.replace(/^Math\./i, '').toLowerCase();
      if (!this.peek() || this.peek()!.type !== 'LPAREN') {
        throw new Error(`Expected ( after function name ${fnName}`);
      }
      this.consume();
      const args: number[] = [];
      if (this.peek() && this.peek()!.type !== 'RPAREN') {
        args.push(this.parseExpression());
        while (this.peek() && this.peek()!.type === 'COMMA') {
          this.consume();
          args.push(this.parseExpression());
        }
      }
      if (!this.peek() || this.peek()!.type !== 'RPAREN') {
        throw new Error(`Missing ) for function ${fnName}`);
      }
      this.consume();

      switch (fnName) {
        case 'sqrt':
        case 'can':
          if (args.length !== 1) throw new Error('sqrt takes 1 argument');
          return Math.sqrt(args[0]);
        case 'min':
          if (args.length === 0) throw new Error('min takes at least 1 argument');
          return Math.min(...args);
        case 'max':
          if (args.length === 0) throw new Error('max takes at least 1 argument');
          return Math.max(...args);
        case 'abs':
          if (args.length !== 1) throw new Error('abs takes 1 argument');
          return Math.abs(args[0]);
        case 'round':
          if (args.length !== 1) throw new Error('round takes 1 argument');
          return Math.round(args[0]);
        default:
          throw new Error(`Unknown function: ${fnName}`);
      }
    }

    throw new Error(`Unexpected token: ${tok.value}`);
  }
}

/**
 * Safely evaluates a math expression string using zero-eval deterministic parsing
 */
export const safeEvaluateMath = (
  expression: string,
  variables: Record<string, string> = {}
): number | null => {
  try {
    const sanitized = preprocessMathExpression(expression, variables);

    // Whitelist check: only allowed mathematical symbols and letters
    if (!/^[0-9+\-*/%().,\s*a-zA-Z_]+$/.test(sanitized)) {
      return null;
    }

    // Validate parentheses balance
    let openCount = 0;
    for (const char of sanitized) {
      if (char === '(') openCount++;
      if (char === ')') openCount--;
      if (openCount < 0) return null;
    }
    if (openCount !== 0) return null;

    // Must contain at least one operator or function call
    if (!/[+\-*/%*]|Math\./.test(sanitized)) {
      return null;
    }

    const tokens = tokenizeMathExpression(sanitized);
    if (!tokens || tokens.length === 0) return null;

    const parser = new SafeMathAstParser(tokens);
    const result = parser.parse();

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result;
    }
    return null;
  } catch (_) {
    return null;
  }
};

/**
 * Extracts the relevant math expression right before the newly typed '='
 */
export const extractLastMathExpression = (
  textBeforeCursor: string
): { expression: string; trimmedBefore: string } | null => {
  if (!/=\s*$/.test(textBeforeCursor)) return null;

  // Trim trailing '=' and whitespace
  const withoutEqual = textBeforeCursor.replace(/=\s*$/, '');
  const trimmedBefore = textBeforeCursor.replace(/=\s*$/, '= ');

  // Get current line before cursor
  const lines = withoutEqual.split(/[\r\n]/);
  const lastLine = lines.pop() || '';

  let expr = '';

  // Chaining: If the current line has a previous '=' (e.g. "11+2= 13 + 5")
  if (lastLine.includes('=')) {
    const afterLastEqual = lastLine.split('=').pop() || '';
    expr = afterLastEqual.trim();
  } else {
    expr = lastLine.trim();

    // If expr starts with an operator like "+ 5", inherit from previous line's number
    if (/^[+\-*/:xX÷]/.test(expr)) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const prev = lines[i].trim();
        if (prev) {
          const numMatch = prev.match(/([0-9.,]+)(?:\s*(?:k|K|tr|m|M|củ|cu|đ|\$))?\s*$/);
          if (numMatch) {
            expr = numMatch[0] + ' ' + expr;
            break;
          }
        }
      }
    }
  }

  // Strip label prefix like "Tổng: "
  expr = expr.replace(/^[a-zA-Z\u00C0-\u1EF9\s]+:\s*/i, '');
  expr = expr.replace(/^[-*•]\s*(?:\[[ xX]\]\s*)?/, '');

  if (!expr.trim()) return null;

  return { expression: expr.trim(), trimmedBefore };
};

/**
 * Checks if the last typed text ends with a math expression followed by '='
 * If so, returns the calculated result and the range to replace or append
 */
export const tryCalculateInlineMath = (
  text: string,
  cursorPos: number
): { matchedExpr: string; resultStr: string; newText: string; newCursorPos: number } | null => {
  const textBeforeCursor = text.slice(0, cursorPos);
  const textAfterCursor = text.slice(cursorPos);

  const extracted = extractLastMathExpression(textBeforeCursor);
  if (!extracted) return null;

  const { expression: rawExpression, trimmedBefore } = extracted;

  // Extract any variable assignments defined in the document
  const variables = extractVariablesFromText(text);

  const calculated = safeEvaluateMath(rawExpression, variables);
  if (calculated === null) return null;

  const resultStr = formatMathNumber(calculated);
  if (!resultStr) return null;

  // Insert result right after "=" with a space
  const newText =
    trimmedBefore + resultStr + (textAfterCursor.startsWith(' ') ? '' : ' ') + textAfterCursor;
  const newCursorPos = trimmedBefore.length + resultStr.length + 1;

  return {
    matchedExpr: rawExpression,
    resultStr,
    newText,
    newCursorPos,
  };
};
