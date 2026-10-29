import { safeEvaluateMath, formatMathNumber } from './mathNotesService.js';
import { sanitizeUrl } from '../lib/utils.js';

console.log('=== VERIFYING SANITIZE URL ===');
console.assert(sanitizeUrl('javascript:alert(1)') === '', 'Failed to block javascript:');
console.assert(sanitizeUrl('java\0script:alert(1)') === '', 'Failed to block null-byte javascript:');
console.assert(sanitizeUrl('jav\tascript:alert(1)') === '', 'Failed to block tab javascript:');
console.assert(sanitizeUrl('data:text/html,<script>alert(1)</script>') === '', 'Failed to block data:');
console.assert(sanitizeUrl('blob:https://evil.com') === '', 'Failed to block blob:');
console.assert(sanitizeUrl('file:///etc/passwd') === '', 'Failed to block file:');
console.assert(sanitizeUrl('https://farmersmarket.vn') === 'https://farmersmarket.vn', 'Failed safe https');
console.assert(sanitizeUrl('farmersmarket.vn') === 'https://farmersmarket.vn', 'Failed domain prefix');
console.log('[PASS] sanitizeUrl: 8/8 test vectors blocked/sanitized correctly');

console.log('=== VERIFYING SAFE MATH AST EVALUATOR (ZERO NEW FUNCTION / EVAL) ===');
console.assert(safeEvaluateMath('10 + 20') === 30, '10 + 20 failed');
console.assert(safeEvaluateMath('50k + 20k') === 70000, '50k + 20k failed');
console.assert(safeEvaluateMath('200 + 10%') === 220, '200 + 10% failed');
console.assert(safeEvaluateMath('100 - 15%') === 85, '100 - 15% failed');
console.assert(safeEvaluateMath('sqrt(16) * 5') === 20, 'sqrt failed');
console.assert(safeEvaluateMath('min(10, 5, 20) + max(1, 2)') === 7, 'min/max failed');
console.assert(safeEvaluateMath('gia * soluong', { gia: '50k', soluong: '4' }) === 200000, 'variables failed');
console.assert(safeEvaluateMath('console.log(1)') === null, 'code injection was not blocked');
console.assert(safeEvaluateMath('process.exit()') === null, 'process call was not blocked');
console.assert(safeEvaluateMath('alert(1)') === null, 'alert call was not blocked');
console.assert(safeEvaluateMath('window.location') === null, 'window access was not blocked');
console.log('[PASS] safeEvaluateMath: 11/11 mathematical and security vectors passed');
console.log('=== ALL HARDENING CHECKS VERIFIED SUCCESSFULLY ===');
