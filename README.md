# AI-Powered Podcast Generator

This project provides an automated solution for generating podcast snippets from text and PDF documents using AWS services. When you upload a PDF or txt file to an S3 bucket, AI Podcast Generator automatically generates a podcast snippet using AI-powered text summarization and speech synthesis.

## Architecture

The solution uses the following AWS services:
- **Amazon S3**: Stores input text files and output podcast audio files
- **AWS Lambda**: Processes the files and orchestrates the AI services
- **Amazon Bedrock**: Generates concise podcast scripts using Claude 3 Sonnet
- **Amazon Polly**: Converts the generated scripts into natural-sounding audio

## Prerequisites

- Node.js 18.x or later
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- AWS CLI configured with appropriate credentials
- Docker (for local development and testing)

## Setup Instructions

1. Clone and install dependencies:
```bash
git clone <repository-url>
cd podcast-generator
npm install
cd src/lambda
npm install
cd ../..
```

2. Deploy:
```bash
cdk bootstrap  # Only needed once per account/region
cdk deploy
```

## Usage

1. Upload any text or PDF file to the created S3 bucket:
```bash
aws s3 cp your-document.txt s3://your-bucket-name/
```

2. Wait a few minutes for processing (check Lambda logs in CloudWatch if needed)

3. Find the generated podcast in the same bucket:
```bash
aws s3 cp s3://your-bucket-name/your-document_podcast_snippet.mp3 .
```

## Clean Up

Remove all resources:
```bash
cdk destroy
```

## Security Notes

For MVP purposes, this implementation includes:
- Broad IAM permissions that should be scoped down for production
- S3 bucket with deletion policies that should be reviewed for production
- Basic error handling that should be enhanced for production use

## Troubleshooting

Common issues:
- If the Lambda times out, increase the timeout in the CDK stack
- Check CloudWatch logs for detailed error messages
