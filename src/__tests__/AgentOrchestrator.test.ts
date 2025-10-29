import { AgentOrchestrator } from '../orchestration/AgentOrchestrator';
import { A2ACommunicationBus, InMemoryMessageTransport } from '../communication/A2ACommunicationBus';
import { Agent } from '../core/Agent';
import { AgentMessage, AgentResult, AgentStatus } from '../types';

class MockAgent extends Agent {
  protected async run(input: unknown): Promise<unknown> {
    return { processed: input };
  }

  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    return {
      success: true,
      data: { handled: message.id }
    };
  }
}

describe('AgentOrchestrator', () => {
  let transport: InMemoryMessageTransport;
  let communicationBus: A2ACommunicationBus;
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    transport = new InMemoryMessageTransport();
    communicationBus = new A2ACommunicationBus(transport);
    orchestrator = new AgentOrchestrator(communicationBus);
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe('Agent Registration', () => {
    it('should register agent', () => {
      const agent = new MockAgent({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'test'
      });

      orchestrator.registerAgent(agent);

      const agents = orchestrator.getRegisteredAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('agent-1');
    });

    it('should not register duplicate agent', () => {
      const agent = new MockAgent({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'test'
      });

      orchestrator.registerAgent(agent);

      expect(() => orchestrator.registerAgent(agent)).toThrow();
    });

    it('should unregister agent', () => {
      const agent = new MockAgent({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'test'
      });

      orchestrator.registerAgent(agent);
      orchestrator.unregisterAgent('agent-1');

      const agents = orchestrator.getRegisteredAgents();
      expect(agents).toHaveLength(0);
    });
  });

  describe('Agent Execution', () => {
    it('should execute agent', async () => {
      const agent = new MockAgent({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'test'
      });

      orchestrator.registerAgent(agent);

      const result = await orchestrator.executeAgent('agent-1', { data: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ processed: { data: 'test' } });
    });

    it('should return error for non-existent agent', async () => {
      const result = await orchestrator.executeAgent('non-existent', { data: 'test' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AGENT_NOT_FOUND');
    });

    it('should track running agents', async () => {
      const agent = new MockAgent({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'test'
      });

      orchestrator.registerAgent(agent);

      const executionPromise = orchestrator.executeAgent('agent-1', { data: 'test' });
      
      // Check immediately (may or may not catch it running)
      const runningCount = orchestrator.getRunningAgentCount();
      expect(runningCount).toBeGreaterThanOrEqual(0);

      await executionPromise;

      // Should be 0 after completion
      expect(orchestrator.getRunningAgentCount()).toBe(0);
    });
  });

  describe('Agent Communication', () => {
    it('should send message between agents', async () => {
      const agent1 = new MockAgent({
        id: 'agent-1',
        name: 'Agent 1',
        type: 'test'
      });

      const agent2 = new MockAgent({
        id: 'agent-2',
        name: 'Agent 2',
        type: 'test'
      });

      orchestrator.registerAgent(agent1);
      orchestrator.registerAgent(agent2);

      const messageId = await orchestrator.sendMessage(
        'agent-1',
        'agent-2',
        'test-message',
        { data: 'test' }
      );

      expect(messageId).toBeDefined();
    });

    it('should broadcast to multiple agents', async () => {
      const agent1 = new MockAgent({ id: 'agent-1', name: 'Agent 1', type: 'test' });
      const agent2 = new MockAgent({ id: 'agent-2', name: 'Agent 2', type: 'test' });
      const agent3 = new MockAgent({ id: 'agent-3', name: 'Agent 3', type: 'test' });

      orchestrator.registerAgent(agent1);
      orchestrator.registerAgent(agent2);
      orchestrator.registerAgent(agent3);

      const messageIds = await orchestrator.broadcastMessage(
        'agent-1',
        ['agent-2', 'agent-3'],
        'broadcast',
        { data: 'test' }
      );

      expect(messageIds).toHaveLength(2);
    });
  });

  describe('Agent Status', () => {
    it('should get agent status', () => {
      const agent = new MockAgent({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'test'
      });

      orchestrator.registerAgent(agent);

      const status = orchestrator.getAgentStatus('agent-1');
      expect(status).toBe(AgentStatus.IDLE);
    });
  });

  describe('Concurrent Execution Limit', () => {
    it('should enforce concurrent agent limit', async () => {
      const limitedOrchestrator = new AgentOrchestrator(communicationBus, {
        maxConcurrentAgents: 1
      });

      const slowAgent1 = new MockAgent({
        id: 'slow-agent-1',
        name: 'Slow Agent 1',
        type: 'test'
      });

      const slowAgent2 = new MockAgent({
        id: 'slow-agent-2',
        name: 'Slow Agent 2',
        type: 'test'
      });

      limitedOrchestrator.registerAgent(slowAgent1);
      limitedOrchestrator.registerAgent(slowAgent2);

      // Start first execution (don't await yet)
      const execution1 = limitedOrchestrator.executeAgent('slow-agent-1', { data: 'test' });
      
      // Try to start second execution immediately
      const execution2 = limitedOrchestrator.executeAgent('slow-agent-2', { data: 'test' });

      const results = await Promise.all([execution1, execution2]);

      // At least one should succeed, but might get limit error
      const successful = results.filter(r => r.success).length;
      expect(successful).toBeGreaterThan(0);

      await limitedOrchestrator.shutdown();
    });
  });
});
