#!/usr/bin/env npx tsx
/**
 * Interactive CIM MVP Test Script
 *
 * Run with: npm run test:cim-chat
 *
 * This script allows you to test the CIM MVP agent interactively
 * by typing messages and seeing responses in real-time.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as readline from 'readline'

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
}

// Load environment variables
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          process.env[key] = value
        }
      }
    }
    return true
  } catch {
    return false
  }
}

// Types (imported dynamically below)
type WorkflowStage = 'welcome' | 'buyer_persona' | 'hero_concept' | 'investment_thesis' | 'outline' | 'building_sections' | 'complete'

interface ConversationState {
  messages: unknown[]
  workflowProgress?: {
    currentStage: WorkflowStage
    completedStages: WorkflowStage[]
    sectionProgress: Record<string, unknown>
  }
  knowledgeLoaded?: boolean
  companyName?: string
  buyerPersona?: {
    type: string
    motivations?: string[]
    concerns?: string[]
  }
  heroContext?: {
    selectedHero: string
    investmentThesis?: {
      asset?: string
      timing?: string
      opportunity?: string
    }
  }
  cimOutline?: {
    sections: Array<{ title: string; description: string }>
  }
}

async function main() {
  console.log(`${colors.bold}${colors.cyan}`)
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║           CIM MVP Interactive Test Script                  ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(colors.reset)

  // Load env FIRST
  console.log(`${colors.dim}Loading environment...${colors.reset}`)
  const envLoaded = loadEnv()
  if (envLoaded) {
    console.log(`${colors.green}✓ Loaded .env.local${colors.reset}`)
  } else {
    console.log(`${colors.yellow}⚠ Could not load .env.local${colors.reset}`)
  }

  // Check for required API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`${colors.red}✗ ANTHROPIC_API_KEY not found in environment${colors.reset}`)
    console.log(`${colors.dim}  Make sure .env.local contains ANTHROPIC_API_KEY=sk-...${colors.reset}`)
    process.exit(1)
  }
  console.log(`${colors.green}✓ ANTHROPIC_API_KEY found${colors.reset}`)

  // NOW import the modules (after env is set)
  console.log(`${colors.dim}Loading CIM MVP modules...${colors.reset}`)

  const { HumanMessage, AIMessage } = await import('@langchain/core/messages')
  const { loadKnowledge, clearKnowledgeCache } = await import('../lib/agent/cim-mvp/knowledge-loader')
  const { createCIMMVPGraph } = await import('../lib/agent/cim-mvp/graph')

  // State to track conversation
  let conversationState: ConversationState = {
    messages: [],
    workflowProgress: {
      currentStage: 'welcome',
      completedStages: [],
      sectionProgress: {},
    },
    knowledgeLoaded: false,
  }

  const threadId = `test-${Date.now()}`

  // Load test knowledge
  const knowledgePath = resolve(process.cwd(), 'data', 'test-company', 'knowledge.json')
  console.log(`${colors.dim}Loading knowledge from: ${knowledgePath}${colors.reset}`)

  try {
    const knowledge = await loadKnowledge(knowledgePath)
    conversationState.knowledgeLoaded = true
    conversationState.companyName = knowledge.metadata.company_name
    console.log(`${colors.green}✓ Loaded knowledge for: ${knowledge.metadata.company_name}${colors.reset}`)
    console.log(`${colors.dim}  Documents: ${knowledge.metadata.documents.length}, Score: ${knowledge.metadata.data_sufficiency_score}/100${colors.reset}`)
  } catch (err) {
    console.log(`${colors.yellow}⚠ No knowledge file found - running without knowledge${colors.reset}`)
  }

  // Create the graph
  console.log(`${colors.dim}Creating CIM MVP graph...${colors.reset}`)
  const graph = createCIMMVPGraph()
  console.log(`${colors.green}✓ Graph ready${colors.reset}\n`)

  // Instructions
  console.log(`${colors.bold}Commands:${colors.reset}`)
  console.log(`  ${colors.cyan}/state${colors.reset}    - Show current workflow state`)
  console.log(`  ${colors.cyan}/persona${colors.reset}  - Show buyer persona`)
  console.log(`  ${colors.cyan}/hero${colors.reset}     - Show hero concept & thesis`)
  console.log(`  ${colors.cyan}/outline${colors.reset}  - Show CIM outline`)
  console.log(`  ${colors.cyan}/reset${colors.reset}    - Reset conversation`)
  console.log(`  ${colors.cyan}/quit${colors.reset}     - Exit`)
  console.log(`\n${colors.dim}Type a message to send to the agent...${colors.reset}\n`)
  console.log('─'.repeat(60))

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  function handleCommand(cmd: string) {
    switch (cmd.toLowerCase()) {
      case '/state':
        console.log(`\n${colors.bold}${colors.cyan}Workflow State:${colors.reset}`)
        console.log(`  Stage: ${colors.yellow}${conversationState.workflowProgress?.currentStage}${colors.reset}`)
        console.log(`  Completed: ${conversationState.workflowProgress?.completedStages?.join(', ') || 'none'}`)
        console.log(`  Knowledge: ${conversationState.knowledgeLoaded ? colors.green + 'loaded' : colors.yellow + 'not loaded'}${colors.reset}`)
        if (conversationState.companyName) {
          console.log(`  Company: ${conversationState.companyName}`)
        }
        break

      case '/persona':
        console.log(`\n${colors.bold}${colors.cyan}Buyer Persona:${colors.reset}`)
        if (conversationState.buyerPersona) {
          console.log(`  Type: ${conversationState.buyerPersona.type}`)
          console.log(`  Motivations: ${conversationState.buyerPersona.motivations?.join(', ')}`)
          console.log(`  Concerns: ${conversationState.buyerPersona.concerns?.join(', ')}`)
        } else {
          console.log(`  ${colors.dim}Not defined yet${colors.reset}`)
        }
        break

      case '/hero':
        console.log(`\n${colors.bold}${colors.cyan}Hero Concept & Thesis:${colors.reset}`)
        if (conversationState.heroContext) {
          console.log(`  Hero: ${conversationState.heroContext.selectedHero}`)
          console.log(`  Thesis:`)
          console.log(`    Asset: ${conversationState.heroContext.investmentThesis?.asset || 'TBD'}`)
          console.log(`    Timing: ${conversationState.heroContext.investmentThesis?.timing || 'TBD'}`)
          console.log(`    Opportunity: ${conversationState.heroContext.investmentThesis?.opportunity || 'TBD'}`)
        } else {
          console.log(`  ${colors.dim}Not defined yet${colors.reset}`)
        }
        break

      case '/outline':
        console.log(`\n${colors.bold}${colors.cyan}CIM Outline:${colors.reset}`)
        if (conversationState.cimOutline?.sections?.length) {
          conversationState.cimOutline.sections.forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.title} - ${s.description}`)
          })
        } else {
          console.log(`  ${colors.dim}Not created yet${colors.reset}`)
        }
        break

      case '/reset':
        clearKnowledgeCache()
        conversationState = {
          messages: [],
          workflowProgress: {
            currentStage: 'welcome',
            completedStages: [],
            sectionProgress: {},
          },
          knowledgeLoaded: false,
        }
        console.log(`\n${colors.green}✓ Conversation reset${colors.reset}`)
        break

      case '/quit':
      case '/exit':
        console.log(`\n${colors.dim}Goodbye!${colors.reset}`)
        process.exit(0)

      default:
        console.log(`${colors.red}Unknown command: ${cmd}${colors.reset}`)
        console.log(`${colors.dim}Available: /state, /persona, /hero, /outline, /reset, /quit${colors.reset}`)
    }
  }

  async function sendMessage(userMessage: string) {
    // Add user message to state
    const humanMsg = new HumanMessage(userMessage)
    conversationState.messages = [...(conversationState.messages || []), humanMsg]

    console.log(`\n${colors.dim}Thinking...${colors.reset}`)

    try {
      // Invoke the graph
      const result = await graph.invoke(
        {
          ...conversationState,
          messages: conversationState.messages,
        },
        {
          configurable: { thread_id: threadId },
        }
      )

      // Update state from result
      const oldStage = conversationState.workflowProgress?.currentStage
      conversationState = {
        ...conversationState,
        ...result,
      }

      // Extract and display the AI response
      const messages = result.messages || []
      const lastMessage = messages[messages.length - 1]

      if (lastMessage && lastMessage._getType() === 'ai') {
        const aiMsg = lastMessage as typeof AIMessage.prototype

        // Show tool calls if any
        if (aiMsg.tool_calls?.length) {
          console.log(`\n${colors.magenta}[Tools Used]${colors.reset}`)
          for (const tool of aiMsg.tool_calls) {
            console.log(`  ${colors.dim}→ ${tool.name}${colors.reset}`)
          }
        }

        // Show the response
        console.log(`\n${colors.bold}${colors.blue}Agent:${colors.reset}`)
        const content = aiMsg.content as string
        console.log(content.split('\n').map((line: string) => '  ' + line).join('\n'))

        // Show stage transition if changed
        const newStage = result.workflowProgress?.currentStage
        if (newStage && newStage !== oldStage) {
          console.log(`\n${colors.yellow}→ Stage changed: ${oldStage} → ${newStage}${colors.reset}`)
        }
      }
    } catch (error) {
      console.error(`\n${colors.red}Error: ${error instanceof Error ? error.message : 'Unknown error'}${colors.reset}`)
      if (error instanceof Error && error.stack) {
        console.error(`${colors.dim}${error.stack.split('\n').slice(0, 5).join('\n')}${colors.reset}`)
      }
    }
  }

  const prompt = () => {
    const stage = conversationState.workflowProgress?.currentStage || 'welcome'
    rl.question(`\n${colors.green}[${stage}]${colors.reset} ${colors.bold}You:${colors.reset} `, async (input) => {
      const trimmed = input.trim()

      if (!trimmed) {
        prompt()
        return
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        handleCommand(trimmed)
        prompt()
        return
      }

      // Send message to agent
      await sendMessage(trimmed)
      prompt()
    })
  }

  rl.on('close', () => {
    console.log(`\n${colors.dim}Goodbye!${colors.reset}`)
    process.exit(0)
  })

  prompt()
}

// Run
main().catch(console.error)
