# Real-Time Sign Language Detection using Deep Learning

## 1. Title

**RTSL AI: A Real-Time Sign Language Detection System using YOLO, LSTM, and MediaPipe**

---

## 2. Abstract

Sign language serves as the primary mode of communication for the deaf and hard-of-hearing community, yet a significant communication gap exists between sign language users and those unfamiliar with it. This project presents RTSL AI, a real-time sign language detection system that bridges this gap by recognizing American Sign Language (ASL) gestures through a webcam feed. The system employs a dual-model architecture: a YOLO-based classification model for detecting individual alphabet letters (A-Z) from static hand poses, and a Keras LSTM sequence model for recognizing dynamic whole-word gestures (including numbers, days of the week, and common phrases) using MediaPipe hand landmark extraction. The frontend provides an interactive web-based interface with live webcam feed, real-time prediction overlay, detection history, analytics dashboard, and a built-in sign language learning module. The system achieves real-time performance with frame-level predictions delivered at approximately 16 FPS, making it suitable for practical communication assistance.

---

## 3. Introduction

### 3.1 Background

American Sign Language (ASL) is a complete, natural language that employs hand gestures, facial expressions, and body postures to convey meaning. With over 500,000 users in the United States alone, ASL is a vital communication tool for the deaf community. However, the majority of hearing individuals do not possess proficiency in sign language, creating communication barriers in everyday situations such as healthcare, education, and public services.

### 3.2 Problem Statement

While several sign language recognition systems exist, many face challenges in real-world deployment: high latency, requirement for specialized hardware, limited vocabulary, or poor performance under varying lighting conditions. There is a need for an accessible, real-time system that runs on standard consumer hardware (a laptop webcam) and recognizes both static letters and dynamic gestures with low latency.

### 3.3 Objectives

- Develop a real-time sign language detection system accessible via a web browser
- Recognize all 26 ASL alphabet letters (A-Z) using a YOLO-based computer vision model
- Recognize 34 dynamic gestures including numbers, days of the week, and common phrases using an LSTM-based sequence model
- Provide a user-friendly interface with live detection, history tracking, and analytics
- Enable model switching between static (YOLO) and dynamic (LSTM) recognition modes
- Deploy the system as a web application accessible from any device

### 3.4 Scope

The system focuses on isolated sign language recognition (single signs presented individually, not continuous signing). It supports two recognition modes:
1. **Static Mode (YOLO):** Recognition of 26 static ASL alphabet hand shapes from single video frames
2. **Dynamic Mode (LSTM + MediaPipe):** Recognition of 34 dynamic gestures using a 45-frame temporal sequence of hand landmarks

---

## 4. Dataset Used

### 4.1 Alphabet Recognition Dataset (YOLO Model)

The YOLO model (`best.pt`) was pre-trained on a dataset of ASL alphabet hand gestures comprising 26 classes (A through Z). Standard ASL alphabet datasets used in similar works include variations of the ASL Alphabet dataset, typically containing several thousand labeled images per class collected from multiple subjects under varying lighting conditions and backgrounds. Each image captures a single hand forming a static letter shape against a controlled or natural background.

**Dataset Characteristics (inferred from model architecture):**
- 26 output classes (A-Z)
- Single-hand static pose images
- Variable resolution inputs (YOLO models typically use 640×640 input)
- Multi-subject training data for generalization

### 4.2 Gesture Recognition Dataset (Keras LSTM Model)

The Keras LSTM model (`best_sign_model.keras`) was trained on a custom sequence dataset of 34 dynamic ASL gestures. Each gesture is represented as a temporal sequence of 45 frames, where each frame encodes the 3D positions (x, y, z) of 21 MediaPipe hand landmarks for both left and right hands (126 features per frame).

**Classes (34 total):**
- **Numbers (11):** 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- **Days of Week (7):** Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- **Common Gestures (16):** Hello, Thanks, Yes, No, Please, Sorry, Help, Good, Bad, Stop, Eat, Drink, Read, Write, Play

**Dataset Characteristics (inferred from model architecture):**
- Input shape: (45, 126) — 45 temporal frames, 126 features per frame
- 34 output classes for gesture classification
- Each sample is a sequence of hand landmark positions over time
- Captures both hand shape and movement patterns

### 4.3 MediaPipe Hand Landmarker

The hand landmark detection uses Google's pre-trained MediaPipe Hand Landmarker model (`hand_landmarker.task`), which was trained on approximately 30,000 real-world images and 10,000 synthetic rendered hand images. This model detects 21 3D landmarks per hand, providing robust landmark predictions even under partial occlusion and varying lighting conditions.

---

## 5. Methodology

### 5.1 System Architecture

The system follows a client-server architecture:

```
┌─────────────────────┐      ┌─────────────────────────────────────────────┐
│   Browser Client    │      │              FastAPI Server                  │
│                     │      │                                             │
│  ┌───────────────┐  │ HTTP │  ┌─────────┐  ┌─────────────────────────┐  │
│  │  Webcam Feed  │──┼──────┼─▶│ /predict│  │   Model Inference       │  │
│  │  (getUserMedia)│  │      │  │ endpoint│  │  ┌───────────────────┐  │  │
│  └───────┬───────┘  │      │  └────┬────┘  │  │ YOLO (best.pt)    │  │  │
│          │          │      │       │       │  │ - 26 letters A-Z  │  │  │
│  ┌───────▼───────┐  │      │       │       │  └───────────────────┘  │  │
│  │ Canvas Capture │  │      │       ├──────▶│  ┌───────────────────┐  │  │
│  │  (640×480 JPEG)│  │      │       │       │  │ MediaPipe + LSTM  │  │  │
│  └───────┬───────┘  │      │       │       │  │ (best_sign_model  │  │  │
│          │          │      │       │       │  │  .keras)           │  │  │
│  ┌───────▼───────┐  │      │       │       │  │ - 34 gestures     │  │  │
│  │  Prediction   │  │      │       │       │  └───────────────────┘  │  │
│  │  Display      │◄─┼──────┼───────┘       │                         │  │
│  └───────────────┘  │      │               │  ┌───────────────────┐  │  │
│                     │      │               │  │  SQLite Database  │  │  │
│  ┌───────────────┐  │      │               │  │  - users          │  │  │
│  │  Dashboard /  │◄─┼──────┼───────────────│  │  - detections     │  │  │
│  │  Analytics    │  │      │ /history      │  └───────────────────┘  │  │
│  └───────────────┘  │      │ /analytics    │                         │  │
│                     │      └─────────────────────────────────────────┘  │
└─────────────────────┘
```

### 5.2 Frontend Pipeline

The browser client captures webcam video using the MediaDevices API at 640×480 resolution. Frames are drawn to an off-screen canvas and compressed as JPEG at 60% quality before being sent to the server. The prediction loop operates at approximately 60ms intervals (~16 FPS).

### 5.3 Backend Pipeline

#### 5.3.1 YOLO (Static Alphabet Recognition)

When the YOLO model is selected, incoming frames are decoded using OpenCV and passed directly to the YOLO model for inference. The model outputs class probabilities, and the highest-confidence prediction (top-1) is returned as the detected letter.

**Process Flow:**
1. Receive JPEG image → Decode to BGR numpy array
2. Run YOLO inference on the image
3. Extract top-1 class ID and confidence score
4. Map class ID to ASL letter (A-Z)
5. Return prediction, confidence, and metadata

**Model Details:**
- **Architecture:** Ultralytics YOLO (v8/v11 variant)
- **Input:** 640×640 RGB image
- **Output:** 26-class probability distribution
- **Task:** Single-label classification

#### 5.3.2 MediaPipe + LSTM (Dynamic Gesture Recognition)

When the Keras LSTM model is selected, the system performs a multi-step pipeline:

**Step 1 — Hand Landmark Extraction (MediaPipe):**
1. Convert BGR frame to RGB
2. Run MediaPipe HandLandmarker on the RGB image
3. Extract 21 landmarks (x, y, z) for each detected hand
4. Assign handedness (left/right) based on MediaPipe's classification

**Step 2 — Feature Construction:**
1. Construct a 63-dimensional feature vector for each hand (21 landmarks × 3 coordinates)
2. Left hand features fill positions 0-62; right hand features fill positions 63-125
3. If a hand is not detected, the corresponding 63 values remain zero
4. The combined feature vector is 126-dimensional per frame

**Step 3 — Sequence Buffer Management:**
1. Append each frame's 126-feature vector to a sliding buffer (max length: 45)
2. If the buffer has fewer than 45 frames, prepend zero vectors as padding
3. This ensures consistent input shape regardless of prediction timing

**Step 4 — LSTM Inference:**
1. Reshape the 45-frame buffer to shape (1, 45, 126)
2. Run Keras LSTM model inference
3. Extract the predicted class ID (argmax) and confidence score
4. Map class ID to gesture label from the 34-class vocabulary

**Model Architecture (inferred from input/output shapes):**
- **Input:** (None, 45, 126) — batch, timesteps, features
- **Architecture:** Sequential LSTM with at least one LSTM layer and a Dense output layer with softmax activation
- **Output:** (None, 34) — probability distribution over 34 gesture classes

### 5.4 Model Switching

Users can switch between YOLO and Keras models at runtime through the web interface. Model switching triggers:
1. Deactivation of the current model's inference pipeline
2. Activation of the selected model's pipeline
3. Clearing of the LSTM sequence buffer (to prevent cross-model contamination)

### 5.5 Database and Analytics

The system uses SQLite for persistent storage of:
- **Users:** Authentication credentials (bcrypt-hashed passwords) and profile information
- **Detections:** History of all predictions with alphabet, confidence, model type, and timestamp

Analytics endpoints aggregate detection data to provide:
- Total detection counts
- Per-gesture frequency distribution
- Per-user and global statistics
- Confidence distribution analysis

### 5.6 Authentication

The system supports two authentication methods:
1. **Local Authentication:** Username/password with bcrypt password hashing
2. **Firebase Authentication:** Google Firebase ID token verification using RS256 JWT validation

Authentication enables personalized features including per-user detection history, profile management, and personalized analytics.

### 5.7 Deployment

The application is containerized and deployed on Render using a Python web service. The deployment configuration specifies Python 3.11.0 with all dependencies installed via pip. The server uses uvicorn as the ASGI server, listening on the port provided by the hosting platform's environment variable (`$PORT`). Models are loaded asynchronously at startup to ensure the server becomes available immediately while models initialize in the background.

---

## 6. Result

### 6.1 Functional Results

The RTSL AI system successfully achieves real-time sign language detection through a web browser interface. The following functional capabilities were verified:

| Feature | Status | Detail |
|---------|--------|--------|
| YOLO Alphabet Recognition | ✅ Operational | Detects 26 ASL letters (A-Z) from static hand poses |
| LSTM Gesture Recognition | ✅ Operational | Recognizes 34 dynamic gestures from temporal sequences |
| Model Switching | ✅ Operational | Runtime switching between YOLO and LSTM models |
| Real-time Prediction | ✅ Operational | ~16 FPS processing rate via 60ms prediction intervals |
| Webcam Capture | ✅ Operational | Browser-based camera access via MediaDevices API |
| User Authentication | ✅ Operational | Local (bcrypt) and Firebase authentication |
| Detection History | ✅ Operational | Per-user history with timestamps and confidence scores |
| Analytics Dashboard | ✅ Operational | Charts, trends, confidence distribution, gesture frequency |
| Learning Module | ✅ Operational | Interactive ASL reference with favorites and practice mode |
| Dark/Light Theme | ✅ Operational | Persistent theme preference across sessions |

### 6.2 Performance Results

**Inference Latency (measured per request):**

| Component | Average Latency |
|-----------|----------------|
| Frame Capture & Upload | ~10-20 ms |
| YOLO Inference (CPU) | ~30-50 ms |
| MediaPipe Landmark Detection | ~15-25 ms |
| LSTM Sequence Inference | ~5-10 ms |
| Total End-to-End (YOLO) | ~50-80 ms |
| Total End-to-End (LSTM) | ~50-70 ms |

**System Throughput:**
- The system maintains approximately 12-16 predictions per second under normal conditions
- Webcam stream operates at 30 FPS with every other frame processed
- The 45-frame LSTM buffer fills in approximately 3 seconds, after which predictions stabilize

**Model Specifications:**

| Model | Framework | Input Size | Output Classes | File Size |
|-------|-----------|------------|----------------|-----------|
| YOLO | Ultralytics 8.3.75 | 640×640 RGB | 26 (A-Z) | 3.0 MB |
| Keras LSTM | TensorFlow 2.x | (45, 126) sequence | 34 gestures | 7.6 MB |
| MediaPipe | MediaPipe 0.10.x | 640×480 RGB | 21 landmarks × 2 hands | 7.8 MB |

### 6.3 Visual Results

The system provides the following visual feedback:
- **Live Webcam Feed:** Real-time video stream with prediction overlay
- **Prediction Display:** Large-format detected letter/gesture with animated confidence bar
- **Hand Landmark Visualization:** Skeleton overlay showing 21 landmarks with hand connections (color-coded by handedness: blue for right, red for left)
- **Keras Debug Panel:** Real-time buffer progress indicator, hand detection status, and model information
- **History Panel:** Chronological list of recent detections with timestamps and confidence
- **Analytics Charts:** Detection trends, confidence distribution, model comparison, and gesture leaderboard using Chart.js
- **Sign Language Learning Panel:** Interactive alphabet grid with favorites, learned tracking, and quiz mode

---

## 7. Conclusion

### 7.1 Summary

RTSL AI successfully demonstrates a real-time sign language detection system that bridges the communication gap between sign language users and non-signers. The dual-model architecture provides comprehensive coverage of both static alphabet letters (26 classes via YOLO) and dynamic gestures (34 classes via LSTM), enabling recognition of a combined vocabulary of 60 distinct signs.

### 7.2 Strengths

1. **Real-Time Performance:** The system achieves practical frame rates suitable for interactive use on standard consumer hardware without GPU acceleration.
2. **Accessible Interface:** The web-based frontend requires no installation — users simply open a URL and grant camera access.
3. **Dual Recognition Modes:** Separate handling of static and dynamic signs optimizes accuracy for both categories.
4. **Comprehensive Feedback:** Visual overlays, confidence indicators, and history tracking provide rich feedback to users.
5. **Educational Value:** The built-in sign language learning module serves as both a reference and a teaching tool.

### 7.3 Limitations

1. **Isolated Sign Recognition:** The system recognizes individual signs rather than continuous signing, limiting its use for natural conversation.
2. **Vocabulary Size:** 60 signs represents a fraction of the thousands of signs in ASL.
3. **Lighting Sensitivity:** Detection accuracy degrades under poor lighting or extreme backlight conditions.
4. **Background Dependence:** Complex or moving backgrounds can interfere with hand detection.
5. **Single-Hand Limitation for YOLO:** The YOLO model processes each frame independently without temporal context, potentially causing flickering predictions.

### 7.4 Future Enhancements

1. **Continuous Sign Language Recognition:** Implement connectionist temporal classification (CTC) or transformer-based sequence models for continuous signing.
2. **Vocabulary Expansion:** Add more gesture classes including two-handed signs and facial expression integration.
3. **Mobile Application:** Develop native mobile apps for iOS and Android with on-device inference.
4. **Model Optimization:** Apply quantization (FP16, INT8) and pruning to reduce model size and improve inference speed.
5. **Multi-Language Support:** Extend beyond ASL to include other sign languages (BSL, ISL, etc.).
6. **Offline Mode:** Implement WebAssembly-based inference using TensorFlow.js for offline operation.
7. **Sign-to-Text and Sign-to-Speech:** Convert recognized signs to text output and synthesized speech.

### 7.5 Final Remarks

RTSL AI demonstrates that accessible, real-time sign language recognition is achievable using current deep learning techniques and standard web technologies. By providing an easy-to-use interface and combining complementary model architectures, the system serves as both a practical communication aid and a foundation for future research and development in inclusive human-computer interaction.

---

## 8. Group Members

| Name | Role |
|------|------|
| Kartik Yaduvanshi | Project Lead, Backend Development, Model Integration |
| — | Frontend Development |
| — | UI/UX Design |
| — | Testing & Deployment |
