
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadToCloudinary(
  file: Buffer | string,
  folder: string = 'devco',
  publicId?: string
): Promise<{ url: string; public_id: string } | null> {
  try {
    const options: any = {
      folder: folder,
      resource_type: 'auto',
    };

    if (publicId) {
      options.public_id = publicId;
      options.overwrite = true;
      options.invalidate = true;
    }

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      // If it's a buffer, write it to the stream
      if (Buffer.isBuffer(file)) {
        uploadStream.end(file);
      } else {
        // If it's a string (e.g. base64), upload it directly
        cloudinary.uploader.upload(file, options)
          .then(res => resolve(res))
          .catch(err => reject(err));
      }
    });

    const res = result as any;
    return {
      url: res.secure_url,
      public_id: res.public_id,
    };
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return null;
  }
}

export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
    return false;
  }
}

export default cloudinary;
