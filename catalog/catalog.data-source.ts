import { DataSource } from "typeorm"
import { Brand, Category, Color, Parameter, ParameterProducts, Product, ProductVariant, Tag, Foryou } from '../core/entities';

const dataSource = new DataSource({
  type: "mysql",
  host: process.env.MYSQL_HOST,
  port: 3306,
  username: "root",
  password: process.env.MYSQL_ROOT_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  logging: true,
  synchronize: true,
  migrationsRun: false,
  entities: [Product, Category, Color, Brand, Parameter, Tag, ParameterProducts, ProductVariant, Foryou],
});

export default dataSource;
