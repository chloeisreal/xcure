# XCure Valuation Engine - 架构文档

## 系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js API Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  /api/valuation      → 主估值入口                                │
│  /api/quote          → 实时行情查询                             │
│  /api/companies      → 公司列表                                 │
│  /api/sync           → 数据同步                                 │
│  /api/collect        → 新公司收集                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      估值引擎 (Valuation Engine)                 │
├────────────────────┬────────────────────┬─────────────────────┤
│   DCF 模块          │   Comps 模块        │   rNPV 模块          │
│  现金流折现         │  可比公司分析        │  风险调整净现值      │
└────────────────────┴────────────────────┴─────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      数据层 (Data Layer)                         │
├─────────────┬─────────────┬──────────────┬────────────────────┤
│ 实时价格    │  财务数据    │  临床管线     │  IPO 递表数据       │
│ stockprices │  yfinance2  │  Clinical    │  SEC/HKEX          │
│ (首选)      │  (备选)     │  Trials.gov  │  (招股书元数据)     │
└─────────────┴─────────────┴──────────────┴────────────────────┘
```

## 数据流架构

```
用户请求
    ↓
API Route Handler
    ↓
┌─────────────────────────────────────────────────────────────┐
│  1. 数据获取层                                               │
│     ├── 实时价格: stockprices.dev → yfinance2 → FMP        │
│     ├── 财务数据: yfinance2 → FMP                          │
│     ├── 临床管线: ClinicalTrials.gov (缓存)                │
│     └── IPO数据: 本地JSON / SEC EDGAR API                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  2. 估值计算层                                               │
│     ├── DCF: 现金流折现估值                                   │
│     ├── Comps: 可比公司分析                                   │
│     ├── rNPV: 风险调整净现值                                  │
│     └── AI: Gemini/Claude 综合分析                           │
└─────────────────────────────────────────────────────────────┘
    ↓
返回 JSON 格式估值结果
```

## 模块设计

### 1. 数据获取模块 (`src/lib/data/`)

#### 1.1 股票数据 (`stocks.ts`)
- `getQuote(symbol)`: 获取实时股价
- `getFinancials(symbol)`: 获取财务数据
- `getCompanyInfo(symbol)`: 获取公司信息

#### 1.2 IPO 递表数据 (`ipo.ts`)
- `getHKEXFilings()`: 获取港股递表公司
- `getSECFilings()`: 获取美股 S-1/F-1 递表
- `getProspectusData(companyId)`: 获取招股书元数据

#### 1.3 Pre-IPO 数据 (`preipo.ts`)
- `getPreIPOCompanies()`: 获取 Pre-IPO 公司列表
- `getCompanyDetails(id)`: 获取公司详情

#### 1.4 代币化 Biotech (`tokenized.ts`)
- `getTokenizedBiotech()`: 获取代币化生物医药公司
- `getTokenPrice(symbol)`: 获取代币价格

#### 1.5 临床管线 (`sync.ts`)
- `syncClinicalTrials()`: 从 ClinicalTrials.gov 同步
- `getCompanyTrials(companyName)`: 获取公司临床试验

### 2. 估值引擎模块 (`src/lib/valuation/`)

#### 2.1 DCF 估值 (`dcf.ts`)
```typescript
interface DCFInput {
  revenue: number;        // 当前收入
  growthRate: number;      // 增长率
  wacc: number;           // 加权平均资本成本
  terminalGrowth: number;  // 永续增长率
  years: number;           // 预测年数
}
```

#### 2.2 可比公司分析 (`comps.ts`)
- `findComparables(targetCompany)`: 查找可比公司
- `calculateTargetPrice()`: 计算目标价

#### 2.3 rNPV 估值 (`rnpv.ts`)
- `calculateTrialNPV(clinicalTrial)`: 计算单个试验 NPV
- `calculatePortfolioNPV()`: 计算管线组合 NPV

#### 2.4 AI 综合分析 (`ai.ts`)
- `generateAIValuation()`: AI 综合估值分析

### 3. API 端点 (`src/app/api/`)

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/valuation` | POST | 主估值入口 |
| `/api/quote` | GET | 实时行情 |
| `/api/companies` | GET | 公司列表 |
| `/api/sync-trials` | POST | 手动同步临床试验 |
| `/api/collect` | POST | 收集新公司 |

## 数据存储

### 本地 JSON 文件

```
data/
├── listed-stocks.json       # 已上市生物医药股
├── ipo-filings.json         # IPO 递表公司
├── preipo-companies.json    # Pre-IPO 公司
├── tokenized-biotech.json   # 代币化 Biotech
├── clinical-trials.json     # 临床管线缓存
└── valuation-cache.json     # 估值结果缓存
```

### 数据更新策略

| 数据类型 | 更新频率 | 来源 |
|----------|----------|------|
| 实时股价 | 实时 | stockprices.dev |
| 财务数据 | 每日 | yfinance2 |
| IPO 递表 | 每周 | 手动 + SEC API |
| 临床管线 | 每周 | ClinicalTrials.gov |
| Pre-IPO | 手动 | 手动维护 |

## 容错机制

### 数据源优先级

```
实时股价:
1. stockprices.dev (首选，无限制)
2. yahoo-finance2 (备选，无限制)
3. FMP API (保底，需 key)

财务数据:
1. yahoo-finance2 (首选，无限制)
2. FMP API (备选，需 key)

IPO 数据:
1. 本地 JSON (港股递表)
2. SEC EDGAR API (美股递表)
```

### 错误处理

- 数据源超时: 5秒后切换备选源
- 所有源失败: 返回缓存数据 + 警告
- 无缓存: 返回模拟数据 + 提示

## 扩展性设计

### 添加新数据源

1. 在 `src/lib/data/` 创建新的数据模块
2. 实现标准接口 `getQuote()`, `getFinancials()` 等
3. 在主数据模块添加源优先级

### 添加新估值方法

1. 在 `src/lib/valuation/` 创建新模块
2. 实现 `calculate(input): ValuationResult` 接口
3. 在 `/api/valuation` 中添加方法支持

## 安全考虑

- API Key 存储在环境变量，不提交到版本控制
- SEC API 需要设置合理的 User-Agent
- 避免高频请求触发限流
- 敏感数据不记录日志
