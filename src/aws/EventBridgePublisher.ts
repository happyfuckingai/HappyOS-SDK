import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { AgentId, AgentMessage, AWSConfig } from '../types';

/**
 * Event types for agent system
 */
export enum AgentEventType {
  AGENT_STARTED = 'agent.started',
  AGENT_COMPLETED = 'agent.completed',
  AGENT_FAILED = 'agent.failed',
  MESSAGE_SENT = 'message.sent',
  MESSAGE_RECEIVED = 'message.received',
  FALLBACK_TRIGGERED = 'fallback.triggered',
  CIRCUIT_BREAKER_OPENED = 'circuit.breaker.opened',
  CIRCUIT_BREAKER_CLOSED = 'circuit.breaker.closed'
}

/**
 * Agent event
 */
export interface AgentEvent {
  type: AgentEventType;
  agentId: AgentId;
  timestamp: number;
  data?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * AWS EventBridge-based event publisher
 */
export class EventBridgePublisher {
  private client: EventBridgeClient;
  private eventBusName: string;
  private sourcePrefix: string;

  constructor(config: AWSConfig) {
    this.client = new EventBridgeClient({
      region: config.region,
      endpoint: config.eventbridge?.endpoint
    });
    this.eventBusName = config.eventbridge?.eventBusName || 'happyos-events';
    this.sourcePrefix = 'happyos.agent';
  }

  /**
   * Publish agent event
   */
  async publishEvent(event: AgentEvent): Promise<void> {
    const command = new PutEventsCommand({
      Entries: [
        {
          EventBusName: this.eventBusName,
          Source: this.sourcePrefix,
          DetailType: event.type,
          Detail: JSON.stringify({
            agentId: event.agentId,
            timestamp: event.timestamp,
            data: event.data,
            metadata: event.metadata
          }),
          Time: new Date(event.timestamp)
        }
      ]
    });

    await this.client.send(command);
  }

  /**
   * Publish multiple events in batch
   */
  async publishEvents(events: AgentEvent[]): Promise<void> {
    // EventBridge allows max 10 events per batch
    const batches = this.chunk(events, 10);

    for (const batch of batches) {
      const command = new PutEventsCommand({
        Entries: batch.map(event => ({
          EventBusName: this.eventBusName,
          Source: this.sourcePrefix,
          DetailType: event.type,
          Detail: JSON.stringify({
            agentId: event.agentId,
            timestamp: event.timestamp,
            data: event.data,
            metadata: event.metadata
          }),
          Time: new Date(event.timestamp)
        }))
      });

      await this.client.send(command);
    }
  }

  /**
   * Publish agent lifecycle event
   */
  async publishAgentStarted(agentId: AgentId, metadata?: Record<string, unknown>): Promise<void> {
    await this.publishEvent({
      type: AgentEventType.AGENT_STARTED,
      agentId,
      timestamp: Date.now(),
      metadata
    });
  }

  async publishAgentCompleted(
    agentId: AgentId,
    result: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.publishEvent({
      type: AgentEventType.AGENT_COMPLETED,
      agentId,
      timestamp: Date.now(),
      data: result,
      metadata
    });
  }

  async publishAgentFailed(
    agentId: AgentId,
    error: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.publishEvent({
      type: AgentEventType.AGENT_FAILED,
      agentId,
      timestamp: Date.now(),
      data: error,
      metadata
    });
  }

  /**
   * Publish message event
   */
  async publishMessageSent(message: AgentMessage): Promise<void> {
    await this.publishEvent({
      type: AgentEventType.MESSAGE_SENT,
      agentId: message.from,
      timestamp: Date.now(),
      data: {
        messageId: message.id,
        to: message.to,
        type: message.type
      }
    });
  }

  async publishMessageReceived(message: AgentMessage): Promise<void> {
    await this.publishEvent({
      type: AgentEventType.MESSAGE_RECEIVED,
      agentId: message.to,
      timestamp: Date.now(),
      data: {
        messageId: message.id,
        from: message.from,
        type: message.type
      }
    });
  }

  /**
   * Utility to chunk array
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
