/**
 * Chat Agent Graph Export for LangGraph Studio
 *
 * This file exports the compiled chat agent graph for visualization
 * and debugging in LangGraph Studio.
 *
 * Story: E12.11 - LangSmith Observability
 *
 * Usage:
 *   npx @langchain/langgraph-cli@latest dev
 *
 * This creates a pre-configured agent that can be visualized in Studio.
 * The graph shows the ReAct agent loop: LLM → Tool → LLM → ...
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { createLLMClient } from '@/lib/llm/client'
import { allChatTools } from './tools/all-tools'
import { getSystemPrompt } from './prompts'

/**
 * Compiled chat agent graph for LangGraph Studio
 *
 * This is a pre-built ReAct agent that:
 * 1. Takes user messages
 * 2. Decides whether to call tools or respond
 * 3. If tools needed, calls them and loops back
 * 4. Returns final response when done
 */
export const chatGraph = createReactAgent({
  llm: createLLMClient(),
  tools: allChatTools,
  messageModifier: getSystemPrompt(),
})
