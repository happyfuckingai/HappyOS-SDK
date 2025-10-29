# API Reference

## Core Classes

### Agent

Abstract base class for all agents.

```typescript
abstract class Agent {
  constructor(config: AgentConfig)
  
  // Public methods
  public getId(): string
  public getStatus(): AgentStatus
  public getConfig(): AgentConfig
  public async execute(context: AgentContext, input: unknown): Promise<AgentResult>
  public abstract handleMessage(message: AgentMessage): Promise<AgentResult>
  public suspend(): void
  public resume(): void
  
  // Protected methods (for subclasses)
  protected abstract run(input: unknown): Promise<unknown>
  protected collectMetrics(): AgentMetrics
  protected getMemoryUsage(): number
  protected formatError(error: unknown): AgentError
  protected cleanup(): void
}
```

**Usage:**

```typescript
class MyAgent extends Agent {
  protected async run(input: unknown): Promise<unknown> {
    // Your implementation
    return result;
  }
  
  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    // Handle incoming messages
    return await this.execute(context, message.payload);
  }
}
```

### FallbackManager

Manages fallback strategies and circuit breakers.

```typescript
class FallbackManager {
  // Register agent
  registerAgent(agent: Agent): void
  
  // Execute with fallback support
  async executeWithFallback(
    agentId: AgentId,
    context: AgentContext,
    input: unknown,
    fallbackConfig: FallbackConfig
  ): Promise<AgentResult>
  
  // Get circuit breaker state
  getCircuitState(agentId: AgentId): CircuitState | undefined
}
```

**Usage:**

```typescript
const fallbackManager = new FallbackManager();
fallbackManager.registerAgent(primaryAgent);
fallbackManager.registerAgent(fallbackAgent);

const result = await fallbackManager.executeWithFallback(
  'primary-agent',
  context,
  input,
  {
    enabled: true,
    fallbackAgentId: 'fallback-agent',
    maxFallbackAttempts: 2,
    fallbackStrategy: 'circuit-breaker'
  }
);
```

## Communication Classes

### A2ACommunicationBus

Agent-to-Agent communication bus.

```typescript
class A2ACommunicationBus {
  constructor(transport: MessageTransport)
  
  // Send message
  async sendMessage(
    from: AgentId,
    to: AgentId,
    type: string,
    payload: unknown,
    options?: {
      priority?: MessagePriority;
      correlationId?: string;
      replyTo?: AgentId;
      metadata?: Record<string, unknown>;
    }
  ): Promise<MessageId>
  
  // Broadcast to multiple agents
  async broadcast(
    from: AgentId,
    recipients: AgentId[],
    type: string,
    payload: unknown,
    options?: { ... }
  ): Promise<MessageId[]>
  
  // Subscribe to messages
  subscribe(agentId: AgentId, handler: MessageHandler): void
  
  // Unsubscribe
  unsubscribe(agentId: AgentId): void
  
  // Receive pending messages
  async receiveMessages(agentId: AgentId): Promise<AgentMessage[]>
}
```

**Usage:**

```typescript
const bus = new A2ACommunicationBus(transport);

// Send message
await bus.sendMessage('agent-1', 'agent-2', 'task', { data: 'test' });

// Subscribe
bus.subscribe('agent-2', async (message) => {
  console.log('Received:', message);
});

// Broadcast
await bus.broadcast('agent-1', ['agent-2', 'agent-3'], 'notification', {});
```

### MessageTransport

Interface for message transport implementations.

```typescript
interface MessageTransport {
  send(message: AgentMessage): Promise<void>
  receive(agentId: AgentId): Promise<AgentMessage[]>
  subscribe(agentId: AgentId, handler: MessageHandler): void
  unsubscribe(agentId: AgentId): void
}
```

### InMemoryMessageTransport

In-memory transport for testing.

```typescript
class InMemoryMessageTransport implements MessageTransport {
  // Implements MessageTransport interface
}
```

**Usage:**

```typescript
const transport = new InMemoryMessageTransport();
const bus = new A2ACommunicationBus(transport);
```

## Orchestration Classes

### AgentOrchestrator

Main orchestration system.

```typescript
class AgentOrchestrator {
  constructor(
    communicationBus: A2ACommunicationBus,
    config?: OrchestratorConfig
  )
  
  // Agent management
  registerAgent(agent: Agent): void
  unregisterAgent(agentId: AgentId): void
  getRegisteredAgents(): AgentConfig[]
  
  // Execution
  async executeAgent(
    agentId: AgentId,
    input: unknown,
    context?: Partial<AgentContext>
  ): Promise<AgentResult>
  
  // Communication
  async sendMessage(
    fromAgentId: AgentId,
    toAgentId: AgentId,
    type: string,
    payload: unknown,
    options?: { ... }
  ): Promise<string>
  
  async broadcastMessage(
    fromAgentId: AgentId,
    recipients: AgentId[],
    type: string,
    payload: unknown
  ): Promise<string[]>
  
  // Status
  getAgentStatus(agentId: AgentId): string | undefined
  getCircuitState(agentId: AgentId): string | undefined
  getRunningAgentCount(): number
  
  // Lifecycle
  async shutdown(): Promise<void>
}
```

**Usage:**

```typescript
const orchestrator = new AgentOrchestrator(communicationBus, {
  fallbackEnabled: true,
  maxConcurrentAgents: 10
});

orchestrator.registerAgent(agent);
const result = await orchestrator.executeAgent('agent-1', { data: 'test' });
```

## AWS Integration Classes

### SQSMessageTransport

AWS SQS-based message transport.

```typescript
class SQSMessageTransport implements MessageTransport {
  constructor(config: AWSConfig)
  
  // Implements MessageTransport
  async send(message: AgentMessage): Promise<void>
  async receive(agentId: AgentId): Promise<AgentMessage[]>
  subscribe(agentId: AgentId, handler: MessageHandler): void
  unsubscribe(agentId: AgentId): void
  
  // Cleanup
  async cleanup(): Promise<void>
}
```

**Usage:**

```typescript
const transport = new SQSMessageTransport({
  region: 'eu-north-1',
  sqs: {
    queueUrl: 'https://sqs.eu-north-1.amazonaws.com/xxx/queue'
  }
});
```

### DynamoDBStateStore

DynamoDB-based state management.

```typescript
class DynamoDBStateStore {
  constructor(config: AWSConfig)
  
  // State management
  async saveAgentState(state: AgentState): Promise<void>
  async getAgentState(agentId: AgentId): Promise<AgentState | null>
  async updateAgentStatus(agentId: AgentId, status: AgentStatus): Promise<void>
  async incrementExecutionCount(agentId: AgentId): Promise<void>
  async queryAllAgents(): Promise<AgentState[]>
  async deleteAgentState(agentId: AgentId): Promise<void>
}
```

**Usage:**

```typescript
const stateStore = new DynamoDBStateStore({
  region: 'eu-north-1',
  dynamodb: { tableName: 'HappyOS-Agents' }
});

await stateStore.saveAgentState({
  agentId: 'agent-1',
  status: AgentStatus.RUNNING,
  config: agentConfig,
  lastUpdated: Date.now(),
  executionCount: 1
});
```

### LambdaAgentExecutor

Execute agents as Lambda functions.

```typescript
class LambdaAgentExecutor {
  constructor(config: AWSConfig)
  
  // Execution
  async executeAgent(
    agentId: AgentId,
    context: AgentContext,
    input: unknown
  ): Promise<AgentResult>
  
  async executeAgentAsync(
    agentId: AgentId,
    context: AgentContext,
    input: unknown
  ): Promise<void>
  
  // Utility
  async functionExists(agentId: AgentId): Promise<boolean>
}
```

### EventBridgePublisher

Publish events to AWS EventBridge.

```typescript
class EventBridgePublisher {
  constructor(config: AWSConfig)
  
  // Event publishing
  async publishEvent(event: AgentEvent): Promise<void>
  async publishEvents(events: AgentEvent[]): Promise<void>
  
  // Lifecycle events
  async publishAgentStarted(agentId: AgentId, metadata?: Record<string, unknown>): Promise<void>
  async publishAgentCompleted(agentId: AgentId, result: unknown, metadata?: Record<string, unknown>): Promise<void>
  async publishAgentFailed(agentId: AgentId, error: unknown, metadata?: Record<string, unknown>): Promise<void>
  
  // Message events
  async publishMessageSent(message: AgentMessage): Promise<void>
  async publishMessageReceived(message: AgentMessage): Promise<void>
}
```

## Utility Functions

### generateId

Generate unique identifier.

```typescript
function generateId(prefix: string): string
```

### retryWithBackoff

Retry function with exponential backoff.

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  initialDelay?: number,
  backoffMultiplier?: number,
  maxDelay?: number
): Promise<T>
```

### withTimeout

Wrap promise with timeout.

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T>
```

### deepClone

Deep clone object.

```typescript
function deepClone<T>(obj: T): T
```

### deepMerge

Deep merge objects.

```typescript
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T
```

### validateRequired

Validate required fields.

```typescript
function validateRequired<T extends Record<string, unknown>>(
  obj: T,
  requiredFields: (keyof T)[]
): void
```

## Type Definitions

### AgentConfig

```typescript
interface AgentConfig {
  id: AgentId;
  name: string;
  type: string;
  memory?: {
    maxSize?: number;
    ttl?: number;
  };
  timeout?: number;
  retryPolicy?: RetryPolicy;
  fallbackAgent?: AgentId;
  metadata?: Record<string, unknown>;
}
```

### AgentMessage

```typescript
interface AgentMessage {
  id: MessageId;
  from: AgentId;
  to: AgentId;
  type: string;
  payload: unknown;
  priority: MessagePriority;
  timestamp: number;
  correlationId?: string;
  replyTo?: AgentId;
  metadata?: Record<string, unknown>;
}
```

### AgentResult

```typescript
interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: AgentError;
  metrics?: AgentMetrics;
}
```

### AWSConfig

```typescript
interface AWSConfig {
  region: string;
  dynamodb?: {
    tableName: string;
    endpoint?: string;
  };
  sqs?: {
    queueUrl: string;
    endpoint?: string;
  };
  lambda?: {
    functionPrefix?: string;
    endpoint?: string;
  };
  eventbridge?: {
    eventBusName: string;
    endpoint?: string;
  };
}
```

## Enums

### AgentStatus

```typescript
enum AgentStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SUSPENDED = 'SUSPENDED'
}
```

### MessagePriority

```typescript
enum MessagePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}
```

### AgentEventType

```typescript
enum AgentEventType {
  AGENT_STARTED = 'agent.started',
  AGENT_COMPLETED = 'agent.completed',
  AGENT_FAILED = 'agent.failed',
  MESSAGE_SENT = 'message.sent',
  MESSAGE_RECEIVED = 'message.received',
  FALLBACK_TRIGGERED = 'fallback.triggered',
  CIRCUIT_BREAKER_OPENED = 'circuit.breaker.opened',
  CIRCUIT_BREAKER_CLOSED = 'circuit.breaker.closed'
}
```
