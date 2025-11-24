# Epic 1 Jira Creation - Quick Start

## TL;DR

```bash
# 1. Set environment variables
export JIRA_URL="https://your-domain.atlassian.net"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"

# 2. Run the script
cd docs/sprint-artifacts
./create-epic1-jira.sh MANDA

# 3. Copy the output keys and update sprint-status.yaml
```

## What You Get

- **1 Epic**: Project Foundation
- **9 Stories**: E1.1 through E1.9
- All linked, prioritized, and ready for development

## Scripts Available

### Bash (Recommended)
```bash
./create-epic1-jira.sh MANDA
```
Fast, no dependencies, works everywhere

### Python
```bash
python create_epic1_jira.py MANDA
```
Color output, saves JSON, better error messages

## Get Your API Token

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Name it: "Manda Platform"
4. Copy the token

## Files Reference

| File | Purpose |
|------|---------|
| **QUICK_START.md** | This file - fastest way to get started |
| **README_JIRA_CREATION.md** | Quick reference with all options |
| **JIRA_SETUP_INSTRUCTIONS.md** | Detailed setup and troubleshooting |
| **EPIC1_JIRA_SUMMARY.md** | Complete epic and story details |
| **create-epic1-jira.sh** | Bash automation script |
| **create_epic1_jira.py** | Python automation script |
| **epic1-jira-payloads.json** | JSON data structure reference |
| **sprint-status-jira-template.yaml** | Template for updating sprint status |

## After Running

1. Script outputs Epic and Story keys
2. Update `sprint-status.yaml` with the keys
3. Verify in Jira web interface
4. Create sprint and assign stories
5. Start development!

## Common Issues

**Permission denied**
```bash
chmod +x create-epic1-jira.sh create_epic1_jira.py
```

**401 Unauthorized**
- Check your API token
- Verify email is correct

**Epic type not found**
- Your Jira may not have "Epic" issue type
- Check project settings

## Need More Help?

- **Quick reference**: README_JIRA_CREATION.md
- **Detailed guide**: JIRA_SETUP_INSTRUCTIONS.md
- **Full details**: EPIC1_JIRA_SUMMARY.md

## Epic 1 Stories

1. E1.1: Next.js 15 + shadcn/ui + Tailwind CSS 4
2. E1.2: Supabase Auth
3. E1.3: PostgreSQL Schema with RLS
4. E1.4: Projects Overview Screen
5. E1.5: Project Creation Wizard
6. E1.6: Project Workspace Shell
7. E1.7: Neo4j Graph Database
8. E1.8: pg-boss Job Queue
9. E1.9: Audit Logging

Total: ~2-3 weeks with 3 developers

---

**Ready?** Run the script and start building!
