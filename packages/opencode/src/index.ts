import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import type { Argv, CommandBuilder } from "yargs"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { EOL } from "os"
import { errorMessage } from "./util/error"
import { cmd } from "./cli/cmd/cmd"

type CommandLike = {
  builder?: CommandBuilder<Record<string, unknown>, unknown>
  handler?: (args: never) => unknown
}

type LazyCommand = {
  command: string
  describe: string | false
  exportName: string
  aliases?: string[]
  load: () => Promise<unknown>
}

// Commands load on demand so `--version`, `--help`, and completion skip the
// effect, provider, and SDK module graph.
function lazyCommand(input: LazyCommand) {
  const entry = async () => ((await input.load()) as Record<string, CommandLike | undefined>)[input.exportName]

  return cmd({
    command: input.command,
    describe: input.describe,
    aliases: input.aliases,
    builder: async (yargs) => {
      const builder = (await entry())?.builder
      if (!builder) return yargs
      if (typeof builder === "function") return (await builder(yargs)) as Argv
      return yargs.options(builder)
    },
    async handler(args) {
      await (await entry())?.handler?.(args as never)
    },
  })
}

const commands: LazyCommand[] = [
  {
    command: "acp",
    describe: "start ACP (Agent Client Protocol) server",
    exportName: "AcpCommand",
    load: () => import("./cli/cmd/acp"),
  },
  {
    command: "mcp",
    describe: "manage MCP (Model Context Protocol) servers",
    exportName: "McpCommand",
    load: () => import("./cli/cmd/mcp"),
  },
  {
    command: "$0 [project]",
    describe: "start opencode tui",
    exportName: "TuiThreadCommand",
    load: () => import("./cli/cmd/tui"),
  },
  {
    command: "attach <url>",
    describe: "attach to a running opencode server",
    exportName: "AttachCommand",
    load: () => import("./cli/cmd/attach"),
  },
  {
    command: "run [message..]",
    describe: "run opencode with a message",
    exportName: "RunCommand",
    load: () => import("./cli/cmd/run"),
  },
  { command: "generate", describe: false, exportName: "GenerateCommand", load: () => import("./cli/cmd/generate") },
  {
    command: "debug",
    describe: "debugging and troubleshooting tools",
    exportName: "DebugCommand",
    load: () => import("./cli/cmd/debug"),
  },
  { command: "console", describe: false, exportName: "ConsoleCommand", load: () => import("./cli/cmd/account") },
  {
    command: "providers",
    describe: "manage AI providers and credentials",
    exportName: "ProvidersCommand",
    aliases: ["auth"],
    load: () => import("./cli/cmd/providers"),
  },
  { command: "agent", describe: "manage agents", exportName: "AgentCommand", load: () => import("./cli/cmd/agent") },
  {
    command: "upgrade [target]",
    describe: "upgrade opencode to the latest or a specific version",
    exportName: "UpgradeCommand",
    load: () => import("./cli/cmd/upgrade"),
  },
  {
    command: "uninstall",
    describe: "uninstall opencode and remove all related files",
    exportName: "UninstallCommand",
    load: () => import("./cli/cmd/uninstall"),
  },
  {
    command: "serve",
    describe: "starts a headless opencode server",
    exportName: "ServeCommand",
    load: () => import("./cli/cmd/serve"),
  },
  {
    command: "web",
    describe: "start opencode server and open web interface",
    exportName: "WebCommand",
    load: () => import("./cli/cmd/web"),
  },
  {
    command: "models [provider]",
    describe: "list all available models",
    exportName: "ModelsCommand",
    load: () => import("./cli/cmd/models"),
  },
  {
    command: "stats",
    describe: "show token usage and cost statistics",
    exportName: "StatsCommand",
    load: () => import("./cli/cmd/stats"),
  },
  {
    command: "export [sessionID]",
    describe: "export session data as JSON",
    exportName: "ExportCommand",
    load: () => import("./cli/cmd/export"),
  },
  {
    command: "import <file>",
    describe: "import session data from JSON file or URL",
    exportName: "ImportCommand",
    load: () => import("./cli/cmd/import"),
  },
  {
    command: "github",
    describe: "manage GitHub agent",
    exportName: "GithubCommand",
    load: () => import("./cli/cmd/github"),
  },
  {
    command: "pr <number>",
    describe: "fetch and checkout a GitHub PR branch, then run opencode",
    exportName: "PrCommand",
    load: () => import("./cli/cmd/pr"),
  },
  {
    command: "session",
    describe: "manage sessions",
    exportName: "SessionCommand",
    load: () => import("./cli/cmd/session"),
  },
  {
    command: "plugin <module>",
    describe: "install plugin and update config",
    exportName: "PluginCommand",
    aliases: ["plug"],
    load: () => import("./cli/cmd/plug"),
  },
  { command: "db", describe: "database tools", exportName: "DbCommand", load: () => import("./cli/cmd/db") },
]

const args = hideBin(process.argv)

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("fuckcode ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("fuckcode")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }

    const { Heap } = await import("./cli/heap")
    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)
  })
  .usage("")
  .completion("completion", "generate shell completion script")

for (const command of commands) cli.command(lazyCommand(command))

cli
  .fail(async (msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      show(await cli.getHelp())
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  if ((args[0] === "-v" || args[0] === "--version") && args.length === 1) {
    process.stdout.write(InstallationVersion + EOL)
  } else if ((args[0] === "-h" || args[0] === "--help") && args.length === 1) {
    show(await cli.getHelp())
  } else {
    await cli.parse()
  }
} catch (e) {
  // Loaded lazily: it pulls the Effect runtime, which the happy path does not need.
  const { FormatError } = await import("./cli/error")
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
