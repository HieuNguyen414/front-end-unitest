import { Order } from '../models/order.model';

// Interface for a payment method
export interface IPaymentMethod {
    isApplicable(totalPrice: number): boolean;
    getMethod(): string; // Get the name of the payment method
}

// Interface for a payment service
export interface IPaymentService {
    buildPaymentMethod(totalPrice: number): string; 
    payViaLink(order: Order): Promise<void>; // Pay for an order using a link
}

// Interface for a coupon service
export interface ICouponService {
    validateCoupon(couponId: string): Promise<{ discount: number }>; // Validate a coupon and return the discount amount
}