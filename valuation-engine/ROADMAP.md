# XCure Valuation Engine - 开发路线图

## 版本规划

### v1.0.0 - MVP (Minimum Viable Product)

**目标**: 实现基本的估值功能，支持已上市股票

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 1.1 | 项目初始化 | ✅ 完成 |
| Phase 1.2 | 类型定义 | ✅ 完成 |
| Phase 1.3 | 数据获取模块 (股票) | ✅ 完成 |
| Phase 1.4 | DCF 估值模块 | ✅ 完成 |
| Phase 1.5 | API 端点 | ✅ 完成 |
| Phase 1.6 | 前端集成 | ⏳ 待开始 |

**预计完成时间**: 2 周

---

### v1.1.0 - 多估值方法支持

**目标**: 添加可比公司分析和 rNPV 估值

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 2.1 | Comps 可比公司分析 | ✅ 完成 |
| Phase 2.2 | rNPV 风险调整净现值 | ✅ 完成 |
| Phase 2.3 | AI 综合分析集成 | ✅ 完成 |
| Phase 2.4 | 估值结果缓存 | ✅ 完成 |

**预计完成时间**: 1 周

---

### v1.2.0 - IPO 数据支持

**目标**: 添加港股和美股 IPO 递表公司支持

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 3.1 | 港股递表 JSON 数据 | ✅ 完成 |
| Phase 3.2 | SEC EDGAR API 集成 | ✅ 完成 |
| Phase 3.3 | 招股书元数据解析 | ✅ 完成 |
| Phase 3.4 | IPO 估值计算 | ✅ 完成 |

**预计完成时间**: 2 周

---

### v1.3.0 - Pre-IPO 支持

**目标**: 添加 Pre-IPO 公司和代币化 Biotech 支持

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 4.1 | Pre-IPO 公司数据 | ✅ 完成 |
| Phase 4.2 | 代币化 Biotech 数据 | ✅ 完成 |
| Phase 4.3 | 代币价格获取 | ✅ 完成 |
| Phase 4.4 | Pre-IPO 估值方法 | ✅ 完成 |

**预计完成时间**: 1 周

---

### v1.4.0 - 自动化数据同步

**目标**: 实现自动化数据更新

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 5.1 | ClinicalTrials.gov 同步 | ✅ 完成 |
| Phase 5.2 | 定时任务设置 | ✅ 完成 |
| Phase 5.3 | 新公司自动收集 | ✅ 完成 |
| Phase 5.4 | 数据质量检查 | ✅ 完成 |

**预计完成时间**: 1 周

---

## 详细任务清单

### Phase 1: 基础架构 (已完成文档)

- [x] 创建项目目录结构
- [x] 编写 README.md
- [x] 编写 ARCHITECTURE.md
- [x] 编写 API.md
- [x] 编写 DATA_SOURCES.md
- [x] 编写 DEVELOPMENT.md
- [x] 编写 ROADMAP.md

### Phase 1.3: 数据获取模块

- [ ] 创建 `src/lib/data/types.ts`
  - [ ] 定义 `Company` 类型
  - [ ] 定义 `Quote` 类型
  - [ ] 定义 `ValuationResult` 类型
  
- [ ] 创建 `src/lib/data/stocks.ts`
  - [ ] 实现 `getQuote()` 三源备份
  - [ ] 实现 `getFinancials()`
  - [ ] 实现 `getCompanyInfo()`
  
- [ ] 创建 `src/lib/data/cache.ts`
  - [ ] 实现内存缓存
  - [ ] 实现 JSON 文件持久化

### Phase 1.4: DCF 估值

- [ ] 创建 `src/lib/valuation/dcf.ts`
  - [ ] 实现现金流预测
  - [ ] 计算终值
  - [ ] 计算现值
  - [ ] 参数敏感性分析

### Phase 1.5: API 端点

- [ ] 创建 `/api/valuation/route.ts`
  - [ ] POST 处理函数
  - [ ] 错误处理
  - [ ] 参数验证
  
- [ ] 创建 `/api/quote/route.ts`
  - [ ] GET 处理函数
  
- [ ] 创建 `/api/companies/route.ts`
  - [ ] 公司列表查询

### Phase 1.6: 前端集成

- [ ] 修改 `src/app/page.tsx` 集成估值 API
- [ ] 更新 `AnalysisReport` 组件显示 JSON 格式
- [ ] 添加错误处理 UI

### Phase 2: 高级估值

- [ ] 创建 `src/lib/valuation/comps.ts`
  - [ ] 查找可比公司
  - [ ] 计算估值倍数
  - [ ] 确定目标价

- [ ] 创建 `src/lib/valuation/rnpv.ts`
  - [ ] 定义临床试验成功率
  - [ ] 计算单个试验 NPV
  - [ ] 计算管线组合 NPV

- [ ] 创建 `src/lib/valuation/ai.ts`
  - [ ] 集成 Gemini API
  - [ ] 生成综合分析报告

### Phase 3: IPO 数据

- [ ] 创建 `data/ipo-filings.json`
  - [ ] 添加港股递表公司 (5家)
  - [ ] 添加美股递表模板

- [ ] 创建 `src/lib/data/ipo.ts`
  - [ ] 加载港股递表数据
  - [ ] SEC EDGAR API 集成
  - [ ] 招股书元数据提取

- [ ] 扩展 `/api/valuation` 支持 IPO 类型

### Phase 4: Pre-IPO & 代币

- [ ] 创建 `data/preipo-companies.json`
  - [ ] 添加 5 家 Pre-IPO 公司

- [ ] 创建 `data/tokenized-biotech.json`
  - [ ] 添加 VitaDAO, BIO Protocol 等

- [ ] 创建 `src/lib/data/preipo.ts`
- [ ] 创建 `src/lib/data/tokenized.ts`

### Phase 5: 自动化

- [ ] 创建 `src/lib/data/sync.ts`
  - [ ] ClinicalTrials.gov API 集成
  - [ ] 数据解析和存储

- [ ] 创建 `/api/sync-trials/route.ts`
  - [ ] 手动触发同步

- [ ] 创建 `/api/collect/route.ts`
  - [ ] 新公司自动收集

---

## 里程碑

| 里程碑 | 版本 | 目标日期 | 验收标准 |
|--------|------|----------|----------|
| MVP | v1.0.0 | Week 2 | 可对已上市股票进行 DCF 估值 |
| 多估值 | v1.1.0 | Week 3 | 支持 DCF/Comps/rNPV/AI 四种估值 |
| IPO 支持 | v1.2.0 | Week 5 | 支持港股递表公司估值 |
| Pre-IPO | v1.3.0 | Week 6 | 支持 Pre-IPO 和代币化 Biotech |
| 自动化 | v1.4.0 | Week 7 | 自动同步临床试验数据 |

---

## 优先级矩阵

| 功能 | 优先级 | 工作量 | 风险 |
|------|--------|--------|------|
| DCF 估值 | P0 | 中 | 低 |
| 数据获取 | P0 | 大 | 中 |
| API 端点 | P0 | 小 | 低 |
| Comps 估值 | P1 | 中 | 低 |
| rNPV 估值 | P1 | 中 | 中 |
| AI 分析 | P1 | 小 | 中 |
| IPO 数据 | P2 | 中 | 中 |
| Pre-IPO 数据 | P2 | 小 | 低 |
| 自动同步 | P3 | 大 | 高 |

---

## 依赖关系

```
Phase 1.3 (数据获取)
    ↓
Phase 1.4 (DCF 估值) ← Phase 1.3
    ↓
Phase 1.5 (API 端点) ← Phase 1.4
    ↓
Phase 1.6 (前端集成) ← Phase 1.5
    ↓
Phase 2 (高级估值) ← Phase 1.6
    ↓
Phase 3 (IPO) ← Phase 1.6
    ↓
Phase 4 (Pre-IPO) ← Phase 1.6
    ↓
Phase 5 (自动化) ← Phase 2,3,4
```

---

## 资源需求

### 开发环境
- Node.js 18+
- npm 或 yarn
- VS Code (推荐)

### API 访问
- Google Gemini API (必需)
- Financial Modeling Prep (可选)
- SEC EDGAR (免费)
- ClinicalTrials.gov (免费)

### 知识储备
- Next.js App Router
- TypeScript
- 金融估值方法 (DCF, Comps, rNPV)
- RESTful API 设计
