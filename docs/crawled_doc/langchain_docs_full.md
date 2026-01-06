# LangGraph Full Documentation

## LangGraph Overview
[Original URL](https://docs.langchain.com/oss/python/langgraph/overview)

Gain control with LangGraph to design agents that reliably handle complex tasks.

### Install
```bash
pip install -U langgraph
```

### Quick Example
```python
from langgraph.graph import StateGraph, MessagesState, START, END

def mock_llm(state: MessagesState):
    return {"messages": [{"role": "ai", "content": "hello world"}]}

graph = StateGraph(MessagesState)
graph.add_node(mock_llm)
graph.add_edge(START, "mock_llm")
graph.add_edge("mock_llm", END)
graph = graph.compile()
graph.invoke({"messages": [{"role": "user", "content": "hi!"}]})
```

### Core Benefits
- **Durable execution**: Build agents that persist through failures and can run for extended periods, resuming from where they left off.
- **Human-in-the-loop**: Incorporate human oversight by inspecting and modifying agent state at any point.
- **Comprehensive memory**: Create stateful agents with both short-term working memory for ongoing reasoning and long-term memory across sessions.
- **Debugging with LangSmith**: Gain deep visibility into complex agent behavior with visualization tools.
- **Production-ready deployment**: Deploy sophisticated agent systems confidently with scalable infrastructure.

---

## Thinking in LangGraph
[Original URL](https://docs.langchain.com/oss/python/langgraph/thinking-in-langgraph)

### Start with the process you want to automate
Define the sequence of steps your agent should take. For example, an email agent might:
1. Read incoming email
2. Classify intent
3. Search documentation
4. Draft reply
5. Send reply

### Step 1: Map out your workflow as discrete steps
Break the process into clear, modular nodes.

### Step 2: Identify what each step needs to do
- **LLM steps**: Reasoning, classification, drafting.
- **Data steps**: Retrieval, API calls, database lookups.
- **Action steps**: Sending emails, updating tickets.
- **User input steps**: Human review, manual approval.

### Step 3: Design your state
Define what information needs to persist between nodes. Store raw data (emails, search results) rather than formatted text.
```python
from typing import TypedDict, Literal

class EmailClassification(TypedDict):
    intent: Literal["question", "bug", "billing", "feature", "complex"]
    urgency: Literal["low", "medium", "high", "critical"]
    topic: str
    summary: str

class EmailAgentState(TypedDict):
    email_content: str
    sender_email: str
    email_id: str
    classification: EmailClassification | None
    search_results: list[str] | None
    customer_history: dict | None
    draft_response: str | None
    messages: list[str] | None
```

### Step 4: Build your nodes
Implement the logic for each step. Each node is a function that receives state and returns updates.
```python
from langgraph.types import Command, interrupt

def classify_intent(state: EmailAgentState) -> Command:
    # Logic to classify email
    # ...
    return Command(update={"classification": results}, goto="next_node")

def human_review(state: EmailAgentState) -> Command:
    decision = interrupt({"action": "Please review this response"})
    # ...
    return Command(update={"draft_response": edited}, goto="send_reply")
```

---

## Workflows and Agents
[Original URL](https://docs.langchain.com/oss/python/langgraph/workflows-agents)

### Patterns
- **Prompt Chaining**: Linear sequence of LLM calls with checks between them.
- **Parallelization**: Running multiple nodes at once (e.g., generating multiple ideas or checking multiple sources).
- **Routing**: Using an LLM or logic to decide the next node based on state.
- **Orchestrator-Worker**: A central LLM plans subtasks and delegates to parallel workers, then synthesizes results.
- **Evaluator-Optimizer**: An LLM generates an output, another evaluates it, and they loop until quality is met.
- **Agents**: Dynamic loops where the LLM decides which tools to call and in what order until the task is complete.

---
*(Content continues...)*

---

## Durable Execution
[Original URL](https://docs.langchain.com/oss/python/langgraph/durable-execution)

### Requirements
1. Enable persistence with a checkpointer.
2. Specify a thread identifier.
3. Wrap non-deterministic operations in 'task'.

### Durability Modes
- 'sync': Persist before next step (safe, slower).
- 'async': Persist during next step (faster, minor crash risk).
- 'exit': Persist only on exit (best performance, no mid-run recovery).

---

## Streaming
[Original URL](https://docs.langchain.com/oss/python/langgraph/streaming)

### Modes
- 'values': Full state after each step.
- 'updates': Only state changes after each step.
- 'messages': LLM tokens/messages.
- 'custom': User-defined data.
- 'debug': Internal graph details.

---

## Interrupts (Human-in-the-loop)
[Original URL](https://docs.langchain.com/oss/python/langgraph/interrupts)

### Usage
- Use 'interrupt()' to pause.
- Use 'Command(resume=...)' to resume.
- Patterns: approve/reject, review/edit, validating input.

### Rules
- Do not wrap 'interrupt()' in try/except.
- Do not reorder 'interrupt()' calls.
- Side effects before interrupt must be idempotent.

---

## Time Travel
[Original URL](https://docs.langchain.com/oss/python/langgraph/use-time-travel)

### Features
- View previous states and checkpoints.
- Re-run from a specific point in time.
- Fork execution by updating state and resuming.

---

## Memory
[Original URL](https://docs.langchain.com/oss/python/langgraph/add-memory)

### Short-term Memory (Checkpointer)
- Persists state within a thread.
- Allows resuming from failures or interrupts.

### Long-term Memory (Store)
- Persists data across multiple threads/sessions.
- Use 'InMemoryStore' or database-backed stores.

---

## Subgraphs
[Original URL](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)

### Patterns
- Invoke a graph from a node.
- Add a graph as a node.
- Cross-graph state mapping.


---

## Deep Agents Overview
[Original URL](https://docs.langchain.com/oss/python/deepagents/overview)

### Core Capabilities
- **Planning & Task Decomposition**: Using 'write_todos' to manage complex workflows.
- **Context Management**: Using filesystem tools ('ls', 'read_file', 'write_file', 'edit_file') to handle large state.
- **Subagent Spawning**: Delegating tasks to specialized subagents using 'task'.

---

## Deep Agents Quickstart
[Original URL](https://docs.langchain.com/oss/python/deepagents/quickstart)

### Installation
'pip install deepagents tavily-python'

### Basic Usage
1. Define tools (e.g., Tavily search).
2. Create an agent using 'create_deep_agent'.
3. Run with 'agent.invoke'.

---

## Deep Agents Middleware
[Original URL](https://docs.langchain.com/oss/python/deepagents/middleware)

### Key Middleware
- **TodoListMiddleware**: Manages the agent's internal plan and task list.
- **FilesystemMiddleware**: Provides sandboxed filesystem access for context.
- **SubAgentMiddleware**: Automates the creation and management of subagents.

---

## Customize Deep Agents
[Original URL](https://docs.langchain.com/oss/python/deepagents/customization)

### Customization Points
- **Model**: Swap the underlying LLM.
- **System Prompt**: Steering agent behavior and persona.
- **Tools**: Adding domain-specific functionality.


---

## LangSmith Observability
[Original URL](https://docs.langchain.com/langsmith/observability)

### Key Features
- **Tracing**: Access and manage traces via UI or API.
- **Monitoring**: dashboards and alerts for performance tracking.
- **Automations**: Rules, webhooks, and online evaluations.
- **Feedback Loop**: Collect and manage annotations and user feedback.

---

## LangSmith Evaluation
[Original URL](https://docs.langchain.com/langsmith/evaluation)

### Workflow
- **Datasets**: Create and manage datasets for testing.
- **Evaluators**: Use Human review, Code rules, or LLM-as-judge.
- **Experiments**: Run offline evaluations and analyze results.
- **Online Evaluation**: Monitor production quality in real-time.

---

## Prompt Engineering (Prompt Hub)
[Original URL](https://docs.langchain.com/langsmith/prompt-engineering)

### Features
- **Prompt Hub**: Discover and share community prompts.
- **Playground**: Test and experiment with prompts in a web interface.
- **Management**: Organize prompts with tags and version control.

---

## LangGraph Deployment
[Original URL](https://docs.langchain.com/oss/python/langgraph/deploy)

### Steps
1. Create a GitHub repository for your agent.
2. Link the repository in LangSmith Deployment.
3. Test your application in the hosted Studio.
4. Access the agent via the provided API URL.


---

## LangChain Expression Language (LCEL)
[Original URL](https://docs.langchain.com/oss/python/langchain/overview)

### Core Concepts
- **Runnables**: Standardized protocol for taking input and returning output ('invoke', 'stream', 'batch').
- **Pipe Operator (|)**: Compose components into chains (e.g., 'prompt | model | parser').
- **Fallback & Retries**: built-in mechanisms for error handling in chains.

---

## Memory
[Original URL](https://docs.langchain.com/oss/python/concepts/memory)

### Types of Memory
- **Short-term Memory**: Persists messages within a single conversation/thread.
- **Long-term Memory**: Persists information across different threads or sessions.
- **Semantic Memory**: Using embeddings and vector stores to retrieve relevant past experiences.

---

## State Management
[Original URL](https://docs.langchain.com/oss/python/langgraph/persistence)

### Implementation
- **Checkpointers**: Save and restore the state of a graph at any point.
- **Threads**: Unique identifiers used to track and resume specific execution contexts.
- **Functional API State**: Using 'entrypoint' and 'task' to manage state in a more imperative style.

