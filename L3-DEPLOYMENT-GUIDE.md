# xCure Network L3 部署指南 (本地演示版)

本文档详细介绍如何从零开始部署 xCure Network L3 (AnyTrust)

> **注意**: 本指南仅适用于本地演示。要部署到生产环境，需要云服务器和真实资金。

---

## 环境要求

| 项目 | 最低要求 |
|------|----------|
| 操作系统 | macOS / Linux / Windows (WSL2) |
| Docker | Desktop 4.0+ |
| Node.js | 18+ |
| Git | 已安装 |
| pnpm | 建议使用 (orbit-deployment-ui 需要) |
| 内存 | 8GB+ |
| 磁盘 | 20GB+ |

---

## 第一阶段：准备工作

### 1.1 克隆仓库

```bash
git clone https://github.com/anomalyco/xcure.git
cd xcure
```

### 1.2 安装依赖

```bash
# 安装 Node.js 依赖 (如果需要)
npm install

# 安装 Foundry (用于 cast 命令)
curl -L https://foundry.paradigm.xyz | bash
export PATH="$HOME/.foundry/bin:$PATH"
```

---

## 第二阶段：部署 Rollup 合约

### 2.1 准备工作

#### 方法 A：使用本地部署界面（推荐用于开发）

```bash
# 克隆部署工具
git clone https://github.com/OffchainLabs/arbitrum-orbit-deployment-ui.git
cd arbitrum-orbit-deployment-ui
npm install

# 配置环境变量
cat > .env.local << EOF
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=dummy-project-id
EOF

# 启动部署界面
npm run dev
# 访问 http://localhost:3000/deployment
```

#### 方法 B：使用官方部署门户

直接访问 https://orbit.arbitrum.io/ (可能有访问限制)

#### 连接钱包
- 使用 MetaMask 或 OKX 钱包
- 确保切换到 **Arbitrum Sepolia** 网络
- 确保钱包有 **0.05+ ETH**

### 2.2 部署步骤

1. 打开 **http://localhost:3000/deployment**
2. 点击 **"Launch on testnet"**
3. 连接钱包
4. 选择 **AnyTrust** (更便宜的方案)
5. 配置：
   - Chain ID: `281003` (或其他未使用的 ID)
   - Chain Name: `xCure Network`
   - Token: ETH
6. 按照界面提示完成部署
7. 下载 `orbit-config.zip`

### 2.3 配置 L3

```bash
# 解压配置文件
cd ~/Downloads
unzip orbit-config.zip -d ~/orbit-config/
```

---

## 第三阶段：启动 L3 节点

### 3.1 复制配置文件

```bash
cp ~/orbit-config/nodeConfig.json ~/Downloads/orbit-setup-script/config/
cp ~/orbit-config/orbitSetupScriptConfig.json ~/Downloads/orbit-setup-script/config/
```

### 3.2 启动 Docker 容器

```bash
cd ~/Downloads/orbit-setup-script

# 停止可能冲突的容器
docker stop postgres blockscout 2>/dev/null || true

# 启动 L3 节点
docker compose up -d
```

### 3.3 验证运行

```bash
# 检查容器状态
docker ps

# 测试 L3 RPC
curl -X POST http://127.0.0.1:8449 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

返回类似 `{"result":"0x8"}` 表示正常运行。

---

## 第四阶段：启动 Blockscout

Blockscout 已经随 docker compose 一起启动。

### 4.1 验证 Blockscout

```bash
# 检查服务状态
curl -s http://localhost/ | head -5
```

### 4.2 访问

- **区块浏览器**: http://localhost
- **L3 RPC**: http://127.0.0.1:8449

---

## 第五阶段：测试 L3

### 5.1 部署合约

```bash
cd ~/xcure/l3-poc/contracts

# 编译合约
npx hardhat compile

# 部署测试代币
node scripts/testL3Simple.js
```

### 5.2 查看结果

1. 打开 http://localhost
2. 查看最新区块和交易

---

## 常用命令

### 启动所有服务
```bash
cd ~/Downloads/orbit-setup-script
docker compose up -d
```

### 停止所有服务
```bash
docker compose down
```

### 查看日志
```bash
docker logs orbit-setup-script-nitro-1 -f
docker logs backend -f
```

### 检查端口
```bash
curl http://127.0.0.1:8449
curl http://localhost/
```

---

## 常见问题

### Q1: Docker 磁盘空间不足
```bash
docker system prune -a
```

### Q2: 端口被占用
```bash
lsof -i :8449
lsof -i :80
```

### Q3: Blockscout 连接失败
```bash
docker restart backend
```

---

## 相关信息

| 项目 | 值 |
|------|-----|
| Chain ID | 8937309580 |
| Chain Name | xCure Network |
| 类型 | AnyTrust |
| 父链 | Arbitrum Sepolia |
| RPC 端口 | 8449 |
| 浏览器 | localhost |

---

## 部署完成

完成以上步骤后，你将拥有：

- ✅ 运行中的 L3 节点
- ✅ Blockscout 区块浏览器
- ✅ 可以部署和测试合约

---

## 下一步

1. **部署 Token Bridge** - 连接 L2 和 L3
2. **桥接 ETH** - 从 L2 存入资金到 L3
3. **部署 DApp** - 在 L3 上部署你的应用

---

## 第六阶段：迁移与备份

### 6.1 理解数据存储

```
L3 数据存储位置：
- Nitro 节点数据: Docker 卷 (容器内 /home/user/.arbitrum)
- Blockscout 数据: PostgreSQL 数据库 (Docker 卷)
- DAS 数据: Docker 卷 (容器内 /home/user/das)
```

| 数据类型 | 存储位置 | 是否需要迁移 |
|----------|-----------|--------------|
| Rollup 合约地址 | L2 链上 (不需要) | ✅ 自动保持 |
| 批次数据 | L2 链上 (不需要) | ✅ 自动保持 |
| L3 账户状态 | 容器内 | ❌ 需要手动迁移 |
| L3 合约状态 | 容器内 | ❌ 需要手动迁移 |
| L3 交易历史 | 容器内 | ❌ 需要手动迁移 |
| Blockscout 索引 | PostgreSQL | ❌ 需要手动迁移 |

### 6.2 导出 L3 节点数据（旧电脑）

```bash
# 方法1：复制 Docker 卷内容（推荐）

# 1. 停止容器（保持数据一致性）
cd ~/Downloads/orbit-setup-script
docker compose stop

# 2. 创建临时容器并导出数据
docker create -v arb-data --name arb-data-temp alpine:latest /bin/true

# 3. 复制数据到本地
docker cp orbit-setup-script-nitro-1:/home/user/.arbitrum ./nitro-backup

# 或者使用单行命令
docker cp orbit-setup-script-nitro-1:/home/user/.arbitrum/. ./nitro-data -a

# 4. 压缩备份
tar -czvf nitro-backup.tar.gz ./nitro-backup

# 5. 记录重要信息
echo "Chain ID: your-chain-id" > migration-info.txt
echo "Rollup Address: your-rollup-address" >> migration-info.txt
```

### 6.3 传输到新电脑

```bash
# 方法1：使用 SCP（同一网络）
scp -r nitro-backup.tar.gz user@新电脑IP:~/Downloads/

# 方法2：使用云存储（跨网络）
# 上传到 Google Drive / Dropbox / S3，然后下载

# 方法3：使用 USB 存储
# 拷贝到 USB 磁盘，到新电脑后复制
```

### 6.4 导入 L3 节点数据（新电脑）

```bash
# 1. 确保 orbit-setup-script 已配置
cd ~/Downloads/orbit-setup-script

# 2. 如果已有数据，先停止
docker compose down

# 3. 解压备份数据
tar -xzvf nitro-backup.tar.gz

# 4. 恢复数据到正确位置
cp -r ./nitro-backup/.arbitrum ./config/

# 或者使用 Docker cp
docker cp ./nitro-backup/.arbitrum orbit-setup-script-nitro-1:/home/user/.arbitrum

# 5. 启动容器
docker compose up -d

# 6. 验证数据
curl -X POST http://127.0.0.1:8449 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 6.5 导出 Blockscout 数据（旧电脑）

```bash
# 1. 导出数据库
docker exec db pg_dump -U blockscout blockscout > blockscout-backup.sql

# 2. 压缩并保存
gzip blockscout-backup.sql
```

### 6.6 导入 Blockscout 数据（新电脑）

```bash
# 1. 启动数据库
docker compose up -d db

# 2. 等待数据库就绪
sleep 10

# 3. 恢复数据
docker exec -i db psql -U blockscout blockscout < blockscout-backup.sql.gz
```

### 6.7 完整迁移脚本

```bash
#!/bin/bash
# migrate-l3.sh - 完整迁移脚本

set -e

echo "=== xCure L3 Migration Script ==="
echo ""

# 检查参数
if [ -z "$1" ]; then
    echo "用法: ./migrate-l3.sh <backup-dir> [remote-host]"
    echo "  <backup-dir>: 备份目录路径"
    echo "  [remote-host]: 可选，远程主机地址（用于SCP）"
    exit 1
fi

BACKUP_DIR=$1
REMOTE_HOST=$2

echo "备份目录: $BACKUP_DIR"
echo ""

# 步骤1: 停止旧电脑上的服务
echo "[1/6] 停止服务..."
cd ~/Downloads/orbit-setup-script
docker compose stop
echo "✓ 服务已停止"
echo ""

# 步骤2: 导出 Nitro 数据
echo "[2/6] 导出 Nitro 节点数据..."
mkdir -p $BACKUP_DIR/nitro
docker cp orbit-setup-script-nitro-1:/home/user/.arbitrum $BACKUP_DIR/nitro/
echo "✓ Nitro 数据已导出"
echo ""

# 步骤3: 导出 Blockscout 数据库
echo "[3/6] 导出 Blockscout 数据库..."
docker exec db pg_dump -U blockscout blockscout | gzip > $BACKUP_DIR/blockscout.sql.gz
echo "✓ Blockscout 数据库已导出"
echo ""

# 步骤4: 记录配置信息
echo "[4/6] 记录配置信息..."
cd $BACKUP_DIR
cat > migration-info.txt << EOF
xCure L3 Migration Info
======================
日期: $(date)
原始 Chain ID: $(curl -s -X POST http://127.0.0.1:8449 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq -r '.result' | tr -d '0x' | printf "%d\n" 0x$(cat))
原始区块: $(curl -s -X POST http://127.0.0.1:8449 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result')
EOF
cat migration-info.txt
echo ""

# 步骤5: 传输到新电脑
if [ -n "$REMOTE_HOST" ]; then
    echo "[5/6] 传输数据到新电脑..."
    scp -r $BACKUP_DIR user@$REMOTE_HOST:~/Downloads/
    echo "✓ 数据已传输到 $REMOTE_HOST"
    echo ""
fi

echo "[6/6] 备份完成！"
echo ""
echo "在新电脑上执行以下步骤："
echo "1. 解压: tar -xzvf $BACKUP_DIR.tar.gz"
echo "2. 导入 Nitro: cp -r $BACKUP_DIR/nitro/.arbitrum ~/Downloads/orbit-setup-script/config/"
echo "3. 导入 Blockscout: docker exec -i db psql -U blockscout blockscout < $BACKUP_DIR/blockscout.sql.gz"
echo "4. 启动: cd ~/Downloads/orbit-setup-script && docker compose up -d"
```

### 6.8 注意事项

⚠️ **重要提醒**

1. **迁移期间**：确保源链没有新交易
2. **停止服务**：迁移前必须停止所有容器
3. **区块高度**：迁移后检查区块高度是否一致
4. **验证完整性**：对比迁移前后的关键数据

### 6.9 验证迁移结果

```bash
# 检查区块高度（旧电脑）
OLD_BLOCKS=$(curl -s -X POST http://旧电脑IP:8449 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result')

# 检查区块高度（新电脑）
NEW_BLOCKS=$(curl -s -X POST http://127.0.0.1:8449 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result')

echo "旧电脑区块: $OLD_BLOCKS"
echo "新电脑区块: $NEW_BLOCKS"

# 应该相同表示迁移成功
```

### 6.10 常见迁移问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 迁移后无法启动 | 数据权限问题 | `chmod -R 755 ./config` |
| 区块高度不一致 | 数据复制不完整 | 重新导出/导入 |
| Blockscout 白屏 | 数据库未恢复 | 重新导入 SQL |
| RPC 连接失败 | 防火墙未开放 | 检查端口 8449 |
