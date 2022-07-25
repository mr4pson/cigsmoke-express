import { BasketStatus } from '../core/enums/basket-status.enum';
import { Brand, Category, Checkout, Color, OrderProduct, Product, Tag, User } from '../core/entities';
import { Role } from '../core/enums/roles.enum';
import { GroupBy, Steps } from '../core/enums/analytics.enum';

export interface SalesQueryDTO {
  updatedFrom?: Date,
  updatedTo?: Date,
  status?: BasketStatus,
  groupBy?: string,
}

export interface DynamicQueryDTO {
  from?: Date,
  to?: Date,
  step?: Steps,
}

export interface ProductDTO {
  qty: number,
  amount: number,
  id: string,
  name: string,
  price: number,
  desc: string,
  available: boolean,
  createdAt: Date,
  updatedAt: Date,
  images: string,
  url: string,
  category: Category,
  brand: Brand,
  colors: Color[],
  tags: Tag[],
}

export interface UserDTO {
  amount: number,
  id: string,
  firstName: string
  lastName: string,
  email: string;
  password: string;
  isVerified: boolean;
  role: Role;
}

export interface BrandDTO {
  id: string,
  amount: number,
  name: string,
  image: string;
  showOnMain: boolean;
}

export interface CategoryDTO {
  id: string,
  amount: number,
  name: string;
  createdAt: Date;
  updatedAt: Date;
  url: string;
}

export interface AnalyticsDTO {
  data: AnalyticsData[],
  totalAmount: number
}

export interface BasketDTO {
  id: string
  userId: string | null,
  orderProducts: OrderProductDTO[],
  checkout: Checkout,
  totalAmount: number,
  createdAt: Date,
  updatedAt: Date,
  status: BasketStatus;
}

export interface DynamicDTO {
  date: string,
  amount: number
}

export interface OrderProductDTO {
  id: string,
  product: Product,
  qty: number,
  productPrice: number,
}

export interface UsersQueryDTO {
  createdFrom?: Date,
  createdTo?: Date,
}

export interface RatingQueryParams {
  userId?: string,
  productId?: string
}

export interface UnregisteredUser {
  id: string
}

export type AnalyticsData = ProductDTO | UserDTO | BrandDTO | CategoryDTO;
