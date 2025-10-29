import { AgentId, AgentMessage, MessageId, MessagePriority } from '../types';

/**
 * Interface for message transport
 */
export interface MessageTransport {
  send(message: AgentMessage): Promise<void>;
  receive(agentId: AgentId): Promise<AgentMessage[]>;
  subscribe(agentId: AgentId, handler: MessageHandler): void;
  unsubscribe(agentId: AgentId): void;
}

/**
 * Message handler callback
 */
export type MessageHandler = (message: AgentMessage) => Promise<void>;

/**
 * Agent-to-Agent communication bus
 */
export class A2ACommunicationBus {
  private transport: MessageTransport;
  private messageHandlers: Map<AgentId, MessageHandler[]> = new Map();
  private messageQueue: Map<AgentId, AgentMessage[]> = new Map();

  constructor(transport: MessageTransport) {
    this.transport = transport;
  }

  /**
   * Send message from one agent to another
   */
  public async sendMessage(
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
  ): Promise<MessageId> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      from,
      to,
      type,
      payload,
      priority: options?.priority || MessagePriority.NORMAL,
      timestamp: Date.now(),
      correlationId: options?.correlationId,
      replyTo: options?.replyTo,
      metadata: options?.metadata
    };

    await this.transport.send(message);
    return message.id;
  }

  /**
   * Broadcast message to multiple agents
   */
  public async broadcast(
    from: AgentId,
    recipients: AgentId[],
    type: string,
    payload: unknown,
    options?: {
      priority?: MessagePriority;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<MessageId[]> {
    const messageIds: MessageId[] = [];

    for (const recipient of recipients) {
      const messageId = await this.sendMessage(from, recipient, type, payload, options);
      messageIds.push(messageId);
    }

    return messageIds;
  }

  /**
   * Subscribe to messages for an agent
   */
  public subscribe(agentId: AgentId, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(agentId) || [];
    handlers.push(handler);
    this.messageHandlers.set(agentId, handlers);

    // Also subscribe at transport level
    this.transport.subscribe(agentId, handler);
  }

  /**
   * Unsubscribe from messages
   */
  public unsubscribe(agentId: AgentId): void {
    this.messageHandlers.delete(agentId);
    this.transport.unsubscribe(agentId);
  }

  /**
   * Receive pending messages for an agent
   */
  public async receiveMessages(agentId: AgentId): Promise<AgentMessage[]> {
    // Get messages from transport
    const messages = await this.transport.receive(agentId);
    
    // Merge with any queued messages
    const queuedMessages = this.messageQueue.get(agentId) || [];
    this.messageQueue.delete(agentId);
    
    return [...queuedMessages, ...messages];
  }

  /**
   * Queue message for later delivery
   */
  public queueMessage(agentId: AgentId, message: AgentMessage): void {
    const queue = this.messageQueue.get(agentId) || [];
    queue.push(message);
    this.messageQueue.set(agentId, queue);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): MessageId {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * In-memory message transport for testing
 */
export class InMemoryMessageTransport implements MessageTransport {
  private messages: Map<AgentId, AgentMessage[]> = new Map();
  private handlers: Map<AgentId, MessageHandler[]> = new Map();

  async send(message: AgentMessage): Promise<void> {
    const queue = this.messages.get(message.to) || [];
    queue.push(message);
    this.messages.set(message.to, queue);

    // Notify handlers
    const handlers = this.handlers.get(message.to) || [];
    for (const handler of handlers) {
      await handler(message);
    }
  }

  async receive(agentId: AgentId): Promise<AgentMessage[]> {
    const messages = this.messages.get(agentId) || [];
    this.messages.set(agentId, []);
    return messages;
  }

  subscribe(agentId: AgentId, handler: MessageHandler): void {
    const handlers = this.handlers.get(agentId) || [];
    handlers.push(handler);
    this.handlers.set(agentId, handlers);
  }

  unsubscribe(agentId: AgentId): void {
    this.handlers.delete(agentId);
  }
}
