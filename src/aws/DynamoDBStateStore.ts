import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { AgentId, AgentConfig, AgentStatus, AWSConfig } from '../types';

/**
 * Agent state stored in DynamoDB
 */
export interface AgentState {
  agentId: AgentId;
  status: AgentStatus;
  config: AgentConfig;
  lastUpdated: number;
  executionCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * DynamoDB-based agent state store
 */
export class DynamoDBStateStore {
  private client: DynamoDBClient;
  private tableName: string;

  constructor(config: AWSConfig) {
    this.client = new DynamoDBClient({
      region: config.region,
      endpoint: config.dynamodb?.endpoint
    });
    this.tableName = config.dynamodb?.tableName || 'HappyOS-Agents';
  }

  /**
   * Save agent state
   */
  async saveAgentState(state: AgentState): Promise<void> {
    const item = marshall({
      ...state,
      pk: `AGENT#${state.agentId}`,
      sk: 'STATE',
      lastUpdated: Date.now()
    });

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: item
    });

    await this.client.send(command);
  }

  /**
   * Get agent state
   */
  async getAgentState(agentId: AgentId): Promise<AgentState | null> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({
        pk: `AGENT#${agentId}`,
        sk: 'STATE'
      })
    });

    const response = await this.client.send(command);
    
    if (!response.Item) {
      return null;
    }

    const item = unmarshall(response.Item);
    return {
      agentId: item.agentId,
      status: item.status,
      config: item.config,
      lastUpdated: item.lastUpdated,
      executionCount: item.executionCount,
      metadata: item.metadata
    };
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId: AgentId, status: AgentStatus): Promise<void> {
    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({
        pk: `AGENT#${agentId}`,
        sk: 'STATE'
      }),
      UpdateExpression: 'SET #status = :status, lastUpdated = :timestamp',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':timestamp': Date.now()
      })
    });

    await this.client.send(command);
  }

  /**
   * Increment execution count
   */
  async incrementExecutionCount(agentId: AgentId): Promise<void> {
    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({
        pk: `AGENT#${agentId}`,
        sk: 'STATE'
      }),
      UpdateExpression: 'ADD executionCount :inc SET lastUpdated = :timestamp',
      ExpressionAttributeValues: marshall({
        ':inc': 1,
        ':timestamp': Date.now()
      })
    });

    await this.client.send(command);
  }

  /**
   * Query all agents
   */
  async queryAllAgents(): Promise<AgentState[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'StateIndex',
      KeyConditionExpression: 'sk = :sk',
      ExpressionAttributeValues: marshall({
        ':sk': 'STATE'
      })
    });

    const response = await this.client.send(command);
    
    if (!response.Items) {
      return [];
    }

    return response.Items.map(item => {
      const unmarshalled = unmarshall(item);
      return {
        agentId: unmarshalled.agentId,
        status: unmarshalled.status,
        config: unmarshalled.config,
        lastUpdated: unmarshalled.lastUpdated,
        executionCount: unmarshalled.executionCount,
        metadata: unmarshalled.metadata
      };
    });
  }

  /**
   * Delete agent state
   */
  async deleteAgentState(agentId: AgentId): Promise<void> {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({
        pk: `AGENT#${agentId}`,
        sk: 'STATE'
      })
    });

    await this.client.send(command);
  }
}
