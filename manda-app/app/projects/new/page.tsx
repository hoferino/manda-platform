/**
 * Project Creation Wizard Page
 * 2-step wizard for creating new M&A projects
 * Story: E1.5 - Implement Project Creation Wizard (AC: #1-#10)
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
import { createDeal } from '@/lib/api/deals-client'

interface WizardFormData {
  projectName: string
  companyName: string
  industry: string
  irlTemplate: string
}

interface ValidationErrors {
  projectName?: string
  companyName?: string
}

const TOTAL_STEPS = 2

export default function NewProjectPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})

  // Form state
  const [formData, setFormData] = useState<WizardFormData>({
    projectName: '',
    companyName: '',
    industry: '',
    irlTemplate: '',
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
        // Step 2 (IRL Template) is always valid - user can choose "Empty Project" or a template
        return true
      default:
        return false
    }
  }, [currentStep, formData.projectName])

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

    setIsSubmitting(true)

    try {
      // Handle special IRL cases - send null for 'none' or 'upload'
      const irlTemplate = (formData.irlTemplate === NO_IRL_TEMPLATE || formData.irlTemplate === UPLOAD_IRL_TEMPLATE)
        ? null
        : formData.irlTemplate || null

      const result = await createDeal({
        name: formData.projectName.trim(),
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
        toast.success('Project created successfully!')
        // Redirect to project workspace (E1.6 will implement the actual workspace)
        // For now, redirect to projects list
        router.push(`/projects/${result.data.id}/dashboard`)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Failed to create project. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, router, validateStep1])

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
        />
      )}
    </WizardLayout>
  )
}
