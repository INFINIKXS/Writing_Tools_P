# Experience: Installed and Verified @21st-dev/magic Magic MCP Server

**Date**: 2026-06-01
**Tags**: #MCP #magic #npx #ajv #Windows #mcp_config

## 🔴 Problem
When attempting to install and run the `@21st-dev/magic` MCP server using standard `npx` on Windows:
1. Standard CLI nested-quote escaping inside PowerShell resulted in JSON parsing errors by the CLI configuration parser.
2. Dynamically fetching the package via `npx` on Node 24 caused a runtime crash with `Cannot find module 'ajv'` inside the isolated `_npx` cache directory due to an unresolved peer dependency.

## 🔄 Attempts
- Tried using standard `code --add-mcp` with nested escaped quotes directly in PowerShell, which failed due to PowerShell parsing and stripping double-quotes.
- Tried running the server using dynamically resolved `npx` in a custom PowerShell runner script, which hung due to PowerShell stream redirection blockages on cmd-wrapped node runners.
- Tried checking output log, which revealed the peer dependency module crash.

## ✅ Solution
We implemented a complete and highly optimized direct-execution setup:

1. **Escaped CLI Invocation via batch script**:
   We bypassed PowerShell's double-quote stripping by wrapping the registration command inside a classic `.bat` script executed with `cmd /c`:
   ```cmd
   code --add-mcp "{\"name\":\"magic\",\"type\":\"stdio\",\"command\":\"npx\",\"args\":[\"-y\",\"@21st-dev/magic@latest\"],\"env\":{\"API_KEY\":\"be75e7e9d0e54b11d5da56ba45d67adda9766b7d7e8c57ae3e2c690ccc52c6dd\"}}"
   ```
   This successfully registered the server in the configuration system.

2. **Global Module Resolution**:
   To resolve the isolated cache dependency issue (`Cannot find module 'ajv'`), we globally installed the peer dependency `ajv` and the `@21st-dev/magic` package via npm:
   ```cmd
   npm install -g ajv @21st-dev/magic@latest
   ```

3. **Direct Executable Path Configuration**:
   We verified that the globally installed `magic` binary outputs valid JSON-RPC logging messages on start. We then updated [mcp_config.json](file:///C:/Users/Paradox-Labs/.gemini/antigravity/mcp_config.json) to directly execute the global command instead of `npx`:
   ```json
   "magic": {
     "command": "magic",
     "args": [],
     "env": {
       "API_KEY": "be75e7e9d0e54b11d5da56ba45d67adda9766b7d7e8c57ae3e2c690ccc52c6dd"
     }
   }
   ```

## 💡 Key Takeaway
On Windows environments with Node 24+, dynamic package runner commands like `npx` are prone to parent-shell quote parsing errors, stream hang blockages on redirection, and runtime peer-dependency resolution failures. Installing packages globally and referencing their registered binary command directly in the MCP configurations provides maximum performance, absolute startup reliability, and zero runtime launch overhead.
