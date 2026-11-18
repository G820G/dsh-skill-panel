# dsh-skill-panel

[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-3f6ae0)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：把已安装的**技能**放到你顺手的位置——左侧面板的技能页，以及对话框加号旁的技能选择按钮。

![左侧面板的技能页面，以及从对话框打开的技能列表](docs/preview.svg)

## 新增了什么

**左侧栏 → 技能。** 星形图标与 Plugins、Schedules 并排。页面列出当前对话可以调用的全部技能：

- `/名称`、描述、以及额外的适用场景说明；
- 带 **仅你可用** 标记的 `disable-model-invocation` 技能——模型看不到、只能由你手动发起的那些；
- 可按名称、描述、场景筛选的输入框，以及刷新按钮；
- 每行一个眼睛按钮，在右侧边栏打开该技能的 `SKILL.md`。

**对话框 → 技能选择按钮。** 输入框工具行里、加号与权限控件右侧新增一个 28px 星形按钮。点开是技能列表，选中后把 `/名称 ` 插入到**草稿开头**，与手动输入等效。按钮会反映列表展开状态（`aria-expanded`）、发送过程中自动禁用，用键盘激活时会把焦点交还编辑器。

插件不会替你发送任何东西：选择只修改草稿，技能由宿主在你发送时加载——和手打 `/名称` 完全一致。

## 安装

本包是一个 DSH **bundle**（`dsh.bundle.patch`），会像其他插件一样出现在 **Plugins** 里。

**从 GitHub 安装。** 在 DSH 会话里让智能体用 `github:G820G/dsh-skill-panel` 安装（它的 `plugin_manager` 工具接受 Git spec）。想固定版本就带上完整 40 位提交：`github:G820G/dsh-skill-panel#<sha>`。

**从本地目录安装。** 克隆仓库后，用 **Plugins → Add plugin** 选择该目录。目录安装是链接形式，之后改动无需重装即可生效。

```sh
git clone https://github.com/G820G/dsh-skill-panel.git
```

**要求。** DeepSeek Harness `>=0.2.2-rc.3 <0.3.0`（见 `engines.dsh`），并运行 Web GUI。无需构建、无运行时依赖：浏览器半侧是 Web 客户端直接加载的纯 JavaScript。

## 兼容性

| DSH 版本 | 状态 |
|---|---|
| `0.2.2-rc.3` | 兼容 —— 构建与验证所用的版本 |

插件只使用公开扩展点（`sidebar.panellist`、`main` 面板、`conversation.input.left`、`skills/list` Remote、以及输入触发器的 launcher）。将来 DSH 若重命名其中某个，最多让某一个界面降级，而不会拖垮应用；`dsh.compatibility.dshReleases` 记录实际验证过的版本。

## 工作原理

- 列表直接来自宿主自己的目录：主视图当前会话的 `skills/list`，因此与 `/` 菜单完全一致，也不会和已安装技能脱节。
- 选择按钮没有自建列表，而是通过输入触发器 launcher 打开宿主 `/` 菜单里宿主自带的 `skill` 分组，所以一次选择走的是与手打 `/名称` 相同的管线——只落地纯文本，没有私有插入路径。
- 宿主的内置加号绑定在菜单的*命令*分组上，插件无法往里追加行，因此选择按钮做成同一工具行里的兄弟控件，而不是那个菜单里的一行。
- `remote.skills` 是受保护的 Client Remote 命名空间：插件在 `inject` 中声明 `remote` 与 `remote.skills`，并在 apply 期间取到命名空间句柄，与宿主自带的技能 UI 做法一致。

## 已知限制

- 技能目录属于**当前打开会话**的智能体组合，因此必须先打开一个对话；没有会话时页面会说明如何开始。
- 无论技能提供方是否给出文件路径都可列出、可插入，但只有带路径的技能才有预览按钮。
- 页面是只读的：不安装、不禁用、不排序技能——那些属于插件/技能提供方。
- 选择按钮只是一个启动器，不替代输入框：它把文本插到消息开头，因为宿主只识别开头的 `/名称`。

## 仓库结构

```
client.js          全部浏览器逻辑（React.createElement，无需构建）
index.js           宿主半侧（空：所有界面都在客户端）
cordis.patch.yml   插入插件行的 bundle patch
locale/            插件管理页的标题、描述、详情文档路径
docs/              详情文档及其插图
icon.svg           插件图标
```

## 开发

没有打包器。直接改 `client.js`、保持是合法的纯 JavaScript，运行中的 Web 客户端会通过客户端插件 HMR 加载新模块（万一某次改动看起来没生效，刷新页面即可）：

```sh
node --check client.js
```

目录链接安装（见「安装」）是最快的循环：存盘，看面板。

## 许可证

[MIT](LICENSE)
