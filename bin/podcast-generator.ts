#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PodcastGeneratorStack } from '../lib/podcast-generator-stack';

const app = new cdk.App();
new PodcastGeneratorStack(app, 'PodcastGeneratorStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
});