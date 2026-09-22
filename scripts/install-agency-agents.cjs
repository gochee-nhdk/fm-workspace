const fs = require('fs');
const path = require('path');

const SOURCE_DIR = 'C:/Users/LENOVO/.gemini/antigravity/brain/00998fc2-6b5e-4305-b70e-7ad85e075523/scratch/agency-agents-main';
const PROJECT_ROOT = 'D:/trợ lý thu mua';

const ANTIGRAVITY_SKILLS_DIR = path.join(PROJECT_ROOT, '.agents', 'skills');
const CURSOR_RULES_DIR = path.join(PROJECT_ROOT, '.cursor', 'rules');
const CLAUDE_AGENTS_DIR = path.join(PROJECT_ROOT, '.claude', 'agents');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '-');
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return null;
  }
  const yamlBlock = match[1];
  const body = match[2];

  let name = '';
  let description = '';

  const nameMatch = yamlBlock.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
  }

  const descMatch = yamlBlock.match(/^description:\s*(.+)$/m);
  if (descMatch) {
    description = descMatch[1].trim().replace(/^['"]|['"]$/g, '');
  }

  return { name, description, body };
}

function run() {
  console.log('Starting Agency Agents installation into FM Workspace...');

  ensureDir(ANTIGRAVITY_SKILLS_DIR);
  ensureDir(CURSOR_RULES_DIR);
  ensureDir(CLAUDE_AGENTS_DIR);

  const divisionsFile = path.join(SOURCE_DIR, 'divisions.json');
  const divisionsData = JSON.parse(fs.readFileSync(divisionsFile, 'utf8')).divisions;

  let installedCount = 0;
  const catalog = [];

  for (const [divKey, divMeta] of Object.entries(divisionsData)) {
    const divDir = path.join(SOURCE_DIR, divKey);
    if (!fs.existsSync(divDir)) continue;

    const files = fs.readdirSync(divDir).filter(f => f.endsWith('.md'));
    const divAgents = [];

    for (const file of files) {
      const filePath = path.join(divDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = parseFrontmatter(raw);
      if (!parsed || !parsed.name) continue;

      const slug = slugify(parsed.name);
      const agencySlug = `agency-${slug}`;

      // 1. Antigravity Skill
      const agySkillDir = path.join(ANTIGRAVITY_SKILLS_DIR, agencySlug);
      ensureDir(agySkillDir);
      const agyContent = `---
name: '${agencySlug}'
description: '${parsed.description.replace(/'/g, "''")}'
---

${parsed.body.trim()}
`;
      fs.writeFileSync(path.join(agySkillDir, 'SKILL.md'), agyContent, 'utf8');

      // 2. Cursor Rule (.mdc)
      const cursorContent = `---
description: "${parsed.description.replace(/"/g, '\\"')}"
globs: "*"
alwaysApply: false
---

${parsed.body.trim()}
`;
      fs.writeFileSync(path.join(CURSOR_RULES_DIR, `${slug}.mdc`), cursorContent, 'utf8');

      // 3. Claude Code Agent
      fs.writeFileSync(path.join(CLAUDE_AGENTS_DIR, `${slug}.md`), raw, 'utf8');

      divAgents.push({
        name: parsed.name,
        slug: agencySlug,
        description: parsed.description,
        file
      });

      installedCount++;
    }

    catalog.push({
      key: divKey,
      label: divMeta.label,
      icon: divMeta.icon,
      color: divMeta.color,
      agents: divAgents
    });
  }

  // Generate Catalog Markdown
  let catalogMd = `# 🎭 Danh Mục Agency Agents - AI Specialists (FM Workspace)

Hệ thống đã tích hợp trọn bộ **${installedCount} AI Agents chuyên sâu** từ [agency-agents](https://github.com/msitarzewski/agency-agents) vào dự án.

## 🚀 Cách Kích Hoạt Trong Dự Án

### 1. Trong Antigravity IDE
Bạn có thể yêu cầu kích hoạt bất kỳ Agent nào theo cú pháp:
- *"Hãy dùng agent \`agency-frontend-developer\` để rà soát component này"*
- *"Hãy kích hoạt \`agency-database-optimizer\` để tối ưu truy vấn IndexedDB/Fastify"*
- *"Hãy đóng vai \`agency-security-engineer\` để audit lại bảo mật"*

### 2. Trong Cursor
Các agent đã được tạo sẵn trong thư mục \`.cursor/rules/\` dưới dạng các quy tắc \`.mdc\`. Bạn có thể gõ \`@<agent-name>\` trong khung chat Cursor để triệu hồi chuyên gia đó.

### 3. Trong Claude Code
Các file agent nằm trong thư mục \`.claude/agents/\`. Bạn có thể triệu hồi:
\`claude --agent <agent-name>\` hoặc *"Hey Claude, activate <agent-name> mode"*.

---

## 📋 Danh Sách Phân Ban (Divisions) & Chuyên Gia

`;

  for (const cat of catalog) {
    catalogMd += `### 🔹 Phân Ban: ${cat.label} (${cat.agents.length} Agents)\n\n`;
    catalogMd += `| Tên Chuyên Gia | Mã Kích Hoạt Antigravity | Chuyên Môn / Vai Trò |\n`;
    catalogMd += `|---|---|---|\n`;
    for (const a of cat.agents) {
      catalogMd += `| **${a.name}** | \`${a.slug}\` | ${a.description} |\n`;
    }
    catalogMd += `\n`;
  }

  fs.writeFileSync(path.join(PROJECT_ROOT, 'AGENCY_AGENTS_CATALOG.md'), catalogMd, 'utf8');

  console.log(`Successfully installed ${installedCount} Agency Agents across 18 divisions!`);
  console.log(`Created catalog at: ${path.join(PROJECT_ROOT, 'AGENCY_AGENTS_CATALOG.md')}`);
}

run();
