import { 
  Injectable, 
  BadRequestException, 
  NotFoundException 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { 
  InvoiceStatus, 
  StockMovementType, 
  PaymentStatus, 
  DiscountType 
} from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInvoiceDto) {
    const { items, payments, promotionId, couponCode, notes } = dto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Hóa đơn phải có ít nhất 1 sản phẩm');
    }

    // Tạm thời lấy staff đầu tiên làm cashier nếu chưa truyền cashierId
    let cashierId = dto.cashierId;
    if (!cashierId) {
      const defaultStaff = await this.prisma.staff.findFirst();
      if (!defaultStaff) {
        throw new BadRequestException('Chưa có dữ liệu nhân viên trong hệ thống');
      }
      cashierId = defaultStaff.id;
    }

    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const allocatedItems: Array<{
        productId: string;
        batchId: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];

      // 1. Kiểm tra tồn kho & trừ kho theo thuật toán FEFO (expiryDate tăng dần)
      for (const item of items) {
        const product = await tx.products.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(`Sản phẩm ID ${item.productId} không tồn tại`);
        }

        const itemSubtotal = item.unitPrice * item.quantity;
        subtotal += itemSubtotal;

        const availableBatches = await tx.batches.findMany({
          where: {
            productId: item.productId,
            quantity: { gt: 0 },
          },
          orderBy: { expiryDate: 'asc' },
        });

        const totalStock = availableBatches.reduce((sum, b) => sum + b.quantity, 0);
        if (totalStock < item.quantity) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" không đủ tồn kho (Còn: ${totalStock}, Yêu cầu: ${item.quantity})`
          );
        }

        let remainingQty = item.quantity;
        for (const batch of availableBatches) {
          if (remainingQty <= 0) break;

          const deductQty = Math.min(batch.quantity, remainingQty);
          remainingQty -= deductQty;

          // Cập nhật số lượng lô
          await tx.batches.update({
            where: { id: batch.id },
            data: { quantity: batch.quantity - deductQty },
          });

          allocatedItems.push({
            productId: item.productId,
            batchId: batch.id,
            quantity: deductQty,
            unitPrice: item.unitPrice,
            subtotal: item.unitPrice * deductQty,
          });
        }
      }

      // 2. Tính toán Giảm giá & Khuyến mãi
      let discountAmount = 0;
      let appliedPromotionId: string | null = null;

      if (promotionId || couponCode) {
        const promo = await tx.promotions.findFirst({
          where: {
            OR: [
              promotionId ? { id: promotionId } : undefined,
              couponCode ? { code: couponCode } : undefined,
            ].filter(Boolean) as any,
            status: 'active',
          },
        });

        if (promo) {
          const now = new Date();
          if (now < promo.startDate || now > promo.endDate) {
            throw new BadRequestException('Chương trình khuyến mãi hết hạn hoặc chưa bắt đầu');
          }

          if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
            throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
          }

          if (subtotal < Number(promo.minOrderValue)) {
            throw new BadRequestException(
              `Đơn hàng chưa đạt giá trị tối thiểu ${Number(promo.minOrderValue).toLocaleString()}đ`
            );
          }

          if (promo.discountType === DiscountType.percentage) {
            discountAmount = (subtotal * Number(promo.value)) / 100;
            if (promo.maxDiscountAmount) {
              discountAmount = Math.min(discountAmount, Number(promo.maxDiscountAmount));
            }
          } else {
            discountAmount = Number(promo.value);
          }

          discountAmount = Math.min(discountAmount, subtotal);
          appliedPromotionId = promo.id;

          // Cập nhật lượt dùng khuyến mãi
          await tx.promotions.update({
            where: { id: promo.id },
            data: { usedCount: promo.usedCount + 1 },
          });
        }
      }

      const finalTotal = Math.max(0, subtotal - discountAmount);

      // 3. Kiểm tra số tiền thanh toán
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid < finalTotal) {
        throw new BadRequestException(
          `Số tiền thanh toán chưa đủ (Cần: ${finalTotal.toLocaleString()}đ, Đã trả: ${totalPaid.toLocaleString()}đ)`
        );
      }

      // 4. Sinh mã hóa đơn tự động (HDYYYYMMDD-XXXX)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.invoices.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });
      const invoiceCode = `HD${dateStr}-${String(countToday + 1).padStart(4, '0')}`;

      // 5. Lưu hóa đơn vào DB
      const invoice = await tx.invoices.create({
        data: {
          code: invoiceCode,
          cashierId,
          subtotal,
          discountAmount,
          finalTotal,
          status: InvoiceStatus.completed,
          notes,
          paidAt: new Date(),
        },
      });

      // 6. Lưu chi tiết các sản phẩm & Ghi StockMovement loại sale
      for (const item of allocatedItems) {
        const createdItem = await tx.invoice_items.create({
          data: {
            invoiceId: invoice.id,
            productId: item.productId,
            batchId: item.batchId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          },
        });

        // Tạo bản ghi biến động kho
        await tx.stock_movements.create({
          data: {
            batchId: item.batchId,
            type: StockMovementType.sale,
            quantity: item.quantity,
            reason: `Bán hàng theo hóa đơn ${invoice.code}`,
            refType: 'invoice',
            refId: invoice.id,
            createdById: cashierId,
          },
        });

        // Nếu có khuyến mãi áp dụng thì ghi nhận invoice_promotions
        if (appliedPromotionId && discountAmount > 0) {
          await tx.invoice_promotions.create({
            data: {
              invoiceId: invoice.id,
              promotionId: appliedPromotionId,
              invoiceItemId: createdItem.id,
              discountAmount: (item.subtotal / subtotal) * discountAmount,
            },
          });
        }
      }

      // 7. Lưu hình thức thanh toán (Tiền mặt, Chuyển khoản, Thẻ)
      for (const payment of payments) {
        await tx.invoice_payments.create({
          data: {
            invoiceId: invoice.id,
            method: payment.method,
            amount: payment.amount,
            cashReceived: payment.cashReceived,
            status: PaymentStatus.confirmed,
            reference: payment.reference,
            confirmedById: cashierId,
            confirmedAt: new Date(),
          },
        });
      }

      return tx.invoices.findUnique({
        where: { id: invoice.id },
        include: {
          invoice_items: {
            include: { products: true, batches: true },
          },
          invoice_payments: true,
          invoice_promotions: {
            include: { promotions: true },
          },
          staff: true,
        },
      });
    });
  }

  async findAll() {
    return this.prisma.invoices.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invoice_items: {
          include: { products: true, batches: true },
        },
        invoice_payments: true,
        invoice_promotions: {
          include: { promotions: true },
        },
        staff: true,
      },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoices.findUnique({
      where: { id },
      include: {
        invoice_items: {
          include: { products: true, batches: true },
        },
        invoice_payments: true,
        invoice_promotions: {
          include: { promotions: true },
        },
        staff: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Hóa đơn ID ${id} không tồn tại`);
    }

    return invoice;
  }

  async cancel(id: string, staffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoices.findUnique({
        where: { id },
        include: { invoice_items: true },
      });

      if (!invoice) {
        throw new NotFoundException('Hóa đơn không tồn tại');
      }

      if (invoice.status === InvoiceStatus.cancelled) {
        throw new BadRequestException('Hóa đơn đã bị hủy trước đó');
      }

      // Hoàn trả số lượng tồn kho lại cho từng Lô
      for (const item of invoice.invoice_items) {
        await tx.batches.update({
          where: { id: item.batchId },
          data: { quantity: { increment: item.quantity } },
        });

        // Ghi nhận nhật ký nhập trả hàng (export/adjust/refund)
        await tx.stock_movements.create({
          data: {
            batchId: item.batchId,
            type: StockMovementType.adjust,
            quantity: item.quantity,
            reason: `Hoàn tồn kho do hủy hóa đơn ${invoice.code}`,
            refType: 'invoice_cancel',
            refId: invoice.id,
            createdById: staffId || invoice.cashierId,
          },
        });
      }

      return tx.invoices.update({
        where: { id },
        data: { status: InvoiceStatus.cancelled },
      });
    });
  }
}