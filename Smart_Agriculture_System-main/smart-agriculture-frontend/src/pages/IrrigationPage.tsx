"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";
interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
}


const IrrigationPage: React.FC = () => {
  const navigate = useNavigate();

  const [location, setLocation] = useState<string>("");
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [moisture, setMoisture] = useState<number>(50);

  const [temperature, setTemperature] = useState<number | null>(null);
  const [pressure, setPressure] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);

  const [advice, setAdvice] = useState<string>("");

  // ---------------- Location Search ----------------
  const handleSearch = async (query: string) => {
    setLocation(query);

    if (query.length > 2) {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}`
      );
      const data = await response.json();
      setSearchResults(data);
    } else {
      setSearchResults([]);
    }
  };

  const selectLocation = (place: LocationResult) => {
    setLocation(place.display_name);
    setSearchResults([]);
  };

  // ---------------- Fetch Weather ----------------
  const fetchWeatherData = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/check_weather?location=${location}`
      );

      const data = await response.json();
      console.log("Weather response:", data);

      setTemperature(data.main.temp);
      setPressure(data.main.pressure);
      setAltitude(100); // OpenWeather does not provide altitude

      setAdvice("");
    } catch (error) {
      console.error(error);
      setAdvice("Failed to fetch weather data.");
    }
  };

  // ---------------- Irrigation Advice ----------------
  const getIrrigationAdvice = async () => {
    if (temperature === null || pressure === null || altitude === null) {
      setAdvice("Please fetch weather data first.");
      return;
    }

    setAdvice("Fetching irrigation advice...");

    try {
      const response = await fetch("http://127.0.0.1:5000/predict/irrigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temperature,
          pressure,
          altitude,
          soil_moisture: moisture,
        }),
      });

      const data: { prediction: number } = await response.json();
      console.log("Irrigation response:", data);

      setAdvice(
        data.prediction === 1
          ? "Irrigation required"
          : "No irrigation needed"
      );
    } catch (error) {
      console.error(error);
      setAdvice("Failed to get advice. Please try again.");
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="px-4 py-2 border-b flex items-center justify-between bg-white shadow-sm">
        <div className="flex items-center gap-1 font-medium">
          <Leaf className="h-5 w-5 text-green-600" />
          <span>FarmFriend</span>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center text-green-600 text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Home
        </button>
      </header>

      <main className="flex flex-1 items-center justify-end p-6 bg-[url('/latest.png')] bg-cover bg-center relative before:absolute before:inset-0 before:bg-black/40">
        <Card className="w-full max-w-md bg-blue-100 p-6 relative z-10 mr-12">
          <CardHeader>
            <CardTitle className="text-center text-xl">
              Irrigation Advisor
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {temperature === null && (
              <>
                <Label>Enter Your Location</Label>
                <Input
                  value={location}
                  onChange={(e) => handleSearch(e.target.value)}
                />

                {searchResults.length > 0 && (
                  <ul className="bg-white border rounded">
                    {searchResults.map((place, i) => (
                      <li
                        key={i}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => selectLocation(place)}
                      >
                        {place.display_name}
                      </li>
                    ))}
                  </ul>
                )}

                <Button onClick={fetchWeatherData} className="w-full">
                  Fetch Weather Data
                </Button>
              </>
            )}

            {temperature !== null && (
              <>
                <p>Temperature: {temperature} °C</p>
                <p>Pressure: {pressure} hPa</p>
                <p>Altitude: {altitude} m</p>

                <Separator />

                <Label>Soil Moisture (%)</Label>
                <Input
                  type="number"
                  value={moisture}
                  onChange={(e) => setMoisture(Number(e.target.value))}
                />

                <Button onClick={getIrrigationAdvice} className="w-full">
                  Get Advice
                </Button>

                {advice && <p className="font-semibold">{advice}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default IrrigationPage;
