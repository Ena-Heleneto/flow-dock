# Flow Dock · Base Infra Template

这是 `template/base-infra` 分支，对应 **infra-only 模板**：

- ✅ 保留：扩展运行时基础设施（background/content/page）、模块发现机制、构建系统、路由调度骨架、共享基础工具。
- ❌ 移除：所有业务域实现（dict-keeper / database-manager / import-pipeline 及其 router/service/schema）。

## 目录骨架

- `apps/background/`：后台入口（挂载路由调度器与侧边栏行为）
- `apps/content-scripts/`：内容脚本最小注入入口
- `apps/navigation/`：模板默认 page（可作为 side panel）
- `apps/shared/`：共享样式/通用逻辑
- `apps/client/request.ts`：前端到 background 的请求封装（含无路由场景容错）
- `server/router-dispatcher.ts`：路由调度基础框架（支持空路由退化）
- `scripts/module-registry.ts`：`apps/*` 模块发现
- `manifest.ts`：扩展 manifest 生成
- `vite.config.mts`：按模块类型构建

## 快速开始

1. 安装依赖
	- `pnpm install`
2. 运行质量门禁
	- `pnpm lint`
	- `pnpm typecheck`
	- `pnpm test`
3. 构建
	- `pnpm build`
4. 本地启动扩展
	- `pnpm start:chrome`
	- 或 `pnpm start:firefox`

## 环境变量

仓库已提供根目录 `.env` 占位文件（模板场景）。

- `FIREFOX_GECKO_ID`：Firefox 扩展 ID（为空时脚本会自动生成并持久化）
- `CHROMIUM_BINARY`：可选，自定义 Chromium 路径
- `FIREFOX_BINARY`：可选，自定义 Firefox 路径

> 说明：脚本会将 legacy 根目录 `.env` 迁移到 `env/config/.env`。

## 如何在模板上添加业务模块

1. 在 `apps/<your-module>/` 新建模块目录。
2. 添加 `module.config.json`（声明 `kind`、`entry`、`outDir`）。
3. 根据 `kind` 提供入口：
	- `background`：通常是 `main.ts`
	- `content`：通常是 `index.ts`
	- `page`：通常是 `index.html`
4. 若需要后台接口，在 `server/router/**/*.router.ts` 添加路由处理器。
5. 若需要中间件/插件，可放到 `server/middleware`、`server/plugin`。

## 模板设计目标

- 让你可以在不背业务包袱的情况下快速起扩展项目。
- 保留清晰的分层边界：页面/内容脚本 ↔ background ↔ router runtime。
- 支持从“空路由”逐步演进到完整业务系统。
