# XCure Valuation Engine - 数据源文档

## 概述

本系统使用多数据源备份策略，确保数据获取的稳定性和可靠性。

## 数据源列表

### 1. 实时股价

| 数据源 | 类型 | API Key | 限制 | 优先级 |
|--------|------|---------|------|--------|
| stockprices.dev | 免费 | 否 | 无限制 | 1 (首选) |
| Yahoo Finance (yfinance2) | 免费 | 否 | 无限制 | 2 |
| Financial Modeling Prep | 免费/付费 | 是 | 250次/天 | 3 |

#### stockprices.dev

- **URL**: `https://stockprices.dev/api/stocks/{symbol}`
- **文档**: 无需文档，直接调用
- **示例**:
```bash
curl "https://stockprices.dev/api/stocks/MRNA"
```
```json
{
  "Ticker": "MRNA",
  "Name": "Moderna Inc.",
  "Price": 45.67,
  "ChangeAmount": 2.34,
  "ChangePercentage": 5.4
}
```

#### Yahoo Finance (yfinance2)

- **npm**: `yahoo-finance2`
- **文档**: https://github.com/gadicc/yahoo-finance2
- **示例**:
```typescript
import yahooFinance from 'yahoo-finance2';

const quote = await yahooFinance.quote('MRNA');
// { regularMarketPrice: 45.67, regularMarketChange: 2.34, ... }
```

### 2. 财务数据

| 数据源 | 类型 | API Key | 限制 | 优先级 |
|--------|------|---------|------|--------|
| Yahoo Finance (yfinance2) | 免费 | 否 | 无限制 | 1 (首选) |
| Financial Modeling Prep | 免费/付费 | 是 | 250次/天 | 2 |

#### Yahoo Finance 财务数据

```typescript
// 季度财务数据
const financials = await yahooFinance.financials('MRNA', { 
  period1: '2020-01-01', 
  period2: '2024-12-31' 
});

// 年度财务数据
const annual = await yahooFinance.financials('MRNA', { 
  yearly: true 
});

// 财务比率
const quoteSummary = await yahooFinance.quoteSummary('MRNA', {
  modules: ['financialData', 'defaultKeyStatistics']
});
```

### 3. IPO 递表数据

#### 港股递表 (手动维护)

- **来源**: 港交所披露易 (hkexnews.hk)
- **更新频率**: 手动
- **格式**: 本地 JSON

```json
{
  "id": "insilico-medicine",
  "name": "英矽智能科技有限公司",
  "nameEn": "Insilico Medicine",
  "exchange": "HKEX",
  "listingType": "18A",
  "sector": "生物科技",
  "subsector": "AI药物研发",
  "filingDate": "2024-11",
  "status": "Pending",
  "prospectus": {
    "description": "利用AI技术进行药物发现...",
    "pipeline": [
      { "product": "ISM001-055", "indication": "特发性肺纤维化", "stage": "临床II期" }
    ],
    "lastFinancing": {
      "round": "D轮",
      "valuation": "约10亿美元"
    }
  }
}
```

#### 美股递表 (SEC EDGAR API)

- **URL**: `https://data.sec.gov/submissions/CIK{cik}.json`
- **API Key**: 否 (需要 User-Agent)
- **限制**: 10 请求/秒
- **文档**: https://www.sec.gov/search-filings/edgar-application-programming-interfaces

```typescript
// 获取最近 S-1/F-1 递表
const response = await fetch(
  'https://efts.sec.gov/LATEST/search-index?q=*&dateRange=custom&startdt=2024-01-01&enddt=2025-12-31&forms=S-1,F-1',
  {
    headers: {
      'User-Agent': 'XCure valuation [email protected]'
    }
  }
);
```

### 4. Pre-IPO 公司数据

- **来源**: 手动维护
- **更新频率**: 手动
- **格式**: 本地 JSON

```json
{
  "id": "roivant-sci",
  "name": "Roivant Sciences",
  "description": "Technology-based drug discovery platform",
  "founded": 2014,
  "headquarters": "Basel, Switzerland",
  "lastFunding": {
    "round": "Series D",
    "amount": 450000000,
    "date": "2024-03",
    "valuation": 7000000000,
    "investors": ["SoftBank", "Viking Global"]
  },
  "pipeline": [
    {
      "drug": "Lorecivivint",
      "indication": "Osteoarthritis",
      "phase": "Phase III"
    }
  ]
}
```

### 5. 代币化 Biotech

- **来源**: 手动维护 + CoinGecko API
- **更新频率**: 实时 (代币价格)

```json
[
  {
    "symbol": "VITA",
    "name": "VitaDAO",
    "description": "Decentralized science platform for longevity research",
    "tokenAddress": "0x...",
    "network": "ethereum",
    "type": "governance"
  },
  {
    "symbol": "BIO",
    "name": "BIO Protocol",
    "description": "Biotech tokenization platform",
    "tokenAddress": "0x...",
    "network": "ethereum",
    "type": "governance"
  }
]
```

### 6. 临床管线数据

#### ClinicalTrials.gov API

- **URL**: `https://clinicaltrials.gov/api/v2/studies`
- **API Key**: 否
- **限制**: 公开免费
- **文档**: https://clinicaltrials.gov/data-api/api

```typescript
// 搜索公司临床试验
const response = await fetch(
  'https://clinicaltrials.gov/api/v2/studies?query.cond=&query.spons=Moderna&fields=NCTId,Phase,EnrollmentCount,InterventionName'
);

// 解析返回的临床试验
const data = await response.json();
```

## 容错机制

### 请求超时

```typescript
const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};
```

### 源切换逻辑

```typescript
async function getQuote(symbol: string) {
  // 1. 尝试 stockprices.dev
  try {
    return await fetchStockprices(symbol);
  } catch {
    // 2. 尝试 yfinance2
    try {
      return await fetchYahooFinance(symbol);
    } catch {
      // 3. 尝试 FMP
      return await fetchFMP(symbol);
    }
  }
}
```

### 缓存策略

| 数据类型 | 缓存时间 | 说明 |
|----------|----------|------|
| 实时股价 | 5 分钟 | 价格频繁变化 |
| 财务数据 | 24 小时 | 财报按季度发布 |
| IPO 递表 | 1 周 | 递表不频繁 |
| 临床管线 | 1 周 | 每周同步 |
| 估值结果 | 1 小时 | 综合计算 |

## 数据质量

### 验证规则

- 股价必须为正数
- 财务数据年份必须连续
- 估值结果必须在合理范围内
- 临床试验阶段必须为有效值

### 数据清洗

- 缺失值处理: 使用默认值或上一期数据
- 异常值检测: 使用 Z-Score 方法
- 格式标准化: 统一单位 (USD, 百分比)

## 合规注意事项

- SEC API 需要设置有效的 User-Agent
- 遵守数据源的使用条款
- 不缓存敏感财务数据
- 定期检查数据源可用性
