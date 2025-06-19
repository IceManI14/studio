
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
    console.warn(`Method ${req.method} not allowed for /api/upload-image. This endpoint only accepts POST requests. Origin: ${req.headers.referer || 'Unknown'}`);
    return res.status(405).json({ message: 'Method Not Allowed. Only POST requests are accepted for image uploads.' });
  }

  if (!process.env.GCP_PROJECT_ID || !process.env.CLOUD_STORAGE_BUCKET_NAME) {
    console.error('CRITICAL SERVER CONFIG ERROR: GCP_PROJECT_ID or CLOUD_STORAGE_BUCKET_NAME is not set in environment variables. Image upload cannot proceed.');
    return res.status(500).json({ message: 'Server configuration error: Missing critical environment variables (Cloud Project ID or Storage Bucket Name). Please check server environment setup.' });
  }

  const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  const bucketName = process.env.CLOUD_STORAGE_BUCKET_NAME;

  const form = formidable({ multiples: false });
  let responseSent = false; // Flag to prevent multiple responses

  form.parse(req, async (err, fields, files) => {
    if (responseSent) return;

    const fileArray = files.image; // 'image' is the field name in FormData
    const file = fileArray && fileArray.length > 0 ? fileArray[0] : null;

    if (err) {
      console.error('Error parsing form data for image upload:', err, { originalFilename: file?.originalFilename, mimetype: file?.mimetype, tempPath: file?.filepath });
      responseSent = true;
      return res.status(500).json({ message: 'Error parsing uploaded file data. Check if the file is being sent correctly.', details: err.message });
    }

    if (!file) {
      if (responseSent) return;
      console.warn('No image file uploaded in the "image" field. Ensure FormData field name is "image".');
      responseSent = true;
      return res.status(400).json({ message: 'No image file provided in the upload. Ensure the FormData field name is "image".' });
    }

    // Log details of the received file
    console.log(`Received file for image upload: originalFilename='${file.originalFilename}', mimetype='${file.mimetype}', size=${file.size} bytes, tempPath='${file.filepath}'`);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      if (responseSent) return;
      console.warn(`Invalid file type attempt for image: ${file.mimetype}. Original filename: ${file.originalFilename}. Allowed types: ${allowedTypes.join(', ')}`);
      responseSent = true;
      return res.status(400).json({ message: `Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed. Received: ${file.mimetype}` });
    }

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

    console.log(`Attempting to upload image: ${file.originalFilename || 'unknown_filename'} (Type: ${file.mimetype}, Size: ${file.size} bytes) as ${uniqueFileName} to bucket ${bucketName}. Temp path: ${file.filepath}`);

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
      console.error(`Error streaming image to Google Cloud Storage (Bucket: ${bucketName}, File: ${uniqueFileName}):`, uploadError);
      console.error('GCS STREAM ERROR HINT: This often indicates a permissions issue. Ensure the service account running this server has "Storage Object Creator" (or "Storage Object Admin") role on the bucket. Also check bucket existence and network connectivity to GCS.');
      responseSent = true;
      res.status(500).json({ message: 'Failed to upload image to Cloud Storage. Check server logs for GCS error details.', details: uploadError.message });
    });

    blobStream.on('finish', () => {
      if (responseSent) return;
      console.log(`Image successfully streamed to GCS: ${uniqueFileName}. Attempting to make public.`);
      blob.makePublic()
        .then(() => {
          if (responseSent) return;
          const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
          console.log(`Image uploaded and made public successfully: ${publicUrl}`);
          responseSent = true;
          res.status(200).json({ message: 'Image uploaded successfully', url: publicUrl });
        })
        .catch((makePublicError) => {
          if (responseSent) return;
          console.error(`Error making image public after upload (Bucket: ${bucketName}, File: ${uniqueFileName}):`, makePublicError);
          console.error('GCS MAKE PUBLIC ERROR HINT: This could be a permissions issue (e.g., service account needs "Storage Object Viewer" or "Storage Admin" if not already covered by "Storage Object Creator" for making public). Also ensure "Uniform bucket-level access" is not preventing per-object ACLs if you rely on them.');
          responseSent = true;
          const privateUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`; // URL might still be valid if object exists but isn't public
          res.status(500).json({
            message: 'Image uploaded but failed to make public. Check bucket/object permissions and server logs.',
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
        console.error(`Error reading image file from temporary path: ${file.filepath}. Original filename: ${file.originalFilename}.`, readStreamError);
        blobStream.end(); // Important to end the GCS stream if read fails
        responseSent = true;
        res.status(500).json({ message: 'Failed to read uploaded image file from server disk. Check server disk space and permissions.', details: readStreamError.message, tempPath: file.filepath });
      });
      console.log(`Starting to pipe image from ${file.filepath} to GCS blob ${uniqueFileName}.`);
      readStream.pipe(blobStream);
    } catch (pipeError) { // This catch block might be for synchronous errors in setting up the pipe
      if (responseSent) return;
      console.error(`Error setting up image file stream pipe (Original Filename: ${file.originalFilename}, Temp Path: ${file.filepath}):`, pipeError);
      blobStream.end(); // Ensure GCS stream is closed
      responseSent = true;
      res.status(500).json({ message: 'Internal server error during image file processing setup.', details: pipeError.message });
    }
  });
};
