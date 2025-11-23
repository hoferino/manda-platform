# Investment Storyline Brief

**Company:** {{company_name}}
**Date:** {{date}}
**Target Buyer Type:** {{target_buyer_type}}
**Developed By:** Story Architect (M&A Deal Intelligence Platform)

---

## Investment Thesis

### The Opportunity

{{thesis_opportunity}}

### The Value

{{thesis_value}}

### The Potential

{{thesis_potential}}

### The Proof

{{thesis_proof}}

### Ideal Buyer Profile

{{ideal_buyer_profile}}

---

## The Headline

**What Buyers Should Remember:**

{{storyline_headline}}

---

## Core Storyline Themes

{{#each core_themes}}
### {{theme_number}}. {{theme_title}}

**Description:**
{{theme_description}}

**Supporting Evidence:**
{{#each evidence_points}}
- {{evidence_point}} (Source: {{source}})
{{/each}}

**Why This Matters to Buyers:**
{{buyer_relevance}}

---
{{/each}}

## Narrative Arc

### Opening: The Opportunity

**How We Introduce the Company:**

{{narrative_opening}}

**Key Hook:**
{{opening_hook}}

---

### Rising Action: The Business

**What They Do and How They Do It Well:**

{{narrative_business}}

**Customer Value Proposition:**
{{value_proposition}}

---

### Climax: The Value Creation Story

**Performance to Date and Future Potential:**

{{narrative_value_creation}}

**Key Performance Highlights:**
{{performance_highlights}}

**Growth Opportunities:**
{{growth_opportunities}}

---

### Resolution: The Investment Opportunity

**Why This is Attractive and Who Should Buy:**

{{narrative_resolution}}

**Strategic Fit:**
{{strategic_fit}}

---

## Message Hierarchy

### Level 1: The Headline
{{message_headline}}

### Level 2: The Pillars (3-5 Core Themes)
{{#each pillars}}
- **{{pillar_title}}**: {{pillar_summary}}
{{/each}}

### Level 3: The Evidence
{{#each evidence_summary}}
**{{theme}}:**
{{#each facts}}
- {{fact}} (Source: {{source}})
{{/each}}
{{/each}}

### Level 4: Supporting Details
{{supporting_details}}

---

## Evidence Map

_This section maps every claim in the storyline to its supporting source._

{{#each evidence_map}}
### Claim: "{{claim}}"

- **Source:** {{source_document}}, {{source_location}}
- **Data Quality:** {{data_quality}}
- **Confidence Level:** {{confidence_level}}
- **Additional Context:** {{additional_context}}

---
{{/each}}

## Buyer Positioning

### Primary Target: {{primary_target_buyer}}

**Why They Should Care:**
{{primary_buyer_rationale}}

**Key Messages for This Buyer Type:**
{{#each primary_buyer_messages}}
- {{message}}
{{/each}}

**Strategic Fit:**
{{primary_buyer_fit}}

---

### Secondary Targets

{{#each secondary_buyers}}
#### {{buyer_type}}

**Why They Should Care:**
{{rationale}}

**Key Messages:**
{{#each messages}}
- {{message}}
{{/each}}

---
{{/each}}

## Risks and Mitigations

_How we address potential buyer concerns in the narrative_

{{#each risks}}
### Risk: {{risk_title}}

**Concern:**
{{risk_description}}

**How We Address It:**
{{mitigation_approach}}

**Supporting Evidence:**
{{mitigation_evidence}}

---
{{/each}}

## Data Gaps and Recommendations

### Identified Gaps

{{#each data_gaps}}
- **Gap:** {{gap_description}}
- **Impact:** {{impact_on_storyline}}
- **Recommendation:** {{recommended_action}}
{{/each}}

### Recommended Next Steps

**Data Collection:**
{{#each data_collection_steps}}
1. {{step}}
{{/each}}

**Analysis Workflows:**
{{#each recommended_workflows}}
- {{workflow_name}}: {{workflow_purpose}}
{{/each}}

**Document Creation:**
{{#each document_recommendations}}
- {{document_type}}: {{timeline}}
{{/each}}

---

## Storyline Validation

### Coherence Check
- **Narrative Flow:** {{coherence_narrative_flow}}
- **Theme Consistency:** {{coherence_theme_consistency}}
- **Evidence Quality:** {{coherence_evidence_quality}}

### Buyer Relevance Check
- **Target Buyer Resonance:** {{buyer_resonance_score}}
- **Strategic Fit Clarity:** {{strategic_fit_clarity}}
- **Addressable Concerns:** {{concerns_addressed}}

### Clarity Check
- **Simplicity:** {{clarity_simplicity}}
- **Understandability:** {{clarity_understanding}}
- **60-Second Test:** {{sixty_second_summary}}

---

## Workshop Summary

**Workshop Duration:** {{workshop_duration}}
**Workshop Depth:** {{storyline_depth}}

**Key Decisions Made:**
{{#each key_decisions}}
- {{decision}}
{{/each}}

**User Feedback:**
{{user_feedback_summary}}

**Refinement Rounds:** {{refinement_count}}

---

## Deliverables Generated

- ✓ Storyline Brief (this document)
- {{#if teaser_generated}}✓{{else}}○{{/if}} Investment Teaser
- {{#if cim_outline_generated}}✓{{else}}○{{/if}} CIM Narrative Outline
- ✓ Investment Thesis One-Pager
- ✓ Evidence Map

**Output Location:** {{output_location}}/storylines/

---

## Next Steps

### Immediate Actions

1. {{next_step_1}}
2. {{next_step_2}}
3. {{next_step_3}}

### CIM Development Path

{{cim_development_recommendation}}

### Timeline

- **Today**: {{timeline_today}}
- **This Week**: {{timeline_week}}
- **Before Marketing**: {{timeline_before_marketing}}

---

## Appendix: Workshop Artifacts

### User Input (Act 1: Discovery)

**User Perspective on Company Strengths:**
{{user_perspective_strengths}}

**User-Identified Growth Story:**
{{user_growth_story}}

**User Concerns:**
{{user_concerns}}

---

### Financial Intelligence (from Finance Analyst)

**Performance Summary:**
{{financial_performance_summary}}

**Key Value Drivers:**
{{financial_value_drivers}}

**Valuation Considerations:**
{{valuation_considerations}}

---

### Business Intelligence (from Company Analyst)

**Business Strengths:**
{{business_strengths_summary}}

**Competitive Positioning:**
{{competitive_positioning_summary}}

**Customer Value Proposition:**
{{customer_value_prop_summary}}

**Growth Opportunities:**
{{growth_opportunities_summary}}

---

_Generated by M&A Deal Intelligence Platform - Investment Storyline Workshop_
_To refine this storyline, re-run: `/manda:investment-storyline-workshop`_
