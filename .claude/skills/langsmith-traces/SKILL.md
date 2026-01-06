---
name: langsmith-traces
description: Fetch and analyze LangSmith traces for the manda-platform project. Use when the user asks about traces, token usage, LLM costs, latency, or wants to debug agent performance.
---

# LangSmith Traces

Fetch and analyze recent traces from LangSmith to understand token usage, latency, costs, and agent behavior.

## Configuration

- **Project**: manda-platform
- **Session ID**: 608360fb-43bd-4d77-a5b4-3e42271f3fb7
- **API Endpoint**: https://eu.api.smith.langchain.com
- **Dashboard**: https://eu.smith.langchain.com

## Instructions

### Fetch Recent Traces

Run the script at [scripts/fetch-traces.sh](scripts/fetch-traces.sh) to get the last 10 traces:

```bash
bash .claude/skills/langsmith-traces/scripts/fetch-traces.sh
```

### Fetch with Custom Limit

```bash
bash .claude/skills/langsmith-traces/scripts/fetch-traces.sh 20
```

### Analyze a Specific Run

To get detailed information about a specific run, use the run ID:

```bash
bash .claude/skills/langsmith-traces/scripts/get-run.sh <run-id>
```

### Get Child Runs (Tool Calls, LLM Steps)

```bash
bash .claude/skills/langsmith-traces/scripts/get-children.sh <trace-id>
```

## Key Metrics to Watch

| Metric | Good | Warning | Action |
|--------|------|---------|--------|
| **Time to First Token** | < 2s | > 5s | Check model, reduce context |
| **Input Tokens** | < 5k | > 10k | Reduce system prompt, tools |
| **Cache Hit Rate** | > 80% | < 50% | Ensure stable prompts |
| **Reasoning Tokens** | 0 | > 1k | Consider non-reasoning model |
| **Cost per Request** | < $0.01 | > $0.05 | Optimize token usage |

## Interpreting Results

### Token Breakdown
- **Input tokens**: System prompt + tools + history + user message
- **Output tokens**: Model response (visible + reasoning)
- **Cache read**: Tokens served from OpenAI's prompt cache (cheaper)
- **Reasoning**: Internal "thinking" tokens (o1/o3 models)

### Common Issues

1. **High TTFT (Time to First Token)**
   - Cause: Large context, reasoning models
   - Fix: Reduce system prompt, use gpt-4o-mini

2. **High Input Tokens**
   - Cause: Too many tools, long history
   - Fix: Reduce tool count, summarize history

3. **Low Cache Hit**
   - Cause: Dynamic system prompts
   - Fix: Keep static content at prompt start
