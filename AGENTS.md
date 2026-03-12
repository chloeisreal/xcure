# XCure 前端开发规划

本文档记录 XCure 前端的所有待开发功能和技术改进计划。

---

## 一、待开发功能

### 1.1 Valuation 页面改进

#### P0 - 紧急/高优先级

| 任务 | 描述 | 状态 |
|------|------|------|
| 修复按钮文字 | Valuation 模式下按钮应显示 "Valuing..." 而非 "Analyzing..." | ⬜ |
| 未找到公司友好提示 | 创建 NotFoundState 组件，显示友好错误信息和重试建议 | ⬜ |

#### P1 - 中优先级

| 任务 | 描述 | 状态 |
|------|------|------|
| 估值方法独立状态 | 每个估值卡片独立显示 loading/error/success 状态 | ⬜ |
| Skeleton 加载 | 每个估值方法显示骨架屏加载效果 | ⬜ |

### 1.2 Analyze 页面改进

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 空区块骨架屏 | 首次加载时显示 4 个空白区块骨架 | P1 |
| 缺失章节提示 | 如果某章节无数据，显示"该信息暂未提供" | P2 |

### 1.3 中文搜索支持

| 任务 | 描述 | 优先级 |
|------|------|--------|
| 后端公司名搜索 | 支持中文公司名 → 股票代码映射 | P0 |
| 搜索 API 端点 | 新增 /api/companies/search 端点 | P0 |
| 前端集成 | SearchForm 支持中文输入并解析 | P0 |

### 1.4 AI 缓存优化

| 任务 | 描述 | 优先级 |
|------|------|--------|
| Analyze API 缓存 | 使用 MemoryCache，TTL=24小时 | P0 |
| Valuation AI 缓存 | 使用 MemoryCache，TTL=4小时 | P1 |
| 前端缓存标签 | 显示 "Cached result" 提示 | P2 |

### 1.5 港股 IPO 招股书 PDF 解析

| 任务 | 描述 | 优先级 |
|------|------|--------|
| PDF 下载模块 | 从港交所下载招股书英文版 PDF | P0 |
| PDF 文本提取 | 使用 pdf-parse 提取文本 | P1 |
| AI 结构化提取 | 使用 AI 提取 pipeline/financials | P1 |
| rNPV 整合 | 将提取数据用于估值计算 | P2 |

---

## 二、技术方案

### 2.1 AI 缓存实现

**缓存键设计**:
```
analyze:{normalized_query}  →  分析结果
ai-valuation:{symbol}       →  AI 估值结果
```

**TTL 设置**:
- Analyze: 24 小时（项目基本面变化慢）
- Valuation AI: 4 小时（股价数据会变化）

**实现位置**:
- `src/app/api/analyze/route.ts`
- `src/lib/valuation/ai.ts`

### 2.2 中文搜索实现

**数据源**:
| 类型 | 搜索字段 |
|------|----------|
| IPO 公司 | name, nameEn |
| Pre-IPO 公司 | name, nameEn |
| Token | name, nameEn, symbol |

**实现位置**:
- `src/lib/data/local.ts` - 新增 `findCompanyByName()`
- `src/app/api/companies/search/route.ts` - 新建
- `src/lib/valuation-client.ts` - 新增 `resolveCompanyName()`

### 2.3 招股书 PDF 解析

**技术栈**:
- PDF 下载: 港交所英文版招股书
- PDF 解析: `pdf-parse` + AI 提取
- 数据存储: 本地文件系统 + MemoryCache

**实现位置**:
- `src/lib/data/prospectus.ts` - 下载模块
- `src/lib/prospectus/parser.ts` - 文本提取
- `src/lib/prospectus/extractor.ts` - AI 提取

---

## 三、文件改动清单

### 3.1 UI 改进

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `src/components/SearchForm.tsx` | 修改 | 按钮文字根据模式变化 |
| `src/components/ValuationReport.tsx` | 修改 | 独立状态、Skeleton |
| `src/components/AnalysisReport.tsx` | 修改 | 骨架屏 |
| `src/components/page.tsx` | 修改 | 错误处理、NotFoundState |

### 3.2 后端 API

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `src/app/api/analyze/route.ts` | 修改 | 添加 AI 缓存 |
| `src/app/api/valuation/route.ts` | 修改 | 支持中文搜索、PDF数据 |
| `src/app/api/companies/search/route.ts` | 新建 | 公司搜索 API |
| `src/app/api/prospectus/route.ts` | 新建 | 招股书 API |

### 3.3 核心库

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `src/lib/valuation/ai.ts` | 修改 | 添加 AI 缓存 |
| `src/lib/valuation-client.ts` | 修改 | 添加公司名解析 |
| `src/lib/data/local.ts` | 修改 | 添加公司搜索 |
| `src/lib/data/types.ts` | 修改 | 扩展类型定义 |
| `src/lib/data/cache.ts` | 修改 | 可能需要扩展 |

### 3.4 新增模块

| 文件 | 描述 |
|------|------|
| `src/lib/data/prospectus.ts` | 招股书下载 |
| `src/lib/prospectus/parser.ts` | PDF 解析 |
| `src/lib/prospectus/extractor.ts` | AI 数据提取 |

---

## 四、实施顺序

### 第一阶段：紧急修复

1. [ ] 修复 Valuation 按钮文字
2. [ ] 未找到公司友好提示
3. [ ] 中文搜索后端支持

### 第二阶段：用户体验优化

4. [ ] 估值方法独立状态
5. [ ] Analyze 骨架屏
6. [ ] 中文搜索前端集成

### 第三阶段：性能优化

7. [ ] Analyze API 缓存
8. [ ] Valuation AI 缓存
9. [ ] 前端缓存提示

### 第四阶段：功能扩展

10. [ ] 招股书 PDF 下载
11. [ ] PDF 文本提取
12. [ ] AI 结构化提取
13. [ ] rNPV 估值整合

---

## 五、依赖更新

```bash
# PDF 解析
npm install pdf-parse

# 可选：OCR（如果招股书是扫描件）
npm install tesseract.js
```

---

## 六、备注

- 所有 AI 调用使用现有的 MiniMax/Gemini API
- 缓存使用项目现有的 MemoryCache
- 港股招股书使用英文版，无需处理中文编码
- 中文搜索优先匹配本地数据，再考虑外部 API
