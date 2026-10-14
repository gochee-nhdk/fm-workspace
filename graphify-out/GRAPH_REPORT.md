# Graph Report - trợ lý thu mua  (2026-10-14)

## Corpus Check
- 145 files · ~262,467 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 51 file(s) not represented in the graph (top: .otf 31, .bat 6, .example 3)

## Summary
- 921 nodes · 2096 edges · 51 communities (42 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Server Core & External Dependencies
- App Shell & Navigation Routing
- Shared Domain Types & Data Contracts
- Fastify Plugins & Database Drivers
- QuickNote & Todo Dual Engine
- Desktop Shortcut & Launcher Utilities
- Liquid Glass Modals & Excel Import
- Backup, Restore & Payload Security
- Frontend Data Service & Workspace CRUD
- File Upload Caching & CSV Parser
- Apple Design System UI Components
- Workspace Entity Drawer Forms
- Apple Design System UI Components
- Excel Workbook Styling & Export Engine
- Server Core & External Dependencies
- dependencies / axios Module
- package.json / date-fns Module
- QuickNote & Todo Dual Engine
- tsconfig.json / compilerOptions Module
- package.json / description Module
- App / queryClient Module
- components.json / aliases Module
- toDatetimeLocal / AppleDateTimePicker Module
- playAppleChime / reminderService Module
- tsconfig.json / compilerOptions Module
- Frontend Data Service & Workspace CRUD
- attachmentService / objectUrlCache Module
- ProtectedRoute / ProtectedRoute Module
- SegmentedNavigation / SegmentedNavigationItem Module
- noteService / generateId Module
- writingToolsService / callBackendWritingTool Module
- devDependencies / autoprefixer Module
- install-agency-agents.cjs / ANTIGRAVITY_SKILLS_DIR Module
- tsconfig.node.json / compilerOptions Module
- mathNotesService / extractLastMathExpression Module
- Procurement Logic & Calculations
- scripts / build Module
- Password Vault & Security Authentication
- AppleIcon / AppleIcon Module
- workspace-store / useWorkspaceStore Module
- vite.config / liquiTailwind3Compatibility Module
- vercel.json / buildCommand Module
- vite-env.d / ImportMeta Module
- install.sh / install.sh script Module
- start.sh / start.sh script Module
- stop.sh / stop.sh script Module

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 58 edges
2. `cn()` - 50 edges
3. `react` - 46 edges
4. `QuickNoteWindow()` - 38 edges
5. `verifyToken()` - 38 edges
6. `dataService` - 29 edges
7. `Button` - 27 edges
8. `sf-symbols-lib` - 26 edges
9. `build()` - 23 edges
10. `CloseButton` - 22 edges

## Surprising Connections (you probably didn't know these)
- `AccountDrawerFormProps` --references--> `AccountItem`  [EXTRACTED]
  client/src/components/forms/AccountDrawerForm.tsx → client/src/types/workspace.ts
- `LinkDrawerFormProps` --references--> `LinkItem`  [EXTRACTED]
  client/src/components/forms/LinkDrawerForm.tsx → client/src/types/workspace.ts
- `StoreDrawerFormProps` --references--> `StoreItem`  [EXTRACTED]
  client/src/components/forms/StoreDrawerForm.tsx → client/src/types/workspace.ts
- `MapPreviewModalProps` --references--> `StoreItem`  [EXTRACTED]
  client/src/components/ui/MapPreviewModal.tsx → client/src/types/workspace.ts
- `FileUpload()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/file-upload.tsx → client/src/lib/utils.ts

## Import Cycles
- 3-file cycle: `client/src/services/autoBackupManager.ts -> client/src/services/backupService.ts -> client/src/services/noteService.ts -> client/src/services/autoBackupManager.ts`

## Communities (51 total, 9 thin omitted)

### Community 0 - "Server Core & External Dependencies"
Cohesion: 0.07
Nodes (64): argon2, exceljs, fastify, @google/genai, jsonwebtoken, uuid, buildDataContext(), parseUserIntent() (+56 more)

### Community 1 - "App Shell & Navigation Routing"
Cohesion: 0.05
Nodes (39): App(), ThemeSync(), AppShell(), navItems, PAGE_TITLES, QuickNoteFloatingButton(), LocalLockScreen(), CommandPalette() (+31 more)

### Community 2 - "Shared Domain Types & Data Contracts"
Cohesion: 0.04
Nodes (53): AIConversation, AIMessage, AISuggestion, AlertSeverity, ApiResponse, AuditLog, AuthResponse, Brand (+45 more)

### Community 3 - "Fastify Plugins & Database Drivers"
Cohesion: 0.05
Nodes (40): better-sqlite3, dotenv, @fastify/cookie, @fastify/cors, @fastify/multipart, @fastify/rate-limit, @fastify/static, jspdf (+32 more)

### Community 4 - "QuickNote & Todo Dual Engine"
Cohesion: 0.06
Nodes (10): ChecklistRow, COLOR_MAP, DocxBlock, ExcelSheetPreview, getBytesFromUrl(), parseDocxFromDataUrl(), parseExcelFromDataUrl(), parsePptxFromDataUrl() (+2 more)

### Community 5 - "Desktop Shortcut & Launcher Utilities"
Cohesion: 0.10
Nodes (29): appDir, candidateDesktops, { execSync }, fs, icoPath, path, targetFolders, validDesktops (+21 more)

### Community 6 - "Liquid Glass Modals & Excel Import"
Cohesion: 0.13
Nodes (22): ExcelImportModal(), ExcelImportModalProps, AppleLiquidDialog(), AppleLiquidDialogProps, Badge(), BadgeProps, CloseButton, CloseButtonProps (+14 more)

### Community 7 - "Backup, Restore & Payload Security"
Cohesion: 0.11
Nodes (23): BackupValidationResult, base64ToBlob(), blobToBase64(), exportFullBackup(), generateBackupPayload(), importFullBackup(), restoreFromServer(), sanitizeNoteHTML() (+15 more)

### Community 8 - "Frontend Data Service & Workspace CRUD"
Cohesion: 0.21
Nodes (6): dataService, generateId(), idbBulkPut(), idbDelete(), idbPut(), LinkItem

### Community 9 - "File Upload Caching & CSV Parser"
Cohesion: 0.12
Nodes (13): papaparse, BoundedUploadCache, importsRoutes(), DataQualityService, QualityIssue, QualityReport, ColumnProfile, DataProfile (+5 more)

### Community 10 - "Apple Design System UI Components"
Cohesion: 0.13
Nodes (21): Alert(), AlertProps, Card(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardProps (+13 more)

### Community 11 - "Workspace Entity Drawer Forms"
Cohesion: 0.20
Nodes (19): AccountDrawerForm(), AccountDrawerFormProps, DEFAULT_CATEGORIES, LinkDrawerForm(), LinkDrawerFormProps, StoreDrawerForm(), StoreDrawerFormProps, Button (+11 more)

### Community 12 - "Apple Design System UI Components"
Cohesion: 0.14
Nodes (16): ButtonProps, DataTable(), DataTableProps, EmptyState(), EmptyStateProps, Props, State, FileUpload() (+8 more)

### Community 13 - "Excel Workbook Styling & Export Engine"
Cohesion: 0.18
Nodes (13): applyWorksheetStyles(), calculateAutoFitCols(), ColWidthRule, detectDatasetFromHeaders(), detectDatasetFromSheetName(), excelService, ExtractedSheetData, extractStructuredRows() (+5 more)

### Community 14 - "Server Core & External Dependencies"
Cohesion: 0.09
Nodes (23): dependencies, argon2, better-sqlite3, date-fns, dotenv, exceljs, fastify, @fastify/cookie (+15 more)

### Community 15 - "dependencies / axios Module"
Cohesion: 0.09
Nodes (22): dependencies, axios, class-variance-authority, clsx, date-fns, @hookform/resolvers, @liqui-design/glass, lucide-react (+14 more)

### Community 16 - "package.json / date-fns Module"
Cohesion: 0.10
Nodes (20): date-fns, typescript, zod, name, private, type, version, autoprefixer (+12 more)

### Community 17 - "QuickNote & Todo Dual Engine"
Cohesion: 0.12
Nodes (20): cleanChecklistText(), dataUrlToBlob(), ensureHtml(), extractPlainText(), formatNotePreview(), formatReminderBadge(), generateFileCardHtml(), generateInlineImageHtml() (+12 more)

### Community 18 - "tsconfig.json / compilerOptions Module"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+12 more)

### Community 19 - "package.json / description Module"
Cohesion: 0.10
Nodes (20): description, devDependencies, concurrently, name, private, scripts, build, build:all (+12 more)

### Community 20 - "App / queryClient Module"
Cohesion: 0.17
Nodes (8): queryClient, PageFallback(), RoutesConfig(), SettingsPage, UnifiedWorkspacePage, ErrorBoundary, NotFoundPage(), react-router-dom

### Community 21 - "components.json / aliases Module"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 22 - "toDatetimeLocal / AppleDateTimePicker Module"
Cohesion: 0.18
Nodes (11): toDatetimeLocal(), AppleDateTimePicker(), AppleDateTimePickerProps, formatVietnameseDateDisplay(), MONTH_NAMES, pad(), parseDatetimeLocal(), toDatetimeLocalString() (+3 more)

### Community 23 - "playAppleChime / reminderService Module"
Cohesion: 0.19
Nodes (3): playAppleChime(), reminderService, EmailProviderType

### Community 24 - "tsconfig.json / compilerOptions Module"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 25 - "Frontend Data Service & Workspace CRUD"
Cohesion: 0.27
Nodes (8): CommandPaletteProps, FilterCategory, initialAccounts, initialLinks, initialStores, AccountItem, StoreItem, WorkspaceSummary

### Community 26 - "attachmentService / objectUrlCache Module"
Cohesion: 0.26
Nodes (9): objectUrlCache, StoredAttachment, getDB(), idbClear(), idbClearAll(), idbGetAll(), idbGetById(), StoreName (+1 more)

### Community 27 - "ProtectedRoute / ProtectedRoute Module"
Cohesion: 0.24
Nodes (7): ProtectedRoute(), ProtectedRouteProps, api, AuthState, useAuthStore, User, axios

### Community 28 - "SegmentedNavigation / SegmentedNavigationItem Module"
Cohesion: 0.18
Nodes (4): SegmentedNavigationItem, SegmentedNavigationProps, clsx, tailwind-merge

### Community 29 - "noteService / generateId Module"
Cohesion: 0.33
Nodes (5): noteService, NoteStoreState, QuickNoteColor, QuickNoteItem, TaskReminder

### Community 30 - "writingToolsService / callBackendWritingTool Module"
Cohesion: 0.29
Nodes (10): callBackendWritingTool(), callGeminiApi(), discoverBestFlashModels(), freeTranslate(), getStoredGeminiKey(), localTransform(), runWritingTool(), setStoredGeminiKey() (+2 more)

### Community 31 - "devDependencies / autoprefixer Module"
Cohesion: 0.20
Nodes (10): devDependencies, autoprefixer, postcss, tailwindcss, @tailwindcss/forms, @types/react, @types/react-dom, typescript (+2 more)

### Community 32 - "install-agency-agents.cjs / ANTIGRAVITY_SKILLS_DIR Module"
Cohesion: 0.27
Nodes (9): ANTIGRAVITY_SKILLS_DIR, CLAUDE_AGENTS_DIR, CURSOR_RULES_DIR, ensureDir(), fs, parseFrontmatter(), path, run() (+1 more)

### Community 33 - "tsconfig.node.json / compilerOptions Module"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 34 - "mathNotesService / extractLastMathExpression Module"
Cohesion: 0.52
Nodes (6): extractLastMathExpression(), extractVariablesFromText(), formatMathNumber(), preprocessMathExpression(), safeEvaluateMath(), tryCalculateInlineMath()

### Community 35 - "Procurement Logic & Calculations"
Cohesion: 0.50
Nodes (5): Data Isolation and Database Layer, Excel Data Quality Pipeline, Frontend React 18 & Tailwind Architecture, Procurement Calculation Engine, System Architecture Overview

### Community 36 - "scripts / build Module"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 37 - "Password Vault & Security Authentication"
Cohesion: 0.40
Nodes (4): Rect, SnippingToolOverlay(), SnippingToolOverlayProps, react-dom

### Community 38 - "AppleIcon / AppleIcon Module"
Cohesion: 0.40
Nodes (3): AppleIconProps, AppleIconRenderMode, AppleNotesBadge()

### Community 39 - "workspace-store / useWorkspaceStore Module"
Cohesion: 0.40
Nodes (4): useWorkspaceStore, WorkspaceState, WorkspaceStore, zustand

### Community 40 - "vite.config / liquiTailwind3Compatibility Module"
Cohesion: 0.40
Nodes (4): liquiTailwind3Compatibility, postcss, vite, @vitejs/plugin-react

### Community 41 - "vercel.json / buildCommand Module"
Cohesion: 0.40
Nodes (4): buildCommand, installCommand, outputDirectory, rewrites

## Knowledge Gaps
- **28 isolated node(s):** `@hookform/resolvers`, `class-variance-authority`, `date-fns`, `react-hook-form`, `recharts` (+23 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 424 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Apple Design System UI Components` to `App Shell & Navigation Routing`, `QuickNote & Todo Dual Engine`, `Password Vault & Security Authentication`, `Liquid Glass Modals & Excel Import`, `AppleIcon / AppleIcon Module`, `useDebounce / useDebounce Module`, `Workspace Entity Drawer Forms`, `Apple Design System UI Components`, `package.json / date-fns Module`, `App / queryClient Module`, `toDatetimeLocal / AppleDateTimePicker Module`, `Frontend Data Service & Workspace CRUD`, `ProtectedRoute / ProtectedRoute Module`, `SegmentedNavigation / SegmentedNavigationItem Module`, `noteService / generateId Module`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `verifyToken()` (e.g. with `aiRoutes()` and `analyticsRoutes()`) actually correct?**
  _`verifyToken()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@hookform/resolvers`, `class-variance-authority`, `date-fns` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server Core & External Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07212131899135955 - nodes in this community are weakly interconnected._
- **Why does `@vitejs/plugin-react` connect `vite.config / liquiTailwind3Compatibility Module` to `package.json / date-fns Module`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `App Shell & Navigation Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.05370843989769821 - nodes in this community are weakly interconnected._
- **Why does `postcss` connect `vite.config / liquiTailwind3Compatibility Module` to `package.json / date-fns Module`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._