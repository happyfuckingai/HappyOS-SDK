import {
  A2ACommunicationBus,
  InMemoryMessageTransport
} from '../communication/A2ACommunicationBus';
import { MessagePriority } from '../types';

describe('A2ACommunicationBus', () => {
  let transport: InMemoryMessageTransport;
  let bus: A2ACommunicationBus;

  beforeEach(() => {
    transport = new InMemoryMessageTransport();
    bus = new A2ACommunicationBus(transport);
  });

  describe('Message Sending', () => {
    it('should send message between agents', async () => {
      const messageId = await bus.sendMessage(
        'agent-1',
        'agent-2',
        'test-message',
        { data: 'test' }
      );

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
    });

    it('should broadcast to multiple agents', async () => {
      const messageIds = await bus.broadcast(
        'agent-1',
        ['agent-2', 'agent-3', 'agent-4'],
        'broadcast-message',
        { data: 'test' }
      );

      expect(messageIds).toHaveLength(3);
    });

    it('should set message priority', async () => {
      let receivedMessage: any;

      bus.subscribe('agent-2', async (message) => {
        receivedMessage = message;
      });

      await bus.sendMessage(
        'agent-1',
        'agent-2',
        'high-priority',
        { data: 'urgent' },
        { priority: MessagePriority.HIGH }
      );

      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.priority).toBe(MessagePriority.HIGH);
    });
  });

  describe('Message Receiving', () => {
    it('should receive messages for agent', async () => {
      await bus.sendMessage('agent-1', 'agent-2', 'test', { data: 'test' });
      
      const messages = await bus.receiveMessages('agent-2');
      
      expect(messages).toHaveLength(1);
      expect(messages[0].from).toBe('agent-1');
      expect(messages[0].to).toBe('agent-2');
    });

    it('should not receive messages for other agents', async () => {
      await bus.sendMessage('agent-1', 'agent-2', 'test', { data: 'test' });
      
      const messages = await bus.receiveMessages('agent-3');
      
      expect(messages).toHaveLength(0);
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers of messages', async () => {
      let messageReceived = false;

      bus.subscribe('agent-2', async () => {
        messageReceived = true;
      });

      await bus.sendMessage('agent-1', 'agent-2', 'test', { data: 'test' });

      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messageReceived).toBe(true);
    });

    it('should unsubscribe from messages', async () => {
      let callCount = 0;

      bus.subscribe('agent-2', async () => {
        callCount++;
      });

      await bus.sendMessage('agent-1', 'agent-2', 'test', { data: 'test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      bus.unsubscribe('agent-2');

      await bus.sendMessage('agent-1', 'agent-2', 'test', { data: 'test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(callCount).toBe(1);
    });
  });

  describe('Correlation', () => {
    it('should preserve correlation ID', async () => {
      let receivedMessage: any;

      bus.subscribe('agent-2', async (message) => {
        receivedMessage = message;
      });

      await bus.sendMessage(
        'agent-1',
        'agent-2',
        'test',
        { data: 'test' },
        { correlationId: 'corr-123' }
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessage.correlationId).toBe('corr-123');
    });
  });
});
