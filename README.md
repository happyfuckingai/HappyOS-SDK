# HappyOS SDK

**AI Agent Operating System Framework — 100% AWS Native**

HappyOS SDK är kärnan i hela Happy Ecosystem: ett öppet ramverk för att bygga, driva och orkestrera intelligenta AI-agentsystem med full isolering, A2A-kommunikation (Agent-to-Agent) och resilienta fallback-mönster.

## 🌟 Funktioner

- **Agent Isolation**: Fullständig isolering av agenter för säker och oberoende exekvering
- **A2A Communication**: Agent-to-Agent kommunikation via SQS och EventBridge
- **Resilient Fallback**: Circuit breaker pattern och automatiska fallback-strategier
- **AWS Native**: 100% AWS-native integration med Lambda, DynamoDB, SQS, och EventBridge
- **Orchestration**: Intelligent orkestrering av agentlivscykler
- **Retry Logic**: Konfigurerbar retry-logik med exponentiell backoff
- **Event-Driven**: Event-driven arkitektur för skalbarhet

## 📦 Installation

```bash
npm install @happyos/sdk
```

## 🚀 Snabbstart

### Grundläggande Agent

```typescript
import { Agent, AgentContext, AgentMessage, AgentResult } from '@happyos/sdk';

class MyAgent extends Agent {
  protected async run(input: unknown): Promise<unknown> {
    // Din agent-logik här
    return { processed: input };
  }

  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    // Hantera inkommande meddelanden
    return await this.execute(
      { agentId: this.getId(), requestId: message.id, timestamp: Date.now() },
      message.payload
    );
  }
}

// Skapa agent
const agent = new MyAgent({
  id: 'my-agent-1',
  name: 'My First Agent',
  type: 'processor',
  timeout: 30000,
  retryPolicy: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelay: 1000
  }
});
```

### Orchestrator med A2A Kommunikation

```typescript
import {
  AgentOrchestrator,
  A2ACommunicationBus,
  InMemoryMessageTransport
} from '@happyos/sdk';

// Skapa kommunikationsbuss
const transport = new InMemoryMessageTransport();
const communicationBus = new A2ACommunicationBus(transport);

// Skapa orchestrator
const orchestrator = new AgentOrchestrator(communicationBus, {
  fallbackEnabled: true,
  maxConcurrentAgents: 10
});

// Registrera agenter
orchestrator.registerAgent(agent1);
orchestrator.registerAgent(agent2);

// Exekvera agent
const result = await orchestrator.executeAgent('my-agent-1', { data: 'test' });

// Skicka meddelande mellan agenter
await orchestrator.sendMessage(
  'agent-1',
  'agent-2',
  'process-request',
  { taskId: 123 }
);
```

### AWS Integration

```typescript
import {
  SQSMessageTransport,
  DynamoDBStateStore,
  LambdaAgentExecutor,
  EventBridgePublisher,
  AWSConfig
} from '@happyos/sdk';

const awsConfig: AWSConfig = {
  region: 'eu-north-1',
  sqs: {
    queueUrl: 'https://sqs.eu-north-1.amazonaws.com/xxx/happyos-queue'
  },
  dynamodb: {
    tableName: 'HappyOS-Agents'
  },
  lambda: {
    functionPrefix: 'happyos-agent'
  },
  eventbridge: {
    eventBusName: 'happyos-events'
  }
};

// SQS-baserad kommunikation
const sqsTransport = new SQSMessageTransport(awsConfig);
const communicationBus = new A2ACommunicationBus(sqsTransport);

// DynamoDB state management
const stateStore = new DynamoDBStateStore(awsConfig);
await stateStore.saveAgentState({
  agentId: 'agent-1',
  status: 'RUNNING',
  config: agentConfig,
  lastUpdated: Date.now(),
  executionCount: 1
});

// Lambda execution
const lambdaExecutor = new LambdaAgentExecutor(awsConfig);
const result = await lambdaExecutor.executeAgent('agent-1', context, input);

// EventBridge events
const eventPublisher = new EventBridgePublisher(awsConfig);
await eventPublisher.publishAgentStarted('agent-1', { version: '1.0' });
```

### Fallback och Resilience

```typescript
import { FallbackManager } from '@happyos/sdk';

const fallbackManager = new FallbackManager();

// Registrera agenter
fallbackManager.registerAgent(primaryAgent);
fallbackManager.registerAgent(fallbackAgent);

// Exekvera med fallback
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

// Kontrollera circuit breaker status
const circuitState = fallbackManager.getCircuitState('primary-agent');
```

## 🏗️ Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentOrchestrator                        │
│  - Lifecycle Management                                     │
│  - Agent Registration                                       │
│  - Execution Coordination                                   │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
     ┌────────▼─────────┐        ┌───────▼──────────┐
     │  FallbackManager │        │ A2ACommunication │
     │  - Circuit Breaker│        │ - Message Routing│
     │  - Retry Logic   │        │ - Event Bus      │
     └────────┬─────────┘        └───────┬──────────┘
              │                           │
     ┌────────▼──────────────────────────▼──────────┐
     │              AWS Services                     │
     │  - Lambda (Execution)                        │
     │  - SQS (Messaging)                           │
     │  - DynamoDB (State)                          │
     │  - EventBridge (Events)                      │
     └───────────────────────────────────────────────┘
```

## 📚 Core Concepts

### Agent Isolation
Varje agent körs i sin egen isolerade kontext med:
- Egen konfiguration
- Oberoende lifecycle
- Separat state management
- Isolerad error handling

### A2A Communication
Agent-to-Agent kommunikation via:
- **Message Queue**: SQS för asynkron kommunikation
- **Event Bus**: EventBridge för event-driven patterns
- **Priority Handling**: Olika prioritetsnivåer för meddelanden
- **Correlation**: Spåra relaterade meddelanden

### Fallback Patterns
Resilient exekvering med:
- **Circuit Breaker**: Automatisk failover vid upprepade fel
- **Retry Logic**: Exponentiell backoff för transient errors
- **Fallback Agents**: Alternativa agenter vid primär failure
- **Health Monitoring**: Kontinuerlig övervakning av agent health

## 🔧 Konfiguration

### Agent Configuration

```typescript
interface AgentConfig {
  id: string;                    // Unikt agent-ID
  name: string;                  // Läsbart namn
  type: string;                  // Agent-typ
  memory?: {
    maxSize?: number;            // Max minnesstorlek
    ttl?: number;                // Time-to-live
  };
  timeout?: number;              // Execution timeout (ms)
  retryPolicy?: {
    maxAttempts: number;         // Max retry-försök
    backoffMultiplier?: number;  // Backoff-multiplikator
    initialDelay?: number;       // Initial delay (ms)
    maxDelay?: number;           // Max delay (ms)
  };
  fallbackAgent?: string;        // Fallback agent-ID
  metadata?: Record<string, unknown>;
}
```

### AWS Configuration

```typescript
interface AWSConfig {
  region: string;                // AWS region
  dynamodb?: {
    tableName: string;
    endpoint?: string;           // Optional för local testing
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

## 🧪 Testing

```bash
# Kör tester
npm test

# Kör med coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## 🏗️ Bygg

```bash
# Bygg projektet
npm run build

# Lint kod
npm run lint
```

## 📖 Exempel

Se `examples/` katalogen för kompletta exempel:
- Basic Agent
- Multi-Agent System
- AWS Integration
- Resilient Patterns

## 🤝 Bidra

Vi välkomnar bidrag! Se [CONTRIBUTING.md](CONTRIBUTING.md) för riktlinjer.

## 📄 Licens

MIT License - se [LICENSE](LICENSE) för detaljer.

## 🔗 Länkar

- **GitHub**: https://github.com/happyfuckingai/HappyOS-SDK
- **NPM**: https://www.npmjs.com/package/@happyos/sdk
- **Documentation**: https://docs.happyos.dev
- **Happy Ecosystem**: https://happyos.dev

## 💬 Support

- **Issues**: https://github.com/happyfuckingai/HappyOS-SDK/issues
- **Discord**: https://discord.gg/happyos
- **Email**: support@happyos.dev

---

**Built with ❤️ by Happy Ecosystem**
