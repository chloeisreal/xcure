# XCure Valuation Engine

生物医药资产 AI 估值引擎

## 项目概述

XCure Valuation Engine 是一个专注于生物医药领域资产的 AI 估值系统，支持以下类型的资产估值：

- **已上市股票**：港股、美股上市的生物医药公司
- **IPO 递表公司**：港股递表公司、美股 SEC 递表公司
- **Pre-IPO 公司**：私募阶段的生物医药公司
- **代币化 Biotech**：VitaDAO、BIO Protocol 等

## 核心功能

- **多源数据获取**：实时股价、财务数据、临床管线数据三元备份
- **多种估值方法**：DCF、可比公司分析、rNPV 风险调整净现值
- **AI 综合分析**：基于 Gemini/Claude 的智能估值报告
- **自动数据同步**：ClinicalTrials.gov 临床试验数据每周自动更新
- **动态公司收集**：查询新公司时自动收集并分析

## 技术栈

- **运行时**：Node.js (Next.js API Routes)
- **AI**：Google Gemini, Anthropic Claude
- **数据源**：stockprices.dev, Yahoo Finance, SEC EDGAR, ClinicalTrials.gov
- **存储**：JSON 文件 (轻量级本地存储)

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local 添加必要的 API Key

# 启动开发服务器
npm run dev
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `GEMINI_API_KEY` | 是 | Google Gemini API Key |
| `FMP_API_KEY` | 否 | Financial Modeling Prep API Key (免费注册) |

## 项目结构

```
valuation-engine/
├── src/
│   ├── app/api/           # API 端点
│   ├── lib/
│   │   ├── data/          # 数据获取模块
│   │   └── valuation/     # 估值引擎
├── data/                  # 本地数据存储
└── tests/                 # 测试文件
```

## 相关文档

- [架构文档](./ARCHITECTURE.md)
- [API 文档](./API.md)
- [数据源文档](./DATA_SOURCES.md)
- [开发指南](./DEVELOPMENT.md)
- [路线图](./ROADMAP.md)

## License

MIT
