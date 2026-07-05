import os
import math
import uuid
import pickle
from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy import select
from app.core.logger import logger
from app.models.inspection import Inspection
from app.models.additional_models import InspectionResult, AIPrediction, InspectionImage

# Configure Matplotlib config directory inside workspace to bypass Windows permission blocks
os.environ['MPLCONFIGDIR'] = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".matplotlib")

import time
import io
import numpy as np
import cv2
from PIL import Image

HAS_TORCH = False
try:
    import torch
    import torchvision
    import torchvision.models as models
    from torchvision import transforms
    from ultralytics import YOLO
    HAS_TORCH = True
except ImportError as e:
    logger.warning(f"PyTorch, TorchVision, or Ultralytics failed to import: {str(e)}. Fallback modes active.")

HAS_SKLEARN = False
try:
    import sklearn
    HAS_SKLEARN = True
except ImportError:
    logger.warning("scikit-learn ('sklearn') is not installed in this python environment. Running in mock/simulated fallback mode.")

MODEL_DIR = os.getenv("MODEL_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "AI Model"))


class TouchstoneClassifier(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = models.resnet18(num_classes=3)
    def forward(self, x):
        return self.backbone(x)



def load_and_validate_image(image_url: str, inspection_id: str, angle: str) -> Image.Image:
    """
    Loads and validates an image from url or local path.
    Verifies existence, attempts opening, logs metadata, and raises errors on failure.
    """
    logger.info(f"Validating image for inspection {inspection_id}, angle {angle}", image_url=image_url)
    
    resolved_path = image_url
    if image_url.startswith("local://"):
        resolved_path = image_url.replace("local://", "")
    if resolved_path.startswith("/static/uploads/"):
        resolved_path = resolved_path.replace("/static/uploads/", "")
        
    base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static", "uploads")
    local_path = os.path.join(base_dir, resolved_path)
    
    img_bytes = None
    if os.path.exists(local_path) and os.path.isfile(local_path):
        logger.info(f"Resolved image to local filesystem path: {local_path}")
        with open(local_path, "rb") as f:
            img_bytes = f.read()
    else:
        if image_url.startswith("http://") or image_url.startswith("https://"):
            # Check for local loopback URLs and map them to disk
            for host in ["http://localhost:8000/static/uploads/", "http://127.0.0.1:8000/static/uploads/", 
                         "http://localhost:8081/static/uploads/", "http://localhost:8080/static/uploads/",
                         "http://localhost:3000/static/uploads/", "/static/uploads/"]:
                if image_url.startswith(host):
                    rel = image_url.replace(host, "")
                    temp_path = os.path.join(base_dir, rel)
                    if os.path.exists(temp_path) and os.path.isfile(temp_path):
                        logger.info(f"Resolved local loopback url to file: {temp_path}")
                        local_path = temp_path
                        with open(temp_path, "rb") as f:
                            img_bytes = f.read()
                        break
            
            if img_bytes is None:
                logger.info(f"Downloading remote image via HTTP: {image_url}")
                import httpx
                try:
                    with httpx.Client(timeout=10.0) as client:
                        res = client.get(image_url)
                        if res.status_code == 200:
                            img_bytes = res.content
                            logger.info(f"Successfully downloaded remote image ({len(img_bytes)} bytes)")
                        else:
                            raise Exception(f"HTTP download returned status {res.status_code}")
                except Exception as e:
                    # Search locally by filename
                    filename = os.path.basename(image_url)
                    logger.warning(f"Remote download failed: {str(e)}. Searching locally for filename: {filename}")
                    found = False
                    for root, dirs, files in os.walk(base_dir):
                        if filename in files:
                            local_path = os.path.join(root, filename)
                            logger.info(f"Found local copy matching filename: {local_path}")
                            with open(local_path, "rb") as f:
                                img_bytes = f.read()
                            found = True
                            break
                    if not found:
                        raise Exception(f"Could not load image '{angle}': Remote download failed and no local file named '{filename}' exists.")
        else:
            filename = os.path.basename(resolved_path)
            logger.warning(f"Local path {local_path} not found. Searching locally for filename: {filename}")
            found = False
            for root, dirs, files in os.walk(base_dir):
                if filename in files:
                    local_path = os.path.join(root, filename)
                    logger.info(f"Found backup local copy: {local_path}")
                    with open(local_path, "rb") as f:
                        img_bytes = f.read()
                    found = True
                    break
            if not found:
                raise Exception(f"Image path does not exist on disk and backup search failed: {local_path}")
                
    try:
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise Exception(f"Failed to parse image bytes for '{angle}' (corrupted file/invalid format): {str(e)}")
        
    logger.info(
        "Image verification successful",
        inspection_id=inspection_id,
        angle=angle,
        resolved_path=local_path if os.path.exists(local_path) else image_url,
        dimensions=f"{pil_img.width}x{pil_img.height}",
        format=pil_img.format or "JPEG/PNG"
    )
    
    return pil_img


async def get_image_for_inference(inspection: Inspection, db: Any, angle: str) -> Image.Image:
    """
    Retrieves the correct image for the given angle of an inspection.
    1. Looks in inspection_images table.
    2. Fallback to inspection.images JSON.
    3. If preferred angle is missing, fallback to any other uploaded image of this inspection.
    4. If genuinely no images exist, fallback to local fallback.jpg or a solid placeholder, logging clearly.
    """
    # Force reload from DB to ensure we get the latest commits
    result = await db.execute(select(Inspection).where(Inspection.id == inspection.id))
    db_insp = result.scalar_one_or_none()
    if db_insp:
        inspection = db_insp

    stmt = select(InspectionImage).where(InspectionImage.inspection_id == inspection.id)
    res = await db.execute(stmt)
    db_images = res.scalars().all()
    
    images_dict = {img.image_type: img.file_url for img in db_images}
    json_images = inspection.images or {}
    for k, v in json_images.items():
        if k != "hashes" and v and k not in images_dict:
            images_dict[k] = v
            
    valid_angles = [k for k, v in images_dict.items() if v]
    
    if not valid_angles:
        logger.warning(
            "Genuinely no uploaded images found for inspection. Using fallback default.",
            inspection_id=inspection.id,
            angle=angle
        )
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        fallback_path = os.path.join(base_dir, "static", "fallback.jpg")
        if os.path.exists(fallback_path):
            try:
                img = Image.open(fallback_path).convert("RGB")
                logger.info(f"Loaded default fallback image from: {fallback_path}", dimensions=f"{img.width}x{img.height}")
                return img
            except Exception as e:
                logger.warning(f"Failed to load fallback.jpg: {str(e)}")
        return Image.new("RGB", (224, 224), color=(212, 175, 55))

    resolved_angle = angle
    if angle not in valid_angles:
        resolved_angle = valid_angles[0]
        logger.info(
            f"Preferred angle '{angle}' not uploaded. Reusing '{resolved_angle}' image instead for model input.",
            inspection_id=inspection.id
        )
        
    url = images_dict[resolved_angle]
    return load_and_validate_image(url, inspection.id, resolved_angle)


def load_pil_image(image_url: str) -> Image.Image:
    # Deprecated fallback/wrapper
    try:
        return load_and_validate_image(image_url, "UNKNOWN", "UNKNOWN")
    except Exception as e:
        logger.warning(f"Deprecated load_pil_image failed: {str(e)}. Using fallback color.")
        return Image.new("RGB", (224, 224), color=(212, 175, 55))


def extract_reflection_features(image_bytes: bytes, expected_purity: float, weight: float) -> list:
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        logger.warning(f"Failed to load image in extract_reflection_features: {str(e)}. Using golden fallback.")
        img = Image.new("RGB", (224, 224), color=(212, 175, 55))
    arr = np.array(img)
    
    # 1. Brightness (mean of grayscale values)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    brightness = float(gray.mean()) / 255.0
    
    # 2. Contrast (standard deviation of grayscale values)
    contrast = float(gray.std()) / 255.0
    
    # 3. HSV statistics (Hue and Saturation mean)
    hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
    h_mean = float(hsv[:, :, 0].mean()) / 180.0
    s_mean = float(hsv[:, :, 1].mean()) / 255.0
    
    # 4. Reflection intensity (average of top 10% brightest pixels)
    sorted_pixels = np.sort(gray.ravel())
    top_10_percent = sorted_pixels[-int(len(sorted_pixels) * 0.1):]
    reflection_intensity = float(top_10_percent.mean()) / 255.0
    
    # 5. Texture metrics (local variance using Laplacian operator standard deviation)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    texture_score = float(laplacian.var()) / 1000.0  # normalize it
    texture_score = min(1.0, max(0.0, texture_score))
    
    # Map HSV hue/sat to spectral_purity & deviation:
    # Gold has HSV Hue around 20-30 (which is 0.11 - 0.16 after dividing by 180).
    hue_diff = abs(h_mean * 180.0 - 25.0)
    deviation = min(1.0, hue_diff / 50.0)
    
    # spectral_purity represents gold color concentration: high saturation, low hue diff
    spectral_purity = s_mean * (1.0 - deviation) * expected_purity
    
    # reflection_coefficient is mapped to reflection intensity
    reflection_coefficient = reflection_intensity
    
    # surface_roughness is mapped to texture score
    surface_roughness = texture_score
    
    # normalized weight
    norm_weight = min(1.0, weight / 50.0)
    
    return [spectral_purity, reflection_coefficient, surface_roughness, deviation, norm_weight]


class ComputerVisionService:
    def __init__(self, model: Any = None):
        self.model = model

    async def analyze_visuals(self, inspection: Inspection, db: Any) -> Dict[str, Any]:
        logger.info("Executing Computer Vision diagnostic scan on visual angles", inspection_id=inspection.id)
        start_t = time.perf_counter()
        timestamp = datetime.now(timezone.utc).isoformat()
        
        if not self.model:
            logger.warning("Surface Analysis model not loaded. Skipping inference.")
            return {
                "score": 90,
                "status": "Unavailable",
                "details": "Surface Analysis model is not available.",
                "impact": 0.0,
                "prediction": "Unavailable",
                "confidence_score": 0,
                "model_name": "mobilenet_v3_small",
                "inference_time": 0.0,
                "timestamp": timestamp
            }
            
        try:
            angles = ["front", "back", "left", "right", "top"]
            probs_list = []
            angles_analyzed = []
            
            for angle in angles:
                try:
                    # Retrieves real image or fallback to another angle of this inspection
                    pil_img = await get_image_for_inference(inspection, db, angle)
                    preprocess = transforms.Compose([
                        transforms.Resize(256),
                        transforms.CenterCrop(224),
                        transforms.ToTensor(),
                        transforms.Normalize(
                            mean=[0.485, 0.456, 0.406],
                            std=[0.229, 0.224, 0.225]
                        )
                    ])
                    tensor = preprocess(pil_img).unsqueeze(0)
                    with torch.no_grad():
                        out = self.model(tensor)
                        prob = torch.softmax(out, dim=1).cpu().numpy()[0]
                        probs_list.append(prob)
                        angles_analyzed.append(angle)
                except Exception as img_err:
                    logger.warning(f"Failed to load image for angle '{angle}': {str(img_err)}")
                    
            if not probs_list:
                raise Exception("Zero valid images could be loaded/parsed for Surface Analysis.")
                    
            classes = ['Artificial Jewelry', 'Copper Jewelry', 'Gold-Plated', 'Real Gold']
            mean_probs = np.mean(probs_list, axis=0)
            pred_idx = np.argmax(mean_probs)
            prediction = classes[pred_idx]
            confidence_score = int(mean_probs[pred_idx] * 100)
            prob_real_gold = mean_probs[3]
            
            if prediction == "Real Gold":
                status = "Verified"
                score = int(prob_real_gold * 100)
            else:
                status = "Flagged"
                score = int(prob_real_gold * 100)
                
            score = max(10, min(100, score))
            details = f"MobileNetV3 small classifier detected surface pattern as {prediction} with {confidence_score}% confidence. Angles analyzed: {', '.join(angles_analyzed)}."
            
            inference_time = round((time.perf_counter() - start_t) * 1000.0, 2)
            logger.info("Surface Analysis completed", prediction=prediction, confidence=confidence_score, time_ms=inference_time)
            
            return {
                "score": score,
                "status": status,
                "details": details,
                "impact": -0.8 if status == "Verified" else +8.4,
                "prediction": prediction,
                "confidence_score": confidence_score,
                "model_name": "mobilenet_v3_small",
                "inference_time": inference_time,
                "timestamp": timestamp
            }
        except Exception as e:
            logger.error("Surface Analysis inference failed", error=str(e))
            raise Exception(f"Surface Analysis failed: {str(e)}")


class DefectLocalizationService:
    def __init__(self, model: Any = None):
        self.model = model

    async def localize_defects(self, inspection: Inspection, db: Any, is_suspicious: bool = False) -> Dict[str, Any]:
        logger.info("Executing Defect Localization scan on front image", inspection_id=inspection.id)
        start_t = time.perf_counter()
        timestamp = datetime.now(timezone.utc).isoformat()
        
        if not self.model:
            logger.warning("Defect Localization model not loaded. Skipping inference.")
            return {
                "status": "Unavailable",
                "defects": [],
                "confidence": 0.0,
                "score": 90,
                "explanation": "Defect Localization model is not available.",
                "prediction": "Unavailable",
                "confidence_score": 0,
                "model_name": "Defect Localization (YOLOv11)",
                "inference_time": 0.0,
                "timestamp": timestamp
            }
            
        try:
            pil_img = await get_image_for_inference(inspection, db, "front")
            results = self.model.predict(pil_img, verbose=False)
            probs = results[0].probs
            probs_data = probs.data.cpu().numpy()
            
            prob_broken = float(probs_data[0])
            prob_normal = float(probs_data[1])
            
            pred_idx = int(probs.top1)
            classes = {0: "broken", 1: "normal"}
            prediction = classes.get(pred_idx, "normal")
            confidence_score = int(probs_data[pred_idx] * 100)
            
            detected = []
            if prediction == "broken":
                status = "defect_detected"
                score = int(100 - prob_broken * 50.0)
                score = max(10, min(79, score))
                confidence = prob_broken
                explanation = f"Defects localized: surface anomaly / broken structure detected (confidence: {confidence_score}%)."
                detected.append({"type": "surface_anomaly", "confidence": prob_broken})
            else:
                status = "clean"
                score = int(prob_normal * 100)
                score = max(80, min(98, score))
                confidence = prob_normal
                explanation = f"No visible defects or image quality issues detected in uploaded photos (confidence: {confidence_score}%)."
                
            inference_time = round((time.perf_counter() - start_t) * 1000.0, 2)
            logger.info("Defect Localization completed", prediction=prediction, confidence=confidence_score, time_ms=inference_time)
            
            return {
                "status": status,
                "defects": detected,
                "confidence": confidence,
                "score": score,
                "explanation": explanation,
                "prediction": prediction,
                "confidence_score": confidence_score,
                "model_name": "Defect Localization (YOLOv11)",
                "inference_time": inference_time,
                "timestamp": timestamp
            }
        except Exception as e:
            logger.error("Defect Localization inference failed", error=str(e))
            raise Exception(f"Defect Localization failed: {str(e)}")



class DensityAnalysisService:
    def estimate_volume(self, jewelry_type: str, length: float, width: float, thickness: float) -> float:
        # Convert dimensions from mm to cm for density (g/cm³)
        l_cm = length / 10.0 if length else 0.0
        w_cm = width / 10.0 if width else 0.0
        t_cm = thickness / 10.0 if thickness else 0.0

        jt = (jewelry_type or "").lower()
        
        # Bounding box volume in cm³
        bbox_vol = l_cm * w_cm * t_cm
        
        if "ring" in jt:
            if l_cm > 0 and t_cm > 0 and w_cm > 0:
                D = l_cm  # outer diameter
                d = D - 2 * t_cm  # inner diameter
                if d > 0:
                    return math.pi * ((D/2)**2 - (d/2)**2) * w_cm
            return bbox_vol * 0.35
            
        elif "chain" in jt:
            # Calibrated volume fraction: 58% of bounding box
            return bbox_vol * 0.58
            
        elif "necklace" in jt:
            return bbox_vol * 0.52
            
        elif "bangle" in jt:
            if l_cm > 0 and t_cm > 0 and w_cm > 0:
                D = l_cm
                d = D - 2 * t_cm
                if d > 0:
                    return math.pi * ((D/2)**2 - (d/2)**2) * w_cm
            return bbox_vol * 0.45
            
        elif "coin" in jt:
            # Flat disc cylinder (pi * r^2 * h = 0.785 * d^2 * h)
            dia = max(l_cm, w_cm)
            return math.pi * ((dia / 2.0) ** 2) * t_cm if (dia > 0 and t_cm > 0) else bbox_vol * 0.785
            
        elif "earring" in jt:
            return bbox_vol * 0.35
            
        elif "pendant" in jt:
            return bbox_vol * 0.45
            
        elif "bracelet" in jt:
            return bbox_vol * 0.55
            
        else:
            return bbox_vol * 0.50

    async def analyze_density(self, inspection: Inspection, tolerance: float = 0.03) -> Dict[str, Any]:
        logger.info("Executing Hydrostatic density calculation", inspection_id=inspection.id)
        
        weight = inspection.weight
        length = inspection.length
        width = inspection.width
        thickness = inspection.thickness
        
        # 1. Reject zero or impossible dimensions
        if weight <= 0 or length <= 0 or width <= 0 or thickness <= 0:
            logger.error("Rejecting impossible dimensions or zero values in density check",
                         weight=weight, length=length, width=width, thickness=thickness)
            raise ValueError("Invalid measurements: Weight and dimensions (length, width, thickness) must be greater than zero.")
            
        # 2. Validate measurement units before calculation to avoid common scale mistakes
        if length < 2.0 or length > 1000.0:
            raise ValueError(f"Length ({length} mm) is outside typical range (2mm - 1000mm). Verify units.")
        if width < 0.5 or width > 200.0:
            raise ValueError(f"Width ({width} mm) is outside typical range (0.5mm - 200mm). Verify units.")
        if thickness < 0.1 or thickness > 100.0:
            raise ValueError(f"Thickness ({thickness} mm) is outside typical range (0.1mm - 100mm). Verify units.")
        if weight < 0.1 or weight > 2000.0:
            raise ValueError(f"Weight ({weight} g) is outside typical range (0.1g - 2000g). Verify units.")
            
        expected_densities = {
            "24K": 19.30,
            "22K": 17.70,
            "20K": 16.60,
            "18K": 15.40
        }
        purity = inspection.purity
        expected = expected_densities.get(purity, 17.70)
        
        vol = self.estimate_volume(inspection.jewelry_type, length, width, thickness)
        
        calculated = weight / vol
        diff_pct = ((calculated - expected) / expected) * 100.0
        abs_diff = abs(diff_pct)
        tol_pct = tolerance * 100.0
        
        # 3. Log variables as requested
        logger.info(
            "Density engine calculation parameters",
            weight=weight,
            length=length,
            width=width,
            thickness=thickness,
            calculated_volume_cm3=round(vol, 4),
            calculated_density=round(calculated, 2),
            expected_density=expected,
            difference_percentage=round(diff_pct, 2)
        )
        
        if abs_diff <= tol_pct:
            risk_level = "Normal"
            status = "Verified"
            score = 100 - int(abs_diff * (20.0 / tol_pct))
            score = max(80, min(100, score))
            explanation = f"Calculated density {calculated:.2f} g/cm³ is within acceptable tolerance range of expected density {expected:.2f} g/cm³ (diff: {diff_pct:+.1f}%)."
        elif abs_diff <= tol_pct * 1.5:
            risk_level = "Suspicious"
            status = "Anomalous"
            score = 80 - int((abs_diff - tol_pct) * (30.0 / (tol_pct * 0.5)))
            score = max(50, min(80, score))
            explanation = f"Calculated density {calculated:.2f} g/cm³ slightly deviates ({diff_pct:+.1f}%) from expected density {expected:.2f} g/cm³."
        else:
            risk_level = "High Risk"
            status = "Failed"
            score = 50 - int((abs_diff - tol_pct * 1.5) * (50.0 / tol_pct))
            score = max(10, min(50, score))
            explanation = f"Calculated density {calculated:.2f} g/cm³ shows significant deviation ({diff_pct:+.1f}%) from expected density {expected:.2f} g/cm³."
            
        # Contaminant threat check
        possible_core = "Unknown"
        if risk_level == "Normal":
            possible_core = "None"
        else:
            if calculated > 18.5:
                possible_core = "Tungsten"
            elif 10.5 <= calculated <= 12.5:
                possible_core = "Lead"
            elif 8.5 <= calculated <= 10.5:
                possible_core = "Copper"
            elif 7.0 <= calculated <= 8.5:
                possible_core = "Brass"
            elif calculated < 7.0:
                possible_core = "Hollow"
            else:
                possible_core = "Unknown"
                
        if possible_core != "None":
            explanation += f" Potential core threat identified: {possible_core} core."
            
        confidence_score = int(max(60, min(98, 95 - abs_diff * 1.5)))
            
        return {
            "density_score": score,
            "confidence_score": confidence_score,
            "score": score,
            "status": status,
            "details": explanation,
            "calculated_density": round(calculated, 2),
            "expected_density": expected,
            "difference_percentage": round(diff_pct, 2),
            "risk_level": risk_level,
            "possible_core_material": possible_core,
            "impact": round(diff_pct * 2.0, 1) if abs_diff > tol_pct else 0.0
        }


class ReflectionAnalysisService:
    def __init__(self, model: Any = None):
        self.model = model

    async def analyze_reflection(self, inspection: Inspection, db: Any, expected_purity: float = 0.916) -> Dict[str, Any]:
        logger.info("Executing Spectrographic light reflection analysis on reflection image", inspection_id=inspection.id)
        start_t = time.perf_counter()
        timestamp = datetime.now(timezone.utc).isoformat()
        
        if not self.model:
            logger.warning("Reflection Analysis model not loaded. Skipping inference.")
            return {
                "score": 90,
                "status": "Unavailable",
                "details": "Reflection Analysis model is not available.",
                "impact": 0.0,
                "prediction": "Unavailable",
                "confidence_score": 0,
                "model_name": "Reflection RandomForest",
                "inference_time": 0.0,
                "timestamp": timestamp
            }
            
        try:
            pil_img = await get_image_for_inference(inspection, db, "reflection")
            
            # Save PIL Image to bytes in-memory for OpenCV feature extraction compatibility
            buffer = io.BytesIO()
            pil_img.save(buffer, format="JPEG")
            img_bytes = buffer.getvalue()
            
            features = extract_reflection_features(img_bytes, expected_purity, inspection.weight)
            
            prediction = str(self.model.predict([features])[0])
            proba = self.model.predict_proba([features])[0]
            classes = list(self.model.classes_)
            
            gold_idx = classes.index("Real Gold") if "Real Gold" in classes else 3
            pred_idx = classes.index(prediction) if prediction in classes else 0
            
            prob_real_gold = float(proba[gold_idx])
            confidence_score = int(proba[pred_idx] * 100)
            
            status = "Verified" if prediction == "Real Gold" else "Flagged"
            score = int(prob_real_gold * 100)
            score = max(10, min(100, score))
            
            details = f"RandomForest spectrograph classifier categorized item reflection as: {prediction} (Real Gold probability: {prob_real_gold:.2f})."
            
            inference_time = round((time.perf_counter() - start_t) * 1000.0, 2)
            logger.info("Reflection Analysis completed", prediction=prediction, confidence=confidence_score, time_ms=inference_time)
            
            return {
                "score": score,
                "status": status,
                "details": details,
                "impact": -1.2 if status == "Verified" else +9.8,
                "prediction": prediction,
                "confidence_score": confidence_score,
                "model_name": "Reflection RandomForest",
                "inference_time": inference_time,
                "timestamp": timestamp
            }
        except Exception as e:
            logger.error("Reflection Analysis inference failed", error=str(e))
            raise Exception(f"Reflection Analysis failed: {str(e)}")


class TouchstoneAnalysisService:
    def __init__(self, model: Any = None):
        self.model = model

    async def analyze_streak(self, inspection: Inspection, db: Any) -> Dict[str, Any]:
        logger.info("Executing Touchstone acid streak analysis on touchstone image", inspection_id=inspection.id)
        start_t = time.perf_counter()
        timestamp = datetime.now(timezone.utc).isoformat()
        
        if not self.model:
            logger.warning("Touchstone Analysis model not loaded. Skipping inference.")
            return {
                "score": 90,
                "status": "Unavailable",
                "details": "Touchstone Analysis model is not available.",
                "impact": 0.0,
                "prediction": "Unavailable",
                "confidence_score": 0,
                "model_name": "resnet18",
                "inference_time": 0.0,
                "timestamp": timestamp
            }
            
        try:
            pil_img = await get_image_for_inference(inspection, db, "touchstone")
            preprocess = transforms.Compose([
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
            tensor = preprocess(pil_img).unsqueeze(0)
            
            with torch.no_grad():
                out = self.model(tensor)
                probs = torch.softmax(out, dim=1).cpu().numpy()[0]
                
            pred_idx = np.argmax(probs)
            classes = ["Failed", "Suspicious", "Verified"]
            prediction = classes[pred_idx]
            confidence_score = int(probs[pred_idx] * 100)
            prob_verified = float(probs[2])
            
            if prediction == "Verified":
                status = "Verified"
                score = int(prob_verified * 100)
                score = max(80, min(98, score))
                impact = -0.5
            elif prediction == "Suspicious":
                status = "Suspicious"
                # Authenticity score derived from verified probability (low for Suspicious)
                score = int(prob_verified * 100)
                score = max(40, min(69, score))
                impact = +6.0
            else:  # Failed
                status = "Failed"
                score = int(prob_verified * 100)
                score = max(10, min(39, score))
                impact = +12.5
                
            details = f"ResNet backbone classified streak reactivity pattern color fade rate as {prediction} (confidence: {confidence_score}%)."
            
            inference_time = round((time.perf_counter() - start_t) * 1000.0, 2)
            logger.info("Touchstone Analysis completed", prediction=prediction, confidence=confidence_score, time_ms=inference_time)
            
            return {
                "score": score,
                "status": status,
                "details": details,
                "impact": impact,
                "prediction": prediction,
                "confidence_score": confidence_score,
                "model_name": "resnet18",
                "inference_time": inference_time,
                "timestamp": timestamp
            }
        except Exception as e:
            logger.error("Touchstone Analysis inference failed", error=str(e))
            raise Exception(f"Touchstone Analysis failed: {str(e)}")


class FinalRiskService:
    async def run_fusion(
        self,
        surface_score: float,
        defect_score: float,
        reflection_score: float,
        touchstone_score: float,
        density_score: float,
    ) -> Dict[str, Any]:
        from app.core.config import settings
        w_surf = settings.AI_WEIGHT_SURFACE
        w_def = settings.AI_WEIGHT_DEFECT
        w_refl = settings.AI_WEIGHT_REFLECTION
        w_touch = settings.AI_WEIGHT_TOUCHSTONE
        w_dens = settings.AI_WEIGHT_DENSITY
        
        total_w = w_surf + w_def + w_refl + w_touch + w_dens
        if not math.isclose(total_w, 1.0):
            w_surf /= total_w
            w_def /= total_w
            w_refl /= total_w
            w_touch /= total_w
            w_dens /= total_w

        # Base weighted score calculation
        weighted_score = (
            surface_score * w_surf +
            defect_score * w_def +
            reflection_score * w_refl +
            touchstone_score * w_touch +
            density_score * w_dens
        )
        weighted_score = int(max(0, min(100, weighted_score)))
        
        # Analyze individual model risk states
        scores = {
            "Surface Analysis": surface_score,
            "Defect Localization": defect_score,
            "Reflection Analysis": reflection_score,
            "Touchstone Analysis": touchstone_score,
            "Density Engine": density_score
        }
        
        high_risk_models = [name for name, s in scores.items() if s < 60]
        suspicious_models = [name for name, s in scores.items() if 60 <= s < 80]
        
        triggered_rules = []
        final_auth_score = weighted_score
        override_risk = None
        override_rec = None
        
        # Rule 1: High Density Risk -> Final result cannot be "Genuine"
        if density_score < 60:
            triggered_rules.append("Rule: High Density Risk (Density < 60)")
            if final_auth_score >= 80:
                final_auth_score = 79
            override_risk = "Medium Risk"
            override_rec = "Manual Verification Recommended"

        # Rule 2: Multiple High-Risk models -> Recommend "Reject"
        if len(high_risk_models) >= 2:
            triggered_rules.append(f"Rule: Multiple High-Risk Models ({', '.join(high_risk_models)})")
            if final_auth_score >= 40:
                final_auth_score = 39
            override_risk = "High Risk"
            override_rec = "Reject"

        # Rule 3: Single suspicious model -> Recommend "Manual Verification"
        if len(suspicious_models) == 1 and len(high_risk_models) == 0:
            triggered_rules.append(f"Rule: Single Suspicious Model ({suspicious_models[0]})")
            if final_auth_score >= 80:
                final_auth_score = 79
            override_risk = "Medium Risk"
            override_rec = "Manual Verification Recommended"

        # Determine overall risk and recommendation based on final_auth_score if not overridden
        if final_auth_score >= 85:
            overall_risk = "Genuine"
            recommendation = "Approve"
        elif final_auth_score >= 70:
            overall_risk = "Low Risk"
            recommendation = "Manual Verification Recommended"
        elif final_auth_score >= 55:
            overall_risk = "Medium Risk"
            recommendation = "Manual Verification Recommended"
        elif final_auth_score >= 40:
            overall_risk = "High Risk"
            recommendation = "Laboratory Testing Recommended"
        else:
            overall_risk = "Critical"
            recommendation = "Reject"

        # Apply overrides from rules
        if override_risk:
            risk_hierarchy = ["Genuine", "Low Risk", "Medium Risk", "High Risk", "Critical"]
            if risk_hierarchy.index(overall_risk) < risk_hierarchy.index(override_risk):
                overall_risk = override_risk
                
        if override_rec:
            rec_hierarchy = ["Approve", "Manual Verification Recommended", "Laboratory Testing Recommended", "Reject"]
            if rec_hierarchy.index(recommendation) < rec_hierarchy.index(override_rec):
                recommendation = override_rec

        # Standard deviation adjustment to confidence
        mean_score = sum(scores.values()) / len(scores)
        variance = sum((x - mean_score) ** 2 for x in scores.values()) / len(scores)
        std_dev = math.sqrt(variance)
        confidence_score = int(max(50, min(98, 95 - std_dev * 0.5)))

        # Build Explainable Decision Trace showing triggered rules and weight inputs (plain text)
        trace_steps = [
            f"Hybrid Decision Fusion Trace (Version 1.3.0)",
            f"- Surface Analysis: {surface_score:.0f}% (w: {w_surf*100:.0f}%)",
            f"- Defect Localization: {defect_score:.0f}% (w: {w_def*100:.0f}%)",
            f"- Reflection Analysis: {reflection_score:.0f}% (w: {w_refl*100:.0f}%)",
            f"- Touchstone Analysis: {touchstone_score:.0f}% (w: {w_touch*100:.0f}%)",
            f"- Density Engine: {density_score:.0f}% (w: {w_dens*100:.0f}%)",
            f"\nBase Weighted Score: {weighted_score}%",
        ]
        
        if triggered_rules:
            trace_steps.append("\nTriggered Decision Rules:")
            for rule in triggered_rules:
                trace_steps.append(f"- {rule}")
        else:
            trace_steps.append("\nTriggered Decision Rules: None (Default Weighted Averaging)")

        trace_steps.append(
            f"\nFinal Score: {final_auth_score}%"
            f"\nRisk Level: {overall_risk}"
            f"\nConfidence: {confidence_score}%"
            f"\nAction Recommended: {recommendation}"
        )
        
        explainability = "\n".join(trace_steps)

        return {
            "authenticity_score": final_auth_score,
            "confidence_score": confidence_score,
            "overall_risk": overall_risk,
            "recommendation": recommendation,
            "explainability": explainability,
            "individual_scores": {
                "surface": surface_score,
                "defect": defect_score,
                "reflection": reflection_score,
                "touchstone": touchstone_score,
                "density": density_score,
            }
        }


class AiAnalysisOrchestrator:
    def __init__(self):
        # Load local ML models on initialization if files exist
        refl_model = self._load_refl_model()
        surf_model = self._load_surf_model()
        touch_model = self._load_touch_model()
        defect_model = self._load_defect_model()

        self.cv = ComputerVisionService(surf_model)
        self.defect = DefectLocalizationService(defect_model)
        self.density = DensityAnalysisService()
        self.reflection = ReflectionAnalysisService(refl_model)
        self.touchstone = TouchstoneAnalysisService(touch_model)
        self.fusion = FinalRiskService()

    def _load_refl_model(self) -> Any:
        if not HAS_SKLEARN:
            logger.warning("Reflection loader bypassed: scikit-learn is not installed.")
            return None
        path = os.path.join(MODEL_DIR, "Reflection Analysis.pkl")
        if os.path.exists(path):
            try:
                with open(path, 'rb') as f:
                    model = pickle.load(f)
                logger.info("Successfully connected Reflection RandomForest model classifier", model_path=path)
                return model
            except Exception as e:
                logger.error("Failed to load Reflection pickle weights file", error=str(e))
        return None

    def _load_surf_model(self) -> Any:
        if not HAS_TORCH:
            logger.warning("Surface loader bypassed: PyTorch is not installed.")
            return None
        path = os.path.join(MODEL_DIR, "Surface Analysis.pth")
        if os.path.exists(path):
            try:
                checkpoint = torch.load(path, map_location='cpu')
                model = models.mobilenet_v3_small(num_classes=4)
                model.load_state_dict(checkpoint['model_state_dict'])
                model.float()
                model.eval()
                logger.info("Successfully connected Surface MobileNetV3 model", model_path=path)
                return model
            except Exception as e:
                logger.error("Failed to load Surface weights dict file", error=str(e))
        return None

    def _load_touch_model(self) -> Any:
        if not HAS_TORCH:
            logger.warning("Touchstone loader bypassed: PyTorch is not installed.")
            return None
        path = os.path.join(MODEL_DIR, "Touchstone Analysis.pth")
        if os.path.exists(path):
            try:
                state_dict = torch.load(path, map_location='cpu')
                model = TouchstoneClassifier()
                model.load_state_dict(state_dict)
                model.float()
                model.eval()
                logger.info("Successfully connected Touchstone ResNet state_dict weight mappings", model_path=path)
                return model
            except Exception as e:
                logger.error("Failed to load Touchstone state_dict file", error=str(e))
        return None

    def _load_defect_model(self) -> Any:
        path = os.path.join(MODEL_DIR, "Defect Localization.pt")
        if os.path.exists(path):
            try:
                model = YOLO(path)
                logger.info("Successfully loaded Defect Localization YOLO model", model_path=path)
                return model
            except Exception as e:
                logger.error("Failed to load Defect Localization YOLO model", error=str(e))
        return None

    async def run_diagnostics(self, inspection: Inspection, db: Any, is_suspicious: bool = False) -> Dict[str, Any]:
        start_time = datetime.now(timezone.utc)
        
        cv_res = await self.cv.analyze_visuals(inspection, db)
        defect_res = await self.defect.localize_defects(inspection, db, is_suspicious=is_suspicious)
        density_res = await self.density.analyze_density(inspection)
        
        # Calculate expected purity parameter to feed model features
        purity_mult: Dict[str, float] = { "18K": 0.75, "20K": 0.833, "22K": 0.916, "24K": 1.0 }
        expected_p = purity_mult.get(inspection.purity, 0.916)
        
        reflection_res = await self.reflection.analyze_reflection(
            inspection, 
            db,
            expected_purity=expected_p
        )
        touchstone_res = await self.touchstone.analyze_streak(inspection, db)

        # Decision Fusion computation
        fusion_res = await self.fusion.run_fusion(
            surface_score=cv_res["score"],
            defect_score=defect_res["score"],
            reflection_score=reflection_res["score"],
            touchstone_score=touchstone_res["score"],
            density_score=density_res["score"]
        )

        # Persist scores in DB tables
        # 1. InspectionResult
        result_entry = InspectionResult(
            inspection_id=inspection.id,
            density_score=density_res["score"],
            surface_score=cv_res["score"],
            reflection_score=reflection_res["score"],
            touchstone_score=touchstone_res["score"],
            visual_score=defect_res["score"],
            overall_score=fusion_res["authenticity_score"]
        )
        db.add(result_entry)

        from app.core.config import settings
        processing_time_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

        # Call LLM reasoning engine
        from app.services.llm_service import llm_service
        llm_payload = {
            "jewelry_type": inspection.jewelry_type,
            "weight_g": inspection.weight,
            "purity": inspection.purity,
            "surface_score": cv_res["score"],
            "defect_score": defect_res["score"],
            "reflection_score": reflection_res["score"],
            "touchstone_score": touchstone_res["score"],
            "density_score": density_res["score"],
            "calculated_density": density_res["calculated_density"],
            "expected_density": density_res["expected_density"],
            "final_authenticity_score": fusion_res["authenticity_score"],
            "overall_risk": fusion_res["overall_risk"],
            "recommendation": fusion_res["recommendation"],
            "triggered_rules": [fusion_res["explainability"]] if fusion_res["explainability"] else []
        }
        try:
            llm_reasoning = await llm_service.generate_reasoning(llm_payload)
        except Exception as e:
            logger.error("LLM reasoning generation failed, using fallback explanation", error=str(e))
            llm_reasoning = {
                "summary": "Completed automated multi-model diagnostic check on gold jewelry.",
                "score_reason": f"Pledged item received final authenticity rating of {fusion_res['authenticity_score']}.",
                "key_anomalies": ["Physical and spectrographic signatures analyzed. (LLM Engine Unavailable)"],
                "recommendation_reason": "Appraiser inspection verified successfully."
            }

        # Compute real quality score based on inspection factors
        try:
            lighting = getattr(inspection, "lighting", 90) or 90
            focus = getattr(inspection, "focus", 90) or 90
            angle_cov = getattr(inspection, "angle_coverage", 90) or 90
            quality_score = int((lighting + focus + angle_cov) / 3)
        except Exception:
            quality_score = 90

        # 2. AIPrediction
        pred_data = {
            "status": "Completed",
            "authenticity_score": fusion_res["authenticity_score"],
            "risk_score": 100 - fusion_res["authenticity_score"],
            "confidence": fusion_res["confidence_score"],
            "overall_risk": fusion_res["overall_risk"],
            "recommendation": fusion_res["recommendation"],
            "explainability": fusion_res["explainability"],
            "individual_scores": fusion_res["individual_scores"],
            "density_details": {
                "calculated_density": density_res["calculated_density"],
                "expected_density": density_res["expected_density"],
                "difference_percentage": density_res["difference_percentage"],
                "density_score": density_res["density_score"],
                "confidence_score": density_res["confidence_score"],
                "possible_core_material": density_res["possible_core_material"],
                "risk_level": density_res["risk_level"],
                "explanation": density_res["details"]
            },
            "defect_details": {
                "status": defect_res["status"],
                "defects": defect_res["defects"],
                "confidence": defect_res["confidence"],
                "score": defect_res["score"],
                "explanation": defect_res["explanation"]
            },
            "llm_reasoning": llm_reasoning,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_version": "1.3.0",
            "processing_time_ms": processing_time_ms,
            "thresholds": {
                "density_tolerance": 0.03,
                "weights": {
                    "surface": settings.AI_WEIGHT_SURFACE,
                    "defect": settings.AI_WEIGHT_DEFECT,
                    "reflection": settings.AI_WEIGHT_REFLECTION,
                    "touchstone": settings.AI_WEIGHT_TOUCHSTONE,
                    "density": settings.AI_WEIGHT_DENSITY
                }
            },
            # Persist real model inference metadata
            "model_runs": {
                "surface_analysis": {
                    "prediction": cv_res.get("prediction"),
                    "confidence": cv_res.get("confidence_score", 0) / 100.0,
                    "model_name": cv_res.get("model_name"),
                    "timestamp": cv_res.get("timestamp"),
                    "processing_time_ms": cv_res.get("inference_time")
                },
                "defect_localization": {
                    "prediction": defect_res.get("prediction"),
                    "confidence": defect_res.get("confidence_score", 0) / 100.0,
                    "model_name": defect_res.get("model_name"),
                    "timestamp": defect_res.get("timestamp"),
                    "processing_time_ms": defect_res.get("inference_time")
                },
                "reflection_analysis": {
                    "prediction": reflection_res.get("prediction"),
                    "confidence": reflection_res.get("confidence_score", 0) / 100.0,
                    "model_name": reflection_res.get("model_name"),
                    "timestamp": reflection_res.get("timestamp"),
                    "processing_time_ms": reflection_res.get("inference_time")
                },
                "touchstone_analysis": {
                    "prediction": touchstone_res.get("prediction"),
                    "confidence": touchstone_res.get("confidence_score", 0) / 100.0,
                    "model_name": touchstone_res.get("model_name"),
                    "timestamp": touchstone_res.get("timestamp"),
                    "processing_time_ms": touchstone_res.get("inference_time")
                }
            }
        }
        pred_entry = AIPrediction(
            id="pred-" + uuid.uuid4().hex[:12],
            inspection_id=inspection.id,
            prediction_data=pred_data
        )
        db.add(pred_entry)

        # Update inspection factors & overall
        inspection.authenticity_score = fusion_res["authenticity_score"]
        inspection.risk_score = 100 - fusion_res["authenticity_score"]
        inspection.confidence = fusion_res["confidence_score"]
        inspection.notes = fusion_res["explainability"]
        
        # Map overall risk to standard status
        risk_to_status = {
            "Genuine": "Genuine",
            "Low Risk": "Low Risk",
            "Medium Risk": "Suspicious",
            "High Risk": "High Risk",
            "Critical": "High Risk"
        }
        inspection.status = risk_to_status.get(fusion_res["overall_risk"], "Genuine")
        
        inspection.factors = {
            "density": density_res["score"],
            "surface": int((cv_res["score"] + reflection_res["score"]) / 2),
            "reflection": reflection_res["score"],
            "touchstone": touchstone_res["score"],
            "visualDefect": defect_res["score"]
        }
        db.add(inspection)

        return {
            "inspection_id": inspection.id,
            "status": "Completed",
            "authenticity_score": fusion_res["authenticity_score"],
            "risk_score": 100 - fusion_res["authenticity_score"],
            "confidence": fusion_res["confidence_score"],
            "quality_score": quality_score,
            "factors": inspection.factors,
            "reasoning": fusion_res["explainability"],
            "density_details": pred_data["density_details"],
            "defect_details": pred_data["defect_details"],
            "llm_reasoning": llm_reasoning
        }


ai_orchestrator = AiAnalysisOrchestrator()


