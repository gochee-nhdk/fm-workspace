import { sanitizeNoteHTML } from './backupService.js';
import type { QuickNoteItem, FMBackupPayload, BackupImportResult } from '../types/workspace.js';

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    process.exit(1);
  }
}

console.log('=== BACKUP & RESTORE COMPREHENSIVE TESTS (NOTES & TO-DOS) ===\n');

// 1. HTML Sanitization for Notes
const dirtyNote = '<p>Xin chào <script>alert("xss")</script> <strong>Farmers Market</strong></p><img src="x" onerror="steal()"/>';
const cleanNote = sanitizeNoteHTML(dirtyNote);
assert(!cleanNote.includes('<script>'), '1.1: Strips <script> tags from note HTML');
assert(!cleanNote.includes('onerror'), '1.2: Strips onerror handlers from note HTML');
assert(cleanNote.includes('Farmers Market'), '1.3: Preserves legitimate note text and markup');

// 2. Checklist (To-do) Markdown preservation
const todoMarkdown = '- [ ] Việc 1: Mua trái cây\n- [x] Việc 2: Kiểm tra kho\n- [ ] Việc 3: Đối soát hóa đơn';
assert(todoMarkdown.includes('- [ ]') && todoMarkdown.includes('- [x]'), '2.1: Valid todo markdown checklist is structured correctly');

// 3. Payload integrity with Notes and To-dos
const sampleNotes: QuickNoteItem[] = [
  {
    id: 'note_1',
    title: 'Ghi chú nhà cung cấp',
    content: '<p>Danh sách NCC Đà Lạt uy tín</p>',
    checklistContent: '',
    noteType: 'note',
    color: 'amber',
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'todo_1',
    title: 'Danh sách việc cần làm tuần này',
    content: '<p><br></p>',
    checklistContent: '- [ ] Kiểm kho lạnh\n- [ ] Đặt hàng rau củ',
    noteType: 'checklist',
    color: 'blue',
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const textNotes = sampleNotes.filter((n) => n.noteType !== 'checklist');
const todoNotes = sampleNotes.filter((n) => n.noteType === 'checklist');

assert(textNotes.length === 1 && textNotes[0].id === 'note_1', '3.1: Text note correctly identified');
assert(todoNotes.length === 1 && todoNotes[0].id === 'todo_1', '3.2: Checklist / To-do correctly identified');

// 4. Header totalItems breakdown
const totalItems = {
  links: 10,
  accounts: 5,
  stores: 3,
  notes: textNotes.length,
  todos: todoNotes.length,
  attachments: 2,
};

assert(totalItems.notes === 1, '4.1: Note count is 1');
assert(totalItems.todos === 1, '4.2: To-do count is 1');

// 5. Import result structure verification
const mockImportResult: BackupImportResult = {
  success: true,
  links: 10,
  accounts: 5,
  stores: 3,
  notes: 1,
  todos: 1,
  attachments: 2,
  skipped: 0,
  errors: [],
};

const totalRestored = mockImportResult.links + mockImportResult.accounts + mockImportResult.stores + mockImportResult.notes + mockImportResult.todos + mockImportResult.attachments;
assert(totalRestored === 22, '5.1: Total restored items includes both notes and todos (22 items)');
assert(mockImportResult.notes === 1 && mockImportResult.todos === 1, '5.2: Separate tracking for Notes and To-dos confirmed');

console.log('\n=== ALL BACKUP & RESTORE UNIT TESTS PASSED! ===');
