# 艾星情报局 · 公会试玩

浏览器挂机与肉鸽卡牌战斗 Demo，支持电脑和手机浏览器。

游戏入口：https://ruiz1996.github.io/-Intelligence-Agency-of-Azeroth/

## 发布设置

在 Settings → Pages 中选择 Deploy from a branch，分支 main，目录 /docs，然后保存。首次发布完成后入口才可访问。

docs 目录是可直接托管的静态网页。账号、存档和奖励结算使用已部署的 Supabase 服务；config.js 中仅包含允许公开的项目 URL 和 Publishable Key。

## 更新方式

在本地开发工程运行 node scripts/prepare-pages.mjs，将 .deploy/github-pages/docs 中的文件更新到本仓库 docs 目录并提交。GitHub Pages 会重新发布。

开发工程、数据库迁移和部署脚本保留在本地工程中。
