# 上传 GitHub

当前目录已整理为公开仓库结构，尚未创建远程仓库或上传。建议仓库名 `flight-log-miniprogram`，简介：

> 微信原生飞行日志小程序：全球机场搜索、大圆航线可视化、个人记录与旅行统计，支持本地演示和 CloudBase。

Topics 可用 `wechat-miniprogram`、`javascript`、`flight-log`、`great-circle`、`cloudbase`、`portfolio`。

## 本地与公开文件

`.gitignore` 排除微信私人配置、原始工作版 PRD、系统元数据、依赖目录、构建产物与常见密钥文件；原文件仍保留在本地。公开产品说明为 [PRODUCT.md](PRODUCT.md)。

`project.config.json` 使用 `touristappid`，`env.js` 默认本地模式、空云环境。使用自己的配置调试后，提交前恢复默认值。AppID 与环境标识不等同于 Secret，但公开样例无需携带个人配置。

## 首次提交

在仓库根目录执行：

```bash
git init -b main
git add .
git diff --cached --stat
npm ci
npm run verify
git commit -m "Prepare Flight Log portfolio project"
```

在 GitHub 新建空仓库，不预先生成 README。用真实的仓库地址添加 `origin`，运行 `git push -u origin main`。这里不放虚构的用户名或项目链接。

提交前确认暂存清单没有私人配置、原始 `.docx`、`.DS_Store`、`.env` 或真实行程截图。`.gitignore` 对已经跟踪的文件无效，`check` 会检查这类情况。若曾公开真实凭证，需在对应平台撤销或轮换，删除当前文件不能消除历史泄露。

## 仓库呈现

- About 填写简介和 Topics，将项目置顶到个人 Profile，在简历中放仓库链接。
- 等首次 GitHub Actions 真正成功后，再以它作为远程验证证据。
- 不添加虚构的体验二维码、在线地址、用户规模或运行截图。
- 保留 MIT `LICENSE` 与独立的机场数据声明 `THIRD_PARTY_DATA.md`。

附带源码包按 `scripts/public-files.js` 的明确列表生成，包含 `.github` 等隐藏配置，排除本地私人文件。解压后仍应检查；压缩包不会创建 Git 历史或远程仓库。
