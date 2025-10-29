/**
 * HappyOS SDK - AI Agent Operating System Framework
 * 100% AWS Native
 * 
 * Core framework for building, running and orchestrating intelligent AI agent systems
 * with full isolation, A2A communication, and resilient fallback patterns.
 */

// Core exports
export { Agent } from './core/Agent';
export { FallbackManager } from './core/FallbackManager';

// Communication exports
export {
  A2ACommunicationBus,
  MessageTransport,
  MessageHandler,
  InMemoryMessageTransport
} from './communication/A2ACommunicationBus';

// Orchestration exports
export {
  AgentOrchestrator,
  OrchestratorConfig
} from './orchestration/AgentOrchestrator';

// AWS integrations exports
export { SQSMessageTransport } from './aws/SQSMessageTransport';
export { DynamoDBStateStore, AgentState } from './aws/DynamoDBStateStore';
export { LambdaAgentExecutor } from './aws/LambdaAgentExecutor';
export {
  EventBridgePublisher,
  AgentEvent,
  AgentEventType
} from './aws/EventBridgePublisher';

// Type exports
export {
  AgentId,
  MessageId,
  AgentStatus,
  MessagePriority,
  AgentConfig,
  RetryPolicy,
  AgentMessage,
  AgentContext,
  AgentResult,
  AgentError,
  AgentMetrics,
  FallbackConfig,
  AWSConfig
} from './types';

// Utility exports
export {
  generateId,
  retryWithBackoff,
  sleep,
  withTimeout,
  deepClone,
  isEmpty,
  deepMerge,
  validateRequired
} from './utils/helpers';

/**
 * HappyOS SDK version
 */
export const VERSION = '1.0.0';

/**
 * SDK information
 */
export const SDK_INFO = {
  name: '@happyos/sdk',
  version: VERSION,
  description: 'AI Agent Operating System Framework - 100% AWS Native',
  features: [
    'Agent Isolation',
    'A2A Communication',
    'Resilient Fallback Patterns',
    'AWS Native Integration',
    'Circuit Breaker Pattern',
    'Retry Logic',
    'Event-Driven Architecture'
  ]
};
