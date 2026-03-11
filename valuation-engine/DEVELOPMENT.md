# XCure Valuation Engine - 开发指南

## 环境设置

### 1. 克隆项目

```bash
cd xcure-main
cd valuation-engine
```

### 2. 安装依赖

```bash
npm install
```

### 3. 环境变量配置

```bash
# 复制示例配置
cp .env.local.example .env.local

# 编辑环境变量
vim .env.local
```

必需的环境变量：

```bash
# Google Gemini API (必需)
# 获取地址: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your-gemini-api-key

# Financial Modeling Prep API (可选，免费注册)
# 获取地址: https://site.financialmodelingprep.com/
FMP_API_KEY=your-fmp-api-key
```

### 4. 启动开发服务器

```bash
# 在项目根目录
cd ..
npm run dev

# 测试估值 API
curl -X POST http://localhost:3000/api/valuation \
  -H "Content-Type: application/json" \
  -d '{"symbol": "MRNA", "type": "listed"}'
```

## 项目结构

```
valuation-engine/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── valuation/
│   │       │   └── route.ts      # 估值主入口
│   │       ├── quote/
│   │       │   └── route.ts      # 实时行情
│   │       ├── companies/
│   │       │   └── route.ts      # 公司列表
│   │       ├── sync-trials/
│   │       │   └── route.ts      # 临床试验同步
│   │       └── collect/
│   │           └── route.ts      # 新公司收集
│   │
│   └── lib/
│       ├── data/
│       │   ├── types.ts          # 类型定义
│       │   ├── stocks.ts         # 上市股票数据
│       │   ├── ipo.ts            # IPO 递表数据
│       │   ├── preipo.ts         # Pre-IPO 数据
│       │   ├── tokenized.ts     # 代币化 Biotech
│       │   ├── sync.ts           # ClinicalTrials 同步
│       │   └── cache.ts          # 缓存管理
│       │
│       └── valuation/
│           ├── types.ts          # 估值类型
│           ├── dcf.ts            # DCF 估值
│           ├── comps.ts          # 可比公司分析
│           ├── rnpv.ts           # rNPV 估值
│           └── ai.ts             # AI 综合分析
│
├── data/                          # 本地数据存储
│   ├── listed-stocks.json         # 已上市公司
│   ├── ipo-filings.json          # IPO 递表公司
│   ├── preipo-companies.json      # Pre-IPO 公司
│   ├── tokenized-biotech.json    # 代币化公司
│   └── clinical-trials.json      # 临床管线缓存
│
├── tests/                         # 测试文件
│   └── valuation.test.ts
│
├── package.json
├── tsconfig.json
└── next.config.mjs
```

## 开发工作流

### 1. 添加新的数据模块

创建 `src/lib/data/new-module.ts`:

```typescript
import { cacheGet, cacheSet } from './cache';

export interface NewDataType {
  id: string;
  name: string;
  // 其他字段
}

export async function getNewData(symbol: string): Promise<NewDataType | null> {
  // 1. 检查缓存
  const cached = await cacheGet(`newdata:${symbol}`);
  if (cached) return cached;
  
  // 2. 获取新数据
  const data = await fetchNewData(symbol);
  
  // 3. 设置缓存
  await cacheSet(`newdata:${symbol}`, data);
  
  return data;
}
```

### 2. 添加新的估值方法

创建 `src/lib/valuation/new-method.ts`:

```typescript
import { ValuationInput, ValuationResult } from './types';

export async function calculateNewMethod(
  input: ValuationInput
): Promise<ValuationResult> {
  // 1. 获取数据
  const data = await getDataForValuation(input.symbol);
  
  // 2. 计算估值
  const fairValue = calculate(input, data);
  
  // 3. 返回结果
  return {
    method: 'NewMethod',
    fairValue,
    confidence: 0.8,
    // 其他字段
  };
}
```

### 3. 添加新的 API 端点

创建 `src/app/api/new-endpoint/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const param = searchParams.get('param');
  
  // 处理请求
  const result = await processRequest(param);
  
  return NextResponse.json({
    success: true,
    data: result,
    error: null
  });
}
```

## 代码规范

### TypeScript

- 使用严格的 TypeScript 配置
- 所有接口必须导出类型定义
- 使用 `const` 声明常量
- 避免使用 `any` 类型

### 命名规范

- 文件名: `kebab-case.ts`
- 类名: `PascalCase`
- 函数名: `camelCase`
- 常量: `UPPER_SNAKE_CASE`

### 错误处理

```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  // 记录错误
  console.error('Operation failed:', error);
  
  // 返回结构化错误
  return {
    success: false,
    data: null,
    error: {
      code: 'OPERATION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  };
}
```

### 日志记录

```typescript
import { logger } from '@/lib/logger';

logger.info('Valuation request', { symbol, type });
logger.error('Data fetch failed', { symbol, error });
```

## 测试

### 运行测试

```bash
npm test
```

### 编写测试

```typescript
// tests/valuation.test.ts
import { calculateDCF } from '@/lib/valuation/dcf';

describe('DCF Valuation', () => {
  it('should calculate fair value correctly', () => {
    const result = calculateDCF({
      revenue: 1000000000,
      growthRate: 0.15,
      wacc: 0.10,
      terminalGrowth: 0.03,
      years: 5
    });
    
    expect(result.fairValue).toBeGreaterThan(0);
  });
});
```

## 调试

### API 调试

使用 curl 测试 API:

```bash
# 测试估值接口
curl -X POST http://localhost:3000/api/valuation \
  -H "Content-Type: application/json" \
  -d '{"symbol": "MRNA", "type": "listed"}' \
  -w "\nStatus: %{http_code}\n"

# 测试行情接口
curl "http://localhost:3000/api/quote?symbol=MRNA"
```

### 日志调试

开发时查看日志:

```bash
# 启动开发服务器并查看日志
npm run dev

# 或使用 DEBUG 模式
DEBUG=* npm run dev
```

## 性能优化

### 1. 缓存策略

- 使用内存缓存存储频繁访问的数据
- 设置合理的缓存过期时间
- 实现缓存预热

### 2. 请求优化

- 批量请求代替单个请求
- 使用 Promise.all 并行获取数据
- 实现请求去重

### 3. 错误处理

- 实现重试机制
- 添加超时控制
- 优雅降级

## 部署

### Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 生产部署
vercel --prod
```

### 环境变量配置

在 Vercel Dashboard 中添加环境变量:
- `GEMINI_API_KEY`
- `FMP_API_KEY`

## 常见问题

### Q: 如何添加新的公司数据?

A: 编辑对应的 JSON 文件:
- 上市股票: `data/listed-stocks.json`
- IPO 递表: `data/ipo-filings.json`
- Pre-IPO: `data/preipo-companies.json`

### Q: API 请求失败怎么办?

A: 系统会自动切换备用数据源。如果持续失败，请检查:
1. 网络连接
2. API Key 是否有效
3. 数据源服务状态

### Q: 如何更新临床管线数据?

A: 调用同步 API:
```bash
curl -X POST http://localhost:3000/api/sync-trials
```

## 相关文档

- [架构文档](./ARCHITECTURE.md)
- [API 文档](./API.md)
- [数据源文档](./DATA_SOURCES.md)
- [路线图](./ROADMAP.md)
