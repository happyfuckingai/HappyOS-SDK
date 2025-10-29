import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { AgentId, AgentContext, AgentResult, AWSConfig } from '../types';

/**
 * AWS Lambda-based agent executor
 */
export class LambdaAgentExecutor {
  private client: LambdaClient;
  private functionPrefix: string;

  constructor(config: AWSConfig) {
    this.client = new LambdaClient({
      region: config.region,
      endpoint: config.lambda?.endpoint
    });
    this.functionPrefix = config.lambda?.functionPrefix || 'happyos-agent';
  }

  /**
   * Execute agent via Lambda function
   */
  async executeAgent(
    agentId: AgentId,
    context: AgentContext,
    input: unknown
  ): Promise<AgentResult> {
    const functionName = this.getFunctionName(agentId);

    const payload = {
      context,
      input
    };

    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(payload))
    });

    try {
      const response = await this.client.send(command);

      if (response.FunctionError) {
        return {
          success: false,
          error: {
            code: 'LAMBDA_ERROR',
            message: response.FunctionError,
            details: response.Payload ? JSON.parse(Buffer.from(response.Payload).toString()) : undefined
          }
        };
      }

      if (response.Payload) {
        const result = JSON.parse(Buffer.from(response.Payload).toString());
        return result;
      }

      return {
        success: false,
        error: {
          code: 'EMPTY_RESPONSE',
          message: 'Lambda returned empty response'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INVOKE_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Execute agent asynchronously
   */
  async executeAgentAsync(
    agentId: AgentId,
    context: AgentContext,
    input: unknown
  ): Promise<void> {
    const functionName = this.getFunctionName(agentId);

    const payload = {
      context,
      input
    };

    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(payload))
    });

    await this.client.send(command);
  }

  /**
   * Get Lambda function name for agent
   */
  private getFunctionName(agentId: AgentId): string {
    return `${this.functionPrefix}-${agentId}`;
  }

  /**
   * Check if Lambda function exists
   */
  async functionExists(agentId: AgentId): Promise<boolean> {
    const functionName = this.getFunctionName(agentId);
    
    try {
      const command = new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'DryRun'
      });
      
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}
