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

/**
 * Safely evaluates a math expression string
 */
export const safeEvaluateMath = (
  expression: string,
  variables: Record<string, string> = {}
): number | null => {
  try {
    const sanitized = preprocessMathExpression(expression, variables);

    // Whitelist check: only allowed mathematical characters
    if (!/^[0-9+\-*/%().\s*Math,sqrtinaxbe]+$/.test(sanitized)) {
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

    // Safe compute via Function constructor with strict scope
    const compute = new Function(`'use strict'; return (${sanitized});`);
    const result = compute();

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
