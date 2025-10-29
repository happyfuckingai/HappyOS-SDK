# AWS Deployment Guide

This guide covers deploying HappyOS SDK-based applications to AWS.

## Prerequisites

- AWS Account
- AWS CLI configured
- Node.js 18+ installed
- HappyOS SDK installed

## AWS Services Setup

### 1. SQS Queue Setup

Create an SQS queue for agent communication:

```bash
# Create standard queue
aws sqs create-queue \
  --queue-name happyos-agent-queue \
  --region eu-north-1

# Enable long polling (recommended)
aws sqs set-queue-attributes \
  --queue-url https://sqs.eu-north-1.amazonaws.com/YOUR_ACCOUNT/happyos-agent-queue \
  --attributes ReceiveMessageWaitTimeSeconds=20

# Optional: Create DLQ for failed messages
aws sqs create-queue \
  --queue-name happyos-agent-dlq \
  --region eu-north-1

# Configure DLQ redrive policy
aws sqs set-queue-attributes \
  --queue-url https://sqs.eu-north-1.amazonaws.com/YOUR_ACCOUNT/happyos-agent-queue \
  --attributes '{
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:eu-north-1:YOUR_ACCOUNT:happyos-agent-dlq\",\"maxReceiveCount\":\"3\"}"
  }'
```

### 2. DynamoDB Table Setup

Create a table for agent state:

```bash
aws dynamodb create-table \
  --table-name HappyOS-Agents \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1

# Optional: Create GSI for querying
aws dynamodb update-table \
  --table-name HappyOS-Agents \
  --attribute-definitions \
    AttributeName=sk,AttributeType=S \
  --global-secondary-index-updates '[{
    "Create": {
      "IndexName": "StateIndex",
      "KeySchema": [{"AttributeName":"sk","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"}
    }
  }]' \
  --region eu-north-1
```

### 3. EventBridge Event Bus

Create custom event bus:

```bash
aws events create-event-bus \
  --name happyos-events \
  --region eu-north-1
```

### 4. Lambda Functions

#### Lambda Execution Role

Create IAM role for Lambda:

```bash
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "lambda.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name HappyOS-Lambda-Role \
  --assume-role-policy-document file://trust-policy.json

# Attach policies
aws iam attach-role-policy \
  --role-name HappyOS-Lambda-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for HappyOS services
cat > happyos-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:*:*:happyos-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/HappyOS-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "events:PutEvents"
      ],
      "Resource": "arn:aws:events:*:*:event-bus/happyos-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:*:*:function:happyos-agent-*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name HappyOS-Lambda-Role \
  --policy-name HappyOS-Permissions \
  --policy-document file://happyos-policy.json
```

#### Deploy Lambda Agent

Example deployment:

```bash
# Package your agent
cd my-agent
npm install
npm run build
zip -r agent.zip dist/ node_modules/

# Create Lambda function
aws lambda create-function \
  --function-name happyos-agent-processor \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/HappyOS-Lambda-Role \
  --handler dist/index.handler \
  --zip-file fileb://agent.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables='{
    "AWS_REGION":"eu-north-1",
    "SQS_QUEUE_URL":"https://sqs.eu-north-1.amazonaws.com/YOUR_ACCOUNT/happyos-agent-queue",
    "DYNAMODB_TABLE":"HappyOS-Agents",
    "EVENTBRIDGE_BUS":"happyos-events"
  }' \
  --region eu-north-1
```

## Application Configuration

### Environment Variables

```bash
# AWS Configuration
export AWS_REGION=eu-north-1
export SQS_QUEUE_URL=https://sqs.eu-north-1.amazonaws.com/YOUR_ACCOUNT/happyos-agent-queue
export DYNAMODB_TABLE=HappyOS-Agents
export EVENTBRIDGE_BUS=happyos-events
export LAMBDA_FUNCTION_PREFIX=happyos-agent

# Optional: Local development
export AWS_ENDPOINT_OVERRIDE=http://localhost:4566  # For LocalStack
```

### Configuration File

Create `happyos.config.ts`:

```typescript
import { AWSConfig } from '@happyos/sdk';

export const awsConfig: AWSConfig = {
  region: process.env.AWS_REGION || 'eu-north-1',
  sqs: {
    queueUrl: process.env.SQS_QUEUE_URL || '',
    endpoint: process.env.AWS_ENDPOINT_OVERRIDE
  },
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE || 'HappyOS-Agents',
    endpoint: process.env.AWS_ENDPOINT_OVERRIDE
  },
  lambda: {
    functionPrefix: process.env.LAMBDA_FUNCTION_PREFIX || 'happyos-agent',
    endpoint: process.env.AWS_ENDPOINT_OVERRIDE
  },
  eventbridge: {
    eventBusName: process.env.EVENTBRIDGE_BUS || 'happyos-events',
    endpoint: process.env.AWS_ENDPOINT_OVERRIDE
  }
};
```

## Example Lambda Handler

```typescript
import {
  Agent,
  AgentContext,
  AgentResult,
  AgentMessage,
  SQSMessageTransport,
  A2ACommunicationBus
} from '@happyos/sdk';
import { awsConfig } from './happyos.config';

class ProcessorAgent extends Agent {
  protected async run(input: unknown): Promise<unknown> {
    // Your processing logic
    return { processed: true, result: input };
  }

  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    return await this.execute(
      {
        agentId: this.getId(),
        requestId: message.id,
        timestamp: Date.now()
      },
      message.payload
    );
  }
}

// Initialize once
const transport = new SQSMessageTransport(awsConfig);
const bus = new A2ACommunicationBus(transport);
const agent = new ProcessorAgent({
  id: 'processor-1',
  name: 'Processor Agent',
  type: 'processor'
});

export const handler = async (event: any, context: any) => {
  const agentContext: AgentContext = {
    agentId: agent.getId(),
    requestId: context.requestId,
    timestamp: Date.now()
  };

  const result = await agent.execute(agentContext, event);
  return result;
};
```

## Monitoring Setup

### CloudWatch Alarms

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name happyos-high-errors \
  --alarm-description "Alert when error rate is high" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=happyos-agent-processor

# High duration alarm
aws cloudwatch put-metric-alarm \
  --alarm-name happyos-high-duration \
  --alarm-description "Alert when duration is high" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 25000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=happyos-agent-processor
```

### EventBridge Rules

Monitor agent events:

```bash
aws events put-rule \
  --name happyos-agent-failures \
  --event-pattern '{
    "source": ["happyos.agent"],
    "detail-type": ["agent.failed"]
  }' \
  --state ENABLED \
  --event-bus-name happyos-events
```

## Local Development

### Using LocalStack

```bash
# Install LocalStack
pip install localstack

# Start LocalStack
localstack start

# Set endpoint override
export AWS_ENDPOINT_OVERRIDE=http://localhost:4566

# Create resources in LocalStack
awslocal sqs create-queue --queue-name happyos-agent-queue
awslocal dynamodb create-table \
  --table-name HappyOS-Agents \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

## Infrastructure as Code

### Terraform Example

```hcl
# variables.tf
variable "project_name" {
  default = "happyos"
}

# sqs.tf
resource "aws_sqs_queue" "agent_queue" {
  name                       = "${var.project_name}-agent-queue"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.agent_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "agent_dlq" {
  name = "${var.project_name}-agent-dlq"
}

# dynamodb.tf
resource "aws_dynamodb_table" "agents" {
  name           = "HappyOS-Agents"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  global_secondary_index {
    name            = "StateIndex"
    hash_key        = "sk"
    projection_type = "ALL"
  }
}

# eventbridge.tf
resource "aws_cloudwatch_event_bus" "happyos" {
  name = "${var.project_name}-events"
}
```

## Best Practices

1. **Use IAM Roles**: Never hardcode credentials
2. **Enable Encryption**: Encrypt SQS queues and DynamoDB tables
3. **Set Up DLQ**: Configure dead letter queues for failed messages
4. **Monitor Metrics**: Use CloudWatch for monitoring
5. **Use VPC**: Deploy Lambda functions in VPC for security
6. **Tag Resources**: Tag all resources for cost tracking
7. **Set Alarms**: Configure CloudWatch alarms for critical metrics
8. **Use Secrets Manager**: Store sensitive configuration in Secrets Manager
9. **Enable X-Ray**: Use AWS X-Ray for distributed tracing
10. **Implement Backup**: Enable point-in-time recovery for DynamoDB

## Cost Optimization

- Use on-demand billing for DynamoDB
- Set appropriate Lambda timeout values
- Use SQS long polling to reduce empty receives
- Archive old data to S3
- Use Lambda reserved concurrency for predictable workloads

## Troubleshooting

### Common Issues

**Lambda Timeout**:
- Increase timeout in function configuration
- Optimize agent logic
- Check for external API delays

**SQS Messages Not Processing**:
- Verify queue URL and permissions
- Check visibility timeout
- Review DLQ for failed messages

**DynamoDB Throttling**:
- Enable auto-scaling or use on-demand mode
- Check partition key distribution
- Review access patterns

**High Costs**:
- Review CloudWatch metrics
- Optimize function memory and timeout
- Check for message loops
- Review SQS message retention
