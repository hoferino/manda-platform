# Sync to Jira - Validation Checklist

## Pre-Sync Validation

- [ ] Jira MCP connection is active and authenticated
- [ ] Access to Jira project `{jira_project_key}` confirmed
- [ ] Epic and Story issue types are available
- [ ] Sprint artifacts directory exists with epic/story files
- [ ] User confirmed sync operation

## During Sync

- [ ] All epic files processed (created or updated)
- [ ] All story files processed (created or updated)
- [ ] Jira issue keys stored back in BMAD files
- [ ] Parent-child relationships maintained (stories linked to epics)
- [ ] No critical errors occurred

## Post-Sync Validation

- [ ] Sync log generated successfully
- [ ] All epics visible in Jira project
- [ ] All stories visible in Jira project
- [ ] Epic-story hierarchy correct in Jira
- [ ] BMAD files updated with Jira keys
- [ ] Summary reported to user with Jira links

## Error Recovery

If errors occur:
- [ ] Check Jira MCP connection status
- [ ] Verify Jira project permissions
- [ ] Review sync log for specific failures
- [ ] Re-run workflow (idempotent - safe to retry)
