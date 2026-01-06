#!/bin/bash
# Get detailed information about a specific LangSmith run
# Usage: ./get-run.sh <run-id>

if [ -z "$1" ]; then
    echo "Usage: ./get-run.sh <run-id>"
    exit 1
fi

RUN_ID="$1"
API_KEY="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"
ENDPOINT="https://eu.api.smith.langchain.com"

curl -s "${ENDPOINT}/runs/${RUN_ID}" \
  -H "x-api-key: ${API_KEY}" | python3 -c "
import json, sys
from datetime import datetime

r = json.load(sys.stdin)

print('=' * 70)
print(f'RUN DETAILS: {r.get(\"id\", \"unknown\")}')
print('=' * 70)

print(f'\nName: {r.get(\"name\", \"N/A\")}')
print(f'Status: {r.get(\"status\", \"N/A\")}')
print(f'Run Type: {r.get(\"run_type\", \"N/A\")}')

# Timing
try:
    start = datetime.fromisoformat(r['start_time'].replace('Z', '+00:00'))
    end = datetime.fromisoformat(r['end_time'].replace('Z', '+00:00'))
    dur = (end - start).total_seconds()
    print(f'\nTiming:')
    print(f'  Start: {r[\"start_time\"]}')
    print(f'  End: {r[\"end_time\"]}')
    print(f'  Duration: {dur:.2f}s')

    if r.get('first_token_time'):
        ft = datetime.fromisoformat(r['first_token_time'].replace('Z', '+00:00'))
        ttft = (ft - start).total_seconds()
        print(f'  Time to First Token: {ttft:.2f}s')
except:
    pass

# Tokens
print(f'\nToken Usage:')
print(f'  Input: {r.get(\"prompt_tokens\", \"N/A\"):,}')
print(f'  Output: {r.get(\"completion_tokens\", \"N/A\"):,}')
print(f'  Total: {r.get(\"total_tokens\", \"N/A\"):,}')

prompt_details = r.get('prompt_token_details', {})
if prompt_details:
    cache_read = prompt_details.get('cache_read', 0)
    print(f'  Cache Read: {cache_read:,}')

completion_details = r.get('completion_token_details', {})
if completion_details:
    reasoning = completion_details.get('reasoning', 0)
    if reasoning:
        print(f'  Reasoning: {reasoning:,}')

# Cost
print(f'\nCost:')
print(f'  Total: \${r.get(\"total_cost\", 0):.6f}')
print(f'  Input: \${r.get(\"prompt_cost\", 0):.6f}')
print(f'  Output: \${r.get(\"completion_cost\", 0):.6f}')

# Inputs preview
inputs = r.get('inputs', {})
if inputs:
    messages = inputs.get('messages', [])
    if messages:
        print(f'\nInput Messages: {len(messages)}')
        for msg in messages[-3:]:  # Last 3 messages
            content = msg.get('kwargs', {}).get('content', '')[:100]
            msg_type = msg.get('id', ['', '', 'unknown'])[-1]
            print(f'  [{msg_type}] {content}...')

# Error
if r.get('error'):
    print(f'\nError: {r[\"error\"]}')

print(f'\nDashboard: {r.get(\"app_path\", \"N/A\")}')
"
