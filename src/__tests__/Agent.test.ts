import { Agent } from '../core/Agent';
import { AgentContext, AgentMessage, AgentResult, AgentStatus } from '../types';

// Test agent implementation
class TestAgent extends Agent {
  protected async run(input: unknown): Promise<unknown> {
    return { processed: input };
  }

  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    return {
      success: true,
      data: { messageReceived: message.id }
    };
  }
}

describe('Agent', () => {
  let agent: TestAgent;
  let context: AgentContext;

  beforeEach(() => {
    agent = new TestAgent({
      id: 'test-agent',
      name: 'Test Agent',
      type: 'test'
    });

    context = {
      agentId: 'test-agent',
      requestId: 'req-001',
      timestamp: Date.now()
    };
  });

  describe('Configuration', () => {
    it('should create agent with config', () => {
      expect(agent.getId()).toBe('test-agent');
      expect(agent.getStatus()).toBe(AgentStatus.IDLE);
    });

    it('should return agent config', () => {
      const config = agent.getConfig();
      expect(config.id).toBe('test-agent');
      expect(config.name).toBe('Test Agent');
      expect(config.type).toBe('test');
    });
  });

  describe('Execution', () => {
    it('should execute successfully', async () => {
      const input = { data: 'test' };
      const result = await agent.execute(context, input);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ processed: input });
      expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
    });

    it('should collect metrics', async () => {
      const result = await agent.execute(context, { data: 'test' });

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.memoryUsed).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors', async () => {
      class FailingAgent extends Agent {
        protected async run(): Promise<unknown> {
          throw new Error('Test error');
        }

        public async handleMessage(): Promise<AgentResult> {
          return { success: false };
        }
      }

      const failingAgent = new FailingAgent({
        id: 'failing-agent',
        name: 'Failing Agent',
        type: 'test'
      });

      const result = await failingAgent.execute(context, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Test error');
      expect(failingAgent.getStatus()).toBe(AgentStatus.FAILED);
    });
  });

  describe('Lifecycle', () => {
    it('should suspend and resume', () => {
      expect(agent.getStatus()).toBe(AgentStatus.IDLE);
      
      agent.suspend();
      expect(agent.getStatus()).toBe(AgentStatus.SUSPENDED);
      
      agent.resume();
      expect(agent.getStatus()).toBe(AgentStatus.IDLE);
    });
  });
});
