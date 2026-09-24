# 自托管部署：从 paperclipCN 源码运行

日期：2026-09-24

本文说明 `paperclipCN` 在维护者自托管实例上的运行方式和维护流程。实例相关的事实，包括备份、验证记录和凭据接线，以部署文档仓库
`paperclip-personal`（`DEPLOYMENT.md` §二十一）为准。本文只写与本仓库代码有关的部分。

## 当前部署

| 项 | 值 |
|---|---|
| 运行提交 | `0b4ee74a2`：在 `123dc016d` 基础上修正了 lockfile |
| 方式 | 从源码运行，没有 npm 包，也没有 managed install |
| 运行目录 | `~/paperclip-runtime/releases/<sha前9位>/`：独立 clone，已执行 `pnpm install --frozen-lockfile && pnpm build` |
| 当前版本 | `~/paperclip-runtime/current` 软链 |
| 入口 | `~/paperclip-runtime/bin/paperclipai` wrapper，由 user 级 systemd `paperclipai.service` 的 drop-in `ExecStart` 调用 |
| 模式 | `authenticated` / `private` / loopback，内嵌 PostgreSQL 18.1，前面用 nginx 做 TLS 反代 |

wrapper 的内容：

```sh
#!/bin/sh
APP="$HOME/paperclip-runtime/current"
export PAPERCLIP_UI_DEV_MIDDLEWARE="${PAPERCLIP_UI_DEV_MIDDLEWARE:-false}"
exec /usr/bin/node "$APP/cli/node_modules/tsx/dist/cli.mjs" "$APP/cli/src/index.ts" "$@"
```

## 与源码相关的注意点

- **必须显式设置 `PAPERCLIP_UI_DEV_MIDDLEWARE=false`**。`cli/src/commands/run.ts` 的
  `maybeEnableUiDevMiddleware()` 检测到入口是 `server/src/index.ts`，并且这个变量没有设置时，
  会自动启用 Vite 开发中间件。设为 `false` 后，`server/src/app.ts` 会回退到 `ui/dist`，
  启动横幅显示 `static-ui`。
- **版本号**：源码运行时 `paperclipai -V` 和 `/api/health` 的 `version` 都显示 `package.json`
  中的占位版本；`commit` 取自进程工作目录所在的 git 仓库，systemd 的工作目录是 `$HOME`，所以为 `null`。
  要确认实际运行的提交，看 `readlink ~/paperclip-runtime/current` 和
  `server/dist/build-info.json`。
- **构建依赖**：`pnpm build` 会构建 runner 的原生二进制，需要 `rust-toolchain.toml`
  指定版本的 `cargo` 在 PATH 里。
- **lockfile**：上游修改 `pnpm-workspace.yaml` 的 overrides 后，如果 lockfile 没有同步，
  `pnpm install --frozen-lockfile` 会报 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`。本 fork 的
  lockfile refresh 工作流是手动触发的（见 `doc/DEVELOPING.md` 的 Fork workflow policy），
  所以同步上游后要在本地按 overrides 执行 `pnpm install --no-frozen-lockfile`，检查 diff
  确认只涉及已声明的版本，然后单独提交。
- **工作流**：`cloud-migrator-artifacts`、`cloud-readiness` 虽然由 push 到 `master` 触发，
  但每个 job 都限定 `github.repository == 'paperclipai/paperclip'`，在 fork 中会直接跳过，
  所以不需要修改。
- **不要用 `pnpm deploy` 打独立包**：生成的包保留开发态 `exports`（指向 `src`），
  启动时会报找不到 `server/src/index.ts`。确实需要 npm 包时，参考 `scripts/release.sh`
  的构建和逐包打包步骤。

## 跟进上游与部署新版本

1. 在同步分支上合并上游 `master`，人工审核后再合入 fork `master`。重点检查三项：lockfile
   与 overrides 是否一致、上游是否把 fork 的手动工作流触发器改回去了、中文化和
   Codex `http_headers` 修复是否有冲突。
2. 记下合入后的**完整 SHA**。
3. 在服务器上执行（服务无需停止）：

   ```sh
   export PATH=$HOME/.cargo/bin:$PATH
   RT=~/paperclip-runtime; SHA=<完整 SHA>; D=$RT/releases/${SHA:0:9}
   PREV=$(readlink $RT/current)
   git clone -q --no-checkout git@github.com:robertchengzy/paperclipCN.git "$D"
   cd "$D" && git checkout -q "$SHA"
   ( pnpm install --frozen-lockfile && pnpm build ) > "$RT/build-${SHA:0:9}.log" 2>&1 && echo build ok
   git status --short; cat server/dist/build-info.json
   find node_modules/.pnpm -path '*@embedded-postgres+linux-arm64*/native/bin/postgres' -exec {} --version \;
   diff <(ls $PREV/packages/db/src/migrations | grep -E '^[0-9]{4}_') \
        <(ls $D/packages/db/src/migrations | grep -E '^[0-9]{4}_')
   ```

   `git status` 应该没有输出。`build-info.json` 里的 commit 应与 `$SHA` 相同。PG 大版本不能变。
   如果有新迁移或大的改动，先用独立的 `-d`、端口和 `PAPERCLIP_INSTANCE_ID` 起一个隔离实例验收。
4. 切换：

   ```sh
   paperclipai db:backup -c ~/.paperclip/instances/default/config.json --filename-prefix "pre-upgrade-$(basename $PREV)"
   systemctl --user stop paperclipai.service
   ln -sfn "$D" $RT/current.new && mv -T $RT/current.new $RT/current
   systemctl --user start paperclipai.service
   ```

   先停服务再切软链，避免运行中的进程在切换后加载到另一个版本的模块。
5. 验证：
   - 启动日志中能看到 `static-ui`，迁移结果正常，并且没有出现 BOARD CLAIM。
   - `paperclipai doctor` 和 `paperclipai health` 通过。
   - `NRestarts=0`。
   - 公网 HTTPS 返回 200，匿名请求被 403 拒绝，注册被禁止。

**回滚**：停止服务，把 `current` 指回 `$PREV`，再启动。如果新版本带有迁移，
还要先恢复 `pre-upgrade-*` 数据库备份。

**保留**：每个 release 目录约 3.9 GB，保留 `current` 和上一个版本即可。

**不要**：
- 在 `releases/*` 里改代码或执行 `git pull`。
- 把开发工作树当作现网运行目录。
- 运行 `paperclipai install` 或 `service install`：它们会重新生成 unit，覆盖 drop-in。
- 把 wrapper 放进 `~/.local/bin`：doctor 会把它误判为 managed install。
