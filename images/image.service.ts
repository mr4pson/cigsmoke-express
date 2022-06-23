import { singleton } from 'tsyringe';
import { DataSource, Repository } from 'typeorm';
import { Image } from '../core/entities/images/image.entity';
import { ImageDto } from './image.dto';

@singleton()
export class ImageService {
  private imageRepository: Repository<Image>;

  constructor(dataSource: DataSource) {
    this.imageRepository = dataSource.getRepository(Image);
  }

  async uploadImages(newImages: ImageDto[]): Promise<void> {
    const imagePromises = newImages.map((image) => {
      return this.imageRepository.save({
        filename: image.filename,
        originalName: image.originalname,
        mimeType: image.mimetype,
        size: image.size,
      })
    })
    await Promise.all(imagePromises)
  }
}
