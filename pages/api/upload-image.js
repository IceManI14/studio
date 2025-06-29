// pages/api/upload-image.js
import { Storage } from '@google-cloud/storage';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadFileToGCS = (filepath, blobStream) => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filepath);
    readStream.on('error', reject);
    blobStream.on('error', reject);
    blobStream.on('finish', resolve);
    readStream.pipe(blobStream);
  });
};

export default async (req, res) => {
  if (req.method !== 'POST') {
    console.warn(`Method ${req.method} not allowed for /api/upload-image.`);
    return res.status(405).json({ message: 'Method Not Allowed. Only POST requests are accepted.' });
  }

  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    console.error('CRITICAL SERVER CONFIG ERROR: Firebase environment variables for Storage are not set.');
    return res.status(500).json({ message: 'Server configuration error: Missing Firebase Project ID or Storage Bucket Name.' });
  }

  const storage = new Storage({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const bucket = storage.bucket(bucketName);

  const form = formidable({ multiples: false });

  try {
    const [fields, files] = await form.parse(req);
    
    const fileArray = files.image;
    const file = fileArray && fileArray.length > 0 ? fileArray[0] : null;

    if (!file) {
      console.warn('No image file uploaded in the "image" field.');
      return res.status(400).json({ message: 'No image file provided. Ensure the FormData field name is "image".' });
    }

    console.log(`Received file for upload: originalFilename='${file.originalFilename}', mimetype='${file.mimetype}', size=${file.size} bytes`);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      console.warn(`Invalid file type attempt: ${file.mimetype}`);
      return res.status(400).json({ message: `Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.` });
    }

    const extension = path.extname(file.originalFilename) || `.${file.mimetype.split('/')[1]}` || '.png';
    const uniqueFileName = `${uuidv4()}${extension}`;
    const blob = bucket.file(uniqueFileName);
    const blobStream = blob.createWriteStream({
      metadata: { contentType: file.mimetype },
      resumable: false,
    });

    console.log(`Uploading ${uniqueFileName} to bucket ${bucketName}...`);
    await uploadFileToGCS(file.filepath, blobStream);

    console.log(`Successfully uploaded ${uniqueFileName}.`);
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
    
    return res.status(200).json({ message: 'Image uploaded successfully', url: publicUrl });

  } catch (error) {
    console.error('An error occurred during image upload:', error);
    const errorMessage = (error.message || '').toLowerCase();

    if (error.code === 403 || errorMessage.includes('forbidden')) {
         console.error('GCS PERMISSION ERROR: The service account likely lacks the "Storage Object Creator" role.');
         return res.status(500).json({ 
            message: 'Failed to upload image due to a permission issue.',
            details: `The server responded with a permissions error (Code: ${error.code || 'N/A'}). Please ensure the service account for this app has the "Storage Object Creator" role on the "${bucketName}" bucket in your Google Cloud project.`
        });
    }

    if (errorMessage.includes('could not refresh access token')) {
        return res.status(500).json({
            message: 'Authentication failed while trying to access Google Cloud Storage.',
            details: `The server could not refresh its access token (Original error: ${error.message}). This is often a permissions issue. Please ensure the service account for this app has the "Service Account Token Creator" IAM role in your Google Cloud project.`
        });
    }

    return res.status(500).json({ 
        message: 'Failed to upload image.',
        details: error.message || 'An unexpected server error occurred.'
    });
  }
};
