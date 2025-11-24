# Data Room Audit Workflow Instructions

## Workflow

<workflow>
<critical>The workflow execution engine is governed by: {module-root}/workflows/workflow-engine.xml</critical>
<critical>You MUST have already loaded and processed: {module-root}/workflows/data-room-audit/workflow.yaml</critical>

<step n="1" goal="Initialize Audit Scope">

<action>Greet user and explain the data room audit process</action>
<action>Confirm the audit scope from workflow inputs</action>

<ask response="scope_confirmation">
The data room audit will scan all documents in: {{data_room_path}}

Audit scope: {{scope}}
Inconsistency detection: {{run_inconsistency_check}}

Would you like to proceed with this scope, or modify it? [proceed/modify]
</ask>

<check if="user wants to modify">
  <ask response="modified_scope">What would you like to change?</ask>
  <action>Update scope based on user input</action>
</check>

<template-output>audit_scope, inconsistency_enabled</template-output>

</step>

<step n="2" goal="Scan Data Room and Categorize Documents">

<action>Access data room at {{data_room_path}}</action>
<action>Enumerate all files and documents</action>
<action>Categorize each document by type</action>

Document Categories:
- **Financials**: Income statements, balance sheets, cash flow statements, financial models
- **Legal**: Articles of incorporation, bylaws, contracts, agreements, compliance docs
- **Operational**: Org charts, employee data, operational metrics, process documentation
- **Commercial**: Customer lists, contracts, pricing, sales data, market research
- **Strategic**: Business plans, strategic presentations, forecasts, projections
- **Due Diligence**: Previous DD reports, audits, assessments
- **IP**: Patents, trademarks, licenses, IP documentation
- **Other**: Uncategorized or miscellaneous documents

<action>For each document, extract key metadata:</action>
- Document name and type
- Date (if available)
- Key contents summary
- Category classification
- Completeness assessment

<template-output>documents_found, documents_by_category, total_document_count</template-output>

</step>

<step n="3" goal="Compare Against M&A Due Diligence Checklist">

<action>Load standard M&A due diligence checklist</action>
<action>Compare documents found against required items</action>
<action>Assign status to each checklist item: GREEN/YELLOW/RED</action>

Status Definitions:
- 🟢 **GREEN**: Complete - All required documents present
- 🟡 **YELLOW**: Partial - Some documents present, gaps exist
- 🔴 **RED**: Missing - Critical documents not found

Standard M&A Due Diligence Checklist:

**FINANCIAL DOCUMENTS**
- Historical financial statements (3-5 years)
- Monthly/quarterly financials (current year)
- Management forecasts and projections
- Financial models
- Revenue details by product/customer/geography
- Cost structure and breakdown
- Capital structure and debt schedule
- Tax returns (3 years)

**LEGAL & CORPORATE**
- Articles of incorporation
- Bylaws and amendments
- Capitalization table
- Stock ledger
- Board minutes and resolutions
- Material contracts and agreements
- Intellectual property documentation
- Litigation and claims history
- Regulatory compliance records

**OPERATIONAL**
- Organizational chart
- Key employee agreements
- Employee census and compensation
- Benefits and pension documentation
- Operational metrics and KPIs
- Facility leases and property docs
- Insurance policies
- IT systems and infrastructure docs

**COMMERCIAL**
- Top customer list and concentration
- Customer contracts (top 10-20)
- Pricing strategies and models
- Sales pipeline and forecasts
- Marketing materials and strategy
- Supplier and vendor agreements
- Distribution agreements
- Competitive analysis

**STRATEGIC**
- Business plan and strategy
- Market analysis and positioning
- Product roadmap
- Growth initiatives
- SWOT analysis
- Management presentations

<action>Generate status for each category and item</action>
<action>Calculate completeness percentage</action>

<template-output>checklist_status, completeness_by_category, overall_completeness, green_items, yellow_items, red_items</template-output>

</step>

<step n="4" goal="Run Inconsistency Detection (If Enabled)">

<check if="inconsistency_enabled == true">

<action>Invoke inconsistency detection analysis</action>
<action>Cross-reference financial documents for contradictions</action>
<action>Compare management presentations vs. actual data</action>
<action>Flag unexplained anomalies in spending, revenue, or metrics</action>
<action>Validate forecast assumptions against historical trends</action>

Sensitivity Level: {{inconsistency_sensitivity}}

Inconsistency Detection Areas:
1. **Financial Statement Consistency**
   - P&L, Balance Sheet, Cash Flow cross-validation
   - Period-over-period continuity
   - Reconciliation of management reports vs. audited financials

2. **Revenue Validation**
   - Customer contracts vs. reported revenue
   - Revenue recognition consistency
   - Growth rate claims vs. actual numbers

3. **Forecast Reasonability**
   - Historical trends vs. projected growth
   - Assumption consistency
   - Market size vs. revenue projections

4. **Operational Metrics**
   - Headcount vs. org chart
   - Customer data vs. customer contracts
   - Capacity utilization vs. revenue claims

5. **Anomaly Detection**
   - Unexpected spikes in expenses
   - Sudden customer concentration changes
   - Unusual timing of transactions

<action>Generate inconsistency report with severity levels</action>
- 🔴 **CRITICAL**: Clear contradictions requiring immediate attention
- 🟡 **MODERATE**: Potential inconsistencies to investigate
- 🟢 **MINOR**: Small discrepancies, likely explainable

<template-output>inconsistencies_found, critical_count, moderate_count, minor_count, inconsistency_details</template-output>

</check>

<check if="inconsistency_enabled == false">
  <template-output>inconsistencies_found: "Skipped per user preference"</template-output>
</check>

</step>

<step n="5" goal="Generate Gap Analysis and Recommendations">

<action>Analyze identified gaps (RED and YELLOW items)</action>
<action>Prioritize gaps by criticality for deal progression</action>
<action>Generate specific recommendations for each gap</action>

Gap Prioritization:
- **Critical Gaps**: Block CIM creation or valuation
- **Important Gaps**: Limit analysis quality, should be filled soon
- **Nice-to-Have Gaps**: Enhance analysis but not blocking

<action>For each critical gap, provide:</action>
- What's missing
- Why it matters
- Impact on deal progression
- Suggested action to fill gap
- Alternative approaches if unavailable

<template-output>critical_gaps, important_gaps, nice_to_have_gaps, gap_recommendations</template-output>

</step>

<step n="6" goal="Generate Actionable Next Steps">

<action>Based on audit results, recommend specific next steps</action>

Next Step Categories:
1. **Data Collection**: What to request from company
2. **Workflow Recommendations**: Which workflows to run next
3. **Analysis Opportunities**: What analysis is now possible with available data
4. **Risk Mitigation**: How to address identified inconsistencies

<action>Provide personalized recommendations</action>

Examples:
- "You have sufficient financial data to run a valuation analysis. Would you like me to run the financial-analysis workflow?"
- "Customer data is incomplete. Request: detailed customer list with revenue by customer for past 3 years."
- "Inconsistency detected: Revenue growth claim doesn't match financials. Recommend management meeting to clarify."

<template-output>next_steps_data_collection, next_steps_workflows, next_steps_analysis, next_steps_risk</template-output>

</step>

<step n="7" goal="Generate Final Audit Report">

<action>Compile all findings into comprehensive report</action>
<action>Use template to structure output</action>
<action>Include visualizations where helpful (status charts, category breakdown)</action>

Report Sections:
1. Executive Summary
2. Overall Completeness Status
3. Documents Found (by category)
4. Due Diligence Checklist Status
5. Gap Analysis
6. Inconsistencies (if enabled)
7. Recommendations and Next Steps
8. Detailed Findings

<action>Save report to {{output_location}}/reports/</action>
<action>Present summary to user with key highlights</action>

<template-output>date, audit_summary, key_findings_summary</template-output>

</step>

<step n="8" goal="Offer Follow-up Actions">

<action>Present immediate follow-up options to user</action>

<ask>
Based on this audit, I recommend:

{{next_steps_workflows}}

Would you like to:
1. Run one of the recommended workflows now
2. Review detailed findings in a specific area
3. Generate a data request list for the company
4. End audit and return to main menu

What would you like to do? [1-4]
</ask>

<check if="user selects workflow">
  <action>Transition to selected workflow</action>
</check>

<check if="user wants detailed review">
  <action>Deep dive into selected category or finding</action>
</check>

<check if="user wants data request list">
  <action>Generate formatted data request document</action>
  <action>List all RED and YELLOW items with specific requests</action>
  <action>Save to {{output_location}}/requests/</action>
</check>

</step>

</workflow>

## Notes for Agent Execution

**Information Vault Role**: Primary document scanning and categorization
**Finance Analyst Role**: Financial document analysis and inconsistency detection
**Company Analyst Role**: Operational and commercial document assessment
**Orchestrator Role**: Coordinate execution and present findings

**Key Principles**:
- Be specific about what's missing (not just "customer data" but "detailed customer list with revenue by customer for past 3 years")
- Provide context for why gaps matter
- Offer alternative approaches when critical data is unavailable
- Make inconsistency findings actionable
- Always suggest concrete next steps
