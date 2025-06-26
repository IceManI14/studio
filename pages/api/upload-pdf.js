// pages/api/upload-pdf.js
import { Storage } from '@google-cloud/storage';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';
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
    console.warn(`Method ${req.method} not allowed for /api/upload-pdf.`);
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

    const fileArray = files.pdfFile;
    const file = fileArray && fileArray.length > 0 ? fileArray[0] : null;

    if (!file) {
      console.warn('No PDF file uploaded in the "pdfFile" field.');
      return res.status(400).json({ message: 'No PDF file provided. Ensure the FormData field name is "pdfFile".' });
    }

    console.log(`Received PDF for upload: originalFilename='${file.originalFilename}', mimetype='${file.mimetype}', size=${file.size} bytes`);

    if (file.mimetype !== 'application/pdf') {
      console.warn(`Invalid file type attempt for PDF: ${file.mimetype}.`);
      return res.status(400).json({ message: 'Invalid file type. Only PDF (application/pdf) is allowed.' });
    }

    const uniqueFileName = `${uuidv4()}.pdf`;
    const blob = bucket.file(uniqueFileName);
    const blobStream = blob.createWriteStream({
      metadata: { contentType: file.mimetype },
      resumable: false,
    });

    console.log(`Uploading ${uniqueFileName} to bucket ${bucketName}...`);
    await uploadFileToGCS(file.filepath, blobStream);

    console.log(`Successfully uploaded ${uniqueFileName}.`);
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
    
    return res.status(200).json({ message: 'PDF uploaded successfully', url: publicUrl });

  } catch (error) {
    console.error('An error occurred during PDF upload:', error);

    if (error.code === 403 || (error.message && error.message.toLowerCase().includes('forbidden'))) {
         console.error('GCS PERMISSION ERROR: The service account likely lacks the "Storage Object Creator" role.');
         return res.status(500).json({ 
            message: 'Failed to upload PDF due to a permission issue.',
            details: `The server responded with a permissions error (Code: ${error.code || 'N/A'}). Please ensure the service account for this app has the "Storage Object Creator" role on the "${bucketName}" bucket in your Google Cloud project.`
        });
    }

    return res.status(500).json({ 
        message: 'Failed to upload PDF.',
        details: error.message || 'An unexpected server error occurred.'
    });
  }
};
