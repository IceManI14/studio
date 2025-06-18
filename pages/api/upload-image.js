
// pages/api/upload-image.js
import { Storage } from '@google-cloud/storage';
import formidable from 'formidable'; // Using formidable v3
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs'; // Import fs for createReadStream

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parser for file uploads
  },
};

export default async (req, res) => {
  if (req.method !== 'POST') {
    console.warn(`Method ${req.method} not allowed for /api/upload-image. This endpoint only accepts POST requests for file uploads.`);
    return res.status(405).json({ message: 'Method Not Allowed. Only POST requests are accepted.' });
  }

  if (!process.env.GCP_PROJECT_ID || !process.env.CLOUD_STORAGE_BUCKET_NAME) {
    console.error('GCP_PROJECT_ID or CLOUD_STORAGE_BUCKET_NAME is not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error: Missing critical environment variables (Cloud Project ID or Storage Bucket Name).' });
  }

  const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  const bucketName = process.env.CLOUD_STORAGE_BUCKET_NAME;

  const form = formidable({ multiples: false });
  let responseSent = false; // Flag to prevent multiple responses

  form.parse(req, async (err, fields, files) => {
    if (responseSent) return;

    if (err) {
      console.error('Error parsing form data:', err);
      responseSent = true;
      return res.status(500).json({ message: 'Error parsing uploaded file data.', details: err.message });
    }

    const fileArray = files.image; // 'image' is the field name in FormData
    const file = fileArray && fileArray.length > 0 ? fileArray[0] : null;

    if (!file) {
      if (responseSent) return;
      console.warn('No image file uploaded in the "image" field.');
      responseSent = true;
      return res.status(400).json({ message: 'No image file provided in the upload.' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      if (responseSent) return;
      console.warn(`Invalid file type attempt: ${file.mimetype}`);
      responseSent = true;
      return res.status(400).json({ message: `Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed. Received: ${file.mimetype}` });
    }

    // Better fallback for extension if originalFilename is missing
    let extension = '.png'; // Default extension
    if (file.originalFilename) {
      extension = path.extname(file.originalFilename);
    } else if (file.mimetype) {
      const typePart = file.mimetype.split('/')[1];
      if (typePart) {
        extension = `.${typePart}`;
      }
    }
    const uniqueFileName = `${uuidv4()}${extension}`;


    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(uniqueFileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
      resumable: false,
    });

    blobStream.on('error', (uploadError) => {
      if (responseSent) return;
      console.error('Error streaming image to Cloud Storage:', uploadError);
      responseSent = true;
      res.status(500).json({ message: 'Failed to upload image to Cloud Storage. This could be a permission issue or network problem. Check server logs.', details: uploadError.message });
    });

    blobStream.on('finish', () => {
      if (responseSent) return; 
      blob.makePublic()
        .then(() => {
          if (responseSent) return;
          const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
          console.log(`Image uploaded successfully: ${publicUrl}`);
          responseSent = true;
          res.status(200).json({ message: 'Image uploaded successfully', url: publicUrl });
        })
        .catch((makePublicError) => {
          if (responseSent) return;
          console.error('Error making image public after upload:', makePublicError);
          responseSent = true;
          const privateUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
          res.status(500).json({ 
            message: 'Image uploaded but failed to make public. Check bucket/object permissions. The file might be in the bucket but not accessible via public URL.',
            details: makePublicError.message,
            url: privateUrl,
            isPrivate: true
          });
        });
    });

    try {
      const readStream = fs.createReadStream(file.filepath);
      readStream.on('error', (readStreamError) => {
        if (responseSent) return;
        console.error('Error reading file from temporary path:', file.filepath, readStreamError);
        blobStream.end(); 
        responseSent = true;
        res.status(500).json({ message: 'Failed to read uploaded file from server disk.', details: readStreamError.message, tempPath: file.filepath });
      });
      readStream.pipe(blobStream);
    } catch (pipeError) {
      if (responseSent) return;
      console.error('Error setting up file stream pipe:', pipeError);
      blobStream.end(); 
      responseSent = true;
      res.status(500).json({ message: 'Internal server error during file processing.', details: pipeError.message });
    }
  });
};
