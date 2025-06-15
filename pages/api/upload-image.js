
// pages/api/upload-image.js
import { Storage } from '@google-cloud/storage';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const bucketName = process.env.CLOUD_STORAGE_BUCKET_NAME;

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parser for file uploads
  },
};

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!bucketName) {
    console.error('CLOUD_STORAGE_BUCKET_NAME is not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  const form = formidable({ multiples: false }); // Assuming single file upload

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing form data:', err);
      return res.status(500).json({ message: 'Error parsing form data' });
    }

    const fileArray = files.image;
    const file = fileArray && fileArray.length > 0 ? fileArray[0] : null;


    if (!file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    // Validate file type (basic example)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      console.log('Invalid file type attempt:', file.mimetype);
      return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.' });
    }

    // Generate a unique file name
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalFilename || 'image.png')}`;

    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(uniqueFileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
      resumable: false,
    });

    blobStream.on('error', (err) => {
      console.error('Error uploading image to Cloud Storage:', err);
      res.status(500).json({ message: 'Error uploading image' });
    });

    blobStream.on('finish', () => {
      // Make the image publicly accessible (adjust permissions as needed)
      blob.makePublic().then(() => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
        res.status(200).json({ message: 'Image uploaded successfully', url: publicUrl });
      }).catch((err) => {
        console.error('Error making image public:', err);
        res.status(500).json({ message: 'Error making image public' });
      });
    });

    // Pipe the file stream to the Cloud Storage blob stream
    const readStream = require('fs').createReadStream(file.filepath);
    readStream.pipe(blobStream);
  });
};
