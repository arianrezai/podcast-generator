// lib/podcast-generator-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class PodcastGeneratorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket
    const bucket = new s3.Bucket(this, 'PodcastContentBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For MVP only - change for production
      autoDeleteObjects: true, // For MVP only - change for production
      versioned: true,
    });

    // Create Lambda function
    const podcastGenerator = new lambda.Function(this, 'PodcastGeneratorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'podcast-generator-lambda.handler',
      code: lambda.Code.fromAsset('src/lambda'),
      timeout: cdk.Duration.minutes(5), // Increased timeout for AI processing
      memorySize: 1024, // Increased memory for processing
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

    // Add IAM permissions
    bucket.grantReadWrite(podcastGenerator);
    
    podcastGenerator.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      resources: ['*'], // Scope this down in production
    }));

    podcastGenerator.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'polly:SynthesizeSpeech'
      ],
      resources: ['*'], // Scope this down in production
    }));

    // Add S3 trigger for .txt files
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(podcastGenerator),
      { suffix: '.txt' }
    );

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(podcastGenerator),
      { suffix: '.pdf' }
    );
  }
}