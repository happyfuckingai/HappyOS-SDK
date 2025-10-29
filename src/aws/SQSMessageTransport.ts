import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { AgentId, AgentMessage, AWSConfig } from '../types';
import { MessageTransport, MessageHandler } from '../communication/A2ACommunicationBus';

/**
 * AWS SQS-based message transport for A2A communication
 */
export class SQSMessageTransport implements MessageTransport {
  private client: SQSClient;
  private queueUrl: string;
  private handlers: Map<AgentId, MessageHandler[]> = new Map();
  private pollingIntervals: Map<AgentId, NodeJS.Timeout> = new Map();

  constructor(config: AWSConfig) {
    this.client = new SQSClient({
      region: config.region,
      endpoint: config.sqs?.endpoint
    });
    this.queueUrl = config.sqs?.queueUrl || '';
  }

  /**
   * Send message to SQS queue
   */
  async send(message: AgentMessage): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        to: {
          DataType: 'String',
          StringValue: message.to
        },
        from: {
          DataType: 'String',
          StringValue: message.from
        },
        priority: {
          DataType: 'String',
          StringValue: message.priority
        }
      }
    });

    await this.client.send(command);
  }

  /**
   * Receive messages from SQS queue for a specific agent
   */
  async receive(agentId: AgentId): Promise<AgentMessage[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
      MessageAttributeNames: ['All']
    });

    const response = await this.client.send(command);
    const messages: AgentMessage[] = [];

    if (response.Messages) {
      for (const sqsMessage of response.Messages) {
        if (sqsMessage.Body) {
          const message: AgentMessage = JSON.parse(sqsMessage.Body);
          
          // Filter messages for this agent
          if (message.to === agentId) {
            messages.push(message);
            
            // Delete processed message
            if (sqsMessage.ReceiptHandle) {
              await this.deleteMessage(sqsMessage.ReceiptHandle);
            }
          }
        }
      }
    }

    return messages;
  }

  /**
   * Subscribe to messages for an agent (start polling)
   */
  subscribe(agentId: AgentId, handler: MessageHandler): void {
    const handlers = this.handlers.get(agentId) || [];
    handlers.push(handler);
    this.handlers.set(agentId, handlers);

    // Start polling if not already started
    if (!this.pollingIntervals.has(agentId)) {
      const interval = setInterval(async () => {
        const messages = await this.receive(agentId);
        const agentHandlers = this.handlers.get(agentId) || [];
        
        for (const message of messages) {
          for (const h of agentHandlers) {
            await h(message);
          }
        }
      }, 5000); // Poll every 5 seconds

      this.pollingIntervals.set(agentId, interval);
    }
  }

  /**
   * Unsubscribe from messages (stop polling)
   */
  unsubscribe(agentId: AgentId): void {
    this.handlers.delete(agentId);
    
    const interval = this.pollingIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(agentId);
    }
  }

  /**
   * Delete message from queue
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle
    });

    await this.client.send(command);
  }

  /**
   * Cleanup and close connections
   */
  async cleanup(): Promise<void> {
    // Clear all polling intervals
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.handlers.clear();
  }
}
