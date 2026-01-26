import base64
import os
import io
import joblib
import numpy as np
import requests
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import GlobalAveragePooling2D, Dense, BatchNormalization, Dropout
from tensorflow.keras.models import Model
from dotenv import load_dotenv

# ----------------- Flask App -----------------
app = Flask(__name__)
CORS(app)

# ----------------- Load Environment -----------------
load_dotenv()
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")

# ----------------- Load Irrigation Model -----------------
irrigation_model, scaler = joblib.load("models/irrigation_model.pkl")

# ----------------- Load Plant Disease Model (UNCHANGED) -----------------
base_model = MobileNetV2(
    weights="imagenet",
    include_top=False,
    input_shape=(224, 224, 3)
)

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(1024, activation="relu")(x)
x = Dense(512, activation="relu")(x)
x = BatchNormalization()(x)
x = Dropout(0.2)(x)

prediction = Dense(15, activation="softmax")(x)

plant_model = Model(inputs=base_model.input, outputs=prediction)
plant_model.load_weights("models/plant_disease_model.h5")

# ----------------- Image Preprocessing -----------------
def preprocess_image(img):
    img = img.resize((224, 224))
    img_array = tf.keras.preprocessing.image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0
    return img_array

# ----------------- Class Names -----------------
class_names = [
    "Pepper Bell - Bacterial Spot",
    "Pepper Bell - Healthy",
    "Potato - Early Blight",
    "Potato - Late Blight",
    "Potato - Healthy",
    "Tomato - Bacterial Spot",
    "Tomato - Early Blight",
    "Tomato - Late Blight",
    "Tomato - Leaf Mold",
    "Tomato - Septoria Leaf Spot",
    "Tomato - Spider Mites (Two-Spotted Spider Mite)",
    "Tomato - Target Spot",
    "Tomato - Yellow Leaf Curl Virus",
    "Tomato - Mosaic Virus",
    "Tomato - Healthy"
]

# ----------------- Disease Info -----------------
causes = {
    "Pepper Bell - Bacterial Spot": "Xanthomonas campestris bacteria",
    "Potato - Early Blight": "Alternaria solani fungus",
    "Potato - Late Blight": "Phytophthora infestans pathogen",
    "Tomato - Bacterial Spot": "Xanthomonas campestris bacteria",
    "Tomato - Early Blight": "Alternaria solani fungus",
    "Tomato - Late Blight": "Phytophthora infestans pathogen",
    "Tomato - Leaf Mold": "Passalora fulva fungus",
    "Tomato - Septoria Leaf Spot": "Septoria lycopersici fungus",
    "Tomato - Spider Mites (Two-Spotted Spider Mite)": "Tetranychus urticae mites",
    "Tomato - Target Spot": "Corynespora cassiicola fungus",
    "Tomato - Yellow Leaf Curl Virus": "Tomato yellow leaf curl virus",
    "Tomato - Mosaic Virus": "Tobacco mosaic virus"
}

symptoms = {
    "Pepper Bell - Bacterial Spot": "Dark water-soaked spots on leaves.",
    "Potato - Early Blight": "Brown concentric spots on leaves.",
    "Potato - Late Blight": "Large dark lesions with mold.",
    "Tomato - Bacterial Spot": "Dark leaf spots with yellowing.",
    "Tomato - Early Blight": "Target-like brown spots.",
    "Tomato - Late Blight": "Rapid leaf collapse.",
    "Tomato - Leaf Mold": "Yellow patches and olive mold.",
    "Tomato - Septoria Leaf Spot": "Small circular spots.",
    "Tomato - Spider Mites (Two-Spotted Spider Mite)": "Yellow speckling and webbing.",
    "Tomato - Target Spot": "Brown concentric rings.",
    "Tomato - Yellow Leaf Curl Virus": "Upward curling and yellowing.",
    "Tomato - Mosaic Virus": "Mottled leaf discoloration."
}

treatments = {
    "Pepper Bell - Bacterial Spot": "Use copper fungicides.",
    "Pepper Bell - Healthy": "No treatment required.",
    "Potato - Early Blight": "Apply mancozeb or chlorothalonil.",
    "Potato - Late Blight": "Use metalaxyl fungicides.",
    "Potato - Healthy": "No treatment required.",
    "Tomato - Bacterial Spot": "Use copper sprays.",
    "Tomato - Early Blight": "Remove infected leaves.",
    "Tomato - Late Blight": "Destroy infected plants.",
    "Tomato - Leaf Mold": "Improve air circulation.",
    "Tomato - Septoria Leaf Spot": "Use copper fungicides.",
    "Tomato - Spider Mites (Two-Spotted Spider Mite)": "Apply neem oil.",
    "Tomato - Target Spot": "Use azoxystrobin fungicides.",
    "Tomato - Yellow Leaf Curl Virus": "Control whiteflies.",
    "Tomato - Mosaic Virus": "Remove infected plants.",
    "Tomato - Healthy": "No treatment required."
}

# ----------------- Weather API -----------------
@app.route("/check_weather", methods=["GET"])
def check_weather():
    location = request.args.get("location")

    if not location:
        return jsonify({"error": "Location is required"}), 400

    url = (
        f"http://api.openweathermap.org/data/2.5/weather"
        f"?q={location}&appid={WEATHER_API_KEY}&units=metric"
    )

    response = requests.get(url)
    return jsonify(response.json())

# ----------------- Irrigation Prediction -----------------

@app.route("/predict/irrigation", methods=["POST"])
def predict_irrigation():
    data = request.json

    soil_moisture = data["soil_moisture"]

    # ✅ RULE-BASED SAFETY CHECK
    if soil_moisture < 30:
        return jsonify({"prediction": 1})

    X = np.array([[
        data["temperature"],
        data["pressure"],
        data["altitude"],
        soil_moisture
    ]])

    X_scaled = scaler.transform(X)
    prediction = irrigation_model.predict(X_scaled)[0]

    return jsonify({"prediction": int(prediction)})


# ----------------- Plant Disease Prediction (UNCHANGED) -----------------
@app.route("/predict/plant", methods=["POST"])
def predict_plant_disease():
    try:
        if "image" in request.files:
            img = Image.open(request.files["image"]).convert("RGB")
        else:
            image_data = request.json["image"].split(",")[1]
            img = Image.open(io.BytesIO(base64.b64decode(image_data))).convert("RGB")

        img_array = preprocess_image(img)
        predictions = plant_model.predict(img_array)

        predicted_class_idx = int(np.argmax(predictions))
        confidence = float(np.max(predictions)) * 100
        predicted_class = class_names[predicted_class_idx]

        if confidence < 60:
            return jsonify({
                "error": "Uploaded image is not a plant leaf",
                "confidence": round(confidence, 2)
            })

        if "Healthy" in predicted_class:
            return jsonify({
                "healthy": "Plant is healthy",
                "confidence": round(confidence, 2)
            })

        return jsonify({
            "disease": predicted_class,
            "confidence": round(confidence, 2),
            "cause": causes.get(predicted_class),
            "symptoms": symptoms.get(predicted_class),
            "treatment": treatments.get(predicted_class)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ----------------- Run App -----------------
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
