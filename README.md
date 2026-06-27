---
title: RTSL AI
emoji: 🤖
colorFrom: blue
colorTo: teal
sdk: docker
pinned: false
short_description: Real-Time Sign Language Detection
---

# RTSL AI

Real-Time Sign Language Detection using YOLO, Keras LSTM, and MediaPipe.

## API Endpoints

- `GET /` - Landing page
- `POST /predict` - Upload image for sign language detection
- `GET /available_models` - List loaded models
- `POST /select_model` - Switch between YOLO/Keras models
- `POST /login` - User login
- `POST /signup` - User registration
- `GET /history` - Detection history
- `GET /analytics` - Detection analytics
- `GET /debug` - Model status info
