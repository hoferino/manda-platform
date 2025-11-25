# Google Cloud Storage (GCS) Setup Guide

This guide walks through setting up Google Cloud Storage for the Manda Platform document storage.

## Prerequisites

- Google Cloud account (create at https://cloud.google.com)
- `gcloud` CLI installed (https://cloud.google.com/sdk/docs/install)

## Step 1: Create a GCP Project

```bash
# Login to GCP
gcloud auth login

# Create a new project (or use existing)
gcloud projects create manda-platform --name="Manda Platform"

# Set as active project
gcloud config set project manda-platform

# Enable billing (required for GCS)
# Do this in the console: https://console.cloud.google.com/billing
```

## Step 2: Enable Cloud Storage API

```bash
gcloud services enable storage.googleapis.com
```

## Step 3: Create a Storage Bucket

```bash
# Create bucket for development
gsutil mb -l us-central1 gs://manda-documents-dev

# Create bucket for production (when ready)
# gsutil mb -l us-central1 gs://manda-documents-prod

# Set lifecycle rules (optional - auto-delete old versions after 30 days)
cat > lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 30, "isLive": false}
    }
  ]
}
EOF
gsutil lifecycle set lifecycle.json gs://manda-documents-dev
```

## Step 4: Create a Service Account

```bash
# Create service account
gcloud iam service-accounts create manda-storage \
  --display-name="Manda Storage Service Account"

# Grant Storage Admin role to the service account
gcloud projects add-iam-policy-binding manda-platform \
  --member="serviceAccount:manda-storage@manda-platform.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create and download key file
gcloud iam service-accounts keys create ./manda-storage-key.json \
  --iam-account=manda-storage@manda-platform.iam.gserviceaccount.com

# IMPORTANT: Keep this file secure! Don't commit to git!
```

## Step 5: Configure Environment Variables

Add to your `.env.local`:

```bash
# Google Cloud Storage
GCS_PROJECT_ID=manda-platform
GCS_BUCKET_NAME=manda-documents-dev
GOOGLE_APPLICATION_CREDENTIALS=/path/to/manda-storage-key.json
```

For production deployments (Vercel, etc.), use the JSON string instead:

```bash
# Convert key file to single-line JSON for env var
cat manda-storage-key.json | jq -c .

# Then set in your deployment platform:
GCS_CREDENTIALS_JSON='{"type":"service_account","project_id":"manda-platform",...}'
```

## Step 6: Verify Setup

```bash
# Test with gsutil
gsutil ls gs://manda-documents-dev

# Test upload
echo "test" > test.txt
gsutil cp test.txt gs://manda-documents-dev/test.txt
gsutil rm gs://manda-documents-dev/test.txt
rm test.txt
```

## Step 7: Configure CORS (for browser uploads)

```bash
cat > cors.json << 'EOF'
[
  {
    "origin": ["http://localhost:3000", "https://your-production-domain.com"],
    "method": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://manda-documents-dev
```

## Security Best Practices

1. **Never commit credentials** - Add to `.gitignore`:
   ```
   *-key.json
   *.pem
   ```

2. **Use least privilege** - Consider `roles/storage.objectAdmin` instead of `storage.admin` for production

3. **Enable audit logging** in GCP Console for compliance

4. **Set bucket-level permissions** - Don't make bucket public:
   ```bash
   gsutil iam ch -d allUsers gs://manda-documents-dev
   ```

5. **Enable versioning** for data recovery:
   ```bash
   gsutil versioning set on gs://manda-documents-dev
   ```

## Troubleshooting

### "Could not load the default credentials"
- Ensure `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Or set `GCS_CREDENTIALS_JSON` with the full JSON content

### "Access Denied" errors
- Verify service account has `roles/storage.admin` or `roles/storage.objectAdmin`
- Check bucket exists and name matches `GCS_BUCKET_NAME`

### CORS errors in browser
- Run the CORS configuration step
- Ensure your domain is in the `origin` list

## Cost Estimation

GCS pricing (us-central1, as of 2024):
- Storage: $0.020/GB/month (Standard)
- Operations: $0.005 per 1,000 Class A (uploads), $0.0004 per 1,000 Class B (downloads)
- Egress: First 1GB free, then $0.12/GB

For a typical M&A project with 1GB of documents:
- ~$0.02/month storage
- Negligible operation costs
- ~$0.12 if all docs downloaded once

## Next Steps

After setup, the following endpoints will work:
- `POST /api/documents/upload` - Upload documents
- `GET /api/documents/[id]` - Get document with signed download URL
- `DELETE /api/documents/[id]` - Delete document

See [API Documentation](./API.md) for full details.
