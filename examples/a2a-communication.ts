import {
  Agent,
  AgentContext,
  AgentMessage,
  AgentResult,
  AgentOrchestrator,
  A2ACommunicationBus,
  InMemoryMessageTransport,
  MessagePriority
} from '@happyos/sdk';

/**
 * Example: Agent-to-Agent Communication
 * This example demonstrates how multiple agents communicate with each other
 */

// Coordinator Agent
class CoordinatorAgent extends Agent {
  private orchestrator?: AgentOrchestrator;

  setOrchestrator(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
  }

  protected async run(input: unknown): Promise<unknown> {
    console.log(`[${this.getId()}] Coordinating task...`);

    if (this.orchestrator) {
      // Send messages to worker agents
      await this.orchestrator.sendMessage(
        this.getId(),
        'worker-1',
        'process-task',
        { task: 'analyze', data: input },
        { correlationId: 'task-001' }
      );

      await this.orchestrator.sendMessage(
        this.getId(),
        'worker-2',
        'process-task',
        { task: 'validate', data: input },
        { correlationId: 'task-001' }
      );
    }

    return { coordinated: true, timestamp: Date.now() };
  }

  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    console.log(`[${this.getId()}] Received message from ${message.from}`);
    
    return {
      success: true,
      data: { acknowledged: true }
    };
  }
}

// Worker Agent
class WorkerAgent extends Agent {
  private orchestrator?: AgentOrchestrator;

  setOrchestrator(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
  }

  protected async run(input: unknown): Promise<unknown> {
    console.log(`[${this.getId()}] Processing task:`, input);
    await this.sleep(500);
    return { processed: true, agentId: this.getId() };
  }

  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    console.log(`[${this.getId()}] Received message: ${message.type}`);
    
    // Process the message
    const result = await this.execute(
      {
        agentId: this.getId(),
        requestId: message.id,
        timestamp: Date.now(),
        correlationId: message.correlationId
      },
      message.payload
    );

    // Send response back to coordinator if replyTo is specified
    if (this.orchestrator && message.replyTo) {
      await this.orchestrator.sendMessage(
        this.getId(),
        message.replyTo,
        'task-completed',
        result.data,
        { correlationId: message.correlationId }
      );
    }

    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  console.log('=== HappyOS SDK - A2A Communication Example ===\n');

  // Setup communication infrastructure
  const transport = new InMemoryMessageTransport();
  const communicationBus = new A2ACommunicationBus(transport);
  const orchestrator = new AgentOrchestrator(communicationBus, {
    fallbackEnabled: true,
    maxConcurrentAgents: 5
  });

  // Create agents
  const coordinator = new CoordinatorAgent({
    id: 'coordinator',
    name: 'Coordinator Agent',
    type: 'coordinator'
  });
  coordinator.setOrchestrator(orchestrator);

  const worker1 = new WorkerAgent({
    id: 'worker-1',
    name: 'Worker Agent 1',
    type: 'worker'
  });
  worker1.setOrchestrator(orchestrator);

  const worker2 = new WorkerAgent({
    id: 'worker-2',
    name: 'Worker Agent 2',
    type: 'worker'
  });
  worker2.setOrchestrator(orchestrator);

  // Register agents
  orchestrator.registerAgent(coordinator);
  orchestrator.registerAgent(worker1);
  orchestrator.registerAgent(worker2);

  console.log('Agents registered:');
  orchestrator.getRegisteredAgents().forEach(config => {
    console.log(`  - ${config.name} (${config.id})`);
  });
  console.log();

  // Execute coordinator (which will trigger workers)
  console.log('Executing coordinator agent...\n');
  const result = await orchestrator.executeAgent('coordinator', {
    operation: 'multi-task',
    data: { value: 100 }
  });

  console.log('\nCoordinator result:');
  console.log(JSON.stringify(result, null, 2));

  // Wait for async message processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n=== Communication Complete ===');
  
  // Cleanup
  await orchestrator.shutdown();
}

// Run example
main().catch(console.error);
