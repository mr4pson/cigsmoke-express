import { singleton } from 'tsyringe';
import { DataSource, Equal, Repository } from 'typeorm';
import { Color } from '../../core/entities';
import { validation } from '../../core/lib/validator';
import { ColorQueryDTO } from '../catalog.dtos';

@singleton()
export class ColorService {
  private colorRepository: Repository<Color>;

  constructor(dataSource: DataSource) {
    this.colorRepository = dataSource.getRepository(Color);
  }

  async getColors(queryParams: ColorQueryDTO): Promise<Color[]> {
    const {
      name,
      products,
      url,
      code,
      sortBy='name',
      orderBy='DESC',
      limit=10,
    } = queryParams;

    const queryBuilder = await this.colorRepository
      .createQueryBuilder('color')
      .leftJoinAndSelect('color.products', 'product')

    if (name) { queryBuilder.andWhere('color.name LIKE :name', { name: `%${name}%` }); }
    if (url) { queryBuilder.andWhere('color.url LIKE :url', { url: `%${url}%` }); }
    if (code) { queryBuilder.andWhere('color.code = :code', { code: `%${code}%` }); }
    if (products) { queryBuilder.andWhere('product.url IN (:...products)', { products: JSON.parse(products) }); }

    return queryBuilder
      .orderBy(`color.${sortBy}`, orderBy)
      .limit(limit)
      .getMany();
  }

  async getColor(id: string): Promise<Color> {
    const color = await this.colorRepository.findOneOrFail({
      where: {
          id: Equal(id),
      },
    });

    return color;
  }

  async getColorsByIds(ids: string[]): Promise<Color[]> {

    const colorsPromises = ids.map(async colorId => {
      return this.getColor(colorId);
    })

    return Promise.all(colorsPromises);
  }

  async createColor(colorDTO: Color): Promise<Color> {
    const newColor = await validation(new Color(colorDTO));

    return this.colorRepository.save(newColor);
  }

  async updateColor(id: string, colorDTO: Color) {
    const color = await this.colorRepository.findOneOrFail({
      where: {
          id: Equal(id),
      }
    });

    return this.colorRepository.save({
      ...color,
      ...colorDTO
    });
  }

  async removeColor(id: string) {
    const color = await this.colorRepository.findOneOrFail({
      where: {
          id: Equal(id),
      }
    });

    return this.colorRepository.remove(color);
  }
}
