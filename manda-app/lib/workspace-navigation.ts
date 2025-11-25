/**
 * Workspace Navigation Configuration
 * Defines the 5 main sections of the project workspace
 * Story: E1.6 - Build Project Workspace Shell with Navigation
 */

import { Home, Folder, Brain, MessageSquare, FileText, type LucideIcon } from 'lucide-react'

export interface WorkspaceNavItem {
  id: string
  label: string
  icon: LucideIcon
  path: string
  description: string
  epic: number
}

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: 'dashboard',
    description: 'Project overview and metrics',
    epic: 2,
  },
  {
    id: 'data-room',
    label: 'Data Room',
    icon: Folder,
    path: 'data-room',
    description: 'Document management and organization',
    epic: 2,
  },
  {
    id: 'knowledge-explorer',
    label: 'Knowledge Explorer',
    icon: Brain,
    path: 'knowledge-explorer',
    description: 'Semantic search and knowledge graph',
    epic: 3,
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    path: 'chat',
    description: 'Conversational AI assistant',
    epic: 5,
  },
  {
    id: 'deliverables',
    label: 'Deliverables',
    icon: FileText,
    path: 'deliverables',
    description: 'CIM, Q&A, and IRL outputs',
    epic: 9,
  },
]
