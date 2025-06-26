
// pages/api/upload-pdf.js
import { Storage } from '@google-cloud/storage';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parser for file uploads
  },
};

export default async (req, res) => {
  if (req.method !== 'POST') {
    console.warn(`Method ${req.method} not allowed for /api/upload-pdf. This endpoint only accepts POST requests. Origin: ${req.headers.referer || 'Unknown'}`);
    return res.status(405).json({ message: 'Method Not Allowed. Only POST requests are accepted for PDF uploads.' });
  }

  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    console.error('CRITICAL SERVER CONFIG ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set in environment variables. PDF upload cannot proceed.');
    return res.status(500).json({ message: 'Server configuration error: Missing Firebase Project ID or Storage Bucket Name in .env file. Please check server environment setup.' });
  }

  const storage = new Storage({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  const form = formidable({ multiples: false });
  let responseSent = false; // Flag to prevent multiple responses

  form.parse(req, async (err, fields, files) => {
    if (responseSent) return;

    const fileArray = files.pdfFile; // Expect 'pdfFile' as the field name from FormData
    const file = fileArray && fileArray.length > 0 ? fileArray[0] : null;

    if (err) {
      console.error('Error parsing form data for PDF upload:', err, { originalFilename: file?.originalFilename, mimetype: file?.mimetype, tempPath: file?.filepath });
      responseSent = true;
      return res.status(500).json({ message: 'Error parsing uploaded PDF data. Check if the file is being sent correctly.', details: err.message });
    }

    if (!file) {
      if (responseSent) return;
      console.warn('No PDF file uploaded in the "pdfFile" field. Ensure FormData field name is "pdfFile".');
      responseSent = true;
      return res.status(400).json({ message: 'No PDF file provided in the upload. Ensure the FormData field name is "pdfFile".' });
    }

    // Log details of the received file
    console.log(`Received file for PDF upload: originalFilename='${file.originalFilename}', mimetype='${file.mimetype}', size=${file.size} bytes, tempPath='${file.filepath}'`);

    const allowedTypes = ['application/pdf'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      if (responseSent) return;
      console.warn(`Invalid file type attempt for PDF: ${file.mimetype}. Original filename: ${file.originalFilename}. Allowed types: ${allowedTypes.join(', ')}`);
      responseSent = true;
      return res.status(400).json({ message: `Invalid file type. Only PDF (application/pdf) is allowed. Received: ${file.mimetype}` });
    }

    if (file.size === 0) {
      if (responseSent) return;
      console.warn(`Uploaded file ${file.originalFilename || 'unknown_filename'} is empty (0 bytes). Aborting upload.`);
      responseSent = true;
      return res.status(400).json({ message: `Uploaded file is empty. Please select a valid file.` });
    }

    const extension = '.pdf';
    const uniqueFileName = `${uuidv4()}${extension}`;

    console.log(`Attempting to upload PDF: ${file.originalFilename || 'unknown_filename'} (Type: ${file.mimetype}, Size: ${file.size} bytes) as ${uniqueFileName} to bucket ${bucketName}. Temp path: ${file.filepath}`);

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
      console.error(`Error streaming PDF to Google Cloud Storage (Bucket: ${bucketName}, File: ${uniqueFileName}):`, uploadError);
      console.error('GCS STREAM ERROR HINT: This often indicates a permissions issue. Ensure the service account running this server has "Storage Object Creator" (or "Storage Object Admin") role on the bucket. Also check bucket existence and network connectivity to GCS.');
      responseSent = true;
      res.status(500).json({ message: 'Failed to upload PDF to Cloud Storage. Check server logs for GCS error details.', details: uploadError.message });
    });

    blobStream.on('finish', () => {
      if (responseSent) return;
      console.log(`PDF successfully streamed to GCS: ${uniqueFileName}. The file is now uploaded.`);
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
      console.log(`PDF accessible at public URL: ${publicUrl}. NOTE: This URL is only valid if the bucket has public read access enabled.`);
      responseSent = true;
      res.status(200).json({ message: 'PDF uploaded successfully', url: publicUrl });
    });

    try {
      const readStream = fs.createReadStream(file.filepath);
      readStream.on('error', (readStreamError) => {
        if (responseSent) return;
        console.error(`Error reading PDF file from temporary path: ${file.filepath}. Original filename: ${file.originalFilename}.`, readStreamError);
        blobStream.end(); // Important to end the GCS stream if read fails
        responseSent = true;
        res.status(500).json({ message: 'Failed to read uploaded PDF file from server disk. Check server disk space and permissions.', details: readStreamError.message, tempPath: file.filepath });
      });
      console.log(`Starting to pipe PDF from ${file.filepath} to GCS blob ${uniqueFileName}.`);
      readStream.pipe(blobStream);
    } catch (pipeError) { // This catch block might be for synchronous errors in setting up the pipe
      if (responseSent) return;
      console.error(`Error setting up PDF file stream pipe (Original Filename: ${file.originalFilename}, Temp Path: ${file.filepath}):`, pipeError);
      blobStream.end(); // Ensure GCS stream is closed
      responseSent = true;
      res.status(500).json({ message: 'Internal server error during PDF file processing setup.', details: pipeError.message });
    }
  });
};
