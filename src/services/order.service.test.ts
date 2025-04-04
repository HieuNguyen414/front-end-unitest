import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from './order.service';
import { OrderValidator } from './order.service';
import { OrderRepository } from './order.service';
import { CouponService } from './order.service';
import { Order } from '../models/order.model';
import { PaymentMethod } from '../models/payment.model';

// Mock dependencies


const mockValidateOrder = {
  validate: vi.fn(),
  calcPrice: vi.fn(),
};

const mockOrderItems = {
  create: vi.fn(),
};

const mockDiscountService = {
  validateCoupon: vi.fn(),
};

const mockPaymentService = {
  buildPaymentMethod: vi.fn(),
  payViaLink: vi.fn(),
};

describe('OrderValidator', () => {
  let validator: OrderValidator;

  beforeEach(() => {
    validator = new OrderValidator();
  });

  it('should validate order with valid items', () => {
    const order = {
      items: [{ id: '1', productId: '1', price: 100, quantity: 2 }],
    };
    expect(() => validator.validate(order)).not.toThrow();
  });

  it('should throw error when items are missing', () => {
    const order = { items: [] };
    expect(() => validator.validate(order)).toThrow('Order items are required');
  });

  it('should throw error when items have invalid price or quantity', () => {
    const order = {
      items: [{ id: '1', productId: '1', price: 0, quantity: 1 }],
    };
    expect(() => validator.validate(order)).toThrow('Order items are invalid');
  });

  it('should throw error when total price is less than or equal to 0', () => {
    const order = {
      items: [{ id: '1', productId: '1', price: 0, quantity: 1 }],
    };
    expect(() => validator.calcPrice(order)).toThrow('Total price must be greater than 0');
  });

  it('should apply discount correctly', () => {
    const order = {
      items: [{ id: '1', productId: '1', price: 100, quantity: 2 }],
    };
    const totalPrice = validator.calcPrice(order, 50);
    expect(totalPrice).toBe(150);
  });

  it('should calculate total price correctly', () => {
    const order = {
      items: [{ id: '1', productId: '1', price: 250, quantity: 3 }],
    };
    const totalPrice = validator.calcPrice(order);
    expect(totalPrice).toBe(750);
  });
  
  it('should calculate final price correctly', () => {
    const order = {
      items: [{ id: '1', productId: '1', price: 100, quantity: 2 }],
    };
    const discount = 50;
    const finalPrice = validator.calcPrice(order, discount);
    expect(finalPrice).toBe(150);
  });

  it('should return 0 when final price is negative', () => {
    const order = {
      items: [{ id: '1', productId: '1', price: 100, quantity: 2 }],
    };
    const discount = 200;
    const finalPrice = validator.calcPrice(order, discount);
    const result = finalPrice < 0 ? 0 : finalPrice;
    expect(result).toBe(0);
  });
});

describe('OrderRepository', () => {
  let repository: OrderRepository;

  beforeEach(() => {
    repository = new OrderRepository();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should create order successfully', async () => {
    const mockOrder = { id: '1', items: [] };
    (fetch as any).mockResolvedValueOnce({
      json: () => Promise.resolve(mockOrder),
    });

    const result = await repository.create(mockOrder);
    expect(result).toEqual(mockOrder);
    expect(fetch).toHaveBeenCalledWith(
      'https://67eb7353aa794fb3222a4c0e.mockapi.io/order',
      expect.any(Object)
    );
  });
});

describe('CouponService', () => {
  let service: CouponService;

  beforeEach(() => {
    service = new CouponService();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should validate coupon successfully', async () => {
    const mockCoupon = { discount: 50 };
    (fetch as any).mockResolvedValueOnce({
      json: () => Promise.resolve(mockCoupon),
    });

    const result = await service.validateCoupon('123');
    expect(result).toEqual({ discount: 50 });
  });

  it('should throw error for invalid coupon', async () => {
    (fetch as any).mockResolvedValueOnce({
      json: () => Promise.resolve(null),
    });

    await expect(service.validateCoupon('123')).rejects.toThrow('Invalid coupon');
  });
});

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(() => {
    service = new OrderService(
      mockPaymentService as any,
      mockValidateOrder as any,
      mockOrderItems as any,
      mockDiscountService as any
    );
    vi.clearAllMocks();
  });

  it('should process order successfully without coupon', async () => {
    const mockOrder: Partial<Order> = {
      items: [{ id: '1', productId: '1', price: 100, quantity: 2 }],
    };
    const mockCreatedOrder = { id: '1', ...mockOrder };
    
    mockValidateOrder.calcPrice.mockReturnValue(200);
    mockPaymentService.buildPaymentMethod.mockReturnValue(PaymentMethod.CREDIT);
    mockOrderItems.create.mockResolvedValue(mockCreatedOrder);

    await service.process(mockOrder);

    expect(mockValidateOrder.validate).toHaveBeenCalledWith(mockOrder);
    expect(mockValidateOrder.calcPrice).toHaveBeenCalledWith(mockOrder, 0);
    expect(mockPaymentService.buildPaymentMethod).toHaveBeenCalledWith(200);
    expect(mockOrderItems.create).toHaveBeenCalled();
    expect(mockPaymentService.payViaLink).toHaveBeenCalledWith(mockCreatedOrder);
  });

  it('should process order successfully with coupon', async () => {
    const mockOrder: Partial<Order> = {
      items: [{ id: '1', productId: '1', price: 100, quantity: 2 }],
      couponId: '123',
    };
    const mockCreatedOrder = { id: '1', ...mockOrder };
    
    mockDiscountService.validateCoupon.mockResolvedValue({ discount: 50 });
    mockValidateOrder.calcPrice.mockReturnValue(150);
    mockPaymentService.buildPaymentMethod.mockReturnValue(PaymentMethod.CREDIT);
    mockOrderItems.create.mockResolvedValue(mockCreatedOrder);

    await service.process(mockOrder);

    expect(mockValidateOrder.validate).toHaveBeenCalledWith(mockOrder);
    expect(mockDiscountService.validateCoupon).toHaveBeenCalledWith('123');
    expect(mockValidateOrder.calcPrice).toHaveBeenCalledWith(mockOrder, 50);
    expect(mockPaymentService.buildPaymentMethod).toHaveBeenCalledWith(150);
    expect(mockOrderItems.create).toHaveBeenCalled();
    expect(mockPaymentService.payViaLink).toHaveBeenCalledWith(mockCreatedOrder);
  });

  it('should handle validation errors', async () => {
    const mockOrder: Partial<Order> = {
      items: [],
    };
    
    mockValidateOrder.validate.mockImplementation(() => {
      throw new Error('Validation error');
    });

    await expect(service.process(mockOrder)).rejects.toThrow('Validation error');
  });

  it('should handle coupon validation errors', async () => {
    const mockOrder: Partial<Order> = {
      items: [{ id: '1', productId: '1', price: 100, quantity: 2 }],
      couponId: '123',
    };
    
    // Clear all mocks first
    vi.clearAllMocks();
    
    // Mock validate to not throw error
    mockValidateOrder.validate.mockImplementation(() => {});
    mockValidateOrder.calcPrice.mockReturnValue(200);
    mockPaymentService.buildPaymentMethod.mockReturnValue(PaymentMethod.CREDIT);
    mockDiscountService.validateCoupon.mockRejectedValue(new Error('Invalid coupon'));

    await expect(service.process(mockOrder)).rejects.toThrow('Invalid coupon');
  });
});