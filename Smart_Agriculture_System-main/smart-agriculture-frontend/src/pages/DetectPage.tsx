"use client";

import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Leaf, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ✅ SAFE RESULT TYPE */
interface DetectionResult {
  disease?: string;
  confidence?: number;
  cause?: string;
  symptoms?: string;
  treatment?: string;
  healthy?: string;
  error?: string;
}

const DetectPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  /* ✅ FILE HANDLER */
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  /* ✅ API CALL */
  const analyzeImage = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);

    try {
      const base64Data = selectedImage.split(",")[1];
      const response = await fetch("http://127.0.0.1:5000/predict/plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${base64Data}`,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch {
      setResult({ error: "Failed to connect to server." });
    }

    setIsAnalyzing(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* HEADER */}
      <header className="px-4 py-2 border-b flex items-center justify-between bg-white shadow-sm">
        <div className="flex items-center gap-1 font-medium">
          <Leaf className="h-5 w-5 text-green-600" />
          <span>FarmFriend</span>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center text-green-600 text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Home
        </button>
      </header>

      {/* MAIN */}
      <main className="flex-1 py-12 bg-[#fef8e6]">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-2">

            {/* UPLOAD CARD */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Plant Image</CardTitle>
                <CardDescription>
                  Upload an image to detect plant diseases
                </CardDescription>
              </CardHeader>

              <CardContent>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleImageChange}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFile(file);
                  }}
                  className={`cursor-pointer border-2 ${
                    isDragging ? "border-green-600" : "border-gray-300"
                  } border-dashed p-6 text-center rounded-lg`}
                >
                  <Upload className="mx-auto h-8 w-8 text-gray-500" />
                  <p className="mt-2 text-sm text-gray-500">
                    Click or drag an image to upload
                  </p>
                </div>

                {selectedImage && (
                  <div className="mt-4 h-[200px] w-[200px] border rounded-lg overflow-hidden">
                    <img
                      src={selectedImage}
                      alt="Selected Plant"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  onClick={analyzeImage}
                  disabled={isAnalyzing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isAnalyzing ? "Analyzing..." : "Detect Disease"}
                </Button>
              </CardFooter>
            </Card>

            {/* RESULT CARD */}
            <Card>
              <CardHeader>
                <CardTitle>Detection Results</CardTitle>
              </CardHeader>

              <CardContent>
                {isAnalyzing && <p className="text-xl">Analyzing...</p>}

                {!isAnalyzing && !result && (
                  <p className="text-xl font-semibold">
                    Upload an image to see results.
                  </p>
                )}

                {result?.error && (
                  <p className="text-red-600 font-semibold">❌ {result.error}</p>
                )}

                {result?.healthy && (
                  <p className="text-green-600 font-semibold">
                    ✔ {result.healthy}
                  </p>
                )}

                {result?.disease && (
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-green-700">
                      {result.disease}
                    </p>

                    <p>
                      Confidence:{" "}
                      <strong>
                        {result.confidence?.toFixed(1) ?? "N/A"}%
                      </strong>
                    </p>

                    {result.cause && (
                      <p>
                        <strong>Cause:</strong> {result.cause}
                      </p>
                    )}

                    {result.symptoms && (
                      <p>
                        <strong>Symptoms:</strong> {result.symptoms}
                      </p>
                    )}

                    {result.treatment && (
                      <p>
                        <strong>Treatment:</strong> {result.treatment}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
};

export default DetectPage;
