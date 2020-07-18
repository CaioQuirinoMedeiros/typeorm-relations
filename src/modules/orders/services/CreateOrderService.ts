import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (!findProducts.length) {
      throw new AppError('Could not find any products');
    }

    const productsRelations = products.map(product => {
      const productFound = findProducts.filter(
        findProduct => findProduct.id === product.id,
      )[0];

      return { product, productFound };
    });

    const productsNotFound = productsRelations.filter(
      productRelation => !productRelation.productFound,
    );

    if (productsNotFound.length) {
      throw new AppError(
        `Could not find product ${productsNotFound[0].product.id}`,
      );
    }

    const productsOverQuantityLimit = productsRelations
      .filter(productRelation => !!productRelation.productFound)
      .filter(productRelation => {
        if (!productRelation.productFound) {
          return false;
        }
        return (
          productRelation.product.quantity >
          productRelation.productFound.quantity
        );
      });

    if (productsOverQuantityLimit.length) {
      throw new AppError(
        `Quantity ${productsOverQuantityLimit[0].product.quantity} is over ${productsOverQuantityLimit[0].productFound?.quantity} available`,
      );
    }

    const order = await this.ordersRepository.create({
      customer,
      products: productsRelations.map(productRelation => ({
        product_id: productRelation.productFound?.id,
        quantity: productRelation.product?.quantity,
        price: productRelation.productFound?.price,
      })),
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(orderProduct => {
      const foundProduct = findProducts.filter(
        findProduct => findProduct.id === orderProduct.product_id,
      )[0];

      return {
        id: orderProduct.product_id,
        quantity: foundProduct.quantity - orderProduct.quantity,
      };
    });

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
