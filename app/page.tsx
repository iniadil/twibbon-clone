"use client";

import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import AvatarEditor from "react-avatar-editor";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const FRAME_SRC = "/frame.png"; // Path to your frame in the public folder
const DOWNLOAD_RESOLUTION = 1080; // Resolution for the downloaded image

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<File | string | null>(
    null
  );
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [frameDimensions, setFrameDimensions] = useState({
    width: 800,
    height: 800,
  }); // Default dimensions
  const [scale, setScale] = useState(1);
  const [initialScale, setInitialScale] = useState(1); // Add state for initial scale
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 }); // AvatarEditor uses relative positioning (0-1)
  const editorRef = useRef<AvatarEditor>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Handle zoom (wheel and pinch)
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    let touchInitialDistance: number | null = null;
    let touchInitialScale = 1;

    const handleWheel = (e: WheelEvent) => {
      if (!uploadedImage) return;

      e.preventDefault();
      const delta = -e.deltaY * 0.001; // Invert and scale down delta
      setScale((prev) => {
        const newScale = prev + delta;
        // Don't allow zooming smaller than initial scale or larger than 3x
        return Math.min(Math.max(newScale, initialScale), 3);
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!uploadedImage || e.touches.length !== 2) return;
      touchInitialDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      // Store the current scale as the "start" scale for this pinch action
      touchInitialScale = scale;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (
        !uploadedImage ||
        e.touches.length !== 2 ||
        touchInitialDistance === null
      )
        return;

      e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      const scaleFactor = currentDistance / touchInitialDistance;
      // Use the stored touchInitialScale here instead of referencing 'scale' again
      const newScale = touchInitialScale * scaleFactor;

      setScale(() => {
        const constrainedScale = Math.min(Math.max(newScale, initialScale), 3);
        return constrainedScale;
      });
    };

    const handleTouchEnd = () => {
      touchInitialDistance = null;
    };

    container.addEventListener("wheel", handleWheel);
    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [uploadedImage, scale, initialScale]);

  // Load frame image
  useEffect(() => {
    const frame = new Image();
    frame.onload = () => {
      setFrameImage(frame);
      setFrameDimensions({
        width: frame.naturalWidth,
        height: frame.naturalHeight,
      });
    };
    frame.onerror = () =>
      console.error("Failed to load frame image at:", FRAME_SRC);
    frame.src = FRAME_SRC;
  }, []);

  // Handle image upload
  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        // Calculate initial scale to fit image within frame
        const frameAspect = frameDimensions.width / frameDimensions.height;
        const imgAspect = img.width / img.height;

        // Scale to fit the smaller dimension
        let newInitialScale = 1;
        if (imgAspect > frameAspect) {
          // Image is wider than frame - scale based on width
          newInitialScale = frameDimensions.width / img.width;
        } else {
          // Image is taller than frame - scale based on height
          newInitialScale = frameDimensions.height / img.height;
        }

        // Ensure image fits within frame dimensions
        if (newInitialScale > 1) {
          newInitialScale = 1; // Never scale up beyond original size
        } else if (newInitialScale < 0.5) {
          newInitialScale = 0.5; // Don't make too small
        }

        setInitialScale(newInitialScale);
        setScale(newInitialScale);
        setPosition({ x: 0.5, y: 0.5 }); // Center position
        setUploadedImage(file);
      };
      img.src = URL.createObjectURL(file);
    }
    // Clear the input value to allow uploading the same file again
    event.target.value = "";
  };

  // Handle download
  const handleDownload = () => {
    if (!uploadedImage || !frameImage || !editorRef.current) {
      alert("Please upload an image and wait for the frame to load.");
      return;
    }

    // Get the canvas from AvatarEditor
    const canvas = editorRef.current.getImageScaledToCanvas();
    const offscreenCanvas = document.createElement("canvas");
    const offCtx = offscreenCanvas.getContext("2d");
    if (!offCtx) {
      alert("Could not create canvas context for download.");
      return;
    }

    // Use frame dimensions as base for download resolution
    const baseSize = Math.max(
      frameImage.naturalWidth,
      frameImage.naturalHeight
    );
    const scaleFactor = DOWNLOAD_RESOLUTION / baseSize;

    const finalWidth = Math.round(frameImage.naturalWidth * scaleFactor);
    const finalHeight = Math.round(frameImage.naturalHeight * scaleFactor);

    offscreenCanvas.width = finalWidth;
    offscreenCanvas.height = finalHeight;

    // Fill background (optional, if frame is transparent)
    offCtx.fillStyle = "white";
    offCtx.fillRect(0, 0, finalWidth, finalHeight);

    // Draw the user's image from AvatarEditor
    offCtx.drawImage(
      canvas,
      0,
      0,
      canvas.width,
      canvas.height,
      0,
      0,
      finalWidth,
      finalHeight
    );

    // Draw the frame image over it (scaled to final dimensions)
    offCtx.drawImage(frameImage, 0, 0, finalWidth, finalHeight);

    // Get data URL and trigger download
    const dataUrl = offscreenCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "twibbon-result.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
      <h1 className="text-xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center text-black">
        Twibbon Pesantren Tahfiz Ibnu Aqil
      </h1>

      <div className="mb-4">
        <label
          htmlFor="imageUpload"
          className="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300 text-sm sm:text-base"
        >
          Upload Your Photo
        </label>
        <input
          id="imageUpload"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Avatar Editor Container */}
      <div
        ref={editorContainerRef}
        className="relative mb-4 w-full max-w-md bg-gray-300 overflow-hidden"
        style={{
          maxWidth: `${frameDimensions.width}px`,
          maxHeight: `${frameDimensions.height}px`,
        }}
      >
        <div
          style={{
            aspectRatio: `${frameDimensions.width}/${frameDimensions.height}`,
            width: "100%",
            height: "100%",
          }}
        >
          {uploadedImage && frameImage && (
            <AvatarEditor
              ref={editorRef}
              image={uploadedImage}
              width={frameImage.naturalWidth}
              height={frameImage.naturalHeight}
              border={0}
              color={[255, 255, 255, 0.6]} // RGBA
              scale={scale}
              position={position}
              onPositionChange={setPosition}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          )}
          {!uploadedImage && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none p-4 text-center">
              Upload an image to begin
            </div>
          )}
          {/* Frame Overlay */}
          {frameImage && (
            <img
              src={FRAME_SRC}
              alt="Twibbon Frame"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none border-2 border-dashed border-gray-400"
            />
          )}
        </div>
      </div>

      {/* Zoom Controls */}
      {uploadedImage && (
        <div className="flex items-center gap-2 mb-4 w-full max-w-md px-2">
          <span className="text-sm font-medium text-gray-700">Zoom:</span>
          <input
            type="range"
            min={initialScale}
            max="3"
            step="0.05"
            value={scale}
            onChange={(e) => {
              const newScale = parseFloat(e.target.value);
              setScale(Math.min(Math.max(newScale, initialScale), 3));
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            aria-label="Zoom slider"
          />
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={!uploadedImage || !frameImage} // Also disable if frame hasn't loaded
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition duration-300 text-sm sm:text-base"
      >
        Download Twibbon
      </button>
    </div>
  );
}
