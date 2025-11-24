# Check IRL Status - Instructions

<critical>Quick visual status check of IRL completeness - no updates, just reporting</critical>
<critical>For faster performance, reads existing irl-checklist.yaml without scanning files</critical>

<workflow>

<step n="1" goal="Load and display IRL status">
<action>Load IRL checklist: {irl_checklist_path}</action>

<action>Display comprehensive status dashboard:

"📊 **IRL COMPLETION DASHBOARD**

**Deal:** {deal_name}
**Last Updated:** {last_update_timestamp}
**IRL Created:** {irl_creation_date} ({days_ago} days ago)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📈 OVERALL PROGRESS

**{overall_percent}% Complete** ({uploaded}/{total} documents)

```
Progress: [████████████░░░░░░░░] {overall_percent}%
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 BY PRIORITY

🔴 **High Priority:**    [{high_complete}/{high_total}] {high_percent}%
🟡 **Medium Priority:**  [{med_complete}/{med_total}] {med_percent}%
🟢 **Low Priority:**     [{low_complete}/{low_total}] {low_percent}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📂 BY CATEGORY

| Category | Progress | Documents | Status |
|----------|----------|-----------|--------|
| 💰 Financial | {percent}% | {x}/{y} | {status_icon} |
| ⚖️  Legal | {percent}% | {x}/{y} | {status_icon} |
| 🏭 Operational | {percent}% | {x}/{y} | {status_icon} |
| 📊 Commercial | {percent}% | {x}/{y} | {status_icon} |
| 🎯 Strategic | {percent}% | {x}/{y} | {status_icon} |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ❌ CRITICAL GAPS (High Priority Pending)

1. **Audited Financial Statements**
   - Category: Financial Information
   - Expected: 2021-2023 audited financials
   - Status: ❌ Not uploaded
   - Priority: 🔴 HIGH

2. **Customer Concentration Analysis**
   - Category: Commercial Information
   - Expected: Revenue by top 10 customers
   - Status: ❌ Not uploaded
   - Priority: 🔴 HIGH

[Full list of {count} high-priority gaps...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ RECENTLY COMPLETED

✅ **Articles of Incorporation** (uploaded {date})
   - Category: Legal Documents
   - File: articles-of-incorporation-2020.pdf

✅ **Customer List** (uploaded {date})
   - Category: Commercial Information
   - File: customer-list-2024-11-10.xlsx

[Last {count} uploads shown...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🏆 COMPLETE CATEGORIES

{if any categories 100%}
✅ **Legal Documents** - 100% complete!
✅ **Strategic Information** - 100% complete!
{else}
No categories at 100% yet. Keep uploading!
{end}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📊 PROGRESS TREND

```
Week 1: ███░░░░░░░ 30%
Week 2: ██████░░░░ 60%
Week 3: ████████░░ 80%  ← Current
```

**Velocity:** +{docs_per_week} documents/week
**Projected completion:** {projected_date} ({days_remaining} days)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 NEXT ACTIONS

**Upload Priority:**
1. 🔴 {count} HIGH priority documents needed
2. 🟡 {count} MEDIUM priority documents needed

**Recommended:**
- Upload high-priority financial documents
- Run `/manda:update-irl-status` after uploading
- Run `/manda:data-room-audit` when {threshold}% complete

**Ready for audit?**
{if overall_percent >= 70}
✅ You have {overall_percent}% of documents. Ready to run comprehensive audit!
   Run: `/manda:data-room-audit`
{else}
⏳ At {overall_percent}%, recommend uploading more high-priority docs before audit.
   Target: 70%+ for meaningful analysis
{end}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Commands:**
- Update status: `/manda:update-irl-status`
- Full audit: `/manda:data-room-audit`
- Detailed report: Open {irl_checklist_path}

**Need help uploading?** See {data_room_path}/README.md
"
  </action>
</step>

<step n="2" goal="Provide actionable recommendations">
<action>Based on current status, provide smart recommendations:

**If <30% complete:**
"**Early Stage** - Focus on high-priority foundational documents:
- Audited financials
- Corporate documents
- Customer/revenue data"

**If 30-70% complete:**
"**Good Progress** - Fill remaining high-priority gaps:
- {list specific high-priority pending items}
- Consider running preliminary audit soon"

**If >70% complete:**
"**Nearly Ready** - You're in good shape!
- {remaining_high_priority_count} high-priority items left
- Run comprehensive audit: `/manda:data-room-audit`
- Start storyline development: `/manda:investment-storyline-workshop`"

**If 100% complete:**
"🎉 **COMPLETE!** All IRL items uploaded!
- Ready for full analysis
- Run comprehensive audit
- Proceed to storyline workshop
- Consider if any supplementary docs would strengthen analysis"
  </action>
</step>

</workflow>
