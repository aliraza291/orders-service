import { Injectable, OnModuleInit } from '@nestjs/common';
import { SQS } from 'aws-sdk';
import { OrdersService } from '@/modules/orders/orders.service';
import { config } from 'dotenv';
config();
@Injectable()
export class SqsConsumerService implements OnModuleInit {
  private sqs: SQS;
  private readonly queueUrl =
    process.env.ORDERS_QUEUE_URL ||
    'https://sqs.us-east-1.amazonaws.com/account/orders-queue';

  constructor(private readonly ordersService: OrdersService) {
    this.sqs = new SQS({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  onModuleInit() {
    this.startPolling();
  }

  private async startPolling() {
    console.log('Starting SQS polling for orders queue...');

    while (true) {
      try {
        const params = {
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          MessageAttributeNames: ['All'],
        };

        const result = await this.sqs.receiveMessage(params).promise();

        if (result.Messages && result.Messages.length > 0) {
          for (const message of result.Messages) {
            await this.processMessage(message);

            // Delete message after processing
            await this.sqs
              .deleteMessage({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle!,
              })
              .promise();
          }
        }
      } catch (error) {
        console.error('Error polling SQS:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async processMessage(message: any) {
    try {
      const event = JSON.parse(message.Body);
      
      // Extract replyTo queue URL from message attributes
      const replyTo = message.MessageAttributes?.replyTo?.StringValue;
      
      console.log('Processing event:', event);
      console.log('Reply to:', replyTo);

      let result;
      let success = true;
      let errorMessage = '';

      switch (event.type) {
        case 'ORDER_CREATE':
          try {
            result = await this.ordersService.createOrder(event.data);
            console.log('Order created:', result);
          } catch (error) {
            success = false;
            errorMessage = error.message;
            console.error('Error creating order:', error);
          }
          break;

        case 'ORDER_GET':
          try {
            result = await this.ordersService.getOrderById(event.data.id);
            if (!result) {
              success = false;
              errorMessage = 'Order not found';
            }
            console.log('Order retrieved:', result);
          } catch (error) {
            success = false;
            errorMessage = error.message;
            console.error('Error retrieving order:', error);
          }
          break;

        case 'ORDER_UPDATE':
          try {
            const { id, ...updateData } = event.data;
            result = await this.ordersService.updateOrder(id, updateData);
            if (!result) {
              success = false;
              errorMessage = 'Order not found';
            }
            console.log('Order updated:', result);
          } catch (error) {
            success = false;
            errorMessage = error.message;
            console.error('Error updating order:', error);
          }
          break;

        case 'ORDER_DELETE':
          try {
            const deleted = await this.ordersService.deleteOrder(event.data.id);
            result = { deleted };
            if (!deleted) {
              success = false;
              errorMessage = 'Order not found';
            }
            console.log('Order deleted:', deleted);
          } catch (error) {
            success = false;
            errorMessage = error.message;
            console.error('Error deleting order:', error);
          }
          break;

        default:
          console.log('Unknown event type:', event.type);
          return;
      }

      // Send response back to API Gateway
      if (replyTo) {
        const response = {
          correlationId: event.correlationId,
          success,
          data: result,
          errorMessage,
          timestamp: new Date().toISOString(),
          eventType: event.type
        };

        await this.sendResponse(replyTo, response);
        console.log('Response sent back to API Gateway');
      } else {
        console.warn('No replyTo queue specified in message');
      }

    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  private async sendResponse(replyQueueUrl: string, response: any) {
    try {
      const params = {
        QueueUrl: replyQueueUrl,
        MessageBody: JSON.stringify(response),
        MessageAttributes: {
          correlationId: {
            DataType: 'String',
            StringValue: response.correlationId
          },
          eventType: {
            DataType: 'String',
            StringValue: response.eventType
          }
        }
      };

      const result = await this.sqs.sendMessage(params).promise();
      console.log('Response sent successfully:', {
        correlationId: response.correlationId,
        messageId: result.MessageId
      });
    } catch (error) {
      console.error('Error sending response:', error);
      throw error;
    }
  }
}
