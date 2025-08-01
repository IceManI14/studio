
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
  console.log(`[api/upload-file] - INFO: Received ${req.method} request.`);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed. Only POST requests are accepted.' });
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !bucketName) {
    console.error('[api/upload-file] - FATAL: Server configuration error. Missing Firebase Project ID or Storage Bucket Name in .env file.');
    return res.status(500).json({ message: 'Server configuration error: Your app is missing essential Firebase configuration for file storage.' });
  }

  console.log(`[api/upload-file] - INFO: Using Project ID: '${projectId}', Storage Bucket: '${bucketName}'.`);

  const storage = new Storage({ projectId });
  const bucket = storage.bucket(bucketName);
  
  const form = formidable({ multiples: false });

  try {
    const [fields, files] = await form.parse(req);

    const fileArray = files.file;
    const file = fileArray && fileArray.length > 0 ? fileArray[0] : null;

    if (!file) {
      return res.status(400).json({ message: 'No file provided. Ensure the FormData field name is "file".' });
    }
    
    console.log(`[api/upload-file] - INFO: Received file for upload: originalFilename='${file.originalFilename}', mimetype='${file.mimetype}', size=${file.size} bytes`);
    
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
    
    console.log(`[api/upload-file] - INFO: Uploading ${uniqueFileName} to bucket ${bucketName}...`);
    await uploadFileToGCS(file.filepath, blobStream);

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
    console.log(`[api/upload-file] - INFO: Successfully uploaded ${uniqueFileName}. Public URL: ${publicUrl}`);
    
    return res.status(200).json({ message: 'File uploaded successfully', url: publicUrl, name: file.originalFilename, type: file.mimetype });

  } catch (error) {
    console.error('[api/upload-file] - ERROR: An error occurred during the upload process.', error);
    const errorMessage = (error.message || '').toLowerCase();

    if (error.code === 404 || errorMessage.includes('not found')) {
      console.error(`[api/upload-file] - BUCKET_NOT_FOUND: The bucket "${bucketName}" does not exist in the project "${projectId}".`);
      return res.status(500).json({ 
          message: 'Storage bucket not found.',
          details: `The specified storage bucket "${bucketName}" does not exist. Please check your .env file and Firebase/Google Cloud project to ensure the bucket name is correct.`
      });
    }

    if (error.code === 403 || errorMessage.includes('forbidden')) {
         console.error('[api/upload-file] - PERMISSION_ERROR: The service account likely lacks the "Storage Object Creator" role.');
         return res.status(500).json({ 
            message: 'Permission Denied: Cannot write to Storage Bucket.',
            details: `Your app's service account does not have permission to upload files. Please go to the IAM page in your Google Cloud project and grant the "Storage Object Creator" role to the service account associated with this app.`
        });
    }

    if (errorMessage.includes('could not refresh access token')) {
        console.error('[api/upload-file] - AUTH_ERROR: The service account likely lacks the "Service Account Token Creator" role.');
        return res.status(500).json({
            message: 'Authentication Failed.',
            details: `To fix this, grant the "Service Account Token Creator" role to your app's service account in your Google Cloud IAM page.`
        });
    }
    
    if (errorMessage.includes('formidable')) {
        return res.status(400).json({
            message: 'File Parsing Error',
            details: `There was an issue processing the uploaded file data. Details: ${error.message}`
        });
    }

    return res.status(500).json({ 
        message: 'Failed to upload file.',
        details: error.message || 'An unexpected server error occurred. Check the server logs for more details.'
    });
  }
};
