# Update IRL Status - Instructions

<critical>This workflow scans the data room and updates IRL checklist status based on uploaded documents</critical>
<critical>Runs automatically on document upload or can be triggered manually</critical>

<workflow>

<step n="1" goal="Load IRL checklist">
<action>Load the IRL checklist:
- Read: {irl_checklist_path}
- Parse YAML structure
- Extract all categories and documents
- Get current status for each item
  </action>

<action if="no-irl-found">Handle missing IRL:

"⚠️ No IRL checklist found in data room.

This workflow requires an IRL-based data room setup.

**Options:**
1. Run `/manda:setup-irl-data-room` to create IRL structure
2. Manually create irl-checklist.yaml
3. Use standard data room audit (doesn't track IRL)

Would you like me to run the IRL setup workflow?"
  </action>
</step>

<step n="2" goal="Scan data room for uploaded documents">
<action>Scan all folders in data room:

**Scan:** {data_room_path}/**/*

**Collect:**
- All file paths
- File names
- File sizes
- Upload dates (file modification time)
- Folder locations

**Exclude:**
- irl/ folder (metadata)
- README.md files
- .gitkeep files
- Hidden files (.DS_Store, etc.)
  </action>

<action>Organize findings by category:

For each uploaded file:
- Determine which category folder it's in
- Map to IRL category structure
- Extract document type from folder path
- Record file details
  </action>
</step>

<step n="3" goal="Match uploaded files to IRL items">
<action>For each IRL document requirement:

**Matching logic:**

1. **Exact folder match:**
   - IRL item specifies subfolder: "audited-financials"
   - Check if files exist in: data/deals/1-financial-information/audited-financials/

2. **Name pattern match:**
   - IRL requires: "Audited Financial Statements"
   - Look for files containing: "audited", "financial", "statements"
   - Case-insensitive matching

3. **Multiple files check:**
   - Some requirements need multiple files (e.g., "3 years of financials")
   - Count matching files
   - Verify completeness

4. **Quality indicators:**
   - Check for quality markers: AUDITED-, UNAUDITED-, DRAFT-
   - Record in status
  </action>

<action>Update status for each IRL item:

**Status options:**
- `pending` - No matching files found
- `partial` - Some but not all required files uploaded
- `uploaded` - All required files present
- `needs-review` - Files uploaded but quality unclear

**Record:**
- Status
- Upload date (most recent file)
- File names matched
- File count
- Any quality indicators
  </action>
</step>

<step n="4" goal="Calculate completeness metrics">
<action>Compute overall progress:

**By Priority:**
- High priority items: X/Y complete (Z%)
- Medium priority items: X/Y complete (Z%)
- Low priority items: X/Y complete (Z%)

**By Category:**
- Financial Information: X/Y documents (Z%)
- Legal Documents: X/Y documents (Z%)
- Operational Information: X/Y documents (Z%)
- Commercial Information: X/Y documents (Z%)
- Strategic Information: X/Y documents (Z%)

**Overall:**
- Total progress: X/Y documents (Z%)
- Critical gaps: Count of high-priority pending items
- Days since IRL created: X days
  </action>

<action>Identify notable changes since last update:

**Track:**
- New uploads since last check
- Status changes (pending → uploaded)
- Categories that moved to 100% complete
- High-priority gaps still outstanding
  </action>
</step>

<step n="5" goal="Update IRL checklist file">
<action>Save updated checklist:

**Update:** {irl_checklist_path}

**Preserve:**
- Original structure
- All metadata
- IRL source information

**Update:**
- Document status fields
- Upload dates
- File paths
- Completeness percentages
- Last updated timestamp

**Add history entry:**
```yaml
update_history:
  - date: "{current_timestamp}"
    documents_added: X
    status_changes: Y
    overall_completion: "Z%"
```
  </action>

<action>Backup previous version:
- Copy current irl-checklist.yaml to irl-checklist-backup-{date}.yaml
- Keep last 5 backups
- Allows rollback if needed
  </action>
</step>

<step n="6" goal="Generate status report">
<action>Create human-readable status report:

"📊 **IRL Status Update Complete**

**Updated:** {current_timestamp}

**Overall Progress:** {overall_percentage}%
- Documents uploaded: {uploaded_count}/{total_count}
- High priority: {high_complete}/{high_total} ({high_percent}%)
- Medium priority: {med_complete}/{med_total} ({med_percent}%)
- Low priority: {low_complete}/{low_total} ({low_percent}%)

**New Since Last Check:** {new_uploads_count} documents
- Financial Information: +{count}
- Legal Documents: +{count}
- Commercial Information: +{count}

**Categories at 100%:**
{list of complete categories}

**Critical Gaps (High Priority):**
❌ {document_name} ({category})
❌ {document_name} ({category})

**Recently Completed:**
✅ {document_name} (uploaded {date})
✅ {document_name} (uploaded {date})

**Next Actions:**
- {X} high-priority documents still needed
- {Y} categories incomplete
- Consider running data room audit: `/manda:data-room-audit`

**Updated Checklist:** data/deals/irl/irl-checklist.yaml"
  </action>
</step>

<step n="7" goal="Update data room README">
<action>Update main data room README with current status:

**Update sections:**
- Overall progress percentage
- Status per category
- Last updated timestamp
- Quick summary of gaps

**Preserve:**
- Upload instructions
- Folder structure documentation
- Contact information
  </action>
</step>

<step n="8" goal="Optional: Send notifications">
<action optional="true">If significant progress:

**Conditions for notification:**
- New high-priority document uploaded
- Category reaches 100% completion
- All high-priority items complete
- Major milestone (25%, 50%, 75%, 100%)

**Notification content:**
- Progress update
- What was uploaded
- What's still needed
- Congratulations on milestones!

**Delivery:** (future enhancement)
- Email notification
- Slack message
- Dashboard update
  </action>
</step>

</workflow>
