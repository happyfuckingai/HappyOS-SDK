# HappyOS SDK Architecture

## Overview

HappyOS SDK is a comprehensive framework for building intelligent AI agent systems on AWS. The architecture is designed around three core principles:

1. **Agent Isolation** - Each agent operates in its own isolated context
2. **A2A Communication** - Agents communicate through a structured message bus
3. **Resilient Execution** - Built-in fallback patterns and retry logic

## Architecture Layers

### 1. Core Layer

The core layer provides the foundational building blocks:

```
┌─────────────────────────────────────┐
│          Agent (Abstract)           │
│  - Lifecycle Management             │
│  - Execution Context Isolation      │
│  - Error Handling                   │
│  - Metrics Collection               │
└─────────────────────────────────────┘
            ▲
            │ extends
            │
┌───────────┴─────────────────────────┐
│      Your Custom Agents             │
│  - ProcessorAgent                   │
│  - AnalyzerAgent                    │
│  - CoordinatorAgent                 │
└─────────────────────────────────────┘
```

**Key Classes:**
- `Agent` - Base class for all agents
- `FallbackManager` - Manages fallback strategies and circuit breakers

### 2. Communication Layer

Enables Agent-to-Agent (A2A) communication:

```
┌──────────────────────────────────────────┐
│      A2ACommunicationBus                 │
│  - Message Routing                       │
│  - Priority Handling                     │
│  - Correlation Tracking                  │
└──────────┬───────────────────────────────┘
           │
    ┌──────▼──────┐
    │  Transport  │
    └──┬──────┬───┘
       │      │
   ┌───▼──┐ ┌▼────────────┐
   │ SQS  │ │ InMemory    │
   └──────┘ └─────────────┘
```

**Key Classes:**
- `A2ACommunicationBus` - Message routing and delivery
- `MessageTransport` - Interface for transport implementations
- `InMemoryMessageTransport` - For testing and local development
- `SQSMessageTransport` - AWS SQS integration for production

### 3. Orchestration Layer

Manages agent lifecycle and coordination:

```
┌────────────────────────────────────────────┐
│         AgentOrchestrator                  │
│  - Agent Registration                      │
│  - Execution Management                    │
│  - Concurrency Control                     │
│  - Status Monitoring                       │
└────────┬──────────────────┬────────────────┘
         │                  │
    ┌────▼────────┐    ┌───▼──────────┐
    │  Fallback   │    │ Communication│
    │  Manager    │    │     Bus      │
    └─────────────┘    └──────────────┘
```

**Key Classes:**
- `AgentOrchestrator` - Central orchestration system
- Integration with FallbackManager and A2ACommunicationBus

### 4. AWS Integration Layer

AWS-native services integration:

```
┌─────────────────────────────────────────────┐
│           AWS Services                      │
├─────────────┬──────────┬─────────┬──────────┤
│   Lambda    │   SQS    │ DynamoDB│EventBridge│
└──────┬──────┴────┬─────┴────┬────┴─────┬────┘
       │           │          │          │
   ┌───▼────┐  ┌──▼───┐  ┌───▼───┐  ┌──▼───┐
   │Lambda  │  │ SQS  │  │DynamoDB│  │Event │
   │Executor│  │Trans-│  │ State │  │Bridge│
   │        │  │port  │  │ Store │  │Publ. │
   └────────┘  └──────┘  └───────┘  └──────┘
```

**Key Classes:**
- `LambdaAgentExecutor` - Execute agents as Lambda functions
- `SQSMessageTransport` - Message queue communication
- `DynamoDBStateStore` - Persistent state management
- `EventBridgePublisher` - Event publishing and tracking

## Data Flow

### Agent Execution Flow

```
1. Client Request
   ↓
2. Orchestrator.executeAgent()
   ↓
3. FallbackManager.executeWithFallback()
   ↓
4. Circuit Breaker Check
   ↓
5. Retry Logic
   ↓
6. Agent.execute()
   ↓
7. Agent.run() (your implementation)
   ↓
8. Collect Metrics
   ↓
9. Return Result
```

### Message Flow

```
1. Agent A sends message
   ↓
2. A2ACommunicationBus.sendMessage()
   ↓
3. MessageTransport.send() (SQS)
   ↓
4. Message in Queue
   ↓
5. MessageTransport.receive() (Agent B)
   ↓
6. Agent B.handleMessage()
   ↓
7. Process and respond
```

## Resilience Patterns

### Circuit Breaker

The circuit breaker pattern prevents cascading failures:

```
States:
  CLOSED → OPEN → HALF_OPEN → CLOSED
  
  CLOSED: Normal operation
  OPEN: Failures exceed threshold
  HALF_OPEN: Testing recovery
```

### Retry Logic

Exponential backoff with configurable parameters:

```typescript
{
  maxAttempts: 3,
  initialDelay: 1000,      // 1s
  backoffMultiplier: 2,    // 2x
  maxDelay: 30000          // 30s cap
}

// Example delays between retries:
// Attempt 1: Initial execution
// Delay: 1s (1000ms)
// Attempt 2: After 1s delay
// Delay: 2s (2000ms, 1000 * 2)
// Attempt 3: After 2s delay
// Note: All delays are under maxDelay (30s)
```


### Fallback Strategy

When primary agent fails:

```
Primary Agent Fails
   ↓
Circuit Breaker Opens
   ↓
Fallback Agent Invoked
   ↓
Success or Propagate Error
```

## Scalability

### Horizontal Scaling

- **Lambda**: Auto-scales based on demand
- **SQS**: Distributed message queue
- **DynamoDB**: Auto-scaling capacity
- **EventBridge**: Handles high throughput

### Vertical Scaling

- **Agent Configuration**: Memory and timeout settings
- **Concurrent Limits**: Control resource usage
- **Message Batching**: Optimize throughput

## Security

### Isolation

- Each agent runs in isolated context
- Separate execution environments
- No shared state between agents

### AWS Security

- IAM roles for service access
- VPC integration for Lambda
- Encrypted SQS queues
- DynamoDB encryption at rest

## Monitoring

### Metrics

Collected automatically:
- Execution time
- Memory usage
- Retry count
- Message count

### Events

Published to EventBridge:
- Agent started
- Agent completed
- Agent failed
- Messages sent/received
- Circuit breaker state changes

## Best Practices

1. **Keep Agents Small**: Single responsibility principle
2. **Use Correlation IDs**: Track related operations
3. **Configure Timeouts**: Prevent hanging operations
4. **Monitor Circuit Breakers**: Watch for frequent opens
5. **Handle Errors Gracefully**: Implement proper error handling
6. **Test with InMemory**: Use InMemoryTransport for testing
7. **Log Appropriately**: Use structured logging
8. **Version Your Agents**: Track agent versions in metadata

## Extension Points

### Custom Agents

```typescript
class CustomAgent extends Agent {
  protected async run(input: unknown): Promise<unknown> {
    // Your logic
  }
  
  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    // Your message handling
  }
}
```

### Custom Transports

```typescript
class CustomTransport implements MessageTransport {
  async send(message: AgentMessage): Promise<void> { }
  async receive(agentId: AgentId): Promise<AgentMessage[]> { }
  subscribe(agentId: AgentId, handler: MessageHandler): void { }
  unsubscribe(agentId: AgentId): void { }
}
```

### Custom State Stores

Implement your own state management by following the DynamoDB pattern.

## Performance Considerations

- **Message Size**: Keep messages small for better throughput
- **Batch Operations**: Use batch operations where possible
- **Caching**: Implement caching for frequently accessed data
- **Connection Pooling**: Reuse AWS SDK clients
- **Async Operations**: Use async message sending for fire-and-forget

## Troubleshooting

### Common Issues

1. **Circuit Breaker Open**: Check agent health and logs
2. **Message Delays**: Verify SQS queue configuration
3. **High Memory Usage**: Review agent implementation
4. **Timeout Errors**: Increase timeout configuration
5. **Failed Messages**: Check DLQ for failed messages
