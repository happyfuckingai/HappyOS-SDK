/**
 * Core types for HappyOS SDK
 */

/**
 * Agent identifier
 */
export type AgentId = string;

/**
 * Message identifier
 */
export type MessageId = string;

/**
 * Agent execution status
 */
export enum AgentStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SUSPENDED = 'SUSPENDED'
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Agent configuration
 */
export interface AgentConfig {
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

/**
 * Retry policy for agent operations
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier?: number;
  initialDelay?: number;
  maxDelay?: number;
}

/**
 * Message between agents
 */
export interface AgentMessage {
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

/**
 * Agent execution context
 */
export interface AgentContext {
  agentId: AgentId;
  requestId: string;
  correlationId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: AgentError;
  metrics?: AgentMetrics;
}

/**
 * Agent error information
 */
export interface AgentError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

/**
 * Agent metrics
 */
export interface AgentMetrics {
  executionTime: number;
  memoryUsed?: number;
  messagesProcessed?: number;
  retryCount?: number;
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  enabled: boolean;
  fallbackAgentId?: AgentId;
  maxFallbackAttempts?: number;
  fallbackStrategy?: 'circuit-breaker' | 'retry' | 'delegate';
}

/**
 * AWS configuration for HappyOS
 */
export interface AWSConfig {
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
