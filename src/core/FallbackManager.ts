import { Agent } from './Agent';
import { AgentId, AgentResult, AgentContext, FallbackConfig, RetryPolicy } from '../types';

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Circuit breaker for agent resilience
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly halfOpenAttempts: number;

  constructor(threshold = 5, timeout = 60000, halfOpenAttempts = 3) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.halfOpenAttempts = halfOpenAttempts;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenAttempts) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private shouldAttemptReset(): boolean {
    return !!(
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime >= this.timeout
    );
  }

  getState(): CircuitState {
    return this.state;
  }
}

/**
 * Fallback manager for resilient agent execution
 */
export class FallbackManager {
  private circuitBreakers: Map<AgentId, CircuitBreaker> = new Map();
  private agents: Map<AgentId, Agent> = new Map();

  /**
   * Register an agent with the fallback manager
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.getId(), agent);
    this.circuitBreakers.set(agent.getId(), new CircuitBreaker());
  }

  /**
   * Execute agent with fallback support
   */
  async executeWithFallback(
    agentId: AgentId,
    context: AgentContext,
    input: unknown,
    fallbackConfig: FallbackConfig
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

    const circuitBreaker = this.circuitBreakers.get(agentId);
    const retryPolicy = agent.getConfig().retryPolicy;

    try {
      // Try primary agent with circuit breaker
      if (circuitBreaker) {
        return await circuitBreaker.execute(() => 
          this.executeWithRetry(agent, context, input, retryPolicy)
        );
      } else {
        return await this.executeWithRetry(agent, context, input, retryPolicy);
      }
    } catch (error) {
      // If fallback is enabled and available, try fallback agent
      if (fallbackConfig.enabled && fallbackConfig.fallbackAgentId) {
        return await this.executeFallback(
          fallbackConfig.fallbackAgentId,
          context,
          input,
          fallbackConfig.maxFallbackAttempts || 1
        );
      }

      // No fallback available
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Execute agent with retry policy
   */
  private async executeWithRetry(
    agent: Agent,
    context: AgentContext,
    input: unknown,
    retryPolicy?: RetryPolicy
  ): Promise<AgentResult> {
    const maxAttempts = retryPolicy?.maxAttempts || 1;
    const initialDelay = retryPolicy?.initialDelay || 1000;
    const backoffMultiplier = retryPolicy?.backoffMultiplier || 2;
    const maxDelay = retryPolicy?.maxDelay || 30000;

    let lastError: Error | undefined;
    let delay = initialDelay;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await agent.execute(context, input);
        
        if (result.success) {
          return {
            ...result,
            metrics: result.metrics ? {
              ...result.metrics,
              retryCount: attempt
            } : {
              executionTime: 0,
              retryCount: attempt
            }
          };
        }

        lastError = new Error(result.error?.message || 'Execution failed');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxAttempts - 1) {
        await this.sleep(Math.min(delay, maxDelay));
        delay *= backoffMultiplier;
      }
    }

    throw lastError || new Error('Execution failed after retries');
  }

  /**
   * Execute fallback agent
   */
  private async executeFallback(
    fallbackAgentId: AgentId,
    context: AgentContext,
    input: unknown,
    maxAttempts: number
  ): Promise<AgentResult> {
    const fallbackAgent = this.agents.get(fallbackAgentId);
    
    if (!fallbackAgent) {
      return {
        success: false,
        error: {
          code: 'FALLBACK_AGENT_NOT_FOUND',
          message: `Fallback agent ${fallbackAgentId} not found`
        }
      };
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await fallbackAgent.execute(context, input);
      
      if (result.success) {
        return result;
      }
    }

    return {
      success: false,
      error: {
        code: 'FALLBACK_FAILED',
        message: 'Fallback agent execution failed'
      }
    };
  }

  /**
   * Get circuit breaker state for an agent
   */
  getCircuitState(agentId: AgentId): CircuitState | undefined {
    return this.circuitBreakers.get(agentId)?.getState();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
