# Start LangGraph Studio

Start LangGraph Studio for visual debugging and graph visualization of the Manda agent workflows.

## Instructions

1. **Kill any existing dev servers on port 3000** (LangGraph Studio uses port 2024)

2. **Start LangGraph Studio CLI** in the manda-app directory:
   ```bash
   cd manda-app && npx @langchain/langgraph-cli@latest dev
   ```

3. **Report the Studio URL** to the user:
   - API: `http://localhost:2024`
   - Studio UI: `https://eu.smith.langchain.com/studio?baseUrl=http://localhost:2024`

4. **Keep the server running in background** so the user can interact with Studio

## What LangGraph Studio Provides

- **Graph Visualization** - See nodes, edges, and flow of agent workflows
- **Execution Tracking** - Watch which nodes run and in what order
- **State Inspection** - Examine agent state at each step
- **Time-Travel Debugging** - Replay from checkpoints
- **Hot Reload** - Code changes reflect immediately

## Available Graphs

The following graphs are configured in `langgraph.json`:
- **chat** - The main ReAct chat agent (`lib/agent/graph.ts:chatGraph`)

## Troubleshooting

- If port 2024 is already in use, kill the existing process: `lsof -ti:2024 | xargs kill -9`
- If you see TypeScript errors, they're usually non-blocking warnings
- Make sure `.env.local` has valid `LANGSMITH_API_KEY` for authentication

## Execute Now

Start LangGraph Studio and provide the URL.
