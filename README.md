# SVG 命令行编辑器 · Lab1 Phase 1

使用 **TypeScript + 面向对象 + Command + Composite** 实现的 SVG 编辑器。通过命令创建和编辑图形，支持嵌套容器、撤销重做、SVG 文件读写及脚本回放。

- [课程要求原文](doc/requirements.md)
- [架构方案、开发过程、一致性自查与质量保证](doc/README.md)
- [PlantUML 架构图源文件](doc/architecture.puml)
- 私有仓库：`zhangshao04/lab1-svg-cli`
- 提交截止日期：2026 年 10 月 30 日；最终交付版本使用 `final` 标签。

## 启动与测试

需要 Node.js 22 或以上、npm；实际验证环境为 Windows、Node.js 24.14.1。唯一运行时依赖 `@xmldom/xmldom` 用于 XML 解析与转义，编辑逻辑由本工程实现。依赖精确版本已写入锁文件。

在项目目录执行：

```bash
npm ci
npm test
npm run cli
```

当前工作目录决定相对文件路径。出现 `svg>` 后输入：

```text
init 800 600
create g scene
create rect r1 30 70 120 60 #4a90d9 in scene
create text title 55 105 "你好 SVG" in scene
move scene 40 0
undo
redo
tree
save demo.svg
```

将生成的 `demo.svg` 拖入浏览器即可查看。`help` 显示命令语法。退出时 Windows 按 Ctrl+Z 后回车，macOS/Linux 按 Ctrl+D，也可以按 Ctrl+C。

## 回放作业案例

```bash
npm run cli -- --script examples/flowchart.txt
```

输出为 [examples/flowchart.svg](examples/flowchart.svg)。脚本逐行执行，忽略空行和以 `#` 开头的注释行；双引号包裹带空格的文字或路径。十六进制颜色中的 `#` 不会被当成行内注释。

批处理遇到错误会继续执行下一行，最终退出码为 1；全部成功为 0。也支持标准输入。构建后可直接运行 `node dist/src/main.js`，避免重复编译。

![浏览器预览：流程图及 SVG 变换往返](doc/svg-preview.png)

## 命令速查

| 类别 | 命令 |
| --- | --- |
| 文档 | `init [w] [h]`、`read <file.svg>`、`save [file.svg]`、`canvas [w h]` |
| 创建 | `create <type> <id> [params...] [in <containerId>]` |
| 编辑 | `delete <id>`、`move <id> <dx> <dy>`、`scale <id> <factor>`、`set <id> <attr> <value>` |
| 组合 | `group <newGid> <id1> [id2...]`、`ungroup <gid>`、`addto <gid> <id>` |
| 层叠 | `front <id>`、`back <id>` |
| 显示 | `tree [id]`、`show <id>`、`help` |
| 历史 | `undo`、`redo` |

| 图形类型 | create 中 ID 后的参数 |
| --- | --- |
| `rect` | `<x> <y> <width> <height> [fill]` |
| `circle` | `<cx> <cy> <r> [fill]` |
| `ellipse` | `<cx> <cy> <rx> <ry> [fill]` |
| `line` | `<x1> <y1> <x2> <y2> [stroke]` |
| `text` | `<x> <y> "content"` |
| `g` | 无；可接 `in <containerId>` 创建嵌套组 |

所有类型均支持 `in` 后缀。ID 唯一且大小写敏感，不能为空或包含空白。数值必须有限；几何尺寸可为 0，画布尺寸和缩放因子必须大于 0。

`set` 只允许 `fill`、`stroke`、`stroke-width`，以及各类型的几何属性；文字内容使用 `set <id> text "内容"`。组的颜色遵循 SVG 继承规则，不覆盖子图形已有的显式颜色。

## 需要了解的行为

- 一次编辑对应一个撤销单元。失败命令不改变文档、历史和保存路径；undo 后的成功新编辑清空 redo。
- 成功执行 init/read/save/canvas 修改尺寸会清空历史并禁止 undo/redo，直到下一条成功编辑。canvas 查询、tree、show、help 不影响历史。
- save 无参数使用最近一次成功 read/save 的路径；新建且从未保存的文档须先提供路径。
- scale 以坐标原点为基准，同时缩放位置和尺寸；CLI scale 不修改字号和描边宽度。move/scale 对容器递归作用于全部子孙。
- group 保留文档中的相对顺序。同父级的新组占据第一个选中元素的位置，跨父级的新组放在画布末尾。ungroup 按要求禁止解散根级容器。
- front 放到同级 SVG 子节点末尾，视觉上位于最前；back 放到开头。
- 连接线是独立图形，不会在移动节点后自动重新连接。

## SVG 支持范围

支持本阶段六种元素、普通属性和纯文字。保存保持层级、绘制顺序、ID 及显式样式；读取缺失 ID 时自动补齐并输出警告。保留 `viewBox`、常用文字和描边属性以及 `data-*` 标记。

额外支持导入正向等比 `scale` 与 `translate` 的嵌套变换，并将其折算为几何坐标；[examples/transforms.svg](examples/transforms.svg) 来自需求背景案例。未安装 box 插件时，`g data-kind="box"` 作为普通组读取，`create box` 按本阶段要求报未知类型。

不实现路径、滤镜、渐变、CSS 样式表、`use`、嵌套 `tspan`、旋转、斜切、非等比缩放、百分比几何单位或插件加载。遇到不支持的元素、属性和变换会明确报错，不静默丢弃。XML 注释和声明不作为图形保存。

## 验证与交付

`npm test` 包含严格类型检查和 27 项测试，覆盖六种图形、全部编辑命令、层级顺序、撤销重做、错误原子性、数值精度、SVG 往返和真实 CLI 子进程。架构检查同时约束模块依赖、一类一文件和禁止 switch 分派。

查看开发历史：`git log --oneline`。查看最终交付：`git show final`。后续修改已交付版本时，应按课程提交要求管理新提交和标签，不应随意覆盖远程标签。
