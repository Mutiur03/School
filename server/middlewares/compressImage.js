import sharp from "sharp";
import path from "path";
import fs from "fs";

const __dirname = path.resolve();

// Reusable middleware to compress images and save to target location
export const compressImageToLocation = ({
  targetLocation,
  targetSizeKB = 200,
}) => {
  return async (req, res, next) => {
    try {
      if (!req.file && !req.files) {
        return next();
      }

      // Ensure target directory exists
      const absoluteTargetPath = path.join(__dirname, targetLocation);
      fs.mkdirSync(absoluteTargetPath, { recursive: true });

      const processFile = async (file, isImage = true) => {
        // Get buffer: if multer provides buffer, use it; otherwise, read from disk
        let fileBuffer;
        if (file.buffer) {
          fileBuffer = file.buffer;
        } else if (file.path) {
          fileBuffer = fs.readFileSync(
            path.isAbsolute(file.path)
              ? file.path
              : path.join(__dirname, file.path)
          );
        } else {
          throw new Error("File object missing both buffer and path");
        }

        if (isImage) {
          // Skip non-image files
          if (!file.mimetype.startsWith("image/")) {
            console.log(
              `Skipping compression for non-image file: ${file.originalname}`
            );
            return;
          }

          // Compress image, keep original format
          let quality = 90;
          let outputBuffer = fileBuffer;
          let sizeKB = outputBuffer.length / 1024;
          console.log(`Original image size: ${sizeKB.toFixed(2)} KB`);

          // Detect format from mimetype
          const format = file.mimetype.split("/")[1].toLowerCase();

          // Only compress if supported by sharp
          const compressOptions = {};
          if (format === "jpeg" || format === "jpg") {
            compressOptions.jpeg = { quality };
          } else if (format === "png") {
            compressOptions.png = { quality, compressionLevel: 9 };
          } else if (format === "webp") {
            compressOptions.webp = { quality };
          }

          // Try compressing until under targetSizeKB or quality threshold
          while (
            sizeKB > targetSizeKB &&
            quality > 10 &&
            compressOptions[format]
          ) {
            outputBuffer = await sharp(fileBuffer)
              [format](compressOptions[format])
              .toBuffer();
            sizeKB = outputBuffer.length / 1024;
            console.log(
              `${format.toUpperCase()} at quality ${quality}: ${sizeKB.toFixed(
                2
              )} KB`
            );
            quality -= 10;
            // Update quality for next round
            if (compressOptions[format])
              compressOptions[format].quality = quality;
          }

          if (sizeKB > targetSizeKB) {
            console.warn(
              `Warning: Could not compress image to under ${targetSizeKB} KB. Using smallest size: ${sizeKB.toFixed(
                2
              )} KB at quality ${quality + 10}`
            );
          }

          // Validate output buffer
          try {
            await sharp(outputBuffer).metadata();
            console.log("Output image is valid");
          } catch (error) {
            throw new Error("Failed to create valid image after compression");
          }

          // Generate filename and paths
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = file.originalname.split(".").pop();
          const filename = `${uniqueSuffix}-${
            file.originalname.split(".")[0]
          }.${ext}`;
          const outputPath = path.join(absoluteTargetPath, filename);
          const relativePath = path
            .join(targetLocation, filename)
            .replace(/\\/g, "/");

          // Save compressed image
          await sharp(outputBuffer).toFile(outputPath);

          // Delete original file if it exists and is different from compressed file
          if (file.path && file.path !== relativePath) {
            const originalPath = path.isAbsolute(file.path)
              ? file.path
              : path.join(__dirname, file.path);
            if (fs.existsSync(originalPath)) {
              try {
                fs.unlinkSync(originalPath);
                console.log(`Deleted original image: ${originalPath}`);
              } catch (err) {
                console.warn(
                  `Could not delete original image: ${originalPath}`,
                  err
                );
              }
            }
          }

          // Verify file was saved
          if (!fs.existsSync(outputPath)) {
            throw new Error(`Failed to save image to ${outputPath}`);
          }
          console.log(
            `Image saved to ${outputPath}, size: ${(
              fs.statSync(outputPath).size / 1024
            ).toFixed(2)} KB`
          );

          // Update file object
          file.path = relativePath;
          file.filename = filename;
          file.destination = targetLocation.replace(/\\/g, "/");
          // Keep original mimetype
          // file.mimetype = file.mimetype;
        } else {
          // Handle non-image files (e.g., PDF)
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const filename = `${uniqueSuffix}-${file.originalname}`;
          const outputPath = path.join(absoluteTargetPath, filename);
          const relativePath = path
            .join(targetLocation, filename)
            .replace(/\\/g, "/");

          // Save non-image file directly
          fs.writeFileSync(outputPath, fileBuffer);

          // Verify file was saved
          if (!fs.existsSync(outputPath)) {
            throw new Error(`Failed to save file to ${outputPath}`);
          }
          console.log(
            `File saved to ${outputPath}, size: ${(
              fs.statSync(outputPath).size / 1024
            ).toFixed(2)} KB`
          );

          // Update file object
          file.path = relativePath;
          file.filename = filename;
          file.destination = targetLocation.replace(/\\/g, "/");
        }
      };

      if (req.files) {
        // Handle array upload
        if (Array.isArray(req.files)) {
          await Promise.all(req.files.map((file) => processFile(file, true)));
        }
        // Handle fields (e.g., upload.fields)
        if (req.files.image) {
          await Promise.all(
            req.files.image.map((file) => processFile(file, true))
          );
        }
        if (req.files.file) {
          await Promise.all(
            req.files.file.map((file) => processFile(file, false))
          );
        }
      } else if (req.file) {
        // Handle single file (upload.single)
        await processFile(req.file, true);
      }

      next();
    } catch (error) {
      console.error("Compression error:", error);
      res.status(500).send(`Error processing file: ${error.message}`);
    }
  };
};
