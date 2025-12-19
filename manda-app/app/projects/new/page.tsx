/**
 * Project Creation Wizard Page
 * 2-step wizard for creating new M&A projects
 * Story: E1.5 - Implement Project Creation Wizard (AC: #1-#10)
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #4)
 *
 * Note (v2.6): deal_type removed - it didn't drive any downstream behavior
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { Step1BasicInfo } from '@/components/wizard/Step1BasicInfo'
import { Step3IRLTemplate as Step2IRLTemplate, NO_IRL_TEMPLATE, UPLOAD_IRL_TEMPLATE } from '@/components/wizard/Step3IRLTemplate'
import { createDealWithIRL } from '@/app/actions/create-deal-with-irl'
import { useOrganization } from '@/components/providers/organization-provider'

interface WizardFormData {
  projectName: string
  companyName: string
  industry: string
  irlTemplate: string
  uploadedFile: File | null
}

interface ValidationErrors {
  projectName?: string
  companyName?: string
}

const TOTAL_STEPS = 2

export default function NewProjectPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization() // E12.9: Get current org
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})

  // Form state
  const [formData, setFormData] = useState<WizardFormData>({
    projectName: '',
    companyName: '',
    industry: '',
    irlTemplate: '',
    uploadedFile: null,
  })

  // Validation for Step 1
  const validateStep1 = useCallback((): boolean => {
    const newErrors: ValidationErrors = {}

    // Validate project name
    const trimmedName = formData.projectName.trim()
    if (!trimmedName) {
      newErrors.projectName = 'Project name is required'
    } else if (trimmedName.length > 200) {
      newErrors.projectName = 'Project name must be 200 characters or less'
    }

    // Validate company name (optional but has max length)
    if (formData.companyName.length > 200) {
      newErrors.companyName = 'Company name must be 200 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData.projectName, formData.companyName])

  // Check if current step is valid
  const isCurrentStepValid = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        return formData.projectName.trim().length > 0
      case 2:
        // Step 2 is valid if user has made a selection:
        // - Empty project: irlTemplate === NO_IRL_TEMPLATE
        // - Upload custom: irlTemplate === UPLOAD_IRL_TEMPLATE AND uploadedFile is present
        // - Use template: irlTemplate is a valid template name (non-empty string)
        if (formData.irlTemplate === UPLOAD_IRL_TEMPLATE) {
          return formData.uploadedFile !== null
        }
        return formData.irlTemplate.trim().length > 0
      default:
        return false
    }
  }, [currentStep, formData.projectName, formData.irlTemplate, formData.uploadedFile])

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStep === 1 && !validateStep1()) {
      return
    }

    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS))
    setErrors({})
  }, [currentStep, validateStep1])

  // Handle back step
  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setErrors({})
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateStep1()) {
      setCurrentStep(1)
      return
    }

    // E12.9: Require organization context
    if (!currentOrganization?.id) {
      toast.error('No organization selected. Please select an organization first.')
      return
    }

    setIsSubmitting(true)

    try {
      // Handle special IRL cases
      const irlTemplate = formData.irlTemplate === NO_IRL_TEMPLATE
        ? 'none'
        : formData.irlTemplate === UPLOAD_IRL_TEMPLATE
        ? 'upload'
        : formData.irlTemplate || null

      // If user selected "Upload Custom" and has a file, process it via API
      if (irlTemplate === 'upload' && formData.uploadedFile) {
        // First create the deal
        const dealResult = await createDealWithIRL({
          name: formData.projectName.trim(),
          organization_id: currentOrganization.id, // E12.9: Required for multi-tenant
          company_name: formData.companyName.trim() || null,
          industry: formData.industry || null,
          irl_template: 'none', // Create empty deal first
          status: 'active',
        })

        if (dealResult.error || !dealResult.data) {
          toast.error(dealResult.error || 'Failed to create project')
          return
        }

        const dealId = dealResult.data.id

        // Then upload and process the IRL file
        const formDataObj = new FormData()
        formDataObj.append('file', formData.uploadedFile)
        formDataObj.append('name', `${formData.projectName.trim()} - IRL`)
        formDataObj.append('generateFolders', 'true')

        const uploadResponse = await fetch(`/api/projects/${dealId}/irl/import`, {
          method: 'POST',
          body: formDataObj,
        })

        const uploadResult = await uploadResponse.json()

        if (!uploadResponse.ok) {
          toast.error(uploadResult.error || 'Failed to import IRL')
          // Still redirect to project even if IRL upload fails
          router.push(`/projects/${dealId}/dashboard`)
          return
        }

        toast.success(
          `Project created! Imported ${uploadResult.itemsCreated} IRL items and created ${uploadResult.foldersCreated} folders.`
        )
        router.push(`/projects/${dealId}/dashboard`)
        return
      }

      // Standard template or empty project creation
      const result = await createDealWithIRL({
        name: formData.projectName.trim(),
        organization_id: currentOrganization.id, // E12.9: Required for multi-tenant
        company_name: formData.companyName.trim() || null,
        industry: formData.industry || null,
        irl_template: irlTemplate,
        status: 'active',
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        // Show success message with IRL creation feedback
        if (result.irlCreated && result.foldersCreated) {
          toast.success(
            `Project created successfully! Generated ${result.foldersCreated} folders from IRL template.`
          )
        } else {
          toast.success('Project created successfully!')
        }

        // Redirect to project workspace
        router.push(`/projects/${result.data.id}/dashboard`)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Failed to create project. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, router, validateStep1, currentOrganization])

  // Update form data handlers
  const updateFormData = useCallback(
    <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // Clear errors when user starts typing
      if (field === 'projectName' || field === 'companyName') {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    },
    []
  )

  return (
    <WizardLayout
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      title="Create New Project"
      onNext={handleNext}
      onBack={handleBack}
      onSubmit={handleSubmit}
      isNextDisabled={!isCurrentStepValid()}
      isSubmitting={isSubmitting}
    >
      {currentStep === 1 && (
        <Step1BasicInfo
          projectName={formData.projectName}
          companyName={formData.companyName}
          industry={formData.industry}
          onProjectNameChange={(value) => updateFormData('projectName', value)}
          onCompanyNameChange={(value) => updateFormData('companyName', value)}
          onIndustryChange={(value) => updateFormData('industry', value)}
          errors={errors}
        />
      )}

      {currentStep === 2 && (
        <Step2IRLTemplate
          selectedTemplate={formData.irlTemplate}
          onTemplateChange={(template) => updateFormData('irlTemplate', template)}
          uploadedFile={formData.uploadedFile}
          onFileChange={(file) => updateFormData('uploadedFile', file)}
        />
      )}
    </WizardLayout>
  )
}
