import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrderItemsController } from './purchase_order_items.controller';
import { PurchaseOrderItemsService } from './purchase_order_items.service';

describe('PurchaseOrderItemsController', () => {
  let controller: PurchaseOrderItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrderItemsController],
      providers: [PurchaseOrderItemsService],
    }).compile();

    controller = module.get<PurchaseOrderItemsController>(PurchaseOrderItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
