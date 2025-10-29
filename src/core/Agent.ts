import {
  AgentConfig,
  AgentContext,
  AgentResult,
  AgentStatus,
  AgentMessage,
  AgentError,
  AgentMetrics
} from '../types';

/**
 * Base Agent class providing isolation and lifecycle management
 */
export abstract class Agent {
  protected config: AgentConfig;
  protected status: AgentStatus = AgentStatus.IDLE;
  protected context?: AgentContext;
  private startTime?: number;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Get agent ID
   */
  public getId(): string {
    return this.config.id;
  }

  /**
   * Get agent status
   */
  public getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get agent configuration
   */
  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Execute agent with context isolation
   */
  public async execute(context: AgentContext, input: unknown): Promise<AgentResult> {
    this.context = context;
    this.status = AgentStatus.RUNNING;
    this.startTime = Date.now();

    try {
      const data = await this.run(input);
      this.status = AgentStatus.COMPLETED;
      
      return {
        success: true,
        data,
        metrics: this.collectMetrics()
      };
    } catch (error) {
      this.status = AgentStatus.FAILED;
      
      return {
        success: false,
        error: this.formatError(error),
        metrics: this.collectMetrics()
      };
    } finally {
      this.cleanup();
    }
  }

  /**
   * Abstract method to be implemented by concrete agents
   */
  protected abstract run(input: unknown): Promise<unknown>;

  /**
   * Handle incoming message
   */
  public abstract handleMessage(message: AgentMessage): Promise<AgentResult>;

  /**
   * Collect execution metrics
   */
  protected collectMetrics(): AgentMetrics {
    const executionTime = this.startTime ? Date.now() - this.startTime : 0;
    
    return {
      executionTime,
      memoryUsed: this.getMemoryUsage(),
      retryCount: 0
    };
  }

  /**
   * Get current memory usage
   */
  protected getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Format error for result
   */
  protected formatError(error: unknown): AgentError {
    if (error instanceof Error) {
      return {
        code: 'AGENT_ERROR',
        message: error.message,
        stack: error.stack
      };
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error)
    };
  }

  /**
   * Cleanup after execution
   */
  protected cleanup(): void {
    // Override in subclass if needed
  }

  /**
   * Suspend agent execution
   */
  public suspend(): void {
    this.status = AgentStatus.SUSPENDED;
  }

  /**
   * Resume agent execution
   */
  public resume(): void {
    if (this.status === AgentStatus.SUSPENDED) {
      this.status = AgentStatus.IDLE;
    }
  }
}
