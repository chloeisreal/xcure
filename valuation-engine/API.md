# XCure Valuation Engine - API 文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`

## 端点列表

| 端点 | 方法 | 描述 |
|------|------|------|
| `/valuation` | POST | 获取资产估值 |
| `/quote` | GET | 获取实时行情 |
| `/companies` | GET | 获取公司列表 |
| `/sync-trials` | POST | 同步临床试验数据 |
| `/collect` | POST | 收集新公司信息 |

---

## 1. 估值接口

### POST /api/valuation

获取生物医药资产的 AI 估值报告

#### 请求

```json
{
  "symbol": "MRNA",
  "type": "listed",
  "methods": ["dcf", "comps", "rnpv", "ai"],
  "aiSummary": true
}
```

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `symbol` | string | 是 | 股票代码 或 公司 ID |
| `type` | string | 是 | 资产类型: `listed`, `ipo`, `preipo`, `token` |
| `methods` | string[] | 否 | 估值方法: `dcf`, `comps`, `rnpv`, `ai` (默认全部) |
| `aiSummary` | boolean | 否 | 是否需要 AI 综合分析 (默认 true) |

#### 资产类型说明

- `listed`: 已上市股票 (如 MRNA, PFE, VITA)
- `ipo`: IPO 递表公司
- `preipo`: Pre-IPO 私募公司
- `token`: 代币化 Biotech (如 VITA, BIO)

#### 响应

```json
{
  "success": true,
  "data": {
    "symbol": "MRNA",
    "name": "Moderna Inc.",
    "type": "listed",
    "currentPrice": 45.67,
    "currency": "USD",
    "valuation": {
      "dcf": {
        "method": "DCF",
        "fairValue": 52.30,
        "upside": "14.5%",
        "parameters": {
          "revenue": 6700000000,
          "growthRate": 0.15,
          "wacc": 0.10,
          "terminalGrowth": 0.03
        }
      },
      "comps": {
        "method": "Comps",
        "fairValue": 48.90,
        "upside": "7.1%",
        "comparables": ["BNTX", "NVAX", "VRMA"]
      },
      "rnpv": {
        "method": "rNPV",
        "fairValue": 55.00,
        "upside": "20.4%",
        "pipelineValue": 12000000000,
        "successProbability": 0.45
      },
      "ai": {
        "method": "AI",
        "fairValue": 51.80,
        "recommendation": "Buy",
        "confidence": 78,
        "summary": "基于四种估值方法的综合分析..."
      }
    },
    "metadata": {
      "timestamp": "2025-03-11T12:00:00Z",
      "dataSources": ["stockprices.dev", "yahoo-finance2"],
      "cacheAge": 300
    }
  },
  "error": null
}
```

#### 错误响应

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Company not found"
  }
}
```

---

## 2. 行情接口

### GET /api/quote

获取实时股价

#### 请求

```
GET /api/quote?symbol=MRNA
```

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `symbol` | string | 是 | 股票代码 |

#### 响应

```json
{
  "success": true,
  "data": {
    "symbol": "MRNA",
    "name": "Moderna Inc.",
    "price": 45.67,
    "change": 2.34,
    "changePercent": 5.4,
    "volume": 12345678,
    "marketCap": 18000000000,
    "currency": "USD",
    "timestamp": "2025-03-11T12:00:00Z"
  },
  "error": null
}
```

---

## 3. 公司列表接口

### GET /api/companies

获取支持估值的公司列表

#### 请求

```
GET /api/companies?type=listed&sector=biotech
```

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 否 | 筛选类型: `listed`, `ipo`, `preipo`, `token` |
| `sector` | string | 否 | 筛选行业: `biotech`, `pharma`, `ai-drug` |

#### 响应

```json
{
  "success": true,
  "data": {
    "listed": [
      { "symbol": "MRNA", "name": "Moderna Inc.", "exchange": "NASDAQ" },
      { "symbol": "BNTX", "name": "BioNTech SE", "exchange": "NASDAQ" },
      { "symbol": "VRTX", "name": "Vertex Pharmaceuticals", "exchange": "NASDAQ" }
    ],
    "ipo": [
      { "id": "insilico-medicine", "name": "英矽智能", "exchange": "HKEX", "status": "Pending" }
    ],
    "preipo": [
      { "id": "roivant-sci", "name": "Roivant Sciences", "lastValuation": 7000000000 }
    ],
    "token": [
      { "symbol": "VITA", "name": "VitaDAO", "type": "governance" }
    ]
  },
  "error": null
}
```

---

## 4. 临床试验同步接口

### POST /api/sync-trials

手动触发临床试验数据同步

#### 请求

```json
{
  "company": "moderna",
  "force": false
}
```

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `company` | string | 否 | 指定公司名称 (默认全部) |
| `force` | boolean | 否 | 强制刷新缓存 (默认 false) |

#### 响应

```json
{
  "success": true,
  "data": {
    "synced": 156,
    "new": 12,
    "updated": 5,
    "duration": "2.3s"
  },
  "error": null
}
```

---

## 5. 新公司收集接口

### POST /api/collect

查询新公司时自动收集公司信息

#### 请求

```json
{
  "name": "New Biotech Company",
  "type": "preipo"
}
```

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 公司名称 |
| `type` | string | 是 | 公司类型: `ipo`, `preipo` |

#### 响应

```json
{
  "success": true,
  "data": {
    "id": "new-biotech-company",
    "name": "New Biotech Company",
    "status": "collected",
    "message": "公司信息已收集，将在下次查询时返回估值"
  },
  "error": null
}
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| `NOT_FOUND` | 公司/资产未找到 |
| `INVALID_PARAMS` | 请求参数无效 |
| `DATA_SOURCE_ERROR` | 数据源错误 |
| `VALUATION_ERROR` | 估值计算错误 |
| `RATE_LIMIT` | 请求频率超限 |

---

## 速率限制

- 通用接口: 60 请求/分钟
- 估值接口: 20 请求/分钟
- 同步接口: 5 请求/分钟
