# Flow Dock 运行时生成架构说明

## 背景

当前仓库正在朝一个更轻的模板化基础设施演进：

- 根目录业务代码尽量只保留项目业务本身。
- 底层运行时能力尽量收敛到 `package/` 下维护。
- 业务代码不直接从 `package/` 中引入底层包，避免业务层与底层实现耦合。
- 通过运行时生成 `.flow-dock/` 目录，提供一个类似 Nuxt `.nuxt/` 的项目级生成工作区。

当前已具备的基础：

- `vite.config.mts` 已接入 `FlowDockKit()` 插件入口。
- `package/flow-dock-kit/main.ts` 已预留 Vite 插件外壳。
- `package/flow-dock-kit/temp/module.ts` 已具备 `.flow-dock` 目录生成草稿能力。
- `server/router-dispatcher.ts` 已体现出“运行时核心逻辑 + 项目装配逻辑”混合的现状。

本说明文档用于明确后续实现方向，避免在“生成目录”“虚拟模块”“底层包”和“业务代码”之间反复摇摆。

## 核心目标

### 1. 底层逻辑尽量只存在于 `package/`

未来稳定的 runtime / driver / adapter / transaction / fs driver 等基础能力，原则上都应收敛到 `package/` 下维护。

### 2. 业务代码不直接依赖底层包

业务层只能依赖由框架生成出来的统一门面，不直接引入 `package/flow-dock-kit` 或其他底层包。

### 3. `.flow-dock/` 作为项目级生成工作区

`.flow-dock/` 的职责不是存放底层实现真源，而是：

- 生成面向业务的 facade
- 生成面向入口的 bootstrap
- 生成面向构建期的 metadata
- 作为 TypeScript / Vite / IDE 都可见的真实目录

### 4. 业务与底层之间保留明确隔离层

后续无论底层 runtime 如何拆包、如何替换 driver、如何新增环境适配，业务侧 API 不应发生频繁抖动。

## 为什么选真实 `.flow-dock/` 而不是纯虚拟模块

本项目虽然基于 Vite，但目标不是只注入几个 `virtual:` 模块，而是建立一个可被多方消费的“生成工作区”。

真实 `.flow-dock/` 的优势：

- TypeScript、IDE、Vite、脚本层都能直接读取。
- 便于调试生成结果。
- 便于给 Node 侧逻辑复用，例如 `manifest.ts`、构建脚本、扫描脚本。
- 可以生成多文件结构，而不是把复杂逻辑都压在插件 `load()` 返回的字符串里。

纯虚拟模块的问题：

- 更适合少量胶水入口，不适合一整套 generated workspace。
- Node 侧脚本无法天然消费。
- 多文件生成和调试体验较差。
- 类型声明维护成本更高。

因此，本项目建议采用：

- **真实 `.flow-dock/` 作为主生成目录**
- **按需补充虚拟入口或别名作为门面**

## 最终分层模型

建议将整个系统划分为三层。

### 第一层：`package/` —— 底层实现真源

职责：

- 提供稳定 runtime 原语
- 提供 driver / middleware / plugin / schema / transaction / fs adapter 等实现
- 提供生成器、模板、扫描器等工具能力
- 提供 Vite 插件能力

特点：

- 是唯一实现真源
- 可以被工具层直接依赖
- 不应反向依赖项目业务代码

适合迁入 `package/` 的内容示例：

- `server/driver/*`
- `server/runtime/*`
- `server/router-dispatcher.ts` 中与项目业务无关的通用调度核心
- 未来的文件系统驱动实现

### 第二层：`.flow-dock/` —— 项目生成门面与装配层

职责：

- 向业务层暴露统一 API 门面
- 向入口层暴露项目级 bootstrap 文件
- 产出项目扫描后的元数据与类型桥接
- 屏蔽底层包的真实物理路径

特点：

- 是生成结果，不是真源
- 可以引用 `package/` 的实现
- 也可以引用项目自身的业务模块
- 但不应承载大段底层实现复制品

### 第三层：业务层 —— 业务代码与入口代码

职责：

- 页面、router、service、schema、业务 composable
- background/page/content 等入口文件

规则：

- 业务代码只依赖 `#flow-dock/*`
- 不直接 import `package/*`
- 与底层包保持隔离

## `.flow-dock/` 的文件职责划分

建议不要把 `.flow-dock/` 做成一个杂糅目录，而是分成三类文件。

### 1. facade：面向业务代码的统一门面

示例：

- `.flow-dock/server.ts`
- `.flow-dock/fs.ts`
- `.flow-dock/types.d.ts`
- `.flow-dock/imports.generated.ts`

职责：

- 对业务暴露稳定 API
- 将业务代码与真实底层包隔离
- 为自动导入提供统一出口

这类文件通常只做：

- `re-export`
- 轻量组合
- 轻量命名适配

不应做：

- 复杂项目扫描
- 大段 runtime 实现

### 2. bootstrap：面向入口与装配的生成文件

示例：

- `.flow-dock/bootstrap/router.generated.ts`
- `.flow-dock/bootstrap/middleware.generated.ts`
- `.flow-dock/bootstrap/plugin.generated.ts`
- `.flow-dock/bootstrap/background.ts`

职责：

- 在项目上下文中执行 `import.meta.glob(...)`
- 将项目中的 router/middleware/plugin 收集后交给底层 runtime 初始化
- 为 background/page/content 等入口提供统一启动点

这类文件是“项目装配层”，不是底层实现层。

### 3. meta：面向构建期与脚本层的元数据文件

示例：

- `.flow-dock/meta/modules.generated.json`
- `.flow-dock/meta/runtime.generated.json`
- `.flow-dock/meta/imports.generated.json`

职责：

- 为 `manifest.ts`、脚本、生成器等 Node 侧逻辑提供可直接读取的数据源
- 作为 Vite 与 Node 共享的生成结果

## 依赖方向约束

推荐固化为以下依赖关系：

- `package/*` 不依赖项目业务代码
- `.flow-dock/*` 可以依赖 `package/*`
- `.flow-dock/bootstrap/*` 可以依赖项目业务模块
- 业务代码只依赖 `.flow-dock/*` 暴露的 API
- 业务代码不直接依赖 `package/*`

用图示理解：

- 底层实现：`package/*`
- 生成门面：`.flow-dock/*`
- 业务模块：`apps/*`、`server/router/*` 等

方向为：

- `业务模块 -> #flow-dock/*`
- `.flow-dock/* -> package/*`
- `.flow-dock/bootstrap/* -> 项目业务模块`
- `package/*` 不反向依赖业务模块

## 现阶段需要重点拆分的对象

### `server/router-dispatcher.ts`

这是当前最典型的“底层实现 + 项目装配”混合体。

其中可拆为两部分：

#### 应迁入 `package/` 的部分

- 请求归一化逻辑
- route key/path/method 解析逻辑
- middleware 链执行逻辑
- plugin 生命周期执行逻辑
- 错误归一化逻辑
- dispatcher 核心运行时

#### 应生成到 `.flow-dock/` 的部分

- `import.meta.glob('./router/**/*.router.ts', { eager: true })`
- `import.meta.glob('./middleware/**/*.middleware.ts', { eager: true })`
- `import.meta.glob('./plugin/**/*.plugin.ts', { eager: true })`
- 将 glob 结果喂给 runtime 的 bootstrap 文件

结论：

- runtime 核心应该进 `package/`
- 项目扫描与模块装配应该留在 `.flow-dock/`

## Vite 插件 `flowDockKit()` 的职责

`package/flow-dock-kit/main.ts` 建议只作为一个很薄的插件外壳，不直接承载复杂业务。

它应该负责：

1. 解析插件配置
2. 记录 `resolvedConfig`
3. 确保根目录存在 `.flow-dock/`
4. 在 `configureServer()` 和 `buildStart()` 中触发生成逻辑
5. 注册 `#flow-dock/*` 对应的 alias
6. 在必要时监听相关目录变化并重新生成

它不应该负责：

- 直接内嵌全部模板字符串
- 承载全部生成细节
- 承载底层 runtime 实现本体

更合适的内部结构是：

- `main.ts`：插件外壳
- `generator/*`：生成器
- `templates/*`：模板
- `runtime/*`：底层实现
- `meta/*`：生成元数据

## 推荐的生成时机

`.flow-dock/` 应在模块图建立前生成，而不是等到 bundle 阶段再处理。

建议优先使用的 Vite 生命周期：

- `configResolved`
- `configureServer`
- `buildStart`

不建议把主要生成逻辑放在：

- `generateBundle`
- `writeBundle`

原因：

- `.flow-dock/` 是开发期 / 构建前工作区
- 不是最终产物补丁区
- 过晚生成会导致模块分析与类型解析时机不对

## 与最终打包产物的关系

根目录 `.flow-dock/` 的定位是：

- 开发与构建阶段的生成工作区
- TypeScript / Vite / 脚本共享的真实目录

它不是：

- 最终扩展包的直接源目录
- 运行时必须从磁盘直接读取的最终资源目录

当前打包流程只会从 `dist/build/chrome` 与 `dist/build/firefox` 取源，因此：

- `.flow-dock/` 中的文件若要进入最终扩展包，应通过正常 bundle 依赖链进入产物
- 或在构建阶段明确写入 `dist/build/*`
- 不应默认假设“根目录有文件，打包后就会存在”

## 对未来文件系统驱动的设计建议

文件系统能力也应遵循相同原则：

- 底层 driver 实现在 `package/`
- `.flow-dock/` 负责按上下文或环境选择 driver
- 业务代码只使用 `#flow-dock/fs`

建议优先考虑的接口形态：

- `#flow-dock/fs/background`
- `#flow-dock/fs/page`
- `#flow-dock/fs/content`

而不是一开始就强行抽象成一个过度统一的大接口。

## 自动导入策略

为了进一步隐藏底层包位置，建议把一部分 DSL 能力统一通过 `.flow-dock/imports.generated.ts` 暴露，再接入自动导入系统。

目标效果：

- 业务代码可以直接使用 `defineRouterHandle`、`defineSchemaHandle` 等能力
- 不需要显式 import `package/*`
- 未来即使底层包结构变化，业务代码依旧稳定

## 约束规则建议

为了防止边界被日常开发逐渐绕开，建议在 ESLint 或其他静态约束中加入规则：

- 业务目录下禁止直接 import `package/*`
- 业务目录只允许 import：
  - `#flow-dock/*`
  - 业务自身模块
  - 三方依赖

这样可以把“架构原则”变成“机器可校验规则”。

## 分阶段落地计划

建议按以下顺序实施。

### 阶段 1：先建立依赖边界

目标：不急着搬底层实现，先锁住业务依赖入口。

任务：

- 在 Vite 与 TypeScript 中建立 `#flow-dock/*` alias
- 实现最小化 `.flow-dock/` 生成
- 先生成 `server.ts`、`types.d.ts`、`imports.generated.ts` 等统一出口
- 让业务代码先改为依赖 `#flow-dock/*`

结果：

- 业务层的依赖方向先稳定下来
- 后续迁移底层实现时，业务侧无需重复改动

### 阶段 2：将稳定 runtime 真正迁入 `package/`

目标：让根目录逐步减少底层实现文件。

任务：

- 迁移 `server/driver/*`
- 迁移 `server/runtime/*`
- 提取 `server/router-dispatcher.ts` 中的通用 runtime 核心
- 调整 `.flow-dock/*` 的 re-export 指向 package 中的新实现

结果：

- `package/` 成为底层能力唯一真源
- `.flow-dock/` 继续作为隔离门面

### 阶段 3：生成 bootstrap 层

目标：将项目扫描与装配逻辑完全抽离出底层实现。

任务：

- 生成 router/middleware/plugin 的 bootstrap 文件
- 让入口只依赖 `.flow-dock/bootstrap/*`
- 将 `import.meta.glob(...)` 统一收敛到 `.flow-dock/`

结果：

- 项目装配逻辑与底层 runtime 正式分离

### 阶段 4：接入自动导入与规则约束

目标：提高业务开发体验并巩固边界。

任务：

- 自动导入 `.flow-dock/imports.generated.ts`
- 加入 lint 规则禁止业务直引 `package/*`
- 对模板态空目录场景做容错

结果：

- 业务层 API 更稳定、更简洁
- 架构边界更不容易被绕开

## 第一版最小落地建议

如果只做最小闭环，建议第一版先完成以下内容：

1. `flowDockKit()` 在开发与构建开始前确保 `.flow-dock/` 存在。
2. 插件生成最小文件：
   - `.flow-dock/server.ts`
   - `.flow-dock/types.d.ts`
   - `.flow-dock/imports.generated.ts`
3. 为 `.flow-dock/*` 注册稳定 alias，例如 `#flow-dock/*`。
4. 让业务层和入口层优先改用 `#flow-dock/*`。
5. 之后再逐步迁移底层实现到 `package/`。

这样可以先建立边界，再迁实现，避免迁移期间接口来回震荡。

## 结论

本项目建议采用以下总原则：

- **`package/` 是底层实现唯一真源**
- **`.flow-dock/` 是项目生成门面与装配层**
- **业务代码只依赖 `#flow-dock/*`，不直接依赖 `package/*`**

在这个模型下：

- 真正稳定的 driver/runtime 放进 `package/`
- 项目相关的扫描与装配生成到 `.flow-dock/`
- 业务层只看见统一门面
- 底层实现可以持续演进而不污染业务代码

这将使本仓库更接近一个可持续演进的“框架骨架 + 业务实现”架构，而不是把所有层都长期混放在根目录中。
