import { Agent } from '../core/Agent';
import { FallbackManager } from '../core/FallbackManager';
import { A2ACommunicationBus } from '../communication/A2ACommunicationBus';
import {
  AgentId,
  AgentConfig,
  AgentContext,
  AgentResult,
  AgentMessage,
  FallbackConfig
} from '../types';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  fallbackEnabled?: boolean;
  maxConcurrentAgents?: number;
  defaultTimeout?: number;
}

/**
 * Agent orchestration system
 * Manages agent lifecycle, communication, and execution
 */
export class AgentOrchestrator {
  private agents: Map<AgentId, Agent> = new Map();
  private fallbackManager: FallbackManager;
  private communicationBus: A2ACommunicationBus;
  private config: OrchestratorConfig;
  private runningAgents: Set<AgentId> = new Set();

  constructor(
    communicationBus: A2ACommunicationBus,
    config: OrchestratorConfig = {}
  ) {
    this.communicationBus = communicationBus;
    this.fallbackManager = new FallbackManager();
    this.config = {
      fallbackEnabled: true,
      maxConcurrentAgents: 10,
      defaultTimeout: 30000,
      ...config
    };
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: Agent): void {
    const agentId = agent.getId();
    
    if (this.agents.has(agentId)) {
      throw new Error(`Agent ${agentId} is already registered`);
    }

    this.agents.set(agentId, agent);
    this.fallbackManager.registerAgent(agent);

    // Subscribe to messages for this agent
    this.communicationBus.subscribe(agentId, async (message: AgentMessage) => {
      await this.handleAgentMessage(agentId, message);
    });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: AgentId): void {
    this.agents.delete(agentId);
    this.communicationBus.unsubscribe(agentId);
    this.runningAgents.delete(agentId);
  }

  /**
   * Execute an agent
   */
  async executeAgent(
    agentId: AgentId,
    input: unknown,
    context?: Partial<AgentContext>
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      return {
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found`
        }
      };
    }

    // Check concurrent execution limit
    if (
      this.config.maxConcurrentAgents &&
      this.runningAgents.size >= this.config.maxConcurrentAgents
    ) {
      return {
        success: false,
        error: {
          code: 'MAX_CONCURRENT_LIMIT',
          message: 'Maximum concurrent agents limit reached'
        }
      };
    }

    this.runningAgents.add(agentId);

    try {
      const agentContext: AgentContext = {
        agentId,
        requestId: this.generateRequestId(),
        timestamp: Date.now(),
        ...context
      };

      const fallbackConfig: FallbackConfig = {
        enabled: this.config.fallbackEnabled || false,
        fallbackAgentId: agent.getConfig().fallbackAgent,
        maxFallbackAttempts: 2,
        fallbackStrategy: 'circuit-breaker'
      };

      return await this.fallbackManager.executeWithFallback(
        agentId,
        agentContext,
        input,
        fallbackConfig
      );
    } finally {
      this.runningAgents.delete(agentId);
    }
  }

  /**
   * Send message between agents
   */
  async sendMessage(
    fromAgentId: AgentId,
    toAgentId: AgentId,
    type: string,
    payload: unknown,
    options?: {
      correlationId?: string;
      replyTo?: AgentId;
    }
  ): Promise<string> {
    return await this.communicationBus.sendMessage(
      fromAgentId,
      toAgentId,
      type,
      payload,
      options
    );
  }

  /**
   * Broadcast message to multiple agents
   */
  async broadcastMessage(
    fromAgentId: AgentId,
    recipients: AgentId[],
    type: string,
    payload: unknown
  ): Promise<string[]> {
    return await this.communicationBus.broadcast(
      fromAgentId,
      recipients,
      type,
      payload
    );
  }

  /**
   * Handle incoming message for an agent
   */
  private async handleAgentMessage(
    agentId: AgentId,
    message: AgentMessage
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      console.error(`Agent ${agentId} not found for message ${message.id}`);
      return;
    }

    try {
      await agent.handleMessage(message);
    } catch (error) {
      console.error(`Error handling message for agent ${agentId}:`, error);
    }
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: AgentId): string | undefined {
    return this.agents.get(agentId)?.getStatus();
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): AgentConfig[] {
    return Array.from(this.agents.values()).map(agent => agent.getConfig());
  }

  /**
   * Get circuit breaker state for an agent
   */
  getCircuitState(agentId: AgentId): string | undefined {
    return this.fallbackManager.getCircuitState(agentId);
  }

  /**
   * Get number of running agents
   */
  getRunningAgentCount(): number {
    return this.runningAgents.size;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown orchestrator and cleanup
   */
  async shutdown(): Promise<void> {
    // Unsubscribe all agents
    for (const agentId of this.agents.keys()) {
      this.communicationBus.unsubscribe(agentId);
    }

    // Clear all agents
    this.agents.clear();
    this.runningAgents.clear();
  }
}
