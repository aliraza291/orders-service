import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { SqsConsumerService } from '@/services/sqs-consumer';

@Module({
  providers: [OrdersService, SqsConsumerService],
})
export class OrdersModule {}
