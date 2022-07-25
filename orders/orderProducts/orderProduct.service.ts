import { singleton } from 'tsyringe';
import { DataSource, Equal, Repository } from 'typeorm';
import { CustomExternalError } from '../../core/domain/error/custom.external.error';
import { ErrorCode } from '../../core/domain/error/error.code';
import { OrderProduct } from '../../core/entities';
import { HttpStatus } from '../../core/lib/http-status';
import axios from 'axios';
import { OrderProductDTO, OrderProductQueryDTO, ProductDTO, UserAuth, UserDTO } from '../order.dtos';
import { scope } from '../../core/middlewares/access.user';
import { Role } from '../../core/enums/roles.enum';
import { v4 } from 'uuid';

@singleton()
export class OrderProductService {
  private orderProductRepository: Repository<OrderProduct>;

  constructor(dataSource: DataSource) {
    this.orderProductRepository = dataSource.getRepository(OrderProduct);
  }

  async getOrderProducts(queryParams: OrderProductQueryDTO, authToken: string): Promise<OrderProductDTO[]> {
    const {
      productId,
      userId,
      minQty,
      maxQty,
      minPrice,
      maxPrice,
      sortBy = 'productId',
      orderBy = 'DESC',
      limit = 10,
    } = queryParams;

    const queryBuilder = this.orderProductRepository
      .createQueryBuilder('orderProduct')
      .leftJoinAndSelect('orderProduct.inBasket', 'basket');

    if (productId) { queryBuilder.andWhere('orderProduct.productId = :productId', { productId: productId }) }
    if (userId) { queryBuilder.andWhere('orderProduct.userId = :userId', { userId: userId }) }
    if (minQty) { queryBuilder.andWhere('orderProduct.qty >= :qty', { qty: minQty }) }
    if (maxQty) { queryBuilder.andWhere('orderProduct.qty <= :qty', { qty: maxQty }) }
    if (minPrice) { queryBuilder.andWhere('orderProduct.productPrice >= :price', { price: minPrice }) }
    if (maxPrice) { queryBuilder.andWhere('orderProduct.productPrice <= :price', { price: maxPrice }) }

    const orderProducts = await queryBuilder
      .orderBy(`orderProduct.${sortBy}`, orderBy)
      .limit(limit)
      .getMany();

    const result = orderProducts.map(async (orderProduct) => await this.mergeOrderProduct(orderProduct))

    return Promise.all(result)
  }

  async getOrderProductEntity(id: string): Promise<OrderProduct> {
    const orderProduct = await this.orderProductRepository.findOneOrFail({
      where: {
        id: Equal(id),
      }
    });

    return orderProduct;
  }

  async getOrderProduct(id: string, authToken: string): Promise<OrderProductDTO> {
    const queryBuilder = await this.orderProductRepository
      .createQueryBuilder('orderProduct')
      .leftJoinAndSelect('orderProduct.inBasket', 'basket')
      .where('orderProduct.id = :id', { id: id })
      .getOne();

    if (!queryBuilder) {
      throw new CustomExternalError([ErrorCode.ENTITY_NOT_FOUND], HttpStatus.NOT_FOUND)
    }

    return this.mergeOrderProduct(queryBuilder);
  }

  async getUserById(id: string, authToken: string): Promise<UserDTO | undefined> {
    try {
      const res = await axios.get(`${process.env.USERS_DB}/users/${id}`, {
        headers: {
          Authorization: authToken!
        }
      });

      return res.data
    } catch (e: any) {
      if (e.name === 'AxiosError' && e.response.status === 403) {
        throw new CustomExternalError([ErrorCode.FORBIDDEN], HttpStatus.FORBIDDEN);
      }
    }
  }

  async getProductById(id: string): Promise<ProductDTO | undefined> {
    try {
      const res = await axios.get(`${process.env.CATALOG_DB}/products/${id}`);

      return res.data;
    } catch (e: any) {
      if (e.name !== 'AxiosError') {
        throw new Error(e)
      }
    }
  }

  async getNewOrderProductId(): Promise<string> {
    const lastElement = await this.orderProductRepository.find({
      order: { id: 'DESC' },
      take: 1
    })

    return lastElement[0] ? String(+lastElement[0].id + 1) : String(1);
  }

  async createOrderProduct(newOrderProduct: OrderProduct
    // , authToken: string
  ): Promise<OrderProduct> {
    const product = await this.getProductById(newOrderProduct.productId);

    newOrderProduct.productPrice = product!.price;
    newOrderProduct.id = v4();

    const orderProduct = await this.orderProductRepository.save(newOrderProduct);

    // if (!await this.validation(orderProduct.id, authToken)) {
    //   await this.orderProductRepository.remove(orderProduct)
    //   throw new CustomExternalError([ErrorCode.FORBIDDEN], HttpStatus.FORBIDDEN);
    // }

    return orderProduct;
  }

  async updateOrderProduct(id: string, orderProductDTO: OrderProduct) {
    const orderProduct = await this.orderProductRepository
      .createQueryBuilder('orderProduct')
      .leftJoinAndSelect('orderProduct.inBasket', 'basket')
      .where('orderProduct.id = :id', { id: id })
      .getOne()

    const newOrderProduct = {} as OrderProduct;

    Object.assign(newOrderProduct, orderProduct);
    newOrderProduct.qty = orderProductDTO.qty;

    // if (user) {
    //   await this.isUserOrderProductOwner(newOrderProduct, user);
    // }

    await this.orderProductRepository.remove(orderProduct!);

    return this.orderProductRepository.save(newOrderProduct);
  }

  async removeOrderProduct(id: string) {
    const orderProduct = await this.orderProductRepository.findOneOrFail({
      where: {
        id: Equal(id),
      }
    });

    return this.orderProductRepository.remove(orderProduct);
  }

  // isUserOrderProductOwner(orderProduct: OrderProduct, user: UserAuth) {
  //   if (scope(String(orderProduct.userId), String(user.id)) && user.role !== Role.Admin) {
  //     throw new CustomExternalError([ErrorCode.FORBIDDEN], HttpStatus.FORBIDDEN);
  //   }
  // }

  async validation(id: string, authToken: string): Promise<boolean> {
    const orderProduct = await this.getOrderProduct(id, authToken) as any;

    return String(orderProduct.user.id) === String(orderProduct.inBasket.userId);
  }

  async mergeOrderProduct(orderProduct: OrderProduct): Promise<OrderProductDTO> {
    return {
      id: orderProduct.id,
      product: await this.getProductById(orderProduct.productId),
      // user: await this.getUserById(orderProduct.userId, authToken) ?? orderProduct.userId,
      qty: orderProduct.qty,
      productPrice: orderProduct.productPrice,
      inBasket: orderProduct.inBasket
    }
  }
}
