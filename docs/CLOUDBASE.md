# 数据与 CloudBase 部署

### 来源与许可证

- 数据源：[OurAirports open data](https://ourairports.com/data/)
- 字段说明：[OurAirports data dictionary](https://ourairports.com/help/data-dictionary.html)
- 上游文件：`airports.csv` 与 `countries.csv`
- 许可证：**Public Domain（公有领域）**。OurAirports 允许使用与再分发，不强制署名，同时声明数据不保证准确性或特定用途适用性。
- 本次生成：2026-08-24；读取 85,944 条机场源记录，导入 9,027 个机场。

筛选口径：保留 `large_airport`、`medium_airport`、`small_airport`、`seaplane_base` 中坐标有效、具有 IATA 或 ICAO，且满足“有定期航班服务或拥有 IATA 代码”的记录；排除关闭机场、直升机场和气球场。该口径面向民航飞行日志，不把全球私人简易跑道全部打进小程序。

结构化中文机场名不是 OurAirports 的稳定必填字段，因此没有做批量机器翻译。`miniprogram/data/airport-aliases.zh.js` 只保留原 MVP 已人工校对的少量中文名称；OurAirports 自带 `keywords` 中若存在当地语言名称，仍可参与其他模糊搜索。

### 生成文件

- `cloud-data/airports.json`：CloudBase 可直接导入的 UTF-8 JSON Lines，每行一个完整机场对象，约 4.3 MB。
- `cloud-data/airports.meta.json`：数据来源、许可证、筛选口径、源记录数和导入数。
- `miniprogram/data/airports.js`：本地开发用紧凑字段表，约 1.25 MB，只由机场搜索服务加载。

地图、记录、详情和统计页面都不会加载全球机场表。机场搜索仍保留 300ms 防抖，单次只返回前 20 条。

### 更新机场数据

需要 Node.js，无第三方 npm 依赖：

```bash
npm run sync:airports
```

该命令下载 OurAirports 最新 CSV，并重新生成上述三个文件。网络受限时也可以先下载 CSV，再运行：

```bash
node scripts/sync-airports.js \
  --airports-csv=/absolute/path/airports.csv \
  --countries-csv=/absolute/path/countries.csv
```

## CloudBase 切换与重新导入

默认配置位于 `miniprogram/config/env.js`（路径均相对仓库根目录）：

```js
module.exports = {
  USE_CLOUD: false,
  CLOUD_ENV: ''
}
```

升级现有 CloudBase 环境：

1. 先确认 `flights` 集合已有备份；本次不删除、不重建 `flights`。
2. 打开 CloudBase 控制台 → 文档型数据库 → 集合管理 → `airports` → 导入。
3. 选择 `cloud-data/airports.json`，格式选择 JSON，冲突处理选择 **Upsert**。
4. 文件是 JSON Lines，不是 JSON 数组；共应导入/更新 9,027 条记录。
5. 现有 PEK、HND 等唯一 IATA 机场继续使用 IATA 作为 `_id`，因此 Upsert 会更新原记录，已有 flight 快照仍可编辑；少数重复代码才会回退到 ICAO 或 `oa_<source id>`。
6. 如果你的 `airports` 集合不只包含本 MVP 的原始 20 条数据，请先备份并检查自定义记录；Upsert 不会自动删除本次数据集中不存在的旧文档。
7. 在微信开发者工具中右键 `cloudfunctions/airportSearch`，选择“上传并部署：云端安装依赖”。
8. 同样重新部署 `cloudfunctions/flightService`；该函数已兼容机场集合新的 `latitude` / `longitude` 字段，同时继续兼容旧 `lat` / `lng`，并为“我的”页返回到访机场与国家/地区清单。
9. 将 `miniprogram/config/env.js` 中 `USE_CLOUD` 改为 `true`，填写 `CLOUD_ENV`。
10. 编译后依次验证 `PEK`、`HND`、`LAX`、`JFK`、`CDG`、`LHR`、`SIN`、`SYD`、`DXB` 搜索及新增/编辑记录。

CloudBase 官方导入支持 JSON Lines，并提供 Insert/Upsert 两种冲突策略；本项目更新既有机场集合时应使用 Upsert。

### 数据库索引

在 `airports` 集合 → 索引管理中建立以下非唯一索引：

| 索引 | 字段与方向 | 用途 |
| --- | --- | --- |
| `airport_iata` | `iata` 升序 | IATA 精确匹配 |
| `airport_icao` | `icao` 升序 | ICAO 精确匹配 |
| `airport_popular` | `popular` 降序 | 空搜索时的常用机场排序 |

不要把 `iata` 或 `icao` 设置为唯一索引：部分数据没有对应代码，且全球数据可能存在少量重复/历史代码。

机场名与城市名使用正则模糊检索；CloudBase 文档型数据库的正则查询不能利用普通索引，因此无需为 `nameNormalized`、`cityNormalized` 建立普通索引。当前数据规模为 9,027 条、云函数并行查询且每类最多取 20 条。如果未来机场库继续扩大并出现明显性能问题，再评估 CloudBase 全文索引，不需要改 Great Circle 或页面逻辑。

`flights` 集合保留/创建组合索引：

| 索引 | 字段与方向 |
| --- | --- |
| `flight_user_date_created` | `_openid` 升序、`flightDate` 降序、`createdAt` 降序 |

`airports` 建议仅公开只读或完全关闭客户端写入；`flights` 关闭客户端直接读写，所有 CRUD 继续走 `flightService`，由云函数读取当前 OpenID。


## 云函数依赖与验证范围

两个云函数均固定 `wx-server-sdk@4.0.2`，并提交各自的 `package-lock.json`。需要本地安装时分别运行：

```bash
npm ci --ignore-scripts --prefix cloudfunctions/airportSearch
npm ci --ignore-scripts --prefix cloudfunctions/flightService
```

开发者工具中仍使用“上传并部署：云端安装依赖”。具体安装行为由平台决定；部署后应确认 SDK 版本。根目录 `npm ci` 只安装根项目，不会安装云函数依赖。

本仓库的云函数测试使用 SDK mock，覆盖身份来源、跨用户读写隔离、机场快照与数据库失败，不代表已完成真实 CloudBase 集成测试。配置自己的测试环境后，按以下步骤验收：

1. 创建 `airports`、`flights` 集合并设置上述规则、索引，再导入机场表。
2. 部署两个云函数，填写自己的 AppID 和 `CLOUD_ENV`，开启 `USE_CLOUD`。
3. 验证机场搜索、新增、编辑、删除、年度筛选和统计。
4. 使用两个独立微信用户确认彼此看不到对方记录；直接访问数据库的客户端应被规则拒绝。
5. 仅用专门的测试记录验证全部删除，确认另一用户的数据不受影响。
6. 提交公开代码前恢复 `touristappid`、`USE_CLOUD: false` 和空的 `CLOUD_ENV`，运行 `npm run verify`。

当前记录列表/地图最多读取 500 条，云端统计最多汇总 5,000 条；大规模使用前需要完善分页和聚合，见 [架构与取舍](ARCHITECTURE.md)。
