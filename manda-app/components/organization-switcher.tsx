'use client'

/**
 * Organization Switcher Component
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #9)
 *
 * Dropdown component for switching between organizations.
 * Shows current organization name and allows switching.
 */

import { Check, ChevronsUpDown, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { useOrganization } from '@/components/providers/organization-provider'
import { useState } from 'react'

export function OrganizationSwitcher() {
  const {
    currentOrganization,
    organizations,
    currentRole,
    loading,
    switchOrganization,
  } = useOrganization()
  const [open, setOpen] = useState(false)

  // Don't render if no organizations or still loading
  if (loading || organizations.length === 0) {
    return null
  }

  // If user only has one organization, show it without dropdown
  if (organizations.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{currentOrganization?.name}</span>
        {currentRole === 'superadmin' && (
          <Badge variant="secondary" className="text-xs">Admin</Badge>
        )}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {currentOrganization?.name || 'Select organization...'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search organization..." />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.slug}
                  onSelect={() => {
                    switchOrganization(org.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      currentOrganization?.id === org.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{org.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
