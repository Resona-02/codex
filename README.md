# SVG 命令行编辑器

高级软件开发 Lab1 Phase 1。使用 TypeScript、Command 模式和 Composite 模式实现。

## 安装与运行

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run cli
```

启动后出现 `svg>` 提示符。例如：

```text
init 800 600
create g scene
create rect r1 10 20 100 50 #4a90d9 in scene
create text t1 20 50 "你好 SVG" in scene
move scene 20 0
undo
tree
save demo.svg
```

输入 `help` 查看全部命令；按 `Ctrl+D` 结束。保存的 SVG 可直接用浏览器打开。

## 示例与验证

```sh
npm run cli < examples/flowchart.commands
npm run cli < examples/session.commands
npm run check
npm test
```

流程图脚本生成 [examples/flowchart.svg](examples/flowchart.svg)。典型会话脚本包含两条预期失败命令，用于演示错误处理和保存后的撤销屏障。

测试涵盖领域模型、全部编辑命令的撤销与重做、SVG 读写、CLI 回放及架构规则。GitHub Actions 会在推送后执行相同验证。

## 代码从哪里看

- 看 Command 模式：从 `src/application/EditCommand.ts`、`History.ts` 和 `MoveCommand.ts` 开始。
- 看面向对象图形与组合树：从 `src/domain/Shape.ts`、`Rect.ts` 和 `Group.ts` 开始。
- 看命令输入：从 `src/cli/CommandDispatcher.ts` 开始，业务行为继续进入对应命令类。
- 看 SVG 文件读写：从 `src/infrastructure/SvgCodec.ts` 和 `SvgFileStore.ts` 开始。

完整的模块图、设计理由、行为约定、协作记录和验收说明见 [doc/README.md](doc/README.md)。原始要求见 [phase_cli_1.md](phase_cli_1.md)。

## 本阶段边界

支持 `rect`、`circle`、`ellipse`、`line`、`text`、`g`；`box` 和插件加载留待后续阶段。外部 SVG 的字体、变换和内联样式会保留，但不实现完整 SVG/CSS 引擎；涉及无法安全保留外观的解组或属性修改会明确报错，详情见架构文档。
