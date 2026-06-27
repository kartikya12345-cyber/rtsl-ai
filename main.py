import os
import asyncio
import cv2
import numpy as np
import datetime
import jwt

from collections import deque
from passlib.context import CryptContext
import tensorflow as tf
from tensorflow import keras
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from database import conn, cursor

from fastapi import (
    FastAPI,
    File,
    Form,
    UploadFile,
    HTTPException
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

class NoCacheHTMLMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.endswith(".html") or request.url.path in ("/", ""):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        return response

from ultralytics import YOLO

app = FastAPI(
    title="RTSL Real-Time Detection API"
)

# ---------------------------------
# CORS
# ---------------------------------
app.add_middleware(NoCacheHTMLMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------
# Firebase Auth config
# ---------------------------------
FIREBASE_PROJECT_ID = "rtsld-6f66e"
FIREBASE_ISS = f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}"

import requests as _requests
from cryptography import x509 as _x509
from cryptography.hazmat.primitives import serialization as _serialization
from cryptography.hazmat.backends import default_backend as _default_backend

_FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_certs_cache = None
_certs_cache_time = 0

def _get_certs():
    global _certs_cache, _certs_cache_time
    import time
    now = time.time()
    if _certs_cache and now - _certs_cache_time < 3600:
        return _certs_cache
    resp = _requests.get(_FIREBASE_CERTS_URL, timeout=10)
    resp.raise_for_status()
    _certs_cache = resp.json()
    _certs_cache_time = now
    return _certs_cache

def verify_firebase_token(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        print(f"Token header: {header}")
    except Exception as e:
        print(f"Failed to parse token header: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token format: {e}")

    kid = header.get("kid")
    if not kid:
        print("No kid in token header")
        raise HTTPException(status_code=401, detail="Token missing key ID")

    try:
        certs = _get_certs()
    except Exception as e:
        print(f"Failed to fetch certs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch verification keys")

    pem_cert = certs.get(kid)
    if not pem_cert:
        print(f"kid {kid} not found in certs (keys: {list(certs.keys())})")
        raise HTTPException(status_code=401, detail=f"Key ID {kid} not found")

    try:
        cert = _x509.load_pem_x509_certificate(pem_cert.encode(), _default_backend())
        pub_key = cert.public_key()
        pub_key_pem = pub_key.public_bytes(
            _serialization.Encoding.PEM,
            _serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()
    except Exception as e:
        print(f"Failed to parse certificate: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse verification key")

    try:
        decoded = jwt.decode(
            token,
            pub_key_pem,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=FIREBASE_ISS,
            options={"verify_exp": True}
        )
        print(f"Token verified, uid: {decoded.get('sub')}")
        return decoded
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid token audience")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    except Exception as e:
        import traceback
        print(f"JWT decode error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")

# ---------------------------------
# Load Default Model
# ---------------------------------
loaded_models = {}
current_model_name = None
current_model_type = None
_mediapipe_model_path = None
models_ready = False

sequence_buffer = deque(maxlen=45)

KERAS_CLASSES = [
    "0","1","2","3","4","5","6","7","8","9","10",
    "monday","tuesday","wednesday","thursday","friday","saturday","sunday",
    "hello","thanks","yes","no","please","sorry","help","good","bad","stop",
    "eat","drink","read","write","play"
]

def load_yolo_model(path):
    model = YOLO(path)
    print(f"YOLO model loaded: task={model.task}")
    return model

def load_keras_model(path):
    return keras.models.load_model(path)

def load_mediapipe_hand_landmarker(path):
    base_options = python.BaseOptions(model_asset_path=path)
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        num_hands=2,
        min_hand_detection_confidence=0.3
    )
    return vision.HandLandmarker.create_from_options(options)

async def discover_models():
    models_found = []
    if not os.path.exists("models"):
        os.makedirs("models")
    for root, _, files in os.walk("models"):
        for file in files:
            model_path = os.path.normpath(os.path.join(root, file))
            if file.endswith(".pt"):
                models_found.append({"name": file, "path": model_path, "type": "yolo"})
            elif file.endswith(".keras"):
                models_found.append({"name": file, "path": model_path, "type": "keras"})
            elif file.endswith(".task") and "hand_landmarker" in file:
                models_found.append({"name": file, "path": model_path, "type": "mediapipe_hand_landmarker"})
    return models_found

async def load_initial_models():
    global loaded_models, current_model_name, current_model_type, _mediapipe_model_path, models_ready
    discovered = await discover_models()
    for model_info in discovered:
        try:
            if model_info["type"] == "yolo":
                loaded_models[model_info["path"]] = load_yolo_model(model_info["path"])
            elif model_info["type"] == "keras":
                loaded_models[model_info["path"]] = load_keras_model(model_info["path"])
            elif model_info["type"] == "mediapipe_hand_landmarker":
                loaded_models[model_info["path"]] = load_mediapipe_hand_landmarker(model_info["path"])
                _mediapipe_model_path = model_info["path"]
            print(f"Loaded model: {model_info['name']} ({model_info['type']})")
        except Exception as e:
            print(f"Error loading model {model_info['name']}: {e}")
    
    if loaded_models:
        default_yolo_model = next((m for m in discovered if m["type"] == "yolo" and "best.pt" in m["name"]), None)
        if default_yolo_model:
            current_model_name = default_yolo_model["path"]
            current_model_type = "yolo"
        else:
            first_model_path = list(loaded_models.keys())[0]
            current_model_name = first_model_path
            current_model_type = next((m["type"] for m in discovered if m["path"] == first_model_path), None)
        print(f"Default model set to: {current_model_name} ({current_model_type})")
    else:
        print("No models found or loaded.")
    models_ready = True

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(load_initial_models())

# ---------------------------------
# Models
# ---------------------------------
class PredictionResponse(BaseModel):
    prediction: str
    alphabet: str
    confidence: float
    model_name: str
    model_type: str
    timestamp: str
    hand_count: int = 0
    hands: list = []
    buffer_progress: int = 0
    buffer_total: int = 45

class User(BaseModel):
    username: str = ""
    password: str = ""
    email: str | None = None
    profile_photo: str | None = None
    id_token: str = ""
    firebase_uid: str = ""

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# ---------------------------------
# API Endpoints
# ---------------------------------
@app.get("/")
async def home():
    return FileResponse("static/landing.html")

@app.get("/available_models")
async def available_models():
    return await discover_models()

@app.post("/auth/firebase-login")
async def firebase_login(user: User):
    decoded = verify_firebase_token(user.id_token)
    firebase_uid = decoded["sub"]
    email = decoded.get("email", "")

    cursor.execute("SELECT id, firebase_uid, username, email, profile_photo FROM users WHERE firebase_uid=?", (firebase_uid,))
    db_user = cursor.fetchone()

    if db_user:
        return {
            "user_id": db_user[0],
            "firebase_uid": db_user[1],
            "username": db_user[2],
            "email": db_user[3] or email,
            "profile_photo": db_user[4] or ""
        }

    cursor.execute("SELECT id, firebase_uid, username, email, profile_photo FROM users WHERE email=?", (email,))
    existing = cursor.fetchone()
    if existing:
        cursor.execute("UPDATE users SET firebase_uid=? WHERE id=?", (firebase_uid, existing[0]))
        conn.commit()
        return {
            "user_id": existing[0],
            "firebase_uid": firebase_uid,
            "username": existing[2],
            "email": existing[3] or email,
            "profile_photo": existing[4] or ""
        }

    raise HTTPException(status_code=404, detail="User not found. Please sign up first.")

@app.post("/auth/firebase-signup")
async def firebase_signup(user: User):
    if not user.username or len(user.username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")

    decoded = verify_firebase_token(user.id_token)
    firebase_uid = decoded["sub"]
    email = decoded.get("email", user.email or "")

    cursor.execute("SELECT id FROM users WHERE username=?", (user.username,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Username already taken")

    try:
        cursor.execute(
            "INSERT INTO users (firebase_uid, username, email, profile_photo) VALUES (?, ?, ?, ?)",
            (firebase_uid, user.username, email, user.profile_photo or "")
        )
        conn.commit()
        new_id = cursor.lastrowid
        return {
            "user_id": new_id,
            "firebase_uid": firebase_uid,
            "username": user.username,
            "email": email,
            "profile_photo": user.profile_photo or ""
        }
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(status_code=400, detail="Username already exists or database error")

@app.post("/signup")
async def signup(user: User):
    pw = user.password
    if len(pw) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not any(c.isupper() for c in pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not any(c.islower() for c in pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one digit")
    hashed_password = get_password_hash(user.password)
    try:
        cursor.execute(
            "INSERT INTO users (username, email, password, profile_photo) VALUES (?, ?, ?, ?)",
            (user.username, user.email, hashed_password, user.profile_photo)
        )
        conn.commit()
        new_id = cursor.lastrowid
        return {"user_id": new_id, "username": user.username, "email": user.email or "", "profile_photo": user.profile_photo or ""}
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(status_code=400, detail="Username already exists or database error")

@app.post("/login")
async def login(user: User):
    cursor.execute("SELECT id, username, email, profile_photo, password FROM users WHERE username=? OR email=?", (user.username, user.username))
    db_user = cursor.fetchone()
    if not db_user or not verify_password(user.password, db_user[4]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"user_id": db_user[0], "username": db_user[1], "email": db_user[2] or "", "profile_photo": db_user[3] or ""}

@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...), user_id: int = Form(0)):
    try:
        if not models_ready or current_model_type is None:
            return {
                "prediction": "None", "alphabet": "None", "confidence": 0.0,
                "model_name": "Loading...", "model_type": "loading",
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "hand_count": 0, "hands": [], "buffer_progress": 0, "buffer_total": 45
            }

        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return {
                "prediction": "None", "alphabet": "None", "confidence": 0.0,
                "model_name": "N/A", "model_type": "N/A",
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "hand_count": 0, "hands": [], "buffer_progress": 0, "buffer_total": 45
            }

        alphabet = "None"
        confidence = 0.0
        model_used_name = current_model_name
        model_used_type = current_model_type
        hand_count = 0
        hands_data = []

        if current_model_type == "yolo":
            model_instance = loaded_models.get(current_model_name)
            if model_instance:
                try:
                    results = model_instance.predict(image, verbose=False)
                    if results and len(results) > 0:
                        r = results[0]
                        if r.probs is not None:
                            probs = r.probs
                            class_id = int(probs.top1)
                            confidence = float(probs.top1conf)
                            alphabet = str(r.names[class_id])
                        elif r.boxes is not None and len(r.boxes) > 0:
                            boxes = r.boxes
                            top_idx = int(boxes.cls[0].item())
                            confidence = float(boxes.conf[0].item())
                            alphabet = str(r.names[top_idx])
                except Exception as e:
                    print(f"YOLO predict error (will retry via file): {e}")
                    import tempfile
                    try:
                        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
                        cv2.imwrite(tmp.name, image)
                        tmp.close()
                        results = model_instance(tmp.name, verbose=False)
                        os.unlink(tmp.name)
                        if results and len(results) > 0:
                            r = results[0]
                            if r.probs is not None:
                                class_id = int(r.probs.top1)
                                confidence = float(r.probs.top1conf)
                                alphabet = str(r.names[class_id])
                            elif r.boxes is not None and len(r.boxes) > 0:
                                top_idx = int(r.boxes.cls[0].item())
                                confidence = float(r.boxes.conf[0].item())
                                alphabet = str(r.names[top_idx])
                    except Exception as e2:
                        print(f"YOLO fallback predict also failed: {e2}")

        elif current_model_type == "keras":
            keras_model_instance = loaded_models.get(current_model_name)
            mediapipe_model_instance = loaded_models.get(_mediapipe_model_path)

            hand_count = 0
            hands_data = []

            if keras_model_instance is not None and mediapipe_model_instance is not None:
                try:
                    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
                    detection_result = mediapipe_model_instance.detect(mp_image)
                    hands_detected = len(detection_result.hand_landmarks) if detection_result.hand_landmarks else 0
                    print(f"[KERAS DEBUG] MediaPipe hands detected: {hands_detected}")
                except Exception as e:
                    import traceback
                    print(f"[KERAS DEBUG] MediaPipe detect error: {e}")
                    traceback.print_exc()
                    detection_result = type('obj', (object,), {'hand_landmarks': [], 'handedness': []})()

                left_hand = np.zeros(63, dtype=np.float32)
                right_hand = np.zeros(63, dtype=np.float32)

                if detection_result.hand_landmarks:
                    hand_count = len(detection_result.hand_landmarks)
                    print(f"[KERAS DEBUG] Processing {hand_count} hand(s)")
                    for idx, hand_landmarks in enumerate(detection_result.hand_landmarks):
                        features = []
                        lm_list = []
                        for lm in hand_landmarks:
                            features.extend([lm.x, lm.y, lm.z])
                            lm_list.append([lm.x, lm.y, lm.z])

                        # Extract handedness safely
                        try:
                            handedness_info = detection_result.handedness[idx]
                            if hasattr(handedness_info, 'categories') and handedness_info.categories:
                                hand_type = handedness_info.categories[0].category_name
                            elif hasattr(handedness_info, 'classifications') and handedness_info.classifications:
                                hand_type = handedness_info.classifications[0].label
                            else:
                                hand_type = str(handedness_info[0]).split()[0] if handedness_info else 'Unknown'
                        except Exception as he:
                            print(f"[KERAS DEBUG] Handedness extraction error: {he}")
                            hand_type = 'Unknown'

                        hands_data.append({"type": hand_type, "landmarks": lm_list})
                        print(f"[KERAS DEBUG] Hand {idx}: type='{hand_type}', features={len(features)}")

                        if hand_type.lower() == 'left':
                            left_hand = np.array(features, dtype=np.float32)
                        elif hand_type.lower() == 'right':
                            right_hand = np.array(features, dtype=np.float32)
                        else:
                            # Unknown hand type: assign based on index (first=left, second=right)
                            if idx == 0:
                                left_hand = np.array(features, dtype=np.float32)
                                print(f"[KERAS DEBUG] Assigned unknown hand {idx} as LEFT")
                            else:
                                right_hand = np.array(features, dtype=np.float32)
                                print(f"[KERAS DEBUG] Assigned unknown hand {idx} as RIGHT")

                frame_features = np.concatenate([left_hand, right_hand])
                print(f"[KERAS DEBUG] Frame feature norm: {np.linalg.norm(frame_features):.4f}, non-zero: {np.count_nonzero(frame_features)}")
                sequence_buffer.append(frame_features.copy())

                buf_len = len(sequence_buffer)
                print(f"[KERAS DEBUG] Buffer: {buf_len}/45")

                if buf_len < 45:
                    pad_count = 45 - buf_len
                    padding = [np.zeros(126, dtype=np.float32)] * pad_count
                    full_sequence = list(padding) + list(sequence_buffer)
                else:
                    full_sequence = list(sequence_buffer)

                input_data = np.array(full_sequence, dtype=np.float32).reshape(1, 45, 126)
                keras_prediction = keras_model_instance.predict(input_data, verbose=0)
                predicted_class_id = int(np.argmax(keras_prediction))
                raw_confidence = float(keras_prediction[0][predicted_class_id])
                top5 = np.argsort(keras_prediction[0])[-5:][::-1]
                top5_str = ', '.join([f"{KERAS_CLASSES[i]}({keras_prediction[0][i]:.3f})" for i in top5])
                print(f"[KERAS DEBUG] Predicted idx={predicted_class_id}, class='{KERAS_CLASSES[predicted_class_id]}', conf={raw_confidence:.4f}")
                print(f"[KERAS DEBUG] Top-5: {top5_str}")
                alphabet = KERAS_CLASSES[predicted_class_id]
                confidence = raw_confidence

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        buffer_progress = 0
        buffer_total = 45
        if current_model_type == "keras":
            buffer_progress = min(len(sequence_buffer), 45)

        response = {
            "prediction": alphabet,
            "alphabet": alphabet,
            "confidence": round(confidence, 2),
            "model_name": os.path.basename(model_used_name) if model_used_name else "N/A",
            "model_type": model_used_type if model_used_type else "N/A",
            "timestamp": timestamp,
            "hand_count": hand_count if current_model_type == "keras" else 0,
            "hands": hands_data if current_model_type == "keras" else [],
            "buffer_progress": buffer_progress,
            "buffer_total": buffer_total
        }

        if alphabet != "None":
            cursor.execute(
                "INSERT INTO detections (user_id, alphabet, confidence, model_name, model_type, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id if user_id > 0 else None, alphabet, confidence, os.path.basename(model_used_name) if model_used_name else "N/A",
                 model_used_type if model_used_type else "N/A", timestamp)
            )
            conn.commit()
        return response
    except HTTPException:
        raise
    except Exception as e:
        print("Prediction Error:", e)
        return {
            "prediction": "None", "alphabet": "None", "confidence": 0.0,
            "model_name": "N/A", "model_type": "N/A",
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "hand_count": 0, "hands": [], "buffer_progress": 0, "buffer_total": 45
        }

@app.get("/history")
async def history(user_id: int = 0):
    if user_id > 0:
        cursor.execute("SELECT alphabet, confidence, model_name, model_type, timestamp FROM detections WHERE user_id=? ORDER BY id DESC LIMIT 50", (user_id,))
    else:
        cursor.execute("SELECT alphabet, confidence, model_name, model_type, timestamp FROM detections ORDER BY id DESC LIMIT 50")
    rows = cursor.fetchall()
    return [{"alphabet": r[0], "confidence": r[1], "model_name": r[2], "model_type": r[3], "timestamp": r[4]} for r in rows]

@app.get("/analytics")
async def analytics(user_id: int = 0):
    if user_id > 0:
        cursor.execute("SELECT alphabet, COUNT(*) FROM detections WHERE user_id=? GROUP BY alphabet", (user_id,))
    else:
        cursor.execute("SELECT alphabet, COUNT(*) FROM detections GROUP BY alphabet")
    rows = cursor.fetchall()
    labels = [r[0] for r in rows]
    data = [r[1] for r in rows]
    if user_id > 0:
        cursor.execute("SELECT COUNT(*) FROM detections WHERE user_id=?", (user_id,))
    else:
        cursor.execute("SELECT COUNT(*) FROM detections")
    total = cursor.fetchone()[0]
    return {"labels": labels, "data": data, "total": total}

@app.get("/profile")
async def get_profile(username: str):
    cursor.execute("SELECT id, username, email, profile_photo FROM users WHERE username=?", (username,))
    user_data = cursor.fetchone()
    if user_data:
        return {"user_id": user_data[0], "username": user_data[1], "email": user_data[2], "profile_photo": user_data[3]}
    raise HTTPException(status_code=404, detail="User not found")

@app.post("/update_profile")
async def update_profile(data: dict):
    username = data.get("username", "")
    email = data.get("email", "")
    profile_photo = data.get("profile_photo", "")
    current_password = data.get("password", "")
    new_password = data.get("new_password", "")

    if new_password:
        cursor.execute("SELECT password FROM users WHERE username=?", (username,))
        row = cursor.fetchone()
        if not row or not verify_password(current_password, row[0]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        hashed = get_password_hash(new_password)
        cursor.execute("UPDATE users SET email=?, profile_photo=?, password=? WHERE username=?", (email, profile_photo, hashed, username))
    else:
        cursor.execute("UPDATE users SET email=?, profile_photo=? WHERE username=?", (email, profile_photo, username))
    conn.commit()
    return {"message": "Profile updated successfully"}

@app.post("/select_model")
async def select_model(model_info: dict):
    global current_model_name, current_model_type
    model_path = os.path.normpath(model_info.get("path"))
    model_type = model_info.get("type")
    if model_path not in loaded_models:
        raise HTTPException(status_code=404, detail="Model not found or not loaded")
    current_model_name = model_path
    current_model_type = model_type

    sequence_buffer.clear()

    return {"status": "success", "model_name": current_model_name, "model_type": current_model_type}

@app.get("/debug")
async def debug_status():
    info = {
        "models_ready": models_ready,
        "current_model_type": current_model_type,
        "current_model_name": current_model_name,
        "loaded_models": list(loaded_models.keys()),
        "model_loaded": current_model_name in loaded_models if current_model_name else False,
        "mediapipe_model_path": _mediapipe_model_path,
        "sequence_buffer_len": len(sequence_buffer),
    }

    if _mediapipe_model_path and _mediapipe_model_path in loaded_models:
        try:
            import cv2
            import numpy as np
            test_img = np.zeros((480, 640, 3), dtype=np.uint8)
            test_img[:, :] = [180, 150, 130]
            rgb = cv2.cvtColor(test_img, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            mp_landmarker = loaded_models[_mediapipe_model_path]
            result = mp_landmarker.detect(mp_img)
            info["mediapipe_test"] = {
                "success": True,
                "hands_found": len(result.hand_landmarks)
            }
        except Exception as e:
            info["mediapipe_test"] = {
                "success": False,
                "error": str(e)
            }

    return info

# ---------------------------------
# Frontend
# ---------------------------------
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
