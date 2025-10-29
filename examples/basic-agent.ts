import {
  Agent,
  AgentContext,
  AgentMessage,
  AgentResult,
  AgentOrchestrator,
  A2ACommunicationBus,
  InMemoryMessageTransport
} from '@happyos/sdk';

/**
 * Example: Basic Agent Implementation
 * This example shows how to create a simple agent and execute it
 */

// Define a custom agent
class ProcessorAgent extends Agent {
  protected async run(input: unknown): Promise<unknown> {
    console.log(`Processing input:`, input);
    
    // Simulate some processing
    await this.sleep(1000);
    
    return {
      processed: true,
      result: `Processed: ${JSON.stringify(input)}`,
      timestamp: Date.now()
    };
  }

  public async handleMessage(message: AgentMessage): Promise<AgentResult> {
    console.log(`Received message from ${message.from}:`, message.type);
    
    return await this.execute(
      {
        agentId: this.getId(),
        requestId: message.id,
        timestamp: Date.now(),
        correlationId: message.correlationId
      },
      message.payload
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  console.log('=== HappyOS SDK - Basic Agent Example ===\n');

  // Create agent with configuration
  const agent = new ProcessorAgent({
    id: 'processor-1',
    name: 'Basic Processor Agent',
    type: 'processor',
    timeout: 30000,
    retryPolicy: {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 10000
    }
  });

  console.log(`Agent created: ${agent.getId()}`);
  console.log(`Agent status: ${agent.getStatus()}\n`);

  // Create context for execution
  const context: AgentContext = {
    agentId: agent.getId(),
    requestId: 'req-001',
    timestamp: Date.now(),
    metadata: {
      source: 'example',
      priority: 'normal'
    }
  };

  // Execute agent
  console.log('Executing agent...');
  const result = await agent.execute(context, {
    task: 'process-data',
    data: { value: 42, name: 'test' }
  });

  console.log('\nExecution result:');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nFinal status: ${agent.getStatus()}`);
  
  if (result.metrics) {
    console.log(`\nMetrics:`);
    console.log(`  Execution time: ${result.metrics.executionTime}ms`);
    console.log(`  Memory used: ${result.metrics.memoryUsed} bytes`);
  }
}

// Run example
main().catch(console.error);
