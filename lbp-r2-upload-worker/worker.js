function getConfig(env) {
  return {
    MAX_FILE_SIZE: parseInt(env.MAX_FILE_SIZE) || 104857600, // Default 100MB
    URL_EXPIRATION: parseInt(env.URL_EXPIRATION) || 3600, // Default 1 hour

    // Type definitions with allowed MIME types
    TYPES: {
      image: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ],
      video: ["video/mp4", "video/webm", "video/quicktime"],
      audio: ["audio/mpeg", "audio/wav", "audio/aac"],
      pdf: ["application/pdf"],
      document: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
    },
  };
}

/**
 * Generate a unique filename with timestamp and UUID
 */
function generateUniqueFilename(originalFilename, type) {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID();
  // Get extension from filename or default to bin if missing
  const parts = originalFilename.split(".");
  const extension = parts.length > 1 ? parts.pop() : "bin";
  const baseName = parts.join(".") || "file";

  // Sanitize filename
  const sanitized = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");

  // Add type folder prefix for better organization in bucket
  return `${type}/${timestamp}-${randomId}-${sanitized}.${extension}`;
}

/**
 * Validate file metadata
 */
function validateFile(
  filename,
  contentType,
  fileSize,
  allowedTypes,
  maxFileSize,
) {
  const errors = [];

  if (!filename || filename.trim() === "") {
    errors.push("Filename is required");
  }

  if (!contentType || contentType.trim() === "") {
    errors.push("Content type is required");
  } else if (allowedTypes && !allowedTypes.includes(contentType)) {
    errors.push(`Content type ${contentType} is not allowed for this route.`);
  }

  if (!fileSize || fileSize <= 0) {
    errors.push("File size must be greater than 0");
  } else if (fileSize > maxFileSize) {
    errors.push(
      `File size exceeds maximum allowed size of ${maxFileSize / (1024 * 1024)}MB`,
    );
  }

  return errors;
}

/**
 * CORS headers
 */
function getCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, PUT, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
function handleOptions(request) {
  const origin = request.headers.get("Origin");
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

/**
 * Generate upload token and URL
 */
async function generateUploadInfo(filename, type, expiration) {
  const uniqueFilename = generateUniqueFilename(filename, type);

  return {
    uploadUrl: `/${uniqueFilename}`, // Matches the PUT route format
    key: uniqueFilename,
    expiresIn: expiration,
  };
}

/**
 * Handle POST request to generate upload URL
 */
async function handleUploadRequest(request, env, type) {
  const origin = request.headers.get("Origin");
  const config = getConfig(env);

  try {
    // Parse request body
    const body = await request.json();
    const { filename, contentType, fileSize } = body;

    // Get allowed types for this specific route
    const allowedTypes = config.TYPES[type];

    if (!allowedTypes) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid upload type: ${type}`,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders(origin),
          },
        },
      );
    }

    // Validate input
    const validationErrors = validateFile(
      filename,
      contentType,
      fileSize,
      allowedTypes,
      config.MAX_FILE_SIZE,
    );

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          errors: validationErrors,
          allowedTypes: allowedTypes,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders(origin),
          },
        },
      );
    }

    // Generate upload info
    const result = await generateUploadInfo(
      filename,
      type,
      config.URL_EXPIRATION,
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(origin),
        },
      },
    );
  } catch (error) {
    console.error(`Error generating upload URL for ${type}:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to generate upload URL",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(origin),
        },
      },
    );
  }
}

/**
 * Handle file upload to R2
 */
async function handleFileUpload(request, env, key) {
  const origin = request.headers.get("Origin");

  try {
    const contentType = request.headers.get("Content-Type");

    if (!request.body) {
      throw new Error("No file content received");
    }

    // Upload to R2
    await env.MY_BUCKET.put(key, request.body, {
      httpMetadata: {
        contentType: contentType,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "File uploaded successfully",
        key: key,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(origin),
        },
      },
    );
  } catch (error) {
    console.error("Error uploading file:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to upload file",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(origin),
        },
      },
    );
  }
}

/**
 * Main worker entry point
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    // Type-specific upload endpoints (POST /upload/image, /upload/video, etc.)
    // Matches /upload/:type
    const uploadMatch = url.pathname.match(
      /^\/upload\/(image|video|audio|pdf|document)$/,
    );

    if (uploadMatch && request.method === "POST") {
      const type = uploadMatch[1];
      return handleUploadRequest(request, env, type);
    }

    // Handle actual file upload (PUT /folder/filename.ext)
    // We allow any path depth for organization (e.g. /image/123.jpg)
    if (request.method === "PUT") {
      // Remove leading slash to get key
      const key = url.pathname.substring(1);
      if (key) {
        return handleFileUpload(request, env, key);
      }
    }

    // Handle health check
    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
          config: {
            maxSize: env.MAX_FILE_SIZE || "default",
            expiration: env.URL_EXPIRATION || "default",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({
        success: false,
        error: "Not found",
        message:
          "Available endpoints: POST /upload/image, /upload/video, /upload/audio, /upload/pdf",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  },
};
