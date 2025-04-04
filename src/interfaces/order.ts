import { Order } from '../models/order.model';

/**
 * Represents a validator for orders.
 */
export interface IOrderValidator {
    /**
     * Validates the order.
     * @param order - The order to validate.
     */
    validate(order: Partial<Order>): void;

    /**
     * Calculates the total price of the order.
     * @param order - The order to calculate the total price for.
     * @param discount - The discount to apply (optional).
     * @returns The total price of the order.
     */
    calcPrice(order: Partial<Order>, discount?: number): number;
}

/**
 * Represents a repository for orders.
 */
export interface IOrderRepository {
    /**
     * Creates a new order.
     * @param order - The order to create.
     * @returns A promise that resolves to the created order.
     */
    create(order: Partial<Order>): Promise<Order>;
}