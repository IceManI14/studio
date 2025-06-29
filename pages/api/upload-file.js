// pages/api/upload-file.js
import { Storage } from '@google-cloud/storage';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

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
    return res.status(405).json({ message: 'Method Not Allowed. Only POST requests are accepted.' });
  }

  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    return res.status(500).json({ message: 'Server configuration error: Missing Firebase Project ID or Storage Bucket Name.' });
  }

  const storage = new Storage({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const bucket = storage.bucket(bucketName);
  
  const form = formidable({ multiples: false });

  try {
    const [fields, files] = await form.parse(req);

    const fileArray = files.file; // Use a generic 'file' field
    const file = fileArray && fileArray.length > 0 ? fileArray[0] : null;

    if (!file) {
      return res.status(400).json({ message: 'No file provided. Ensure the FormData field name is "file".' });
    }
    
    const allowedTypes = ['application/pdf', 'text/csv', 'image/jpeg', 'image/png', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ message: `Invalid file type. Only PDF, CSV, and images are allowed.` });
    }

    const extension = path.extname(file.originalFilename) || `.${file.mimetype.split('/')[1]}` || '';
    const uniqueFileName = `${uuidv4()}${extension}`;
    const blob = bucket.file(uniqueFileName);
    const blobStream = blob.createWriteStream({
      metadata: { contentType: file.mimetype },
      resumable: false,
    });

    await uploadFileToGCS(file.filepath, blobStream);

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
    
    return res.status(200).json({ message: 'File uploaded successfully', url: publicUrl, name: file.originalFilename, type: file.mimetype });

  } catch (error) {
    console.error('An error occurred during file upload:', error);
    const errorMessage = (error.message || '').toLowerCase();

    if (error.code === 403 || errorMessage.includes('forbidden')) {
         return res.status(500).json({ 
            message: 'Failed to upload file due to a permission issue.',
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
        message: 'Failed to upload file.',
        details: error.message || 'An unexpected server error occurred.'
    });
  }
};
