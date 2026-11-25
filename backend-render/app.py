import os
import asyncio
import cv2
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile, Header, HTTPException

app = FastAPI()

# Kunci rahasia diambil dari Environment Variable di dashboard Render
API_KEY = os.environ.get("API_KEY", "")
MAX_FILE_SIZE = 500 * 1024  # Batas keras 500 KB per foto (anti serangan OOM)

# Palang pintu antrean RAM: maksimal 1 foto diproses AI dalam satu waktu.
# Penting juga karena FaceDetectorYN.setInputSize() tidak aman dipanggil paralel.
ai_lock = asyncio.Semaphore(1)

# Muat model YuNet & SFace SEKALI saja saat server menyala
detector = cv2.FaceDetectorYN.create(
    model="models/yunet.onnx",
    config="",
    input_size=(320, 320),
    score_threshold=0.80,
    nms_threshold=0.3,
    top_k=5000,
)
recognizer = cv2.FaceRecognizerSF.create(
    model="models/sface.onnx",
    config=""
)


def verify_api_key(x_api_key: str):
    if not API_KEY or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Akses ditolak: API Key tidak valid")


async def read_image_in_memory(upload_file: UploadFile):
    """Baca foto langsung di RAM tanpa menyentuh hard disk (Zero-Storage)."""
    contents = await upload_file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Ukuran foto melebihi batas 500 KB")

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="File gambar rusak atau bukan format gambar")
    return img


def validate_brightness(img):
    """Cek kecerahan (cahaya) sebelum masuk ke deteksi wajah."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))

    if brightness < 45:
        raise HTTPException(
            status_code=400,
            detail=f"Cahaya terlalu gelap (skor {brightness:.0f}). Cari tempat lebih terang."
        )
    if brightness > 225:
        raise HTTPException(
            status_code=400,
            detail=f"Cahaya terlalu silau/backlight (skor {brightness:.0f})."
        )


def validate_face_sharpness(img, face, min_sharpness: float = 10.0):
    """Cek ketajaman (blur) HANYA pada area wajah agar tembok polos di belakang tidak merusak skor."""
    h_img, w_img = img.shape[:2]
    x1 = max(0, int(face[0]))
    y1 = max(0, int(face[1]))
    x2 = min(w_img, int(face[0] + face[2]))
    y2 = min(h_img, int(face[1] + face[3]))

    if x2 <= x1 or y2 <= y1:
        raise HTTPException(status_code=400, detail="Area wajah tidak valid. Posisikan wajah di tengah.")

    face_roi = img[y1:y2, x1:x2]
    gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray_face, cv2.CV_64F).var())

    if sharpness < min_sharpness:
        raise HTTPException(
            status_code=400,
            detail=f"Foto wajah terlalu buram (skor {sharpness:.1f}, min {min_sharpness:.0f}). Tahan HP dengan stabil."
        )


def detect_single_face(img):
    """Jalankan YuNet dan pastikan hanya ada tepat 1 wajah di frame."""
    h, w = img.shape[:2]
    detector.setInputSize((w, h))  # Wajib disetel ulang sesuai ukuran foto masuk
    _, faces = detector.detect(img)

    if faces is None or len(faces) == 0:
        raise HTTPException(status_code=400, detail="Wajah tidak terdeteksi di kamera.")
    if len(faces) > 1:
        raise HTTPException(status_code=400, detail="Terdeteksi lebih dari 1 wajah. Pastikan hanya wajah Anda di layar.")
    return faces[0]


def classify_head_pose(face):
    """
    Hitung arah hadap kepala dari 5 titik landmark YuNet:
    face[4]=mata1_x, face[6]=mata2_x, face[8]=hidung_x
    """
    eye_left_x = min(float(face[4]), float(face[6]))
    eye_right_x = max(float(face[4]), float(face[6]))
    nose_x = float(face[8])
    eye_distance = eye_right_x - eye_left_x

    if eye_distance < 15:
        raise HTTPException(status_code=400, detail="Wajah terlalu jauh dari kamera. Mohon dekatkan.")

    # Rasio 0.5 = hidung persis di tengah kedua mata (hadap depan)
    ratio = (nose_x - eye_left_x) / eye_distance

    if 0.33 <= ratio <= 0.67:
        return "DEPAN", ratio
    elif ratio < 0.28:
        return "KANAN", ratio   # Jika arah kamera depan HP terbalik (mirror), tinggal tukar label ini
    elif ratio > 0.72:
        return "KIRI", ratio
    else:
        return "KURANG_JELAS", ratio


def extract_normalized_embedding(img, face):
    """Ekstrak 128 angka vektor dari SFace dan normalisasi agar presisi untuk Cosine Similarity."""
    aligned = recognizer.alignCrop(img, face)
    feature = recognizer.feature(aligned)[0]  # Ambil array 128 angka
    norm = np.linalg.norm(feature)
    if norm == 0:
        raise HTTPException(status_code=500, detail="Gagal mengekstrak fitur wajah")
    return (feature / norm).tolist()


@app.get("/health")
def health_check():
    """Endpoint ringan khusus di-ping oleh Supabase pg_cron."""
    return {"status": "ok"}


@app.post("/register-face")
async def register_face(
    photo: UploadFile = File(...),
    x_api_key: str = Header(default="")
):
    """Dipakai saat pendaftaran wajah karyawan baru (wajib hadap depan)."""
    verify_api_key(x_api_key)
    img = await read_image_in_memory(photo)

    async with ai_lock:
        validate_brightness(img)
        face = detect_single_face(img)
        validate_face_sharpness(img, face, min_sharpness=10.0)
        pose, _ = classify_head_pose(face)
        if pose != "DEPAN":
            raise HTTPException(status_code=400, detail=f"Saat pendaftaran wajah wajib menghadap DEPAN (terdeteksi: {pose}).")
        embedding = extract_normalized_embedding(img, face)

    return {"embedding": embedding}

@app.post("/verify-liveness")
async def verify_liveness(
    photo_front: UploadFile = File(...),
    photo_challenge: UploadFile = File(...),
    expected_pose: str = Form(...),
    x_api_key: str = Header(default="")
):
    """Dipakai saat absen: cek Foto 1 (DEPAN), Foto 2 (KIRI/KANAN), lalu keluarkan vektor."""
    verify_api_key(x_api_key)
    img_front = await read_image_in_memory(photo_front)
    img_chal = await read_image_in_memory(photo_challenge)

    async with ai_lock:
        # 1. Cek kualitas & pose Foto 1 (wajib hadap depan)
        validate_brightness(img_front)
        face_front = detect_single_face(img_front)
        validate_face_sharpness(img_front, face_front, min_sharpness=10.0)
        pose_front, _ = classify_head_pose(face_front)
        if pose_front != "DEPAN":
            raise HTTPException(status_code=400, detail=f"Foto pertama wajib hadap DEPAN (terdeteksi: {pose_front}).")

        # 2. Cek kualitas & pose Foto 2 (wajib sesuai tantangan KIRI/KANAN)
        validate_brightness(img_chal)
        face_chal = detect_single_face(img_chal)
        validate_face_sharpness(img_chal, face_chal, min_sharpness=8.0)
        pose_chal, ratio_chal = classify_head_pose(face_chal)
        if pose_chal != expected_pose:
            raise HTTPException(
                status_code=400,
                detail=f"Tantangan gagal! Diminta tengok {expected_pose}, terdeteksi {pose_chal} (rasio {ratio_chal:.2f})."
            )

        # 3. Pastikan Foto 1 dan Foto 2 adalah ORANG YANG SAMA
        emb_front = extract_normalized_embedding(img_front, face_front)
        emb_chal = extract_normalized_embedding(img_chal, face_chal)
        same_person_score = float(np.dot(emb_front, emb_chal))
        if same_person_score < 0.25:
            raise HTTPException(status_code=400, detail="Wajah pada Foto 1 dan Foto 2 tidak cocok (terdeteksi orang berbeda).")

    return {
        "embedding": emb_front,
        "pose_verified": pose_chal,
        "liveness_consistency": round(same_person_score, 3)
    }